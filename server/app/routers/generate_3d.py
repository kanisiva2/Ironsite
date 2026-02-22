import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.generation import Generate3DRequest
from app.services import firestore as fs
from app.services import worldlabs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generation"])


def _collect_recent_design_images(messages, max_images: int = 4):
    """
    Pull the most recent Nano Banana-generated design image URLs from chat history.
    """
    urls = []
    seen = set()

    for msg in reversed(messages):
        metadata = msg.get("metadata", {}) or {}
        if metadata.get("type") != "image_generation":
            continue

        for url in reversed(msg.get("imageUrls", []) or []):
            if not url or url in seen:
                continue
            seen.add(url)
            urls.append(url)
            if len(urls) >= max_images:
                # Return chronological order for stable azimuth assignment.
                return list(reversed(urls))

    return list(reversed(urls))


def _room_instruction(room: dict) -> str:
    room_type = (room.get("roomType") or room.get("name") or "room").replace("_", " ")
    return "Generate a realistic %s interior based on these design images." % room_type


def _compute_azimuths(count):
    """Evenly space azimuth angles for multi-image prompts."""
    if count == 1:
        return [0]
    if count == 2:
        return [0, 180]
    return [int(i * 360 / count) for i in range(count)]


async def _run_3d_generation(job_id, project_id, room_id, model):
    """
    Background task: upload images to World Labs, start generation,
    poll until complete, update room with assets.
    """
    try:
        fs.update_generation_job(job_id, {"status": "processing"})

        room = fs.get_room(project_id, room_id)
        messages = fs.get_messages(project_id, room_id)
        selected_urls = _collect_recent_design_images(messages, max_images=4)
        if selected_urls:
            logger.info(
                "3D generation using %d most recent Nano Banana images",
                len(selected_urls),
            )
        else:
            logger.info("No Nano Banana images found; falling back to text-only 3D generation")

        text_prompt = _room_instruction(room)
        logger.info("3D generation text instruction: %s", text_prompt)

        project = fs.get_project(project_id)
        display_name = "%s - %s" % (
            room.get("name", "Room"), project.get("name", "Project")
        )

        if len(selected_urls) == 0:
            operation_id = await worldlabs.generate_world_from_text(
                display_name=display_name,
                text_prompt=text_prompt,
                model=model,
            )

        elif len(selected_urls) == 1:
            media_id = await worldlabs.upload_image_from_url(
                selected_urls[0], "room_%s_0.jpg" % room_id
            )
            operation_id = await worldlabs.generate_world_from_image(
                display_name=display_name,
                media_asset_id=media_id,
                text_prompt=text_prompt,
                model=model,
            )

        else:
            azimuths = _compute_azimuths(len(selected_urls))
            images = []
            for i, url in enumerate(selected_urls):
                media_id = await worldlabs.upload_image_from_url(
                    url, "room_%s_%d.jpg" % (room_id, i)
                )
                images.append({"media_asset_id": media_id, "azimuth": azimuths[i]})

            operation_id = await worldlabs.generate_world_from_multi_image(
                display_name=display_name,
                images=images,
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
            "worldLabs.panoUrl": assets.pano_url,
            "worldLabs.caption": assets.caption,
            "worldLabs.operationId": operation_id,
            "latest3dJobId": job_id,
            "status": "complete",
        }
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
            content=(
                "Your 3D environment is ready! "
                "%s" % (assets.caption or "Explore it in the 3D viewer.")
            ),
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

    if not room.get("artifactUrl"):
        raise HTTPException(
            status_code=400,
            detail="Generate an artifact before creating a 3D model",
        )

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
