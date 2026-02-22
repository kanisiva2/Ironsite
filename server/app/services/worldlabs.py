import asyncio
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.worldlabs.ai"


@dataclass
class WorldAssets:
    world_id: str
    marble_url: str
    thumbnail_url: Optional[str]
    splat_urls: Dict[str, Optional[str]]
    collider_mesh_url: Optional[str]
    pano_url: Optional[str]
    caption: Optional[str]


class WorldLabsError(Exception):
    pass


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
        return resp.json()["world"]


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

    assets = response.get("assets", {}) or {}
    splats_root = assets.get("splats", {}) or {}
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
    mesh = assets.get("mesh", {})
    imagery = assets.get("imagery", {})
    marble_url = _coerce_url(response.get("world_marble_url")) or (
        "https://marble.worldlabs.ai/world/%s" % world_id
    )

    logger.info(
        "World assets extracted for %s: splat_500k=%s splat_100k=%s splat_full=%s",
        world_id,
        bool(splat_500k),
        bool(splat_100k),
        bool(splat_full),
    )

    return WorldAssets(
        world_id=world_id,
        marble_url=marble_url,
        thumbnail_url=_coerce_url(assets.get("thumbnail_url")),
        splat_urls={
            "100k": splat_100k,
            "500k": splat_500k,
            "full_res": splat_full,
        },
        collider_mesh_url=_coerce_url(mesh.get("collider_mesh_url")),
        pano_url=_coerce_url(imagery.get("pano_url")),
        caption=assets.get("caption"),
    )
