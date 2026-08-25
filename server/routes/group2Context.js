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

        // 2. Dynamic Retrieval from Group 1 Canonical Record Source
        const GROUP1_API = process.env.GROUP1_SERVICE_URL || 'http://163.128.209.18:8013';
        let canonicalRecord;
        try {
            // Request actual canonical record dynamically—no static registries or mock fixtures
            const g1Response = await axios.get(`${GROUP1_API}/observations/${observationId}`);
            canonicalRecord = g1Response.data.record || g1Response.data;

            if (!canonicalRecord) {
                throw new Error("Empty canonical record returned from Group 1");
            }
        } catch (fetchError) {
            console.warn(`[GROUP2-CONTEXT] Failed to fetch Group 1 canonical record for ${observationId}:`, fetchError.message);
            // FAIL-SAFE ABSTENTION: GAP -> ABSTAIN
            return res.status(200).json({ // Return 200 as this is a successful governed abstention
                ok: true,
                status: "ABSTAIN",
                reason: "GAP_IN_CANONICAL_RECORD",
                message: "Verified context is unavailable. Failing closed to ABSTAIN per Group 2 mandate.",
                provenance: {
                    observationId,
                    traceId: `ctx_${Date.now()}`,
                    contextFound: false
                }
            });
        }

        // 3. Generate Authoritative Context 
        const contextPayload = {
            observationId,
            canonicalRecordId: canonicalRecord.id || canonicalRecord.canonicalId || null,
            location: location || canonicalRecord.location || "UNKNOWN",
            // STRICT VANA RULE: No generated timestamp replacing source time
            timestamp: timestamp || canonicalRecord.timestamp || null,
            sourceContext: canonicalRecord.sourceData || "DYNAMIC_SCIENCE_CONTEXT",
            confidence: canonicalRecord.verified ? "VERIFIED" : "NOT VERIFIED", // Marks unsupported items strictly per Ansh's rules
            parameters: { ...(canonicalRecord.parameters || {}), ...(parameters || {}) }
        };

        // If context isn't verified, missing critical linkage, or MISSING SOURCE TIMESTAMP, we must abstain. No fabricated ALLOW.
        if (contextPayload.confidence === "NOT VERIFIED" || !contextPayload.canonicalRecordId || !contextPayload.timestamp) {
            return res.status(200).json({
                ok: true,
                status: "ABSTAIN",
                reason: !contextPayload.timestamp ? "MISSING_SOURCE_TIMESTAMP" : "CONTEXT_NOT_VERIFIED",
                message: "Authoritative evidence threshold not met (Missing context or source timestamp). Failing closed to ABSTAIN.",
                provenance: {
                    observationId,
                    canonicalRecordId: contextPayload.canonicalRecordId,
                    traceId: `ctx_${Date.now()}`,
                    contextFound: true,
                    decisionMade: false
                }
            });
        }

        // 4. Forward to SANSKAR for contextualization
        try {
            // SANSKAR call enabled for connected runtime
            const sanskarResponse = await axios.post(`${SANSKAR_API}/signal`, contextPayload);

            return res.json({
                ok: true,
                status: "ALLOW",
                message: "Dynamic context mapped successfully. SANSKAR engine completed decision.",
                provenance: {
                    observationId,
                    canonicalRecordId: contextPayload.canonicalRecordId,
                    traceId: sanskarResponse.data.traceId || `ctx_${Date.now()}`,
                    group2_capability: "ACTIVE"
                },
                sanskarResult: sanskarResponse.data
            });

        } catch (sanskarError) {
            console.error("[GROUP2-INTEGRATION] Downstream SANSKAR Failure:", sanskarError.message);
            // STRICT VANA RULE: explicit handling of downstream service failure
            return res.status(502).json({
                ok: false,
                status: "ABSTAIN",
                error: "DOWNSTREAM_SERVICE_FAILURE",
                reason: "SANSKAR_UNREACHABLE",
                message: "Group 4 SANSKAR downstream service failed. Failing closed to ABSTAIN.",
                details: sanskarError.message
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
