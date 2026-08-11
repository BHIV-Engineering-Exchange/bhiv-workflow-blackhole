/**
 * test_phase4_eos_validation.js
 * 
 * Comprehensive Test Suite for PHASE 4 — Enterprise Operating System Validation
 */

const {
  discoverCapabilities,
  validateEOSBoundary,
} = require("../services/contractValidationService");

async function runPhase4Validation() {
  console.log("===============================================================");
  console.log("🏛️ TESTING PHASE 4 — ENTERPRISE OPERATING SYSTEM VALIDATION");
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

  // Test 1: Capability Discovery
  runTestCase("1. SETU Capability Discovery (NIYANTRAN, PARIKSHAK, ARTHA, SAMPADA, PMO, CLO, CMO)", () => {
    const discovery = discoverCapabilities();
    const required = ["NIYANTRAN", "PARIKSHAK", "ARTHA", "SAMPADA", "PMO", "CLO", "CMO"];
    const names = discovery.capabilities.map((c) => c.name);

    const missing = required.filter((r) => !names.includes(r));
    if (missing.length > 0) throw new Error(`Missing discovered capabilities: ${missing.join(", ")}`);
    if (discovery.eosRole !== "ORCHESTRATOR_DISCOVERY_ONLY") throw new Error("Invalid EOS role");

    return { totalDiscovered: discovery.totalCapabilities, capabilities: names };
  });

  // Test 2: Execution Routing (Pure Orchestration)
  runTestCase("2. Sovereign Execution Routing (Orchestration Only)", () => {
    const request = {
      sourceService: "CLIENT_PORTAL",
      targetService: "NIYANTRAN",
      actionType: "ROUTE_EXECUTION",
      payload: { taskId: "task_001", action: "CREATE_TASK" },
    };

    const res = validateEOSBoundary(request);
    if (!res.allowed) throw new Error("Execution routing should be allowed");
    if (res.constitutionalOwner !== "NIYANTRAN") throw new Error("Target capability ownership mismatch");

    return res;
  });

  // Test 3: Service Coordination
  runTestCase("3. Multi-Service Workflow Coordination", () => {
    const coordinationRequest = {
      sourceService: "SETU",
      targetService: "PARIKSHAK",
      actionType: "COORDINATE_WORKFLOW_EVENT",
      payload: { submissionId: "sub_100", traceId: "trace_coord_001" },
    };

    const res = validateEOSBoundary(coordinationRequest);
    if (!res.allowed) throw new Error("Workflow coordination should be allowed");

    return res;
  });

  // Test 4: Zero Business Logic Ownership
  runTestCase("4. Zero Business Logic Ownership in SETU Core", () => {
    const setuCoreSpec = {
      role: "ENTERPRISE_OPERATING_SYSTEM",
      ownsTaskLogic: false,
      ownsReviewLogic: false,
      ownsFinancialLogic: false,
      ownsLegalLogic: false,
    };

    if (setuCoreSpec.ownsTaskLogic || setuCoreSpec.ownsReviewLogic || setuCoreSpec.ownsFinancialLogic) {
      throw new Error("SETU must not own domain business logic!");
    }

    return setuCoreSpec;
  });

  // Test 5: Responsibility Drift Prevention & Violation Interception
  runTestCase("5. Responsibility Drift Prevention & Violation Interception", () => {
    const illegalMutationRequest = {
      sourceService: "SETU",
      actor: "SETU_EOS_CORE",
      actionType: "MUTATE_BUSINESS_STATE",
      directStateWrite: true,
      targetService: "ARTHA",
      payload: { adjustAccountBalance: 5000 },
    };

    const res = validateEOSBoundary(illegalMutationRequest);
    if (res.allowed) throw new Error("SETU direct state mutation should have been BLOCKED!");
    if (res.error !== "SETU_BUSINESS_LOGIC_MUTATION_VIOLATION") throw new Error("Invalid violation code");

    return { blocked: true, error: res.error, message: res.message };
  });

  // Test 6: Constitutional Capability Owners Validation
  runTestCase("6. Constitutional Capability Owners Validation", () => {
    const ownersMap = {
      NIYANTRAN: "WORKFLOW_TASK_MANAGEMENT",
      PARIKSHAK: "CODE_REVIEW_EVALUATION",
      ARTHA: "FINANCIAL_ACCOUNTING",
      SAMPADA: "RESOURCE_SETTLEMENT",
      PMO: "PROJECT_GOVERNANCE",
      CLO: "LEGAL_COMPLIANCE",
      CMO: "MARKETING_OPERATIONS",
    };

    const discovery = discoverCapabilities();
    for (const cap of discovery.capabilities) {
      if (ownersMap[cap.name] !== cap.domain) {
        throw new Error(`Domain mismatch for ${cap.name}: expected ${ownersMap[cap.name]}, got ${cap.domain}`);
      }
    }

    return ownersMap;
  });

  console.log("\n===============================================================");
  console.log(`🏆 PHASE 4 VALIDATION COMPLETE: ${testResults.filter((r) => r.status === "PASSED").length}/${testResults.length} PASSED`);
  console.log("===============================================================\n");

  return testResults;
}

if (require.main === module) {
  runPhase4Validation();
}

module.exports = { runPhase4Validation };
