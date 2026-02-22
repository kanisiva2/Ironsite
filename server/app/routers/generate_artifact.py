import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.generation import GenerateArtifactRequest
from app.services import firestore as fs
from app.services.gemini import generate_artifact_content
from app.services.pdf_generator import messages_to_text_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generation"])


async def _run_artifact_generation(job_id, project_id, room_id):
    """Background task: compile conversation + images -> artifact markdown."""
    try:
        fs.update_generation_job(job_id, {"status": "processing"})

        messages = fs.get_messages(project_id, room_id)
        room = fs.get_room(project_id, room_id)

        conversation_summary = messages_to_text_summary(messages)

        approved_urls = room.get("approved2dImageUrls", [])
        image_descriptions = "\n".join(
            "- Approved image %d: %s" % (i + 1, url)
            for i, url in enumerate(approved_urls)
        ) or "No approved images."

        artifact_md = await generate_artifact_content(
            conversation_summary, image_descriptions
        )

        fs.update_room(project_id, room_id, {
            "artifactUrl": "artifact://%s" % job_id,
            "artifactContent": artifact_md,
            "status": "generating_3d",
        })

        fs.update_generation_job(job_id, {
            "status": "completed",
            "output.resultUrls": ["artifact://%s" % job_id],
        })

        fs.add_message(
            project_id, room_id,
            role="assistant",
            content="Technical artifact has been generated! You can download it from the workspace panel.",
            metadata={"type": "artifact", "generationId": job_id},
        )

        logger.info("Artifact generation job %s completed", job_id)

    except Exception as e:
        logger.error("Artifact generation job %s failed: %s", job_id, e)
        fs.update_generation_job(job_id, {
            "status": "failed",
            "output.error": str(e),
        })


@router.post("/artifact")
async def generate_artifact(body: GenerateArtifactRequest,
                              background_tasks: BackgroundTasks,
                              uid: str = Depends(get_current_user)):
    project = fs.get_project(body.projectId)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    room = fs.get_room(body.projectId, body.roomId)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    approved = room.get("approved2dImageUrls", [])
    if not approved:
        raise HTTPException(
            status_code=400,
            detail="Approve at least one 2D image before generating an artifact",
        )

    job = fs.create_generation_job(
        room_id=body.roomId,
        project_id=body.projectId,
        user_id=uid,
        job_type="artifact",
        prompt="Generate technical artifact from conversation",
    )

    background_tasks.add_task(
        _run_artifact_generation, job["id"], body.projectId, body.roomId
    )

    return {"jobId": job["id"], "status": "pending"}
