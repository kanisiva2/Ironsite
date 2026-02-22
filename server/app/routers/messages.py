from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.services import firestore as fs

router = APIRouter(tags=["messages"])


@router.get("/projects/{project_id}/rooms/{room_id}/messages")
async def list_messages(project_id: str, room_id: str,
                         uid: str = Depends(get_current_user)):
    project = fs.get_project(project_id)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    room = fs.get_room(project_id, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    messages = fs.get_messages(project_id, room_id)
    return {"messages": messages}
