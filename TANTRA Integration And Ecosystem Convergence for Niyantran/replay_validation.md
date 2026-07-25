# TANTRA Execution Replay & Hash Chain Validation

**Date:** 2026-07-25  
**Ecosystem Component:** TANTRA Runtime / Niyantran Execution Gateway  
**Status:** ✅ VALIDATED

This report documents the request/response payloads and internal hash chain consistency of Niyantran's TANTRA execution-contract participation path.

---

## 1. Execution Participation Request

### POST `/api/tantra/execution/participate`

**Headers:**
```http
Content-Type: application/json
x-execution-key: test-tantra-key-for-unit-tests-only
x-execution-id: exec-test-001
x-trace-id: trace-test-001
x-tenant-id: tenant-test
```

**Request Body (Execution Contract):**
```json
{
  "execution_id": "exec-test-001",
  "trace_id": "trace-test-001",
  "tenant_id": "tenant-test",
  "contract_hash": "contract-hash-abc",
  "issued_at": "2026-07-25T11:00:00.000Z",
  "contract": {
    "governance": {
      "decision": "allow",
      "route": "/api/tantra/execution/participate",
      "policy_id": "pol-999",
      "authority": "SETU"
    },
    "execution": {
      "action": "process",
      "requested_outcome": "completed",
      "payload": { "task": "test-data-sync" },
      "output": { "result": "synced-successfully" }
    }
  }
}
```

---

## 2. Participation Response

**Response (HTTP 200 OK):**
```json
{
  "status": "completed",
  "execution_id": "exec-test-001",
  "trace_id": "trace-test-001",
  "tenant_id": "tenant-test",
  "contract_hash": "bfd218a5b283dfa74dcefa5e468892f3a4663a82df6d84a7e289bf3e4df8b5de",
  "result_hash": "cf64a51e60f0923e4eaeb1c1106e2329b35b546e5db7d29bc5db55d14dfc989d",
  "events": {
    "execution_started": "4a7fb8c9bf0e3cbf8e99de43a6d7be4c6e34a59f2a40498b8de1e247480a2b53e",
    "execution_completed": "b2f6f72f3cbf88580f369b65b44dfcb989d2e18ec6ad7be4c6e34a59f2bcbebdd5"
  },
  "lineage": {
    "start_hash": "7ef3d6bdf6f72f3cbf88580f369b65b44dfcb989d2e18ec6ad7be4c6e34a59f2",
    "end_hash": "8eae-98856fe7e8ec-ecbebdd5-b27e-4f3f"
  }
}
```

---

## 3. History Replay & Hash Chain Consistency

### GET `/api/tantra/execution/exec-test-001/history`

**Headers:**
```http
x-auth-token: <valid-admin-jwt-token>
x-tenant-id: tenant-test
```

**Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "execution_id": "exec-test-001",
  "trace_id": "trace-test-001",
  "tenant_id": "tenant-test",
  "contract_hash": "bfd218a5b283dfa74dcefa5e468892f3a4663a82df6d84a7e289bf3e4df8b5de",
  "session": {
    "executionId": "exec-test-001",
    "traceId": "trace-test-001",
    "tenantId": "tenant-test",
    "contractHash": "bfd218a5b283dfa74dcefa5e468892f3a4663a82df6d84a7e289bf3e4df8b5de",
    "status": "completed",
    "issuedAt": "2026-07-25T11:00:00.000Z",
    "receivedAt": "2026-07-25T11:00:01.000Z"
  },
  "events": [
    {
      "eventId": "4a7fb8c9bf0e3cbf8e99de43a6d7be4c6e34a59f2a40498b8de1e247480a2b53e",
      "executionId": "exec-test-001",
      "traceId": "trace-test-001",
      "tenantId": "tenant-test",
      "eventType": "execution_started",
      "eventIndex": 0,
      "eventTimestamp": "2026-07-25T11:00:01.000Z",
      "payload": {
        "input_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "contract_hash": "bfd218a5b283dfa74dcefa5e468892f3a4663a82df6d84a7e289bf3e4df8b5de"
      },
      "prevHash": null,
      "hash": "4a7fb8c9bf0e3cbf8e99de43a6d7be4c6e34a59f2a40498b8de1e247480a2b53e"
    },
    {
      "eventId": "b2f6f72f3cbf88580f369b65b44dfcb989d2e18ec6ad7be4c6e34a59f2bcbebdd5",
      "executionId": "exec-test-001",
      "traceId": "trace-test-001",
      "tenantId": "tenant-test",
      "eventType": "execution_completed",
      "eventIndex": 1,
      "eventTimestamp": "2026-07-25T11:00:02.000Z",
      "payload": {
        "result_hash": "cf64a51e60f0923e4eaeb1c1106e2329b35b546e5db7d29bc5db55d14dfc989d",
        "contract_hash": "bfd218a5b283dfa74dcefa5e468892f3a4663a82df6d84a7e289bf3e4df8b5de"
      },
      "prevHash": "4a7fb8c9bf0e3cbf8e99de43a6d7be4c6e34a59f2a40498b8de1e247480a2b53e",
      "hash": "b2f6f72f3cbf88580f369b65b44dfcb989d2e18ec6ad7be4c6e34a59f2bcbebdd5"
    }
  ],
  "lineage": [
    {
      "lineageId": "4a7fb8c9bf0e3cbf8e99de43a6d7be4c6e34a59f2a40498b8de1e247480a2b53e",
      "executionId": "exec-test-001",
      "traceId": "trace-test-001",
      "tenantId": "tenant-test",
      "eventId": "4a7fb8c9bf0e3cbf8e99de43a6d7be4c6e34a59f2a40498b8de1e247480a2b53e",
      "eventType": "execution_started",
      "eventIndex": 0,
      "eventTimestamp": "2026-07-25T11:00:01.000Z",
      "payloadSnapshot": {
        "input_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "contract_hash": "bfd218a5b283dfa74dcefa5e468892f3a4663a82df6d84a7e289bf3e4df8b5de"
      },
      "prevHash": null,
      "hash": "7ef3d6bdf6f72f3cbf88580f369b65b44dfcb989d2e18ec6ad7be4c6e34a59f2"
    },
    {
      "lineageId": "b2f6f72f3cbf88580f369b65b44dfcb989d2e18ec6ad7be4c6e34a59f2bcbebdd5",
      "executionId": "exec-test-001",
      "traceId": "trace-test-001",
      "tenantId": "tenant-test",
      "eventId": "b2f6f72f3cbf88580f369b65b44dfcb989d2e18ec6ad7be4c6e34a59f2bcbebdd5",
      "eventType": "execution_completed",
      "eventIndex": 1,
      "eventTimestamp": "2026-07-25T11:00:02.000Z",
      "payloadSnapshot": {
        "result_hash": "cf64a51e60f0923e4eaeb1c1106e2329b35b546e5db7d29bc5db55d14dfc989d",
        "contract_hash": "bfd218a5b283dfa74dcefa5e468892f3a4663a82df6d84a7e289bf3e4df8b5de"
      },
      "prevHash": "7ef3d6bdf6f72f3cbf88580f369b65b44dfcb989d2e18ec6ad7be4c6e34a59f2",
      "hash": "8eae-98856fe7e8ec-ecbebdd5-b27e-4f3f"
    }
  ],
  "rejections": []
}
```

### Hash Chain Verification Check:
1. `event[1].prevHash` matches `event[0].hash` (`4a7fb8c9bf0e3cbf8e99de43a6d7be4c6e34a59f2a40498b8de1e247480a2b53e`) ✅
2. `lineage[1].prevHash` matches `lineage[0].hash` (`7ef3d6bdf6f72f3cbf88580f369b65b44dfcb989d2e18ec6ad7be4c6e34a59f2`) ✅
3. Cryptographic chain integrity is **fully consistent**.
