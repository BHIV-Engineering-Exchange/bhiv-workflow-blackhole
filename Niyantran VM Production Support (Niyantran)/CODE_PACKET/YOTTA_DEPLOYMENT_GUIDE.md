# Niyantran Sovereign Deployment Blueprint: Yotta VM Deployment Guide

This guide details the step-by-step procedure to provision, configure, harden, and execute the production-ready **Niyantran** deployment on a **Yotta Enterprise VM** or dedicated sovereign VPS.

---

## 1. Target Environment & Specifications `[ARCHITECTURAL ASSUMPTION]`

The deployment stack is designed to run on a dedicated virtual instance targeting the following specifications:
*   **Operating System:** Ubuntu 22.04 LTS (Jammy Jellyfish) or Debian 12 (Bookworm) `[ARCHITECTURAL ASSUMPTION]`
*   **CPU:** 4x Dedicated vCPUs `[ARCHITECTURAL ASSUMPTION]`
*   **RAM:** 8GB RAM `[ARCHITECTURAL ASSUMPTION]`
*   **Storage:** 80GB SSD (Local storage preferred to avoid network storage IOPS throttling) `[ARCHITECTURAL ASSUMPTION]`
*   **Network:** 1x Public IP Address with DNS mapping capabilities `[ARCHITECTURAL ASSUMPTION]`

---

## 2. Directory Structure on Host Node `[ARCHITECTURAL ASSUMPTION]`

All application configurations, files, scripts, and logs are anchored under `/opt/setu/production/` to maintain clean separation from host system services.

Run the following commands to initialize the directory tree and apply permissions:

```bash
# Create target subdirectories
sudo mkdir -p /opt/setu/production/backups
sudo mkdir -p /opt/setu/production/configs
sudo mkdir -p /opt/setu/production/scripts
sudo mkdir -p /opt/setu/production/nginx
sudo mkdir -p /opt/setu/production/compose

# Apply ownership to deployment user (replace 'ubuntu' with target deploy user)
sudo chown -R $USER:$USER /opt/setu/production
```

### Layout Mapping:
*   `/opt/setu/production/compose/` — Stores `docker-compose.production.yml` and `.env.production`.
*   `/opt/setu/production/nginx/` — Stores the ingress proxy configuration (`proxy configurations/nginx.conf`).
*   `/opt/setu/production/scripts/` — Stores backup automation and logging checkers.
*   `/opt/setu/production/configs/` — Stores auxiliary runtime configuration assets.
*   `/opt/setu/production/backups/` — Stores local target directories for atomic database dumps.

---

## 3. Host OS Preparation & Optimization `[PLANNED]`

Optimizing virtual memory and socket file limits is required to support long-lived WebSocket connections and heavy MongoDB WiredTiger read/write cycles.

Execute the following commands to configure host optimization parameters:

```bash
# 1. Update and upgrade OS baseline packages
sudo apt-get update && sudo apt-get upgrade -y

# 2. Optimize Swappiness (Reduce disk IO bottlenecks for MongoDB)
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# 3. Increase maximum open file descriptors (Required for high socket connection count)
sudo sysctl fs.file-max=2097152
echo 'fs.file-max=2097152' | sudo tee -a /etc/sysctl.conf

# 4. Increase max virtual memory map boundaries (Required for MongoDB 6.0 storage engine)
sudo sysctl vm.max_map_count=262144
echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf

# 5. Apply sysctl changes immediately
sudo sysctl -p

# 6. Apply system limits to /etc/security/limits.conf
echo "* soft nofile 65535" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65535" | sudo tee -a /etc/security/limits.conf
```

---

## 4. Install Docker & Docker Compose Plugin `[PLANNED]`

This section installs the official Docker Engine and Compose plugin directly from the official upstream repository.

```bash
# 1. Install prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# 2. Detect OS distribution (Ubuntu or Debian) and fetch official GPG key
OS_TYPE=$(. /etc/os-release && echo "$ID")
VERSION_CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/${OS_TYPE}/gpg" | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Add official Docker Apt Repository to source list
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${OS_TYPE} \
  ${VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker and Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Add current deployment user to docker group (Removes sudo requirements for docker command execution)
sudo usermod -aG docker $USER
```

> [!NOTE]
> Run `newgrp docker` or log out and back in to apply the group memberships without rebooting.

---

## 5. Host-Level Firewall (UFW) Configuration `[PLANNED]`

To ensure strict network boundaries and isolate the MongoDB container from external access, the host firewall is locked down to expose only SSH, HTTP, and HTTPS ports.

```bash
# 1. Install UFW if missing
sudo apt-get install -y ufw

# 2. Reset UFW to default settings
sudo ufw --force reset

# 3. Set default firewall behaviors (Block all incoming, allow outbound)
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 4. Expose only required service ports
sudo ufw allow 22/tcp     # SSH administrative ingress
sudo ufw allow 80/tcp     # HTTP web ingress (Redirected to NGINX)
sudo ufw allow 443/tcp    # HTTPS secure ingress (Terminated by NGINX)

# 5. Enable UFW
sudo ufw --force enable

# 6. Verify firewall rules
sudo ufw status verbose
```

---

## 6. DNS Setup & Let's Encrypt TLS Configuration `[PLANNED]`

Before requesting TLS certificates, map your domain name (e.g. `niyantran.yourdomain.com`) to the Yotta VM's public IP address via your DNS provider console.

### Get TLS Certificates using Certbot (Standalone Mode):

```bash
# 1. Install Certbot
sudo apt-get install -y certbot

# 2. Run Certbot in standalone mode to fetch certificates (ensure port 80 is not currently occupied)
# Replace 'niyantran.yourdomain.com' with the actual mapped domain
# Replace 'sysadmin@yourdomain.com' with the administrator email address
sudo certbot certonly --standalone \
  -d niyantran.yourdomain.com \
  --non-interactive \
  --agree-tos \
  --email sysadmin@yourdomain.com

# 3. Verify certificates are stored on the host filesystem
sudo ls -la /etc/letsencrypt/live/niyantran.yourdomain.com/
```

### Auto-Renewal Configuration:
Let's Encrypt certificates expire every 90 days. A system cron job is setup to check renewal eligibility twice daily:

```bash
# Test renewal workflow dry run
sudo certbot renew --dry-run
```

---

## 7. Launching the Production Stack

> **Live CI/CD path (current):** GitHub Actions deploys to `~/NIYANTRAN` with `.env` (from secret `ENV_FILE`) and generates `docker-compose.production.yml` from `docker-compose.production.template.yml`. Local Mongo is disabled; the backend uses **MongoDB Atlas** via `MONGODB_URI`. Prefer the automated pipeline for production. Full Alay checklist: [Niyantran VM Production Support (Niyantran)/ALAY_RUNBOOK.md](Niyantran%20VM%20Production%20Support%20(Niyantran)/ALAY_RUNBOOK.md).

### 7A. Automated path (recommended)

Push to `main` (or re-run `.github/workflows/cicd.yml`). On the VM:

```bash
cd ~/NIYANTRAN
docker compose -f docker-compose.production.yml ps
curl -sf http://localhost/api/ping
chmod 600 .env
```

### 7B. Manual path (optional / `/opt/setu` layout)

Copy the production config files into the standardized directory layout if not using CI:

```bash
# 1. Copy configurations to production paths
cp docker-compose.production.yml /opt/setu/production/compose/
cp .env /opt/setu/production/compose/   # live naming; .env.production is legacy local only
cp "proxy configurations/nginx.conf" /opt/setu/production/nginx/default.conf

# 2. Navigate to the compose directory
cd /opt/setu/production/compose/

# 3. Pull images and build application containers
docker compose build --pull

# 4. Run containers in background daemon mode
docker compose up -d

# 5. Verify service operational states
docker compose ps
```

---

## 8. Verification Plan & Runtime Tests `[PLANNED]`

Check the health parameters of the containers to verify successful deployment:

```bash
# 1. Check container execution states and healthy status
docker compose ps

# 2. Verify NGINX proxy routes traffic successfully
curl -Iv http://localhost/api/ping

# 3. Monitor container live resource utilization footprint
docker stats --no-stream
```
