"""
Azure OpenAI LLM Client Factory
Configurable singleton supporting standard Azure OpenAI deployments (gpt-4o-mini, gpt-4o).
"""

import os
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("orchestrator.llm")


def get_azure_chat_llm(
    deployment_name: Optional[str] = None,
    temperature: float = 0.0,
    api_version: Optional[str] = None,
):
    """
    Returns an AzureChatOpenAI instance configured via environment variables.
    Deployment name is configurable at runtime to support multi-model evaluation benchmarks.
    """
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    resolved_deployment = deployment_name or os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini")
    resolved_api_version = api_version or os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

    if not api_key or not endpoint:
        logger.warning(
            "AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT is missing. "
            "Using mock/deterministic mode until Azure OpenAI keys are populated in .env"
        )
        return None

    try:
        from langchain_openai import AzureChatOpenAI

        llm = AzureChatOpenAI(
            azure_deployment=resolved_deployment,
            api_version=resolved_api_version,
            azure_endpoint=endpoint,
            api_key=api_key,
            temperature=temperature,
            max_retries=2,
            timeout=15.0,
        )
        return llm
    except Exception as e:
        logger.error(f"Failed to initialize AzureChatOpenAI: {e}")
        return None
