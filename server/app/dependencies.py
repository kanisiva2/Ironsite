import logging

from fastapi import Depends, HTTPException, Header
from firebase_admin import auth, firestore

logger = logging.getLogger(__name__)

_db = None


def get_db():
    global _db
    if _db is None:
        _db = firestore.client()
    return _db


async def get_current_user(authorization: str = Header(...)) -> str:
    """Verify Firebase ID token and return UID. Lazy-creates user doc on first request."""
    try:
        token = authorization.replace("Bearer ", "")
        decoded = auth.verify_id_token(token)
        uid = decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    db = get_db()
    user_ref = db.collection("users").document(uid)
    if not user_ref.get().exists:
        user_ref.set({
            "uid": uid,
            "email": decoded.get("email", ""),
            "displayName": decoded.get("name", ""),
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        logger.info(f"Created user doc for {uid}")

    return uid
