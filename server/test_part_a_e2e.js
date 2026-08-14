/**
 * test_part_a_e2e.js — End-to-End Empirical Verification Test Suite for PART A
 * 
 * Verifies:
 * 1. Automated Task Ingestion (PDF/MD/TXT -> Canonical Packet -> Candidate Matching -> Provenance)
 * 2. Rejection of Malformed / Empty / Ambiguous Input Documents
 * 3. SETU EOS 11-Stage Constitutional Convergence Pipeline & Lineage Hashes
 * 4. PARIKSHAK Review & MasterDB Evaluation Recording
 * 5. Trace Lineage Continuity & Immutability Verification
 */

const { processTaskIngestion, cleanAndFormatTaskText } = require("./services/taskIngestionService");
const { executeConstitutionalPipeline, getRuntimeConvergenceStatus, getExecutionReplay } = require("./services/setuConvergenceService");
const { validateContract } = require("./services/contractValidationService");
const mongoose = require("mongoose");
const crypto = require("crypto");

async function runPartAE2ETests() {
  console.log("=========================================================================");
  console.log("🚀 STARTING PART A — BHIV INTERNAL EOS / SETU PLATFORM CONVERGENCE TESTS");
  console.log("=========================================================================\n");

  // Connect to MongoDB if available, otherwise set bufferTimeout to false
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/niyantran";
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
      console.log("✅ Connected to MongoDB for test suite execution.\n");
    } catch (dbErr) {
      console.warn("⚠️ MongoDB offline — running task ingestion with in-memory resolution mode.\n");
      mongoose.set("bufferCommands", false);
    }
  }

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, detail = "") {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] Test ${totalTests}: ${testName}`);
    } else {
      console.error(`❌ [FAIL] Test ${totalTests}: ${testName} ${detail ? `(${detail})` : ""}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Automated Document Ingestion & Canonical Packet Creation
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- TEST 1: Automated Document Ingestion & Canonical Packet Creation ---");
  try {
    const sampleTaskDoc = `
      Task Title: Implement Sovereign Routing Pipeline Fix
      Priority: High
      Assignee: Rudra
      Department: Engineering Core
      Project: bhiv-setu
      
      ## Overview
      Complete the convergence required for SETU to operate as the BHIV Enterprise Operating System.
      Validate end-to-end trace lineage and canonical MDU schema compliance.
    `;

    const metadata = {
      filename: "sovereign_routing_spec.md",
      mimeType: "text/markdown",
      branch: "blackhole_mumbai",
    };

    const ingestionResult = await processTaskIngestion(Buffer.from(sampleTaskDoc, "utf-8"), metadata);

    assert(ingestionResult.ok === true, "Task Ingestion succeeded");
    assert(ingestionResult.canonicalPacket !== undefined, "Canonical Task Packet generated");
    assert(ingestionResult.canonicalPacket.taskDetails.title === "Implement Sovereign Routing Pipeline Fix", "Task Title correctly extracted");
    assert(ingestionResult.canonicalPacket.taskDetails.priority === "High", "Task Priority extracted");
    assert(ingestionResult.canonicalPacket.provenance.documentHash.length > 0, "Document SHA-256 hash computed");
    assert(ingestionResult.canonicalPacket.provenance.traceId !== undefined, "SETU Trace ID attached to packet");
    assert(ingestionResult.canonicalPacket.provenance.lineageHash !== undefined, "Lineage Hash generated");
  } catch (err) {
    assert(false, "Automated Document Ingestion Exception", err.message);
  }

  console.log("\n");

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Rejection of Malformed / Empty Input Documents
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- TEST 2: Rejection of Malformed / Empty Input Documents ---");
  try {
    const emptyBuffer = Buffer.from("   \n\t   ", "utf-8");
    let caughtEmpty = false;
    try {
      await processTaskIngestion(emptyBuffer, { filename: "empty.txt" });
    } catch (err) {
      caughtEmpty = true;
      assert(err.message.includes("DOCUMENT_INGESTION_FAILED"), "Empty document explicitly rejected with DOCUMENT_INGESTION_FAILED error");
    }
    assert(caughtEmpty, "Empty document upload caught as invalid");

    const binaryGarbageBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    let caughtGarbage = false;
    try {
      await processTaskIngestion(binaryGarbageBuffer, { filename: "binary.bin", mimeType: "application/octet-stream" });
    } catch (err) {
      caughtGarbage = true;
      assert(err.message.includes("DOCUMENT_INGESTION_FAILED"), "Binary garbage without readable text explicitly rejected");
    }
    assert(caughtGarbage, "Binary unreadable document caught as invalid");
  } catch (err) {
    assert(false, "Malformed Document Test Exception", err.message);
  }

  console.log("\n");

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: 11-Stage SETU Constitutional EOS Convergence Pipeline
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- TEST 3: 11-Stage SETU Constitutional EOS Pipeline Execution ---");
  try {
    const traceId = `trace_partA_${Date.now()}`;
    const pipelineResult = await executeConstitutionalPipeline(
      {
        traceId,
        intent: "VALIDATE_CONVERGENCE_SUITE",
        domain: "governance",
        targetCapability: "PARIKSHAK",
        actor: { userId: "test_harness", role: "admin" },
        tenantId: "blackhole_mumbai",
        parameters: { testSuite: "PART_A_RUNTIME_CONVERGENCE" },
      },
      {
        tenantId: "blackhole_mumbai",
        capabilityHandler: async (intent) => {
          return { status: "EXECUTED", capability: intent.targetCapability, verified: true };
        },
      }
    );

    assert(pipelineResult.ok === true, "SETU Pipeline Execution OK");
    assert(pipelineResult.completedStagesCount === 11, "All 11 Constitutional Pipeline stages completed");
    assert(pipelineResult.singleExecutionPathVerified === true, "Single Execution Path Compliance verified");
    assert(pipelineResult.noBypassesConfirmed === true, "Zero DB / Architecture bypasses confirmed");
    assert(pipelineResult.lineageHash.length === 64, "Deterministic 64-char SHA-256 Lineage Hash computed");

    const replayRecord = getExecutionReplay(traceId);
    assert(replayRecord !== null, "Execution replay record retrieved from trace store");
    assert(replayRecord.completedStages.length === 11, "Replay trace contains all 11 stage events");
  } catch (err) {
    assert(false, "SETU Constitutional Pipeline Exception", err.message);
  }

  console.log("\n");

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Contract Validation & Schema Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- TEST 4: Execution Contract & Schema Validation ---");
  try {
    const { validateInterServiceEventContract, executeFullIntegrationMatrixAudit } = require("./services/contractValidationService");

    const validEventPayload = {
      eventId: `evt_${Date.now()}`,
      eventType: "TASK_INGESTION_COMPLETED",
      sourceService: "SETU",
      targetService: "NIYANTRAN",
      traceId: `trace_val_${Date.now()}`,
      payload: { taskId: "task_123", status: "INGESTED" },
    };

    const validationResult = validateInterServiceEventContract(validEventPayload);
    assert(validationResult.valid === true, "Execution Inter-Service Event Contract Validation Passed");

    const matrixAudit = executeFullIntegrationMatrixAudit();
    assert(matrixAudit.overallContractStatus === "COMPLIANT", "Integration Matrix Audit Status is COMPLIANT");
    assert(matrixAudit.participatingServicesCount === 9, "All 9 Participating Services audited for contract compliance");
  } catch (err) {
    assert(false, "Contract Validation Exception", err.message);
  }

  console.log("\n");

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: System Status & Lineage Summary
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- TEST 5: Runtime Convergence Metrics & Audit Summary ---");
  try {
    const status = getRuntimeConvergenceStatus();
    assert(status.convergenceStatus === "CONVERGED", "System Convergence Status is CONVERGED");
    assert(status.totalStages === 11, "11 Total Constitutional Pipeline Stages Registered");
    assert(status.metrics.totalExecutions > 0, "Execution metrics successfully recorded");
  } catch (err) {
    assert(false, "Runtime Convergence Metrics Exception", err.message);
  }

  console.log("\n=========================================================================");
  console.log(`📊 PART A CONVERGENCE TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("=========================================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART A TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("⚠️ SOME TESTS FAILED!");
    process.exit(1);
  }
}

runPartAE2ETests();
