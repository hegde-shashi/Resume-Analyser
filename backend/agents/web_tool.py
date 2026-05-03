from ddgs import DDGS
import logging
from backend.tools.youtube_tools import youtube_search

def search_web(query):
    """
    Search web and return actual links. 
    Intelligently decides whether to include YouTube videos.
    """
    try:
        # Heuristic: If it looks like a learning or interview question, get videos too
        is_learning_query = any(word in query.lower() for word in ["how", "what is", "interview", "tutorial", "learn", "video", "youtube"])
        
        results_text = ""
        
        # 1. Get YouTube results if relevant
        if is_learning_query:
            results_text += youtube_search(query) + "\n\n"
            
        # 2. Get regular web results
        web_results = list(DDGS().text(query, max_results=3))
        if web_results:
            results_text += "Web Search Results:\n"
            for res in web_results:
                results_text += f"- {res['title']}: {res['href']}\n"
        
        return results_text or "No results found."
        
    except Exception as e:
        logging.error(f"Search error: {e}")
        return f"Error performing search: {str(e)}"
