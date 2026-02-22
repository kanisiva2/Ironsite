import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.dependencies import get_current_user
from app.models.chat import ChatMessageRequest
from app.services import firestore as fs
from app.services.gemini import stream_chat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/message")
async def send_message(body: ChatMessageRequest,
                        uid: str = Depends(get_current_user)):
    project = fs.get_project(body.projectId)
    if not project or project.get("userId") != uid:
        raise HTTPException(status_code=404, detail="Project not found")

    project_chat_scope = fs.get_project_chat_scope_from_room_id(body.roomId)
    if project_chat_scope:
        fs.add_project_chat_message(
            body.projectId,
            project_chat_scope,
            role="user",
            content=body.content,
            image_urls=body.imageUrls,
        )
        history = fs.get_project_chat_messages(body.projectId, project_chat_scope)
    else:
        room = fs.get_room(body.projectId, body.roomId)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        fs.add_message(
            body.projectId, body.roomId,
            role="user",
            content=body.content,
            image_urls=body.imageUrls,
        )
        history = fs.get_messages(body.projectId, body.roomId)

    async def event_generator():
        full_text = ""
        function_call_data = None

        async for chunk in stream_chat(history):
            if chunk["type"] == "token":
                full_text += chunk["text"]
                yield {
                    "event": "token",
                    "data": json.dumps({"text": chunk["text"]}),
                }

            elif chunk["type"] == "function_call":
                function_call_data = chunk
                yield {
                    "event": "action",
                    "data": json.dumps({
                        "action": {
                            "type": chunk["name"],
                            "args": chunk["args"],
                        }
                    }),
                }

            elif chunk["type"] == "done":
                if project_chat_scope:
                    assistant_msg = fs.add_project_chat_message(
                        body.projectId,
                        project_chat_scope,
                        role="assistant",
                        content=full_text,
                        metadata={"type": "text"},
                    )
                else:
                    assistant_msg = fs.add_message(
                        body.projectId, body.roomId,
                        role="assistant",
                        content=full_text,
                        metadata={"type": "text"},
                    )
                yield {
                    "event": "done",
                    "data": json.dumps({
                        "messageId": assistant_msg["id"],
                        "fullContent": full_text,
                    }),
                }

                if function_call_data and function_call_data["name"] == "generate_2d_image":
                    yield {
                        "event": "action",
                        "data": json.dumps({
                            "action": {
                                "type": "generate_2d",
                                "args": function_call_data["args"],
                            }
                        }),
                    }

            elif chunk["type"] == "error":
                yield {
                    "event": "error",
                    "data": json.dumps({"detail": chunk["detail"]}),
                }

    return EventSourceResponse(event_generator())
