/**
 * fix-task-indexes.js
 * 
 * Problem: MongoDB query planner prefers the older branch_1_status_1 index
 *          over the new covering index branch_1_status_1_updatedAt_-1,
 *          so the paginated completed-tasks query still examines 2088 docs.
 *
 * Fix:     Drop branch_1_status_1 (it is fully subsumed by the covering index).
 *          The covering index satisfies every query the old one did, plus
 *          eliminates the in-memory sort on updatedAt.
 *
 * Usage:   node scripts/fix-task-indexes.js
 */

require("dotenv").config()
const mongoose = require("mongoose")

const MONGO_URI = process.env.MONGODB_URI
const BRANCH    = "blackhole_mumbai"
const LIMIT     = 20

;(async () => {
  if (!MONGO_URI) { console.error("❌  MONGODB_URI not set"); process.exit(1) }

  console.log("\n🔧  Connecting to MongoDB Atlas...")
  await mongoose.connect(MONGO_URI, { maxPoolSize: 5 })
  const db   = mongoose.connection.db
  const col  = db.collection("tasks")

  // ── 1. List current indexes ──────────────────────────────────────────────
  const before = await col.indexes()
  console.log("\n📋  Current indexes on tasks collection:")
  before.forEach(idx => console.log(`    ${idx.name}  →  ${JSON.stringify(idx.key)}`))

  // ── 2. Check covering index exists ──────────────────────────────────────
  const coveringExists = before.some(i => i.name === "branch_1_status_1_updatedAt_-1")
  if (!coveringExists) {
    console.log("\n⚠️   Covering index branch_1_status_1_updatedAt_-1 not found yet.")
    console.log("    Mongoose ensureIndexes runs on server startup.")
    console.log("    Restart the server once, then re-run this script.\n")
    await mongoose.disconnect()
    process.exit(0)
  }
  console.log("\n✅  Covering index branch_1_status_1_updatedAt_-1 confirmed present.")

  // ── 3. Drop the redundant branch_1_status_1 index ───────────────────────
  const redundantExists = before.some(i => i.name === "branch_1_status_1")
  if (redundantExists) {
    console.log("\n🗑️   Dropping redundant index branch_1_status_1...")
    await col.dropIndex("branch_1_status_1")
    console.log("    ✅  Dropped.")
  } else {
    console.log("\n✅  branch_1_status_1 already removed — nothing to drop.")
  }

  // ── 4. List indexes after ────────────────────────────────────────────────
  const after = await col.indexes()
  console.log("\n📋  Indexes after fix:")
  after.forEach(idx => console.log(`    ${idx.name}  →  ${JSON.stringify(idx.key)}`))

  // ── 5. Run explain to confirm covering index is now used ─────────────────
  console.log("\n🔍  Running explain on paginated completed-tasks query...")
  const explain = await col
    .find({ branch: BRANCH, status: "Completed" })
    .sort({ updatedAt: -1 })
    .limit(LIMIT)
    .explain("executionStats")

  const stats      = explain.executionStats
  const indexUsed  = findIndexName(stats?.executionStages)
  const docsExamined = stats?.totalDocsExamined ?? "?"
  const docsReturned = stats?.totalDocsReturned ?? "?"
  const execMs       = stats?.executionTimeMillis ?? "?"

  console.log(`\n  Index used      : ${indexUsed || "COLLSCAN ❌"}`)
  console.log(`  Docs examined   : ${docsExamined}`)
  console.log(`  Docs returned   : ${docsReturned}`)
  console.log(`  Exec time       : ${execMs} ms`)

  if (indexUsed === "branch_1_status_1_updatedAt_-1") {
    const efficiency = docsReturned !== "?" && docsExamined !== "?"
      ? `${((docsReturned / Math.max(docsExamined, 1)) * 100).toFixed(1)}%`
      : "?"
    console.log(`  Index efficiency: ${efficiency}`)
    console.log("\n✅  FIXED — query planner is now using the covering index.")
    console.log("    Docs examined should equal docs returned (100% efficiency).\n")
  } else {
    console.log(`\n⚠️   Query planner chose: ${indexUsed}`)
    console.log("    This can happen if Atlas hasn't finished building the index.")
    console.log("    Wait 1-2 minutes and re-run this script.\n")
  }

  await mongoose.disconnect()
})()

function findIndexName(stage) {
  if (!stage) return null
  if (stage.indexName) return stage.indexName
  if (stage.inputStage) return findIndexName(stage.inputStage)
  if (stage.inputStages) {
    for (const s of stage.inputStages) {
      const r = findIndexName(s)
      if (r) return r
    }
  }
  return null
}
