import requests
from bs4 import BeautifulSoup
import re

url = "https://boards.greenhouse.io/openai/jobs/5208643003"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
}
try:
    res = requests.get(url, headers=headers, timeout=10)
    print(res.status_code)
    soup = BeautifulSoup(res.text, "html.parser")
    text = soup.get_text(separator=" ")
    text = re.sub(r"\s+", " ", text)
    print(text[:200])
except Exception as e:
    print(e)
