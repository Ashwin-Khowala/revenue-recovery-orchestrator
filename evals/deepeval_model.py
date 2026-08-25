"""
DeepEval Model Wrapper for Azure OpenAI
Wraps our existing Azure OpenAI LLM so DeepEval can use it as
the judge model for all LLM-as-judge metrics.
"""

from typing import Optional, List, Union
from deepeval.models.base_model import DeepEvalBaseLLM
from orchestrator.llm import get_azure_chat_llm


class AzureDeepEvalModel(DeepEvalBaseLLM):
    """
    Bridge between our Azure OpenAI deployment and DeepEval's judge interface.
    This reuses the same environment-configured LLM from orchestrator.llm so we
    don't duplicate credential handling.
    """

    def __init__(self, temperature: float = 0.0, *args, **kwargs):
        self.temperature = temperature
        super().__init__(*args, **kwargs)

    def load_model(self):
        return get_azure_chat_llm(temperature=getattr(self, "temperature", 0.0))

    def generate(self, prompt: str, *args, **kwargs) -> str:
        res = self.model.invoke(prompt)
        return res.content

    async def a_generate(self, prompt: str, *args, **kwargs) -> str:
        res = await self.model.ainvoke(prompt)
        return res.content

    def get_model_name(self, *args, **kwargs) -> str:
        deployment = getattr(self.model, "deployment_name", "gpt-54-mini")
        return f"azure-openai/{deployment}"
