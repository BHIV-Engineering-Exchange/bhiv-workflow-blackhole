# RUNTIME DEPENDENCY MATRIX

**Release:** Bright Connection EOS Sprint  
**Date:** 2026-08-11T06:06:29.508Z  

---

## Inter-Service Interaction & Contract Matrix

| System | Role | Constitutional Responsibility | Dependency Ingress | Dependency Egress | Contract Version |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SETU** | EOS Core Orchestrator | Execution routing, capability discovery, telemetry | Client / Partner | Domain Capabilities | 1.0 |
| **NIYANTRAN** | Task & Workflow Core | Task lifecycle, candidate assignment, progress tracking | SETU / Ingestion Engine | PARIKSHAK / MasterDB | 1.0 |
| **PARIKSHAK** | Review Engine | AI code evaluation, quality scoring, vulnerability scan | NIYANTRAN | MasterDB / KARMA | 1.0 |
| **PRANA** | Workforce Capability | Energy score, workforce activation state | MITRA / SETU | NIYANTRAN | 1.0 |
| **KARMA** | Reputation & Audit | Provenance ledger, reputation scoring | PARIKSHAK | MasterDB | 1.0 |
| **MasterDB** | Master Data Core | Master record persistence, transaction ledger | NIYANTRAN / PARIKSHAK | InsightFlow | 1.0 |
| **MDU** | Diagnostics Unit | Monitoring alerts, screenshot compliance | Desktop Agent | NIYANTRAN | 1.0 |
| **Bucket** | Artifact Storage | S3 Code & document artifact storage | Ingestion / Submission | PARIKSHAK | 1.0 |
| **InsightFlow** | Telemetry Stream | Real-time analytics and event streaming | SetuDispatcher | Telemetry Dashboard | 1.0 |
