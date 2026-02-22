import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.worldlabs.ai"

BLENDER_FORMAT_PRIORITY = (
    "obj",
    "fbx",
    "stl",
    "glb",
    "gltf",
    "ply",
    "dae",
    "usd",
    "usdz",
)

MESH_KEY_FORMAT_HINTS = {
    "collider_mesh_url": "glb",
    "collider_mesh": "glb",
    "collidermeshurl": "glb",
    "collidermesh": "glb",
    "mesh_url": "obj",
    "mesh": "obj",
    "meshurl": "obj",
    "meshfileurl": "obj",
    "modelurl": "glb",
    "model_file_url": "glb",
    "modelfileurl": "glb",
    "textured_mesh_url": "obj",
    "texturedmeshurl": "obj",
    "texturedmesh": "obj",
    "textured_mesh": "obj",
    "obj_url": "obj",
    "obj": "obj",
    "fbx_url": "fbx",
    "fbx": "fbx",
    "stl_url": "stl",
    "stl": "stl",
    "ply_url": "ply",
    "ply": "ply",
    "glb_url": "glb",
    "glb": "glb",
    "gltf_url": "gltf",
    "gltf": "gltf",
    "dae_url": "dae",
    "dae": "dae",
    "usd_url": "usd",
    "usd": "usd",
    "usdz_url": "usdz",
    "usdz": "usdz",
}


@dataclass
class WorldAssets:
    world_id: str
    marble_url: str
    thumbnail_url: Optional[str]
    splat_urls: Dict[str, Optional[str]]
    collider_mesh_url: Optional[str]
    mesh_urls: Dict[str, Optional[str]]
    pano_url: Optional[str]
    caption: Optional[str]


class WorldLabsError(Exception):
    pass


def _normalize_world_payload(raw: dict, fallback_world_id: Optional[str] = None) -> dict:
    """
    Normalize world responses from different API shapes to a world object dict.
    """
    if not isinstance(raw, dict):
        raise WorldLabsError("Unexpected world response type: %s" % type(raw).__name__)

    nested_data = raw.get("data")
    nested_response = raw.get("response")
    nested_result = raw.get("result")

    candidates = [
        raw.get("world"),
        nested_data.get("world") if isinstance(nested_data, dict) else None,
        nested_response.get("world") if isinstance(nested_response, dict) else None,
        nested_result.get("world") if isinstance(nested_result, dict) else None,
        nested_data if isinstance(nested_data, dict) else None,
        nested_response if isinstance(nested_response, dict) else None,
        nested_result if isinstance(nested_result, dict) else None,
        raw,
    ]

    world = None
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        if candidate.get("id") or candidate.get("world_id") or candidate.get("assets"):
            world = candidate
            break
        # Some wrappers may still keep the world under a single nested object key.
        for value in candidate.values():
            if isinstance(value, dict) and (
                value.get("id") or value.get("world_id") or value.get("assets")
            ):
                world = value
                break
        if world:
            break

    if not world:
        keys = ", ".join(sorted(raw.keys()))
        raise WorldLabsError(
            "World response did not include a recognizable world object. Top-level keys: %s" % keys
        )

    if not world.get("id") and fallback_world_id:
        world = {**world, "id": fallback_world_id}

    return world


def _coerce_url(value) -> Optional[str]:
    """Extract a usable URL string from common API value shapes."""
    if isinstance(value, str):
        url = value.strip()
        return url or None

    if isinstance(value, dict):
        for key in ("url", "download_url", "signed_url", "href", "uri", "spz_url", "file_url"):
            coerced = _coerce_url(value.get(key))
            if coerced:
                return coerced

        # Some responses wrap URLs one level deeper under arbitrary keys.
        for nested in value.values():
            coerced = _coerce_url(nested)
            if coerced:
                return coerced

    return None


def _file_extension_from_url(url: str) -> str:
    if not isinstance(url, str):
        return ""
    base = url.split("?", 1)[0].split("#", 1)[0]
    if "." not in base:
        return ""
    return base.rsplit(".", 1)[-1].strip().lower()


def _extract_format_from_url_text(url: str) -> Optional[str]:
    """
    Best-effort format detection from full URL text, including query/path fragments.
    Handles encoded URLs where extension might not be in terminal pathname.
    """
    if not isinstance(url, str):
        return None

    lowered = url.strip().lower()
    if not lowered:
        return None

    ext = _file_extension_from_url(lowered)
    if ext in BLENDER_FORMAT_PRIORITY:
        return ext

    decoded = lowered.replace("%2e", ".")
    for fmt in BLENDER_FORMAT_PRIORITY:
        if re.search(r"(^|[^a-z0-9])%s($|[^a-z0-9])" % re.escape(fmt), decoded):
            return fmt

    return None


def _infer_format_from_key(key: str) -> Optional[str]:
    raw = str(key or "").strip()
    # Convert camelCase/PascalCase to snake_case before normalization.
    snake = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", raw)
    key_norm = snake.lower().replace("-", "_").replace(" ", "_")
    key_compact = re.sub(r"[^a-z0-9]", "", key_norm)
    if not key_norm:
        return None
    if key_norm in MESH_KEY_FORMAT_HINTS:
        return MESH_KEY_FORMAT_HINTS[key_norm]
    if key_compact in MESH_KEY_FORMAT_HINTS:
        return MESH_KEY_FORMAT_HINTS[key_compact]

    # If the key clearly indicates a mesh/collider/model URL but lacks explicit format,
    # default to GLB, which aligns with World Labs collider mesh docs.
    if (
        ("mesh" in key_norm or "model" in key_norm or "collider" in key_norm)
        and ("url" in key_norm or "uri" in key_norm or "file" in key_norm)
    ):
        return "glb"

    for fmt in BLENDER_FORMAT_PRIORITY:
        if fmt in key_norm or fmt in key_compact:
            return fmt

    return None


def _blender_format_for_candidate(url: str, key_hint: str = "") -> Optional[str]:
    ext = _extract_format_from_url_text(url)
    if ext in BLENDER_FORMAT_PRIORITY:
        return ext

    hint = _infer_format_from_key(key_hint)
    if hint in BLENDER_FORMAT_PRIORITY:
        return hint

    return None


def _looks_like_url(value: str) -> bool:
    if not isinstance(value, str):
        return False
    v = value.strip().lower()
    return v.startswith("http://") or v.startswith("https://")


def _collect_url_candidates(payload, path: str = "") -> List[Dict[str, str]]:
    """Recursively collect URL strings with path-based key hints."""
    results: List[Dict[str, str]] = []

    def walk(node, node_path: str):
        if isinstance(node, dict):
            for key, value in node.items():
                key_str = str(key)
                next_path = ("%s.%s" % (node_path, key_str)) if node_path else key_str
                walk(value, next_path)
            return

        if isinstance(node, list):
            for idx, value in enumerate(node):
                next_path = ("%s[%d]" % (node_path, idx)) if node_path else ("[%d]" % idx)
                walk(value, next_path)
            return

        if isinstance(node, str) and _looks_like_url(node):
            results.append({"url": node.strip(), "hint": node_path})

    walk(payload, path)
    return results


def extract_collider_mesh_url_from_payload(payload: dict) -> Optional[str]:
    """
    Recursively find collider mesh URL candidates in arbitrary payloads.
    Prioritizes keys that look like collider mesh fields.
    """
    if not isinstance(payload, dict):
        return None

    candidates = []
    for item in _collect_url_candidates(payload):
        url = _coerce_url(item.get("url"))
        if not url:
            continue
        hint = str(item.get("hint") or "").lower()
        hint_norm = hint.replace("-", "_")
        score = 0
        if "collider_mesh_url" in hint_norm:
            score = 100
        elif "collider" in hint_norm and "mesh" in hint_norm:
            score = 90
        elif "collider" in hint_norm:
            score = 70
        elif "mesh" in hint_norm:
            score = 50
        else:
            continue

        # Prefer explicit blender-friendly model formats when available.
        fmt = _blender_format_for_candidate(url, hint_norm)
        if fmt in {"glb", "gltf", "fbx", "obj", "stl", "ply", "dae", "usd", "usdz"}:
            score += 10
        candidates.append((score, url))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def extract_pano_url_from_payload(payload: dict) -> Optional[str]:
    """
    Recursively find panorama URL candidates in arbitrary payloads.
    """
    if not isinstance(payload, dict):
        return None

    candidates = []
    for item in _collect_url_candidates(payload):
        url = _coerce_url(item.get("url"))
        if not url:
            continue
        hint = str(item.get("hint") or "").lower()
        hint_norm = hint.replace("-", "_")
        score = 0
        if "pano_url" in hint_norm or "panorama_url" in hint_norm:
            score = 100
        elif "panorama" in hint_norm:
            score = 90
        elif "pano" in hint_norm:
            score = 80
        else:
            continue
        candidates.append((score, url))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def pick_blender_export(
    collider_mesh_url: Optional[str],
    mesh_urls: Optional[Dict[str, Optional[str]]] = None,
    splat_urls: Optional[Dict[str, Optional[str]]] = None,
) -> Optional[Dict[str, str]]:
    """Pick the best Blender-compatible export URL from available mesh assets."""
    candidates = []
    seen = set()

    def register(url_value, key_hint: str):
        url = _coerce_url(url_value)
        if not url or url in seen:
            return
        fmt = _blender_format_for_candidate(url, key_hint)
        if not fmt:
            return
        seen.add(url)
        candidates.append({"url": url, "format": fmt})

    register(collider_mesh_url, "collider_mesh_url")

    for key, value in (mesh_urls or {}).items():
        register(value, str(key))

    # Fallback: use splat URLs if they are directly Blender-compatible formats (e.g., .ply).
    for key, value in (splat_urls or {}).items():
        register(value, "splat_%s" % str(key))

    if not candidates:
        return None

    rank = {fmt: i for i, fmt in enumerate(BLENDER_FORMAT_PRIORITY)}
    candidates.sort(key=lambda item: rank.get(item["format"], 999))
    return candidates[0]


def pick_blender_export_from_payload(payload: dict) -> Optional[Dict[str, str]]:
    """
    Search an arbitrary provider payload for Blender-compatible URLs.
    Useful when schema shifts and structured extraction misses fields.
    """
    if not isinstance(payload, dict):
        return None

    candidates = []
    seen = set()
    rank = {fmt: i for i, fmt in enumerate(BLENDER_FORMAT_PRIORITY)}

    for item in _collect_url_candidates(payload):
        url = _coerce_url(item.get("url"))
        if not url or url in seen:
            continue
        fmt = _blender_format_for_candidate(url, item.get("hint", ""))
        if not fmt:
            continue
        seen.add(url)
        candidates.append({"url": url, "format": fmt})

    if not candidates:
        return None

    candidates.sort(key=lambda entry: rank.get(entry["format"], 999))
    return candidates[0]


def extract_mesh_data_from_world(world: dict) -> Dict[str, object]:
    """
    Extract mesh URLs from a fetched world payload in a shape suitable for persistence.
    """
    normalized = _normalize_world_payload(world or {})
    assets = _extract_assets(normalized)
    return {
        "colliderMeshUrl": assets.collider_mesh_url,
        "meshUrls": assets.mesh_urls,
    }


def _extract_mesh_urls(mesh: dict) -> Dict[str, Optional[str]]:
    """Collect available mesh asset URLs for downstream export/use."""
    if not isinstance(mesh, dict):
        return {}

    urls: Dict[str, Optional[str]] = {}

    preferred_keys = (
        "collider_mesh_url",
        "mesh_url",
        "textured_mesh_url",
        "glb_url",
        "gltf_url",
        "obj_url",
        "fbx_url",
        "ply_url",
        "stl_url",
        "usd_url",
        "usdz_url",
    )
    for key in preferred_keys:
        url = _coerce_url(mesh.get(key))
        if url:
            urls[key] = url

    nested_urls = mesh.get("urls")
    if isinstance(nested_urls, dict):
        for key, value in nested_urls.items():
            url = _coerce_url(value)
            if url:
                urls[str(key)] = url

    # Defensive fallback for unrecognized response keys that still contain URLs.
    for key, value in mesh.items():
        if key in urls:
            continue
        url = _coerce_url(value)
        if not url:
            continue

        key_str = str(key)
        if isinstance(key, str) and ("url" in key or key.endswith("uri")):
            urls[key_str] = url
            continue

        # Accept common mesh keys even when they don't include "url" in the key name.
        normalized = key_str.strip().lower()
        if normalized in {
            "mesh",
            "collider_mesh",
            "textured_mesh",
            "obj",
            "fbx",
            "stl",
            "ply",
            "glb",
            "gltf",
            "usd",
            "usdz",
        }:
            urls[key_str] = url

    return urls


def _headers() -> dict:
    return {
        "WLT-Api-Key": settings.worldlabs_api_key,
        "Content-Type": "application/json",
    }


async def upload_image(image_bytes: bytes, filename: str) -> str:
    """Upload a local image to World Labs. Returns the media_asset_id."""
    extension = filename.rsplit(".", 1)[-1].lower()

    async with httpx.AsyncClient(timeout=30.0) as client:
        prep_resp = await client.post(
            "%s/marble/v1/media-assets:prepare_upload" % BASE_URL,
            headers=_headers(),
            json={
                "file_name": filename,
                "kind": "image",
                "extension": extension,
            },
        )
        prep_resp.raise_for_status()
        prep_data = prep_resp.json()

        media_asset = prep_data.get("media_asset", {}) or {}
        media_asset_id = media_asset.get("id") or media_asset.get("media_asset_id")
        if not media_asset_id:
            raise WorldLabsError(
                "prepare_upload response missing media asset id: %s" % prep_data
            )
        upload_url = prep_data["upload_info"]["upload_url"]
        upload_headers = prep_data["upload_info"].get("required_headers", {})

        upload_resp = await client.put(
            upload_url,
            headers=upload_headers,
            content=image_bytes,
        )
        upload_resp.raise_for_status()

    logger.info("Uploaded image %s -> media_asset %s", filename, media_asset_id)
    return media_asset_id


async def upload_image_from_url(image_url: str, filename: str) -> str:
    """Download an image from a URL and upload it to World Labs."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(image_url)
        resp.raise_for_status()
        return await upload_image(resp.content, filename)


async def generate_world_from_text(
    display_name: str,
    text_prompt: str,
    model: str = "Marble 0.1-plus",
) -> str:
    """Start generation from text only. Returns operation_id."""
    payload = {
        "display_name": display_name,
        "model": model,
        "world_prompt": {
            "type": "text",
            "text_prompt": text_prompt,
        },
    }
    return await _start_generation(payload)


async def generate_world_from_image(
    display_name: str,
    media_asset_id: str,
    text_prompt: Optional[str] = None,
    model: str = "Marble 0.1-plus",
) -> str:
    """Start generation from a single image. Returns operation_id."""
    payload = {
        "display_name": display_name,
        "model": model,
        "world_prompt": {
            "type": "image",
            "image_prompt": {
                "source": "media_asset",
                "media_asset_id": media_asset_id,
            },
        },
    }
    if text_prompt:
        payload["world_prompt"]["text_prompt"] = text_prompt
    return await _start_generation(payload)


async def generate_world_from_multi_image(
    display_name: str,
    images: List[dict],
    text_prompt: Optional[str] = None,
    model: str = "Marble 0.1-plus",
) -> str:
    """Start generation from multiple images. Returns operation_id."""
    payload = {
        "display_name": display_name,
        "model": model,
        "world_prompt": {
            "type": "multi-image",
            "multi_image_prompt": [
                {
                    "azimuth": img["azimuth"],
                    "content": {
                        "source": "media_asset",
                        "media_asset_id": img["media_asset_id"],
                    },
                }
                for img in images
            ],
        },
    }
    if text_prompt:
        payload["world_prompt"]["text_prompt"] = text_prompt
    return await _start_generation(payload)


async def poll_operation(operation_id: str, model: Optional[str] = None) -> WorldAssets:
    """Polls until the operation completes. Returns extracted assets."""
    poll_interval = max(3, int(settings.worldlabs_poll_interval_seconds))
    max_attempts = max(1, int(settings.worldlabs_max_poll_attempts))
    if model and "mini" in model.lower():
        max_attempts = max(1, int(settings.worldlabs_max_poll_attempts_mini))

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(max_attempts):
            resp = await client.get(
                "%s/marble/v1/operations/%s" % (BASE_URL, operation_id),
                headers={"WLT-Api-Key": settings.worldlabs_api_key},
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("error"):
                raise WorldLabsError("Generation failed: %s" % data["error"])

            if data["done"]:
                return _extract_assets(data["response"])

            progress = data.get("metadata", {}).get("progress", {})
            logger.info(
                "World Labs poll %d/%d: %s - %s",
                attempt + 1, max_attempts,
                progress.get("status", "UNKNOWN"),
                progress.get("description", ""),
            )

            await asyncio.sleep(poll_interval)

    raise WorldLabsError(
        "Operation %s timed out after %ds" % (
            operation_id, max_attempts * poll_interval
        )
    )


async def get_world(world_id: str) -> dict:
    """Fetch the latest state of a world."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            "%s/marble/v1/worlds/%s" % (BASE_URL, world_id),
            headers={"WLT-Api-Key": settings.worldlabs_api_key},
        )
        resp.raise_for_status()
        raw = resp.json()
        world = _normalize_world_payload(raw, fallback_world_id=world_id)
        if not world.get("id"):
            world["id"] = world_id
        return world


async def get_operation(operation_id: str) -> dict:
    """Fetch raw operation payload from World Labs."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            "%s/marble/v1/operations/%s" % (BASE_URL, operation_id),
            headers={"WLT-Api-Key": settings.worldlabs_api_key},
        )
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, dict):
            raise WorldLabsError("Unexpected operation response type: %s" % type(data).__name__)
        return data


async def _start_generation(payload: dict) -> str:
    """POST to worlds:generate. Returns operation_id."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "%s/marble/v1/worlds:generate" % BASE_URL,
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        logger.info("World Labs generation started: operation_id=%s", data["operation_id"])
        return data["operation_id"]


def _extract_assets(response: dict) -> WorldAssets:
    """Pull asset URLs from the completed operation response."""
    world_id = response.get("id") or response.get("world_id")
    if not world_id:
        raise WorldLabsError("Operation response missing world identifier: %s" % response)

    assets = response.get("assets") or response.get("world_assets") or {}
    if not isinstance(assets, dict):
        assets = {}

    splats_root = assets.get("splats") or response.get("splats") or {}
    if not isinstance(splats_root, dict):
        splats_root = {}
    splats = splats_root.get("spz_urls") or splats_root.get("urls") or {}
    if not isinstance(splats, dict):
        splats = {}

    splat_100k = _coerce_url(splats.get("100k")) or _coerce_url(splats_root.get("100k"))
    splat_500k = _coerce_url(splats.get("500k")) or _coerce_url(splats_root.get("500k"))
    splat_full = (
        _coerce_url(splats.get("full_res"))
        or _coerce_url(splats.get("full"))
        or _coerce_url(splats_root.get("full_res"))
        or _coerce_url(splats_root.get("full"))
        or _coerce_url(splats_root.get("url"))
        or _coerce_url(assets.get("splat_url"))
    )
    mesh_urls: Dict[str, Optional[str]] = {}

    def merge_mesh_urls(candidate, prefix: str = "mesh"):
        if isinstance(candidate, dict):
            extracted = _extract_mesh_urls(candidate)
            for key, url in extracted.items():
                if url and key not in mesh_urls:
                    mesh_urls[key] = url
        elif isinstance(candidate, list):
            for idx, item in enumerate(candidate):
                item_prefix = "%s_%d" % (prefix, idx)
                if isinstance(item, dict):
                    extracted = _extract_mesh_urls(item)
                    for key, url in extracted.items():
                        final_key = key if key not in mesh_urls else "%s_%s" % (item_prefix, key)
                        if url and final_key not in mesh_urls:
                            mesh_urls[final_key] = url

    merge_mesh_urls(assets.get("mesh"), "mesh")
    merge_mesh_urls(assets.get("meshes"), "meshes")
    merge_mesh_urls(assets.get("model"), "model")
    merge_mesh_urls(assets.get("geometry"), "geometry")
    merge_mesh_urls(assets.get("files"), "files")
    merge_mesh_urls(response.get("mesh"), "response_mesh")
    merge_mesh_urls(response.get("meshes"), "response_meshes")
    merge_mesh_urls(response.get("model"), "response_model")
    merge_mesh_urls(response.get("geometry"), "response_geometry")
    merge_mesh_urls(response.get("files"), "response_files")

    imagery = assets.get("imagery", {}) or response.get("imagery", {})
    if not isinstance(imagery, dict):
        imagery = {}
    marble_url = _coerce_url(response.get("world_marble_url")) or (
        "https://marble.worldlabs.ai/world/%s" % world_id
    )

    collider_from_mesh = None
    for key, value in mesh_urls.items():
        if not value:
            continue
        key_norm = str(key).lower().replace("-", "_")
        if "collider" in key_norm and "mesh" in key_norm:
            collider_from_mesh = value
            break

    logger.info(
        "World assets extracted for %s: splat_500k=%s splat_100k=%s splat_full=%s",
        world_id,
        bool(splat_500k),
        bool(splat_100k),
        bool(splat_full),
    )

    pano_url = (
        _coerce_url(imagery.get("pano_url"))
        or _coerce_url(imagery.get("panoUrl"))
        or _coerce_url(imagery.get("panorama_url"))
        or _coerce_url(imagery.get("panoramaUrl"))
        or _coerce_url(imagery.get("pano"))
        or _coerce_url(imagery.get("panorama"))
        or _coerce_url(assets.get("pano_url"))
        or _coerce_url(response.get("pano_url"))
        or _coerce_url(response.get("panorama_url"))
        or extract_pano_url_from_payload(response)
    )

    return WorldAssets(
        world_id=world_id,
        marble_url=marble_url,
        thumbnail_url=_coerce_url(assets.get("thumbnail_url")) or _coerce_url(response.get("thumbnail_url")),
        splat_urls={
            "100k": splat_100k,
            "500k": splat_500k,
            "full_res": splat_full,
        },
        collider_mesh_url=(
            _coerce_url(assets.get("collider_mesh_url"))
            or mesh_urls.get("collider_mesh_url")
            or mesh_urls.get("collider_mesh")
            or collider_from_mesh
        ),
        mesh_urls=mesh_urls,
        pano_url=pano_url,
        caption=assets.get("caption") or response.get("caption"),
    )
