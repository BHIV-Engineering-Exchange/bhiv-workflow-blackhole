# Niyantran Secrets Isolation: Windows & Linux Guide

This directory contains utility scripts to implement **Secrets Isolation** for Niyantran production environment files.

**Live production (CI/CD):** the VM uses `~/NIYANTRAN/.env` (content from GitHub secret `ENV_FILE`).  
**Local / legacy naming:** `.env.production` is still supported by the Windows lock script.

---

## 1. What is Secrets Isolation?

Secrets Isolation is the practice of securing sensitive passwords, credentials, and API/VAPID keys. We accomplish this through two main security measures:
1.  **Git Exclusion:** Restricting Git from tracking configuration files so that credentials are never uploaded to GitHub or other repositories.
2.  **Access Control Lockdown:** Setting file-level security permissions so that other standard users, non-admin accounts, or compromised services running on the same operating system cannot read the secrets.

---

## 2. Windows Implementation (Local/Testing)

The files in this directory automate file security for Windows development and testing.

### How It Works:
*   **`lock-secrets.ps1`** (PowerShell Script):
    *   Secures `.env` at the project root if present; otherwise `.env.production`.
    *   Disables NTFS permission inheritance (wiping out general read access from other user groups like "Everyone" or "Users").
    *   Adds explicit Full Control permissions ONLY to the current logged-in user and the `SYSTEM` account (required by Docker and system services).
*   **`lock-secrets.bat`** (Batch Helper):
    *   Bypasses PowerShell execution policies and launches the script. It is double-clickable.

### Instructions:
1.  Double-click **`lock-secrets.bat`** inside this folder.
2.  A command prompt window will open, lock the file permissions, and display a success message.
3.  **Verification:**
    *   Right-click the secured `.env` (or `.env.production`) file at the project root.
    *   Select **Properties** and navigate to the **Security** tab.
    *   You will see that only **SYSTEM** and **Your Username** are listed. All other accounts have been removed from access.

---

## 3. Linux Implementation (Target production VM)

GitHub Actions deploys to **`~/NIYANTRAN`** and writes **`.env`** (not `/opt/setu/.../.env.production`). After each deploy (or once, if deploy preserves the file):

```bash
cd ~/NIYANTRAN

# Restrict reading/writing to the owner
chmod 600 .env

# Optional: lock ownership to the deploy user (replace ubuntu if different)
# sudo chown "$USER:$USER" .env
```

Verify:

```bash
ls -la .env
```

Expected:

```text
-rw------- 1 <deploy-user> <deploy-user> ... .env
```

### Atlas URI placement

- Put the Atlas connection string in GitHub secret `MONGODB_URI` **and** inside `ENV_FILE` as `MONGODB_URI=...`.
- Never commit real Atlas URIs. Prefer Atlas Network Access allowlisting the VM egress IP only.

---

## 4. Related runbook

See [Niyantran VM Production Support (Niyantran)/ALAY_RUNBOOK.md](../Niyantran%20VM%20Production%20Support%20(Niyantran)/ALAY_RUNBOOK.md) for the full Alay checklist (baseline, Atlas cutover, Dept/Branch, hardening).
