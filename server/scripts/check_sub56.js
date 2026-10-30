const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const TaskSubmission = require('../models/TaskSubmission');

async function checkSub() {
    await mongoose.connect(process.env.MONGODB_URI);
    const sub = await TaskSubmission.findById('6ad5f3084f59cdcd1c72fbf8');
    console.log("Submission 56:");
    console.log("Status:", sub.status);
    console.log("AI Details:", JSON.stringify(sub.aiReviewDetails, null, 2));
    console.log("Parikshak Review:", JSON.stringify(sub.parikshakReview, null, 2));
    console.log("Feedback:", sub.feedback);
    process.exit(0);
}
checkSub().catch(e => { console.error(e); process.exit(1); });
