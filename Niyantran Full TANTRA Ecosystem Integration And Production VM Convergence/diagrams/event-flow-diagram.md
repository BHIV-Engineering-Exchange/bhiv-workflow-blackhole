# Event Flow Diagram (As-Built)

```mermaid
sequenceDiagram
    participant U as Employee
    participant N as Niyantran Backend
    participant AT as activityTracker
    participant WM as websiteMonitor
    participant EMS as ems_signals
    participant KC as karmaClient
    participant BC as bucketClient
    participant SC as screenCapture
    participant CL as Cloudinary
    participant BK as Bucket :8001
    participant KA as KARMA :8003
    participant D as Dashboard (Socket.IO)

    Note over U,D: ── WIRED FLOWS (working today) ──

    U->>N: Login + Start Day
    N->>AT: startTracking(employeeId)
    AT->>EMS: Initialize signal capture

    loop Every IDLE_THRESHOLD
        AT->>AT: Check idle state
        alt Employee idle > threshold
            AT->>AT: MonitoringAlert.createAlert('idle_timeout')
            AT->>KC: signalExcessiveIdle(employeeId, idleMinutes)
            KC->>BC: storeKarmaEventRecord({signal:'restrict'|'nudge'})
            BC->>BK: POST /bucket/artifacts/write
            BK->>KA: Forward with x-source: bucket
        end
    end

    loop Every SCREEN_CAPTURE_INTERVAL
        SC->>CL: Upload screenshot (PRIMARY)
        SC->>BC: storeScreenshot (ADDITIVE — fire-and-forget)
        BC->>BK: POST /bucket/artifacts/write
    end

    WM->>WM: Check URL compliance
    alt Disallowed site detected
        WM->>WM: MonitoringAlert.createAlert('unauthorized_website')
        WM->>KC: signalDisallowedSite(employeeId, url)
        KC->>BC: storeKarmaEventRecord({signal:'restrict', severity:0.8})
        BC->>BK: POST /bucket/artifacts/write
        BK->>KA: Forward with x-source: bucket
        WM->>SC: triggerCapture('disallowed_site')
    end

    EMS->>EMS: captureIdleTime()
    alt isIdle = true
        EMS->>KC: signalExcessiveIdle(employeeId, idleMinutes)
        KC->>BC: storeKarmaEventRecord(...)
        BC->>BK: POST /bucket/artifacts/write
    end

    N->>D: io.emit('monitoring-alert', ...)
    N->>D: io.emit('dashboard:update', ...)

    Note over U,D: ── BLOCKED FLOWS (need owner action) ──

    rect rgb(255, 240, 240)
        Note over N,BK: B6: PRANA session-telemetry endpoint does not exist
        U-->>N: Login
        N--xN: Cannot call PRANA session start
        N--xN: Cannot consume PRANA telemetry stream
    end
```

## Fire-and-Forget Contract

All KARMA signal and Bucket artifact calls from Niyantran are **fire-and-forget**:
- Wrapped in `try/catch` at the `require()` level
- `.catch()` on the promise — only logs a warning
- **Failure never breaks monitoring pipeline** — idle detection, website monitoring, and screenshot capture continue regardless
