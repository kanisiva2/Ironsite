import asyncio
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.worldlabs.ai"
POLL_INTERVAL_SECONDS = 10
MAX_POLL_ATTEMPTS = 60  # 10 min max wait


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

        media_asset_id = prep_data["media_asset"]["id"]
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


async def poll_operation(operation_id: str) -> WorldAssets:
    """Polls until the operation completes. Returns extracted assets."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(MAX_POLL_ATTEMPTS):
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
                attempt + 1, MAX_POLL_ATTEMPTS,
                progress.get("status", "UNKNOWN"),
                progress.get("description", ""),
            )

            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    raise WorldLabsError(
        "Operation %s timed out after %ds" % (
            operation_id, MAX_POLL_ATTEMPTS * POLL_INTERVAL_SECONDS
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
    assets = response.get("assets", {})
    splats = assets.get("splats", {}).get("spz_urls", {})
    mesh = assets.get("mesh", {})
    imagery = assets.get("imagery", {})

    return WorldAssets(
        world_id=response["id"],
        marble_url=response.get("world_marble_url", ""),
        thumbnail_url=assets.get("thumbnail_url"),
        splat_urls={
            "100k": splats.get("100k"),
            "500k": splats.get("500k"),
            "full_res": splats.get("full_res"),
        },
        collider_mesh_url=mesh.get("collider_mesh_url"),
        pano_url=imagery.get("pano_url"),
        caption=assets.get("caption"),
    )
