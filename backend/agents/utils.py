from backend.ai.llm_client import get_llm as get_base_llm

def get_llm(config=None):
    """
    Agent-specific LLM getter that handles dynamic configuration.
    """
    if config is None:
        config = {}
        
    # Ensure model is a valid string
    model = config.get("model") or "gemini-2.5-flash-lite"
    mode = config.get("mode") or "default"
    api_key = config.get("api_key")
    
    # If the provided model is explicitly None or empty, use default
    if not model:
        model = "gemini-2.5-flash-lite"
        
    config_clean = {
        "model": model,
        "mode": mode,
        "api_key": api_key
    }
        
    return get_base_llm(config_clean)
