const { spawn } = require('child_process');
const path = require('path');

class ActiveAppWatcher {
  constructor() {
    this.currentApp = 'Desktop';
    this.currentTitle = '';
    this.process = null;
  }

  start() {
    if (process.platform !== 'win32') {
      return;
    }

    const script = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class WinUtils {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  }
"@ -ErrorAction SilentlyContinue

while ($true) {
  try {
    $h = [WinUtils]::GetForegroundWindow()
    $p = 0
    [WinUtils]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null
    $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
    $sb = New-Object System.Text.StringBuilder 256
    [WinUtils]::GetWindowText($h, $sb, 256) | Out-Null
    $app = if ($proc) { $proc.ProcessName } else { "Desktop" }
    $title = $sb.ToString()
    Write-Output "APP:$app|$title"
  } catch {}
  Start-Sleep -Milliseconds 1500
}
`;

    try {
      this.process = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command', script
      ], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      });

      this.process.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('APP:')) {
            const parts = trimmed.substring(4).split('|');
            let appName = parts[0] ? parts[0].trim() : 'Desktop';
            const title = parts[1] ? parts[1].trim() : '';

            // Clean up common Windows process names for friendly display
            if (appName.toLowerCase() === 'code') appName = 'VS Code';
            else if (appName.toLowerCase() === 'chrome') appName = 'Google Chrome';
            else if (appName.toLowerCase() === 'msedge') appName = 'Microsoft Edge';
            else if (appName.toLowerCase() === 'firefox') appName = 'Firefox';
            else if (appName.toLowerCase() === 'explorer') appName = 'File Explorer';
            else if (appName.toLowerCase() === 'electron') appName = 'Workflow App';
            else if (appName.toLowerCase() === 'slack') appName = 'Slack';
            else if (appName.toLowerCase() === 'teams') appName = 'Microsoft Teams';
            else if (appName.toLowerCase() === 'notepad') appName = 'Notepad';

            this.currentApp = appName;
            this.currentTitle = title;
          }
        }
      });

      this.process.on('error', (err) => {
        console.warn('ActiveAppWatcher error:', err.message);
      });
    } catch (e) {
      console.warn('Failed to start ActiveAppWatcher:', e.message);
    }
  }

  getCurrentApp() {
    return this.currentApp;
  }

  getCurrentTitle() {
    return this.currentTitle;
  }

  stop() {
    if (this.process) {
      try {
        this.process.kill();
      } catch (e) {}
      this.process = null;
    }
  }
}

module.exports = new ActiveAppWatcher();
