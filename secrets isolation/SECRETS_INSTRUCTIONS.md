# Niyantran Secrets Isolation: Windows & Linux Guide

This directory contains utility scripts to implement **Secrets Isolation** for the Niyantran production environment variables file (`.env.production`).

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
    *   Finds your `.env.production` file at the root of the project.
    *   Disables NTFS permission inheritance (wiping out general read access from other user groups like "Everyone" or "Users").
    *   Adds explicit Full Control permissions ONLY to the current logged-in user and the `SYSTEM` account (required by Docker and system services).
*   **`lock-secrets.bat`** (Batch Helper):
    *   Bypasses PowerShell execution policies and launches the script. It is double-clickable.

### Instructions:
1.  Double-click **`lock-secrets.bat`** inside this folder.
2.  A command prompt window will open, lock the file permissions, and display a success message.
3.  **Verification:**
    *   Right-click the `.env.production` file at the project root.
    *   Select **Properties** and navigate to the **Security** tab.
    *   You will see that only **SYSTEM** and **Your Username** are listed in the Group/User names list. All other accounts (including "Users" or "Authenticated Users") have been removed from access.

---

## 3. Linux Implementation (Target Yotta VM)

When you deploy the application on the production Yotta VM (Ubuntu/Debian), you don't need a separate script. You can use standard Linux shell commands to lock down permissions.

Run the following commands inside the directory containing `.env.production` on the VM:

```bash
# 1. Change file ownership to root administrator
sudo chown root:root .env.production

# 2. Grant Read/Write access ONLY to the owner (root) and block everyone else
sudo chmod 600 .env.production
```

To verify the file permissions on Linux, run:
```bash
ls -la .env.production
```
The output should look exactly like:
```text
-rw------- 1 root root ... .env.production
```
*(The `-rw-------` prefix confirms that only the file owner has read/write permissions, and other users have no access whatsoever).*
