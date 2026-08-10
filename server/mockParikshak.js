const express = require('express');
const app = express();
app.use(express.json());

app.post('/parikshak/review', (req, res) => {
    console.log('[MOCK PARIKSHAK] Received request:', req.body);
    setTimeout(() => {
        res.json({
            status: 'PASS',
            score: 95,
            review: 'Great job!',
            review_details: {
                done_well: 'Clean code.',
                missing_work: 'None',
                recommendations: 'Keep it up',
                readiness: 'Production Ready',
                next_task: {
                    title: 'Deploy to Production',
                    description: 'Deploy the tested application to the production server.',
                    priority: 'High'
                }
            }
        });
    }, 1000);
});

app.listen(8000, () => {
    console.log('[MOCK PARIKSHAK] Listening on port 8000');
});
