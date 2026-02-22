import asyncio
import logging
from typing import List, Optional

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


def _get_configured():
    genai.configure(api_key=settings.gemini_api_key)


async def generate_image(prompt: str,
                          reference_urls: Optional[List[str]] = None) -> str:
    """
    Generate a 2D image via Nano Banana (Gemini API).
    Returns the URL of the generated image.
    """
    _get_configured()
    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            model = genai.ImageGenerationModel("imagegeneration")
            response = model.generate_images(
                prompt=prompt,
                number_of_images=1,
            )

            if response.images:
                image = response.images[0]
                image_url = getattr(image, "url", None) or getattr(image, "uri", None)
                if image_url:
                    logger.info("Nano Banana generated image on attempt %d", attempt)
                    return image_url

            raise ValueError("No image returned from Nano Banana")

        except Exception as e:
            last_error = e
            logger.warning("Nano Banana attempt %d/%d failed: %s", attempt, MAX_RETRIES, e)
            if attempt < MAX_RETRIES:
                await asyncio.sleep(2 ** attempt)

    raise RuntimeError("Nano Banana failed after %d attempts: %s" % (MAX_RETRIES, last_error))
