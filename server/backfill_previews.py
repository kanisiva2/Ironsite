"""
One-time migration: populate previewImageUrls on all existing projects.
Run from the server directory: python backfill_previews.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import firebase_admin
from firebase_admin import credentials
from app.config import settings

cred = credentials.Certificate(settings.firebase_service_account_path)
firebase_admin.initialize_app(cred)

from app.services.firestore import get_db

def backfill():
    db = get_db()
    projects = list(db.collection("projects").stream())
    print(f"Found {len(projects)} project(s).")

    for project in projects:
        project_id = project.id
        rooms = (
            db.collection("projects")
            .document(project_id)
            .collection("rooms")
            .order_by("createdAt")
            .stream()
        )
        preview_urls = []
        for room in rooms:
            approved = (room.to_dict().get("approved2dImageUrls") or [])
            if approved:
                preview_urls.append(approved[0])
            if len(preview_urls) >= 2:
                break

        db.collection("projects").document(project_id).update({
            "previewImageUrls": preview_urls,
        })
        name = project.to_dict().get("name", project_id)
        print(f"  '{name}': {len(preview_urls)} preview(s)")

    print(f"\nDone.")

if __name__ == "__main__":
    backfill()