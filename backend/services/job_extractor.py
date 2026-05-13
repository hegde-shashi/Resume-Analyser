import json
import logging
from backend.ai.llm_client import get_llm
from backend.ai.prompt_template import job_description_prompt

def extract_job_details(llm, job_text):
    """
    Extract structured details from a job description text using a direct LLM call.
    This bypasses the agent graph for speed and cost efficiency.
    """
    try:
        chain = job_description_prompt() | llm
        result = chain.invoke({"job_text": job_text})
        
        content = result.content
        if isinstance(content, list):
            content = " ".join([str(c.get('text', c)) if isinstance(c, dict) else str(c) for c in content])
        if not isinstance(content, str):
            content = str(content)
            
        import re
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            return json.loads(match.group())
        return {}
    except Exception as e:
        logging.error(f"Error in extract_job_details: {e}")
        raise e
