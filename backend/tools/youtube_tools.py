from ddgs import DDGS
import logging

def youtube_search(query):
    """
    Directly searches YouTube via DuckDuckGo and returns actual video links.
    """
    try:
        # We add site:youtube.com to be absolutely sure we get video links
        search_query = f"{query} site:youtube.com"
        results = list(DDGS().videos(search_query, max_results=3))
        
        if results:
            formatted = "I found these relevant YouTube videos for you:\n\n"
            for res in results:
                title = res.get('title', 'Video')
                link = res.get('content', '')
                if link:
                    formatted += f"🎥 **{title}**\nLink: {link}\n\n"
            return formatted
            
        # Fallback to a regular text search for youtube links if videos() fails
        text_results = list(DDGS().text(search_query, max_results=3))
        if text_results:
            formatted = "Here are some YouTube results:\n\n"
            for res in text_results:
                if 'youtube.com/watch' in res.get('href', ''):
                    formatted += f"🎥 **{res['title']}**\nLink: {res['href']}\n\n"
            return formatted

        return "I couldn't find any direct video links for that query."
    except Exception as e:
        logging.error(f"YouTube Search error: {e}")
        # Last resort fallback to search URL
        clean_query = query.replace(" ", "+")
        return f"Please check the search results here: https://www.youtube.com/results?search_query={clean_query}"