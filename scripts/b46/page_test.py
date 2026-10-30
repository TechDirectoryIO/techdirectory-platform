"""B46 order page test: renders /sponsored-post with local copies of the editor files
and checks the live guidance, the consent gate and phone layout.
Run from scripts/b46 after `npm install` and `npm install --no-save quill@2.0.3`:
    python3 -I page_test.py [screenshot-dir]
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
nm = HERE / "node_modules"
page_src = (ROOT / "site/templates/b46-sponsored-post-page.html").read_text()
assets = {
    "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css": (nm / "quill/dist/quill.snow.css", "text/css"),
    "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js": (nm / "quill/dist/quill.js", "text/javascript"),
    "https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js": (nm / "dompurify/dist/purify.min.js", "text/javascript"),
    "https://td.test/td-assets/b46-sponsored-checks.js": (ROOT / "site/js/b46-sponsored-checks.js", "text/javascript"),
}
html = ("<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
        "</head><body style='margin:0'>" + page_src + "</body></html>")

ARTICLE = ("<p>Cloud software is changing how teams plan the move to a new platform.</p><h2>Why the move matters</h2>"
           + "".join(f"<p>{'Cloud software teams migrate platform infrastructure and the data they rely on every day. ' * 9}</p>" for _ in range(8))
           + '<p>See <a href="https://example.com/cloud">our migration service</a>.</p>')

results = []
check = lambda n, ok, d="": results.append((n, bool(ok), d))
shots = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None

with sync_playwright() as pw:
    b = pw.chromium.launch()

    def inline(src):
        for url, (path, ctype) in assets.items():
            body = pathlib.Path(path).read_text()
            if ctype == "text/css":
                src = src.replace(f'<link rel="stylesheet" href="{url}">', f"<style>{body}</style>")
            else:
                rel = url.replace("https://td.test", "")
                for u in (url, rel):
                    src = src.replace(f'<script src="{u}"></script>', "<script>" + body.replace("</script", "<\\/script") + "</script>")
        return src

    def open_page(width):
        ctx = b.new_context(viewport={"width": width, "height": 900})
        p = ctx.new_page()
        errors = []
        p.on("pageerror", lambda e: errors.append(str(e)))
        p.set_content(inline(html))
        p.wait_for_selector(".ql-editor")
        return ctx, p, errors

    ctx, p, errors = open_page(1440)
    check("Page loads with no script errors", not errors, str(errors))
    check("Editor toolbar has headings, bold, italic, link, lists, quote", p.locator(".ql-toolbar button").count() >= 8)
    check("Ordering not connected: page says so, nothing can be charged",
          "Ordering opens soon" in p.inner_text("#td-sp-status"))
    check("Price shows $199 by default", p.inner_text(".td-sp__price") == "$199")
    p.select_option("#sp-currency", "GBP")
    check("Currency switch shows £159 everywhere", p.inner_text(".td-sp__price") == "£159" and p.inner_text("#sp-submit") == "Pay £159 and submit", p.inner_text("#sp-submit"))

    p.fill("#sp-site", "https://example.com")
    p.fill("#sp-title", "How cloud software teams plan a platform migration")
    p.select_option("#sp-category", "cloud-and-saas")
    p.evaluate("html => document.querySelector('.ql-editor').innerHTML = html", ARTICLE)
    p.wait_for_timeout(700)
    p.wait_for_timeout(300)
    auto = p.inner_text("#sp-desc-auto")
    check("Blank search summary shows the one made from the first paragraph", "Cloud software is changing" in auto, auto)
    p.fill("#sp-desc", "A practical guide to planning a cloud platform migration: what to check first and how to keep data safe.")
    p.fill("#sp-tags", "cloud migration, SaaS, infrastructure")
    p.wait_for_timeout(500)
    check("Search summary character count", p.inner_text("#sp-desc-count") == str(len("A practical guide to planning a cloud platform migration: what to check first and how to keep data safe.")))
    check("Search summary and tags show as passing", "Search summary and tags" in p.inner_text("#td-sp-checks") and
          p.locator("#td-sp-checks li:has-text('Search summary and tags') .td-sp__pill--ok").count() == 1, p.inner_text("#td-sp-checks"))
    words = p.inner_text("#sp-words")
    check("Live word count", words.endswith("words") and int(words.split()[0].replace(",", "")) > 600, words)
    check("Live link count", p.inner_text("#sp-links") == "1 of 2 links", p.inner_text("#sp-links"))
    check("Length and links show as passing",
          "Length" in p.inner_text("#td-sp-checks") and p.locator("#td-sp-checks .td-sp__pill--bad").count() == 0,
          p.inner_text("#td-sp-checks"))

    p.evaluate("() => { const e=document.querySelector('.ql-editor'); e.innerHTML = e.innerHTML + '<p>Try an online casino.</p>'; }")
    p.wait_for_timeout(700)
    check("A banned topic shows 'Will be refused' before payment",
          "Will be refused" in p.inner_text("#td-sp-checks"), p.inner_text("#td-sp-checks"))

    p.click("#sp-submit")
    check("Submit without details is stopped with a message", p.inner_text("#sp-form-error") != "")
    stored = p.evaluate("() => { try { return !!localStorage.getItem('td-sp-draft-v1') } catch (e) { return 'blocked' } }")
    if stored == "blocked":
        # set_content pages have no origin, so the browser blocks storage here; the page must still work
        check("Page keeps working where browser storage is blocked (draft saving: test on the live page)", not errors, str(errors))
    else:
        check("Draft is kept in the browser while writing", stored is True, str(stored))
    if shots:
        p.evaluate("() => { const e=document.querySelector('.ql-editor'); e.innerHTML = e.innerHTML.replace('<p>Try an online casino.</p>',''); }")
        p.wait_for_timeout(500)
        p.screenshot(path=str(shots / "B46-order-page-desktop.png"), full_page=True)
    ctx.close()

    ctx, m, errors = open_page(375)
    sw = m.evaluate("document.documentElement.scrollWidth")
    check("No sideways scrolling at 375 px", sw <= 375, f"scrollWidth={sw}")
    btn = m.eval_on_selector("#sp-submit", "e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }")
    check("Pay button at least 44 × 44 px on a phone", btn[0] >= 44 and btn[1] >= 44, str(btn))
    if shots:
        m.screenshot(path=str(shots / "B46-order-page-phone.png"), full_page=True)
    ctx.close()
    b.close()

w = max(len(n) for n, _, _ in results)
fails = 0
for n, ok, d in results:
    fails += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
print(f"\n{len(results) - fails} of {len(results)} checks passed")
sys.exit(1 if fails else 0)
