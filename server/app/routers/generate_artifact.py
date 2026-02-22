import logging
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from firebase_admin import storage

from app.config import settings
from app.dependencies import get_current_user
from app.models.generation import GenerateArtifactRequest
from app.services import firestore as fs
from app.services.gemini import generate_artifact_content
from app.services.pdf_generator import messages_to_text_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generation"])


def _upload_artifact_to_firebase(artifact_content: str, room_id: str) -> str:
    bucket_name = settings.firebase_storage_bucket
    if not bucket_name:
        raise RuntimeError(
            "FIREBASE_STORAGE_BUCKET is not configured. "
            "Set it in server/.env so artifacts can be downloaded."
        )

    object_path = "artifacts/%s/%s.md" % (room_id, uuid4().hex)
    token = uuid4().hex

    bucket = storage.bucket(bucket_name)
    blob = bucket.blob(object_path)
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(artifact_content, content_type="text/markdown; charset=utf-8")

    encoded_path = quote(object_path, safe="")
    return (
        "https://firebasestorage.googleapis.com/v0/b/%s/o/%s?alt=media&token=%s"
        % (bucket.name, encoded_path, token)
    )


async def _run_artifact_generation(job_id, project_id, room_id):
    """Background task: compile conversation + images -> artifact markdown."""
    try:
        logger.info(
            "Artifact generation job %s started (project=%s room=%s)",
            job_id, project_id, room_id
        )
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
        artifact_url = _upload_artifact_to_firebase(artifact_md, room_id)

        fs.update_room(project_id, room_id, {
            "artifactUrl": artifact_url,
            "artifactContent": artifact_md,
            "status": "generating_3d",
        })

        fs.update_generation_job(job_id, {
            "status": "completed",
            "output.resultUrls": [artifact_url],
        })

        fs.add_message(
            project_id, room_id,
            role="assistant",
            content="Technical artifact has been generated! You can download it from the workspace panel.",
            metadata={"type": "artifact", "generationId": job_id},
        )

        logger.info(
            "Artifact generation job %s completed with download URL",
            job_id
        )

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
