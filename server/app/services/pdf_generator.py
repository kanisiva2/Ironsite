import io
import logging
from typing import List

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

logger = logging.getLogger(__name__)


def generate_chat_summary_pdf(messages: List[dict], room_name: str = "Room") -> bytes:
    """Compile chat messages into a PDF summary. Returns PDF bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            topMargin=0.75 * inch, bottomMargin=0.75 * inch)

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="UserMsg",
        parent=styles["Normal"],
        leftIndent=0,
        spaceAfter=6,
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        name="AssistantMsg",
        parent=styles["Normal"],
        leftIndent=20,
        spaceAfter=6,
        fontName="Helvetica",
    ))

    elements = []
    elements.append(Paragraph("Chat Summary — %s" % room_name, styles["Title"]))
    elements.append(Spacer(1, 12))

    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "").replace("\n", "<br/>")
        content = content.replace("<", "&lt;").replace(">", "&gt;").replace("&lt;br/&gt;", "<br/>")

        if role == "user":
            elements.append(Paragraph("<b>User:</b> %s" % content, styles["UserMsg"]))
        elif role == "assistant":
            elements.append(Paragraph("<b>AI Architect:</b> %s" % content, styles["AssistantMsg"]))
        elif role == "system":
            elements.append(Paragraph("<i>System: %s</i>" % content, styles["Normal"]))

        image_urls = msg.get("imageUrls", [])
        if image_urls:
            for url in image_urls:
                elements.append(Paragraph("[Image: %s]" % url, styles["Normal"]))

        elements.append(Spacer(1, 4))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()


def messages_to_text_summary(messages: List[dict]) -> str:
    """Convert messages to a plain text summary for LLM consumption."""
    lines = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        prefix = {"user": "User", "assistant": "AI Architect", "system": "System"}.get(role, role)
        lines.append("%s: %s" % (prefix, content))

        for url in msg.get("imageUrls", []):
            lines.append("  [Attached image: %s]" % url)

    return "\n\n".join(lines)
