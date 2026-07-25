# Integration Diagram (As-Built)

```mermaid
graph TB
    subgraph Client
        EMP[Employee Browser / Desktop Agent]
    end

    subgraph Niyantran["Niyantran (this app)"]
        FE[React Frontend]
        BE[Express Backend :5000]
        DB[(MongoDB Atlas)]
        CLOUD[Cloudinary — primary storage]
    end

    subgraph Ecosystem["TANTRA Ecosystem — owned by Rukayya"]
        PRANA[PRANA :8002 — stateless forwarding only]
        KARMA[KARMA :8003 — behavioral scoring]
        BUCKET[Bucket :8001 — artifact storage/provenance]
        REDIS[(Redis :6379 — Bucket cache)]
    end

    EMP -->|login/dashboard| BE
    BE -->|serve SPA| FE

    %% WIRED flows (solid lines)
    BE -->|"screenshots (additive)"| BUCKET
    BE -->|"screenshots (primary)"| CLOUD
    BE -->|"karmaClient → bucketClient relay"| BUCKET
    BUCKET -->|"x-source: bucket"| KARMA
    BUCKET --> REDIS
    BE <-->|"execution contracts"| BE

    %% BLOCKED flows (dashed lines)
    BE -.->|"B6: session endpoint missing"| PRANA
    BE -.->|"B7: direct access blocked"| KARMA

    style PRANA stroke-dasharray: 5 5
    style KARMA fill:#f9f,stroke:#333
    style BUCKET fill:#9f9,stroke:#333
```

**Legend:**
- Solid lines = wired and working
- Dashed lines = blocked by owner dependencies
- Green = Bucket (fully integrated)
- Pink = KARMA (integrated via Bucket relay, not direct)
