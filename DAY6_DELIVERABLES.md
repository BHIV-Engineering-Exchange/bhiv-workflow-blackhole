# Group 2: Runtime & Deployment Integration Report (Day-6)
**Owner:** Pritesh (Runtime & Deployment Integration Engineer)
**Status:** BLOCKED ON SHARED MASTERDB

## 1. Group 2 Runtime/Service Startup Path
The Group 2 runtime (Scientific Context + SANSKAR integration) is configured as a local callable service. It expects a canonical observation payload and returns a contextualised result.

**Reproducible Startup Commands:**
```bash
# 1. Install dependencies
npm install

# 2. Setup Environment Variables
cp .env.example .env
# Edit .env with the configurations below

# 3. Boot the Group 2 Context Provider & SANSKAR Wrapper
npm run start:group2
# OR if using docker
docker-compose --profile group2 up -d
```

## 2. Environment & Connectivity Configuration
The runtime requires the following environment variables to map the data layer, SANSKAR, and MasterDB.

```env
# ENVIRONMENT/DEPENDENCY CONFIGURATION
NODE_ENV=development
SANSKAR_SERVICE_URL=http://localhost:8001/api/sanskar
GROUP1_INGESTION_URL=http://localhost:8003/api/observation

# MASTERDB CONNECTIVITY CONFIGURATION
# ⚠️ CAUTION: Currently mapped to LOCAL network.
MASTERDB_HOST=127.0.0.1
MASTERDB_PORT=5432
MASTERDB_USER=vana_group2
MASTERDB_PASS=vana_local_pass
MASTERDB_NAME=vana_masterdb
```

## 3. Health / Readiness Check
Another engineer can verify the Group 2 runtime is awake and ready to accept Group 1 canonical observations by pinging the health endpoint:

```bash
curl -X GET http://localhost:8002/api/v1/health -H "Accept: application/json"

# Expected Response:
# {
#   "status": "UP",
#   "layer": "Group 2 - Scientific Context",
#   "dependencies": {
#     "SANSKAR": "CONNECTED",
#     "MasterDB": "LOCAL_ONLY - WARNING"
#   }
# }
```

## 4. Integration Test (Group 2 -> Data Layer)
This minimal test verifies that the Group 2 runtime can read a context parameter from the data layer successfully.

```javascript
// test_db_read.js
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.MASTERDB_HOST,
  port: process.env.MASTERDB_PORT,
  user: process.env.MASTERDB_USER,
  password: process.env.MASTERDB_PASS,
  database: process.env.MASTERDB_NAME
});

async function runTest() {
  try {
    const res = await pool.query('SELECT 1 as "db_connection_test"');
    console.log("[PASS] MasterDB Connectivity Confirmed:", res.rows[0]);
  } catch (err) {
    console.error("[FAIL] MasterDB Connection Failed:", err.message);
    process.exit(1);
  } finally {
    pool.end();
  }
}
runTest();
```

## 5. Deployment / Access Blocker Report
**CRITICAL INFRASTRUCTURE BLOCKER**
**Status:** NOT LIVE FOR INTER-GROUP AUTOMATION 🚫

*   **Blocker:** The shared `MasterDB` is physically unavailable over the network to other Groups. The database remains locked to a local or private subnet.
*   **Impact:** While Group 2 runs successfully in isolation via localhost, Group 1, 3, and 4 cannot programmatically hit the Group 2 endpoints without Pritesh manually exposing ports or running the service on his local machine.
*   **Explicit Claim:** Group 2 is **NOT** "Live". It is "Locally Integrated".
*   **Required Action from DevOps/Infra:** MasterDB must be deployed to a shared namespace/VPC (e.g., RDS or shared cluster) with a canonical connection string issued to Group 2 so we can swap `localhost:5432` for the public/shared internal hostname. Until then, acceptance condition "Another engineer must be able to invoke Group 2 without requiring Pritesh..." is **BLOCKED**.
