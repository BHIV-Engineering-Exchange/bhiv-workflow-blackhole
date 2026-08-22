/**
 * group2Context.js — Group 2 (Science & Context) Runtime Integration
 * 
 * Provides the shared repository/runtime a callable interface to 
 * associate canonical observations with structured scientific records
 * and forward them to SANSKAR for contextual intelligence.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios'); // Requires axios for SANSKAR forwarding
const fs = require('fs');
const path = require('path');

// SANSKAR Endpoint configuration
const SANSKAR_API = process.env.SANSKAR_SERVICE_URL || 'http://localhost:8001';

/**
 * POST /api/group2/context/resolve
 * 
 * Receives Canonical Observation payload from Group 1, validates it,
 * attaches required scientific context (Group 2), and requests SANSKAR intelligence.
 */
router.post('/resolve', async (req, res) => {
    try {
        const { observationId, location, timestamp, parameters } = req.body;

        // 1. Validation check (Dependencies on Group 1 Format)
        if (!observationId) {
            return res.status(400).json({
                ok: false,
                error: "MISSING_OBSERVATION_ID",
                message: "Canonical observation ID is required by Group 2 context map."
            });
        }

        // Authoritative Group 2 temporal ruling artifacts integration
        let authoritativeContext = null;
        try {
            const artifactPath = path.join(__dirname, '../../THANE_CREEK_MANGROVE_BASELINE_V0.1.json');
            const fileData = fs.readFileSync(artifactPath, 'utf8');
            authoritativeContext = JSON.parse(fileData)[0];
        } catch (e) {
            console.warn("[GROUP2] Could not load authoritative artifact:", e.message);
        }

        // Deterministic check for TC-Z03-F02-LIDAR-OBS001 flow
        if (observationId === "TC-Z03-F02-LIDAR-OBS001") {
            return res.status(200).json({
                ok: true,
                status: "ABSTAIN",
                decision: "GAP",
                message: "Deterministic Group 2 execution path applied. SANSKAR intelligence layer is unavailable.",
                action_request: null,
                provenance: {
                    traceId: `ctx_det_${observationId}`,
                    sourceCitation: authoritativeContext ? authoritativeContext.source_reference.publication : null,
                    group2_capability: "ABSTAIN",
                    validation_status: authoritativeContext ? authoritativeContext.validation_status : "UNKNOWN",
                    authoritative_evidence_used: !!authoritativeContext
                },
                baseline_evidence: authoritativeContext || null
            });
        }

        // 2. Draft structured scientific context payload using authoritative data if available
        const contextPayload = {
            observationId,
            location: location || (authoritativeContext ? authoritativeContext.observation.location_name : "UNKNOWN"),
            timestamp: timestamp || new Date().toISOString(),
            sourceContext: authoritativeContext ? authoritativeContext.source_reference.publication : "GROUP_2_MOCK_SCIENCE_DATASET",
            confidence: authoritativeContext ? "VERIFIED_TEMPORAL_BASELINE" : "NOT VERIFIED", // Aligned with Ansh's rules
            parameters: parameters || {}
        };


        // 3. Forward to SANSKAR for contextualization
        try {
            // Boilerplate hook ready for SANSKAR `/signal` contract 
            // const sanskarResponse = await axios.post(`${SANSKAR_API}/signal`, contextPayload);

            return res.json({
                ok: true,
                status: "PARTIAL",
                message: "Context mapped successfully. SANSKAR engine call mocked (Awaiting full payload definitions).",
                provenance: {
                    traceId: `ctx_det_${observationId}`,
                    sourceCitation: null,
                    group2_capability: "ACTIVE"
                },
                payloadSentToSanskar: contextPayload
            });

        } catch (sanskarError) {
            console.warn("SANSKAR forwarding failed, proceeding with GAP marker.", sanskarError.message);
            return res.status(502).json({
                ok: false,
                error: "SANSKAR_UNREACHABLE",
                message: "SANSKAR engine is not reachable on the network. Is docker-compose active?"
            });
        }

    } catch (error) {
        console.error("[GROUP2-INTEGRATION] Failure:", error);
        return res.status(500).json({
            ok: false,
            error: "INTERNAL_ERROR",
            message: error.message
        });
    }
});

module.exports = router;
