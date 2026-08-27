"""
DeepEval Model Wrapper for Revenue Recovery Orchestrator
Wraps Gemini 3.6 Flash / Azure OpenAI so DeepEval can use it as
the judge model for all LLM-as-judge metrics (G-Eval, Hallucination, etc.).
"""

import os
import asyncio
from typing import Optional, List, Union
from deepeval.models.base_model import DeepEvalBaseLLM
from dotenv import load_dotenv

load_dotenv()


class GeminiDeepEvalModel(DeepEvalBaseLLM):
    """
    Judge model powered by Google GenAI (Gemini 3.6 Flash / Gemini 2.5 Flash Lite).
    High throughput, reliable, and compliant with DeepEval's sync/async judge interface.
    """

    def __init__(self, model_name: str = "gemini-3.6-flash", temperature: float = 0.0, *args, **kwargs):
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
        # genai.Client.aio for async calls
        from google import genai
        client_async = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        resp = await client_async.aio.models.generate_content(
            model=self.model_name,
            contents=prompt,
        )
        return resp.text or ""

    def get_model_name(self, *args, **kwargs) -> str:
        return f"google/{self.model_name}"


# Alias AzureDeepEvalModel to GeminiDeepEvalModel or Hybrid
AzureDeepEvalModel = GeminiDeepEvalModel
