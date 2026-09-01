"""
All-in-One Server Runner for Razorpay Revenue Recovery Orchestrator
Starts simultaneously:
1. FastAPI Backend (Port 8000)
2. Next.js Dashboard (Port 3000)
3. Two-Way Telegram Recovery Bot (@razorpaytestbot)
Features:
- Automatic port cleanup before start
- High-Availability Auto-Restart: Monitors children and automatically restarts any process that crashes
- Graceful shutdown on Ctrl+C
"""

import sys
import os
import subprocess
import signal
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_DIR = os.path.join(ROOT_DIR, "dashboard")

# Set PYTHONPATH
os.environ["PYTHONPATH"] = ROOT_DIR


def free_port(port: int):
    """Frees a port on Windows/Linux if currently occupied by an orphaned process."""
    if sys.platform.startswith("win"):
        try:
            out = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode(errors="ignore")
            for line in out.strip().splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and "LISTENING" in line:
                    pid = parts[-1]
                    if pid != "0" and pid != str(os.getpid()):
                        print(f"  [INFO] Freeing port {port} (Terminating orphan PID {pid})...")
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass


def start_backend():
    free_port(8000)
    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "orchestrator.webhook:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--reload",
    ]
    return subprocess.Popen(backend_cmd, cwd=ROOT_DIR)


def start_frontend():
    free_port(3000)
    is_windows = sys.platform.startswith("win")
    npm_cmd = "npm.cmd" if is_windows else "npm"
    return subprocess.Popen(
        f"{npm_cmd} run dev" if is_windows else ["npm", "run", "dev"],
        cwd=DASHBOARD_DIR,
        shell=is_windows,
    )


def start_telegram_bot():
    return subprocess.Popen(
        [sys.executable, "-m", "orchestrator.channels.telegram_bot"],
        cwd=ROOT_DIR,
    )


def main():
    print("=" * 70)
    print("STARTING RAZORPAY REVENUE RECOVERY ORCHESTRATOR")
    print("=" * 70)
    print("  • FastAPI Backend API:    http://localhost:8000")
    print("  • Next.js Dashboard UI:   http://localhost:3000")
    print("  • Telegram Recovery Bot:  @razorpaytestbot (Long-Polling Active)")
    print("  • Auto-Restart Mode:      ENABLED (Self-healing on crash/edit)")
    print("=" * 70)
    print("Press Ctrl+C anytime to stop all servers cleanly.\n")

    # 0. Clean ports before starting
    print("[0/3] Checking and freeing ports 8000 and 3000...")
    free_port(8000)
    free_port(3000)
    time.sleep(0.5)

    services = {
        "FastAPI Backend": {"start": start_backend, "proc": None, "last_restart": 0},
        "Next.js Frontend": {"start": start_frontend, "proc": None, "last_restart": 0},
        "Telegram Bot Worker": {"start": start_telegram_bot, "proc": None, "last_restart": 0},
    }

    try:
        # Start initial services
        for name, svc in services.items():
            print(f"[START] Launching {name}...")
            svc["proc"] = svc["start"]()
            svc["last_restart"] = time.time()

        print("\n[READY] All 3 services are running! Open http://localhost:3000 in your browser.\n")

        # Supervisor loop with auto-restart
        while True:
            time.sleep(2)
            now = time.time()
            for name, svc in services.items():
                p = svc["proc"]
                if p and p.poll() is not None:
                    code = p.returncode
                    # Debounce rapid restarts (at least 3s between restarts)
                    if now - svc["last_restart"] >= 3:
                        print(f"\n[AUTO-RESTART] Service '{name}' exited (code {code}). Auto-restarting now...")
                        try:
                            svc["proc"] = svc["start"]()
                            svc["last_restart"] = now
                            print(f"[AUTO-RESTART] Successfully restarted '{name}'.\n")
                        except Exception as e:
                            print(f"[ERROR] Failed to auto-restart '{name}': {e}")

    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Stopping all servers...")
        for name, svc in services.items():
            p = svc["proc"]
            if p:
                print(f"  Terminating {name}...")
                try:
                    if sys.platform.startswith("win"):
                        p.terminate()
                    else:
                        p.send_signal(signal.SIGINT)
                except Exception:
                    pass

        time.sleep(1)
        for name, svc in services.items():
            p = svc["proc"]
            if p:
                try:
                    p.kill()
                except Exception:
                    pass
        print("[SUCCESS] All processes shut down cleanly.")


if __name__ == "__main__":
    main()
