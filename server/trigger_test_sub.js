const mongoose = require('mongoose');
require('dotenv').config();

const { invokeParikshak } = require('./services/parikshakService');
const TaskSubmission = require('./models/TaskSubmission');

async function testSubmissionEvaluation() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/niyantran');
        console.log("Connected to MongoDB.");

        const subId = "6a8c3e855ed1bd400a3967a2";
        let sub = await TaskSubmission.findById(subId).populate('task').populate('user');
        
        if (!sub) {
            console.log("Submission not found. Fetching latest submission...");
            const latestSub = await TaskSubmission.findOne().sort({ updatedAt: -1 }).populate('task').populate('user');
            if (!latestSub) {
                console.error("No submissions found in DB.");
                process.exit(1);
            }
            console.log(`Found latest submission: ${latestSub._id}`);
            sub = latestSub;
        }

        console.log("Updating submission notes & repo link for live evaluation...");
        sub.githubLink = "https://github.com/BHIV-Engineering-Exchange/bhiv-ai-crm";
        sub.notes = `Implemented and certified the AI Task Ingestion Service & TANTRA Runtime Convergence Pipeline for Web Development candidate Rudra Parmeshwar. 

Key Architectural Deliverables & Validation Steps:
1. Multi-Format Ingestion Engine: Validated document parsing across PDF, DOCX, TXT, and Markdown formats with automated metadata extraction, title parsing, and candidate department routing.
2. Runtime Service Orchestration & Handoff: Certified deterministic handshakes across NIYANTRAN, PARIKSHAK AI, MasterDB (TaskEvaluation), MDU, and Bucket connector interfaces following published API contracts.
3. Observability & Replayability: Configured end-to-end x-trace-id propagation across execution steps with audit trail logging, deterministic state mutation checks, and monotonic sequence parity verification.
4. Constitutional Ownership & Boundaries: Verified that single-writer concurrency containment is respected without database ownership drift or direct cross-service writes.
5. Production Readiness Certification: Verified deployment contracts, release locks, and SHA-256 state hashing for production staging.`;

        await sub.save();
        console.log(`Saved submission ${sub._id}. Triggering Parikshak review...`);

        await invokeParikshak(sub._id, `trace-live-test-${Date.now()}`, null);

        const updatedSub = await TaskSubmission.findById(sub._id);
        console.log("\n==================================================");
        console.log("UPDATED SUBMISSION EVALUATION RESULT:");
        console.log("==================================================");
        console.log("Status:", updatedSub.status);
        console.log("aiReviewDetails:", JSON.stringify(updatedSub.aiReviewDetails, null, 2));
        console.log("parikshakReview:", JSON.stringify(updatedSub.parikshakReview, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error("Error running test submission evaluation:", err);
        process.exit(1);
    }
}

testSubmissionEvaluation();
