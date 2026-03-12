import json
from backend.ai.prompt_template import resume_check


def validate_resume(llm, text: str) -> bool:
    """
    text: plain string (first ~2000 chars of resume)
    Returns True if it looks like a resume, False otherwise.
    """
    try:
        chain  = resume_check(text) | llm
        result = chain.invoke({"text": text})
        
        content = result.content
        if isinstance(content, list):
            content = " ".join([str(p.get("text", p)) if isinstance(p, dict) else str(p) for p in content])
        
        response = str(content).replace("```json", "").replace("```", "").strip()
        return json.loads(response).get("is_resume", False)
    except Exception:
        # If parsing fails, assume it's valid to not block the user
        return True