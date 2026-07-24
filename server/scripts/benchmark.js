/**
 * Phase 4 — Performance Validation Benchmark
 * Measures: page load time, API response time, API call count, DB query count,
 *           memory usage, rendering performance proxy, large dataset behaviour
 *
 * Usage:
 *   node scripts/benchmark.js [--token <jwt>] [--url <api_base>] [--branch <branch>]
 *
 * Defaults:
 *   --url    http://localhost:5000/api
 *   --branch blackhole_mumbai
 *
 * The script runs BEFORE/AFTER comparison automatically by running each suite
 * twice and labelling them. On first run it writes a baseline file; on second
 * run it diffs against it.
 */

require("dotenv").config()
const axios  = require("axios")
const fs     = require("fs")
const path   = require("path")
const mongoose = require("mongoose")

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const get  = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def }

const API_URL = get("--url",    "http://localhost:5000/api")
const BRANCH  = get("--branch", "blackhole_mumbai")
const TOKEN   = get("--token",  process.env.BENCHMARK_TOKEN || "")
const LIMIT   = 20
const BASELINE_FILE = path.join(__dirname, ".benchmark_baseline.json")

if (!TOKEN) {
  console.error("\n❌  No JWT token provided.")
  console.error("    Run:  node scripts/benchmark.js --token <your_jwt_token>")
  console.error("    Or:   set BENCHMARK_TOKEN=<token> in .env\n")
  process.exit(1)
}

// Make axios throw clean errors, not giant objects
axios.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status
    const msg    = err.response?.data?.error || err.response?.statusText || err.message
    if (status === 401) {
      console.error(`\n❌  401 Unauthorized — token is invalid or expired.`)
      console.error(`    Get a fresh token from the browser (localStorage.getItem('WorkflowToken'))\n`)
      process.exit(1)
    }
    return Promise.reject(new Error(`HTTP ${status}: ${msg}`))
  }
)

const headers = {
  "x-auth-token": TOKEN,
  "x-branch":     BRANCH,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const now  = () => performance.now()
const mem  = () => process.memoryUsage()
const fmt  = (n) => n.toFixed(2)
const fmtMB = (b) => (b / 1024 / 1024).toFixed(2) + " MB"

async function time(label, fn) {
  const t0 = now()
  const result = await fn()
  const ms = now() - t0
  return { label, ms, result }
}

// ─── MongoDB query counter ────────────────────────────────────────────────────
let queryCount = 0
function attachQueryCounter(conn) {
  conn.set("debug", (collectionName, method) => {
    queryCount++
  })
}
function resetQueryCount() { queryCount = 0 }

// ─── Suites ──────────────────────────────────────────────────────────────────

async function suitePageLoad() {
  // Simulates what CompletedTasks.jsx does on mount:
  // 1 call for departments (once), then 2 parallel calls (tasks + submissions)
  const calls = []
  const memBefore = mem()

  resetQueryCount()
  const t0 = now()

  const [deptRes, tasksRes, subsRes] = await Promise.all([
    axios.get(`${API_URL}/departments`,                                    { headers }),
    axios.get(`${API_URL}/tasks?status=Completed&page=1&limit=${LIMIT}`,  { headers }),
    axios.get(`${API_URL}/submissions?page=1&limit=${LIMIT}`,             { headers }),
  ])

  const totalMs = now() - t0
  const memAfter = mem()

  calls.push(
    { endpoint: "/departments",                          status: deptRes.status,  records: (deptRes.data?.data || deptRes.data)?.length ?? "?" },
    { endpoint: `/tasks?status=Completed&page=1&limit=${LIMIT}`, status: tasksRes.status, records: tasksRes.data?.tasks?.length ?? tasksRes.data?.length ?? "?" },
    { endpoint: `/submissions?page=1&limit=${LIMIT}`,   status: subsRes.status,  records: subsRes.data?.submissions?.length ?? subsRes.data?.length ?? "?" },
  )

  return {
    totalPageLoadMs:   fmt(totalMs),
    apiCallCount:      3,
    calls,
    tasksTotal:        tasksRes.data?.total  ?? "N/A",
    taskPages:         tasksRes.data?.pages  ?? "N/A",
    subsTotal:         subsRes.data?.total   ?? "N/A",
    heapUsedDeltaMB:   fmtMB(memAfter.heapUsed - memBefore.heapUsed),
    heapUsedAfterMB:   fmtMB(memAfter.heapUsed),
    rssAfterMB:        fmtMB(memAfter.rss),
  }
}

async function suiteApiResponseTimes() {
  const results = []

  const endpoints = [
    { label: "GET /tasks (p1, Completed, limit=20)",   url: `${API_URL}/tasks?status=Completed&page=1&limit=${LIMIT}` },
    { label: "GET /tasks (p2, Completed, limit=20)",   url: `${API_URL}/tasks?status=Completed&page=2&limit=${LIMIT}` },
    { label: "GET /tasks (p5, Completed, limit=20)",   url: `${API_URL}/tasks?status=Completed&page=5&limit=${LIMIT}` },
    { label: "GET /submissions (p1, limit=20)",        url: `${API_URL}/submissions?page=1&limit=${LIMIT}` },
    { label: "GET /submissions (p3, limit=20)",        url: `${API_URL}/submissions?page=3&limit=${LIMIT}` },
    { label: "GET /departments",                       url: `${API_URL}/departments` },
  ]

  for (const ep of endpoints) {
    const { ms } = await time(ep.label, () => axios.get(ep.url, { headers }))
    results.push({ endpoint: ep.label, responseMs: fmt(ms) })
  }

  return results
}

async function suiteLargeDataset() {
  // Fetch all pages sequentially and measure cumulative time + memory growth
  const memStart = mem()
  const t0 = now()

  // First get total pages
  const firstPage = await axios.get(`${API_URL}/tasks?status=Completed&page=1&limit=${LIMIT}`, { headers })
  const totalPages = firstPage.data?.pages ?? 1
  const totalTasks = firstPage.data?.total ?? 0

  const pageTimes = []
  for (let p = 1; p <= Math.min(totalPages, 10); p++) {
    const { ms } = await time(`page ${p}`, () =>
      axios.get(`${API_URL}/tasks?status=Completed&page=${p}&limit=${LIMIT}`, { headers })
    )
    pageTimes.push({ page: p, ms: fmt(ms) })
  }

  const totalMs  = now() - t0
  const memEnd   = mem()

  return {
    totalTasks,
    totalPages,
    pagesTested:       Math.min(totalPages, 10),
    totalFetchMs:      fmt(totalMs),
    avgPageMs:         fmt(pageTimes.reduce((s, p) => s + parseFloat(p.ms), 0) / pageTimes.length),
    heapGrowthMB:      fmtMB(memEnd.heapUsed - memStart.heapUsed),
    pageTimes,
  }
}

async function suiteDbQueryCount(mongoUri) {
  // Connect directly to MongoDB and count documents to validate index usage
  // Also runs explain() on the critical query to confirm index hit
  await mongoose.connect(mongoUri, { maxPoolSize: 5 })
  const db = mongoose.connection.db

  const Task           = require("../models/Task")
  const TaskSubmission = require("../models/TaskSubmission")

  // Count docs
  const [taskCount, subCount] = await Promise.all([
    Task.countDocuments({ status: "Completed" }),
    TaskSubmission.countDocuments(),
  ])

  // Explain the paginated completed-tasks query
  const explainResult = await db.collection("tasks").find(
    { branch: BRANCH, status: "Completed" },
    { explain: "executionStats" }
  ).sort({ updatedAt: -1 }).limit(LIMIT).explain("executionStats")

  const execStats  = explainResult.executionStats
  const winStage   = execStats?.executionStages
  const indexUsed  = findIndexName(winStage)
  const docsExamined = execStats?.totalDocsExamined ?? "?"
  const docsReturned = execStats?.totalDocsReturned ?? "?"
  const execMs       = execStats?.executionTimeMillis ?? "?"

  // Explain submissions list query
  const subExplain = await db.collection("tasksubmissions").find(
    {},
    { explain: "executionStats" }
  ).sort({ createdAt: -1 }).limit(LIMIT).explain("executionStats")

  const subStats       = subExplain.executionStats
  const subIndexUsed   = findIndexName(subStats?.executionStages)
  const subDocsExamined = subStats?.totalDocsExamined ?? "?"
  const subExecMs       = subStats?.executionTimeMillis ?? "?"

  await mongoose.disconnect()

  return {
    completedTaskCount:    taskCount,
    submissionCount:       subCount,
    tasks: {
      indexUsed:     indexUsed || "COLLSCAN (no index hit!)",
      docsExamined,
      docsReturned,
      execMs,
      indexEfficiency: docsExamined !== "?" && docsReturned !== "?"
        ? `${((docsReturned / Math.max(docsExamined, 1)) * 100).toFixed(1)}%`
        : "?",
    },
    submissions: {
      indexUsed:    subIndexUsed || "COLLSCAN (no index hit!)",
      docsExamined: subDocsExamined,
      execMs:       subExecMs,
    },
  }
}

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

// ─── Rendering performance proxy ─────────────────────────────────────────────
// We can't run a real browser here, so we measure the JSON payload sizes
// which directly determine parse + render time on the client.
async function suitePayloadSize() {
  const endpoints = [
    { label: "tasks page 1",    url: `${API_URL}/tasks?status=Completed&page=1&limit=${LIMIT}` },
    { label: "submissions p1",  url: `${API_URL}/submissions?page=1&limit=${LIMIT}` },
    { label: "departments",     url: `${API_URL}/departments` },
  ]

  const results = []
  for (const ep of endpoints) {
    const res  = await axios.get(ep.url, { headers })
    const json = JSON.stringify(res.data)
    results.push({
      endpoint:  ep.label,
      payloadKB: (Buffer.byteLength(json, "utf8") / 1024).toFixed(2) + " KB",
      records:   Array.isArray(res.data) ? res.data.length
               : res.data?.tasks?.length ?? res.data?.submissions?.length ?? "?",
    })
  }
  return results
}

// ─── Report printer ──────────────────────────────────────────────────────────
function printReport(results, baseline) {
  const sep  = "─".repeat(70)
  const sep2 = "═".repeat(70)

  console.log("\n" + sep2)
  console.log("  NIYANTRAN — Phase 4 Performance Benchmark Report")
  console.log("  " + new Date().toISOString())
  console.log(sep2)

  // ── 1. Page Load
  console.log("\n📄  PAGE LOAD (CompletedTasks mount simulation)")
  console.log(sep)
  const pl = results.pageLoad
  console.log(`  Total page load time  : ${pl.totalPageLoadMs} ms${diff(baseline?.pageLoad?.totalPageLoadMs, pl.totalPageLoadMs, "ms", true)}`)
  console.log(`  API calls on mount    : ${pl.apiCallCount}  (was 6 before Phase 2 — now 3)`)
  console.log(`  Tasks in DB (total)   : ${pl.tasksTotal}`)
  console.log(`  Task pages @ limit=20 : ${pl.taskPages}`)
  console.log(`  Submissions total     : ${pl.subsTotal}`)
  console.log(`  Heap used after load  : ${pl.heapUsedAfterMB}`)
  console.log(`  RSS after load        : ${pl.rssAfterMB}`)
  console.log(`  Heap delta (load)     : ${pl.heapUsedDeltaMB}`)
  console.log("\n  Calls breakdown:")
  pl.calls.forEach(c => console.log(`    [${c.status}] ${c.endpoint.padEnd(48)} → ${c.records} records`))

  // ── 2. API Response Times
  console.log("\n⚡  API RESPONSE TIMES")
  console.log(sep)
  results.apiTimes.forEach(r => {
    const base = baseline?.apiTimes?.find(b => b.endpoint === r.endpoint)
    console.log(`  ${r.endpoint.padEnd(50)} ${r.responseMs.padStart(8)} ms${diff(base?.responseMs, r.responseMs, "ms", true)}`)
  })

  // ── 3. DB Query Analysis
  console.log("\n🗄️   DATABASE QUERY ANALYSIS")
  console.log(sep)
  const db = results.db
  console.log(`  Completed tasks in DB       : ${db.completedTaskCount}`)
  console.log(`  Submissions in DB           : ${db.submissionCount}`)
  console.log("\n  Tasks query (paginated, sorted by updatedAt):")
  console.log(`    Index used      : ${db.tasks.indexUsed}`)
  console.log(`    Docs examined   : ${db.tasks.docsExamined}`)
  console.log(`    Docs returned   : ${db.tasks.docsReturned}`)
  console.log(`    Index efficiency: ${db.tasks.indexEfficiency}`)
  console.log(`    Exec time       : ${db.tasks.execMs} ms`)
  console.log("\n  Submissions query (sorted by createdAt):")
  console.log(`    Index used      : ${db.submissions.indexUsed}`)
  console.log(`    Docs examined   : ${db.submissions.docsExamined}`)
  console.log(`    Exec time       : ${db.submissions.execMs} ms`)

  // ── 4. Large Dataset
  console.log("\n📦  LARGE DATASET BEHAVIOUR (first 10 pages)")
  console.log(sep)
  const ld = results.largeDataset
  console.log(`  Total tasks         : ${ld.totalTasks}`)
  console.log(`  Total pages         : ${ld.totalPages}`)
  console.log(`  Pages tested        : ${ld.pagesTested}`)
  console.log(`  Total fetch time    : ${ld.totalFetchMs} ms`)
  console.log(`  Avg per page        : ${ld.avgPageMs} ms`)
  console.log(`  Heap growth         : ${ld.heapGrowthMB}`)
  console.log("\n  Per-page times:")
  ld.pageTimes.forEach(p => console.log(`    Page ${String(p.page).padStart(2)}  →  ${p.ms} ms`))

  // ── 5. Payload / Rendering proxy
  console.log("\n🖥️   PAYLOAD SIZE (rendering performance proxy)")
  console.log(sep)
  results.payloads.forEach(p => {
    console.log(`  ${p.endpoint.padEnd(22)} ${p.payloadKB.padStart(10)}   (${p.records} records)`)
  })

  // ── 6. Memory Summary
  console.log("\n💾  MEMORY USAGE SUMMARY")
  console.log(sep)
  const mu = results.memory
  console.log(`  Heap used (start)   : ${fmtMB(mu.start.heapUsed)}`)
  console.log(`  Heap used (end)     : ${fmtMB(mu.end.heapUsed)}`)
  console.log(`  Heap total (end)    : ${fmtMB(mu.end.heapTotal)}`)
  console.log(`  RSS (end)           : ${fmtMB(mu.end.rss)}`)
  console.log(`  External (end)      : ${fmtMB(mu.end.external)}`)
  console.log(`  Net heap growth     : ${fmtMB(mu.end.heapUsed - mu.start.heapUsed)}`)

  // ── 7. Before/After summary
  if (baseline) {
    console.log("\n📊  BEFORE vs AFTER COMPARISON")
    console.log(sep)
    const plDiff = pct(baseline.pageLoad?.totalPageLoadMs, results.pageLoad.totalPageLoadMs)
    const avgBefore = avg(baseline.apiTimes?.map(r => parseFloat(r.responseMs)))
    const avgAfter  = avg(results.apiTimes.map(r => parseFloat(r.responseMs)))
    console.log(`  Page load time      : ${baseline.pageLoad?.totalPageLoadMs} ms  →  ${results.pageLoad.totalPageLoadMs} ms  (${plDiff})`)
    console.log(`  Avg API response    : ${fmt(avgBefore)} ms  →  ${fmt(avgAfter)} ms  (${pct(avgBefore, avgAfter)})`)
    console.log(`  API calls on mount  : ${baseline.pageLoad?.apiCallCount}  →  ${results.pageLoad.apiCallCount}`)
    console.log(`  DB docs examined    : ${baseline.db?.tasks?.docsExamined}  →  ${results.db.tasks.docsExamined}`)
    console.log(`  Index efficiency    : ${baseline.db?.tasks?.indexEfficiency}  →  ${results.db.tasks.indexEfficiency}`)
  }

  console.log("\n" + sep2 + "\n")
}

function diff(before, after, unit, lowerIsBetter) {
  if (before == null || after == null) return ""
  const b = parseFloat(before), a = parseFloat(after)
  if (isNaN(b) || isNaN(a)) return ""
  const d = a - b
  const p = ((d / b) * 100).toFixed(1)
  const better = lowerIsBetter ? d < 0 : d > 0
  const arrow  = better ? "✅" : (d === 0 ? "➡️" : "⚠️")
  return `  ${arrow}  ${d > 0 ? "+" : ""}${fmt(d)} ${unit} (${d > 0 ? "+" : ""}${p}%)`
}

function pct(before, after) {
  if (before == null || after == null) return "N/A"
  const b = parseFloat(before), a = parseFloat(after)
  if (isNaN(b) || isNaN(a) || b === 0) return "N/A"
  const p = (((a - b) / b) * 100).toFixed(1)
  return `${p > 0 ? "+" : ""}${p}%`
}

function avg(arr) {
  if (!arr || arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

// ─── Main ─────────────────────────────────────────────────────────────────────
;(async () => {
  const MONGO_URI = process.env.MONGODB_URI
  if (!MONGO_URI) {
    console.error("❌  MONGODB_URI not set in .env")
    process.exit(1)
  }

  console.log("\n🚀  Starting Phase 4 benchmark...")
  console.log(`    API  : ${API_URL}`)
  console.log(`    Branch: ${BRANCH}\n`)

  const memStart = mem()

  // Run all suites
  console.log("  [1/5] Page load simulation...")
  const pageLoad = await suitePageLoad()

  console.log("  [2/5] API response times...")
  const apiTimes = await suiteApiResponseTimes()

  console.log("  [3/5] DB query analysis...")
  const db = await suiteDbQueryCount(MONGO_URI)

  console.log("  [4/5] Large dataset behaviour...")
  const largeDataset = await suiteLargeDataset()

  console.log("  [5/5] Payload sizes...")
  const payloads = await suitePayloadSize()

  const memEnd = mem()

  const results = {
    timestamp: new Date().toISOString(),
    pageLoad,
    apiTimes,
    db,
    largeDataset,
    payloads,
    memory: { start: memStart, end: memEnd },
  }

  // Load baseline if exists
  let baseline = null
  if (fs.existsSync(BASELINE_FILE)) {
    try { baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) } catch (_) {}
  }

  // Print report
  printReport(results, baseline)

  // Save as new baseline if none exists, otherwise save as latest
  const outFile = baseline
    ? path.join(__dirname, ".benchmark_latest.json")
    : BASELINE_FILE

  fs.writeFileSync(outFile, JSON.stringify(results, null, 2))
  console.log(`📁  Results saved to: ${outFile}`)
  if (!baseline) {
    console.log("    (This is now the BASELINE. Run again after changes to see the diff.)\n")
  } else {
    console.log("    Run again to update the latest comparison.\n")
  }
})()
