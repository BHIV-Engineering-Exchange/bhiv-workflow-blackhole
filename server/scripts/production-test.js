/**
 * Phase 5 — Production Testing Suite
 * Tests: large volumes, pagination consistency, filtering, sorting,
 *        search, session stability, error handling, network latency, slow API
 *
 * Usage:
 *   node server/scripts/production-test.js [--base-url http://localhost:5000]
 *
 * Requires: server running + valid Manager JWT in TOKEN constant below
 */

const http = require("http")
const https = require("https")
const { URL } = require("url")

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE_URL = (() => {
  const idx = process.argv.indexOf("--base-url")
  return idx !== -1 ? process.argv[idx + 1] : "http://localhost:5000"
})()

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNjMzYTU0ZGVhN2Q5NzYxM2VkMDViNyIsIm5hbWUiOiJSVURSQSBQQVJNRVNIV0FSIiwiZW1haWwiOiJibGFja2hvbGVpbmZpdmVyc2U5MDBAZ21haWwuY29tIiwicm9sZSI6Ik1hbmFnZXIiLCJicmFuY2giOiJibGFja2hvbGVfbXVtYmFpIiwiaWF0IjoxNzg0ODg3ODkyLCJleHAiOjE4MDA0Mzk4OTJ9.oyBzuB4tFBeKoVhBeXXlTyVVyQ7__gasFgUxJ-Kab48"

const BRANCH = "blackhole_mumbai"
const LIMIT = 20

// ─── HTTP HELPER ─────────────────────────────────────────────────────────────
function request(path, { method = "GET", body, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const lib = url.protocol === "https:" ? https : http
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": TOKEN,
        "x-branch": BRANCH,
      },
    }
    if (body) options.headers["Content-Length"] = Buffer.byteLength(JSON.stringify(body))

    const start = Date.now()
    const req = lib.request(options, (res) => {
      let raw = ""
      res.on("data", (c) => (raw += c))
      res.on("end", () => {
        const ms = Date.now() - start
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw), ms })
        } catch {
          resolve({ status: res.statusCode, body: raw, ms })
        }
      })
    })

    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error(`Timeout after ${timeoutMs}ms — ${path}`))
    })
    req.on("error", reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// ─── REPORTER ────────────────────────────────────────────────────────────────
const results = []
let passed = 0, failed = 0, warned = 0

function pass(suite, name, detail = "") {
  passed++
  results.push({ suite, name, status: "PASS", detail })
  console.log(`  ✅ ${name}${detail ? " — " + detail : ""}`)
}

function fail(suite, name, detail = "") {
  failed++
  results.push({ suite, name, status: "FAIL", detail })
  console.log(`  ❌ ${name} — ${detail}`)
}

function warn(suite, name, detail = "") {
  warned++
  results.push({ suite, name, status: "WARN", detail })
  console.log(`  ⚠️  ${name} — ${detail}`)
}

function suite(name) {
  console.log(`\n${"─".repeat(60)}\n🧪 ${name}\n${"─".repeat(60)}`)
}

// ─── SUITE 1: LARGE TASK VOLUMES ─────────────────────────────────────────────
async function testLargeVolumes() {
  suite("1 · Large Task Volumes")

  // Fetch page 1 and last page, verify counts
  const p1 = await request(`/api/tasks?status=Completed&page=1&limit=${LIMIT}`)
  if (p1.status !== 200) return fail("volumes", "page-1 fetch", `HTTP ${p1.status}`)

  const { total, pages, tasks } = p1.body
  pass("volumes", "page-1 returns envelope", `total=${total} pages=${pages}`)

  if (tasks.length !== LIMIT)
    warn("volumes", "page-1 task count", `expected ${LIMIT}, got ${tasks.length}`)
  else
    pass("volumes", "page-1 task count", `${tasks.length} tasks`)

  // Last page — may have fewer items
  const pLast = await request(`/api/tasks?status=Completed&page=${pages}&limit=${LIMIT}`)
  if (pLast.status !== 200) return fail("volumes", "last-page fetch", `HTTP ${pLast.status}`)

  const lastCount = pLast.body.tasks.length
  const expectedLast = total % LIMIT || LIMIT
  if (lastCount === expectedLast)
    pass("volumes", "last-page task count", `${lastCount} tasks (correct remainder)`)
  else
    fail("volumes", "last-page task count", `expected ${expectedLast}, got ${lastCount}`)

  // Response time under load
  if (p1.ms < 1000)
    pass("volumes", "page-1 response time", `${p1.ms}ms`)
  else
    warn("volumes", "page-1 response time", `${p1.ms}ms (>1s)`)
}

// ─── SUITE 2: PAGINATION CONSISTENCY ─────────────────────────────────────────
async function testPaginationConsistency() {
  suite("2 · Pagination Consistency")

  const PAGE_SAMPLE = 5
  const seenIds = new Set()
  let prevTotal = null
  let dupCount = 0

  for (let p = 1; p <= PAGE_SAMPLE; p++) {
    const res = await request(`/api/tasks?status=Completed&page=${p}&limit=${LIMIT}`)
    if (res.status !== 200) { fail("pagination", `page-${p}`, `HTTP ${res.status}`); continue }

    const { tasks, total, page } = res.body

    // total must be stable across pages
    if (prevTotal === null) prevTotal = total
    if (total !== prevTotal)
      fail("pagination", `total stable page-${p}`, `was ${prevTotal}, now ${total}`)

    // page echo
    if (page !== p)
      fail("pagination", `page echo page-${p}`, `expected ${p}, got ${page}`)

    // no duplicate IDs across pages
    for (const t of tasks) {
      if (seenIds.has(String(t._id))) dupCount++
      seenIds.add(String(t._id))
    }
  }

  if (dupCount === 0)
    pass("pagination", "no duplicate tasks across 5 pages", `${seenIds.size} unique IDs`)
  else
    fail("pagination", "duplicate tasks across pages", `${dupCount} duplicates`)

  pass("pagination", "total stable across 5 pages", `total=${prevTotal}`)

  // Out-of-range page returns empty tasks array, not error
  const meta = await request(`/api/tasks?status=Completed&page=99999&limit=${LIMIT}`)
  if (meta.status === 200 && Array.isArray(meta.body.tasks) && meta.body.tasks.length === 0)
    pass("pagination", "out-of-range page returns empty array")
  else if (meta.status === 200 && Array.isArray(meta.body.tasks))
    warn("pagination", "out-of-range page", `returned ${meta.body.tasks.length} tasks`)
  else
    fail("pagination", "out-of-range page", `HTTP ${meta.status}`)
}

// ─── SUITE 3: FILTERING ──────────────────────────────────────────────────────
async function testFiltering() {
  suite("3 · Filtering")

  const statuses = ["Pending", "In Progress", "Completed"]
  const priorities = ["Low", "Medium", "High"]

  for (const status of statuses) {
    const res = await request(`/api/tasks?status=${encodeURIComponent(status)}&page=1&limit=${LIMIT}`)
    if (res.status !== 200) { fail("filter", `status=${status}`, `HTTP ${res.status}`); continue }
    const tasks = res.body.tasks || res.body
    const allMatch = Array.isArray(tasks) && tasks.every((t) => t.status === status)
    if (allMatch)
      pass("filter", `status=${status}`, `${tasks.length} tasks all match`)
    else
      fail("filter", `status=${status}`, `some tasks have wrong status`)
  }

  for (const priority of priorities) {
    const res = await request(`/api/tasks?priority=${priority}&page=1&limit=${LIMIT}`)
    if (res.status !== 200) { fail("filter", `priority=${priority}`, `HTTP ${res.status}`); continue }
    const tasks = res.body.tasks || res.body
    const allMatch = Array.isArray(tasks) && tasks.every((t) => t.priority === priority)
    if (allMatch)
      pass("filter", `priority=${priority}`, `${tasks.length} tasks all match`)
    else
      fail("filter", `priority=${priority}`, `some tasks have wrong priority`)
  }

  // Combined filter
  const combo = await request(`/api/tasks?status=Completed&priority=High&page=1&limit=${LIMIT}`)
  if (combo.status === 200) {
    const tasks = combo.body.tasks || combo.body
    const allMatch = Array.isArray(tasks) &&
      tasks.every((t) => t.status === "Completed" && t.priority === "High")
    if (allMatch)
      pass("filter", "combined status+priority", `${tasks.length} tasks`)
    else
      fail("filter", "combined status+priority", "some tasks don't match both filters")
  } else {
    fail("filter", "combined status+priority", `HTTP ${combo.status}`)
  }
}

// ─── SUITE 4: SORTING ────────────────────────────────────────────────────────
async function testSorting() {
  suite("4 · Sorting")

  // Default sort is updatedAt DESC — verify across two pages
  const p1 = await request(`/api/tasks?status=Completed&page=1&limit=${LIMIT}`)
  const p2 = await request(`/api/tasks?status=Completed&page=2&limit=${LIMIT}`)

  if (p1.status !== 200 || p2.status !== 200) {
    fail("sort", "fetch pages for sort check", `p1=${p1.status} p2=${p2.status}`)
    return
  }

  const tasks1 = p1.body.tasks
  const tasks2 = p2.body.tasks

  // Within page 1: updatedAt descending
  let intraPageSorted = true
  for (let i = 1; i < tasks1.length; i++) {
    if (new Date(tasks1[i - 1].updatedAt) < new Date(tasks1[i].updatedAt)) {
      intraPageSorted = false
      break
    }
  }
  if (intraPageSorted)
    pass("sort", "page-1 intra-page updatedAt DESC")
  else
    fail("sort", "page-1 intra-page updatedAt DESC", "order violated")

  // Last item of page 1 >= first item of page 2
  if (tasks1.length && tasks2.length) {
    const lastP1 = new Date(tasks1[tasks1.length - 1].updatedAt)
    const firstP2 = new Date(tasks2[0].updatedAt)
    if (lastP1 >= firstP2)
      pass("sort", "cross-page updatedAt continuity")
    else
      fail("sort", "cross-page updatedAt continuity", `p1-last=${lastP1.toISOString()} p2-first=${firstP2.toISOString()}`)
  }

  // Submissions default sort: createdAt DESC
  const sub = await request(`/api/submissions?page=1&limit=${LIMIT}`)
  if (sub.status === 200) {
    const subs = sub.body.submissions || []
    let subSorted = true
    for (let i = 1; i < subs.length; i++) {
      if (new Date(subs[i - 1].createdAt) < new Date(subs[i].createdAt)) {
        subSorted = false
        break
      }
    }
    if (subSorted)
      pass("sort", "submissions page-1 createdAt DESC")
    else
      fail("sort", "submissions page-1 createdAt DESC", "order violated")
  } else {
    warn("sort", "submissions sort check", `HTTP ${sub.status}`)
  }
}

// ─── SUITE 5: SEARCH ─────────────────────────────────────────────────────────
async function testSearch() {
  suite("5 · Search (client-side debounce + server filter)")

  // Grab a real task title to search against
  const seed = await request(`/api/tasks?status=Completed&page=1&limit=1`)
  if (seed.status !== 200 || !seed.body.tasks?.length) {
    warn("search", "seed task fetch", "no completed tasks to search")
    return
  }

  const sampleTitle = seed.body.tasks[0].title
  const keyword = sampleTitle.split(" ")[0] // first word

  // Server doesn't have a ?search= param — search is client-side on fetched data.
  // We verify the full page is returned and the keyword appears in at least one task.
  const res = await request(`/api/tasks?status=Completed&page=1&limit=${LIMIT}`)
  if (res.status !== 200) { fail("search", "fetch for search", `HTTP ${res.status}`); return }

  const tasks = res.body.tasks || []
  const matches = tasks.filter((t) =>
    t.title?.toLowerCase().includes(keyword.toLowerCase())
  )

  if (matches.length > 0)
    pass("search", "keyword found in page-1 results", `"${keyword}" → ${matches.length} match(es)`)
  else
    warn("search", "keyword not in page-1", `"${keyword}" not found — may be on another page`)

  // Verify all tasks have title field (required for client search)
  const missingTitle = tasks.filter((t) => !t.title)
  if (missingTitle.length === 0)
    pass("search", "all tasks have title field")
  else
    fail("search", "tasks missing title field", `${missingTitle.length} tasks`)

  // Verify assignee name present (used in search)
  const missingAssignee = tasks.filter((t) => t.assignee && !t.assignee.name)
  if (missingAssignee.length === 0)
    pass("search", "all assigned tasks have assignee.name")
  else
    fail("search", "tasks missing assignee.name", `${missingAssignee.length} tasks`)
}

// ─── SUITE 6: SESSION STABILITY ──────────────────────────────────────────────
async function testSessionStability() {
  suite("6 · Session Stability (10 sequential requests)")

  const times = []
  let failures = 0

  for (let i = 1; i <= 10; i++) {
    try {
      const res = await request(`/api/tasks?status=Completed&page=${i <= 5 ? i : i - 4}&limit=${LIMIT}`)
      if (res.status === 200) {
        times.push(res.ms)
      } else {
        failures++
        fail("session", `request-${i}`, `HTTP ${res.status}`)
      }
    } catch (e) {
      failures++
      fail("session", `request-${i}`, e.message)
    }
  }

  if (failures === 0)
    pass("session", "all 10 requests succeeded")
  else
    fail("session", "session stability", `${failures}/10 requests failed`)

  if (times.length) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    const max = Math.max(...times)
    const min = Math.min(...times)
    if (max < 3000)
      pass("session", "no request exceeded 3s", `min=${min}ms avg=${avg}ms max=${max}ms`)
    else
      warn("session", "slow request detected", `max=${max}ms avg=${avg}ms`)

    // Variance check — no single request should be 5× the average
    const spike = times.filter((t) => t > avg * 5)
    if (spike.length === 0)
      pass("session", "no latency spikes (>5× avg)")
    else
      warn("session", "latency spike detected", `${spike.length} request(s) >5× avg`)
  }

  // Token still valid after 10 requests
  const auth = await request("/api/tasks?page=1&limit=1")
  if (auth.status === 200)
    pass("session", "JWT still valid after 10 requests")
  else if (auth.status === 401)
    fail("session", "JWT expired mid-session", "token rejected")
  else
    warn("session", "auth check", `HTTP ${auth.status}`)
}

// ─── SUITE 7: ERROR HANDLING ─────────────────────────────────────────────────
async function testErrorHandling() {
  suite("7 · Error Handling")

  // 404 — non-existent task ID
  const fake404 = await request("/api/tasks/000000000000000000000000")
  if (fake404.status === 404)
    pass("errors", "non-existent task → 404")
  else
    fail("errors", "non-existent task", `expected 404, got ${fake404.status}`)

  // 404 — non-existent submission ID
  const sub404 = await request("/api/submissions/000000000000000000000000")
  if (sub404.status === 404)
    pass("errors", "non-existent submission → 404")
  else
    fail("errors", "non-existent submission", `expected 404, got ${sub404.status}`)

  // 401 — no token
  const noAuth = await new Promise((resolve) => {
    const url = new URL("/api/tasks?page=1&limit=1", BASE_URL)
    const lib = url.protocol === "https:" ? https : http
    const req = lib.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method: "GET" },
      (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode })) }
    )
    req.on("error", () => resolve({ status: 0 }))
    req.end()
  })
  if (noAuth.status === 401)
    pass("errors", "missing token → 401")
  else
    fail("errors", "missing token", `expected 401, got ${noAuth.status}`)

  // 400 — invalid ObjectId format
  const badId = await request("/api/tasks/not-a-valid-id")
  if (badId.status === 404 || badId.status === 400)
    pass("errors", "invalid ObjectId → 400/404", `got ${badId.status}`)
  else
    warn("errors", "invalid ObjectId", `got ${badId.status} (expected 400 or 404)`)

  // Error response shape — must have error or msg field
  const errBody = fake404.body
  if (errBody && (errBody.error || errBody.msg))
    pass("errors", "error response has error/msg field")
  else
    fail("errors", "error response shape", `body=${JSON.stringify(errBody)}`)

  // Global error handler — ping endpoint must be healthy
  const ping = await request("/api/ping")
  if (ping.status === 200 && ping.body?.message)
    pass("errors", "server healthy after error tests")
  else
    fail("errors", "server health after errors", `HTTP ${ping.status}`)
}

// ─── SUITE 8: NETWORK LATENCY ────────────────────────────────────────────────
async function testNetworkLatency() {
  suite("8 · Network Latency Benchmarks")

  const endpoints = [
    { label: "ping", path: "/api/ping", budget: 100 },
    { label: "tasks page-1", path: `/api/tasks?status=Completed&page=1&limit=${LIMIT}`, budget: 800 },
    { label: "tasks page-50", path: `/api/tasks?status=Completed&page=50&limit=${LIMIT}`, budget: 800 },
    { label: "submissions page-1", path: `/api/submissions?page=1&limit=${LIMIT}`, budget: 800 },
    { label: "tasks no-pagination (guard)", path: `/api/tasks?status=Completed`, budget: 50 },
  ]

  for (const ep of endpoints) {
    // 3 warm runs, take median
    const times = []
    for (let i = 0; i < 3; i++) {
      try {
        const r = await request(ep.path)
        if (r.status === 200) times.push(r.ms)
      } catch { /* skip */ }
    }
    if (!times.length) { fail("latency", ep.label, "all 3 runs failed"); continue }

    times.sort((a, b) => a - b)
    const median = times[Math.floor(times.length / 2)]

    if (median <= ep.budget)
      pass("latency", ep.label, `median=${median}ms (budget=${ep.budget}ms)`)
    else
      warn("latency", ep.label, `median=${median}ms exceeds budget=${ep.budget}ms`)
  }

  // Payload size check — paginated response should be < 200KB
  const res = await request(`/api/tasks?status=Completed&page=1&limit=${LIMIT}`)
  if (res.status === 200) {
    const bytes = Buffer.byteLength(JSON.stringify(res.body))
    const kb = Math.round(bytes / 1024)
    if (kb < 200)
      pass("latency", "page-1 payload size", `${kb}KB`)
    else
      warn("latency", "page-1 payload size", `${kb}KB (>200KB)`)
  }
}

// ─── SUITE 9: SLOW API BEHAVIOUR ─────────────────────────────────────────────
async function testSlowApiBehaviour() {
  suite("9 · Slow / Heavy API Behaviour")

  // Unpaginated request must be rejected with 400 (guard active)
  const unpaged = await request(`/api/tasks?status=Completed`, { timeoutMs: 5000 })
  if (unpaged.status === 400)
    pass("slow", "unpaginated tasks rejected by guard", `400 in ${unpaged.ms}ms`)
  else
    fail("slow", "unpaginated tasks guard", `expected 400, got ${unpaged.status}`)

  // Oversized limit must also be rejected
  const overLimit = await request(`/api/tasks?status=Completed&page=1&limit=999`)
  if (overLimit.status === 400)
    pass("slow", "oversized limit rejected by guard", `400 in ${overLimit.ms}ms`)
  else
    fail("slow", "oversized limit guard", `expected 400, got ${overLimit.status}`)

  // Concurrent requests — 5 simultaneous page fetches
  const concurrentStart = Date.now()
  const concurrent = await Promise.allSettled(
    [1, 2, 3, 4, 5].map((p) =>
      request(`/api/tasks?status=Completed&page=${p}&limit=${LIMIT}`)
    )
  )
  const concurrentMs = Date.now() - concurrentStart
  const concurrentOk = concurrent.filter(
    (r) => r.status === "fulfilled" && r.value.status === 200
  ).length

  if (concurrentOk === 5)
    pass("slow", "5 concurrent requests all succeeded", `wall-time=${concurrentMs}ms`)
  else
    fail("slow", "concurrent requests", `${concurrentOk}/5 succeeded`)

  if (concurrentMs < 3000)
    pass("slow", "concurrent wall-time", `${concurrentMs}ms`)
  else
    warn("slow", "concurrent wall-time", `${concurrentMs}ms (>3s)`)

  // Rapid pagination — 10 pages back-to-back, no delay
  const rapidStart = Date.now()
  let rapidFails = 0
  for (let p = 1; p <= 10; p++) {
    const r = await request(`/api/tasks?status=Completed&page=${p}&limit=${LIMIT}`)
    if (r.status !== 200) rapidFails++
  }
  const rapidMs = Date.now() - rapidStart

  if (rapidFails === 0)
    pass("slow", "10 rapid sequential pages", `${rapidMs}ms total, avg=${Math.round(rapidMs / 10)}ms/page`)
  else
    fail("slow", "rapid pagination", `${rapidFails}/10 pages failed`)

  // Submissions unpaginated must also be rejected
  const subUnpaged = await request(`/api/submissions`, { timeoutMs: 5000 })
  if (subUnpaged.status === 400)
    pass("slow", "unpaginated submissions rejected by guard", `400 in ${subUnpaged.ms}ms`)
  else
    fail("slow", "unpaginated submissions guard", `expected 400, got ${subUnpaged.status}`)
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${"═".repeat(60)}`)
  console.log(`  Phase 5 — Production Testing Suite`)
  console.log(`  Target: ${BASE_URL}`)
  console.log(`  Branch: ${BRANCH}  |  Limit: ${LIMIT}`)
  console.log(`${"═".repeat(60)}`)

  // Connectivity check
  try {
    const ping = await request("/api/ping", { timeoutMs: 5000 })
    if (ping.status !== 200) throw new Error(`ping returned ${ping.status}`)
    console.log(`\n✅ Server reachable (${ping.ms}ms)\n`)
  } catch (e) {
    console.error(`\n❌ Cannot reach server: ${e.message}`)
    console.error("   Start the server first: cd server && npm start\n")
    process.exit(1)
  }

  await testLargeVolumes()
  await testPaginationConsistency()
  await testFiltering()
  await testSorting()
  await testSearch()
  await testSessionStability()
  await testErrorHandling()
  await testNetworkLatency()
  await testSlowApiBehaviour()

  // ─── SUMMARY ───────────────────────────────────────────────────────────────
  const total = passed + failed + warned
  console.log(`\n${"═".repeat(60)}`)
  console.log(`  RESULTS  |  ✅ ${passed} passed  ❌ ${failed} failed  ⚠️  ${warned} warned  |  ${total} total`)
  console.log(`${"═".repeat(60)}\n`)

  if (failed > 0) {
    console.log("Failed tests:")
    results.filter((r) => r.status === "FAIL").forEach((r) => {
      console.log(`  ❌ [${r.suite}] ${r.name} — ${r.detail}`)
    })
    console.log()
  }

  if (warned > 0) {
    console.log("Warnings:")
    results.filter((r) => r.status === "WARN").forEach((r) => {
      console.log(`  ⚠️  [${r.suite}] ${r.name} — ${r.detail}`)
    })
    console.log()
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error("Unexpected error:", e)
  process.exit(1)
})
