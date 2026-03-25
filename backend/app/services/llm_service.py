# PATH: backend/app/services/llm_service.py
#
# PURPOSE:
#   Two jobs:
#   1. _build_llm()          → converts a stored LLMConfig DB row into a real
#                              LangChain LLM object ready to call
#   2. test_llm_connection() → sends a tiny test message to verify the config works
#
# CALLED BY:
#   - routers/llm.py          → test_llm_connection() on the "Test Connection" button
#   - agent_runner/graph_builder.py → _build_llm() when building the agent graph

import time
from app.models.llm_config import LLMConfig
from app.schemas.llm_config import LLMTestResponse


async def test_llm_connection(config: LLMConfig) -> LLMTestResponse:
    """
    Verifies that the stored API key + model + endpoint are working.
    Sends a single tiny prompt and measures response latency.
    """
    start = time.time()
    try:
        llm = _build_llm(config)
        test_prompt = "Reply with one word: ok"
        if hasattr(llm, "ainvoke"):
            await llm.ainvoke(test_prompt)
        else:
            llm.invoke(test_prompt)
        latency_ms = int((time.time() - start) * 1000)
        return LLMTestResponse(success=True, message="Connection successful", latency_ms=latency_ms)
    except Exception as exc:
        return LLMTestResponse(success=False, message=str(exc), latency_ms=None)


def _build_llm(config: LLMConfig):
    """
    Reads a LLMConfig row and returns the matching LangChain chat model.

    Supported providers:
      openai    → ChatOpenAI   (gpt-4o, gpt-4o-mini, gpt-3.5-turbo, ...)
      anthropic → ChatAnthropic (claude-3-5-sonnet, claude-3-haiku, ...)
      groq      → ChatGroq     (llama3-8b-8192, mixtral-8x7b-32768, ...)
      ollama    → ChatOpenAI pointed at local Ollama server
      custom    → ChatOpenAI pointed at any OpenAI-compatible endpoint
    """
    provider = (config.provider or "").lower().strip()

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config.model,
            api_key=config.api_key,
            temperature=config.temperature if config.temperature is not None else 0.7,
            max_tokens=config.max_tokens or 2048,
        )

    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=config.model,
            api_key=config.api_key,
            temperature=config.temperature if config.temperature is not None else 0.7,
            max_tokens=config.max_tokens or 2048,
        )

    elif provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=config.model,
            api_key=config.api_key,
            temperature=config.temperature if config.temperature is not None else 0.7,
        )

    elif provider in ("ollama", "custom"):
        # Ollama and custom endpoints expose an OpenAI-compatible /v1 API
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config.model,
            base_url=config.api_base_url or "http://localhost:11434/v1",
            api_key=config.api_key or "ollama",
            temperature=config.temperature if config.temperature is not None else 0.7,
        )

    else:
        raise ValueError(
            f"Unsupported provider: '{provider}'. "
            "Valid options: openai, anthropic, groq, ollama, custom"
        )