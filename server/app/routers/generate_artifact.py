import logging
import json
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from firebase_admin import storage

from app.config import settings
from app.dependencies import get_current_user
from app.models.generation import GenerateArtifactRequest
from app.services import firestore as fs
from app.services.gemini import (
    generate_artifact_content,
    extract_technical_doc_inputs_from_conversation,
)
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


def _format_docs_extraction_context(extraction: dict) -> str:
    extracted_inputs = extraction.get("extractedInputs", {}) or {}
    missing_questions = extraction.get("missingQuestions", []) or []
    notes = extraction.get("notes", []) or []
    payload = {
        "extractedInputs": extracted_inputs,
        "missingQuestions": missing_questions,
        "notes": notes,
    }
    return json.dumps(payload, indent=2)


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
        docs_extraction = {
            "extractedInputs": {},
            "missingQuestions": [],
            "notes": [],
            "status": "skipped",
        }
        try:
            extracted = await extract_technical_doc_inputs_from_conversation(messages)
            docs_extraction.update(extracted)
            docs_extraction["status"] = "completed"
        except Exception as extraction_error:
            logger.warning(
                "Artifact generation job %s docs extraction failed; continuing with plain chat summary: %s",
                job_id,
                extraction_error,
            )
            docs_extraction["status"] = "failed"
            docs_extraction["notes"] = docs_extraction.get("notes", []) + [str(extraction_error)]

        conversation_summary = (
            "%s\n\n## Structured Technical Documentation Inputs (Gemini Extracted)\n%s"
            % (conversation_summary, _format_docs_extraction_context(docs_extraction))
        )

        approved_urls = room.get("approved2dImageUrls", [])
        image_descriptions = "\n".join(
            "- Approved image %d: %s" % (i + 1, url)
            for i, url in enumerate(approved_urls)
        ) or "No approved images."

        artifact_md = await generate_artifact_content(
            conversation_summary, image_descriptions
        )
        artifact_url = _upload_artifact_to_firebase(artifact_md, room_id)

        missing_count = len(docs_extraction.get("missingQuestions", []) or [])
        artifact_metadata = {
            "generatedByJobId": job_id,
            "inputAcquisition": {
                "mode": "chat_first_auto_extract",
                "extractionStatus": docs_extraction.get("status"),
                "missingQuestions": docs_extraction.get("missingQuestions", []),
                "notes": docs_extraction.get("notes", []),
                "extractedInputs": docs_extraction.get("extractedInputs", {}),
            },
        }

        fs.update_room(project_id, room_id, {
            "artifactUrl": artifact_url,
            "artifactContent": artifact_md,
            "artifactMetadata": artifact_metadata,
            "status": "generating_3d",
        })

        fs.update_generation_job(job_id, {
            "status": "completed",
            "output.resultUrls": [artifact_url],
            "output.summary": (
                "Technical docs generated from chat + extracted inputs"
                + (" (%d follow-up questions still open)" % missing_count if missing_count else "")
            ),
        })

        completion_message = (
            "Technical documentation has been generated! You can download it from the workspace panel."
        )
        if missing_count:
            completion_message += (
                " Gemini still identified %d follow-up question%s for a more complete package."
                % (missing_count, "" if missing_count == 1 else "s")
            )

        fs.add_message(
            project_id, room_id,
            role="assistant",
            content=completion_message,
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


@router.post("/artifact/preflight")
async def preflight_artifact(body: GenerateArtifactRequest,
                             uid: str = Depends(get_current_user)):
    project = fs.get_project(body.projectId)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    room = fs.get_room(body.projectId, body.roomId)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    messages = fs.get_messages(body.projectId, body.roomId)
    extraction = await extract_technical_doc_inputs_from_conversation(messages)

    approved_urls = room.get("approved2dImageUrls", []) or []
    return {
        "preflight": {
            "mode": "chat_first_auto_extract",
            "approvedImageCount": len(approved_urls),
            "canGenerateTechnicalDocs": len(approved_urls) > 0,
            "missingQuestions": extraction.get("missingQuestions", []),
            "notes": extraction.get("notes", []),
            "extractedInputs": extraction.get("extractedInputs", {}),
        }
    }
