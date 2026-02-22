import logging
from pathlib import Path
from typing import Any, AsyncGenerator, List

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

_model = None
_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"

GENERATE_2D_TOOL = {
    "function_declarations": [
        {
            "name": "generate_2d_image",
            "description": (
                "Generate a 2D architectural visualization image when the user "
                "wants to see what their room design looks like. Call this when "
                "the user asks to 'show me', 'generate an image', 'let me see it', "
                "or similar requests for a visual."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": (
                            "A detailed image generation prompt describing the room, "
                            "including dimensions, style, materials, colors, furniture, "
                            "and lighting. Be as specific as possible."
                        ),
                    },
                    "style_tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Style keywords like 'modern', 'minimalist', 'warm'.",
                    },
                },
                "required": ["prompt"],
            },
        }
    ]
}


def _get_model():
    global _model
    if _model is None:
        genai.configure(api_key=settings.gemini_api_key)
        _model = genai.GenerativeModel(
            "gemini-3.1-pro-preview",
            tools=[GENERATE_2D_TOOL],
            system_instruction=_load_prompt("system_consultant.txt"),
        )
    return _model


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text()


def _to_json_compatible(value: Any):
    """Convert SDK/protobuf containers into plain JSON-serializable values."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, dict):
        return {str(key): _to_json_compatible(val) for key, val in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_to_json_compatible(item) for item in value]

    if hasattr(value, "items"):
        try:
            return {
                str(key): _to_json_compatible(val)
                for key, val in value.items()
            }
        except Exception:
            pass

    if hasattr(value, "__iter__") and not isinstance(value, (str, bytes, bytearray)):
        try:
            return [_to_json_compatible(item) for item in value]
        except Exception:
            pass

    if hasattr(value, "to_dict"):
        try:
            return _to_json_compatible(value.to_dict())
        except Exception:
            pass

    return str(value)


def _format_history(messages: List[dict]) -> List[dict]:
    """Convert our message format to Gemini's history format."""
    history = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        parts = [msg["content"]]
        if msg.get("imageUrls"):
            for url in msg["imageUrls"]:
                parts.append("[Image: %s]" % url)
        history.append({"role": role, "parts": parts})
    return history


async def stream_chat(messages: List[dict]) -> AsyncGenerator:
    """
    Stream a chat response from Gemini.

    Yields dicts:
      {"type": "token", "text": "..."} for text chunks
      {"type": "function_call", "name": "...", "args": {...}} for tool calls
      {"type": "done"} when finished
    """
    model = _get_model()
    history = _format_history(messages[:-1]) if len(messages) > 1 else []

    chat = model.start_chat(history=history)
    latest_content = messages[-1]["content"]

    if messages[-1].get("imageUrls"):
        for url in messages[-1]["imageUrls"]:
            latest_content += "\n[User attached image: %s]" % url

    try:
        response = chat.send_message(latest_content, stream=True)
        full_text = ""

        for chunk in response:
            if chunk.candidates and chunk.candidates[0].content.parts:
                for part in chunk.candidates[0].content.parts:
                    if hasattr(part, "function_call") and part.function_call.name:
                        fc = part.function_call
                        yield {
                            "type": "function_call",
                            "name": fc.name,
                            "args": _to_json_compatible(fc.args) if fc.args else {},
                        }
                    elif hasattr(part, "text") and part.text:
                        full_text += part.text
                        yield {"type": "token", "text": part.text}

        yield {"type": "done", "full_text": full_text}

    except Exception as e:
        logger.error("Gemini streaming error: %s", e)
        yield {"type": "error", "detail": str(e)}


async def generate_artifact_content(conversation_summary: str,
                                     image_descriptions: str) -> str:
    """Non-streaming call to generate the technical artifact."""
    artifact_prompt = _load_prompt("system_artifact.txt")

    genai.configure(api_key=settings.gemini_api_key)
    artifact_model = genai.GenerativeModel(
        "gemini-3.1-pro-preview",
        system_instruction=artifact_prompt,
    )

    prompt = (
        "## Conversation Summary\n%s\n\n"
        "## Approved Design Images\n%s\n\n"
        "Generate the complete technical specification document now."
    ) % (conversation_summary, image_descriptions)

    response = artifact_model.generate_content(prompt)
    return response.text
