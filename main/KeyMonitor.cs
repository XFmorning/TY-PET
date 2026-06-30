using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Interop;
using System.Windows;

class KeyMonitor {
    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTDEVICE {
        public ushort usUsagePage;
        public ushort usUsage;
        public uint dwFlags;
        public IntPtr hwndTarget;
    }

    [DllImport("user32.dll")]
    static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);

    const int WM_INPUT = 0x00FF;
    static string outFile;

    [STAThread]
    static void Main() {
        outFile = Path.GetTempPath() + "typet_pipe.txt";
        try { File.WriteAllText(outFile, ""); } catch {}

        var wpfApp = new Application();
        var win = new Window {
            Width = 0, Height = 0,
            WindowStyle = WindowStyle.None,
            ShowInTaskbar = false,
            WindowState = WindowState.Minimized,
            ShowActivated = false
        };

        win.SourceInitialized += (s, e) => {
            var hwnd = new WindowInteropHelper(win).Handle;
            try { File.WriteAllText(outFile, "H" + hwnd.ToInt32()); } catch {}
            var source = HwndSource.FromHwnd(hwnd);
            source.AddHook(WndProc);

            RAWINPUTDEVICE[] dev = new RAWINPUTDEVICE[1];
            dev[0].usUsagePage = 1;
            dev[0].usUsage = 6;
            dev[0].dwFlags = 0x00000100; // RIDEV_INPUTSINK: 后台也能接收
            dev[0].hwndTarget = hwnd;

            bool ok = RegisterRawInputDevices(dev, 1, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
            try { File.WriteAllText(outFile, ok ? "R" : "F"); } catch {}
        };

        wpfApp.Run(win);
    }

    static IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled) {
        if (msg == WM_INPUT) {
            try { File.WriteAllText(outFile, "K"); } catch {}
        }
        return IntPtr.Zero;
    }
}
