from langchain_google_genai import ChatGoogleGenerativeAI
from google import genai  
from backend.config import GOOGLE_API_KEY


def get_llm(data):
    model = data.get('model', 'gemini-2.5-flash')
    mode = data.get('mode', 'default')

    if mode == 'user':
        api_key = data.get('api_key')
    else:
        api_key = GOOGLE_API_KEY
    return ChatGoogleGenerativeAI(model=model, google_api_key=api_key)


def check_llm(API_KEY):
    client = genai.Client(api_key=API_KEY)
    models = client.models.list()
    res = []
    for m in models:
        if any(word in m.name for word in [ "image","tts","robotics","computer","research","banana", 'embedding', 'audio']):
            continue
        if 'gemini' in m.name or 'gemma' in m.name:
            res.append(str(m.name).split("/")[1])
    
    return res

# get_llm("gemini-2.5-flash")
# get_llm("gemini-3.1-flash-lite-preview")
# get_llm("gemini-3-flash-preview")
# get_llm("gemini-2.5-flash-lite")