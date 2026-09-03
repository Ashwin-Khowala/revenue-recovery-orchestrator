"""
LLM Client Factory
Configurable singleton supporting Azure OpenAI deployments (gpt-5.4-mini, gpt-5.4-nano)
and Google GenAI models (gemini-3.1-flash-live-preview, gemini-2.5-flash) with automatic failover.
"""

import os
import logging
from typing import Optional, Any
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("orchestrator.llm")


class _SimpleResponse:
    def __init__(self, content: str):
        self.content = content


class GeminiChatLLM:
    """
    Lightweight LangChain-compatible wrapper around Google GenAI SDK.
    Supports .invoke(prompt) -> response.content.
    """

    def __init__(self, model_name: str = "gemini-3.6-flash", temperature: float = 0.0):
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured")
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name
        self.temperature = temperature

    def invoke(self, prompt: Any) -> _SimpleResponse:
        text_prompt = prompt if isinstance(prompt, str) else str(prompt)
        resp = self.client.models.generate_content(
            model=self.model_name,
            contents=text_prompt,
        )
        return _SimpleResponse(resp.text or "")


def get_gemini_chat_llm(model_name: str = "gemini-3.6-flash", temperature: float = 0.0) -> Optional[GeminiChatLLM]:
    try:
        return GeminiChatLLM(model_name=model_name, temperature=temperature)
    except Exception as e:
        logger.error(f"Failed to initialize GeminiChatLLM: {e}")
        return None


def get_azure_chat_llm(
    deployment_name: Optional[str] = None,
    temperature: float = 0.0,
    api_version: Optional[str] = None,
):
    """
    Returns an AzureChatOpenAI instance configured via environment variables.
    Falls back to GeminiChatLLM if Azure OpenAI keys are missing or deployment is unavailable.
    """
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    resolved_deployment = deployment_name or os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini")
    resolved_api_version = api_version or os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    if api_key and endpoint:
        try:
            from langchain_openai import AzureChatOpenAI

            llm = AzureChatOpenAI(
                azure_deployment=resolved_deployment,
                api_version=resolved_api_version,
                azure_endpoint=endpoint,
                api_key=api_key,
                temperature=temperature,
                max_retries=1,
                timeout=10.0,
            )
            return llm
        except Exception as e:
            logger.warning(f"AzureChatOpenAI init failed: {e}. Falling back to Gemini.")

    # Fallback to Gemini
    return get_gemini_chat_llm(temperature=temperature)
