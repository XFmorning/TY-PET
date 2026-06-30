using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

class ForegroundApp {
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    static void Main() {
        IntPtr h = GetForegroundWindow();
        if (h != IntPtr.Zero) {
            uint pid;
            GetWindowThreadProcessId(h, out pid);
            try { Console.WriteLine(Process.GetProcessById((int)pid).ProcessName); } catch {}
        }
    }
}
