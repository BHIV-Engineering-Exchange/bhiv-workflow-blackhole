# Niyantran (workflow-blackhole) — Handover Documentation

This folder is a complete, code-verified handover package for the Niyantran system, prepared as part of the "Full System Handover & Knowledge Transfer" assignment. Start with `00_HANDOVER_PLAN.md`.

## Quick facts

- **What:** workforce execution system (attendance, tasks, payroll, monitoring, AI review) + TANTRA ecosystem participation
- **Stack:** React 18 + Vite (frontend) / Node.js + Express (backend) / MongoDB Atlas
- **Status:** production-deployed, 98/98 tests passing, one critical open security issue (see below)
- **🔴 Read this first:** passwords are stored in plaintext — `01_EXECUTIVE_OVERVIEW.md` and `07_KNOWN_ISSUES_REGISTER.md` item 1

## Contents

| File | Contents |
|---|---|
| `00_HANDOVER_PLAN.md` | How this package maps to the assignment's 15 deliverables, and methodology |
| `01_EXECUTIVE_OVERVIEW.md` | What Niyantran is, status, readiness, limitations |
| `02_ARCHITECTURE_GUIDE.md` | System diagram, module breakdown, data/auth flow, deployment architecture |
| `03_SOURCE_CODE_WALKTHROUGH.md` | Folder-by-folder, file-by-file map — including which files are actually live |
| `04_DEPLOYMENT_GUIDE.md` | Local/Docker/production deployment, real CI/CD pipeline, ports, SSL |
| `05_DATABASE_GUIDE.md` | All 43 MongoDB collections, relationships, backup/restore |
| `06_API_DOCUMENTATION.md` | All 311 live endpoints, auth flow, failure conventions |
| `07_KNOWN_ISSUES_REGISTER.md` | 19 verified findings, most severe first |
| `08_OPERATIONS_RUNBOOK.md` | Deploy, restart, recover, logs, monitoring, rollback |
| `09_DEPENDENCY_MAP.md` | Internal/external/team/ecosystem dependencies |
| `10_REPOSITORY_INVENTORY.md` | Branches, commits, full ecosystem repo list |
| `11_CREDENTIALS_CONFIGURATION_REGISTER.md` | Where every credential lives (no values) |
| `12_REVIEW_PACKET.md` | Condensed sign-off summary for reviewers |
| `13_EVIDENCE_PACKET.md` | Every command run and its real output |
| `14_EXECUTIVE_ASSESSMENT.md` | Maturity, risk, recommended next steps |

## How this relates to the pre-existing docs in the repo root

`HANDOVER.md`, `README.md`, `REVIEW_PACKET.md`, and `SHAKTI_NIYANTRAN_API_INVENTORY.md` already existed in this repository before this package was written. They were read and used as a starting point, but every factual claim in them was independently re-verified against the actual code and running application before being repeated here — and in at least one case (`REVIEW_PACKET.md`'s JWT-fallback claim), a discrepancy was found and is documented in `12_REVIEW_PACKET.md`. Where this `handover/` package and the older root-level docs disagree, treat this package as current — it reflects a fresh, code-verified pass, not an update carried forward from earlier claims.
