"""
conftest.py — DeepEval shared fixtures & Confident AI configuration
====================================================================
Loaded automatically by pytest / deepeval test run before any test file.

Sets up:
  - .env + .env.local loading (picks up CONFIDENT_API_KEY from `deepeval login`)
  - Rich console patch: disables legacy Windows renderer so emoji (🎯✅⚠️)
    don't crash CP1252 terminals with UnicodeEncodeError
  - Python 3.14 crash workaround: suppresses deepeval's async trace-flush
    thread that tries to write to stdout after interpreter shutdown
  - CI-friendly: no browser auto-open, no verbose trace spam
"""

# ═══════════════════════════════════════════════════════════════════════════
# MUST BE FIRST: patch Rich BEFORE deepeval imports it.
# deepeval uses Rich's progress bars with emoji (🎯 Evaluating test case...).
# On Windows CP1252 terminals these crash with UnicodeEncodeError inside
# Rich's legacy_windows_render → WriteConsoleW path.
# Patching Console.legacy_windows = False forces Rich to use the modern
# text-mode renderer which supports full Unicode.
# ═══════════════════════════════════════════════════════════════════════════
import sys, os

# Belt: set env vars so subprocess / child processes also get UTF-8
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"]       = "1"

# Suspenders: patch Rich's Console class directly before deepeval imports it
try:
    # ① Clean up the leftover class-level property that was set by a previous
    #   conftest iteration. It prevents Console.__init__ from doing:
    #   self.legacy_windows: bool = ...  (AttributeError: no setter)
    import rich.console as _rc
    if isinstance(_rc.Console.__dict__.get("legacy_windows"), property):
        try:
            delattr(_rc.Console, "legacy_windows")
        except Exception:
            pass

    # ② Target the exact crash point: rich._windows_renderer.legacy_windows_render
    #   On Windows legacy consoles, Rich calls this to write emoji → CP1252 fails.
    #   Replace with a version that catches UnicodeEncodeError gracefully.
    import rich._windows_renderer as _wr
    import rich.console as _rcc  # re-import so the reference is fresh

    def _safe_legacy_render(buffer, term):
        """Unicode-safe replacement for the legacy Win32 console renderer."""
        for text, style, control in buffer:
            if not control:
                try:
                    if style:
                        term.write_styled(text, style)
                    else:
                        term.write_text(text)
                except (UnicodeEncodeError, UnicodeDecodeError):
                    safe = text.encode("ascii", errors="replace").decode("ascii")
                    try:
                        term.write_text(safe)
                    except Exception:
                        pass

    _wr.legacy_windows_render = _safe_legacy_render
except Exception:
    pass  # never fail in conftest

# Also reconfigure the current process stdout/stderr streams
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

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

# ── Windows / Git Bash terminal encoding fix ─────────────────────────────────
# deepeval uses Rich with emoji (⚠️ ✅ 🎯) which crashes Windows CP1252
# terminals with UnicodeEncodeError. Force UTF-8 stdout/stderr and tell
# Rich to use plain text so it never hits the legacy Windows console path.
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("NO_COLOR", "1")  # makes Rich skip emoji/color entirely

# Apply immediately to current process streams
import io
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


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
