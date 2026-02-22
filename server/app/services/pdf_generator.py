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


def _pdf_escape(text: str) -> str:
    return (
        str(text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


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
    styles.add(ParagraphStyle(
        name="TableCellWrap",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=10,
        wordWrap="CJK",
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
            Paragraph(_pdf_escape(str(check.get("name", ""))), styles["TableCellWrap"]),
            "n/a" if check.get("required") is None else str(check.get("required")),
            "n/a" if check.get("proposed") is None else str(check.get("proposed")),
            str(check.get("status", "")).replace("_", " ").upper(),
            Paragraph(_pdf_escape(str(check.get("notes", "") or "")), styles["TableCellWrap"]),
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
                Paragraph(_pdf_escape(str(violation.get("description", ""))), styles["TableCellWrap"]),
            ])
    else:
        violation_rows.append([
            "None",
            "-",
            Paragraph(
                _pdf_escape("No violations identified from configured deterministic checks."),
                styles["TableCellWrap"],
            ),
        ])

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


def generate_technical_info_report_pdf(report: dict, project_name: str = "Project") -> bytes:
    """Render a polished whole-home technical information report PDF."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.65 * inch,
        bottomMargin=0.65 * inch,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="TechSmallMuted",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=colors.HexColor("#5b6473"),
        leading=11,
    ))
    styles.add(ParagraphStyle(
        name="TechSection",
        parent=styles["Heading3"],
        fontSize=10,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=6,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="TechBody",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#111827"),
    ))
    styles.add(ParagraphStyle(
        name="TechWrap",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=10.5,
        textColor=colors.HexColor("#111827"),
        wordWrap="CJK",
        splitLongWords=1,
    ))
    styles.add(ParagraphStyle(
        name="TechTableLabel",
        parent=styles["TechWrap"],
        fontName="Helvetica-Bold",
    ))

    meta = report.get("meta", {}) or {}
    extracted = report.get("extractedInputs", {}) or {}
    site = extracted.get("site", {}) if isinstance(extracted.get("site"), dict) else {}
    program = extracted.get("buildingProgram", {}) if isinstance(extracted.get("buildingProgram"), dict) else {}

    issue_date = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    report_no = "TECH-%s" % datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    missing_questions = report.get("missingQuestions", []) or []
    notes = report.get("notes", []) or []
    chat_stats = meta.get("chatStats", {}) or {}
    status = "Ready" if not missing_questions else "Needs Info"
    status_color = colors.HexColor("#166534") if not missing_questions else colors.HexColor("#92400e")
    status_bg = colors.HexColor("#ecfdf5") if not missing_questions else colors.HexColor("#fffbeb")
    content_width = doc.width
    two_col_width = (content_width - 6) / 2.0

    title_block = Table(
        [[
            Paragraph(
                "<b>AI ARCHITECT STUDIO</b><br/>Whole-Home Technical Information Report",
                styles["Heading2"],
            ),
            Paragraph(
                "<b>Report No.</b> %s<br/><b>Issue Date</b> %s<br/><b>Project</b> %s"
                % (report_no, issue_date, _pdf_escape(project_name or "Project")),
                styles["TechSmallMuted"],
            ),
        ]],
        colWidths=[content_width * 0.69, content_width * 0.31],
    )
    title_block.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#0f172a")),
        ("LINEBEFORE", (1, 0), (1, 0), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    summary_cards = Table(
        [[
            Paragraph(
                "<b>Status</b><br/><font color='%s'>%s</font>" % (
                    "#166534" if not missing_questions else "#92400e",
                    _pdf_escape(status),
                ),
                styles["TechBody"],
            ),
            Paragraph(
                "<b>Messages Reviewed</b><br/>%s total / %s user" % (
                    chat_stats.get("messageCount", 0),
                    chat_stats.get("userMessageCount", 0),
                ),
                styles["TechBody"],
            ),
            Paragraph(
                "<b>Open Questions</b><br/>%s" % len(missing_questions),
                styles["TechBody"],
            ),
        ]],
        colWidths=[content_width * 0.34, content_width * 0.34, content_width * 0.32],
        hAlign="LEFT",
    )
    summary_cards.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, 0), (0, 0), status_bg),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))

    def _pdf_wrap_text(value) -> str:
        text = "Not provided" if value in (None, "") else str(value)
        return _pdf_escape(text).replace("\n", "<br/>")

    def _tech_cell(value, style_name="TechWrap"):
        return Paragraph(_pdf_wrap_text(value), styles[style_name])

    project_overview_rows = [
        [_tech_cell("Project Intent", "TechTableLabel"), _tech_cell(extracted.get("projectIntent"))],
        [_tech_cell("Address", "TechTableLabel"), _tech_cell(site.get("address"))],
        [_tech_cell("Parcel ID", "TechTableLabel"), _tech_cell(site.get("parcelId"))],
        [_tech_cell("Zoning District", "TechTableLabel"), _tech_cell(site.get("zoningDistrict"))],
        [_tech_cell("Lot Area (sq ft)", "TechTableLabel"), _tech_cell(site.get("lotAreaSqFt"))],
    ]
    project_overview_label_w = 2.0 * inch
    project_overview = Table(
        project_overview_rows,
        colWidths=[project_overview_label_w, content_width - project_overview_label_w],
        hAlign="LEFT",
    )
    project_overview.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e5e7eb")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    program_rows = [
        ["Stories", program.get("stories")],
        ["Bedrooms", program.get("bedrooms")],
        ["Bathrooms", program.get("bathrooms")],
        ["Garage Spaces", program.get("garageSpaces")],
        ["Conditioned Area (sq ft)", program.get("conditionedAreaSqFt")],
        ["Footprint Area (sq ft)", program.get("footprintAreaSqFt")],
        ["Height (ft)", program.get("heightFt")],
    ]
    program_table = Table(
        [[_tech_cell(label, "TechTableLabel"), _tech_cell(value)] for label, value in program_rows],
        colWidths=[2.0 * inch, 1.25 * inch],
        hAlign="LEFT",
    )
    program_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e5e7eb")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    def _bullet_section(title: str, items: List[str], empty_text: str, width: float):
        rows = [[Paragraph("<b>%s</b>" % _pdf_escape(title), styles["TechBody"])]]
        if items:
            for item in items:
                rows.append([Paragraph("&bull; %s" % _pdf_wrap_text(item), styles["TechWrap"])])
        else:
            rows.append([Paragraph(_pdf_escape(empty_text), styles["TechSmallMuted"])])
        table = Table(rows, colWidths=[width], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#f8fafc")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return table

    technical_columns = Table(
        [[
            _bullet_section(
                "Design Preferences",
                extracted.get("designPreferences") if isinstance(extracted.get("designPreferences"), list) else [],
                "No design preferences extracted.",
                two_col_width,
            ),
            _bullet_section(
                "Materials & Envelope",
                extracted.get("materialsAndEnvelope") if isinstance(extracted.get("materialsAndEnvelope"), list) else [],
                "No materials/envelope notes extracted.",
                two_col_width,
            ),
        ]],
        colWidths=[two_col_width, two_col_width],
        hAlign="LEFT",
    )
    technical_columns.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    systems_constraints = Table(
        [[
            _bullet_section(
                "Systems",
                extracted.get("systems") if isinstance(extracted.get("systems"), list) else [],
                "No systems details extracted.",
                two_col_width,
            ),
            _bullet_section(
                "Constraints",
                extracted.get("constraints") if isinstance(extracted.get("constraints"), list) else [],
                "No constraints extracted.",
                two_col_width,
            ),
        ]],
        colWidths=[two_col_width, two_col_width],
        hAlign="LEFT",
    )
    systems_constraints.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    missing_table = _bullet_section(
        "Open Questions",
        [str(item) for item in missing_questions],
        "No missing questions. The extracted technical info appears complete for this preliminary package.",
        content_width,
    )
    notes_table = _bullet_section(
        "Extractor Notes",
        [str(item) for item in notes],
        "No extractor notes.",
        content_width,
    )
    assumptions_table = _bullet_section(
        "Assumptions Mentioned",
        [str(item) for item in (extracted.get("assumptionsMentioned") or [])] if isinstance(extracted.get("assumptionsMentioned"), list) else [],
        "No assumptions explicitly mentioned in the conversation.",
        content_width,
    )

    highlights = report.get("conversationHighlights", []) or []
    highlight_rows = [[Paragraph("<b>Conversation Highlights</b>", styles["TechBody"])]]
    if highlights:
        for item in highlights:
            role = _pdf_escape(str(item.get("roleLabel") or "User"))
            content = _pdf_wrap_text(item.get("content") or "")
            highlight_rows.append([Paragraph("<b>%s:</b> %s" % (role, content), styles["TechWrap"])])
    else:
        highlight_rows.append([Paragraph("No highlights available.", styles["TechSmallMuted"])])
    highlights_table = Table(highlight_rows, colWidths=[content_width], hAlign="LEFT")
    highlights_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#eff6ff")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    elements = [
        title_block,
        Spacer(1, 8),
        summary_cards,
        Spacer(1, 8),
        Paragraph("PROJECT OVERVIEW", styles["TechSection"]),
        project_overview,
        Spacer(1, 8),
        Paragraph("BUILDING PROGRAM", styles["TechSection"]),
        program_table,
        Spacer(1, 8),
        Paragraph("PREFERENCES & ENVELOPE", styles["TechSection"]),
        technical_columns,
        Spacer(1, 8),
        Paragraph("SYSTEMS & CONSTRAINTS", styles["TechSection"]),
        systems_constraints,
        Spacer(1, 8),
        missing_table,
        Spacer(1, 8),
        assumptions_table,
        Spacer(1, 8),
        notes_table,
        Spacer(1, 8),
        highlights_table,
        Spacer(1, 8),
        Paragraph(
            "This report summarizes whole-home technical information captured from the dedicated Archvision technical "
            "chat and Gemini-assisted extraction. It is intended for early coordination and scoping, not final permit or "
            "construction documents.",
            styles["TechSmallMuted"],
        ),
    ]

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
