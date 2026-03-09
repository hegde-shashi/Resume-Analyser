from langchain_google_genai import ChatGoogleGenerativeAI
from google import genai  
import logging
from backend.config import GOOGLE_API_KEY


def handle_llm_error(e):
    """Translate raw LLM exceptions into user-friendly messages."""
    error_msg = str(e).lower()
    logging.error(f"LLM Error: {e}")
    
    if "api key" in error_msg:
        return "Invalid API Key. Please verify your Google AI Studio credentials in Settings."
    elif "quota" in error_msg or "429" in error_msg:
        return "Model quota exceeded or rate limited. Please try a different model or wait a few minutes."
    elif "not found" in error_msg:
        return "The selected model was not found or you don't have access to it. Please try another model."
    elif "safety" in error_msg:
        return "The request was blocked by AI safety filters. Please try again with different text."
    else:
        return f"AI Service Error: {str(e)}"

def get_llm(data):
    try:
        model = data.get('model', 'gemini-1.5-flash')
        mode = data.get('mode', 'default')

        if mode == 'user':
            api_key = data.get('api_key')
        else:
            api_key = GOOGLE_API_KEY
        
        if not api_key:
            raise ValueError("Google API Key is missing. Please check your settings.")
            
        return ChatGoogleGenerativeAI(model=model, google_api_key=api_key)
    except Exception as e:
        raise RuntimeError(handle_llm_error(e))


def check_llm(API_KEY):
    try:
        client = genai.Client(api_key=API_KEY)
        models = client.models.list()
        res = []
        for m in models:
            if any(word in m.name.lower() for word in ["image", "tts", "robotics", "computer", "research", "banana", 'embedding', 'audio']):
                continue
            if 'gemini' in m.name.lower() or 'gemma' in m.name.lower():
                res.append(str(m.name).split("/")[1])
        
        if not res:
            return ["gemini-1.5-flash", "gemini-1.5-pro"] 
        return res
    except Exception as e:
        raise ValueError(handle_llm_error(e))

# get_llm("gemini-2.5-flash")
# get_llm("gemini-3.1-flash-lite-preview")
# get_llm("gemini-3-flash-preview")
# get_llm("gemini-2.5-flash-lite")