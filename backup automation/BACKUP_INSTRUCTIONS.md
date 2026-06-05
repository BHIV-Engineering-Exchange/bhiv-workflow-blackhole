# Niyantran Database Backup System: Windows Setup Guide

This folder contains the automated backup scripts for the containerized MongoDB database (`niyantran_database`). 

---

## 1. How It Works

*   **`backup-db.ps1`** (PowerShell Script): 
    *   Tells Docker to run `mongodump` inside the running MongoDB database container.
    *   Saves the data as a compressed archive (`.gz`) file inside a `backups/` folder at the project root.
    *   Looks through the folder and deletes backup files older than 7 days to conserve disk space.
*   **`backup-db.bat`** (Batch Wrapper): 
    *   A simple helper file that bypasses execution policy restrictions and runs the PowerShell script. You can run this file directly or double-click it.

---

## 2. Running the Backup Manually

To run a backup manually:
1. Double-click the **`backup-db.bat`** file.
2. A command prompt window will open, perform the backup, print the status, and close.
3. Check the new **`backups/`** folder created in the root of the project to find your backup file (e.g. `mongodb_backup_20260604_140000.gz`).

---

## 3. How to Set Up Automated Daily Backups on Windows

To run the backup automatically every day without having to do it manually, we use the built-in Windows **Task Scheduler**:

### Step 1: Open Task Scheduler
1. Press the **Windows Key** on your keyboard.
2. Type **Task Scheduler** and press **Enter**.

### Step 3: Create a New Task
1. In the right-hand panel of the Task Scheduler window, click **Create Basic Task...**
2. In the wizard, enter:
   *   **Name:** `Niyantran Database Backup`
   *   **Description:** `Automated daily backup of MongoDB container with 7-day retention.`
3. Click **Next**.

### Step 4: Choose the Schedule
1. Under **Trigger**, select **Daily**, and click **Next**.
2. Set the **Start Time** to when you want it to run (e.g., `02:00:00 AM` during low usage hours) and keep Recur every `1` day.
3. Click **Next**.

### Step 5: Configure the Action
1. Under **Action**, select **Start a program**, and click **Next**.
2. For **Program/script**, click **Browse...** and select:
   `C:\Users\ASUS\OneDrive\Desktop\BHIV-Tasks\SETU\workflow-blackhole\backup automation\backup-db.bat`
3. For **Start in (optional)**, paste the path to the script folder:
   `C:\Users\ASUS\OneDrive\Desktop\BHIV-Tasks\SETU\workflow-blackhole\backup automation`
   *(This ensures Windows runs the script in its own directory context so it can find all files correctly).*
4. Click **Next**.

### Step 6: Finish & Save
1. Review the summary and click **Finish**.
2. The task is now scheduled! It will run daily at the selected time as long as your computer is turned on.

---

## 4. How to Restore from a Backup File

If you ever need to restore your database using one of your backup files, execute the following command in PowerShell or Command Prompt from the project root:

```bash
# Replace 'mongodb_backup_filename.gz' with the actual name of your backup file
docker exec -i niyantran_database mongorestore --archive --gzip < .\backups\mongodb_backup_filename.gz
```
