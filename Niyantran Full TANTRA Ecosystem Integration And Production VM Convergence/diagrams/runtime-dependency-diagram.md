# Runtime Dependency Diagram (As-Built)

```mermaid
graph LR
    subgraph "Production VM — Running"
        PROXY[nginx proxy :80/:443]
        FE_C[frontend container]
        BE_C[backend container :5000]
        REDIS_C[redis :6379]
        BUCKET_C[bhiv-bucket :8001]
        PRANA_C[bhiv-prana :8002]
        KARMA_C[karma-tracker :8003]
        PROM[prometheus :9090]
        GRAF[grafana :3000]
        CADV[cadvisor]
        NODE[node-exporter]
    end

    subgraph "External"
        MONGO[(MongoDB Atlas)]
        CLDNRY[Cloudinary CDN]
    end

    PROXY --> FE_C
    PROXY --> BE_C
    BE_C --> MONGO
    BE_C --> CLDNRY
    BE_C -->|"artifacts, KARMA relay"| BUCKET_C
    BE_C -.->|"B6: future"| PRANA_C
    BUCKET_C --> REDIS_C
    BUCKET_C -->|"x-source: bucket"| KARMA_C
    PROM --> BE_C
    PROM --> BUCKET_C
    PROM --> PRANA_C
    PROM --> KARMA_C
    GRAF --> PROM

    style PRANA_C stroke-dasharray: 5 5
```

## Startup Order (enforced by docker-compose depends_on)

1. **Redis** — no dependencies
2. **bhiv-bucket** — depends on Redis (healthy)
3. **bhiv-prana** — no dependencies (can start in parallel with Bucket)
4. **karma-tracker** — depends on bhiv-bucket (healthy)
5. **backend** — depends on bhiv-bucket (healthy)
6. **frontend** — depends on backend (healthy)
7. **proxy** — depends on frontend + backend
8. **monitoring** — independent (prometheus, grafana, cadvisor, node-exporter)
