require('dotenv').config();
const { Pool } = require('pg');

// This script expects .env variables, but defaults to local testing parameters
const pool = new Pool({
    host: process.env.MASTERDB_HOST || '127.0.0.1',
    port: process.env.MASTERDB_PORT || 5432,
    user: process.env.MASTERDB_USER || 'vana_group2',
    password: process.env.MASTERDB_PASS || 'vana_local_pass',
    database: process.env.MASTERDB_NAME || 'vana_masterdb'
});

async function runTest() {
    console.log("Attempting to connect to MasterDB (Data Layer)...");
    try {
        // A simple query to prove the database connection actually works
        const res = await pool.query('SELECT 1 as "db_connection_test"');
        console.log("[PASS] MasterDB Connectivity Confirmed. Response:", res.rows[0]);
        console.log("Ready to receive/write Group 1 Canonical Observations.");
    } catch (err) {
        console.error("[FAIL] MasterDB Connection Failed.");
        console.error("Error Details:", err.message);
        console.error("Action Required: Ensure local Postgres is running or wait for Infra to provide Cloud URL.");
        process.exit(1);
    } finally {
        pool.end();
    }
}

runTest();
