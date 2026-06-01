# BHIV Sovereign Infrastructure: Future Infrastructure Readiness Note

## 1. Architectural Strategy: Today vs. Future Expansion

For sovereign organizations, building infrastructure must be an incremental, demand-driven process. Shifting prematurely into large Kubernetes clusters or heavy cloud-managed services leads to excessive resource waste (control plane overhead) and unnecessary maintenance hours.

This note outlines a **Decoupled Scale Strategy**. We baseline our current single-node VPS environment and outline a modular roadmap to divide databases, application servers, and monitoring nodes into **Dedicated Physical Tiers** only as transaction and user volumes demand.

```
       TODAY (1 VPS - Development & Growth)
       ┌──────────────────────────────────────────────┐
       │                 Single Host                  │
       │  [NGINX] [Node Backend] [Postgres] [MongoDB] │
       └──────────────────────────────────────────────┘
                              │
                              ▼
       FUTURE (Multi-Server - High-Volume Scale)
 ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
 │ Load Balancer │  │ App Server    │  │ DB Server     │
 │  NGINX / proxy│  │ Node API      │  │ MongoDB       │
 │               │  │ TANTRA (AI)   │  │ PostgreSQL    │
 └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
         │                  │                  │
         └─────────── Bridged VLAN ────────────┘
```

| Infrastructure Stage | Node/Server Topology | Hardware Specifications | Capabilities & Trade-offs |
| :--- | :--- | :--- | :--- |
| **Today (Phase 1–7)** | **1 Consolidated VPS** | 4 vCPUs / 8GB RAM / 80GB SSD | Zero network-hop latency; low-burn subscription; host hardware is a single point of failure (SPOF). |
| **Future Phase (Multi-Server)** | **4 Dedicated Tiers** | *Total Specs:* 16 Cores / 32GB RAM / 300GB NVMe | High fault tolerance; database isolated on raw NVMe IOPS disk; demands manual network routing. |

---

## 2. Multi-Product Host Integration Matrix

As the BHIV operational workspace grows, future products will be integrated into the sovereign space using isolated container bounds:

```
                  SOVEREIGN WORKSPACE BRIDGE
 ┌─────────────────┬─────────────────┬─────────────────┐
 │  SETU Gateway   │   TANTRA (AI)   │    BHIV Core    │
 │   Port 80/443   │    Port 9002    │    Port 5001    │
 └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
          │                   │                   │
 ┌────────┴────────┬──────────┴──────┬────────────┴────┐
 │  Bucket (MinIO) │  Sarathi (Queue)│  InsightBridge  │
 │    Port 9000    │    Port 5672    │    Port 8080    │
 └─────────────────┴─────────────────┴─────────────────┘
```

### 1️⃣ SETU (Operational Gateway & Metrics Aggregator)
*   **Role:** The public entry point, routing HTTPS traffic to downstream microservices and displaying consolidated operational analytics.
*   **Resource Footprint:** 1 vCPU / 1GB RAM.
*   **Integration Boundary:** Standard proxy configuration in NGINX, routing specific domain paths (e.g. `/api/niyantran`, `/api/crm`) straight to isolated container groups.

### 2️⃣ TANTRA (Intelligence Core)
*   **Role:** Heavy AI/LLM computations, local vector embeddings, and intelligence data parsing. Highly CPU and memory-intensive.
*   **Resource Footprint:** 4 Dedicated vCPUs / 8GB RAM (Requires GPU-accelerated VPS if running local large language models).
*   **Integration Boundary:** Isolated inside its own container group with a hard `mem_limit: 8g` directive to prevent run-away vector buffers from starving the adjacent core applications.

### 3️⃣ BHIV Core
*   **Role:** Central identity management, tenant user directories, SSO (Single Sign-On), and global settings registries.
*   **Resource Footprint:** 1 vCPU / 2GB RAM.
*   **Integration Boundary:** Connects directly via standard HTTP REST to downstream applications (SETU, CRM), verifying user security scopes.

### 4️⃣ Bucket (Sovereign Storage Engine)
*   **Role:** High-volume screenshot archiving, employee document storage, and system backups.
*   **Resource Footprint:** 1 vCPU / 2GB RAM + High NVMe Storage.
*   **Integration Boundary:** Containerized **MinIO** instance exposing S3-compatible APIs locally. This allows application codebases to utilize standard S3 library connectors while keeping the physical data files inside local disk mounts rather than AWS.

### 5️⃣ Sarathi (Messaging & Communication Bridge)
*   **Role:** Asynchronous email transmissions (SMTP), SMS notifications, and workforce event alerts.
*   **Resource Footprint:** 1 vCPU / 1GB RAM.
*   **Integration Boundary:** Run via a lightweight **RabbitMQ** or **Redis-backed Celery queue** container inside the bridge network, ensuring database tasks remain decoupled from API events.

### 6️⃣ InsightBridge (Batch Analytics & Business Intelligence)
*   **Role:** Running heavy database reports, payroll aggregations, and performance charts.
*   **Resource Footprint:** 2 vCPUs / 4GB RAM.
*   **Integration Boundary:** Executes analytics queries against read-only replicas of the main database, protecting the live Niyantran API from database locks under heavy reporting hours.

---

## 3. Shifting to Dedicated Local Physical Servers (Bare-Metal)

Shifting from virtual VPS providers to on-premises bare-metal hardware represents the ultimate goal of sovereign operations. Below is the technical specification runbook to prepare BHIV's physical server space:

### A. Minimum Physical Server Specifications (1U Rack Server)
*   **Processor:** Intel Xeon Silver or AMD EPYC (8 Cores, 16 Threads, 2.4GHz base).
*   **ECC Memory:** 32GB RAM (Error-Correcting Code RAM prevents silent database memory corruption).
*   **Storage Array:** 2x 960GB Enterprise NVMe SSDs configured in **RAID 1** (mirroring protects the OS and databases against physical disk sector crashes).
*   **Network Ports:** Dual 1GbE ports + dedicated IPMI/iDRAC port (for remote bare-metal BIOS access).

### B. On-Premises Host Hardening Requirements
1.  **Hardware Firewall (Gateway):** Place a physical hardware firewall appliance (e.g. pfSense or Fortinet) directly between the ISP router and the server rack, dropping all unsolicited external requests.
2.  **Power Failover Protection (UPS):** Connect the server node to an active Uninterruptible Power Supply (UPS) with at least **30 minutes** of battery capacity. Configure the host OS to initiate a graceful container shutdown sequence if utility power is lost for more than 5 minutes.
3.  **Local NAS Backup Target:** Install a secondary Network Attached Storage (NAS) device in a separate physical room. Configure the daily `backup.sh` script to mount the NAS via NFS/SMB and copy database dumps locally.

---

## 4. Calibrated Infrastructure Constraints & Limitations

To maintain a calibrated and realistic technical posture, we must document the explicit challenges and trade-offs of physical sovereign hardware:

*   **Upfront CAPEX Overhead:** Shifting to bare-metal requires significant capital expenditure to purchase servers, firewalls, and UPS equipment, compared to the low monthly OPEX of virtual cloud VPS instances.
*   **Physical Maintenance Liability:** If a hard drive or RAM stick fails on a virtual VPS, the cloud provider (Neysa/Yotta) automatically hot-swaps the underlying hardware. On private bare-metal, BHIV engineers must manually diagnose, order replacement parts, and physically swap the hardware, incurring downtime risk.
*   **Internet Link Dependability:** Public clouds reside in tier-IV datacenters with triple-redundant fiber links. Local bare-metal setups are dependent on regional ISP lines. A physical cable cut or regional outage will drop external dashboard access until regional lines recover.
*   **No Auto-Elastic Capacity:** Unlike public cloud platforms which let you scale resources with a mouse click, bare-metal physical storage is bounded by hard disk limits. Exceeding RAM or CPU capacities requires ordering, shipping, and installing physical memory sticks, which can take days or weeks.
