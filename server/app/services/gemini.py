import logging
import json
import re
from pathlib import Path
from typing import Any, AsyncGenerator, List, Optional, Dict
import httpx

try:
    import google.generativeai as genai  # type: ignore
except Exception:  # pragma: no cover - optional dependency path
    genai = None
try:
    from google import genai as google_genai  # type: ignore
except Exception:  # pragma: no cover - optional dependency path
    google_genai = None

from app.config import settings

logger = logging.getLogger(__name__)

_model = None
_client = None
_backend = None
_rest_model_cache = None
_rest_api_version_cache = None
_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
GEMINI_PRIMARY_MODEL = "gemini-3.1-pro-preview"
GEMINI_MODEL_VARIANTS = [
    "gemini-3.1-pro-preview",
    "gemini-3.1-pro",
]

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


def _legacy_generative_model_class():
    if genai is None:
        return None
    if hasattr(genai, "GenerativeModel"):
        return genai.GenerativeModel
    nested = getattr(genai, "generative_models", None)
    if nested is not None and hasattr(nested, "GenerativeModel"):
        return nested.GenerativeModel
    return None


def _get_model():
    """Legacy google.generativeai model with tool support."""
    global _model
    if _model is None:
        model_cls = _legacy_generative_model_class()
        if model_cls is None:
            raise RuntimeError(
                "Installed google.generativeai package does not expose GenerativeModel"
            )
        genai.configure(api_key=settings.gemini_api_key)
        _model = model_cls(
            GEMINI_PRIMARY_MODEL,
            tools=[GENERATE_2D_TOOL],
            system_instruction=_load_prompt("system_consultant.txt"),
        )
    return _model


def _get_backend() -> str:
    """Detect which Gemini SDK interface is available."""
    global _backend
    if _backend is not None:
        return _backend

    if _legacy_generative_model_class() is not None:
        _backend = "legacy"
        return _backend

    if google_genai is not None and hasattr(google_genai, "Client"):
        _backend = "google_genai"
        return _backend

    if settings.gemini_api_key:
        _backend = "rest"
        return _backend

    raise RuntimeError("No supported Gemini SDK interface found and no Gemini API key configured.")


def _get_client():
    global _client
    if _client is None:
        if google_genai is None or not hasattr(google_genai, "Client"):
            raise RuntimeError("google.genai Client is not available")
        _client = google_genai.Client(api_key=settings.gemini_api_key)
    return _client


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text()


def _rest_api_versions() -> List[str]:
    return ["v1beta", "v1"]


def _rest_preferred_model_predicates() -> List[str]:
    # Keep all behavior pinned to Gemini 3.1 Pro variants only.
    return ["gemini-3.1-pro"]


def _rest_extract_text(data: dict) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = ((candidates[0] or {}).get("content") or {}).get("parts") or []
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return "".join(texts).strip()


def _rest_list_models(api_version: str) -> List[dict]:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    url = "https://generativelanguage.googleapis.com/%s/models" % api_version
    response = httpx.get(
        url,
        headers={"x-goog-api-key": settings.gemini_api_key},
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json().get("models", []) or []


def _rest_resolve_31_pro_model() -> tuple:
    """
    Return (api_version, model_name_without_models_prefix), pinned to Gemini 3.1 Pro.
    """
    global _rest_model_cache, _rest_api_version_cache
    if _rest_model_cache and _rest_api_version_cache:
        return _rest_api_version_cache, _rest_model_cache

    last_error = None
    for api_version in _rest_api_versions():
        try:
            models = _rest_list_models(api_version)
            matches = []
            for model in models:
                name = str(model.get("name") or "")  # e.g. "models/gemini-3.1-pro-preview"
                lower_name = name.lower()
                if any(token in lower_name for token in _rest_preferred_model_predicates()):
                    matches.append(name)

            # Prefer exact configured primary model if present.
            preferred_full = "models/%s" % GEMINI_PRIMARY_MODEL
            chosen = None
            if preferred_full in matches:
                chosen = preferred_full
            elif matches:
                # Prefer preview names before other variants, then shortest/stable deterministic sort.
                matches = sorted(matches, key=lambda n: ("preview" not in n.lower(), len(n), n))
                chosen = matches[0]

            if chosen:
                _rest_api_version_cache = api_version
                _rest_model_cache = chosen.replace("models/", "", 1)
                logger.info(
                    "Gemini REST pinned model resolved to %s via %s",
                    _rest_model_cache,
                    api_version,
                )
                return _rest_api_version_cache, _rest_model_cache
        except Exception as exc:
            last_error = exc
            logger.warning("Gemini REST model list failed for %s: %s", api_version, exc)
            continue

    raise RuntimeError(
        "Gemini-3.1-pro is not available for this API key/project via Generative Language API. "
        "Last model-list error: %s" % last_error
    )


def _rest_generate_text(prompt: str, system_instruction: Optional[str] = None) -> str:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ]
    }
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}],
        }

    api_version, model_name = _rest_resolve_31_pro_model()
    url = (
        "https://generativelanguage.googleapis.com/%s/models/%s:generateContent"
        % (api_version, model_name)
    )

    response = httpx.post(
        url,
        headers={"x-goog-api-key": settings.gemini_api_key},
        json=payload,
        timeout=90.0,
    )
    response.raise_for_status()
    data = response.json()
    text = _rest_extract_text(data)
    if text:
        return text

    prompt_feedback = data.get("promptFeedback") or {}
    raise RuntimeError(
        "Gemini REST response did not include text (model=%s). %s"
        % (model_name, prompt_feedback)
    )


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


def _messages_to_plain_transcript(messages: List[dict]) -> str:
    lines = []
    for msg in messages:
        role = msg.get("role", "unknown")
        prefix = "User" if role == "user" else "Assistant"
        content = msg.get("content", "") or ""
        lines.append("%s: %s" % (prefix, content))
        for url in msg.get("imageUrls", []) or []:
            lines.append("%s image: %s" % (prefix, url))
    return "\n".join(lines)


def _response_text(response: Any) -> str:
    text = getattr(response, "text", None)
    if isinstance(text, str):
        return text
    return str(response or "")


def _generate_text(prompt: str, system_instruction: Optional[str] = None) -> str:
    """
    Non-streaming text generation compatible with legacy and new Gemini SDKs.
    """
    backend = _get_backend()

    if backend == "legacy":
        if genai is None:
            raise RuntimeError("google.generativeai is unavailable")
        genai.configure(api_key=settings.gemini_api_key)
        model_cls = _legacy_generative_model_class()
        if model_cls is None:
            raise RuntimeError("Legacy Gemini model class unavailable")
        model = model_cls(
            GEMINI_PRIMARY_MODEL,
            system_instruction=system_instruction,
        )
        response = model.generate_content(prompt)
        return _response_text(response)

    if backend == "rest":
        return _rest_generate_text(prompt, system_instruction=system_instruction)

    client = _get_client()
    merged_prompt = prompt
    if system_instruction:
        merged_prompt = "System instruction:\n%s\n\nUser request:\n%s" % (
            system_instruction,
            prompt,
        )

    # Keep the call minimal to avoid binding to new-SDK config classes.
    response = client.models.generate_content(
        model=GEMINI_PRIMARY_MODEL,
        contents=merged_prompt,
    )
    return _response_text(response)


async def stream_chat(messages: List[dict]) -> AsyncGenerator:
    """
    Stream a chat response from Gemini.

    Yields dicts:
      {"type": "token", "text": "..."} for text chunks
      {"type": "function_call", "name": "...", "args": {...}} for tool calls
      {"type": "done"} when finished
    """
    try:
        backend = _get_backend()
    except Exception as e:
        logger.error("Gemini SDK initialization error: %s", e)
        yield {"type": "error", "detail": str(e)}
        return

    if backend == "legacy":
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
        return

    # Fallback for newer SDKs or REST: text-only streaming (no tool calling).
    try:
        system_instruction = _load_prompt("system_consultant.txt")
        transcript = _messages_to_plain_transcript(messages[:-1]) if len(messages) > 1 else ""
        latest_content = messages[-1].get("content", "") or ""
        for url in (messages[-1].get("imageUrls") or []):
            latest_content += "\n[User attached image: %s]" % url

        prompt = (
            "System instruction:\n%s\n\n"
            "Conversation history:\n%s\n\n"
            "Latest user message:\n%s\n\n"
            "Respond helpfully as the AI architect. "
            "If you want to suggest generating an image, explain it in text."
        ) % (system_instruction, transcript or "(none)", latest_content)

        full_text = ""
        if backend == "rest":
            text = _rest_generate_text(prompt)
            if text:
                full_text += text
                yield {"type": "token", "text": text}
        else:
            client = _get_client()
            stream_method = getattr(client.models, "generate_content_stream", None)
            if callable(stream_method):
                for chunk in stream_method(model=GEMINI_PRIMARY_MODEL, contents=prompt):
                    text = getattr(chunk, "text", None)
                    if text:
                        full_text += text
                        yield {"type": "token", "text": text}
            else:
                response = client.models.generate_content(model=GEMINI_PRIMARY_MODEL, contents=prompt)
                text = _response_text(response)
                if text:
                    full_text += text
                    yield {"type": "token", "text": text}

        yield {"type": "done", "full_text": full_text}

    except Exception as e:
        logger.error("Gemini streaming error (fallback backend): %s", e)
        yield {"type": "error", "detail": str(e)}


async def generate_artifact_content(conversation_summary: str,
                                     image_descriptions: str) -> str:
    """Non-streaming call to generate the technical artifact."""
    artifact_prompt = _load_prompt("system_artifact.txt")

    prompt = (
        "## Conversation Summary\n%s\n\n"
        "## Approved Design Images\n%s\n\n"
        "Generate the complete technical specification document now."
    ) % (conversation_summary, image_descriptions)

    return _generate_text(prompt, system_instruction=artifact_prompt)


def _extract_json_object(text: str) -> Optional[dict]:
    raw = (text or "").strip()
    if not raw:
        return None

    fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, re.DOTALL | re.IGNORECASE)
    if fenced_match:
        raw = fenced_match.group(1).strip()

    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    try:
        parsed = json.loads(raw[start:end + 1])
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


async def extract_site_constraints_from_conversation(
    messages: List[dict],
) -> Dict[str, Any]:
    """
    Infer structured site/zoning inputs from chat history.

    Returns a dict with shape:
    {
      "site": {...partial site object...},
      "missingQuestions": [...],
      "notes": [...]
    }
    """
    if not settings.gemini_api_key:
        return {
            "site": {},
            "missingQuestions": [],
            "notes": ["Gemini API key not configured; automatic extraction skipped."],
        }

    history_lines = []
    for msg in messages:
        role = msg.get("role", "unknown")
        prefix = "User" if role == "user" else "Assistant"
        content = (msg.get("content") or "").strip()
        if not content and not (msg.get("imageUrls") or []):
            continue
        history_lines.append("%s: %s" % (prefix, content))
        for url in (msg.get("imageUrls") or []):
            history_lines.append("%s image: %s" % (prefix, url))

    transcript = "\n".join(history_lines[-200:]) or "No conversation history available."

    extraction_prompt = (
        "You extract structured residential project site/compliance inputs from a design conversation.\n"
        "Return ONLY valid JSON (no markdown fences).\n"
        "Use null for unknown values. Do not invent facts.\n"
        "If a value is ambiguous, leave it null and add a missing question.\n\n"
        "Output schema:\n"
        "{\n"
        '  "site": {\n'
        '    "address": string|null,\n'
        '    "parcelId": string|null,\n'
        '    "zoningDistrict": string|null,\n'
        '    "lotAreaSqFt": number|null,\n'
        '    "maxHeightFt": number|null,\n'
        '    "maxLotCoveragePct": number|null,\n'
        '    "setbacksFt": {"front": number|null, "rear": number|null, "left": number|null, "right": number|null},\n'
        '    "proposed": {\n'
        '      "footprintAreaSqFt": number|null,\n'
        '      "heightFt": number|null,\n'
        '      "setbacksFt": {"front": number|null, "rear": number|null, "left": number|null, "right": number|null}\n'
        "    }\n"
        "  },\n"
        '  "missingQuestions": [string],\n'
        '  "notes": [string]\n'
        "}\n\n"
        "Conversation transcript:\n"
        "%s\n"
    ) % transcript

    response_text = _generate_text(extraction_prompt)
    parsed = _extract_json_object(response_text)
    if not parsed:
        logger.warning("Failed to parse Gemini site extraction JSON response")
        return {
            "site": {},
            "missingQuestions": [],
            "notes": ["Automatic extraction returned unparseable JSON; using saved values where available."],
        }

    site = parsed.get("site") if isinstance(parsed.get("site"), dict) else {}
    missing_questions = parsed.get("missingQuestions")
    notes = parsed.get("notes")

    return {
        "site": site,
        "missingQuestions": missing_questions if isinstance(missing_questions, list) else [],
        "notes": notes if isinstance(notes, list) else [],
    }


async def extract_technical_doc_inputs_from_conversation(
    messages: List[dict],
) -> Dict[str, Any]:
    """
    Infer structured technical-documentation inputs from chat history.

    Returns a dict with keys:
      extractedInputs, missingQuestions, notes
    """
    if not settings.gemini_api_key:
        return {
            "extractedInputs": {},
            "missingQuestions": [],
            "notes": ["Gemini API key not configured; technical docs extraction skipped."],
        }

    history_lines = []
    for msg in messages:
        role = msg.get("role", "unknown")
        prefix = "User" if role == "user" else "Assistant"
        content = (msg.get("content") or "").strip()
        if content:
            history_lines.append("%s: %s" % (prefix, content))
        for url in (msg.get("imageUrls") or []):
            history_lines.append("%s image: %s" % (prefix, url))

    transcript = "\n".join(history_lines[-250:]) or "No conversation history available."

    extraction_prompt = (
        "You extract structured inputs needed for preliminary residential technical documentation.\n"
        "Return ONLY valid JSON (no markdown fences).\n"
        "Do not invent facts. Use null when unknown.\n"
        "Add concise missingQuestions for anything important that is still needed.\n\n"
        "Output schema:\n"
        "{\n"
        '  "extractedInputs": {\n'
        '    "projectIntent": string|null,\n'
        '    "site": {\n'
        '      "address": string|null,\n'
        '      "parcelId": string|null,\n'
        '      "zoningDistrict": string|null,\n'
        '      "lotAreaSqFt": number|null\n'
        "    },\n"
        '    "buildingProgram": {\n'
        '      "stories": number|null,\n'
        '      "bedrooms": number|null,\n'
        '      "bathrooms": number|null,\n'
        '      "garageSpaces": number|null,\n'
        '      "conditionedAreaSqFt": number|null,\n'
        '      "footprintAreaSqFt": number|null,\n'
        '      "heightFt": number|null\n'
        "    },\n"
        '    "designPreferences": [string],\n'
        '    "materialsAndEnvelope": [string],\n'
        '    "systems": [string],\n'
        '    "constraints": [string],\n'
        '    "assumptionsMentioned": [string]\n'
        "  },\n"
        '  "missingQuestions": [string],\n'
        '  "notes": [string]\n'
        "}\n\n"
        "Conversation transcript:\n%s\n"
    ) % transcript

    response_text = _generate_text(extraction_prompt)
    parsed = _extract_json_object(response_text)
    if not parsed:
        logger.warning("Failed to parse Gemini technical docs extraction JSON response")
        return {
            "extractedInputs": {},
            "missingQuestions": [],
            "notes": ["Automatic technical docs extraction returned unparseable JSON."],
        }

    extracted_inputs = parsed.get("extractedInputs")
    missing_questions = parsed.get("missingQuestions")
    notes = parsed.get("notes")

    return {
        "extractedInputs": extracted_inputs if isinstance(extracted_inputs, dict) else {},
        "missingQuestions": missing_questions if isinstance(missing_questions, list) else [],
        "notes": notes if isinstance(notes, list) else [],
    }
