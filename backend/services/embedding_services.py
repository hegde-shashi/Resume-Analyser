from langchain_google_genai import GoogleGenerativeAIEmbeddings
from backend.config import GOOGLE_API_KEY

def google_embedding(api_key=None):
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key or GOOGLE_API_KEY
    )
    return embeddings