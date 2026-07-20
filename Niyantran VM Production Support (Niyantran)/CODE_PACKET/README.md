# CODE_PACKET — files modified for VM Production Support

This folder contains **only** files changed for the Niyantran VM Production Support task, for efficient review.

| Path in CODE_PACKET | Why it changed |
|---------------------|----------------|
| `server/index.js` | CORS and Socket.IO origins now include `FRONTEND_URL` / `CORS_ORIGIN` from env so the VM browser origin works. |
| `server/scripts/checkConnection.js` | Collection diagnostics include `branches` for post-Atlas Dept/Branch checks. |
| `server/.env.example` | Notes that production CORS must be set via GitHub `ENV_FILE`. |
| `.github/workflows/cicd.yml` | Frontend `VITE_API_URL` can come from optional GitHub secret; defaults to current VM API URL. |
| `.env.example` | Atlas-oriented comments; placeholder JWT; CORS/FRONTEND docs without embedding a real production secret. |
| `ALAY_RUNBOOK.md` | Alay runbook: baseline, Atlas credentials, Dept/Branch, hardening, Phase 5 readiness. |
| `secrets isolation/SECRETS_INSTRUCTIONS.md` | Aligns with live `~/NIYANTRAN/.env` + Atlas secret placement. |
| `secrets isolation/lock-secrets.ps1` | Locks `.env` (preferred) or `.env.production`. |
| `YOTTA_DEPLOYMENT_GUIDE.md` | Documents live CI path `~/NIYANTRAN` vs optional `/opt/setu` layout. |
| `YOTTA_SECURITY_HARDENING.md` | Secrets section updated for live `.env` path. |

Also created (not duplicated here as “code”):

- `../VM_PRODUCTION_SUPPORT_PACKET.md` — mandatory review packet  
- `../screenshots/` — placeholder directory for Alay evidence  

**Unchanged by design:** `docker-compose.production.template.yml` (already Atlas-oriented), NGINX routing, application domain models.
