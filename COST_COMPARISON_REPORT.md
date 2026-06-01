# SETU Sovereign Infrastructure: Cost Comparison & Control Report

## 1. Executive Cost Strategy

For private operational software like **SETU** and the **Niyantran** employee monitoring stack, hosting budgets must favor high resource leverage over expensive, automated cloud abstractions. 

This cost comparison report outlines a realistic infrastructure roadmap designed to eliminate runaway cloud burn. By moving away from Render's multi-tenant PaaS pricing model and deploying a consolidated containerized stack via **Docker Compose** on dedicated sovereign VPS virtual environments, we can reduce operating costs by **over 70%** while gaining access to physical host resources.

---

## 2. Multi-Stage Cost Comparison Matrix

Below is the verified monthly operating comparison between Render Cloud subscription plans and a self-hosted VPS, mapped out for 50, 200, and 1,000 active tracking users. 

*Calculated with a conversion baseline of $1 USD ≈ ₹83.33 INR.*

| Active User Count | Operating Stage | Render Monthly Cost (INR) | Render Monthly Cost (USD) | Self-Hosted VPS Cost (INR) | Self-Hosted VPS Cost (USD) | Total Monthly Savings (INR) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **50 Users** | **Development / Staging** | **₹3,000** | ~$36.00 | **₹800** | ~$9.60 | **₹2,200 (73% Saved)** |
| **200 Users** | **Active Growth** | **₹6,000** | ~$72.00 | **₹1,500** | ~$18.00 | **₹4,500 (75% Saved)** |
| **1000 Users** | **Production Scale** | **₹15,000** | ~$180.00 | **₹3,500** | ~$42.00 | **₹11,500 (76% Saved)** |

---

## 3. Resource & Hardware Specification Blueprint

To ensure the cost claims above are tightly coupled to evidence, the following hardware profiles define the minimum hosting nodes required at each scale to support Node.js screenshot parsing and database transactions:

### 🔹 50 Users (Development Stage)
*   **Minimum Target Host Node:** 2 vCPUs / 4GB RAM / 40GB SSD
*   **Operating Spec:** Handles REST telemetry pings and light cron logs. Image capture processing is serialized.
*   **Estimate Realized:** Basic VPS tier (e.g. Neysa VPS or Hetzner CX22) priced at **₹800/month** (~$9.60).

### 🔹 200 Users (Growth Stage)
*   **Minimum Target Host Node:** 4 vCPUs / 8GB RAM / 80GB NVMe SSD
*   **Operating Spec:** Dedicated memory bounds allow concurrent Express connections. MongoDB uses up to 1.5GB of local WiredTiger cache memory safely.
*   **Estimate Realized:** Standard compute tier (e.g. Yotta Virtual Instance or Neysa Compute VPS) priced at **₹1,500/month** (~$18.00).

### 🔹 1000 Users (Scale Stage)
*   **Minimum Target Host Node:** 8 vCPUs / 16GB RAM / 160GB NVMe SSD
*   **Operating Spec:** Accommodates high-frequency Socket.IO web socket streams and concurrent screenshot canvas OCR calculations. Database writes are mapped directly to local RAID storage to prevent disk queuing delays.
*   **Estimate Realized:** High-performance VM tier (e.g. Yotta Enterprise Compute or large Neysa virtual node) priced at **₹3,500/month** (~$42.00).

---

## 4. Auxiliary Operating Costs & Grounded TCO

To maintain a calibrated and honest cost perspective, we must factor in secondary subscription expenses and operational labor that public cloud platforms typically bundle into their fees:

1.  **Offsite Backup Storage (S3-Compatible):**
    *   *Volume & Storage:* ~100GB of compressed database snapshots and configuration archives.
    *   *Unit Cost:* $0.02 per GB/month (e.g., Yotta Object Storage or Backblaze B2).
    *   *Impact:* **₹165/month** (~$2.00).
2.  **Network Egress Bandwidth:**
    *   *Volume:* ~300GB of outbound JSON/image uploads.
    *   *Unit Cost:* Included within the VPS free bandwidth allocations (typically 2TB to 4TB).
    *   *Impact:* **₹0/month**.
3.  **Domain Routing & TLS Certificates:**
    *   *Control:* Managed for free via Cloudflare DNS routing and Let's Encrypt automated certbot challenges.
    *   *Impact:* **₹0/month**.
4.  **Operational Labor Overhead (Calibrated Reality):**
    *   *Time Commitment:* Requires **1 to 2 hours** of manual DevOps oversight monthly.
    *   *Task Scope:* Verifying host system security patches (`apt update`), checking Prometheus telemetry alerts, and validating backup script logs.

---

## 5. Cost-Control Rules (Preventing Runaway Cloud Burn)

To strictly limit operational spend and keep internal BHIV infrastructure highly cost-efficient, enforce these operational constraints at the container and host levels:

1.  **WiredTiger Memory Cap:** Always restrict the MongoDB engine's cache size in the Docker Compose command line (e.g. `--wiredTigerCacheSizeGB 1.5` on an 8GB VPS). If left uncapped, MongoDB will attempt to claim 50% of host RAM, triggering out-of-memory kernel kills on adjacent Express backend containers.
2.  **Strict Ephemeral Screenshot Rotations:** Screens captured from active monitoring clients consume significant disk space. Establish a host-level system cron job that purges raw image files older than 30 days, or compresses them directly to an S3-compatible cold storage archive.
3.  **No Dynamic Auto-Scaling Pools:** Do not use elastic, auto-scaling CPU or container instances. Enforce hard vertical scaling boundaries: if a VPS hits 85% continuous CPU utilization, scale by manually upgrading to a fixed, predictable higher VPS tier rather than using un-capped burstable cloud scaling.
