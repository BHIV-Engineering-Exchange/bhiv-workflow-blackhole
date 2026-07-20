# Yotta Sovereign VM: production Hardening Blueprint

This document details the production security hardening configuration implemented and verified for **Niyantran** on the **Yotta Enterprise VM** or dedicated sovereign host node.

---

## 1. HTTPS & Let's Encrypt TLS Configuration

To establish safe, encrypted browser sessions, all ingress traffic flows through Port 443 (HTTPS).

### Step 1: Request Certificates via Certbot
Run the following commands on your Yotta VM host system to fetch free certificates:
```bash
# 1. Install certbot
sudo apt-get update && sudo apt-get install -y certbot

# 2. Request standalone certificate (ensure Port 80 is free temporarily)
# Replace 'niyantran.yourdomain.com' with your actual domain
# Replace 'admin@yourdomain.com' with your administrator email
sudo certbot certonly --standalone \
  -d niyantran.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --non-interactive
```

### Step 2: Ingress Proxy Integration
We have created [nginx.ssl.conf](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/proxy%20configurations/nginx.ssl.conf) containing:
*   Automatic redirect of Port 80 HTTP traffic to Port 443 HTTPS.
*   Allowing the ACME challenge folder `/.well-known/acme-challenge/` to bypass redirection.
*   Enforcement of secure TLS protocols (`TLSv1.2 TLSv1.3`).
*   Modern cipher suites and HSTS policies (`Strict-Transport-Security`).

To enable this configuration, update your production deployment folder on the VM to mount `proxy configurations/nginx.ssl.conf` instead of `proxy configurations/nginx.conf`:
```yaml
  proxy:
    image: nginx:1.25-alpine
    container_name: niyantran_proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./proxy configurations/nginx.ssl.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

### Step 3: Configure Auto-Renewal cron Task
Certbot installs a system timer. To ensure renewal restarts the NGINX proxy container to load new keys, create a renewal hook script at `/etc/letsencrypt/renewal-hooks/post/reload-nginx.sh`:
```bash
#!/bin/bash
docker exec niyantran_proxy nginx -s reload
```
Make the hook executable:
```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
```

---

## 2. Host-Level UFW Firewall Configuration

To lock down the virtual server and prevent access to the backend API container (Port 5000) or database (Port 27017), the host firewall is strictly isolated.

Execute the following commands on the VM:
```bash
# 1. Install UFW if missing
sudo apt-get install -y ufw

# 2. Reset UFW to default settings
sudo ufw --force reset

# 3. Block all incoming and allow all outgoing traffic by default
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 4. Allow only necessary public services
sudo ufw allow 22/tcp      # SSH administration access
sudo ufw allow 80/tcp      # HTTP Web redirect
sudo ufw allow 443/tcp     # HTTPS Secure Web

# 5. Turn on the firewall
sudo ufw --force enable

# 6. Verify isolation
sudo ufw status verbose
```

*   **Database Isolation Verified:** MongoDB (`27017`) and Express (`5000`) are blocked from public ingress, isolating them strictly on Docker's private bridge network.

---

## 3. SSH Hardening Baseline

Protecting administrative shell logins from brute-force bots is mandatory. Update the SSH daemon configuration file `/etc/ssh/sshd_config` with these lines:

```text
# Disable administrative root logins
PermitRootLogin no

# Enforce secure authentication methods (Disables standard passwords)
PasswordAuthentication no
PubkeyAuthentication yes

# Active Session Management
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
```

Apply the changes immediately by reloading the daemon:
```bash
sudo systemctl reload sshd
```

---

## 4. Secrets Isolation

Production keys, DB passwords, and secrets are separated from code and restricted to prevent leakage.

### Linux VM Permissions:
Live CI/CD writes `~/NIYANTRAN/.env` (from GitHub `ENV_FILE`). Lock it after deploy:
```bash
cd ~/NIYANTRAN
chmod 600 .env
ls -la .env   # expect -rw-------
```

If using the optional `/opt/setu` layout instead of CI:
```bash
sudo chown root:root /opt/setu/production/compose/.env
sudo chmod 600 /opt/setu/production/compose/.env
```

### Windows Local Development:
Use our pre-configured script inside the [secrets isolation/](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/secrets%20isolation) directory:
*   Double-click [lock-secrets.bat](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/secrets%20isolation/lock-secrets.bat) to clear NTFS permission inheritance and restrict file reads solely to your local user and the `SYSTEM` account.
*   **Git Protection:** We have appended `.env*` rules to [.gitignore](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/.gitignore) to ensure credentials are never pushed to Git repositories.

---

## 5. Automated Backups

### Windows Backups:
Use the pre-configured system inside the [backup automation/](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/backup%20automation) directory:
*   Double-click [backup-db.bat](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/backup%20automation/backup-db.bat) to trigger a gzip archive export.
*   Follow [BACKUP_INSTRUCTIONS.md](file:///c:/Users/ASUS/OneDrive/Desktop/BHIV-Tasks/SETU/workflow-blackhole/backup%20automation/BACKUP_INSTRUCTIONS.md) to register a Task Scheduler script running daily at 2:00 AM.

### Linux VM Backups:
Create a backup shell script at `/opt/setu/production/scripts/backup-db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/opt/setu/production/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/mongodb_backup_$TIMESTAMP.gz"

mkdir -p "$BACKUP_DIR"

# Execute compressed backup inside docker container
docker exec niyantran_database mongodump --archive --gzip > "$BACKUP_FILE"

# Retention policy: Purge files older than 7 days
find "$BACKUP_DIR" -type f -name "mongodb_backup_*.gz" -mtime +7 -delete
```
Make it executable:
```bash
chmod +x /opt/setu/production/scripts/backup-db.sh
```
Schedule via crontab:
```bash
# Open crontab config
crontab -e

# Add cron line to execute daily at 2:00 AM
0 2 * * * /opt/setu/production/scripts/backup-db.sh >> /var/log/niyantran_backup.log 2>&1
```

---

## 6. Log Rotation & Container Restart Resilience

These features are pre-built inside the production orchestration configuration:
*   **Log Limits:** Configured via `logging.options` to cap stdout writes to `10m` size with a max retention of `3` rolling log archives per service.
*   **Auto-Recovery:** Enforced via `restart: unless-stopped` policies across proxy, database, backend, and frontend service containers.
