from typing import List

from pydantic import BaseModel


class Generate2DRequest(BaseModel):
    roomId: str
    projectId: str
    prompt: str
    referenceImageUrls: List[str] = []


class GenerateArtifactRequest(BaseModel):
    roomId: str
    projectId: str


class Generate3DRequest(BaseModel):
    roomId: str
    projectId: str
    model: str = "Marble 0.1-plus"
