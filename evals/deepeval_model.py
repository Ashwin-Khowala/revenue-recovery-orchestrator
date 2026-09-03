"""
DeepEval Judge Model Wrappers for Revenue Recovery Orchestrator
================================================================
Enterprise LLM-as-judge wrappers bridging Azure OpenAI (GPT-5.4 Mini,
GPT-5.4 Nano, GPT-4o Mini) and Google Gemini (Gemini Flash) into DeepEval's
evaluation metrics framework (G-Eval, Hallucination, etc.).

Features:
  - AzureOpenAIDeepEvalModel: High-performance, low-latency, enterprise judge
    hosted on Azure OpenAI without free-tier throttling.
  - GeminiDeepEvalModel: Alternative judge model for cross-vendor evals.
  - Full support for sync `generate()` and async `a_generate()`.
  - Seamless handling of Structured Output schemas via Pydantic & JSON modes.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Optional, Type, Union

from deepeval.models.base_model import DeepEvalBaseLLM
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"), override=True)

logger = logging.getLogger("evals.deepeval_model")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. AZURE OPENAI JUDGE MODEL (Primary Production & Eval Judge)
# ═══════════════════════════════════════════════════════════════════════════════

class AzureOpenAIDeepEvalModel(DeepEvalBaseLLM):
    """
    Primary LLM-as-judge model powered by Azure OpenAI.
    Supports gpt-4o-mini / gpt-4o deployments.
    """

    def __init__(
        self,
        deployment_name: Optional[str] = None,
        temperature: float = 0.0,
        api_version: Optional[str] = None,
        *args,
        **kwargs,
    ):
        self.deployment_name = (
            deployment_name
            or os.getenv("DEEPEVAL_JUDGE_MODEL")
            or os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-54-mini")
        )

        self.temperature = temperature
        self.api_version = api_version or os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
        self.endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        self.api_key = os.getenv("AZURE_OPENAI_API_KEY")

        if not self.api_key or not self.endpoint:
            logger.warning("Azure OpenAI credentials missing in environment. Check AZURE_OPENAI_API_KEY & AZURE_OPENAI_ENDPOINT.")

        # Initialize clients via load_model (sync client) and async client
        super().__init__(*args, **kwargs)
        self._async_client = None

    def load_model(self):
        """Loads and returns the synchronous AzureOpenAI client."""
        from openai import AzureOpenAI

        return AzureOpenAI(
            azure_endpoint=self.endpoint,
            api_key=self.api_key,
            api_version=self.api_version,
            timeout=30.0,
            max_retries=2,
        )

    def _get_async_client(self):
        if self._async_client is None:
            from openai import AsyncAzureOpenAI

            self._async_client = AsyncAzureOpenAI(
                azure_endpoint=self.endpoint,
                api_key=self.api_key,
                api_version=self.api_version,
                timeout=30.0,
                max_retries=2,
            )
        return self._async_client

    def _build_messages(self, prompt: str, schema: Optional[Type[BaseModel]] = None) -> list[dict]:
        messages = []
        if schema is not None:
            schema_json = json.dumps(schema.model_json_schema(), indent=2)
            messages.append({
                "role": "system",
                "content": (
                    f"You are a rigorous financial AI evaluation judge. You must strictly output valid JSON matching this schema:\n{schema_json}\n\n"
                    "CRITICAL INSTRUCTION: If evaluating violations, errors, or out-of-character responses and NONE are found (the interaction is fully compliant/adherent), "
                    "the corresponding list (e.g. 'verdicts') MUST be completely empty: []. Do not create verdict objects to describe compliant turns."
                ),
            })
        messages.append({"role": "user", "content": prompt})
        return messages

    def _get_completion_kwargs(self, messages: list[dict], schema: Optional[Type[BaseModel]] = None) -> dict:
        kwargs: dict[str, Any] = {
            "model": self.deployment_name,
            "messages": messages,
            "max_completion_tokens": 1500,
        }
        # Avoid passing temperature if model is an o-series/reasoning model that forbids custom temperature
        if not ("o1" in self.deployment_name or "o3" in self.deployment_name):
            kwargs["temperature"] = self.temperature

        if schema is not None:
            kwargs["response_format"] = {"type": "json_object"}

        return kwargs

    def generate(self, prompt: str, schema: Optional[Type[BaseModel]] = None, *args, **kwargs) -> str:
        """Synchronous evaluation generation."""
        messages = self._build_messages(prompt, schema)
        call_kwargs = self._get_completion_kwargs(messages, schema)

        try:
            resp = self.model.chat.completions.create(**call_kwargs)
            return resp.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"[AzureJudge] Sync generation failed on {self.deployment_name}: {e}")
            raise

    async def a_generate(self, prompt: str, schema: Optional[Type[BaseModel]] = None, *args, **kwargs) -> str:
        """Asynchronous evaluation generation (invoked by DeepEval a_measure)."""
        client = self._get_async_client()
        messages = self._build_messages(prompt, schema)
        call_kwargs = self._get_completion_kwargs(messages, schema)

        try:
            resp = await client.chat.completions.create(**call_kwargs)
            return resp.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"[AzureJudge] Async generation failed on {self.deployment_name}: {e}")
            raise

    def get_model_name(self, *args, **kwargs) -> str:
        return f"azure/{self.deployment_name}"


# ═══════════════════════════════════════════════════════════════════════════════
# 2. GEMINI JUDGE MODEL (Alternative / Cross-Vendor Benchmarks)
# ═══════════════════════════════════════════════════════════════════════════════

class GeminiDeepEvalModel(DeepEvalBaseLLM):
    """
    Alternative judge model powered by Google GenAI (Gemini 2.5 Flash Lite / 3.6 Flash).
    Used for multi-model comparisons and fallback redundancy.
    """

    def __init__(self, model_name: str = "gemini-2.5-flash-lite", temperature: float = 0.0, *args, **kwargs):
        self.model_name = model_name
        self.temperature = temperature
        super().__init__(*args, **kwargs)

    def load_model(self):
        from google import genai

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required for GeminiDeepEvalModel")
        return genai.Client(api_key=api_key)

    def generate(self, prompt: str, *args, **kwargs) -> str:
        resp = self.model.models.generate_content(
            model=self.model_name,
            contents=prompt,
        )
        return resp.text or ""

    async def a_generate(self, prompt: str, *args, **kwargs) -> str:
        from google import genai

        client_async = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        resp = await client_async.aio.models.generate_content(
            model=self.model_name,
            contents=prompt,
        )
        return resp.text or ""

    def get_model_name(self, *args, **kwargs) -> str:
        return f"google/{self.model_name}"


# ═══════════════════════════════════════════════════════════════════════════════
# Aliases & Factory
# ═══════════════════════════════════════════════════════════════════════════════

# AzureOpenAIDeepEvalModel is the primary default judge
AzureDeepEvalModel = AzureOpenAIDeepEvalModel


def get_judge_model(model_name: Optional[str] = None) -> DeepEvalBaseLLM:
    """Factory helper to obtain a configured judge model."""
    name = (
        model_name
        or os.getenv("DEEPEVAL_JUDGE_MODEL")
        or os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-54-mini")
    )
    if "gemini" in name.lower():
        return GeminiDeepEvalModel(model_name=name)
    return AzureOpenAIDeepEvalModel(deployment_name=name)

