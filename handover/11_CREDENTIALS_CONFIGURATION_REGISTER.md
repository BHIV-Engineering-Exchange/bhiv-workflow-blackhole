# Credentials & Configuration Register — Niyantran (workflow-blackhole)

**No secret values appear in this document** — only where each one is stored, how it's supplied to the running app, and (where determinable) who/what owns it. Verified by reading the actual config files and CI pipeline, not by inference.

## 1. Where configuration lives

| Location | Contents | Notes |
|---|---|---|
| `server/.env` (local, gitignored) | All backend secrets/config for local dev | Present in the reviewed copy of this repo — real values, not placeholders. Treat any copy of this repo that still has this file as sensitive. |
| `server/.env.example` | Template listing 20 of the ~65 variables actually used | Incomplete — see `07_KNOWN_ISSUES_REGISTER.md` items 2–3 |
| `client/.env` (implied by `VITE_*` vars) | Frontend build-time config | `VITE_API_URL` and `VITE_VAPID_PUBLIC_KEY` are baked into the built JS bundle — not readable/changeable at container runtime |
| GitHub Actions Secrets (repo settings) | `MONGODB_URI`, `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `VITE_API_URL`, `ENV_FILE` (a full `.env` blob), `VM_PASSWORD`, `VM_PORT`, `VM_USERNAME`, `VM_IP` | Used exclusively by `.github/workflows/cicd.yml` — confirmed by reading the workflow file directly. Access to these is controlled by whoever has GitHub repo admin/settings access. |
| Production VM, `~/NIYANTRAN/.env` | Regenerated on every deploy from the `ENV_FILE` GitHub secret | Not persisted in git; lives only on the VM and in the GitHub secret |
| `/etc/letsencrypt/` on the production VM | TLS certificates (mounted read-only into the `proxy` container) | Managed by Certbot on the VM — outside this repo entirely |

## 2. Environment variables by category, with ownership notes where determinable

*(Full technical list with all ~65 variable names is in `02_ARCHITECTURE_GUIDE.md` §8 — this table adds "who owns this credential" context instead of repeating the full list.)*

| Category | Variables | Likely owner / source |
|---|---|---|
| Database | `MONGODB_URI` / `MONGO_URI` | Whoever administers the MongoDB Atlas project (`cluster0.7c16heb...`) |
| Auth | `JWT_SECRET`, `TANTRA_EXECUTION_KEY` | Application-internal secrets — generated once, not tied to a third-party account; TANTRA key specifically must match whatever the TANTRA execution gateway expects |
| Email | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`/`EMAIL_PASSWORD`, `EMAIL_SECURE`, `EMAIL_SERVICE` | Whoever owns the SMTP/email account used for outbound mail |
| AI providers | `GROQ_API_KEY`, `GROQ_MODEL`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY` | Whoever holds accounts with Groq, Google AI Studio, OpenAI, and xAI respectively — confirm which of these are actually active vs. vestigial (several AI provider keys are declared but only Groq/Gemini were confirmed as actually called from the reviewed service files) |
| File storage | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_STORAGE_ENABLED` | Whoever owns the Cloudinary account |
| Push notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Application-internal (Web Push protocol keypair) — generated once, not a third-party account credential |
| Ecosystem integration | `BUCKET_API_KEY`, `BUCKET_BASE_URL` (production value confirmed: `https://bhiv-bucket-i1l6.onrender.com`), `PRANA_API_KEY`, `PRANA_BASE_URL`, `SAMPADA_SETU_API_KEY`, `SAMPADA_SETU_BASE_URL`, `SAMPADA_SETU_CORRELATION_ID`, `SAMPADA_SETU_ENABLED`, `SAMPADA_SETU_TIMEOUT_MS`, `SETU_AUTHORITY`, `SETU_GOVERNANCE_SIGNATURE`, `COMPLIANCE_API_KEY` | Cross-team — Bucket team (Render account owner), Sampada/SETU team |
| Admin/test accounts | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TEST_USER_PASSWORD`, `PROCUREMENT_EMAIL`, `PROCUREMENT_PASSWORD` | Application-internal seed/test credentials — **given the plaintext-password finding in `07_KNOWN_ISSUES_REGISTER.md` item 1, treat any of these that were ever used for a real account as compromised and rotate them as part of fixing that issue** |
| CI/CD & deploy | `DOCKER_USERNAME`, `DOCKER_PASSWORD` (Docker Hub), `VM_USERNAME`, `VM_PASSWORD`, `VM_PORT`, `VM_IP` (production host) | GitHub repo admin; Docker Hub account owner; VM/infrastructure owner |

## 3. Certificates

TLS certificates for all five domains served by the shared production proxy (`niyantran.blackholeinfiverse.com` and the other four listed in `07_KNOWN_ISSUES_REGISTER.md` item 18) are issued by Let's Encrypt and live at `/etc/letsencrypt/live/<domain>/` on the production VM — not in this repository. Renewal is presumably handled by Certbot's own automation on the VM (not confirmed from this codebase — verify directly on the VM).

## 4. Service accounts

No dedicated "service account" credentials distinct from the API keys listed above were found (e.g. no separate GCP/AWS service-account JSON file). If Google Gemini access uses a service account rather than a simple API key, that would live outside this repo's `.env` pattern — confirm with whoever set up `GEMINI_API_KEY`.

## 5. Access requirements — who needs what, to do what

| Task | Access needed |
|---|---|
| Run the app locally | A copy of `.env` with valid values (or your own dev-tier credentials for each service) |
| Deploy to production | GitHub Actions run access (repo write/maintainer) — the pipeline handles secrets, no direct VM/Docker Hub credentials needed in your hands day-to-day |
| Debug a failed production deploy directly | VM SSH access (ask whoever holds `VM_USERNAME`/`VM_PASSWORD`), Docker Hub read access |
| Rotate a credential | Update the GitHub Actions secret (for CI/CD-supplied values) **and** the corresponding third-party account/dashboard, then trigger a redeploy so the VM's `.env` picks up the new `ENV_FILE` secret content |
| Administer MongoDB Atlas | Atlas project access — ask whoever set up `MONGODB_URI` |

## 6. Immediate action recommended

Given the plaintext-password finding (`07_KNOWN_ISSUES_REGISTER.md` item 1), whoever owns the `ADMIN_PASSWORD` / `TEST_USER_PASSWORD` / `PROCUREMENT_PASSWORD` values, and any real end-user who registered before hashing is implemented, should be considered for credential rotation once hashing is deployed — this is a configuration-register-level consequence of that finding, not just an application code issue.
