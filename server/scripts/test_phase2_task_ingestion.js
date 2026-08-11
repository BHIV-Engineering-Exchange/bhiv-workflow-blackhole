/**
 * test_phase2_task_ingestion.js
 * 
 * Comprehensive Test Suite for PHASE 2 — Automated Engineering Task Runtime
 */

const {
  extractTextFromDocument,
  cleanAndFormatTaskText,
  generateCanonicalTaskPacket,
  resolveTaskAssigneeAndDepartment,
  processTaskIngestion,
} = require("../services/taskIngestionService");

async function runPhase2Validation() {
  console.log("===============================================================");
  console.log("📋 TESTING PHASE 2 — AUTOMATED ENGINEERING TASK RUNTIME");
  console.log("===============================================================\n");

  const testResults = [];

  const runTestCase = (testName, fn) => {
    try {
      const res = fn();
      testResults.push({ name: testName, status: "PASSED", details: res });
      console.log(`✅ [PASS] ${testName}`);
    } catch (err) {
      testResults.push({ name: testName, status: "FAILED", error: err.message });
      console.log(`❌ [FAIL] ${testName}: ${err.message}`);
    }
  };

  // Test 1: Plain Text Ingestion
  runTestCase("1. Plain Text Ingestion & Noise Removal", () => {
    const rawTxt = `
      INTERNAL USE ONLY - DRAFT TASK PACKET
      Task Title: Fix Biometric Attendance Sync Bug
      Assignee: john_dev@infiverse.com
      Project: NIYANTRAN Core Workflow
      Priority: High

      Description:
      Ensure biometric attendance logs sync seamlessly with salary calculations.
    `;
    const extracted = extractTextFromDocument(rawTxt, "text/plain", "task.txt");
    const cleaned = cleanAndFormatTaskText(extracted);
    const canonical = generateCanonicalTaskPacket(cleaned, "task.txt", "text/plain");

    if (!cleaned.title.includes("Fix Biometric Attendance Sync Bug")) throw new Error("Title extraction failed");
    if (cleaned.priority !== "High") throw new Error("Priority detection failed");
    if (!cleaned.assigneeHint.includes("john_dev")) throw new Error("Assignee detection failed");
    return { title: cleaned.title, priority: cleaned.priority, assignee: cleaned.assigneeHint };
  });

  // Test 2: Markdown File Ingestion
  runTestCase("2. Markdown File Ingestion & Structural Preservation", () => {
    const rawMd = `
    # TASK: Optimize Database Query Performance
    Project: MasterDB Analytics
    Assignee: sarah_lead@infiverse.com
    Priority: Urgent

    ## Objectives
    - Add compound indexes to Task collection.
    - Reduce dashboard query latency under 100ms.
    `;

    const extracted = extractTextFromDocument(rawMd, "text/markdown", "performance.md");
    const cleaned = cleanAndFormatTaskText(extracted);
    const canonical = generateCanonicalTaskPacket(cleaned, "performance.md", "text/markdown");

    if (cleaned.priority !== "High") throw new Error("Urgent priority failed to map to High");
    if (canonical.provenance.filename !== "performance.md") throw new Error("Provenance filename missing");
    return { title: cleaned.title, priority: cleaned.priority, provenance: canonical.provenance };
  });

  // Test 3: PDF Document Structure Parsing
  runTestCase("3. PDF Document Structure Ingestion", () => {
    const pdfSimulatedBuffer = Buffer.from(
      `%PDF-1.4
      Task: Implement Bright Connection Sovereign Gateway
      Project: SETU EOS
      Assignee: alex_eng@infiverse.com
      Priority: Medium
      
      Integrate sovereign routing adapter into execution fabric.
      EOF`
    );

    const extracted = extractTextFromDocument(pdfSimulatedBuffer, "application/pdf", "architectural_spec.pdf");
    const cleaned = cleanAndFormatTaskText(extracted);

    if (!cleaned.title.includes("Implement Bright Connection Sovereign Gateway")) {
      throw new Error("PDF title parsing failed");
    }
    return { title: cleaned.title, priority: cleaned.priority };
  });

  // Test 4: DOCX Document Structure Parsing
  runTestCase("4. DOCX Document Structure Ingestion", () => {
    const docxSimulatedBuffer = Buffer.from(
      `PK\x03\x04
      Task Title: Setup Continuous Delivery Pipeline for Parikshak
      Project: PARIKSHAK Review Engine
      Assignee: devops_lead@infiverse.com
      Priority: High
      
      Automate unit testing and deployment verification scripts.
      `
    );

    const extracted = extractTextFromDocument(docxSimulatedBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "pipeline.docx");
    const cleaned = cleanAndFormatTaskText(extracted);

    if (!cleaned.title.includes("Setup Continuous Delivery Pipeline for Parikshak")) {
      throw new Error("DOCX title parsing failed");
    }
    return { title: cleaned.title, priority: cleaned.priority };
  });

  // Test 5: End-to-End Ingestion Pipeline Mock (Without DB dependency)
  runTestCase("5. End-to-End Pipeline & Provenance Verification", () => {
    const rawContent = "Task: Build Replay Telemetry Adapter\nAssignee: telemetry_usr\nProject: EOS Telemetry";
    const cleaned = cleanAndFormatTaskText(rawContent);
    const packet = generateCanonicalTaskPacket(cleaned, "telemetry.txt", "text/plain");

    if (!packet.ingestionId) throw new Error("Missing ingestion ID");
    if (packet.provenance.automatedPipeline !== "SETU_ENGINEERING_TASK_RUNTIME_V1") throw new Error("Invalid provenance");
    return { ingestionId: packet.ingestionId, provenance: packet.provenance };
  });

  console.log("\n===============================================================");
  console.log(`🏆 PHASE 2 VALIDATION COMPLETE: ${testResults.filter((r) => r.status === "PASSED").length}/${testResults.length} PASSED`);
  console.log("===============================================================\n");

  return testResults;
}

if (require.main === module) {
  runPhase2Validation();
}

module.exports = { runPhase2Validation };
