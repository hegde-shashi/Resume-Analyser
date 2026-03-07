import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import re

async def scrape_job_async(url):

    async with async_playwright() as p:

        browser = await p.chromium.launch(headless=True)

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        )

        page = await context.new_page()

        await page.goto(url, timeout=60000)

        await page.wait_for_timeout(5000)

        html = await page.content()

        await browser.close()

        return html


def scrape_job(url):
    html = asyncio.run(scrape_job_async(url))

    soup = BeautifulSoup(html, "html.parser")

    text = soup.get_text(separator=" ")

    text = re.sub(r"\s+", " ", text)

    return text.strip()
