/**
 * generate_sample_test_pdf.js
 * Generates sample PDF files for testing AI Task Ingestion
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

function createSamplePDF(outputPath, title, assignee, dept, priority, overview, deliverables) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // Header styling
    doc.fillColor("#0f172a").fontSize(20).text("BLACKHOLE INFIVERSE — TASK SPECIFICATION", { align: "center" });
    doc.moveDown(0.5);
    doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown(1);

    // Task Metadata
    doc.fillColor("#1e293b").fontSize(14).text(`Task Title: ${title}`);
    doc.fontSize(11).fillColor("#475569");
    doc.text(`Assignee: ${assignee}`);
    doc.text(`Department: ${dept}`);
    doc.text(`Priority: ${priority}`);
    doc.text(`Generated Date: ${new Date().toLocaleDateString("en-GB")}`);
    doc.moveDown(1);

    // Overview section
    doc.fillColor("#0f172a").fontSize(13).text("Project Overview:", { underline: true });
    doc.moveDown(0.3);
    doc.fillColor("#334155").fontSize(11).text(overview);
    doc.moveDown(1);

    // Deliverables
    doc.fillColor("#0f172a").fontSize(13).text("Key Specifications & Deliverables:", { underline: true });
    doc.moveDown(0.3);

    deliverables.forEach((item, index) => {
      doc.fillColor("#334155").fontSize(11).text(`${index + 1}. ${item}`);
    });

    doc.moveDown(2);
    doc.fillColor("#94a3b8").fontSize(9).text("Ingestion Tag: SETU_EOS_INGESTION_TEST_PACKET_V1", { align: "right" });

    doc.end();

    stream.on("finish", () => resolve(outputPath));
    stream.on("error", (err) => reject(err));
  });
}

async function main() {
  const rootDir = path.resolve(__dirname, "../../");
  const publicDir = path.resolve(rootDir, "client/public");
  const artifactDir = "C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\9aacb794-8169-4055-92a5-4a01193a4abd";

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const pdf1Title = "AI Video Processing & Subtitle Generation Pipeline";
  const pdf1Assignee = "Rudra Parmeshwar";
  const pdf1Dept = "Web Development";
  const pdf1Priority = "High";
  const pdf1Overview = "Build and deploy an automated video processing pipeline that handles raw video upload, frame sampling, AI-driven subtitle extraction, and realtime status notifications.";
  const pdf1Deliverables = [
    "Support MP4, MOV, and WebM video formats up to 500MB upload size.",
    "Integrate background video ingest queue with task worker nodes.",
    "Extract audio stream, execute AI speech-to-text transcript generation, and save subtitles.",
    "Store task execution telemetry and notify candidate upon completion."
  ];

  const pdf2Title = "Biometric Attendance & Hourly Salary Reconciliation Engine";
  const pdf2Assignee = "Rudra Parmeshwar";
  const pdf2Dept = "Web Development";
  const pdf2Priority = "Medium";
  const pdf2Overview = "Implement real-time reconciliation logic for biometric attendance punch logs and hourly employee salary calculations across all branch offices.";
  const pdf2Deliverables = [
    "Parse daily biometric attendance CSV/PDF log files.",
    "Match employee IDs, filter out holiday hours, and handle midnight shift spans.",
    "Calculate hourly earnings with overtime rate multipliers.",
    "Generate downloadable departmental PDF progress report for management approval."
  ];

  const targets = [
    { file: path.join(rootDir, "sample_ai_task.pdf"), title: pdf1Title, assignee: pdf1Assignee, dept: pdf1Dept, priority: pdf1Priority, overview: pdf1Overview, deliv: pdf1Deliverables },
    { file: path.join(publicDir, "sample_ai_task.pdf"), title: pdf1Title, assignee: pdf1Assignee, dept: pdf1Dept, priority: pdf1Priority, overview: pdf1Overview, deliv: pdf1Deliverables },
    { file: path.join(rootDir, "sample_biometric_sync_task.pdf"), title: pdf2Title, assignee: pdf2Assignee, dept: pdf2Dept, priority: pdf2Priority, overview: pdf2Overview, deliv: pdf2Deliverables },
  ];

  if (fs.existsSync(artifactDir)) {
    targets.push({ file: path.join(artifactDir, "sample_ai_task.pdf"), title: pdf1Title, assignee: pdf1Assignee, dept: pdf1Dept, priority: pdf1Priority, overview: pdf1Overview, deliv: pdf1Deliverables });
    targets.push({ file: path.join(artifactDir, "sample_biometric_sync_task.pdf"), title: pdf2Title, assignee: pdf2Assignee, dept: pdf2Dept, priority: pdf2Priority, overview: pdf2Overview, deliv: pdf2Deliverables });
  }

  for (const t of targets) {
    await createSamplePDF(t.file, t.title, t.assignee, t.dept, t.priority, t.overview, t.deliv);
    console.log("✅ Generated PDF:", t.file);
  }

  console.log("\n🎉 All sample PDFs generated successfully!");
}

main().catch((err) => console.error("PDF generation failed:", err));
