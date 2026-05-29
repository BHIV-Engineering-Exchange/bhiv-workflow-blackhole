const crypto = require("crypto");
const { stableStringify } = require("../utils/stableStringify");

const extractExecutionContract = (req) => {
  const raw =
    req.body?.contract ||
    req.body?.execution_contract ||
    req.body?.executionContract ||
    null;

  if (raw) {
    if (typeof raw === "string") {
      return JSON.parse(raw);
    }
    return raw;
  }

  if (req.body && req.body.execution_id) {
    return req.body;
  }

  return null;
};

const normalizeIssuedAt = (issuedAt) => {
  if (!issuedAt) {
    return null;
  }

  const parsed = new Date(issuedAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const validateExecutionContract = (contract) => {
  const errors = [];

  if (!contract || typeof contract !== "object") {
    errors.push("contract_missing");
    return { ok: false, errors };
  }

  if (!contract.execution_id || typeof contract.execution_id !== "string") {
    errors.push("execution_id_missing");
  }

  if (!contract.trace_id || typeof contract.trace_id !== "string") {
    errors.push("trace_id_missing");
  }

  if (!contract.tenant_id || typeof contract.tenant_id !== "string") {
    errors.push("tenant_id_missing");
  }

  const issuedAt = normalizeIssuedAt(contract.issued_at);
  if (!issuedAt) {
    errors.push("issued_at_invalid");
  }

  if (!contract.governance || typeof contract.governance !== "object") {
    errors.push("governance_missing");
  } else {
    if (!contract.governance.route) {
      errors.push("governance_route_missing");
    }
    if (!contract.governance.policy_id) {
      errors.push("governance_policy_missing");
    }
    if (!contract.governance.authority) {
      errors.push("governance_authority_missing");
    }
  }

  if (!contract.execution || typeof contract.execution !== "object") {
    errors.push("execution_block_missing");
  } else if (!contract.execution.action) {
    errors.push("execution_action_missing");
  }

  return { ok: errors.length === 0, errors };
};

const computeContractHash = (contract) => {
  const hash = crypto.createHash("sha256");
  hash.update(stableStringify(contract));
  return hash.digest("hex");
};

const getContractVersion = (contract) => {
  return contract.contract_version || contract.version || null;
};

module.exports = {
  extractExecutionContract,
  normalizeIssuedAt,
  validateExecutionContract,
  computeContractHash,
  getContractVersion,
};
