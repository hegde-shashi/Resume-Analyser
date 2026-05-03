from ddgs import DDGS
import logging

def youtube_search(query):
    """
    Directly searches YouTube via DuckDuckGo and then YouTubeSearch as a fallback.
    """
    search_query = f"{query} site:youtube.com"
    results_found = []

    # 1. Try DuckDuckGo Search (Fastest if not ratelimited)
    try:
        with DDGS(timeout=10) as ddgs:
            # Try specific video search
            try:
                video_results = list(ddgs.videos(search_query, max_results=3))
                if video_results:
                    for res in video_results:
                        title = res.get('title', 'Video')
                        link = res.get('content', '')
                        if link:
                            results_found.append(f"🎥 **{title}**\nLink: {link}")
            except Exception as e:
                logging.warning(f"DDGS videos search failed: {e}")

            # Try text search if no results
            if not results_found:
                try:
                    text_results = list(ddgs.text(search_query, max_results=3))
                    if text_results:
                        for res in text_results:
                            href = res.get('href', '')
                            if 'youtube.com/watch' in href or 'youtu.be' in href:
                                results_found.append(f"🎥 **{res.get('title', 'Video')}**\nLink: {href}")
                except Exception as e:
                    logging.warning(f"DDGS text search failed: {e}")
    except Exception as e:
        logging.error(f"DDGS overall failure: {e}")

    # 2. Try YoutubeSearch Library (More reliable backup)
    if not results_found:
        try:
            from youtube_search import YoutubeSearch
            ys_results = YoutubeSearch(query, max_results=3).to_dict()
            if ys_results:
                for res in ys_results:
                    title = res.get('title', 'Video')
                    suffix = res.get('url_suffix', '')
                    if suffix:
                        link = f"https://www.youtube.com{suffix}"
                        results_found.append(f"🎥 **{title}**\nLink: {link}")
        except Exception as e:
            logging.error(f"YoutubeSearch library failed: {e}")

    if results_found:
        return "I found these relevant YouTube videos for you:\n\n" + "\n\n".join(results_found)

    # 3. Final Fallback to search URL
    clean_query = query.replace(" ", "+")
    return f"I couldn't find direct video links, but you can find relevant results here: https://www.youtube.com/results?search_query={clean_query}"