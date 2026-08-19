/**
 * test_deployment_ingestion.js — Pre-Push Deployment Simulation Test
 *
 * Simulates the Linux deployment environment on your Windows machine by:
 *   1. Mocking pdf-parse failure (as it does when native canvas binaries fail on Linux)
 *   2. Testing glyph-encoded PDFs (operator-only streams — no literal ASCII text)
 *   3. Testing zlib FlateDecode compressed PDFs with real text
 *   4. Testing metadata-only fallback (empty document buffer)
 *
 * Run this before every push:
 *   node test_deployment_ingestion.js
 */

const assert = require("assert");
const zlib = require("zlib");
const Module = require("module");

// ─── DEPLOYMENT SIMULATION: Mock pdf-parse to throw ─────────────────────────
// On Linux deployment servers, the Windows @napi-rs/canvas .node binaries fail
// to load. This mock simulates that failure so all fallback paths are tested.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "pdf-parse") {
    throw new Error("[DEPLOYMENT-SIM] Native addon failed: Cannot load on Linux");
  }
  return originalLoad.apply(this, arguments);
};
console.log("🔧 [DEPLOYMENT-SIM] pdf-parse mocked to fail (Linux native addon simulation)\n");
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");
const { processTaskIngestion } = require("./services/taskIngestionService");

async function runTests() {
  console.log("=================================================================");
  console.log("🚀 PRE-PUSH DEPLOYMENT SIMULATION — Task Ingestion Resilience");
  console.log("=================================================================\n");

  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/niyantran", {
        serverSelectionTimeoutMS: 1000,
      });
    } catch {
      mongoose.set("bufferCommands", false);
    }
  }

  let passed = 0;
  let failed = 0;

  function check(condition, label) {
    if (condition) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${label}`);
      failed++;
    }
  }

  // ─── TEST 1: Metadata-only fallback ──────────────────────────────────────
  console.log("── Test 1: Metadata fallback (empty buffer, pdf-parse offline) ──");
  try {
    const result = await processTaskIngestion(Buffer.from(""), {
      filename: "empty.pdf",
      mimeType: "application/pdf",
      content: "Task Title: Deployment Ingestion Resilience\nPriority: High\nAssignee: Rudra\nDepartment: Engineering Core\nOverview: Verify fallback chain works in cloud.",
    });
    check(result.ok === true, "Ingestion succeeded");
    check(result.canonicalPacket.taskDetails.title === "Deployment Ingestion Resilience", "Title extracted from metadata");
  } catch (e) {
    check(false, `Unexpected error: ${e.message}`);
  }

  // ─── TEST 2: Glyph-encoded PDF (operator-only TJ arrays — no ASCII text) ──
  console.log("\n── Test 2: Glyph-encoded PDF (operator-only streams like Bright_Connection PDF) ──");
  try {
    // Mimics Bright_Connection_Field_Audit_Task.pdf — TJ arrays with only numbers, no () strings
    const glyphPdfContent =
      "BT\n" +
      "1 0 0 -1 0 792 cm\n" +
      "1 0 0 1 136.746008 729.076 Tm\n" +
      "[ -15 50 20 30 0] TJ\n" +
      "1 0 0 1 50 691.768 Tm\n" +
      "[ 120 50 50 -15 50 20 30 -15 0] TJ\n" +
      "1 0 0 1 50 664.024 Tm\n" +
      "[ 120 50 -15 0] TJ\n" +
      "ET\n";
    const compressedGlyphStream = zlib.deflateSync(Buffer.from(glyphPdfContent, "utf-8"));
    const glyphPdf = Buffer.concat([
      Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode /Length " + compressedGlyphStream.length + " >>\nstream\n", "latin1"),
      compressedGlyphStream,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);
    const result = await processTaskIngestion(glyphPdf, {
      filename: "glyph_encoded.pdf",
      mimeType: "application/pdf",
      content: "Task Title: Glyph Encoded PDF Fallback\nPriority: Medium\nDepartment: Engineering Core\nOverview: This PDF uses glyph encoding so text comes from metadata.",
    });
    check(result.ok === true, "Ingestion succeeded (fell through to metadata)");
    check(
      !result.canonicalPacket.taskDetails.title.includes("TJ") &&
        !result.canonicalPacket.taskDetails.title.includes("Tm"),
      "PDF operator garbage NOT used as title"
    );
    check(result.canonicalPacket.taskDetails.title === "Glyph Encoded PDF Fallback", "Correct title from metadata fallback");
  } catch (e) {
    check(false, `Unexpected error: ${e.message}`);
  }

  // ─── TEST 3: zlib FlateDecode PDF with real text in (string) Tj operators ─
  console.log("\n── Test 3: Compressed PDF with real text (zlib FlateDecode path) ──");
  try {
    const realTextStream =
      "BT\n" +
      "/F1 12 Tf\n" +
      "50 700 Td\n" +
      "(Task Title: Sovereign Cloud Deployment Test) Tj\n" +
      "0 -20 Td\n" +
      "(Priority: High) Tj\n" +
      "0 -20 Td\n" +
      "(Assignee: Rudra) Tj\n" +
      "0 -20 Td\n" +
      "(Department: Engineering Core) Tj\n" +
      "0 -20 Td\n" +
      "(Overview: Verify pure JS zlib extraction path works end to end in deployment.) Tj\n" +
      "ET\n";
    const compressed = zlib.deflateSync(Buffer.from(realTextStream, "utf-8"));
    const realPdf = Buffer.concat([
      Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode /Length " + compressed.length + " >>\nstream\n", "latin1"),
      compressed,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);
    const result = await processTaskIngestion(realPdf, {
      filename: "real_text_compressed.pdf",
      mimeType: "application/pdf",
    });
    check(result.ok === true, "Ingestion succeeded via zlib extraction");
    check(result.canonicalPacket.taskDetails.title === "Sovereign Cloud Deployment Test", "Title extracted from zlib-decompressed stream");
  } catch (e) {
    check(false, `Unexpected error: ${e.message}`);
  }

  // ─── TEST 4: Empty document + no metadata → should be rejected cleanly ────
  console.log("\n── Test 4: Empty buffer + no metadata → correctly rejected ──");
  try {
    await processTaskIngestion(Buffer.from("   \n\t"), { filename: "empty.txt", mimeType: "text/plain" });
    check(false, "Should have thrown DOCUMENT_INGESTION_FAILED");
  } catch (e) {
    check(e.message.includes("DOCUMENT_INGESTION_FAILED"), "Correctly rejected with DOCUMENT_INGESTION_FAILED");
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log("\n=================================================================");
  console.log(`📊 DEPLOYMENT SIM: ${passed}/${total} PASSED`);
  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED — Safe to push to deployment!");
  } else {
    console.log(`⚠️  ${failed} test(s) FAILED — Fix before pushing!`);
  }
  console.log("=================================================================");
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("❌ Unhandled error:", err);
  process.exit(1);
});
