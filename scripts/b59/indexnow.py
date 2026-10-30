"""B59 · IndexNow ping (Build Scope 35.3).

Tells Bing, Yandex, Seznam, Naver and the other IndexNow engines (and through Bing,
ChatGPT search and Copilot) that pages changed, so they are re-read within hours
instead of weeks. Google does not use IndexNow; it reads the sitemap.

Live runs happen in Make (HTTP module, no code needed). This file is the reference:
the exact request Make sends, and a command-line tool for one-off pings.

    INDEXNOW_KEY=... python3 -I scripts/b59/indexnow.py --dry-run URL [URL ...]

The key is public by design (it is served at https://www.techdirectory.io/<key>.txt),
but it is still kept out of GitHub: it lives in Make and in the key file only.
"""
import json, os, re, sys, urllib.request

HOST = "www.techdirectory.io"
ENDPOINT = "https://api.indexnow.org/indexnow"
MAX_URLS = 10_000          # IndexNow limit per request
KEY_RE = re.compile(r"^[A-Za-z0-9-]{8,128}$")


def batches(urls, key, size=MAX_URLS):
    """Yield IndexNow JSON bodies: own-host URLs only, de-duplicated, in order."""
    if not KEY_RE.match(key or ""):
        raise ValueError("IndexNow key must be 8-128 letters, digits or dashes")
    seen, clean = set(), []
    for u in urls:
        u = u.strip()
        if not u.startswith(f"https://{HOST}/") or u in seen:
            continue
        seen.add(u)
        clean.append(u)
    for i in range(0, len(clean), size):
        yield {"host": HOST, "key": key, "keyLocation": f"https://{HOST}/{key}.txt",
               "urlList": clean[i:i + size]}


def send(body, timeout=30):
    req = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status  # 200 or 202 = received; 403 = key file not found; 422 = URL not on host; 429 = too many


if __name__ == "__main__":
    args = sys.argv[1:]
    dry = "--dry-run" in args
    urls = [a for a in args if a != "--dry-run"]
    key = os.environ.get("INDEXNOW_KEY", "")
    for body in batches(urls, key):
        if dry:
            print(json.dumps(dict(body, key="<key>", keyLocation=f"https://{HOST}/<key>.txt"), indent=2))
        else:
            print(len(body["urlList"]), "URLs ->", send(body))
