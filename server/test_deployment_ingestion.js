const { processTaskIngestion } = require("./services/taskIngestionService");
const mongoose = require("mongoose");
const assert = require("assert");
const zlib = require("zlib");

async function testDeploymentScenarios() {
  console.log("--- Testing Deployment Fallback & Ingestion Resilience ---");

  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/niyantran";
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1000 });
    } catch (dbErr) {
      mongoose.set("bufferCommands", false);
    }
  }

  // 1. Test metadata fallback when empty file buffer is sent with task description/content
  console.log("Test 1: Metadata fallback with empty file buffer...");
  const emptyBuffer = Buffer.from("");
  const metaWithContent = {
    filename: "empty_document.pdf",
    mimeType: "application/pdf",
    content: "Task Title: Deployment Ingestion Resilience\nAssignee: Rudra\nPriority: High\nDepartment: Engineering Core\nOverview: Ensure task ingestion succeeds with text metadata in cloud environments.",
  };

  const result1 = await processTaskIngestion(emptyBuffer, metaWithContent);
  assert(result1.ok === true, "Task Ingestion succeeded via metadata content fallback");
  assert(result1.canonicalPacket.taskDetails.title === "Deployment Ingestion Resilience", "Title correctly extracted from metadata fallback");
  console.log("✅ Test 1 Passed: Metadata fallback active when document buffer lacks readable text.");

  // 2. Test FlateDecode zlib stream decompression for compressed PDFs
  console.log("\nTest 2: Compressed PDF stream parsing via zlib fallback...");
  const rawTextContent = "(Task Title: Sovereign Cloud Deployment Test) Tj (Priority: High) Tj (Assignee: Rudra) Tj";
  const compressedStream = zlib.deflateSync(Buffer.from(rawTextContent, "latin1"));
  
  const mockPdf = Buffer.concat([
    Buffer.from("%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode /Length " + compressedStream.length + " >>\nstream\n", "latin1"),
    compressedStream,
    Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF", "latin1")
  ]);

  const result2 = await processTaskIngestion(mockPdf, { filename: "compressed_test.pdf", mimeType: "application/pdf" });
  assert(result2.ok === true, "Compressed PDF parsed successfully via zlib fallback");
  assert(result2.canonicalPacket.taskDetails.title === "Sovereign Cloud Deployment Test", "Extracted title from zlib-inflated PDF stream");
  console.log("✅ Test 2 Passed: Compressed FlateDecode PDF stream parsed via pure JS zlib fallback.");

  console.log("\n🎉 ALL DEPLOYMENT INGESTION RESILIENCE TESTS PASSED!");
  process.exit(0);
}

testDeploymentScenarios().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
