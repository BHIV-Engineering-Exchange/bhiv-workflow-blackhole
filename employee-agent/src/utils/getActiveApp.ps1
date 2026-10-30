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

$h = [WinUtils]::GetForegroundWindow()
$p = 0
[WinUtils]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null
$proc = Get-Process -Id $p -ErrorAction SilentlyContinue
$sb = New-Object System.Text.StringBuilder 256
[WinUtils]::GetWindowText($h, $sb, 256) | Out-Null
$app = if ($proc) { $proc.ProcessName } else { "System" }
$title = $sb.ToString()
Write-Output "$app|$title"
