from typing import List, Optional

from pydantic import BaseModel


class RoomCreate(BaseModel):
    name: str
    roomType: str = "other"


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    roomType: Optional[str] = None
    status: Optional[str] = None
    approved2dImageUrls: Optional[List[str]] = None
