import sys
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether, HRFlowable, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf(filename="AI_TASK_INGESTION_CERTIFICATION_TASK.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Clean, professional typography
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=6
    )

    heading_style = ParagraphStyle(
        'MainHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'MainBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#1E293B"),
        leftIndent=12,
        spaceAfter=3
    )

    diagram_style = ParagraphStyle(
        'DiagramStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=15,
        textColor=colors.HexColor("#0F172A"),
        leftIndent=20,
        spaceBefore=6,
        spaceAfter=6
    )

    table_hdr = ParagraphStyle('TH', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.white)
    table_cell = ParagraphStyle('TC', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11, textColor=colors.HexColor("#1E293B"))
    table_cell_bold = ParagraphStyle('TCB', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=11, textColor=colors.HexColor("#0F172A"))

    story = []

    def add_divider():
        story.append(Spacer(1, 2))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))

    # Header Title
    story.append(Paragraph("ENGINEERING TASK SPECIFICATION PACKET", title_style))
    story.append(Spacer(1, 4))

    # Key Metadata Table (Title, Department, Assignee, Priority, Target Date)
    meta_table_data = [
        [Paragraph("Task Title", table_hdr), Paragraph("Department", table_hdr), Paragraph("Assignee Candidate", table_hdr), Paragraph("Priority", table_hdr), Paragraph("Target Date", table_hdr)],
        [
            Paragraph("AI Task Ingestion Service & TANTRA Convergence Certification", table_cell_bold),
            Paragraph("Web Development", table_cell),
            Paragraph("Rudra Parmeshwar", table_cell_bold),
            Paragraph("High", table_cell_bold),
            Paragraph("2026-08-30", table_cell)
        ]
    ]
    t_meta = Table(meta_table_data, colWidths=[2.6*inch, 1.2*inch, 1.4*inch, 0.8*inch, 1.0*inch])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 8))

    # Overview & Description
    story.append(Paragraph("Overview & Description", heading_style))
    story.append(Paragraph(
        "Develop and optimize the <b>AI Task Ingestion Service</b> within the Web Development department. "
        "The task engine must process user document uploads (PDF, DOCX, TXT, MD), execute automated metadata extraction for candidate Rudra Parmeshwar, "
        "and certify that all independently developed BHIV services converge into a single deterministic TANTRA runtime by validating service orchestration, "
        "runtime contracts, constitutional boundaries, observability, replayability, and production readiness.",
        body_style
    ))
    add_divider()

    # Mission
    story.append(Paragraph("Mission", heading_style))
    story.append(Paragraph(
        "Certify that all independently developed BHIV services converge into a single deterministic TANTRA runtime by validating service orchestration, "
        "AI task ingestion (PDF, DOCX, TXT, MD document parsing), runtime contracts, constitutional boundaries, observability, replayability, and production readiness.",
        body_style
    ))
    story.append(Paragraph(
        "Rudra does not build business features. He certifies that every constitutional owner has integrated correctly.",
        body_style
    ))
    add_divider()

    # Phase 1 – Runtime Service Ingestion & Convergence
    story.append(Paragraph("Phase 1 – Runtime Service Ingestion & Convergence", heading_style))
    story.append(Paragraph("Validate orchestration between:", body_style))
    story.append(Paragraph("* NIYANTRAN Task Lifecycle Engine", bullet_style))
    story.append(Paragraph("* PARIKSHAK Quality Evaluator", bullet_style))
    story.append(Paragraph("* MasterDB Ledger", bullet_style))
    story.append(Paragraph("* MDU Diagnostic Unit", bullet_style))
    story.append(Paragraph("* InsightFlow Telemetry Stream", bullet_style))
    story.append(Paragraph("* TANTRA Ingestion Runtime", bullet_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("Ensure every service communicates only through approved APIs and runtime contracts.", body_style))
    add_divider()

    # Phase 2 – Task Ingestion Contract Certification
    story.append(Paragraph("Phase 2 – Task Ingestion Contract Certification", heading_style))
    story.append(Paragraph("Validate:", body_style))
    story.append(Paragraph("* Multi-Format Ingestion (PDF, DOCX, TXT, MD document parsing)", bullet_style))
    story.append(Paragraph("* Automated Metadata Extraction & Candidate Routing", bullet_style))
    story.append(Paragraph("* API compatibility", bullet_style))
    story.append(Paragraph("* Authentication", bullet_style))
    story.append(Paragraph("* Trace IDs", bullet_style))
    story.append(Paragraph("* Version compatibility", bullet_style))
    story.append(Paragraph("* Error propagation", bullet_style))
    story.append(Paragraph("* Retry behaviour", bullet_style))
    story.append(Paragraph("* Deterministic execution", bullet_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("No service may bypass another service's published contract.", body_style))
    add_divider()

    # Phase 3 – Constitutional Ownership Validation
    story.append(Paragraph("Phase 3 – Constitutional Ownership Validation", heading_style))
    story.append(Paragraph("Verify:", body_style))
    story.append(Paragraph("* No duplicated task parsing logic", bullet_style))
    story.append(Paragraph("* No ownership drift", bullet_style))
    story.append(Paragraph("* No unauthorized database ownership", bullet_style))
    story.append(Paragraph("* No direct cross-service writes", bullet_style))
    story.append(Paragraph("* No constitutional violations", bullet_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("Produce a Responsibility Matrix showing each service's constitutional role.", body_style))

    story.append(PageBreak())

    # Phase 4 – End-to-End Runtime Certification
    story.append(Paragraph("Phase 4 – End-to-End Runtime Certification", heading_style))
    story.append(Paragraph("Validate the complete runtime handoff flow:", body_style))
    
    story.append(Paragraph("Task Submission (PDF / DOCX / TXT / MD)<br/>↓<br/>NIYANTRAN (Ingestion & Schema Validation)<br/>↓<br/>PARIKSHAK (AI Code Review)<br/>↓<br/>MasterDB (Persistence Ledger)<br/>↓<br/>NIYANTRAN", diagram_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Verify only that each handoff succeeds and contracts are honored. Do not re-test individual feature implementations owned by Ishan or Pritesh.",
        body_style
    ))
    add_divider()

    # Phase 5 – Runtime Observability & Replay
    story.append(Paragraph("Phase 5 – Runtime Observability & Replay", heading_style))
    story.append(Paragraph("Validate:", body_style))
    story.append(Paragraph("* Trace IDs", bullet_style))
    story.append(Paragraph("* Runtime ingestion logging", bullet_style))
    story.append(Paragraph("* Replay support", bullet_style))
    story.append(Paragraph("* Observability", bullet_style))
    story.append(Paragraph("* Failure visibility", bullet_style))
    story.append(Paragraph("* Audit trail", bullet_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("Every execution must be fully traceable.", body_style))
    add_divider()

    # Phase 6 – Production Certification
    story.append(Paragraph("Phase 6 – Production Certification", heading_style))
    story.append(Paragraph("Issue a final Runtime Convergence Certificate confirming:", body_style))
    story.append(Paragraph("* Runtime contracts verified", bullet_style))
    story.append(Paragraph("* Service boundaries respected", bullet_style))
    story.append(Paragraph("* Constitutional ownership maintained", bullet_style))
    story.append(Paragraph("* No architectural drift", bullet_style))
    story.append(Paragraph("* Production deployment approved", bullet_style))
    add_divider()

    # Final Deliverable
    story.append(Paragraph("Final Deliverable", heading_style))
    story.append(Paragraph("The primary artifact should be a TANTRA Runtime Convergence Certification Report, containing:", body_style))
    story.append(Paragraph("* Runtime Dependency Matrix", bullet_style))
    story.append(Paragraph("* Service Responsibility Matrix", bullet_style))
    story.append(Paragraph("* Runtime Contract Validation", bullet_style))
    story.append(Paragraph("* Architecture Drift Analysis", bullet_style))
    story.append(Paragraph("* Integration Gap Report", bullet_style))
    story.append(Paragraph("* Production Readiness Certification", bullet_style))
    story.append(Paragraph("* Deployment Recommendation to Alay", bullet_style))
    story.append(Spacer(1, 4))

    story.append(Paragraph("This keeps the ownership perfectly clean:", body_style))
    story.append(Paragraph("* Ishan builds the review runtime.", bullet_style))
    story.append(Paragraph("* Pritesh builds the NIYANTRAN runtime and task ingestion parser engine.", bullet_style))
    story.append(Paragraph("* KAVYA owns MasterDB.", bullet_style))
    story.append(Paragraph("* Nupur owns MDU.", bullet_style))
    story.append(Paragraph("* Rudra certifies that all of them function together as a single TANTRA runtime without taking ownership of their implementations.", bullet_style))
    story.append(Paragraph("* Alay deploys the certified converged runtime to production.", bullet_style))

    doc.build(story)
    print(f"Successfully generated {filename}")

if __name__ == "__main__":
    generate_pdf()
