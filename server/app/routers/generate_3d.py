import io
import json
import logging
import re
import zipfile
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import Response

from app.dependencies import get_current_user
from app.models.generation import Generate3DRequest
from app.services import firestore as fs
from app.services import worldlabs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generation"])


def _collect_most_recent_design_image(messages):
    """Return the single most recent Nano Banana-generated image URL."""
    for msg in reversed(messages):
        metadata = msg.get("metadata", {}) or {}
        if metadata.get("type") != "image_generation":
            continue

        urls = msg.get("imageUrls", []) or []
        for url in reversed(urls):
            if url:
                return url
    return None


def _room_instruction(room: dict) -> str:
    room_type = (room.get("roomType") or room.get("name") or "room").replace("_", " ")
    return "Generate a realistic %s interior based on these design images." % room_type


def _resolve_export(world_labs_data: dict):
    if not isinstance(world_labs_data, dict):
        return None
    mesh_urls = dict(world_labs_data.get("meshUrls") or {})
    if world_labs_data.get("exportUrl"):
        mesh_urls["export_url"] = world_labs_data.get("exportUrl")
    return worldlabs.pick_blender_export(
        world_labs_data.get("colliderMeshUrl"),
        mesh_urls,
        world_labs_data.get("splatUrls"),
    )


def _safe_slug(value: str, fallback: str = "room") -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or fallback


def _guess_extension(url: str, fallback: str) -> str:
    try:
        path = unquote(urlparse(url).path or "")
    except Exception:
        path = url or ""

    ext = ""
    if "." in path:
        ext = path.rsplit(".", 1)[-1].lower()
        ext = re.split(r"[^a-z0-9]+", ext)[0]

    if not ext:
        lowered = (url or "").lower()
        for candidate in ("glb", "gltf", "fbx", "obj", "stl", "ply", "spz", "jpg", "jpeg", "png", "webp"):
            if re.search(r"(^|[^a-z0-9])%s($|[^a-z0-9])" % re.escape(candidate), lowered):
                ext = candidate
                break

    if not ext:
        ext = fallback
    return ext


def _add_bundle_entry(entries: list, seen: set, path: str, url: str, url_only: bool = False):
    if not url:
        return
    normalized = str(url).strip()
    if not normalized:
        return
    key = "%s|%s" % (path, normalized)
    if key in seen:
        return
    seen.add(key)
    entries.append({"path": path, "url": normalized, "urlOnly": bool(url_only)})


def _build_bundle_entries(world_labs_data: dict, export: Optional[dict]) -> list:
    entries = []
    seen = set()

    # Reverted behavior: bundle only SPZ splat variants + panorama image.
    splat_urls = world_labs_data.get("splatUrls", {}) or {}
    for key in ("100k", "500k", "full_res"):
        url = splat_urls.get(key)
        if url:
            _add_bundle_entry(
                entries,
                seen,
                "splats/splat_%s.%s" % (key, _guess_extension(url, "spz")),
                url,
            )
    for key, url in splat_urls.items():
        if key in {"100k", "500k", "full_res"}:
            continue
        if url:
            safe_key = _safe_slug(str(key), "variant")
            _add_bundle_entry(
                entries,
                seen,
                "splats/splat_%s.%s" % (safe_key, _guess_extension(url, "spz")),
                url,
            )

    pano_url = world_labs_data.get("panoUrl")
    if pano_url:
        _add_bundle_entry(
            entries,
            seen,
            "imagery/panorama.%s" % _guess_extension(pano_url, "jpg"),
            pano_url,
        )

    return entries


async def _resolve_export_with_refresh(project_id: str, room_id: str, world_labs_data: dict):
    export = _resolve_export(world_labs_data)
    refreshed_world_labs = dict(world_labs_data or {})
    updates = {}
    collider_url = refreshed_world_labs.get("colliderMeshUrl")
    pano_url = refreshed_world_labs.get("panoUrl")

    if not export:
        world_id = refreshed_world_labs.get("worldId")
        if world_id:
            try:
                world = await worldlabs.get_world(world_id)
                collider_from_world = worldlabs.extract_collider_mesh_url_from_payload(world)
                if collider_from_world:
                    collider_url = collider_from_world
                    updates["worldLabs.colliderMeshUrl"] = collider_from_world
                    refreshed_world_labs["colliderMeshUrl"] = collider_from_world

                pano_from_world = worldlabs.extract_pano_url_from_payload(world)
                if pano_from_world:
                    pano_url = pano_from_world
                    updates["worldLabs.panoUrl"] = pano_from_world
                    refreshed_world_labs["panoUrl"] = pano_from_world

                mesh_data = worldlabs.extract_mesh_data_from_world(world)
                mesh_collider = mesh_data.get("colliderMeshUrl")
                mesh_urls = mesh_data.get("meshUrls")
                if mesh_collider:
                    updates["worldLabs.colliderMeshUrl"] = mesh_collider
                    refreshed_world_labs["colliderMeshUrl"] = mesh_collider
                    collider_url = mesh_collider
                if mesh_urls is not None:
                    updates["worldLabs.meshUrls"] = mesh_urls
                    refreshed_world_labs["meshUrls"] = mesh_urls
                export = _resolve_export(refreshed_world_labs)
                if not export:
                    export = worldlabs.pick_blender_export_from_payload(world)
            except worldlabs.WorldLabsError as e:
                logger.warning(
                    "Could not refresh world export assets for room=%s world=%s: %s",
                    room_id,
                    world_id,
                    e,
                )

    if not export:
        operation_id = refreshed_world_labs.get("operationId")
        if operation_id:
            try:
                operation_payload = await worldlabs.get_operation(operation_id)
                collider_from_operation = worldlabs.extract_collider_mesh_url_from_payload(operation_payload)
                if collider_from_operation:
                    collider_url = collider_from_operation
                    updates["worldLabs.colliderMeshUrl"] = collider_from_operation
                    refreshed_world_labs["colliderMeshUrl"] = collider_from_operation

                pano_from_operation = worldlabs.extract_pano_url_from_payload(operation_payload)
                if pano_from_operation:
                    pano_url = pano_from_operation
                    updates["worldLabs.panoUrl"] = pano_from_operation
                    refreshed_world_labs["panoUrl"] = pano_from_operation

                export = worldlabs.pick_blender_export_from_payload(operation_payload)

                operation_response = operation_payload.get("response")
                if isinstance(operation_response, dict):
                    collider_from_operation_response = (
                        worldlabs.extract_collider_mesh_url_from_payload(operation_response)
                    )
                    if collider_from_operation_response:
                        collider_url = collider_from_operation_response
                        updates["worldLabs.colliderMeshUrl"] = collider_from_operation_response
                        refreshed_world_labs["colliderMeshUrl"] = collider_from_operation_response

                    pano_from_operation_response = worldlabs.extract_pano_url_from_payload(
                        operation_response
                    )
                    if pano_from_operation_response:
                        pano_url = pano_from_operation_response
                        updates["worldLabs.panoUrl"] = pano_from_operation_response
                        refreshed_world_labs["panoUrl"] = pano_from_operation_response

                    mesh_data = worldlabs.extract_mesh_data_from_world(operation_response)
                    mesh_collider = mesh_data.get("colliderMeshUrl")
                    mesh_urls = mesh_data.get("meshUrls")
                    if mesh_collider:
                        updates["worldLabs.colliderMeshUrl"] = mesh_collider
                        refreshed_world_labs["colliderMeshUrl"] = mesh_collider
                        collider_url = mesh_collider
                    if mesh_urls is not None:
                        updates["worldLabs.meshUrls"] = mesh_urls
                        refreshed_world_labs["meshUrls"] = mesh_urls
                    if not export:
                        export = _resolve_export(refreshed_world_labs)
                    if not export:
                        export = worldlabs.pick_blender_export_from_payload(operation_response)
            except worldlabs.WorldLabsError as e:
                logger.warning(
                    "Could not refresh operation export assets for room=%s operation=%s: %s",
                    room_id,
                    operation_id,
                    e,
                )

    # Last-resort: if collider URL exists, convert it to an export record directly.
    if not export and collider_url:
        export = {
            "url": collider_url,
            "format": _guess_extension(collider_url, "glb").lower(),
        }

    if pano_url and not refreshed_world_labs.get("panoUrl"):
        updates["worldLabs.panoUrl"] = pano_url
        refreshed_world_labs["panoUrl"] = pano_url

    if export:
        updates["worldLabs.exportUrl"] = export["url"]
        updates["worldLabs.exportFormat"] = export["format"]
        refreshed_world_labs["exportUrl"] = export["url"]
        refreshed_world_labs["exportFormat"] = export["format"]

    if updates:
        fs.update_room(project_id, room_id, updates)

    return export, refreshed_world_labs


async def _run_3d_generation(job_id, project_id, room_id, model):
    """
    Background task: upload images to World Labs, start generation,
    poll until complete, update room with assets.
    """
    try:
        fs.update_generation_job(job_id, {"status": "processing"})

        room = fs.get_room(project_id, room_id)
        messages = fs.get_messages(project_id, room_id)
        selected_url = _collect_most_recent_design_image(messages)
        if selected_url:
            logger.info(
                "3D generation using most recent Nano Banana image"
            )
        else:
            logger.info("No Nano Banana images found; falling back to text-only 3D generation")

        text_prompt = _room_instruction(room)
        logger.info("3D generation text instruction: %s", text_prompt)

        project = fs.get_project(project_id)
        display_name = "%s - %s" % (
            room.get("name", "Room"), project.get("name", "Project")
        )

        if not selected_url:
            operation_id = await worldlabs.generate_world_from_text(
                display_name=display_name,
                text_prompt=text_prompt,
                model=model,
            )
        else:
            media_id = await worldlabs.upload_image_from_url(
                selected_url, "room_%s_latest.jpg" % room_id
            )
            operation_id = await worldlabs.generate_world_from_image(
                display_name=display_name,
                media_asset_id=media_id,
                text_prompt=text_prompt,
                model=model,
            )

        fs.update_generation_job(job_id, {
            "externalIds.worldLabsOperationId": operation_id,
        })

        assets = await worldlabs.poll_operation(operation_id, model=model)

        # Prevent stale jobs from overwriting a newer 3D generation.
        latest_room = fs.get_room(project_id, room_id) or {}
        latest_job_id = latest_room.get("latest3dJobId")
        if latest_job_id and latest_job_id != job_id:
            logger.info(
                "Skipping room worldLabs update for stale job %s; latest is %s",
                job_id,
                latest_job_id,
            )
            fs.update_generation_job(job_id, {
                "status": "completed",
                "externalIds.worldLabsWorldId": assets.world_id,
                "output.resultUrls": [assets.marble_url],
            })
            return

        world_labs_data = {
            "worldLabs.worldId": assets.world_id,
            "worldLabs.marbleUrl": assets.marble_url,
            "worldLabs.thumbnailUrl": assets.thumbnail_url,
            "worldLabs.splatUrls": assets.splat_urls,
            "worldLabs.colliderMeshUrl": assets.collider_mesh_url,
            "worldLabs.meshUrls": assets.mesh_urls,
            "worldLabs.panoUrl": assets.pano_url,
            "worldLabs.caption": assets.caption,
            "worldLabs.operationId": operation_id,
            "latest3dJobId": job_id,
            "status": "complete",
        }
        export = worldlabs.pick_blender_export(
            assets.collider_mesh_url,
            assets.mesh_urls,
            assets.splat_urls,
        )
        if export:
            world_labs_data["worldLabs.exportUrl"] = export["url"]
            world_labs_data["worldLabs.exportFormat"] = export["format"]

        fs.update_room(project_id, room_id, world_labs_data)
        logger.info(
            "Saved room worldLabs data (room=%s): marble=%s splat500k=%s splat100k=%s splatFull=%s",
            room_id,
            bool(assets.marble_url),
            bool(assets.splat_urls.get("500k")),
            bool(assets.splat_urls.get("100k")),
            bool(assets.splat_urls.get("full_res")),
        )

        fs.update_generation_job(job_id, {
            "status": "completed",
            "externalIds.worldLabsWorldId": assets.world_id,
            "output.resultUrls": [assets.marble_url],
        })

        fs.add_message(
            project_id, room_id,
            role="assistant",
            content="Your requested room was generated in 3D.",
            metadata={"type": "3d_generation", "generationId": job_id},
        )

        logger.info("3D generation job %s completed: world=%s", job_id, assets.world_id)

    except worldlabs.WorldLabsError as e:
        logger.error("3D generation job %s failed (World Labs): %s", job_id, e)
        fs.update_generation_job(job_id, {
            "status": "failed",
            "output.error": str(e),
        })
    except Exception as e:
        logger.error("3D generation job %s failed: %s", job_id, e)
        fs.update_generation_job(job_id, {
            "status": "failed",
            "output.error": str(e),
        })


@router.post("/3d")
async def generate_3d(body: Generate3DRequest,
                       background_tasks: BackgroundTasks,
                       uid: str = Depends(get_current_user)):
    project = fs.get_project(body.projectId)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    room = fs.get_room(body.projectId, body.roomId)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    job = fs.create_generation_job(
        room_id=body.roomId,
        project_id=body.projectId,
        user_id=uid,
        job_type="model_3d",
        prompt="3D generation for %s" % room.get("name", "room"),
    )

    fs.update_room(
        body.projectId,
        body.roomId,
        {"status": "generating_3d", "latest3dJobId": job["id"]},
    )

    background_tasks.add_task(
        _run_3d_generation, job["id"], body.projectId, body.roomId, body.model
    )

    return {"jobId": job["id"], "status": "pending"}


@router.get("/3d/export/{project_id}/{room_id}")
async def get_blender_export(
    project_id: str,
    room_id: str,
    uid: str = Depends(get_current_user),
):
    project = fs.get_project(project_id)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    room = fs.get_room(project_id, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    world_labs_data = room.get("worldLabs", {}) or {}
    export, _ = await _resolve_export_with_refresh(project_id, room_id, world_labs_data)

    if not export:
        raise HTTPException(
            status_code=404,
            detail="No Blender-compatible export file is available for this scene",
        )

    return {
        "exportUrl": export["url"],
        "format": export["format"],
    }


@router.get("/3d/export-bundle/{project_id}/{room_id}")
async def get_blender_export_bundle(
    project_id: str,
    room_id: str,
    uid: str = Depends(get_current_user),
):
    project = fs.get_project(project_id)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    room = fs.get_room(project_id, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    world_labs_data = room.get("worldLabs", {}) or {}
    export, refreshed_world_labs = await _resolve_export_with_refresh(
        project_id, room_id, world_labs_data
    )

    entries = _build_bundle_entries(refreshed_world_labs, export)
    has_world_reference = bool(
        refreshed_world_labs.get("worldId")
        or refreshed_world_labs.get("operationId")
        or refreshed_world_labs.get("marbleUrl")
        or refreshed_world_labs.get("splatUrls")
        or refreshed_world_labs.get("panoUrl")
    )
    if not has_world_reference:
        raise HTTPException(
            status_code=404,
            detail="No 3D world assets are available for this room",
        )
    if not entries:
        raise HTTPException(
            status_code=404,
            detail="No splat or panorama assets were available for this scene",
        )

    bundle = io.BytesIO()
    room_slug = _safe_slug(room.get("name") or "room")
    project_slug = _safe_slug(project.get("name") or "project")
    world_id = refreshed_world_labs.get("worldId") or "world"

    manifest = {
        "projectId": project_id,
        "roomId": room_id,
        "projectName": project.get("name"),
        "roomName": room.get("name"),
        "worldId": world_id,
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "export": export or {
            "url": None,
            "format": None,
            "note": "Bundle contains available splat/panorama assets only.",
        },
        "downloadedFiles": [],
        "failedFiles": [],
    }

    async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as client:
        with zipfile.ZipFile(
            bundle,
            mode="w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=6,
        ) as zf:
            for item in entries:
                path = item["path"]
                url = item["url"]
                if item.get("urlOnly"):
                    zf.writestr(path, "%s\n" % url)
                    manifest["downloadedFiles"].append({
                        "path": path,
                        "url": url,
                        "bytes": len(url.encode("utf-8")) + 1,
                        "contentType": "text/plain",
                        "mode": "link",
                    })
                    continue
                try:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    zf.writestr(path, resp.content)
                    manifest["downloadedFiles"].append({
                        "path": path,
                        "url": url,
                        "bytes": len(resp.content),
                        "contentType": resp.headers.get("content-type"),
                    })
                except Exception as e:
                    manifest["failedFiles"].append({
                        "path": path,
                        "url": url,
                        "error": str(e),
                    })
                    # Provide a URL reference file so users can still access source links.
                    zf.writestr("%s.url.txt" % path, "%s\n" % url)

            zf.writestr("manifest.json", json.dumps(manifest, indent=2))

    bundle.seek(0)
    filename = "%s-%s-%s-assets.zip" % (project_slug, room_slug, world_id)
    headers = {
        "Content-Disposition": 'attachment; filename="%s"' % filename,
    }
    return Response(
        content=bundle.getvalue(),
        media_type="application/zip",
        headers=headers,
    )
