from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.project import ProjectCreate, ProjectUpdate
from app.services import firestore as fs

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
async def list_projects(uid: str = Depends(get_current_user)):
    projects = fs.get_projects(uid)
    return {"projects": projects}


@router.post("")
async def create_project(body: ProjectCreate, uid: str = Depends(get_current_user)):
    project = fs.create_project(uid, body.name, body.description)
    return {"project": project}


@router.get("/{project_id}")
async def get_project(project_id: str, uid: str = Depends(get_current_user)):
    project = fs.get_project(project_id)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": project}


@router.put("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate,
                          uid: str = Depends(get_current_user)):
    existing = fs.get_project(project_id)
    if not existing or existing.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    project = fs.update_project(project_id, updates)
    return {"project": project}


@router.delete("/{project_id}")
async def delete_project(project_id: str, uid: str = Depends(get_current_user)):
    existing = fs.get_project(project_id)
    if not existing or existing.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    fs.delete_project(project_id)
    return {"success": True}
