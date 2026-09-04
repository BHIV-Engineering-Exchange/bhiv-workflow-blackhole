const express = require('express');
const request = require('supertest');
const knowledgeAdminRouter = require('../server/routes/knowledgeAdmin');

const app = express();
app.use(express.json());

// Mock auth & adminAuth middleware for testing boundary contracts
app.use('/api/knowledge', (req, res, next) => {
    req.user = { id: 'admin-telemetry-123' };
    next();
}, knowledgeAdminRouter);

describe('Phase 2: Knowledge Ingestion API Contract Verification', () => {

    it('should safely reject HTTP requests missing critical context (chatgptContent)', async () => {
        const response = await request(app)
            .post('/api/knowledge/ingest')
            .send({ datasetType: 'engineering_context' }); // Missing required fields

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('chatgptContent and productId are required.');
    });

    it('should correctly process formatted ingestion requests and emit a governance reference', async () => {
        const response = await request(app)
            .post('/api/knowledge/ingest')
            .send({
                chatgptContent: '# Structural analysis...',
                productId: 'tenant_core',
                datasetType: 'architectural_rules'
            });

        expect(response.status).toBe(200);
        // Validates our mock implementation is providing deterministic reference keys
        expect(response.body.reference).toBeDefined();
        if (response.body.simulated_response) {
            expect(response.body.message).toContain('Governance');
        }
    });
});
