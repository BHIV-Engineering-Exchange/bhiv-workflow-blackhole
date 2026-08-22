# Group 2: Runtime & Deployment Integration Report (Day-7)
**Owner:** Pritesh Patra (Runtime & Deployment Integration Engineer)
**Status:** AMBER (Code Ready. Blocked on Shared MasterDB Infrastructure)

## 1. Runtime Startup Procedure
Group 2's science/context layer is packaged and ready to run anywhere.

**Reproducible Startup Commands:**
```bash
# 1. Install Node dependencies
npm install

# 2. Configure Environment (Copy example file and edit)
cp .env.example .env

# 3. Start the Group 2 Runtime
npm run start:group2
```
*Acceptance Check: This allows any engineer to clone the system and turn it on independently. No manual, hidden services required.*

## 2. Environment Configuration
For Group 2 to talk to Group 1, SANSKAR, and MasterDB, the following `.env` configuration template must be used:

```env
# GROUP 2 RUNTIME ENVIRONMENT CONFIGURATION
NODE_ENV=development
GROUP2_PORT=8002

# SANSKAR CONNECTIVITY
SANSKAR_SERVICE_URL=http://localhost:8001/api/sanskar

# GROUP 1 CONNECTIVITY (For Canonical Observations)
GROUP1_API_URL=http://localhost:8003/api/observations

# MASTERDB CONNECTIVITY
MASTERDB_HOST=127.0.0.1
MASTERDB_PORT=5432
MASTERDB_USER=vana_group2
MASTERDB_PASS=vana_local_pass
MASTERDB_NAME=vana_masterdb
```

## 3. Health & Readiness Endpoint
Other groups can verify Group 2 is alive by pinging the root health endpoint.
**Command:** `curl -X GET http://localhost:8002/api/v1/health`

## 4. Dependency Health Matrix
Group 2 relies on three external systems. The matrix below shows current integration health based on our local test harness.

| Dependency | Required For | Connectivity Status | Network State |
| :--- | :--- | :--- | :--- |
| **Group 1 API** | Fetching Canonical Observations | **PASS** (Local Config) | Configurable via `.env` |
| **SANSKAR** | Generating Contextual Result | **PASS** (Local Config) | Configurable via `.env` |
| **MasterDB** | Storing structured context layer | **FAILED / BLOCKED** | Local Only - No Cloud URL provided |

## 5 & 6. Group 1 & SANSKAR Connectivity Tests
I have created a unified test script (`test_network_dependencies.js`) that physically pings Group 1, SANSKAR, and the MasterDB based on the provided `.env` variables.

**How to run the temporary integration method test:**
```bash
node test_network_dependencies.js
```
*(This script proves the code is completely ready to swap to shared endpoints. It will return PASS for any service you have running locally, and FAIL safely for endpoints that are offline.)*

## 7. MasterDB Status
**Status: OFFLINE FOR CROSS-GROUP INTEGRATION (Local Testing Only)**
The database interface is fully coded, built, and tested locally. However, we do not have a live integration because the shared infrastructure does not exist yet.

## 8. Deployment Blocker & Recovery Record
* **Exact Blocker:** The `MasterDB` is currently running on `127.0.0.1`. Software running on Group 1's laptops or Group 4's servers cannot reach Pritesh's local machine to save or read intelligence.
* **Required Infrastructure Action:** DevOps/Infra team must deploy a shared PostgreSQL database (e.g., AWS RDS) in the VANA VPC, open the security groups to our team, and issue the Canonical Connection String to Group 2.
* **Temporary Integration Method:** For today's testing, Group 1 and SANSKAR engineers can run their services locally on ports `8001` and `8003`, and point their own Group 2 instance to localhost.
* **Recovery / Swap Evidence:** Once the shared DB is issued, Group 2 does **not** need to rewrite code. We will simply update the `.env` variables (`MASTERDB_HOST` and `MASTERDB_PASS`) and restart the service. Integration will resume instantly.
