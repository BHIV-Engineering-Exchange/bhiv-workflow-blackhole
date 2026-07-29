# Executive Overview — Niyantran (workflow-blackhole)

## What this system is

**Niyantran** (internally also called "Workflow Executor" and, in earlier history, "Complete-Infiverse") is the workforce execution and telemetry system inside the BHIV / TANTRA ecosystem. It is a full-stack JavaScript application: a React single-page frontend and a Node.js/Express API backend, backed by MongoDB.

It is **not** a separate repository called "Workflow Executor" — per the ecosystem map, that name is just the title of the capability this repository provides. This repository is the whole of Niyantran.

## What it actually does

- **Attendance & leave** — manual check-in/out, geofencing validation, biometric device log ingestion (Excel/CSV), leave requests and approvals.
- **Task & project management** — Kanban-style tasks with dependencies, priorities, submissions, and tester review workflows.
- **Payroll / salary automation** — base pay, allowances, deductions, hourly vs. monthly calculation, overtime.
- **Employee monitoring (EMS)** — periodic screenshot capture, OCR text extraction (Tesseract.js), idle/activity tracking, banned-site detection, and a productivity score.
- **AI-assisted review** — Groq and Google Gemini integration for reviewing submitted work and suggesting task breakdowns.
- **TANTRA ecosystem participation** — a dedicated `/api/tantra` surface and an execution-key gate (`TANTRA_EXECUTION_KEY`) so this system can participate in the wider BHIV execution/governance flow described in `ECOSYSTEM_REPOSITORY_MAP.md`.

## Purpose of SETU, for context

SETU itself is **not part of this repository** — it is the ingestion/visibility layer that lives inside the separate Sampada platform and inside a module in `ai-crm`. Niyantran's relationship to SETU is as a **participant**: it emits execution/lineage signals (via `routes/tantraExecution.js` and the `SAMPADA_SETU_*` environment variables) that SETU on the Sampada side can ingest. See `ai-crm/handover/` for the SETU documentation itself.

## Current implementation status

| Area | Status | Basis |
|---|---|---|
| Core backend (Express API) | Complete and running | Server boots successfully once configured; verified live |
| Automated test coverage | Passing | 98/98 Jest tests pass (6 suites) — verified live |
| Frontend build | Complete and building | `vite build` succeeds, produces deployable `dist/` — verified live |
| Real-time features (Socket.IO) | Implemented | Present in server + client, not independently load-tested |
| Payroll / salary engine | Implemented, multiple iterations present | Several superseded route files remain in the codebase (see Known Issues) |
| Biometric attendance | Implemented | Multiple iterations present; latest wired-in version confirmed working, older ones are dead code |
| Docker packaging | Present, dev and prod variants | Dev compose references two service Dockerfiles that don't exist in-repo (see Known Issues) |
| Ecosystem integration (Bucket/Karma/Prana) | Partially wired | `/api/tantra` and `/api/integration` health-check routes exist; Bucket/Karma dependency folders are vendored locally but two of their Dockerfiles are missing |

## Overall architecture (one paragraph)

A React client talks over REST (Axios) and WebSockets (Socket.IO) to a single Express server. The server validates a JWT (sent as an `x-auth-token` header, not `Authorization: Bearer`) on protected routes, reads/writes MongoDB via Mongoose, and calls out to Cloudinary (screenshot storage), Groq/Gemini (AI evaluation), and SMTP (email) as needed. Full detail is in `02_ARCHITECTURE_GUIDE.md`.

## Critical security finding — read this before anything else

**User passwords are stored and compared in plain text.** Verified directly in `server/routes/auth.js`: both registration and login write/compare `req.body.password` against `user.password` with no hashing step (`if (password !== user.password)` at login). `server/models/User.js` has no pre-save hashing hook — its only `pre("save")` hook updates `updatedAt`. The project does declare `bcryptjs` as a dependency, and `routes/admin.js` even contains the comment `// Handle password update (without bcrypt)` next to a plaintext password update — confirming this isn't an accidental omission but code that was deliberately left this way. **This should be treated as the single highest-priority item in this handover.** Full detail and remediation guidance in `07_KNOWN_ISSUES_REGISTER.md`, item #1.

## Production readiness — direct assessment

**Mostly production-ready, with real, fixable gaps — but see the security finding above first.** The core application boots cleanly, all automated tests pass, and the frontend builds. However:

- The server hard-fails to start without `TANTRA_EXECUTION_KEY`, `JWT_SECRET`, and `MONGODB_URI` — good practice — but `TANTRA_EXECUTION_KEY` is **not documented in `.env.example`**, so a fresh setup will fail with a confusing error until someone reads `index.js`.
- Roughly a third of the route files in `server/routes/` (22 of 60) are **not wired into the running app at all** — dead/superseded code sitting alongside the live implementation, which makes the codebase harder to navigate than it needs to be.
- One route file (`biometricAttendanceFixed.js`) has an actual JavaScript syntax error. It's unused, so it doesn't affect the running app, but it would fail immediately if anyone tried to wire it in.
- The repository ships a pre-built `node_modules` containing a native module (`canvas`) compiled for a different platform; a fresh `npm install` on the target machine is required (this is normal practice, but worth calling out because the symptom — `invalid ELF header` — is confusing if you don't know to expect it).

None of these block running the system — they're the kind of findings a handover should surface so the next engineer isn't the one who discovers them at 2am. Full list in `07_KNOWN_ISSUES_REGISTER.md`.

## Known limitations (summary — see 07 for full register)

- Duplicate MongoDB index declared on `WebsiteWhitelist.approval_status` (harmless warning, easy one-line fix).
- Two byte-identical model files (`WorkSession.js` / `WorkSessionUpdated.js`); only one is used.
- `docker-compose.yml` (dev) references `bhiv-bucket/Dockerfile` and `bhiv_prana/Dockerfile`, neither of which exists in this repo — local full-stack `docker-compose up` will fail on those two services specifically (the production compose template correctly avoids this by pointing at the externally-hosted Bucket service instead).
- Frontend production bundle is a single ~2.9 MB chunk (750 KB gzipped) — functional, but a code-splitting pass would improve load time.

## Who owns this

**System Owner (per existing repo documentation):** Shashank Mishra
**Handover acceptance authority (per ecosystem map):** Rishabh Yadav
**Repository:** `github.com/BHIV-Engineering-Exchange/bhiv-workflow-blackhole` — branch `main` is production, `feature/partner-setu-dispatch` is the one active feature branch (see `10_REPOSITORY_INVENTORY.md`).
