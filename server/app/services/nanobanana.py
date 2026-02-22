import asyncio
import base64
import logging
from typing import List, Optional
from urllib.parse import quote
from uuid import uuid4

import google.generativeai as genai
from firebase_admin import storage

from app.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
FALLBACK_IMAGE_MODELS = [
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-exp-image-generation",
]


def _get_configured():
    genai.configure(api_key=settings.gemini_api_key)


def _normalize_model_name(model_name: str) -> str:
    if model_name.startswith("models/"):
        return model_name
    return "models/%s" % model_name


def _candidate_models() -> List[str]:
    models = [settings.gemini_image_model] + FALLBACK_IMAGE_MODELS
    # Preserve order while dropping duplicates/empty values.
    return [m for i, m in enumerate(models) if m and m not in models[:i]]


def _extract_inline_image(response):
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        parts = getattr(getattr(candidate, "content", None), "parts", None) or []
        for part in parts:
            inline = getattr(part, "inline_data", None)
            if not inline:
                continue

            raw_data = getattr(inline, "data", None)
            mime_type = getattr(inline, "mime_type", None) or "image/png"
            if raw_data:
                if isinstance(raw_data, (bytes, bytearray)):
                    return bytes(raw_data), mime_type
                if isinstance(raw_data, str):
                    try:
                        return base64.b64decode(raw_data), mime_type
                    except Exception:
                        return raw_data.encode("utf-8"), mime_type
    return None, None


def _upload_image_to_firebase(image_bytes: bytes, mime_type: str) -> str:
    bucket_name = settings.firebase_storage_bucket
    if not bucket_name:
        raise RuntimeError(
            "FIREBASE_STORAGE_BUCKET is not configured. "
            "Set it in server/.env so generated images can be stored."
        )

    extension = "jpg" if "jpeg" in mime_type else "png"
    object_path = "generated/%s.%s" % (uuid4().hex, extension)
    token = uuid4().hex

    bucket = storage.bucket(bucket_name)
    blob = bucket.blob(object_path)
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.upload_from_string(image_bytes, content_type=mime_type)

    encoded_path = quote(object_path, safe="")
    return (
        "https://firebasestorage.googleapis.com/v0/b/%s/o/%s?alt=media&token=%s"
        % (bucket.name, encoded_path, token)
    )


async def generate_image(prompt: str,
                          reference_urls: Optional[List[str]] = None) -> str:
    """
    Generate a 2D image via Nano Banana (Gemini API).
    Returns the URL of the generated image.
    """
    _get_configured()
    last_error = None
    models = _candidate_models()

    for attempt in range(1, MAX_RETRIES + 1):
        for model_name in models:
            try:
                model = genai.GenerativeModel(_normalize_model_name(model_name))
                response = model.generate_content(prompt)
                image_bytes, mime_type = _extract_inline_image(response)
                if not image_bytes:
                    raise ValueError("No image bytes returned by model %s" % model_name)

                image_url = _upload_image_to_firebase(image_bytes, mime_type)
                logger.info(
                    "Nano Banana generated image on attempt %d using %s",
                    attempt,
                    model_name,
                )
                return image_url

            except Exception as e:
                last_error = e
                logger.warning(
                    "Nano Banana attempt %d/%d with %s failed: %s",
                    attempt,
                    MAX_RETRIES,
                    model_name,
                    e,
                )

        if attempt < MAX_RETRIES:
            await asyncio.sleep(2 ** attempt)

    raise RuntimeError("Nano Banana failed after %d attempts: %s" % (MAX_RETRIES, last_error))
