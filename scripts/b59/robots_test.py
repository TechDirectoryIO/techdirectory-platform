"""B59 acceptance test for robots.txt (Build Scope 35.3).

Runs the approved rules and today's live file through Protego, a parser that
follows Google's robots.txt rules (RFC 9309: groups for the same bot merge,
the longest matching rule wins, Allow wins a tie, * and $ supported).

    pip install protego && python3 -I scripts/b59/robots_test.py
"""
import pathlib, sys
from protego import Protego

ROOT = pathlib.Path(__file__).resolve().parents[2]
NEW = Protego.parse((ROOT / "site/seo/robots.txt").read_text())
LIVE = Protego.parse((ROOT / "docs/baseline/2026-10-30-robots-live.txt").read_text())
S = "https://www.techdirectory.io"

# Real URLs from the live sitemaps and homepage, 30 October 2026
URLS = {
    "home": "/",
    "listing": "/united-kingdom/tech-media/techbullion",
    "listing (city)": "/california/pleasanton/information-technology/rapidvalue-solutions",
    "results": "/search_results",
    "category results": "/categories",
    "blog guide": "/blog/ehr-implementation-checklist-8-phases-from-planning-to-90-days-after-go-live-2026",
    "blog index": "/blog",
    "future guide": "/guides/best-cloud-providers-london",
    "resources": "/resources/ai-ready-checklist",
    "help centre": "/help/claim-your-listing",
    "api": "/api/v2/companies",
    "data api docs (future)": "/data-api/docs",
    "lookalike path": "/blogger-tools/acme",
    "sponsored post": "/sponsored/how-cloud-teams-plan-a-migration",
}
SEARCH = ["Googlebot", "Bingbot", "Applebot", "DuckDuckBot", "OAI-SearchBot", "ChatGPT-User",
          "PerplexityBot", "Perplexity-User", "Claude-SearchBot", "Claude-User"]
TRAINING = ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "Applebot-Extended",
            "Meta-ExternalAgent", "Bytespider", "Amazonbot", "cohere-ai"]
TRAINING_OPEN = {"home", "blog guide", "blog index", "future guide", "resources", "help centre"}

results = []
def t(name, ok, detail=""):
    results.append((name, bool(ok), detail))

ok = lambda rp, ua, k: rp.can_fetch(S + URLS[k], ua)

# Build Scope B59 acceptance lines
t("GPTBot refused on a listing", not ok(NEW, "GPTBot", "listing"))
t("GPTBot allowed on a guide", ok(NEW, "GPTBot", "blog guide") and ok(NEW, "GPTBot", "future guide"))
t("OAI-SearchBot and PerplexityBot allowed on a listing",
  ok(NEW, "OAI-SearchBot", "listing") and ok(NEW, "PerplexityBot", "listing"))

# Full grid
bad = [(ua, k) for ua in SEARCH for k in URLS if k != "api" and not ok(NEW, ua, k)]
t("Every search and answer bot allowed on every page (except /api/)", not bad, str(bad[:5]))
t("Search bots kept out of /api/", all(not ok(NEW, ua, "api") for ua in SEARCH))
bad = [(ua, k) for ua in TRAINING for k in URLS if ok(NEW, ua, k) != (k in TRAINING_OPEN)]
t("Training bots: only homepage, guides, Resources, Help Centre", not bad, str(bad[:5]))
t("'$' keeps /blogger-tools closed to training bots", not ok(NEW, "GPTBot", "lookalike path"))
t("Training bots refused on results pages and Data API docs",
  all(not ok(NEW, ua, k) for ua in TRAINING for k in ("results", "category results", "data api docs (future)")))
t("Bot names match whatever the case", ok(NEW, "gptbot", "blog guide") and not ok(NEW, "GPTBOT", "listing"))
t("Unnamed bots (data crawlers) refused on listings and results",
  all(not ok(NEW, ua, k) for ua in ("DataForSeoBot", "AhrefsBot", "SomeScraper/1.0") for k in ("listing", "listing (city)", "results")))
t("Unnamed bots still get homepage and guides", ok(NEW, "AhrefsBot", "home") and ok(NEW, "AhrefsBot", "blog guide"))
t("Link previews work on listings (Slack, WhatsApp, LinkedIn)",
  all(ok(NEW, ua, "listing") for ua in ("Slackbot-LinkExpanding", "WhatsApp", "LinkedInBot")))
t("IndexNow engines can crawl listings (Yandex, Seznam, Naver)",
  all(ok(NEW, ua, "listing") for ua in ("YandexBot", "SeznamBot", "Yeti")))
t("Bots blocked today stay blocked (Baiduspider, PetalBot)", not ok(NEW, "Baiduspider", "home") and not ok(NEW, "PetalBot", "listing"))
t("Sitemap line present and points to the live index",
  list(NEW.sitemaps) == [S + "/filedata/cache/xml-sitemaps/sitemap.xml"])
t("Only one 'User-agent: *' group",
  (ROOT / "site/seo/robots.txt").read_text().count("User-agent: *") == 1)

# What changes for the main bots (shown, not scored)
print("What changes, live today -> new (Google-style parser):")
for ua in ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot", "GPTBot", "ClaudeBot", "DataForSeoBot"]:
    for k in ("listing", "blog guide"):
        a, b = ok(LIVE, ua, k), ok(NEW, ua, k)
        print(f"  {ua:17} {k:11} {'allowed' if a else 'refused':8} -> {'allowed' if b else 'refused'}{'' if a == b else '   (changed)'}")
print(f"  Sitemap line: {'yes' if list(LIVE.sitemaps) else 'none'} -> yes")
print()

w = max(len(n) for n, _, _ in results)
fails = 0
for n, passed, d in results:
    fails += not passed
    print(f"{'PASS' if passed else 'FAIL'}  {n.ljust(w)}  {'' if passed else d}")
print(f"\n{len(results) - fails} of {len(results)} checks passed")
sys.exit(1 if fails else 0)
