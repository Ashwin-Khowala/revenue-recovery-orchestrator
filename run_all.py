"""
All-in-One Server Runner for Razorpay Revenue Recovery Orchestrator
Starts simultaneously:
1. FastAPI Backend (Port 8000)
2. Next.js Dashboard (Port 3000)
3. Two-Way Telegram Recovery Bot (@razorpaytestbot)
Handles automatic port freeing and graceful shutdown of all processes on Ctrl+C.
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
                        print(f"  ⚡ Freeing port {port} (Terminating orphan PID {pid})...")
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass


def main():
    print("=" * 70)
    print("🚀 STARTING RAZORPAY REVENUE RECOVERY ORCHESTRATOR")
    print("=" * 70)
    print("  • 🖥️  FastAPI Backend API:    http://localhost:8000")
    print("  • 🌐 Next.js Dashboard UI:   http://localhost:3000")
    print("  • 🤖 Telegram Recovery Bot:  @razorpaytestbot (Long-Polling Active)")
    print("=" * 70)
    print("Press Ctrl+C anytime to stop all servers cleanly.\n")

    # 0. Clean ports before starting
    print("[0/3] Checking and freeing ports 8000 and 3000...")
    free_port(8000)
    free_port(3000)
    time.sleep(0.5)

    processes = []

    try:
        # 1. Start FastAPI Backend
        print("[1/3] Starting FastAPI Backend on port 8000...")
        backend_cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "orchestrator.webhook:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
        ]
        p_backend = subprocess.Popen(backend_cmd, cwd=ROOT_DIR)
        processes.append(("FastAPI Backend", p_backend))

        # 2. Start Next.js Dashboard
        print("[2/3] Starting Next.js Dashboard on port 3000...")
        is_windows = sys.platform.startswith("win")
        npm_cmd = "npm.cmd" if is_windows else "npm"
        p_frontend = subprocess.Popen([npm_cmd, "run", "dev"], cwd=DASHBOARD_DIR)
        processes.append(("Next.js Frontend", p_frontend))

        # 3. Start Telegram Bot Worker
        print("[3/3] Starting Telegram Bot Worker on @razorpaytestbot...")
        p_tg = subprocess.Popen(
            [sys.executable, "-m", "orchestrator.channels.telegram_bot"],
            cwd=ROOT_DIR,
        )
        processes.append(("Telegram Bot Worker", p_tg))

        print("\n✅ All 3 services are running! Open http://localhost:3000 in your browser.\n")

        # Keep parent alive and monitor children
        dead_notified = set()
        while True:
            time.sleep(1)
            for name, p in processes:
                if p.poll() is not None and name not in dead_notified:
                    dead_notified.add(name)
                    print(f"⚠️ Process {name} exited with code {p.returncode}")

    except KeyboardInterrupt:
        print("\n🛑 Stopping all servers...")
        for name, p in processes:
            print(f"  Terminating {name}...")
            try:
                if sys.platform.startswith("win"):
                    p.terminate()
                else:
                    p.send_signal(signal.SIGINT)
            except Exception:
                pass

        time.sleep(1)
        for name, p in processes:
            try:
                p.kill()
            except Exception:
                pass
        print("✓ All processes shut down cleanly.")


if __name__ == "__main__":
    main()
