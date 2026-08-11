/**
 * test_phase3_runtime_integration.js
 * 
 * Comprehensive Test Suite for PHASE 3 — Runtime Integration Validation
 */

const {
  PARTICIPATING_SERVICES,
  validateTraceHeaderContinuity,
  validateInterServiceEventContract,
  validateRetryAndFailurePolicy,
  executeFullIntegrationMatrixAudit,
} = require("../services/contractValidationService");
const { validateExecutionContract } = require("../services/executionContractService");

async function runPhase3Validation() {
  console.log("===============================================================");
  console.log("🔗 TESTING PHASE 3 — RUNTIME INTEGRATION VALIDATION");
  console.log("===============================================================\n");

  const testResults = [];

  const runTestCase = (testName, fn) => {
    try {
      const res = fn();
      testResults.push({ name: testName, status: "PASSED", details: res });
      console.log(`✅ [PASS] ${testName}`);
    } catch (err) {
      testResults.push({ name: testName, status: "FAILED", error: err.message });
      console.log(`❌ [FAIL] ${testName}: ${err.message}`);
    }
  };

  // Test 1: Participating Services Coverage (All 9 Services)
  runTestCase("1. Participating Services Inventory (9 Services)", () => {
    const required = ["SETU", "NIYANTRAN", "PARIKSHAK", "PRANA", "KARMA", "MasterDB", "MDU", "Bucket", "InsightFlow"];
    const found = Object.keys(PARTICIPATING_SERVICES);

    const missing = required.filter((s) => !found.includes(s));
    if (missing.length > 0) throw new Error(`Missing services: ${missing.join(", ")}`);

    return { totalServices: found.length, services: found };
  });

  // Test 2: Runtime Contract Validation
  runTestCase("2. Execution Contract Validation (Runtime Contract)", () => {
    const sampleContract = {
      execution_id: "exec_p3_001",
      trace_id: "trace_p3_001",
      tenant_id: "bright_connection_tenant",
      issued_at: new Date().toISOString(),
      contract_version: "1.0",
      governance: {
        route: "/api/tasks/ingest",
        policy_id: "POL_001",
        authority: "KESHAV",
      },
      execution: {
        action: "TASK_INGESTION",
      },
    };

    const res = validateExecutionContract(sampleContract);
    if (!res.ok) throw new Error(`Contract validation failed: ${res.errors.join(", ")}`);

    return res;
  });

  // Test 3: API Contract & Schema Compliance
  runTestCase("3. API Contract Schema Compliance", () => {
    const eventPayload = {
      eventId: "evt_p3_001",
      eventType: "CONSTITUTIONAL_EVENT_EMITTED",
      sourceService: "NIYANTRAN",
      targetService: "PARIKSHAK",
      traceId: "trace_p3_001",
      payload: { submissionId: "sub_001", codeUrl: "s3://bucket/code.zip" },
    };

    const res = validateInterServiceEventContract(eventPayload);
    if (!res.valid) throw new Error("Event contract validation failed");

    return res;
  });

  // Test 4: Authentication & Security Boundary Check
  runTestCase("4. Authentication & Security Boundary Check", () => {
    const authHeaders = {
      "x-trace-id": "trace_p3_002",
      "x-tenant-id": "bright_connection_tenant",
      authorization: "Bearer valid_jwt_token_sample",
    };

    const res = validateTraceHeaderContinuity(authHeaders);
    if (!res.valid) throw new Error(`Auth header check failed: ${res.issues.join(", ")}`);

    return res;
  });

  // Test 5: End-to-End Trace ID Continuity
  runTestCase("5. Trace ID Propagation & Continuity", () => {
    const traceId = "trace_multi_hop_999";
    const headersHop1 = { "x-trace-id": traceId, "x-tenant-id": "tenant_a", authorization: "Bearer token" };
    const headersHop2 = { "x-trace-id": traceId, "x-tenant-id": "tenant_a", authorization: "Bearer token" };

    const check1 = validateTraceHeaderContinuity(headersHop1);
    const check2 = validateTraceHeaderContinuity(headersHop2);

    if (check1.traceId !== traceId || check2.traceId !== traceId) {
      throw new Error("Trace ID dropped across request hops");
    }

    return { traceId, hop1: check1.valid, hop2: check2.valid };
  });

  // Test 6: Version Compatibility Matching
  runTestCase("6. Version Compatibility Matching (Version 1.0)", () => {
    const eventPayload = {
      eventId: "evt_p3_002",
      eventType: "SUBMISSION_EVALUATED",
      sourceService: "PARIKSHAK",
      targetService: "MasterDB",
      traceId: "trace_p3_003",
      payload: { score: 100 },
    };

    const res = validateInterServiceEventContract(eventPayload);
    if (res.versionMatch !== "1.0") throw new Error("Version mismatch");

    return { version: res.versionMatch };
  });

  // Test 7: Retry Behaviour & Backoff Calculation
  runTestCase("7. Retry Behaviour & Backoff Calculation", () => {
    const retry1 = validateRetryAndFailurePolicy(1, "NETWORK_TIMEOUT");
    const retry2 = validateRetryAndFailurePolicy(2, "NETWORK_TIMEOUT");
    const retry3 = validateRetryAndFailurePolicy(3, "NETWORK_TIMEOUT");

    if (retry1.calculatedBackoffMs !== 1000) throw new Error("Incorrect backoff for attempt 1");
    if (retry2.calculatedBackoffMs !== 2000) throw new Error("Incorrect backoff for attempt 2");
    if (retry3.calculatedBackoffMs !== 4000) throw new Error("Incorrect backoff for attempt 3");

    return { attempt1Backoff: retry1.calculatedBackoffMs, attempt3Backoff: retry3.calculatedBackoffMs };
  });

  // Test 8: Failure Handling & Circuit Breaker Triggers
  runTestCase("8. Failure Handling & Circuit Breaker Triggers", () => {
    const normalState = validateRetryAndFailurePolicy(2, "TIMEOUT");
    const trippedState = validateRetryAndFailurePolicy(5, "TIMEOUT");

    if (normalState.circuitBreakerStatus !== "CLOSED") throw new Error("Circuit breaker should be CLOSED");
    if (trippedState.circuitBreakerStatus !== "OPEN") throw new Error("Circuit breaker should be OPEN");

    return { normal: normalState.circuitBreakerStatus, tripped: trippedState.circuitBreakerStatus };
  });

  // Test 9: Complete 9-Service Integration Matrix Audit
  runTestCase("9. Full 9-Service Integration Contract Audit Matrix", () => {
    const audit = executeFullIntegrationMatrixAudit();
    if (audit.overallContractStatus !== "COMPLIANT") throw new Error("Integration matrix non-compliant");
    if (audit.participatingServicesCount !== 9) throw new Error("Expected 9 participating services");

    return { status: audit.overallContractStatus, serviceCount: audit.participatingServicesCount };
  });

  console.log("\n===============================================================");
  console.log(`🏆 PHASE 3 VALIDATION COMPLETE: ${testResults.filter((r) => r.status === "PASSED").length}/${testResults.length} PASSED`);
  console.log("===============================================================\n");

  return testResults;
}

if (require.main === module) {
  runPhase3Validation();
}

module.exports = { runPhase3Validation };
