import re

import requests
from langchain_core.tools import tool


@tool
def WebScraperTool(url: str) -> str:
    """Fetch a URL and return title, description and first text snippet."""
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as exc:
        return f"Web scraper error: {exc}"

    html = resp.text
    title_match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    title = title_match.group(1).strip() if title_match else "(no title found)"

    # Try to get first paragraph text
    body_match = re.search(r"<p>(.*?)</p>", html, re.IGNORECASE | re.DOTALL)
    body = re.sub(r"\s+", " ", body_match.group(1).strip()) if body_match else "(no paragraph found)"

    description = f"Title: {title}\nSnippet: {body[:600]}"

    # Extract a few href values safely
    links = re.findall(r'href=["\'](http[s]?://[^"\']+)', html)
    links_preview = "\n".join(links[:5]) or "(no links found)"

    return f"URL: {url}\n{description}\nLinks:\n{links_preview}"
