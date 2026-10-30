"""B13 acceptance test (Build Scope 19.5), run off the live site.

Renders the TD TechBullion Link v1 widget in a headless browser the way the TD
platform includes it (slot div + widget code), and checks every rule in
Build Scope 19. Usage:  python3 -I scripts/b13_acceptance_test.py
"""
import json
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
WIDGET = (ROOT / "site/templates/b13-techbullion-link.html").read_text()
BANNED = ["byline", "contributor", "featured in", "coverage", "as seen on", "editorial",
          "backlink", "dofollow", "seo", "ranking", "guaranteed"]


def page_html(slots, settings_override=None, include_widget=True, footer=True):
    override = ""
    if settings_override is not None:
        # an override placed before the widget stands in for an edited settings block
        override = "<script>window.TD_TB_SETTINGS=" + json.dumps(settings_override) + ";</script>"
    body = ""
    for variant, placement in slots:
        body += f'<div data-td-tb="{variant}" data-placement="{placement}"></div>'
        if include_widget:
            body += WIDGET  # the shortcode is replaced by the widget at each placement
    foot = '<footer><ul><li><a href="/publishing">Publishing</a></li><li><a href="/about">About</a></li></ul></footer>' if footer else ""
    return ("<!doctype html><html><head><meta charset=utf-8>"
            "<meta name=viewport content='width=device-width,initial-scale=1'>"
            "<script>window.__events=[];window.gtag=function(){window.__events.push(Array.from(arguments))};</script>"
            f"{override}</head><body style='margin:0'><main>{body}</main>{foot}</body></html>")


def default_settings():
    m = re.search(r"window\.TD_TB_SETTINGS = window\.TD_TB_SETTINGS \|\| (\{.*?\n\});", WIDGET, re.S)
    js = m.group(1)
    js = re.sub(r"/\*.*?\*/", "", js)
    js = re.sub(r"(\w+):", r'"\1":', js)
    js = js.replace("TechBullion\"s", "TechBullion's")
    return json.loads(js.replace('"https"://', "https://"))


results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))


def links(page):
    return page.eval_on_selector_all(
        "a[data-td-tb-click]",
        "els=>els.map(a=>({href:a.href,target:a.target,rel:a.rel,p:a.dataset.tdTbClick,label:a.getAttribute('aria-label')}))")


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})

    class Fresh:
        """Each set_content gets a brand-new page, as a real page load would."""
        def __init__(self, context):
            self.context, self.p = context, None
        def set_content(self, html):
            if self.p:
                self.p.close()
            self.p = self.context.new_page()
            self.p.set_content(html)
        def __getattr__(self, name):
            return getattr(self.p, name)

    page = Fresh(ctx)
    cfg = default_settings()

    # 1. Every placement renders from the one settings block
    all_slots = [("panel", "publishing-page"), ("strip", "overview"), ("line", "announcement")]
    page.set_content(page_html(all_slots))
    rendered = page.eval_on_selector_all("[data-td-tb]", "els=>els.map(e=>({v:e.dataset.tdTb,hidden:e.hidden,ns:e.hasAttribute('data-nosnippet'),text:e.innerText}))")
    shown = [r for r in rendered if not r["hidden"]]
    check("Panel, strip and line all render", len(shown) == 2 and any(r["v"] == "line" for r in shown),
          f"{len(shown)} shown: {[r['v'] for r in shown]} (panel and strip share the one-block-per-page rule)")
    # panel + strip on one page: only the first block shows (one TechBullion panel or strip per page)
    check("At most one TechBullion panel or strip per page",
          sum(1 for r in shown if r["v"] in ("panel", "strip")) == 1)

    page.set_content(page_html([("panel", "pricing")]))
    txt = page.inner_text("[data-td-tb]")
    check("Panel shows Sponsored article $600 and Press release $500",
          "Sponsored article" in txt and "$600" in txt and "Press release" in txt and "$500" in txt)
    check("Panel says paid content is labelled, editors may decline, not endorsed by TechDirectory",
          "labelled" in txt and "may decline" in txt and "does not review or endorse" in txt)
    check("Panel shows Opens TechBullion.com", "Opens TechBullion.com" in txt)
    check("TechBullion keeps its own name in its own chip",
          page.locator(".td-tb__chip").count() == 1 and "TechBullion" in page.inner_text(".td-tb__chip"))
    price_px = page.eval_on_selector(".td-tb__price", "e=>getComputedStyle(e).fontSize")
    check("Prices at 56 px on desktop", price_px == "56px", price_px)

    # 2. Links: new tab, rel sponsored noopener, utm per placement
    ok = True
    details = []
    for variant, placement in [("panel", "publishing-page"), ("panel", "publishing-tab"), ("panel", "pricing"),
                               ("panel", "homepage"), ("strip", "overview"), ("line", "announcement")]:
        page.set_content(page_html([(variant, placement)]))
        for l in links(page):
            good = (l["href"].startswith("https://techbullion.com/media-kit?")
                    and f"utm_medium={placement}" in l["href"]
                    and "utm_source=techdirectory" in l["href"] and "utm_campaign=publishing" in l["href"]
                    and l["target"] == "_blank" and set(l["rel"].split()) >= {"sponsored", "noopener"}
                    and "opens TechBullion.com" in (l["label"] or ""))
            ok &= good
            details.append(f"{placement}:{'ok' if good else l}")
    check("Each link opens the media kit in a new tab with the right utm_medium and rel=\"sponsored noopener\"", ok, "; ".join(details))

    # 3. data-nosnippet on every rendered panel/strip/line
    page.set_content(page_html([("panel", "pricing"), ("line", "announcement")]))
    ns = page.eval_on_selector_all("[data-td-tb]:not([hidden])", "els=>els.every(e=>e.hasAttribute('data-nosnippet'))")
    check("Panels carry data-nosnippet", ns)

    # 4. Changing the link once updates every placement
    c2 = dict(cfg, link="https://techbullion.com/media-kit-test")
    page.set_content(page_html([("panel", "pricing"), ("line", "announcement")], c2))
    hrefs = [l["href"] for l in links(page)]
    check("Changing the link once updates every placement",
          len(hrefs) == 2 and all(h.startswith("https://techbullion.com/media-kit-test?") for h in hrefs), str(hrefs))

    # 5. Switch off hides every placement and the footer link
    c3 = dict(cfg, on=False)
    page.set_content(page_html([("panel", "pricing"), ("line", "announcement")], c3))
    vis = page.eval_on_selector_all("[data-td-tb]", "els=>els.filter(e=>!e.hidden&&e.offsetParent).length")
    foot = page.eval_on_selector('a[href="/publishing"]', "a=>getComputedStyle(a.closest('li')).display")
    body_txt = page.inner_text("body")
    check("Switch off hides every placement", vis == 0 and "TechBullion" not in body_txt, f"visible={vis}")
    check("Switch off hides the footer Publishing link", foot == "none", foot)

    # 6. End date in the past turns it off
    c4 = dict(cfg, endDate="2020-01-01")
    page.set_content(page_html([("panel", "pricing")], c4))
    check("End date in the past hides it", "TechBullion" not in page.inner_text("body"))

    # 7. Placement not in the list is hidden
    c5 = dict(cfg, placements=["pricing"])
    page.set_content(page_html([("strip", "overview")], c5))
    check("A placement switched off in settings is hidden", "TechBullion" not in page.inner_text("body"))

    # 8. Wording rules
    page.set_content(page_html([("panel", "pricing")]))
    t1 = page.inner_text("body").lower()
    page.set_content(page_html([("strip", "overview")]))
    t2 = page.inner_text("body").lower()
    page.set_content(page_html([("line", "announcement")]))
    t3 = page.inner_text("body").lower()
    found = [w for w in BANNED for t in (t1, t2, t3) if re.search(r"\b" + re.escape(w) + r"\b", t)]
    check("No banned wording (byline, contributor, coverage, editorial, SEO, ranking …)", not found, str(sorted(set(found))))

    # 9. Referral code shown only when set
    page.set_content(page_html([("panel", "pricing")]))
    no_ref = "Use code" not in page.inner_text("body")
    page.set_content(page_html([("panel", "pricing")], dict(cfg, referralCode="TD10")))
    with_ref = "Use code TD10" in page.inner_text("body")
    check("Referral code shown only when set", no_ref and with_ref)

    # 10. Click event
    page.set_content(page_html([("panel", "pricing")]))
    page.evaluate("document.querySelector('a[data-td-tb-click]').addEventListener('click',e=>e.preventDefault())")
    page.click("a[data-td-tb-click]")
    ev = page.evaluate("window.__events")
    check("GA4 event td_publishing_click with the placement", ev == [["event", "td_publishing_click", {"placement": "pricing"}]], str(ev))

    # 11. Phone width: no sideways scrolling, button full width, keyboard focus ring
    mob = browser.new_context(viewport={"width": 375, "height": 800})
    mp = Fresh(mob)
    mp.set_content(page_html([("panel", "pricing")]))
    sw = mp.evaluate("document.documentElement.scrollWidth")
    check("No sideways scrolling at 375 px", sw <= 375, f"scrollWidth={sw}")
    mp.set_content(page_html([("panel", "pricing")]))
    mp.keyboard.press("Tab")
    outline = mp.evaluate("getComputedStyle(document.activeElement).outlineStyle+' '+getComputedStyle(document.activeElement).outlineWidth")
    check("Button reachable by keyboard with a visible focus ring", "solid 3px" in outline, outline)
    tgt = mp.eval_on_selector(".td-tb__btn", "e=>{const r=e.getBoundingClientRect();return [r.width,r.height]}")
    check("Button target at least 44 × 44 px", tgt[0] >= 44 and tgt[1] >= 44, str(tgt))
    mob.close()

    # 12. Removal rehearsal: widget removed, slots left behind show nothing
    page.set_content(page_html([("panel", "pricing"), ("line", "announcement")], include_widget=False))
    left = page.inner_text("body")
    empty_hidden = page.eval_on_selector_all("[data-td-tb]", "els=>els.every(e=>e.getBoundingClientRect().height===0)")
    check("Removal rehearsal: no TechBullion reference remains", "techbullion" not in left.lower() and empty_hidden)

    browser.close()


def lum(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


pairs = {"white on forest": ("#FFFFFF", "#202B20"), "supporting text on forest": ("#C6CFBE", "#202B20"),
         "supporting text on raised card": ("#C6CFBE", "#2C382A"), "forest on lime button": ("#202B20", "#9CBB24"),
         "white on raised card": ("#FFFFFF", "#2C382A"), "line link green on white": ("#526813", "#FFFFFF")}
for n, (fg, bg) in pairs.items():
    c = contrast(fg, bg)
    check(f"Contrast {n} ≥ 4.5:1", c >= 4.5, f"{c:.2f}:1")

width = max(len(n) for n, _, _ in results)
fails = 0
for n, ok, d in results:
    fails += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(width)}  {d if (d and not ok) or n.startswith('Contrast') else ''}")
print(f"\n{len(results) - fails} of {len(results)} checks passed")
sys.exit(1 if fails else 0)
