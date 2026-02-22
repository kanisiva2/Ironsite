import base64
import json
import logging
from typing import Any, Optional, List
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from firebase_admin import storage

from app.config import settings
from app.dependencies import get_current_user
from app.models.generation import (
    GenerateZoningReportRequest,
    GenerateProjectZoningReportRequest,
    GenerateProjectTechnicalInfoReportRequest,
)
from app.services import firestore as fs
from app.services.gemini import (
    extract_site_constraints_from_conversation,
    extract_technical_doc_inputs_from_conversation,
)
from app.services.pdf_generator import (
    generate_zoning_report_pdf,
    generate_technical_info_report_pdf,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generation"])


def _to_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _site_defaults() -> dict:
    return {
        "address": "",
        "parcelId": "",
        "zoningDistrict": "",
        "lotAreaSqFt": None,
        "maxHeightFt": None,
        "maxLotCoveragePct": None,
        "setbacksFt": {"front": None, "rear": None, "left": None, "right": None},
        "proposed": {
            "footprintAreaSqFt": None,
            "heightFt": None,
            "setbacksFt": {"front": None, "rear": None, "left": None, "right": None},
        },
    }


def _normalize_site(raw: Optional[dict]) -> dict:
    data = _site_defaults()
    raw = raw or {}

    data["address"] = str(raw.get("address") or "").strip()
    data["parcelId"] = str(raw.get("parcelId") or "").strip()
    data["zoningDistrict"] = str(raw.get("zoningDistrict") or "").strip()
    data["lotAreaSqFt"] = _to_float(raw.get("lotAreaSqFt"))
    data["maxHeightFt"] = _to_float(raw.get("maxHeightFt"))
    data["maxLotCoveragePct"] = _to_float(raw.get("maxLotCoveragePct"))

    raw_setbacks = raw.get("setbacksFt") or {}
    for side in ("front", "rear", "left", "right"):
        data["setbacksFt"][side] = _to_float(raw_setbacks.get(side))

    raw_proposed = raw.get("proposed") or {}
    data["proposed"]["footprintAreaSqFt"] = _to_float(raw_proposed.get("footprintAreaSqFt"))
    data["proposed"]["heightFt"] = _to_float(raw_proposed.get("heightFt"))
    raw_proposed_setbacks = raw_proposed.get("setbacksFt") or {}
    for side in ("front", "rear", "left", "right"):
        data["proposed"]["setbacksFt"][side] = _to_float(raw_proposed_setbacks.get(side))

    return data


def _make_check(name: str, required: Optional[float], proposed: Optional[float],
                comparator: str, notes: Optional[str] = None) -> dict:
    if required is None or proposed is None:
        status = "needs_info"
    elif comparator == "min":
        status = "pass" if proposed >= required else "fail"
    else:
        status = "pass" if proposed <= required else "fail"

    check = {
        "name": name,
        "required": required,
        "proposed": proposed,
        "status": status,
    }
    if notes:
        check["notes"] = notes
    return check


def _value_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    return True


def _deep_merge_prefer_existing(existing: Any, inferred: Any):
    if isinstance(existing, dict) or isinstance(inferred, dict):
        existing = existing if isinstance(existing, dict) else {}
        inferred = inferred if isinstance(inferred, dict) else {}
        keys = set(existing.keys()) | set(inferred.keys())
        return {
            key: _deep_merge_prefer_existing(existing.get(key), inferred.get(key))
            for key in keys
        }
    return existing if _value_present(existing) else inferred


def _build_zoning_report(project: dict) -> dict:
    site = _normalize_site(project.get("site"))
    checks = []
    violations = []
    assumptions = []

    if not site["address"]:
        assumptions.append("Site address not provided; parcel-based jurisdiction validation skipped.")
    if not site["zoningDistrict"]:
        assumptions.append("Zoning district not provided; checks use user-supplied dimensional constraints only.")

    for side, label in (("front", "Front setback"), ("rear", "Rear setback"),
                        ("left", "Left setback"), ("right", "Right setback")):
        check = _make_check(
            label,
            site["setbacksFt"].get(side),
            site["proposed"]["setbacksFt"].get(side),
            comparator="min",
            notes="Proposed setback must be greater than or equal to required minimum.",
        )
        checks.append(check)

    height_check = _make_check(
        "Building height",
        site.get("maxHeightFt"),
        site["proposed"].get("heightFt"),
        comparator="max",
        notes="Proposed height must not exceed the configured jurisdictional maximum.",
    )
    checks.append(height_check)

    lot_area = site.get("lotAreaSqFt")
    footprint_area = site["proposed"].get("footprintAreaSqFt")
    max_coverage = site.get("maxLotCoveragePct")
    proposed_coverage = None
    if lot_area and lot_area > 0 and footprint_area is not None:
        proposed_coverage = round((footprint_area / lot_area) * 100.0, 2)
    elif lot_area in (None, 0) or footprint_area is None:
        assumptions.append("Lot coverage could not be fully evaluated until lot area and footprint area are provided.")

    coverage_check = _make_check(
        "Lot coverage",
        max_coverage,
        proposed_coverage,
        comparator="max",
        notes="Computed as footprintAreaSqFt / lotAreaSqFt * 100.",
    )
    if proposed_coverage is not None:
        coverage_check["formula"] = "footprintAreaSqFt / lotAreaSqFt * 100"
        coverage_check["inputs"] = {"lotAreaSqFt": lot_area, "footprintAreaSqFt": footprint_area}
    checks.append(coverage_check)

    for check in checks:
        if check["status"] != "fail":
            continue
        violations.append({
            "rule": "Zoning dimensional standard",
            "description": "%s check failed." % check["name"],
            "severity": "high" if check["name"] in ("Building height", "Lot coverage") else "medium",
        })

    statuses = {check["status"] for check in checks}
    if "fail" in statuses:
        compliance_status = "fail"
    elif "needs_info" in statuses:
        compliance_status = "needs_info"
    else:
        compliance_status = "pass"

    return {
        "complianceStatus": compliance_status,
        "assumptions": assumptions,
        "checks": checks,
        "violations": violations,
        "site": {
            "address": site.get("address"),
            "parcelId": site.get("parcelId"),
            "zoningDistrict": site.get("zoningDistrict"),
        },
    }


def _collect_project_messages(project_id: str) -> List[dict]:
    messages = []
    zoning_scope_messages = fs.get_project_chat_messages(project_id, "whole_home_zoning_report")
    for msg in zoning_scope_messages:
        msg_copy = dict(msg)
        msg_copy["_roomId"] = fs.make_project_chat_room_id("whole_home_zoning_report")
        msg_copy["_roomName"] = "Whole-Home Zoning Report"
        msg_copy["_projectChatScope"] = "whole_home_zoning_report"
        messages.append(msg_copy)

    for room in fs.get_rooms(project_id):
        room_id = room.get("id")
        if not room_id:
            continue
        room_messages = fs.get_messages(project_id, room_id)
        for msg in room_messages:
            msg_copy = dict(msg)
            msg_copy["_roomId"] = room_id
            msg_copy["_roomName"] = room.get("name")
            messages.append(msg_copy)

    messages.sort(key=lambda m: str(m.get("createdAt", "")))
    return messages


def _collect_project_chat_scope_messages(project_id: str, scope: str, label: str) -> List[dict]:
    messages = []
    for msg in fs.get_project_chat_messages(project_id, scope):
        msg_copy = dict(msg)
        msg_copy["_roomId"] = fs.make_project_chat_room_id(scope)
        msg_copy["_roomName"] = label
        msg_copy["_projectChatScope"] = scope
        messages.append(msg_copy)
    messages.sort(key=lambda m: str(m.get("createdAt", "")))
    return messages


def _summarize_report(report: dict) -> str:
    checks = report.get("checks", []) or []
    passed = sum(1 for c in checks if c.get("status") == "pass")
    failed = sum(1 for c in checks if c.get("status") == "fail")
    missing = sum(1 for c in checks if c.get("status") == "needs_info")
    return (
        "Zoning report status: {status}. Checks: {passed} pass, {failed} fail, {missing} need info."
        .format(
            status=report.get("complianceStatus", "unknown"),
            passed=passed,
            failed=failed,
            missing=missing,
        )
    )


def _build_technical_info_summary(extraction: dict) -> str:
    missing = extraction.get("missingQuestions", []) or []
    extracted_inputs = extraction.get("extractedInputs", {}) or {}
    program = extracted_inputs.get("buildingProgram", {}) if isinstance(extracted_inputs.get("buildingProgram"), dict) else {}
    systems = extracted_inputs.get("systems", []) if isinstance(extracted_inputs.get("systems"), list) else []
    constraints = extracted_inputs.get("constraints", []) if isinstance(extracted_inputs.get("constraints"), list) else []
    intent = extracted_inputs.get("projectIntent")
    return (
        "Technical info report %s. Intent: %s. Program fields captured: %d. Systems: %d. Constraints: %d. Open questions: %d."
        % (
            "ready" if not missing else "needs info",
            (str(intent)[:80] + ("..." if len(str(intent)) > 80 else "")) if intent else "not specified",
            sum(1 for v in program.values() if v not in (None, "", [])) if isinstance(program, dict) else 0,
            len(systems),
            len(constraints),
            len(missing),
        )
    )


def _build_technical_info_report_record(project: dict, messages: List[dict], extraction: dict) -> dict:
    extracted_inputs = extraction.get("extractedInputs", {}) or {}
    missing_questions = extraction.get("missingQuestions", []) or []
    notes = extraction.get("notes", []) or []

    highlights = []
    for msg in messages:
        content = str(msg.get("content") or "").strip()
        if not content:
            continue
        highlights.append({
            "role": msg.get("role"),
            "roleLabel": "User" if msg.get("role") == "user" else "Assistant",
            "content": content[:420] + ("..." if len(content) > 420 else ""),
            "createdAt": str(msg.get("createdAt") or ""),
        })
    highlights = highlights[-8:]

    user_message_count = sum(1 for m in messages if m.get("role") == "user")
    return {
        "status": "ready" if not missing_questions else "needs_info",
        "meta": {
            "projectName": project.get("name") or "Project",
            "chatScope": "whole_home_technical_info_report",
            "chatStats": {
                "messageCount": len(messages),
                "userMessageCount": user_message_count,
            },
        },
        "extractedInputs": extracted_inputs,
        "missingQuestions": missing_questions,
        "notes": notes,
        "conversationHighlights": highlights,
    }


def _upload_bytes_to_firebase(data: bytes, content_type: str, object_path: str) -> Optional[str]:
    if not settings.firebase_storage_bucket:
        return None

    token = uuid4().hex
    bucket = storage.bucket(settings.firebase_storage_bucket)
    blob = bucket.blob(object_path)
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(data, content_type=content_type)
    encoded_path = quote(object_path, safe="")
    return (
        "https://firebasestorage.googleapis.com/v0/b/%s/o/%s?alt=media&token=%s"
        % (bucket.name, encoded_path, token)
    )


async def _run_zoning_generation(job_id: str, project_id: str, room_id: Optional[str]):
    try:
        fs.update_generation_job(job_id, {"status": "processing"})

        project = fs.get_project(project_id)
        if not project:
            raise RuntimeError("Project not found during zoning generation")

        if room_id:
            messages = fs.get_messages(project_id, room_id)
        else:
            messages = _collect_project_messages(project_id)
        extraction = {
            "site": {},
            "missingQuestions": [],
            "notes": [],
            "status": "skipped",
        }
        try:
            extracted = await extract_site_constraints_from_conversation(messages)
            extraction.update(extracted)
            extraction["status"] = "completed"
        except Exception as extraction_error:
            logger.warning(
                "Zoning generation job %s extraction failed; continuing with saved site data: %s",
                job_id,
                extraction_error,
            )
            extraction["status"] = "failed"
            extraction["notes"] = extraction.get("notes", []) + [str(extraction_error)]

        saved_site = _normalize_site(project.get("site"))
        inferred_site = _normalize_site(extraction.get("site"))
        merged_site = _normalize_site(_deep_merge_prefer_existing(saved_site, inferred_site))

        project_for_report = dict(project)
        project_for_report["site"] = merged_site
        report = _build_zoning_report(project_for_report)
        if extraction.get("missingQuestions"):
            report["assumptions"] = (report.get("assumptions") or []) + [
                "Gemini identified missing inputs for follow-up. See zoning extraction metadata."
            ]

        report_json_bytes = json.dumps(report, indent=2).encode("utf-8")
        report_pdf_bytes = generate_zoning_report_pdf(report, project.get("name") or "Project")
        summary = _summarize_report(report)

        json_storage_path = "regulatory/zoning/%s/%s/zoning_report.json" % (project_id, job_id)
        pdf_storage_path = "regulatory/zoning/%s/%s/zoning_report.pdf" % (project_id, job_id)

        json_url = _upload_bytes_to_firebase(
            report_json_bytes, "application/json; charset=utf-8", json_storage_path
        ) or "zoning://json/%s/%s" % (project_id, job_id)
        pdf_url = _upload_bytes_to_firebase(
            report_pdf_bytes, "application/pdf", pdf_storage_path
        ) or "zoning://pdf/%s/%s" % (project_id, job_id)

        zoning_record = {
            "summary": summary,
            "status": report.get("complianceStatus"),
            "generatedByJobId": job_id,
            "generatedAt": fs.firestore.SERVER_TIMESTAMP,
            "inputAcquisition": {
                "mode": "chat_first_auto_extract",
                "extractionStatus": extraction.get("status"),
                "missingQuestions": extraction.get("missingQuestions", []),
                "notes": extraction.get("notes", []),
            },
            "reportJsonUrl": json_url,
            "reportPdfUrl": pdf_url,
            "reportJson": report,
            "reportPdfBase64": base64.b64encode(report_pdf_bytes).decode("ascii"),
            "files": [
                {"name": "zoning_report.json", "url": json_url, "contentType": "application/json"},
                {"name": "zoning_report.pdf", "url": pdf_url, "contentType": "application/pdf"},
            ],
        }

        fs.update_project(project_id, {
            "site": merged_site,
            "regulatory.zoning": zoning_record,
        })

        fs.update_generation_job(job_id, {
            "status": "completed",
            "output.resultUrls": [json_url, pdf_url],
            "output.summary": summary,
        })

        if room_id:
            fs.add_message(
                project_id,
                room_id,
                role="assistant",
                content=("Zoning compliance report generated. %s" % summary),
                metadata={"type": "zoning_report", "generationId": job_id},
            )
    except Exception as e:
        logger.error("Zoning generation job %s failed: %s", job_id, e)
        fs.update_generation_job(job_id, {
            "status": "failed",
            "output.error": str(e),
        })


async def _run_project_technical_info_generation(job_id: str, project_id: str):
    try:
        fs.update_generation_job(job_id, {"status": "processing"})

        project = fs.get_project(project_id)
        if not project:
            raise RuntimeError("Project not found during technical info generation")

        messages = _collect_project_chat_scope_messages(
            project_id,
            "whole_home_technical_info_report",
            "Whole-Home Technical Info Report",
        )
        if not messages:
            raise RuntimeError("No whole-home technical info chat messages found")

        extraction = {
            "extractedInputs": {},
            "missingQuestions": [],
            "notes": [],
            "status": "skipped",
        }
        try:
            extracted = await extract_technical_doc_inputs_from_conversation(messages)
            extraction.update(extracted)
            extraction["status"] = "completed"
        except Exception as extraction_error:
            logger.warning(
                "Technical info generation job %s extraction failed; continuing with raw chat summary: %s",
                job_id,
                extraction_error,
            )
            extraction["status"] = "failed"
            extraction["notes"] = extraction.get("notes", []) + [str(extraction_error)]

        report = _build_technical_info_report_record(project, messages, extraction)
        report_json_bytes = json.dumps(report, indent=2).encode("utf-8")
        report_pdf_bytes = generate_technical_info_report_pdf(report, project.get("name") or "Project")
        summary = _build_technical_info_summary(extraction)

        json_storage_path = "regulatory/technical_info/%s/%s/technical_info_report.json" % (project_id, job_id)
        pdf_storage_path = "regulatory/technical_info/%s/%s/technical_info_report.pdf" % (project_id, job_id)

        json_url = _upload_bytes_to_firebase(
            report_json_bytes, "application/json; charset=utf-8", json_storage_path
        ) or "technical-info://json/%s/%s" % (project_id, job_id)
        pdf_url = _upload_bytes_to_firebase(
            report_pdf_bytes, "application/pdf", pdf_storage_path
        ) or "technical-info://pdf/%s/%s" % (project_id, job_id)

        technical_record = {
            "summary": summary,
            "status": report.get("status"),
            "generatedByJobId": job_id,
            "generatedAt": fs.firestore.SERVER_TIMESTAMP,
            "inputAcquisition": {
                "mode": "chat_first_auto_extract",
                "scope": "whole_home_technical_info_report",
                "extractionStatus": extraction.get("status"),
                "missingQuestions": extraction.get("missingQuestions", []),
                "notes": extraction.get("notes", []),
            },
            "reportJsonUrl": json_url,
            "reportPdfUrl": pdf_url,
            "reportJson": report,
            "reportPdfBase64": base64.b64encode(report_pdf_bytes).decode("ascii"),
            "files": [
                {"name": "technical_info_report.json", "url": json_url, "contentType": "application/json"},
                {"name": "technical_info_report.pdf", "url": pdf_url, "contentType": "application/pdf"},
            ],
        }

        fs.update_project(project_id, {
            "regulatory.technicalInfo": technical_record,
        })

        fs.update_generation_job(job_id, {
            "status": "completed",
            "output.resultUrls": [json_url, pdf_url],
            "output.summary": summary,
        })

        fs.add_project_chat_message(
            project_id,
            "whole_home_technical_info_report",
            role="assistant",
            content=(
                "Whole-home technical info PDF generated. "
                "I summarized the current technical constraints, systems, program, and open questions."
            ),
            metadata={"type": "technical_info_report", "generationId": job_id},
        )
    except Exception as e:
        logger.error("Technical info generation job %s failed: %s", job_id, e)
        fs.update_generation_job(job_id, {
            "status": "failed",
            "output.error": str(e),
        })


@router.post("/zoning")
async def generate_zoning_report(body: GenerateZoningReportRequest,
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
        job_type="zoning_report",
        prompt="Generate zoning compliance report",
    )

    background_tasks.add_task(
        _run_zoning_generation,
        job["id"],
        body.projectId,
        body.roomId,
    )
    return {"jobId": job["id"], "status": "pending"}


@router.post("/zoning/preflight")
async def preflight_zoning_report(body: GenerateZoningReportRequest,
                                  uid: str = Depends(get_current_user)):
    project = fs.get_project(body.projectId)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    room = fs.get_room(body.projectId, body.roomId)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    messages = fs.get_messages(body.projectId, body.roomId)
    extraction = await extract_site_constraints_from_conversation(messages)

    saved_site = _normalize_site(project.get("site"))
    inferred_site = _normalize_site(extraction.get("site"))
    merged_site = _normalize_site(_deep_merge_prefer_existing(saved_site, inferred_site))

    project_for_report = dict(project)
    project_for_report["site"] = merged_site
    report_preview = _build_zoning_report(project_for_report)

    return {
        "preflight": {
            "mode": "chat_first_auto_extract",
            "missingQuestions": extraction.get("missingQuestions", []),
            "notes": extraction.get("notes", []),
            "extractedSite": inferred_site,
            "effectiveSite": merged_site,
            "predictedComplianceStatus": report_preview.get("complianceStatus"),
            "checks": report_preview.get("checks", []),
        }
    }


@router.post("/project-zoning")
async def generate_project_zoning_report(body: GenerateProjectZoningReportRequest,
                                         background_tasks: BackgroundTasks,
                                         uid: str = Depends(get_current_user)):
    project = fs.get_project(body.projectId)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    rooms = fs.get_rooms(body.projectId)
    if not rooms:
        raise HTTPException(status_code=400, detail="Add at least one room before generating a zoning report")

    job = fs.create_generation_job(
        room_id=None,
        project_id=body.projectId,
        user_id=uid,
        job_type="zoning_report",
        prompt="Generate project-level zoning compliance report",
    )

    background_tasks.add_task(_run_zoning_generation, job["id"], body.projectId, None)
    return {"jobId": job["id"], "status": "pending"}


@router.post("/project-zoning/preflight")
async def preflight_project_zoning_report(body: GenerateProjectZoningReportRequest,
                                          uid: str = Depends(get_current_user)):
    project = fs.get_project(body.projectId)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    rooms = fs.get_rooms(body.projectId)
    if not rooms:
        raise HTTPException(status_code=400, detail="Add at least one room before checking report requirements")

    messages = _collect_project_messages(body.projectId)
    extraction = await extract_site_constraints_from_conversation(messages)

    saved_site = _normalize_site(project.get("site"))
    inferred_site = _normalize_site(extraction.get("site"))
    merged_site = _normalize_site(_deep_merge_prefer_existing(saved_site, inferred_site))

    project_for_report = dict(project)
    project_for_report["site"] = merged_site
    report_preview = _build_zoning_report(project_for_report)

    return {
        "preflight": {
            "mode": "chat_first_auto_extract",
            "scope": "project",
            "missingQuestions": extraction.get("missingQuestions", []),
            "notes": extraction.get("notes", []),
            "extractedSite": inferred_site,
            "effectiveSite": merged_site,
            "predictedComplianceStatus": report_preview.get("complianceStatus"),
            "checks": report_preview.get("checks", []),
        }
    }


@router.post("/project-technical-info/preflight")
async def preflight_project_technical_info_report(body: GenerateProjectTechnicalInfoReportRequest,
                                                  uid: str = Depends(get_current_user)):
    project = fs.get_project(body.projectId)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    messages = _collect_project_chat_scope_messages(
        body.projectId,
        "whole_home_technical_info_report",
        "Whole-Home Technical Info Report",
    )
    if not messages:
        raise HTTPException(
            status_code=400,
            detail="Add information in the Whole-Home Technical Info chat before checking what's missing",
        )

    extraction = await extract_technical_doc_inputs_from_conversation(messages)
    missing_questions = extraction.get("missingQuestions", []) or []
    extracted_inputs = extraction.get("extractedInputs", {}) or {}
    program = extracted_inputs.get("buildingProgram", {}) if isinstance(extracted_inputs.get("buildingProgram"), dict) else {}
    captured_program_fields = sum(1 for v in program.values() if v not in (None, "", [])) if isinstance(program, dict) else 0

    return {
        "preflight": {
            "mode": "chat_first_auto_extract",
            "scope": "whole_home_technical_info_report",
            "predictedStatus": "ready" if not missing_questions else "needs_info",
            "missingQuestions": missing_questions,
            "notes": extraction.get("notes", []),
            "extractedInputs": extracted_inputs,
            "summary": _build_technical_info_summary(extraction),
            "chatStats": {
                "messageCount": len(messages),
                "userMessageCount": sum(1 for m in messages if m.get("role") == "user"),
            },
            "capturedProgramFields": captured_program_fields,
        }
    }


@router.post("/project-technical-info")
async def generate_project_technical_info_report(body: GenerateProjectTechnicalInfoReportRequest,
                                                 background_tasks: BackgroundTasks,
                                                 uid: str = Depends(get_current_user)):
    project = fs.get_project(body.projectId)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    technical_messages = fs.get_project_chat_messages(body.projectId, "whole_home_technical_info_report")
    if not technical_messages:
        raise HTTPException(
            status_code=400,
            detail="Add information in the Whole-Home Technical Info chat before creating a PDF",
        )

    job = fs.create_generation_job(
        room_id=None,
        project_id=body.projectId,
        user_id=uid,
        job_type="technical_info_report",
        prompt="Generate project-level technical information report",
    )

    background_tasks.add_task(_run_project_technical_info_generation, job["id"], body.projectId)
    return {"jobId": job["id"], "status": "pending"}
