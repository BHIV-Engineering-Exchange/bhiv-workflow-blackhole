const axios = require('axios');

async function testWorkingParikshak() {
    const urls = [
        'http://localhost:8000/parikshak/review',
        'http://127.0.0.1:8000/parikshak/review'
    ];

    const payload = {
        mode: 'task_review',
        title: 'AI Task Ingestion Service & TANTRA Runtime Convergence Certification',
        task_title: 'AI Task Ingestion Service & TANTRA Runtime Convergence Certification',
        description: 'Task Overview: Develop and certify the AI Task Ingestion Service.\n\nCandidate Deliverables:\nImplemented document parsing across PDF, DOCX, TXT, and Markdown formats with automated metadata extraction, title parsing, and candidate department routing. Certified deterministic handshakes across NIYANTRAN, PARIKSHAK AI, MasterDB, MDU, and Bucket connector interfaces following published API contracts. Configured end-to-end x-trace-id propagation across execution steps with audit trail logging.',
        submitted_by: 'Rudra Parmeshwar',
        repo_url: 'https://github.com/BHIV-Engineering-Exchange/bhiv-ai-crm',
        github_repo_link: 'https://github.com/BHIV-Engineering-Exchange/bhiv-ai-crm',
        current_task_id: 'T-GOV-001',
        previous_task_id: 'T-GOV-001',
        trace_id: 'trace-test-url-check'
    };

    for (const url of urls) {
        console.log('Testing Endpoint:', url);
        try {
            const start = Date.now();
            const res = await axios.post(url, payload, { timeout: 15000 });
            const runtimeMs = Date.now() - start;
            console.log(`  ✅ SUCCESS: HTTP ${res.status} (${runtimeMs}ms)`);
            console.log('  Data:', JSON.stringify(res.data));
        } catch (err) {
            console.log('  ❌ FAIL:', err.message, err.response ? JSON.stringify(err.response.data) : '');
        }
    }
}

testWorkingParikshak();
