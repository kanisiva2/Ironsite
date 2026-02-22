from typing import Optional

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
