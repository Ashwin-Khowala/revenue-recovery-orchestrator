"""
conftest.py — DeepEval shared fixtures & Confident AI configuration
====================================================================
Loaded automatically by pytest / deepeval test run before any test file.
Sets up:
  - .env + .env.local loading (picks up CONFIDENT_API_KEY written by `deepeval login`)
  - Shared judge model (Azure OpenAI, temperature=0.0)
  - Shared LangGraph orchestrator graph
"""

import os
import sys
import pytest

# Make sure the project root is on the path regardless of cwd
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

# Load .env first, then .env.local so Confident AI key takes precedence
from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_ROOT, ".env"), override=False)
load_dotenv(os.path.join(PROJECT_ROOT, ".env.local"), override=True)

# Tell deepeval to disable browser auto-open (CI-friendly)
os.environ.setdefault("CONFIDENT_BROWSER_OPEN", "NO")
