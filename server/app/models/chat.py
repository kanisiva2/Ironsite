from typing import List

from pydantic import BaseModel


class ChatMessageRequest(BaseModel):
    roomId: str
    projectId: str
    content: str
    imageUrls: List[str] = []
