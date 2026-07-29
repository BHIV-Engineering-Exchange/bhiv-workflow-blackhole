# Repository Inventory — Niyantran (workflow-blackhole)

## 1. This repository

| Field | Value | Source |
|---|---|---|
| Remote | `https://github.com/BHIV-Engineering-Exchange/bhiv-workflow-blackhole.git` | `git remote -v` |
| Production branch | `main` | `git branch -a` |
| Active feature branch | `feature/partner-setu-dispatch` — last commit 2026-07-03, "Add Sampada SETU dispatcher hook on Niyantran execution events" | `git log` |
| Total commits on `main` | 196 | `git rev-list --count main` |
| Most recent commit | 2026-07-25, "Merge branch 'main' of ...bhiv-workflow-blackhole" | `git log --oneline` |
| CI/CD | `.github/workflows/cicd.yml` (single pipeline) | direct file check |
| Archived work | None found as a separate branch — the 22 orphaned route files (see `07_KNOWN_ISSUES_REGISTER.md`) are effectively archived-in-place inside `main` rather than on their own branch |

**Uncommitted state at time of this handover:** a `git status --short` in the working copy used to produce this package showed a large number of modified files. These are very likely line-ending (CRLF/LF) normalization artifacts from how this copy was extracted for review, not real uncommitted work — but this should be confirmed against the team's actual working copy rather than assumed, since this handover package was built from a zipped snapshot, not a live `git clone`.

## 2. Full ecosystem repository list (per `ECOSYSTEM_REPOSITORY_MAP.md`)

This handover assignment covers two of the systems below (this repo, and `ai-crm`). The rest are listed here for completeness since the task asks for "all repositories," but were **not** available to review as part of this package — status noted accordingly.

| Repository / folder | System | Reviewed in this handover? |
|---|---|---|
| `INFIVERSE-HR-PLATFORM` | Sampada (primary repo; SETU ingestion lives inside it) | No — not provided |
| `workflow-blackhole` (this repo) | Niyantran / Workflow Executor / Complete-Infiverse | **Yes — this package** |
| `ai-crm` | CRM + Logistics + SETU (together) | **Yes — separate package in `ai-crm/handover/`** |
| `Artha` / `AI-Artha` | Artha (payroll truth, financial systems) | No — not provided |
| `bucket` | Bucket (storage/artifact/replay-chain) | No — not provided as a standalone repo; a local copy is vendored inside this repo (`bhiv-bucket/`) for dev convenience only, see `09_DEPENDENCY_MAP.md` |
| `Prana` | PRANA (signal/packet participation) | No — not provided as a standalone repo; a local copy is vendored inside this repo (`bhiv_prana/`) |
| `bhiv-registry` | InsightFlow (analytics/registry) | No — not provided |
| `Karma-Tracker` | Karma (karma tracking) | No — not provided as a standalone repo; a local copy is vendored inside this repo (`Karma-Tracker/`) |

**Recommendation:** if a complete ecosystem-wide handover is required (not just Niyantran + ai-crm), the remaining five repositories need to be made available for the same level of review this package gives Niyantran and ai-crm.

## 3. Branch/version note for successors

Given only `main` shows sustained activity (196 commits) and one feature branch is in flight, there's no evidence of a competing "dev" vs. "prod" branch split in this repo — `main` appears to be deployed directly. Confirm this assumption against the actual CD pipeline (`.github/workflows/cicd.yml`) and the production host before assuming any push to `main` is safe to auto-deploy.
