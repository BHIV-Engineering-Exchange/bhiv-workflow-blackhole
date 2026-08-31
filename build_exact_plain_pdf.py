import sys
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf(filename="AI_TASK_INGESTION_CERTIFICATION_TASK.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=60,
        rightMargin=60,
        topMargin=60,
        bottomMargin=60
    )

    styles = getSampleStyleSheet()

    # Exact plain black & white typography with zero boxes
    heading_style = ParagraphStyle(
        'ExactHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=16,
        textColor=colors.black,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    meta_key_style = ParagraphStyle(
        'MetaKey',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=15,
        textColor=colors.black
    )

    meta_val_style = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=colors.black
    )

    body_style = ParagraphStyle(
        'ExactBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=colors.black,
        spaceAfter=10
    )

    bullet_style = ParagraphStyle(
        'ExactBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=colors.black,
        leftIndent=0,
        spaceAfter=4
    )

    diagram_style = ParagraphStyle(
        'ExactDiagram',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=16,
        textColor=colors.black,
        leftIndent=0,
        spaceBefore=6,
        spaceAfter=6
    )

    story = []

    def add_divider():
        story.append(Spacer(1, 4))
        story.append(HRFlowable(width="18%", thickness=1, color=colors.black, hAlign='LEFT', spaceAfter=14))

    # Header Metadata Lines (No box, no borders)
    story.append(Paragraph("<b>Task Title:</b> AI Task Ingestion Service & TANTRA Runtime Convergence Certification", meta_val_style))
    story.append(Paragraph("<b>Department:</b> Web Development", meta_val_style))
    story.append(Paragraph("<b>Assignee Candidate:</b> Rudra Parmeshwar", meta_val_style))
    story.append(Paragraph("<b>Priority:</b> High", meta_val_style))
    story.append(Paragraph("<b>Target Date:</b> 2026-08-30", meta_val_style))
    add_divider()

    # Overview & Description
    story.append(Paragraph("Overview & Description", heading_style))
    story.append(Paragraph(
        "Develop and certify the AI Task Ingestion Service and validate that all independently developed BHIV services "
        "converge into a single deterministic TANTRA runtime. The task engine must process user document uploads (PDF, DOCX, TXT, MD), "
        "execute automated metadata extraction for candidate Rudra Parmeshwar, route candidate tasks within the Web Development department, "
        "and certify service orchestration, runtime contracts, constitutional boundaries, observability, replayability, and production readiness.",
        body_style
    ))
    add_divider()

    # Mission
    story.append(Paragraph("Mission", heading_style))
    story.append(Paragraph(
        "Certify that all independently developed BHIV services converge into a single deterministic TANTRA runtime by validating service orchestration, AI task ingestion (PDF, DOCX, TXT, MD document parsing), runtime contracts, constitutional boundaries, observability, replayability, and production readiness.",
        body_style
    ))
    story.append(Paragraph(
        "Rudra does not build business features. He certifies that every constitutional owner has integrated correctly.",
        body_style
    ))
    add_divider()

    # Phase 1
    story.append(Paragraph("Phase 1 – Runtime Service Convergence", heading_style))
    story.append(Paragraph("Validate orchestration between:", body_style))
    story.append(Paragraph("* NIYANTRAN", bullet_style))
    story.append(Paragraph("* PARIKSHAK", bullet_style))
    story.append(Paragraph("* MasterDB", bullet_style))
    story.append(Paragraph("* MDU", bullet_style))
    story.append(Paragraph("* Bucket", bullet_style))
    story.append(Paragraph("* InsightFlow", bullet_style))
    story.append(Paragraph("* TANTRA Runtime", bullet_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Ensure every service communicates only through approved APIs and runtime contracts.", body_style))
    add_divider()

    # Phase 2
    story.append(Paragraph("Phase 2 – Runtime Contract Certification", heading_style))

    story.append(PageBreak())

    # Page 2
    story.append(Paragraph("Validate:", body_style))
    story.append(Paragraph("* Multi-Format Ingestion (PDF, DOCX, TXT, MD document parsing)", bullet_style))
    story.append(Paragraph("* Automated Metadata Extraction & Candidate Routing", bullet_style))
    story.append(Paragraph("* API compatibility", bullet_style))
    story.append(Paragraph("* Authentication", bullet_style))
    story.append(Paragraph("* Trace IDs (x-trace-id)", bullet_style))
    story.append(Paragraph("* Version compatibility", bullet_style))
    story.append(Paragraph("* Error propagation", bullet_style))
    story.append(Paragraph("* Retry behaviour", bullet_style))
    story.append(Paragraph("* Deterministic execution & SHA-256 hashing", bullet_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("No service may bypass another service's published contract.", body_style))
    add_divider()

    # Phase 3
    story.append(Paragraph("Phase 3 – Constitutional Ownership Validation", heading_style))
    story.append(Paragraph("Verify:", body_style))
    story.append(Paragraph("* No duplicated task parsing logic", bullet_style))
    story.append(Paragraph("* No ownership drift", bullet_style))
    story.append(Paragraph("* No unauthorized database ownership", bullet_style))
    story.append(Paragraph("* No direct cross-service writes", bullet_style))
    story.append(Paragraph("* No constitutional violations", bullet_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Produce a Responsibility Matrix showing each service's constitutional role.", body_style))
    add_divider()

    # Phase 4
    story.append(Paragraph("Phase 4 – End-to-End Runtime Certification", heading_style))
    story.append(Paragraph("Validate the complete runtime:", body_style))
    story.append(Paragraph("Task Submission (PDF / DOCX / TXT / MD)<br/>↓<br/>NIYANTRAN<br/>↓<br/>PARIKSHAK<br/>↓<br/>MasterDB<br/>↓<br/>NIYANTRAN", diagram_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Verify only that each handoff succeeds and contracts are honored. Do not re-test individual feature implementations owned by Ishan or Pritesh.",
        body_style
    ))
    add_divider()

    # Phase 5
    story.append(Paragraph("Phase 5 – Runtime Observability & Replay", heading_style))
    story.append(Paragraph("Validate:", body_style))
    story.append(Paragraph("* Trace IDs", bullet_style))
    story.append(Paragraph("* Runtime logging", bullet_style))
    story.append(Paragraph("* Replay support", bullet_style))
    story.append(Paragraph("* Observability", bullet_style))
    story.append(Paragraph("* Failure visibility", bullet_style))
    story.append(Paragraph("* Audit trail", bullet_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Every execution must be fully traceable.", body_style))

    story.append(PageBreak())

    # Page 3
    add_divider()
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
    story.append(Spacer(1, 6))

    story.append(Paragraph("This keeps the ownership perfectly clean:", body_style))
    story.append(Paragraph("* Ishan builds the review runtime.", bullet_style))
    story.append(Paragraph("* Pritesh builds the NIYANTRAN runtime and PRANA/KARMA integration.", bullet_style))
    story.append(Paragraph("* KAVYA owns MasterDB.", bullet_style))
    story.append(Paragraph("* Nupur owns MDU.", bullet_style))
    story.append(Paragraph("* Rudra certifies that all of them function together as a single TANTRA runtime without taking ownership of their implementations.", bullet_style))
    story.append(Paragraph("* Alay deploys the certified converged runtime to production.", bullet_style))

    doc.build(story)
    print(f"Successfully generated {filename}")

if __name__ == "__main__":
    generate_pdf()
