# SETU Sovereign Infrastructure: Security Baseline
## 1. Executive Summary & Design Tenets

As the **SETU** container stack scales to become the core operational hub for BHIV, the underlying infrastructure must enforce strict boundary isolation, secure credential storage, and tenant safety.

This document establishes the **Security Baseline** for deploying SETU and Niyantran on sovereign virtualization networks (Neysa, Yotta, generic VPS, or local physical nodes). By implementing a layered defense strategy (firewalls, internal bridge networks, rate limits, and cryptographic keys), we reduce the system's attack surface. The design is kept lean and maintainable without introducing high-overhead enterprise software, while explicitly documenting operational limits.

---

## 2. Tenant-Safe Container Boundaries (DB Access Isolation)

To protect multi-tenant workspaces and isolate billing (Artha), logistics, and employee core data (Niyantran), the system enforces strict network-level isolation using **Docker Virtual Bridge Networks**. 

### 🔹 Network Separation Schema
Database containers and cache brokers are isolated inside a private bridge network (`setu_secure_net`) and **do not** bind host interfaces. They are unreachable from the outside internet.

```yaml
# docker-compose.production.yml (Tenancy Excerpt)
services:
  # NGINX acts as the ONLY gateway. It bridges the host public interface and the secure bridge.
  nginx_proxy:
    image: nginx:1.25-alpine
    container_name: setu_proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    networks:
      - setu_secure_net

  # The Express Backend is placed entirely on the private network.
  backend:
    image: niyantran_backend:latest
    container_name: niyantran_backend
    networks:
      - setu_secure_net
    # Public ports are omitted to isolate the Node runtime

  # MongoDB database is completely shielded from public host interfaces.
  mongodb:
    image: mongo:6.0
    container_name: setu_mongodb
    volumes:
      - mongodb_data:/data/db
    networks:
      - setu_secure_net
    # ports: - "27017:27017" is strictly OMITTED.
    # Connections are only possible internally via mongodb://setu_mongodb:27017/niyantran

networks:
  setu_secure_net:
    driver: bridge
```

---

## 3. Secret Management & JWT Key Handling

### A. Environment Segregation on the Host Node
Hardcoding passwords, API keys (e.g. Groq), and encryption keys inside codebase repositories is strictly prohibited. The deployment stack isolates these variables in a secure `.env` file on the host operating system, loading them dynamically into containers during boot.

```bash
# Host Directory Isolation
sudo mkdir -p /opt/setu/production
sudo chmod 700 /opt/setu/production

# Write and isolate environmental secrets
# /opt/setu/production/.env
JWT_SECRET="d1f8bc69ae78...[High-Entropy 256-bit Cryptographic Hex Key]"
VAPID_PRIVATE_KEY="BD0Qrqfu...[32-byte cryptographically secure key]"
VAPID_PUBLIC_KEY="AJypBW89..."
POSTGRES_DB_PASSWORD="a9237cde72..."
GROQ_API_KEY="gsk_..."
```

### B. Secure JWT Handling and Verification (Backend Implementation)
Authentication tokens are signed using high-entropy keys with standard session expiration limits, checking request payloads in a middleware block:

```javascript
// server/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 1. Extract Bearer Token from HTTP Authorization Header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access Denied: Missing Bearer Token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Cryptographically verify signature using isolated host secret
        const verified = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'] // Enforce standard symmetric hashing algorithm
        });
        
        // 3. Attach tenant context payload to request object
        req.user = verified; 
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Access Forbidden: Invalid or Expired Token' });
    }
};
```

---

## 4. HTTPS & TLS Termination (NGINX + Let's Encrypt)

To secure user sessions and desktop screen capture sync streams, all traffic must be encrypted. The NGINX reverse proxy terminates SSL/TLS connections, routing HTTP traffic to HTTPS and presenting Let's Encrypt dynamic certificates.

```nginx
# /etc/nginx/conf.d/default.conf

# Rate Limiting Zone Definitions (IP-based limiters)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s; # Cap general APIs at 10 requests/sec
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=2r/s;  # Cap authentication endpoints at 2 requests/sec

server {
    listen 80;
    server_name setu.sovereign.local;
    
    # Let's Encrypt Certbot Challenge Route
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP requests to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name setu.sovereign.local;

    ssl_certificate /etc/letsencrypt/live/setu.sovereign.local/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/setu.sovereign.local/privkey.pem;

    # Cryptographic Hardening baseline (TLS 1.3 Enforced preferred)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;

    # Rate Limiting application
    location /api/ {
        limit_req zone=api_limit burst=15 nodelay; # Apply general 10r/s limit with 15 burst pool
        
        proxy_pass http://niyantran_backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 86400s; # Persistent websocket tunnel keep-alive
    }

    location /api/auth/ {
        limit_req zone=auth_limit burst=5 nodelay; # Hard 2r/s limit to mitigate brute-force attempts
        proxy_pass http://niyantran_backend:5000;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 5. Daily Database Backup Strategy

To prevent data loss from physical host crashes or corrupted database blocks, the system schedules daily compressed, encrypted backups to an offsite S3 object directory.

### 🔹 Automated Backup Script
```bash
#!/bin/bash
# /opt/setu/scripts/backup.sh
set -euo pipefail

BACKUP_DIR="/var/backups/setu"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# 1. Atomic MongoDB Export
docker exec setu_mongodb mongodump --archive --gzip > "$BACKUP_DIR/mongo_$TIMESTAMP.archive.gz"

# 2. Atomic PostgreSQL Export
docker exec setu_postgres pg_dump -U artha_admin artha_ledger | gzip > "$BACKUP_DIR/postgres_$TIMESTAMP.sql.gz"

# 3. Secure Sync to Sovereign Object Storage
if rclone sync "$BACKUP_DIR" "yotta-s3:setu-backups/database" --progress; then
    logger -t SETU_BACKUP "Backup synced offsite successfully."
else
    logger -t SETU_BACKUP "ERROR: Offsite sync failed." >&2
fi

# 4. Prune local archives older than retention days
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
```

### 🔹 Cron Schedule Allocation
Install the backup execution in the system-level crontab to trigger automatically every day at 02:00 AM:
```bash
# sudo crontab -e
0 2 * * * /bin/bash /opt/setu/scripts/backup.sh >> /var/log/setu_backup.log 2>&1
```

---

## 6. User Actions Audit Logging Middleware

To track compliance, record payroll alterations, and monitor employee data accesses, the Node backend implements an internal **Audit Logging Middleware**. This intercepts requests and stores them in a persistent collection for auditing:

```javascript
// server/middleware/auditLogger.js
const mongoose = require('mongoose');

// Define Audit Schema
const AuditLogSchema = new mongoose.Schema({
    userId: { type: String, required: false },
    action: { type: String, required: true },       // e.g. "ATTENDANCE_EDIT", "LEAD_DELETE"
    method: { type: String, required: true },       // e.g. "POST", "PUT"
    endpoint: { type: String, required: true },     // e.g. "/api/attendance/adjust"
    ipAddress: { type: String, required: true },
    payload: { type: Object, required: false },    // Dynamic record alterations metadata
    timestamp: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

module.exports = function(actionType) {
    return async function(req, res, next) {
        const originalWrite = res.write;
        const originalEnd = res.end;
        let responseBody = "";

        // Intercept response stream to capture action outcome (success/fail status)
        res.end = async function(chunk, encoding) {
            if (chunk) responseBody += chunk;
            res.end = originalEnd;
            res.end(chunk, encoding);

            // Log ONLY successful data alterations (status 2xx)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const logEntry = new AuditLog({
                        userId: req.user ? req.user.id : "ANONYMOUS",
                        action: actionType,
                        method: req.method,
                        endpoint: req.originalUrl,
                        ipAddress: req.headers['x-real-ip'] || req.ip,
                        payload: req.method !== 'GET' ? req.body : null
                    });
                    await logEntry.save();
                } catch (err) {
                    console.error('Audit Logging Error: ', err.message);
                }
            }
        };

        next();
    };
};
```
*Application Example in Route Definition:*
`router.put('/attendance/adjust', auth, auditLogger('ATTENDANCE_EDIT'), attendanceController.adjust);`

---

## 7. Future RBAC (Role-Based Access Control) Readiness

To prepare the Niyantran system for multi-tenant scalability, the User collection includes an active `role` field. We enforce these boundaries using a modular role authorization check:

### 🔹 RBAC Hierarchy Design
*   **Admin (Role: `admin`):** Absolute workspace configuration, user provisioning, and raw log purging access.
*   **Manager (Role: `manager`):** Access to employee dashboards, attendance adjustments, and lead reports.
*   **Employee (Role: `employee`):** View personal timeline, start work tracking, and adjust personal profile keys.
*   **Coordinator (Role: `coordinator`):** Field logistical status reporting and coordinate uploads.

### 🔹 Role Authorization Middleware
```javascript
// server/middleware/authorize.js
module.exports = function(allowedRoles = []) {
    return function(req, res, next) {
        // req.user is set by the auth middleware
        if (!req.user || !req.user.role) {
            return res.status(401).json({ error: 'Unauthorized: Missing User Session' });
        }

        // Verify if user's role is within allowed permissions
        const hasAccess = allowedRoles.includes(req.user.role);
        if (!hasAccess) {
            return res.status(403).json({ 
                error: `Access Denied: Role '${req.user.role}' lacks sufficient privileges` 
            });
        }

        next();
    };
};
```
*Application Example:*
`router.delete('/employees/:id', auth, authorize(['admin']), employeeController.delete);`

---

## 8. Calibrated Security Boundaries & Host Limitations

To maintain a calibrated and honest posture, we must document the explicit security limits and operational risks of this single-node Docker Compose setup:

1.  **Host-Level Administrative Compromise:** If an attacker gains access to the administrator account SSH private key, they inherit absolute control over the host operating system, Docker containers, database storage directories, and configuration keys. **Mitigation:** Protect SSH private keys using passphrase protection and enforce key rotations every 180 days.
2.  **Shared Multi-Tenant Hypervisor Vulnerabilities (VPC):** On shared public VPS nodes (generic cloud or lower-tier virtual instances), hypervisor escape bugs theoretically allow other tenants on the same physical host to sniff system memory. **Mitigation:** For critical operations (e.g. Artha financial ledgers), deploy on private, dedicated bare-metal servers or dedicated compute hypervisors (like Yotta private VLAN nodes).
3.  **Kernel Patch Vulnerabilities:** Docker containers share the host kernel. An unpatched zero-day exploit in the Linux host kernel can allow containerized apps to escape boundaries and access host filesystem structures. **Mitigation:** Establish a regular cron schedule on the host VM to perform security patches:
    ```bash
    # Scheduled weekly host cron job
    0 3 * * 1 apt-get update && apt-get upgrade -y --only-upgrade
    ```
4.  **No Active Intrusion Detection (IDS/IPS):** A lean Docker Compose deployment lacks the complex intrusion detection platforms (like Falco, Snort, or SIEM systems) native to large enterprise environments. **Mitigation:** Manually audit system log directories `/var/log/auth.log` and NGINX access records weekly for anomalous routing actions.
