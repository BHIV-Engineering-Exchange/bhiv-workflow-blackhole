# READ THIS FIRST 

Paste this entire task into your preferred GPT/LLM before doing anything else. 

Your responsibility is to support the live VM deployment of Niyantran. You are the current owner of the Niyantran codebase following the complete handover from Nikhil. This is not a rewrite or feature task. Your objective is to ensure Alay can take the existing system to a secure, production-ready deployment while preserving architectural integrity. 

Do not introduce parallel implementations or temporary workarounds unless explicitly approved. 

**Documentation index:** [README.md](README.md)

| Doc | Path |
|-----|------|
| Alay runbook | [ALAY_RUNBOOK.md](ALAY_RUNBOOK.md) |
| Review packet | [VM_PRODUCTION_SUPPORT_PACKET.md](VM_PRODUCTION_SUPPORT_PACKET.md) |
| Changed files | [CODE_PACKET/](CODE_PACKET/) |
| Screenshots | [screenshots/](screenshots/) |

# Scope 

You will work directly with Alay throughout the VM deployment and production stabilization. 

# Current state: 

- Niyantran is already deployed and running on the VM. 

- GitHub Actions deployment pipeline is functional. 

- Docker deployment is operational. 

- Current blocker is secure MongoDB Atlas connectivity and production hardening. 

# Responsibilities 

- Assist Alay in securely integrating MongoDB Atlas with the VM deployment. 

- Review the existing deployment architecture inherited from Nikhil before proposing changes. 

- Ensure no regression against the existing production workflow. 

- Validate environment configuration, Docker configuration and deployment pipeline. 

- Resolve Department and Branch loading issues after Atlas connectivity. 

- Validate authentication, workflow execution and Socket.IO communication. 

- Prepare the platform for enabling PRANA, Live Monitoring, Live Attendance and future production services. 

- Ensure all deployment decisions remain compatible with SETU and the broader BHIV ecosystem. 

# Coordination 

Primary execution: 

- Alay Patel (DevOps) 

Reference material: 

- Nikhil’s complete handover documentation 

- Deployment Guide 

- Existing deployment scripts 

- Existing Docker configuration 

Escalate architectural questions over WhatsApp if required. 

# Execution Phases 

Phase 1 

- Review deployment handover. 

- Validate current VM deployment. 

# Phase 2 

- Assist secure Atlas integration. 

- Evaluate and recommend the most secure credential management approach. 

Phase 3 

- Validate production deployment end-to-end. 

- Resolve missing Department/Branch data. 

- Verify login, workflow execution and WebSocket connectivity. 

Phase 4 

- Production hardening. 

- Review firewall, secrets, Docker configuration and deployment pipeline. 

# Phase 5 

* Enable future-ready infrastructure for PRANA, Live Monitoring, Attendance and other services that were previously constrained by Render/Vercel. 

Deliverables 

- Secure Atlas integration recommendation with implementation. 

- Production-ready VM deployment. 

- End-to-end deployment validation. 

- Updated deployment documentation. 

- REVIEW_PACKET. 

REVIEW_PACKET (Mandatory) 

Create [VM_PRODUCTION_SUPPORT_PACKET.md](VM_PRODUCTION_SUPPORT_PACKET.md) in this folder.

# Include: 

- Architecture overview. 

- Deployment flow. 

- Atlas integration approach and security rationale. 

- Deployment screenshots. 

- GitHub Actions execution screenshots. 

- Docker container status screenshots. 

- VM service screenshots. 

- Production validation screenshots. 

- Failure scenarios tested. 

- Known limitations. 

- Next recommended improvements. 

Create [CODE_PACKET/](CODE_PACKET/) in this folder containing only the files modified during this task with a brief explanation of why each file changed. This keeps reviews efficient instead of digging through an ever-growing repository. Large repositories have a habit of hiding one important change inside 5,000 lines of unrelated code, which is apparently a hobby in software engineering. 

Expected Outcome 

A secure, stable, production-grade Niyantran deployment on the VM, with Shashank providing technical ownership of the application while Alay owns the infrastructure execution. The deployment should be ready to support the next phase of enabling PRANA, Live Monitoring, Attendance, and the remaining ecosystem services. 

