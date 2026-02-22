import hashlib
import io
import logging
from datetime import datetime
from typing import List

# Python/OpenSSL compatibility:
# Some ReportLab codepaths pass `usedforsecurity=` to hashlib.md5, which is not
# supported on older Python/OpenSSL builds (e.g. some Python 3.8 environments).
try:
    hashlib.md5(b"", usedforsecurity=False)
except TypeError:
    _original_md5 = hashlib.md5

    def _md5_compat(*args, **kwargs):
        kwargs.pop("usedforsecurity", None)
        return _original_md5(*args, **kwargs)

    hashlib.md5 = _md5_compat

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

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


def generate_zoning_report_pdf(report: dict, project_name: str = "Project") -> bytes:
    """Render a technical, construction-style zoning compliance report PDF."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="SmallMuted",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=colors.HexColor("#4b5563"),
        leading=11,
    ))
    styles.add(ParagraphStyle(
        name="SectionLabel",
        parent=styles["Heading3"],
        fontSize=10,
        textColor=colors.HexColor("#111827"),
        spaceAfter=6,
        spaceBefore=6,
    ))
    styles.add(ParagraphStyle(
        name="MonoSmall",
        parent=styles["Code"],
        fontSize=8,
        leading=10,
    ))

    status = str(report.get("complianceStatus", "unknown")).lower()
    status_color = {
        "pass": colors.HexColor("#166534"),
        "fail": colors.HexColor("#991b1b"),
        "needs_info": colors.HexColor("#92400e"),
    }.get(status, colors.HexColor("#374151"))

    safe_project = str(project_name or "Project").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    report_no = "ZON-%s" % datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    issue_date = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    site = report.get("site", {}) or {}

    title_block = Table(
        [
            [
                Paragraph("<b>AI ARCHITECT STUDIO</b><br/>Preliminary Zoning Compliance Report", styles["Heading2"]),
                Paragraph(
                    "<b>Report No.</b> %s<br/><b>Issue Date</b> %s<br/><b>Project</b> %s"
                    % (report_no, issue_date, safe_project),
                    styles["SmallMuted"],
                ),
            ]
        ],
        colWidths=[4.5 * inch, 2.25 * inch],
    )
    title_block.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#111827")),
        ("LINEBEFORE", (1, 0), (1, 0), 0.5, colors.HexColor("#9ca3af")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    project_info = Table(
        [
            ["Project", project_name or "Project"],
            ["Address", site.get("address") or "Not provided"],
            ["Parcel ID", site.get("parcelId") or "Not provided"],
            ["Zoning District", site.get("zoningDistrict") or "Not provided"],
            ["Compliance Status", str(report.get("complianceStatus", "unknown")).upper()],
        ],
        colWidths=[1.7 * inch, 5.05 * inch],
        hAlign="LEFT",
    )
    project_info.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e5e7eb")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#111827")),
        ("TEXTCOLOR", (1, 4), (1, 4), status_color),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    checks = report.get("checks", []) or []
    check_rows = [["Check", "Required", "Proposed", "Status", "Notes"]]
    for check in checks:
        check_rows.append([
            str(check.get("name", "")),
            "n/a" if check.get("required") is None else str(check.get("required")),
            "n/a" if check.get("proposed") is None else str(check.get("proposed")),
            str(check.get("status", "")).replace("_", " ").upper(),
            str(check.get("notes", "") or ""),
        ])
    checks_table = Table(
        check_rows,
        colWidths=[1.7 * inch, 0.95 * inch, 0.95 * inch, 0.85 * inch, 2.3 * inch],
        repeatRows=1,
        hAlign="LEFT",
    )
    checks_style = [
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#9ca3af")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d1d5db")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for row_idx, check in enumerate(checks, start=1):
        row_status = str(check.get("status", "")).lower()
        bg = colors.white
        fg = colors.HexColor("#111827")
        if row_status == "fail":
            bg = colors.HexColor("#fef2f2")
            fg = colors.HexColor("#991b1b")
        elif row_status == "needs_info":
            bg = colors.HexColor("#fffbeb")
            fg = colors.HexColor("#92400e")
        elif row_status == "pass":
            bg = colors.HexColor("#f0fdf4")
            fg = colors.HexColor("#166534")
        checks_style.extend([
            ("BACKGROUND", (3, row_idx), (3, row_idx), bg),
            ("TEXTCOLOR", (3, row_idx), (3, row_idx), fg),
            ("FONTNAME", (3, row_idx), (3, row_idx), "Helvetica-Bold"),
        ])
    checks_table.setStyle(TableStyle(checks_style))

    violations = report.get("violations", []) or []
    violation_rows = [["Rule", "Severity", "Description"]]
    if violations:
        for violation in violations:
            violation_rows.append([
                str(violation.get("rule", "Rule")),
                str(violation.get("severity", "info")).upper(),
                str(violation.get("description", "")),
            ])
    else:
        violation_rows.append(["None", "-", "No violations identified from configured deterministic checks."])

    violations_table = Table(
        violation_rows,
        colWidths=[1.8 * inch, 0.9 * inch, 4.0 * inch],
        repeatRows=1,
        hAlign="LEFT",
    )
    violations_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e5e7eb")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#374151")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    elements = [
        title_block,
        Spacer(1, 6),
        Paragraph("PROJECT INFORMATION", styles["SectionLabel"]),
        project_info,
        Spacer(1, 8),
        Paragraph("DIMENSIONAL COMPLIANCE CHECKS", styles["SectionLabel"]),
        checks_table,
        Spacer(1, 8),
        Paragraph("VIOLATION REGISTER", styles["SectionLabel"]),
        violations_table,
        Spacer(1, 8),
    ]

    assumptions = report.get("assumptions", []) or []
    elements.append(Paragraph("ASSUMPTIONS / DATA GAPS", styles["SectionLabel"]))
    if not assumptions:
        elements.append(Paragraph("No assumptions recorded.", styles["Normal"]))
    else:
        assumptions_table = Table(
            [[str(i + 1), str(item)] for i, item in enumerate(assumptions)],
            colWidths=[0.4 * inch, 6.35 * inch],
            hAlign="LEFT",
        )
        assumptions_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f9fafb")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(assumptions_table)

    elements.append(Spacer(1, 8))
    elements.append(Paragraph("NOTES", styles["SectionLabel"]))
    elements.append(Paragraph(
        "This is a preliminary zoning screening report generated from conversation-derived project inputs "
        "and deterministic dimensional checks. Final permit submissions may require jurisdiction-specific "
        "interpretation, survey confirmation, and licensed professional review.",
        styles["SmallMuted"],
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
