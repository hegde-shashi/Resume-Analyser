from backend.ai.llm_client import get_llm as get_base_llm

def get_llm(config=None):
    """
    Agent-specific LLM getter that handles dynamic configuration.
    """
    if config is None:
        config = {}
        
    return get_base_llm(config)
