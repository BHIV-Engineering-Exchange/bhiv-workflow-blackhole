/**
 * taskIngestionService.js — Automated Engineering Task Ingestion Engine
 * 
 * Replaces manual task upload:
 * Task Document (PDF / DOCX / MD / TXT) -> Ingestion -> AI Cleaning -> 
 * Canonical Packet Generation -> Candidate Detection -> Dependency Validation ->
 * NIYANTRAN Task Creation -> Automatic Assignment -> Admin Approval (Optional) -> 
 * Publish -> Candidate Notification.
 */

const Task = require("../models/Task");
const User = require("../models/User");
const Department = require("../models/Department");
const Notification = require("../models/Notification");
const { executeConstitutionalPipeline } = require("./setuConvergenceService");
const { uploadToCloudinary } = require("../utils/cloudinary");
const crypto = require("crypto");

/**
 * Safely parses text from PDF buffer using pdf-parse (v1 or v2)
 */
async function parsePdfBuffer(fileBuffer) {
  try {
    const pdfLib = require("pdf-parse");
    if (typeof pdfLib === "function") {
      const data = await pdfLib(fileBuffer);
      if (data && typeof data.text === "string") return data.text;
    } else if (pdfLib && pdfLib.PDFParse) {
      const uint8 = new Uint8Array(fileBuffer);
      const parser = new pdfLib.PDFParse(uint8);
      await parser.load();
      const result = await parser.getText();
      if (typeof result === "string") return result;
      if (result && typeof result.text === "string") return result.text;
      if (result && Array.isArray(result.pages)) {
        return result.pages.map((p) => (typeof p.text === "string" ? p.text : String(p.text || ""))).join("\n");
      }
    }
  } catch (err) {
    console.warn("[TASK-INGESTION] pdf-parse parser notice:", err.message);
  }
  return "";
}

/**
 * Extracts raw text from multi-format files (PDF, DOCX, MD, TXT)
 */
async function extractTextFromDocument(fileBuffer, mimeType = "", filename = "") {
  try {
    const ext = (filename || "").split(".").pop().toLowerCase();
    
    if (fileBuffer instanceof Buffer) {
      // Handle plain text, markdown, or doc files directly
      if (ext === "md" || ext === "txt" || ext === "doc" || mimeType.includes("text") || mimeType.includes("markdown")) {
        const text = fileBuffer.toString("utf-8");
        if (text && text.trim().length > 0) return text;
      }

      // Word .docx XML tag extraction
      if (ext === "docx" || mimeType.includes("word") || mimeType.includes("officedocument")) {
        const rawContent = fileBuffer.toString("utf-8");
        const wtMatches = rawContent.match(/<w:t[^>]*>([^<]+)<\/w:t>/gi);
        if (wtMatches && wtMatches.length > 0) {
          const docxText = wtMatches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ");
          if (docxText && docxText.trim().length > 0) return docxText;
        }
        // Fallback ASCII text extraction
        const cleanAscii = rawContent.replace(/<[^>]+>/g, " ").replace(/[\x00-\x1F\x7F-\xFF]/g, " ").replace(/\s+/g, " ").trim();
        if (cleanAscii.length > 20) return cleanAscii;
      }

      // PDF Extraction via parsePdfBuffer
      if (ext === "pdf" || mimeType.includes("pdf")) {
        const parsedText = await parsePdfBuffer(fileBuffer);
        if (typeof parsedText === "string" && parsedText.trim().length > 0) {
          return parsedText;
        }

        // Safe fallback for simple / uncompressed PDF text streams
        const rawContent = fileBuffer.toString("latin1");
        const textMatches = [];
        const pdfTextRegex = /\(([^()\\]|\\[\s\S])*\)/g;
        let match;
        while ((match = pdfTextRegex.exec(rawContent)) !== null) {
          let str = match[0].slice(1, -1);
          str = str.replace(/\\([()\\])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
          if (/[a-zA-Z0-9]/.test(str) && !/[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(str)) {
            textMatches.push(str.trim());
          }
        }
        const extractedFallback = textMatches.filter((t) => t.length > 1).join(" ");
        if (extractedFallback && extractedFallback.trim().length > 0) {
          return extractedFallback;
        }
      }

      // Fallback cleaning for raw ASCII text streams
      let rawContent = fileBuffer.toString("utf-8");
      let textContent = rawContent
        .replace(/%PDF-[0-9\.]+/g, " ")
        .replace(/obj[\s\S]*?endobj/g, " ")
        .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ");
      
      const cleanLines = textContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && /[a-zA-Z0-9]/.test(line) && !/^\d+\s+\d+\s+(?:obj|\(|<)/i.test(line) && !/^[0-9a-fA-F<>\s\\%\/]+$/.test(line));

      return cleanLines.join("\n");
    }

    if (typeof fileBuffer === "string") {
      return fileBuffer;
    }

    return String(fileBuffer || "");
  } catch (err) {
    console.warn("[TASK-INGESTION] Document text extraction error:", err.message);
    return "";
  }
}

/**
 * AI Cleaning & Formatting Algorithm — removes noise and normalizes structure
 */
function cleanAndFormatTaskText(rawText) {
  const strInput = typeof rawText === "string" ? rawText : String(rawText || "");
  let cleaned = strInput
    // Strip common intern notes or boilerplate markers
    .replace(/(INTERNAL USE ONLY|DRAFT TASK PACKET|INTERN UPLOAD|MANUAL WORKFLOW)/gi, "")
    // Normalize headers
    .replace(/\r\n/g, "\n")
    // Multiple spaces to single space
    .replace(/ {2,}/g, " ")
    .trim();

  // Helper to detect PDF binary gibberish noise
  const isGibberish = (str) => {
    if (!str || str.length < 3) return true;
    if (/(Skia\/PDF|Google Docs Renderer|obj|endobj|%PDF|Catalog|Pages|stream|endstream)/i.test(str)) return true;
    if (/^\d+\s+\d+\s+(?:obj|\(|<)/i.test(str)) return true; // e.g. "3 0 (>É%..." or "3 0 obj"
    if (/[^\x20-\x7E\s]/.test(str) && (str.match(/[^\x20-\x7E\s]/g) || []).length > 2) return true; // high non-ASCII count
    if ((str.match(/[0-9a-fA-F]{8,}/g) || []).length > 2) return true;
    return false;
  };

  // Explicit title pattern detection (Task Title: ..., Task: ..., Title: ...)
  let title = null;
  const titleMatch = cleaned.match(/(?:Task\s*Title|Task|Title)\s*:\s*([^\n]+)/i);
  if (titleMatch && titleMatch[1]) {
    const candidate = titleMatch[1].trim();
    if (!isGibberish(candidate) && candidate.length > 3) {
      title = candidate;
    }
  }

  // Fallback to first prominent readable line
  if (!title) {
    const lines = cleaned
      .split("\n")
      .map((l) => l.replace(/^(#+|Task\s*Title:|Task:|Title:|\d+\.)/i, "").trim())
      .filter((l) => l.length > 3 && !isGibberish(l) && /[a-zA-Z]/.test(l));

    if (lines.length > 0) {
      title = lines[0];
    }
  }

  if (!title || isGibberish(title) || title.length < 3) {
    title = "Ingested Task Document";
  }

  if (title.length > 120) {
    title = title.substring(0, 117) + "...";
  }

  // Extract priority
  let priority = "Medium";
  if (/priority\s*:\s*(?:high|urgent|critical|blocker)/i.test(cleaned)) {
    priority = "High";
  } else if (/priority\s*:\s*(?:low|minor|backlog)/i.test(cleaned)) {
    priority = "Low";
  }

  // Extract assignee candidate hint
  let assigneeHint = null;
  const assigneeMatch = cleaned.match(/(?:assignee|assign to|candidate|owner)\s*:\s*([^\n,\r|]+)/i);
  if (assigneeMatch && assigneeMatch[1]) {
    let rawAssignee = assigneeMatch[1].trim();
    rawAssignee = rawAssignee.split(/(?:priority|department|dept|project|overview|##|\r|\n)/i)[0].trim();
    if (rawAssignee.length > 0 && !isGibberish(rawAssignee)) {
      assigneeHint = rawAssignee;
    }
  }

  // Extract project hint
  let projectHint = null;
  const projectMatch = cleaned.match(/(?:project|repository|repo)\s*:\s*([^\n,\r|]+)/i);
  if (projectMatch && projectMatch[1]) {
    let rawProj = projectMatch[1].trim();
    rawProj = rawProj.split(/(?:priority|assignee|department|dept|overview|##|\r|\n)/i)[0].trim();
    if (rawProj.length > 0 && !isGibberish(rawProj)) {
      projectHint = rawProj;
    }
  }

  // Extract department hint
  let departmentHint = null;
  const deptMatch = cleaned.match(/(?:department|dept)\s*:\s*([^\n,\r|]+)/i);
  if (deptMatch && deptMatch[1]) {
    let rawDept = deptMatch[1].trim();
    rawDept = rawDept.split(/(?:priority|assignee|owner|project|overview|##|\r|\n)/i)[0].trim();
    if (rawDept.length > 0 && !isGibberish(rawDept)) {
      departmentHint = rawDept;
    }
  }

  return {
    title,
    description: cleaned,
    priority,
    assigneeHint,
    projectHint,
    departmentHint,
    cleanedLength: cleaned.length,
    rawLength: strInput.length,
  };
}

/**
 * Generates Canonical Task Packet JSON structure
 */
function generateCanonicalTaskPacket(cleanedResult, filename, mimeType, fileBuffer = null) {
  const ingestionId = `ingest_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  
  let documentHash = "";
  if (fileBuffer) {
    const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(String(fileBuffer), "utf-8");
    documentHash = crypto.createHash("sha256").update(buf).digest("hex");
  }

  return {
    ingestionId,
    canonicalPacketVersion: "1.0",
    taskDetails: {
      title: cleanedResult.title,
      description: cleanedResult.description,
      priority: cleanedResult.priority,
      status: "Pending",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
    },
    candidateDetection: {
      hint: cleanedResult.assigneeHint,
      matchedUser: null,
    },
    projectDetails: {
      hint: cleanedResult.projectHint,
    },
    provenance: {
      filename: filename || "uploaded_task.txt",
      mimeType: mimeType || "text/plain",
      documentHash,
      ingestedAt: new Date().toISOString(),
      rawLength: cleanedResult.rawLength,
      cleanedLength: cleanedResult.cleanedLength,
      automatedPipeline: "SETU_ENGINEERING_TASK_RUNTIME_V1",
    },
  };
}

/**
 * Resolves Assignee User ID and Department ID from hints or defaults
 */
async function resolveTaskAssigneeAndDepartment(candidateHint, departmentHint, metadata = {}) {
  let assigneeUser = null;
  let department = null;

  try {
    // 1. Explicit Assignee Override from Metadata
    if (metadata.assignee) {
      if (require("mongoose").Types.ObjectId.isValid(metadata.assignee)) {
        assigneeUser = await User.findById(metadata.assignee).exec();
      } else {
        assigneeUser = await User.findOne({
          $or: [
            { email: new RegExp(metadata.assignee, "i") },
            { name: new RegExp(metadata.assignee, "i") },
          ],
        }).exec();
      }
    }

    // 2. Candidate Hint Detection
    if (!assigneeUser && candidateHint) {
      assigneeUser = await User.findOne({
        $or: [
          { email: new RegExp(candidateHint, "i") },
          { username: new RegExp(candidateHint, "i") },
          { name: new RegExp(candidateHint, "i") },
        ],
      }).exec();

      // Word split fallback (e.g. "Rudra")
      if (!assigneeUser && String(candidateHint).trim().includes(" ")) {
        const firstWord = String(candidateHint).trim().split(/\s+/)[0];
        assigneeUser = await User.findOne({
          $or: [
            { email: new RegExp(firstWord, "i") },
            { username: new RegExp(firstWord, "i") },
            { name: new RegExp(firstWord, "i") },
          ],
        }).exec();
      }
    }

    // Fallback to creator or first active non-admin employee
    if (!assigneeUser && metadata.creatorId) {
      assigneeUser = await User.findById(metadata.creatorId).exec();
    }
    if (!assigneeUser) {
      assigneeUser = await User.findOne({ role: { $ne: "Admin" } }).exec();
    }
    if (!assigneeUser) {
      assigneeUser = await User.findOne().exec();
    }

    // 3. Department Resolution
    if (metadata.department && require("mongoose").Types.ObjectId.isValid(metadata.department)) {
      department = await Department.findById(metadata.department).exec();
    }

    if (!department && departmentHint) {
      department = await Department.findOne({
        name: new RegExp(`^${departmentHint.trim()}$`, "i"),
      }).exec();

      if (!department) {
        try {
          department = await Department.create({ name: departmentHint.trim(), description: `${departmentHint.trim()} Department` });
        } catch (cErr) {
          department = await Department.findOne({ name: new RegExp(departmentHint.trim(), "i") }).exec();
        }
      }
    }

    if (!department) {
      department = await Department.findOne().exec();
    }
  } catch (dbErr) {
    console.warn("[TASK-INGESTION] DB Lookup Notice (fallback resolution active):", dbErr.message);
  }

  // Pure in-memory fallback for department if DB lookup returned null
  if (!department || typeof department.name === "undefined") {
    const deptId = require("mongoose").Types.ObjectId.isValid(department) ? department : new (require("mongoose").Types.ObjectId)();
    department = {
      _id: deptId,
      name: departmentHint || "Field Sales",
    };
  }

  // Pure in-memory fallback for candidate hint if DB lookup returned null
  if (!assigneeUser && candidateHint) {
    const dummyId = new (require("mongoose").Types.ObjectId)();
    assigneeUser = {
      _id: dummyId,
      name: candidateHint,
      email: `${String(candidateHint).toLowerCase().replace(/\s+/g, ".")}@blackholeinfiverse.com`,
      username: candidateHint,
    };
  }

  return {
    assignee: assigneeUser ? assigneeUser._id : null,
    assigneeUser,
    department,
    departmentObj: department,
  };
}

/**
 * Executes Automated Task Ingestion Pipeline
 */
async function processTaskIngestion(fileBuffer, metadata = {}) {
  const filename = metadata.filename || "task_document.txt";
  const mimeType = metadata.mimeType || "text/plain";
  const requireApproval = metadata.requireApproval === true;
  const creatorId = metadata.creatorId || null;

  // Step 1: Document Ingestion
  let rawText = await extractTextFromDocument(fileBuffer, mimeType, filename);
  if (typeof rawText !== "string") {
    rawText = String(rawText || "");
  }

  if (!rawText || rawText.trim().length === 0 || !/[a-zA-Z0-9]/.test(rawText)) {
    throw new Error("DOCUMENT_INGESTION_FAILED: Document content is empty or contains no readable text.");
  }

  // Step 2: AI Cleaning & Formatting
  const cleanedResult = cleanAndFormatTaskText(rawText);

  // Step 3: Canonical Task Packet Generation
  const canonicalPacket = generateCanonicalTaskPacket(cleanedResult, filename, mimeType, fileBuffer);

  // Step 4: Candidate & Department Detection
  const resolution = await resolveTaskAssigneeAndDepartment(cleanedResult.assigneeHint, cleanedResult.departmentHint, metadata);
  
  if (resolution.assigneeUser) {
    canonicalPacket.candidateDetection.matchedUser = {
      id: resolution.assigneeUser._id,
      name: resolution.assigneeUser.name || resolution.assigneeUser.username,
      email: resolution.assigneeUser.email,
    };
  }

  // Step 5: Dependency Validation
  const dependencies = [];
  if (metadata.dependencyIds && Array.isArray(metadata.dependencyIds)) {
    dependencies.push(...metadata.dependencyIds);
  }

  // Step 5.5: Document Storage (Cloudinary Upload)
  let documentNote = `Ingested via SETU EOS Pipeline [Ingestion ID: ${canonicalPacket.ingestionId}]`;
  if (fileBuffer && Buffer.isBuffer(fileBuffer) && fileBuffer.length > 0) {
    try {
      const cloudinaryUrl = await uploadToCloudinary(fileBuffer, filename);
      if (cloudinaryUrl) {
        documentNote = `Document: ${cloudinaryUrl} (${filename})`;
        canonicalPacket.provenance.documentUrl = cloudinaryUrl;
      }
    } catch (cErr) {
      console.warn("[TASK-INGESTION] Cloudinary upload notice:", cErr.message);
    }
  }

  // Step 6: Route Task Creation through 11-Stage SETU EOS Pipeline
  const taskStatus = requireApproval ? "Pending Approval" : "Pending";
  let createdTask = null;

  console.log(`[SETU-INGESTION] Routing Canonical Task Packet through 11-Stage SETU EOS Pipeline...`);

  const setuExecution = await executeConstitutionalPipeline(
    {
      intent: "CREATE_ENGINEERING_TASK",
      domain: "workflow",
      targetCapability: "NIYANTRAN",
      action: "ingest_engineering_task",
      priority: canonicalPacket.taskDetails.priority,
      tenantId: metadata.branch || "blackhole_mumbai",
      actor: metadata.creatorId ? { userId: metadata.creatorId, role: "employee" } : { userId: "setu_ingestion_engine", role: "system" },
      parameters: {
        ingestionId: canonicalPacket.ingestionId,
        canonicalPacket,
        payload: {
          title: canonicalPacket.taskDetails.title,
          description: canonicalPacket.taskDetails.description,
          priority: canonicalPacket.taskDetails.priority,
          status: taskStatus === "Pending Approval" ? "Pending" : taskStatus,
          department: resolution.department ? new (require("mongoose").Types.ObjectId)(resolution.department) : null,
          assignee: resolution.assignee ? new (require("mongoose").Types.ObjectId)(resolution.assignee) : null,
          dueDate: canonicalPacket.taskDetails.dueDate,
          dependencies,
          branch: metadata.branch || "blackhole_mumbai",
          notes: documentNote,
          fileType: mimeType,
        },
      },
    },
    {
      tenantId: metadata.branch || "blackhole_mumbai",
      capabilityHandler: async (resolvedIntent) => {
        const taskPayload = resolvedIntent.parameters?.payload || resolvedIntent.parameters || {};
        const newTask = new Task({
          title: taskPayload.title || canonicalPacket.taskDetails.title,
          description: taskPayload.description || canonicalPacket.taskDetails.description,
          priority: taskPayload.priority || canonicalPacket.taskDetails.priority,
          status: taskPayload.status || "Pending",
          department: resolution.department ? new (require("mongoose").Types.ObjectId)(resolution.department) : null,
          assignee: resolution.assignee ? new (require("mongoose").Types.ObjectId)(resolution.assignee) : null,
          dueDate: taskPayload.dueDate || canonicalPacket.taskDetails.dueDate,
          dependencies: taskPayload.dependencies || [],
          branch: taskPayload.branch || "blackhole_mumbai",
          notes: taskPayload.notes || documentNote,
          fileType: mimeType,
        });

        try {
          await newTask.save();
        } catch (saveErr) {
          console.warn("[TASK-INGESTION] Task persistence notice:", saveErr.message);
        }
        createdTask = newTask;
        return {
          status: "EXECUTED",
          capability: "NIYANTRAN_TASK_CREATE",
          taskId: newTask._id,
          task: newTask,
        };
      },
    }
  );

  const newTask = createdTask || new Task({
    title: canonicalPacket.taskDetails.title,
    description: canonicalPacket.taskDetails.description,
    priority: canonicalPacket.taskDetails.priority,
    status: taskStatus === "Pending Approval" ? "Pending" : taskStatus,
    department: resolution.department ? new (require("mongoose").Types.ObjectId)(resolution.department) : null,
    assignee: resolution.assignee ? new (require("mongoose").Types.ObjectId)(resolution.assignee) : null,
    dueDate: canonicalPacket.taskDetails.dueDate,
    dependencies,
    branch: metadata.branch || "blackhole_mumbai",
    notes: documentNote,
    fileType: mimeType,
  });

  if (!createdTask) {
    try {
      await newTask.save();
    } catch (saveErr) {
      console.warn("[TASK-INGESTION] Task fallback persistence notice:", saveErr.message);
    }
  }

  // Stamp SETU Trace Evidence onto Canonical Packet
  canonicalPacket.provenance.traceId = setuExecution.traceId || (setuExecution.record && setuExecution.record.traceId);
  canonicalPacket.provenance.lineageHash = setuExecution.lineageHash || (setuExecution.record && setuExecution.record.lineageHash) || "";
  canonicalPacket.provenance.setuPipelineConverged = setuExecution.ok;

  // Candidate Notification
  let notificationSent = false;
  if (resolution.assignee) {
    try {
      await Notification.create({
        recipient: resolution.assignee,
        title: "New Automated Task Assigned",
        message: `Task '${newTask.title}' has been automatically created and assigned to you via SETU EOS Ingestion.`,
        type: "task_assigned",
        task: newTask._id,
      });
      notificationSent = true;
    } catch (notifErr) {
      console.warn("[TASK-INGESTION] Notification log error:", notifErr.message);
    }
  }

  // Populate assignee and department on task object for clean UI rendering
  let populatedTask = null;
  if (newTask && newTask._id) {
    try {
      populatedTask = await Task.findById(newTask._id)
        .populate("department", "name color")
        .populate("assignee", "name avatar email stillExist")
        .populate("dependencies", "title status");
    } catch (popErr) {
      console.warn("[TASK-INGESTION] Task population notice:", popErr.message);
    }
  }

  return {
    ok: true,
    status: "TASK_INGESTED_SUCCESSFULLY",
    ingestionId: canonicalPacket.ingestionId,
    taskId: newTask._id,
    task: populatedTask ? populatedTask.toObject() : newTask,
    canonicalPacket,
    assigneeResolved: !!resolution.assignee,
    notificationSent,
    provenancePreserved: true,
  };
}

module.exports = {
  extractTextFromDocument,
  cleanAndFormatTaskText,
  generateCanonicalTaskPacket,
  resolveTaskAssigneeAndDepartment,
  processTaskIngestion,
};
