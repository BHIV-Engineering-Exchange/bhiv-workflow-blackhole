const express = require('express');
const app = express();
app.use(express.json());

app.post('/parikshak/review', (req, res) => {
    console.log('[MOCK PARIKSHAK] Received request:', req.body);
    const title = req.body ? (req.body.title || '') : '';
    const isBC = title.includes('Bright Connection') || (req.body && req.body.trace_id && req.body.trace_id.includes('bc'));

    setTimeout(() => {
        res.json({
            status: 'PASS',
            score: 95,
            review: isBC 
                ? 'Field visit submission verified! GPS location proof and shelf display photo approved.'
                : 'Great job! Code review passed.',
            review_details: {
                done_well: isBC ? 'GPS location verified, shelf photo clear, payment receipt logged.' : 'Clean code.',
                missing_work: 'None',
                recommendations: isBC ? 'Proceed to next scheduled dealer beat visit.' : 'Keep it up',
                readiness: 'Production Ready',
                next_task: {
                    title: isBC ? 'Bright Connection Beat Visit #02 - Malad Commercial Corridor' : 'Deploy to Production',
                    description: isBC ? 'Perform follow-up dealer audit and stock verification at Malad commercial hub.' : 'Deploy the tested application to the production server.',
                    priority: 'High'
                }
            }
        });
    }, 1000);
});

app.listen(8000, () => {
    console.log('[MOCK PARIKSHAK] Listening on port 8000');
});
