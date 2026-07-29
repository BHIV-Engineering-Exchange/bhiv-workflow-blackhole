# Mandatory Code Packet - Niyantran Custodianship

## Overview
This code index lists only the files modified to implement the PRANA session lifecycle integration and production environment readiness, as per the custodianship mandate. No complete repository is included here.

## Modified Files

### 1. `client/src/context/auth-context.jsx`
- **Changes Made:** Imported PRANA core modules. Created `startPrana(currentUser)` and `stopPrana()` helpers. Injected these helpers into the `login`, `register`, `logout`, and initial session load (via `useEffect`) lifecycle methods.
- **Purpose:** Automates the canonical employee session lifecycle so that every authenticated employee automatically begins generating PRANA cognitive telemetry.

### 2. `client/.env.example`
- **Changes Made:** Added the canonical `VITE_PRANA_BUCKET_URL` variable pointing to localhost.
- **Purpose:** Provides developers with the correct environment variables required for local PRANA telemetry routing.

### 3. `client/.env.production`
- **Changes Made:** Added the canonical `VITE_PRANA_BUCKET_URL` variable stub for the live production endpoint.
- **Purpose:** Ensures the deployment infrastructure team can seamlessly inject the live PRANA bucket URL during Niyantran production VM validation and deployment.

### 4. `client/src/lib/prana-core/*` (New Directory)
- **Changes Made:** Copied canonical PRANA telemetry engine files (`prana_packet_builder.js`, `prana_state_engine.js`, `bucket_bridge.js`, `signals.js`).
- **Purpose:** Embeds the canonical monitoring engine directly within the Niyantran application bundle to prevent network segregation issues and guarantee uptime tracking.
