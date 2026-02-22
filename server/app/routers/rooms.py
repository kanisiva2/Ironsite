from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.room import RoomCreate, RoomUpdate
from app.services import firestore as fs

router = APIRouter(prefix="/projects/{project_id}/rooms", tags=["rooms"])


def _verify_project_ownership(project_id: str, uid: str):
    project = fs.get_project(project_id)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("")
async def list_rooms(project_id: str, uid: str = Depends(get_current_user)):
    _verify_project_ownership(project_id, uid)
    rooms = fs.get_rooms(project_id)
    return {"rooms": rooms}


@router.post("")
async def create_room(project_id: str, body: RoomCreate,
                       uid: str = Depends(get_current_user)):
    _verify_project_ownership(project_id, uid)
    room = fs.create_room(project_id, body.name, body.roomType)
    return {"room": room}


@router.get("/{room_id}")
async def get_room(project_id: str, room_id: str,
                    uid: str = Depends(get_current_user)):
    _verify_project_ownership(project_id, uid)
    room = fs.get_room(project_id, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"room": room}


@router.put("/{room_id}")
async def update_room(project_id: str, room_id: str, body: RoomUpdate,
                       uid: str = Depends(get_current_user)):
    _verify_project_ownership(project_id, uid)
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    room = fs.update_room(project_id, room_id, updates)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"room": room}


@router.delete("/{room_id}")
async def delete_room(project_id: str, room_id: str,
                       uid: str = Depends(get_current_user)):
    _verify_project_ownership(project_id, uid)
    if not fs.delete_room(project_id, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    return {"success": True}
