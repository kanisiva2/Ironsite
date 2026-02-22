import logging
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.generation import Generate2DRequest
from app.services import firestore as fs
from app.services import nanobanana

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generation"])


async def _run_2d_generation(job_id: str, project_id: str, room_id: str,
                              prompt: str, reference_urls: List[str]):
    """Background task: call Nano Banana, update job and room."""
    try:
        fs.update_generation_job(job_id, {"status": "processing"})

        image_url = await nanobanana.generate_image(prompt, reference_urls)

        fs.update_generation_job(job_id, {
            "status": "completed",
            "output.resultUrls": [image_url],
        })

        fs.add_message(
            project_id, room_id,
            role="assistant",
            content="Here's the generated visualization based on our discussion.",
            image_urls=[image_url],
            metadata={"type": "image_generation", "generationId": job_id},
        )

        logger.info("2D generation job %s completed", job_id)

    except Exception as e:
        logger.error("2D generation job %s failed: %s", job_id, e)
        fs.update_generation_job(job_id, {
            "status": "failed",
            "output.error": str(e),
        })


@router.post("/2d")
async def generate_2d(body: Generate2DRequest,
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
        job_type="image_2d",
        prompt=body.prompt,
        reference_image_urls=body.referenceImageUrls,
    )

    fs.update_room(body.projectId, body.roomId, {"status": "prototyping_2d"})

    background_tasks.add_task(
        _run_2d_generation,
        job["id"], body.projectId, body.roomId,
        body.prompt, body.referenceImageUrls,
    )

    return {"jobId": job["id"], "status": "pending"}


@router.get("/status/{job_id}")
async def get_job_status(job_id: str, uid: str = Depends(get_current_user)):
    job = fs.get_generation_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("userId") != uid:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"job": job}
