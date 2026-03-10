import cloudscraper
from bs4 import BeautifulSoup
import re

def scrape_job(url):
    try:
        # Create a Cloudscraper instance to mimic real browser TLS/Cyphers
        scraper = cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'desktop': True
            }
        )
        
        # Add basic headers just in case
        headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        
        # 15 second timeout to grab the site
        res = scraper.get(url, headers=headers, timeout=15)
        res.raise_for_status()

        html = res.text
        soup = BeautifulSoup(html, "html.parser")
        
        # Strip script and style elements
        for script in soup(["script", "style", "noscript"]):
            script.extract()
            
        text = soup.get_text(separator=" ")
        
        # Remove excessive whitespace
        text = re.sub(r"\s+", " ", text).strip()
        
        return text

    except Exception as e:
        print(f"Cloudscraper failed on {url}: {e}")
        # Always return empty string when blocked, triggering the frontend manual copy/paste fallback gracefully
        return ""
