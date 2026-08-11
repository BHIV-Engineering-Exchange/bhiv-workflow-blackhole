/**
 * taskIngestion.js — Automated Engineering Task Ingestion API Routes
 */

const express = require("express");
const multer = require("multer");
const router = express.Router();
const { processTaskIngestion } = require("../services/taskIngestionService");
const Task = require("../models/Task");
const Notification = require("../models/Notification");

// Multer memory storage configuration for document upload processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tasks/ingest/supported-formats
// Lists supported file upload formats and ingestion capabilities
// ─────────────────────────────────────────────────────────────────────────────
router.get("/supported-formats", (req, res) => {
  return res.json({
    ok: true,
    supportedFormats: [
      { format: "PDF", extension: ".pdf", mimeType: "application/pdf" },
      { format: "DOCX", extension: ".docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      { format: "Markdown", extension: ".md", mimeType: "text/markdown" },
      { format: "Plain Text", extension: ".txt", mimeType: "text/plain" },
    ],
    features: [
      "AI Cleaning & Noise Reduction",
      "Canonical Task Packet Generation",
      "Automatic Candidate Detection & Assignee Matching",
      "Dependency Validation",
      "Automated NIYANTRAN Task Creation",
      "Candidate Notification",
      "Provenance Preservation",
    ],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks/ingest
// File upload document ingestion endpoint (PDF, DOCX, MD, TXT)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", upload.single("taskFile"), async (req, res) => {
  try {
    let fileBuffer;
    let filename = "task_packet.txt";
    let mimeType = "text/plain";

    if (req.file) {
      fileBuffer = req.file.buffer;
      filename = req.file.originalname;
      mimeType = req.file.mimetype;
    } else if (req.body.taskText || req.body.content) {
      fileBuffer = Buffer.from(req.body.taskText || req.body.content, "utf-8");
      filename = req.body.filename || "pasted_task_packet.md";
      mimeType = req.body.mimeType || "text/markdown";
    } else {
      return res.status(400).json({
        ok: false,
        error: "NO_DOCUMENT_PROVIDED",
        message: "Please attach a task document file (PDF/DOCX/MD/TXT) or provide taskText in body.",
      });
    }

    const metadata = {
      filename,
      mimeType,
      requireApproval: req.body.requireApproval === "true" || req.body.requireApproval === true,
      branch: req.headers["x-branch"] || req.body.branch || "blackhole_mumbai",
      creatorId: req.user ? req.user._id : null,
    };

    const result = await processTaskIngestion(fileBuffer, metadata);

    return res.json(result);
  } catch (error) {
    console.error("[TASK-INGESTION-ROUTE] Failed:", error);
    return res.status(500).json({
      ok: false,
      error: "INGESTION_PROCESSING_FAILED",
      message: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks/ingest/approve/:taskId
// Optional administrative approval route before task publishing
// ─────────────────────────────────────────────────────────────────────────────
router.post("/approve/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        ok: false,
        error: "TASK_NOT_FOUND",
        message: `Task ${taskId} not found.`,
      });
    }

    task.status = "Pending"; // Published to candidate
    task.notes = (task.notes || "") + `\nApproved by Administrator at ${new Date().toISOString()}`;
    await task.save();

    // Trigger candidate notification upon publish
    if (task.assignee) {
      await Notification.create({
        user: task.assignee,
        title: "Task Approved & Published",
        message: `Task '${task.title}' has been approved by admin and published for execution.`,
        type: "Task Assignment",
        relatedId: task._id,
      });
    }

    return res.json({
      ok: true,
      status: "TASK_APPROVED_AND_PUBLISHED",
      taskId: task._id,
      task,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "APPROVAL_FAILED",
      message: error.message,
    });
  }
});

module.exports = router;
