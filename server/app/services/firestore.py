import logging
from datetime import datetime
from typing import Dict, List, Optional

from firebase_admin import firestore

logger = logging.getLogger(__name__)

_db = None
PROJECT_CHAT_ROOM_ID_PREFIX = "__project_chat__:"


def get_db():
    global _db
    if _db is None:
        _db = firestore.client()
    return _db


def _doc_to_dict(doc) -> Optional[dict]:
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


def make_project_chat_room_id(scope: str) -> str:
    return f"{PROJECT_CHAT_ROOM_ID_PREFIX}{scope}"


def is_project_chat_room_id(room_id: Optional[str]) -> bool:
    return bool(room_id and str(room_id).startswith(PROJECT_CHAT_ROOM_ID_PREFIX))


def get_project_chat_scope_from_room_id(room_id: str) -> Optional[str]:
    if not is_project_chat_room_id(room_id):
        return None
    return str(room_id)[len(PROJECT_CHAT_ROOM_ID_PREFIX):] or None


# ── Projects ────────────────────────────────────────────────────────────────

def create_project(user_id: str, name: str, description: str = "") -> dict:
    db = get_db()
    ref = db.collection("projects").document()
    data = {
        "userId": user_id,
        "name": name,
        "description": description,
        "thumbnailUrl": None,
        "status": "active",
        "site": {
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
        },
        "regulatory": {"zoning": None},
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(data)
    data["id"] = ref.id
    data["createdAt"] = datetime.utcnow().isoformat()
    data["updatedAt"] = datetime.utcnow().isoformat()
    return data


def get_projects(user_id: str) -> List[dict]:
    db = get_db()
    docs = (
        db.collection("projects")
        .where("userId", "==", user_id)
        .order_by("updatedAt", direction=firestore.Query.DESCENDING)
        .stream()
    )
    return [_doc_to_dict(d) for d in docs]


def get_project(project_id: str) -> Optional[dict]:
    db = get_db()
    return _doc_to_dict(db.collection("projects").document(project_id).get())


def update_project(project_id: str, updates: dict) -> Optional[dict]:
    db = get_db()
    ref = db.collection("projects").document(project_id)
    if not ref.get().exists:
        return None
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    ref.update(updates)
    return _doc_to_dict(ref.get())


def delete_project(project_id: str) -> bool:
    db = get_db()
    ref = db.collection("projects").document(project_id)
    if not ref.get().exists:
        return False
    rooms = ref.collection("rooms").stream()
    for room in rooms:
        msgs = room.reference.collection("messages").stream()
        for msg in msgs:
            msg.reference.delete()
        room.reference.delete()
    report_chats = ref.collection("report_chats").stream()
    for chat_doc in report_chats:
        msgs = chat_doc.reference.collection("messages").stream()
        for msg in msgs:
            msg.reference.delete()
        chat_doc.reference.delete()
    ref.delete()
    return True


# ── Rooms ────────────────────────────────────────────────────────────────────

def create_room(project_id: str, name: str, room_type: str) -> dict:
    db = get_db()
    ref = db.collection("projects").document(project_id).collection("rooms").document()
    data = {
        "projectId": project_id,
        "name": name,
        "roomType": room_type,
        "thumbnailUrl": None,
        "status": "draft",
        "latest3dJobId": None,
        "approved2dImageUrls": [],
        "artifactUrl": None,
        "artifactMetadata": None,
        "worldLabs": {
            "worldId": None,
            "operationId": None,
            "marbleUrl": None,
            "thumbnailUrl": None,
            "splatUrls": {"100k": None, "500k": None, "full_res": None},
            "colliderMeshUrl": None,
            "panoUrl": None,
            "caption": None,
        },
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(data)
    data["id"] = ref.id
    data["createdAt"] = datetime.utcnow().isoformat()
    data["updatedAt"] = datetime.utcnow().isoformat()
    return data


def get_rooms(project_id: str) -> List[dict]:
    db = get_db()
    docs = (
        db.collection("projects")
        .document(project_id)
        .collection("rooms")
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .stream()
    )
    return [_doc_to_dict(d) for d in docs]


def get_room(project_id: str, room_id: str) -> Optional[dict]:
    db = get_db()
    return _doc_to_dict(
        db.collection("projects")
        .document(project_id)
        .collection("rooms")
        .document(room_id)
        .get()
    )


def update_room(project_id: str, room_id: str, updates: dict) -> Optional[dict]:
    db = get_db()
    ref = (
        db.collection("projects")
        .document(project_id)
        .collection("rooms")
        .document(room_id)
    )
    if not ref.get().exists:
        return None
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    ref.update(updates)
    return _doc_to_dict(ref.get())


def delete_room(project_id: str, room_id: str) -> bool:
    db = get_db()
    ref = (
        db.collection("projects")
        .document(project_id)
        .collection("rooms")
        .document(room_id)
    )
    if not ref.get().exists:
        return False
    msgs = ref.collection("messages").stream()
    for msg in msgs:
        msg.reference.delete()
    ref.delete()
    return True


# ── Messages ─────────────────────────────────────────────────────────────────

def add_message(project_id: str, room_id: str, role: str, content: str,
                image_urls: Optional[List[str]] = None,
                metadata: Optional[dict] = None) -> dict:
    db = get_db()
    ref = (
        db.collection("projects")
        .document(project_id)
        .collection("rooms")
        .document(room_id)
        .collection("messages")
        .document()
    )
    data = {
        "roomId": room_id,
        "role": role,
        "content": content,
        "imageUrls": image_urls or [],
        "metadata": metadata or {"type": "text"},
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(data)
    data["id"] = ref.id
    data["createdAt"] = datetime.utcnow().isoformat()
    return data


def get_messages(project_id: str, room_id: str) -> List[dict]:
    db = get_db()
    docs = (
        db.collection("projects")
        .document(project_id)
        .collection("rooms")
        .document(room_id)
        .collection("messages")
        .order_by("createdAt")
        .stream()
    )
    return [_doc_to_dict(d) for d in docs]


def add_project_chat_message(project_id: str, scope: str, role: str, content: str,
                             image_urls: Optional[List[str]] = None,
                             metadata: Optional[dict] = None) -> dict:
    db = get_db()
    room_id = make_project_chat_room_id(scope)
    ref = (
        db.collection("projects")
        .document(project_id)
        .collection("report_chats")
        .document(scope)
        .collection("messages")
        .document()
    )
    data = {
        "roomId": room_id,
        "role": role,
        "content": content,
        "imageUrls": image_urls or [],
        "metadata": {
            "type": "project_report_chat",
            "scope": scope,
            **(metadata or {}),
        },
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(data)
    data["id"] = ref.id
    data["createdAt"] = datetime.utcnow().isoformat()
    return data


def get_project_chat_messages(project_id: str, scope: str) -> List[dict]:
    db = get_db()
    docs = (
        db.collection("projects")
        .document(project_id)
        .collection("report_chats")
        .document(scope)
        .collection("messages")
        .order_by("createdAt")
        .stream()
    )
    return [_doc_to_dict(d) for d in docs]


# ── Generation Jobs ──────────────────────────────────────────────────────────

def create_generation_job(room_id: Optional[str], project_id: str, user_id: str,
                          job_type: str, prompt: str,
                          reference_image_urls: Optional[List[str]] = None) -> dict:
    db = get_db()
    ref = db.collection("generation_jobs").document()
    data = {
        "roomId": room_id,
        "projectId": project_id,
        "userId": user_id,
        "type": job_type,
        "status": "pending",
        "input": {
            "prompt": prompt,
            "referenceImageUrls": reference_image_urls or [],
        },
        "output": {"resultUrls": [], "error": None},
        "externalIds": {
            "worldLabsOperationId": None,
            "worldLabsWorldId": None,
        },
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(data)
    data["id"] = ref.id
    data["createdAt"] = datetime.utcnow().isoformat()
    data["updatedAt"] = datetime.utcnow().isoformat()
    return data


def get_generation_job(job_id: str) -> Optional[dict]:
    db = get_db()
    return _doc_to_dict(db.collection("generation_jobs").document(job_id).get())


def update_generation_job(job_id: str, updates: dict) -> Optional[dict]:
    db = get_db()
    ref = db.collection("generation_jobs").document(job_id)
    if not ref.get().exists:
        return None
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    ref.update(updates)
    return _doc_to_dict(ref.get())
