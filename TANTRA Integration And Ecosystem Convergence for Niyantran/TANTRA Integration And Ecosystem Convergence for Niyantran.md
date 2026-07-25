# READ THIS FIRST 

Niyantran is no longer to operate as a standalone application. 

Your responsibility is to converge Niyantran into the canonical TANTRA ecosystem so it becomes a first-class execution participant while respecting all architectural boundaries. This is an integration exercise, not a feature development exercise. 

No duplicate runtimes, no parallel implementations, and no local replacements of shared ecosystem services are permitted. 

# ⸻ 

Purpose 

Convert Niyantran from an independent HRMS into a TANTRA-native execution system that participates in the shared operational intelligence ecosystem. 

# ⸻ 

Responsibilities 

# 1. TANTRA Runtime Integration 

Integrate Niyantran with the canonical TANTRA runtime. 

Niyantran must execute through shared runtime contracts instead of isolated application logic. 

# ⸻ 

# 2. PRANA Integration 

Integrate with the canonical PRANA runtime. 

Do not implement telemetry locally. 

Consume the shared PRANA service. 

⸻ 

# 3. KARMA Integration 

Publish canonical execution events into KARMA. 

Niyantran must never calculate behavioural scoring itself. 

⸻ 

# 4. Bucket Integration 

All execution artifacts, submissions, reviews, evidence, and outputs must be written through the canonical Bucket integration. 

No local provenance stores. 

# ⸻ 

# 5. Replay & Observability 

Integrate Replay, InsightFlow, and ecosystem observability. 

All execution must be traceable, replayable, and observable. 

# ⸻ 

# 6. Runtime Contracts 

Implement canonical: 

- trace_id propagation 

- execution context 

- identity propagation 

- event contracts 

- GovernanceEnvelope compatibility 

No proprietary interfaces. 

⸻ 

# 7. Event-Driven Architecture 

Replace point-to-point integrations wherever applicable. 

Niyantran should publish and consume canonical ecosystem events instead of directly coupling with downstream services. 

⸻ 

# 8. Boundary Protection 

Niyantran remains an execution application. 

It must not become responsible for: 

- PRANA logic 

- KARMA logic 

- PARIKSHAK logic 

- Governance logic 

- Task intelligence 

Those remain shared ecosystem capabilities. 

⸻ 

Collaboration 

Work closely with: 

- Pritesh Patra (Application Custodian & Production) 

- Ishan Shirode (PARIKSHAK Integration) 

- Rukayya (PRANA & KARMA) 

- Soham (Integration Oversight) 

- Alay Patel (Infrastructure) 

# ⸻ 

Non-Goals 

You are NOT to: 

- Build new HR features. 

- Modify PRANA internals. 

- Modify KARMA internals. 

- Duplicate Bucket. 

- Build local governance systems. 

- Replace TANTRA runtime. 

⸻ 

Deliverables 

- Complete TANTRA integration. 

- Architecture documentation. 

- Runtime sequence diagrams. 

- Integration documentation. 

- Updated deployment documentation. 

- Production validation report. 

- Replay validation. 

- Observability validation. 

- Integration evidence. 

⸻ 

Mandatory Review Packet 

Include: 

- Architecture overview. 

- Runtime flow diagrams. 

- Integration mapping. 

- Event contract documentation. 

- Trace propagation proof. 

- Deployment screenshots. 

- Runtime screenshots. 

- Evidence of successful ecosystem participation. 

⸻ 

Mandatory Code Packet 

/review_packets/code_packet/ CODE_INDEX.md Only modified files. No complete repository. 

⸻ 

Success Criteria 

Niyantran is no longer a standalone application. 

It operates as a canonical TANTRA execution participant, consuming shared ecosystem capabilities while maintaining strict architectural boundaries and production-grade observability, replayability, and governance. 

