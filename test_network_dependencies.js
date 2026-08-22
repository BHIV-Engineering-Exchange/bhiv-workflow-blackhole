require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios'); // Requires: npm install axios

async function testDependencies() {
    console.log("=== VANA GROUP 2: DEPENDENCY HEALTH CHECK ===\n");

    // 1. Check MasterDB
    console.log("-> 1. Testing MasterDB Connectivity...");
    const pool = new Pool({
        host: process.env.MASTERDB_HOST || '127.0.0.1',
        port: process.env.MASTERDB_PORT || 5432,
        user: process.env.MASTERDB_USER || 'vana_group2',
        password: process.env.MASTERDB_PASS || 'vana_local_pass',
        database: process.env.MASTERDB_NAME || 'vana_masterdb',
        connectionTimeoutMillis: 3000
    });

    try {
        await pool.query('SELECT 1');
        console.log("   [PASS] MasterDB is reachable.\n");
    } catch (err) {
        console.log("   [FAIL] MasterDB is UNREACHABLE. (Blocker: Waiting on Cloud DB from Infra)");
        console.log(`          Details: ${err.message}\n`);
    } finally {
        pool.end();
    }

    // 2. Check Group 1 API
    console.log("-> 2. Testing Group 1 (Canonical Observation) Connectivity...");
    const group1Url = process.env.GROUP1_API_URL || 'http://localhost:8003/api/observations';
    try {
        // We do a simple ping to see if the server responds
        await axios.get(group1Url, { timeout: 3000 });
        console.log("   [PASS] Group 1 API is reachable.\n");
    } catch (err) {
        // If it's a 404/401 it means the server is UP but the route/auth is strict. If code is ECONNREFUSED, it's down.
        if (err.response) {
            console.log("   [PASS] Group 1 API is reachable (Returned HTTP " + err.response.status + ").\n");
        } else {
            console.log("   [FAIL] Group 1 Endpoint UNREACHABLE at " + group1Url);
            console.log("          Ask Group 1 to boot their service locally.\n");
        }
    }

    // 3. Check SANSKAR Connectivity
    console.log("-> 3. Testing SANSKAR Context Engine Connectivity...");
    const sanskarUrl = process.env.SANSKAR_SERVICE_URL || 'http://localhost:8001/api/sanskar';
    try {
        await axios.get(sanskarUrl, { timeout: 3000 });
        console.log("   [PASS] SANSKAR Engine is reachable.\n");
    } catch (err) {
        if (err.response) {
            console.log("   [PASS] SANSKAR Engine is reachable (Returned HTTP " + err.response.status + ").\n");
        } else {
            console.log("   [FAIL] SANSKAR Endpoint UNREACHABLE at " + sanskarUrl);
            console.log("          Ask Pratik/Sakshi to verify SANSKAR port.\n");
        }
    }
}

testDependencies();
