"""
conftest.py — DeepEval shared fixtures & Confident AI configuration
====================================================================
Loaded automatically by pytest / deepeval test run before any test file.

Sets up:
  - .env + .env.local loading (picks up CONFIDENT_API_KEY from `deepeval login`)
  - Shared judge model (Azure OpenAI, temperature=0.0)
  - Python 3.14 crash workaround: suppresses deepeval's async trace-flush
    thread that tries to write to stdout after interpreter shutdown
  - CI-friendly: no browser auto-open, no verbose trace spam
"""

import os
import sys
import atexit
import threading
import warnings

# ── Suppress asyncio deprecation from deepeval (Python 3.14) ────────────────
warnings.filterwarnings(
    "ignore",
    message="'asyncio.iscoroutinefunction' is deprecated",
    category=DeprecationWarning,
)

# ── Project root ─────────────────────────────────────────────────────────────
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

# ── Load credentials ─────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_ROOT, ".env"), override=False)
load_dotenv(os.path.join(PROJECT_ROOT, ".env.local"), override=True)

# ── CI-friendly deepeval config ───────────────────────────────────────────────
# No browser auto-open when trace results post to Confident AI
os.environ.setdefault("CONFIDENT_BROWSER_OPEN", "NO")
# Suppress the verbose per-trace "[Confident AI Trace Log]" spam
os.environ.setdefault("CONFIDENT_TRACE_VERBOSE", "0")


# ── Python 3.14 fatal crash workaround ───────────────────────────────────────
# deepeval's trace-flush daemon thread calls asyncio.iscoroutinefunction at
# interpreter shutdown, which acquires a stdout lock that Python 3.14 has
# already released — causing: "Fatal Python error: _enter_buffered_busy".
# Fix: register an atexit that gives the flush thread 2s to finish, then
# marks all remaining non-main daemon threads as "done" so Python doesn't
# block on them at shutdown.

def _graceful_deepeval_shutdown():
    """Allow deepeval's async trace queue to drain before interpreter exits."""
    try:
        # Give in-flight trace uploads a moment to finish
        import concurrent.futures
        for _ in range(20):          # max 2s total
            daemon_threads = [
                t for t in threading.enumerate()
                if t.daemon and t is not threading.main_thread()
            ]
            if not daemon_threads:
                break
            threading.Event().wait(0.1)
    except Exception:
        pass  # never crash in atexit


atexit.register(_graceful_deepeval_shutdown)
