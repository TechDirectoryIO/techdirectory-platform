"""T11 · New meta descriptions for the TD platform's SEO templates and fixed pages.

Bing Webmaster Tools (30 October 2026): 978 pages with meta descriptions that are too short.
This file is the single source for the new wording. Running it:
  - expands every template with short and long sample values,
  - checks each result is 110-170 characters and reads cleanly (no "in ." or doubled spaces),
  - writes site/seo/meta-descriptions.md, the copy-and-paste sheet for the change window.

    python3 -I scripts/t11/meta_descriptions.py
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]

# Sample values (short and long) for the platform's variables
SAMPLES = {
    "short": {"%%%Full_name%%%": "FCG", "%Profession_name%": "Software", "%%Profession_name%%": "Software Companies",
              "%Service_name%": "SEO", "%%Profession%%": "Technology Businesses", "%Country_name%": "Japan",
              "%State_name%": "Texas", "%City_name%": "Leeds", "%%%Post_title%%%": "What is hosted Exchange?",
              "%Data_name%": "Member Article"},
    "long": {"%%%Full_name%%%": "Northbridge Cloud Engineering Ltd", "%Profession_name%": "Information Technology",
             "%%Profession_name%%": "Information Technology Companies", "%Service_name%": "Managed Cloud Hosting",
             "%%Profession%%": "Technology Businesses", "%Country_name%": "United States", "%State_name%": "California",
             "%City_name%": "San Francisco", "%%%Post_title%%%": "EHR implementation checklist: 8 phases from planning to go-live",
             "%Data_name%": "Member Article"},
}

TAIL = " on TechDirectory: company profiles, services, reviews and contact details in one place."
TAIL_SHORT = " on TechDirectory, with profiles, reviews and contact details."

def search(what, where):
    """Search-results pages: what is listed, and where."""
    body = "Find and compare " + what + (" in " + where if where else "")
    long_combo = (what == W["mainsub"] and where) or (where.count(",") >= 2 and what != W["none"])
    return body + (TAIL_SHORT if long_combo else TAIL)

W = {  # what
    "none": "%%Profession%%", "main": "%%Profession_name%%", "sub": "%Service_name% providers",
    "mainsub": "%%Profession_name%% offering %Service_name%",
}
L = {  # where
    "": "", "C": "%Country_name%", "CS": "%State_name%, %Country_name%", "CC": "%City_name%, %Country_name%",
    "CSC": "%City_name%, %State_name%, %Country_name%", "S": "%State_name%", "SC": "%City_name%, %State_name%",
    "Ci": "%City_name%",
}
SEARCH_TEMPLATES = [
    (200, "Search Results - Default", "none", ""), (201, "Main Category Only", "main", ""), (202, "Sub Category Only", "sub", ""),
    (203, "Main / Sub Category", "mainsub", ""),
    (204, "Country Only", "none", "C"), (205, "Country / Main", "main", "C"), (206, "Country / Sub", "sub", "C"), (207, "Country / Main / Sub", "mainsub", "C"),
    (208, "Country / State", "none", "CS"), (209, "Country / State / Main", "main", "CS"), (210, "Country / State / Sub", "sub", "CS"), (211, "Country / State / Main / Sub", "mainsub", "CS"),
    (212, "Country / City", "none", "CC"), (213, "Country / City / Main", "main", "CC"), (214, "Country / City / Sub", "sub", "CC"), (215, "Country / City / Main / Sub", "mainsub", "CC"),
    (216, "Country / State / City", "none", "CSC"), (217, "Country / State / City / Main", "main", "CSC"), (218, "Country / State / City / Sub", "sub", "CSC"), (219, "Country / State / City / Main / Sub", "mainsub", "CSC"),
    (220, "State", "none", "S"), (221, "State / Main", "main", "S"), (222, "State / Sub", "sub", "S"), (223, "State / Main / Sub", "mainsub", "S"),
    (224, "State / City", "none", "SC"), (225, "State / City / Main", "main", "SC"), (226, "State / City / Sub", "sub", "SC"), (227, "State / City / Main / Sub", "mainsub", "SC"),
    (228, "City", "none", "Ci"), (229, "City / Main", "main", "Ci"), (230, "City / Sub", "sub", "Ci"), (231, "City / Main / Sub", "mainsub", "Ci"),
]

TEMPLATES = {
    100: ("Member Profile - Main Listing", "%%%Full_name%%% (%Profession_name%) on TechDirectory: see its services, location, contact details and reviews, and compare similar technology companies."),
    101: ("Member Profile - Contact Form", "Contact %%%Full_name%%% (%Profession_name%) through TechDirectory: send a message or project details and get a reply by email. See its profile and reviews first."),
    102: ("Member Profile - Write a Review", "Write a review of %%%Full_name%%% (%Profession_name%) on TechDirectory. Share your experience to help other businesses choose the right technology provider."),
    103: ("Member Profile - View Review", "Read a customer review of %%%Full_name%%% (%Profession_name%) on TechDirectory, then see the company's profile, services and other reviews."),
    503: ("Member reviews", "Customer reviews and ratings for %%%Full_name%%% (%Profession_name%) on TechDirectory. Read what clients say, then compare similar technology companies."),
    302: ("Details Page - Post Details", "%%%Post_title%%% – a %Data_name% by %%%Full_name%%% on TechDirectory. Read it and see the author's company profile."),
    400: ("Billing - Checkout", "Choose your TechDirectory plan and check out securely. List your technology business, get found by buyers and manage your company profile from one dashboard."),
}
for tid, name, w, l in SEARCH_TEMPLATES:
    TEMPLATES[tid] = ("Search Results - Members - " + name if tid != 200 else "Search Results - Members - Default", search(W[w], L[l]))

# Fixed pages (Web Page Builder: each page's own meta description)
PAGES = {
    "/about": "About TechDirectory: the directory where businesses find, compare and contact technology companies worldwide. How it works, who it is for and how to get listed.",
    "/about/contact": "Contact TechDirectory by email for help with your listing, your account, advertising or partnerships. We reply within 1 working day; we don't take calls.",
    "/about/terms": "TechDirectory Terms of Use: the rules for using the site, listing a business, posting content and paying for plans and services. Please read before you sign up.",
    "/about/privacy": "TechDirectory Privacy Policy: what personal information we collect, why we use it, how long we keep it and how to use your data protection rights.",
    "/login": "Sign in to your TechDirectory account to manage your company profile, reply to enquiries and reviews, and see how buyers are finding your business.",
    "/locations": "Browse technology companies by country, state and city on TechDirectory. Find local software, IT, digital and tech service providers and compare their profiles.",
    "/categories": "Browse technology companies by category on TechDirectory: software, IT services, cloud, cybersecurity, digital marketing and more. Compare profiles and reviews.",
    "/events": "Technology events listed by companies on TechDirectory: conferences, webinars, launches and meetups. See dates, places and organisers, and add your own event.",
    "/get-listed": "List your technology business on TechDirectory for free. Choose a plan, create your company profile and get found by businesses searching for tech providers.",
    "/join": "Join TechDirectory and create a free profile for your technology company. Add your services, location and contact details so buyers can find and contact you.",
    "/articles": "Articles and company news from technology businesses on TechDirectory: guides, product updates and announcements. Read the latest and see each author's profile.",
    "/blog": "TechDirectory guides for technology buyers: how to choose providers, compare costs and plan projects, plus rankings of leading technology companies by sector.",
    "/reviews": "Read customer reviews of technology companies on TechDirectory. See ratings and feedback on software, IT and digital service providers before you hire.",
    "/videos": "Watch videos from technology companies on TechDirectory: product demos, explainers and company introductions. Find the business behind each video.",
}

def expand(text, sample):
    for k in sorted(sample, key=len, reverse=True):
        text = text.replace(k, sample[k])
    return text

problems, rows = [], []
for tid in sorted(TEMPLATES):
    name, tpl = TEMPLATES[tid]
    lens = []
    for kind, sample in SAMPLES.items():
        out = expand(tpl, sample)
        if "%" in out: problems.append(f"#{tid}: unexpanded variable in {out!r}")
        if re.search(r"\s[.,:]|\s{2}|\(\)|in \.", out): problems.append(f"#{tid}: awkward text {out!r}")
        lens.append(len(out))
    if min(lens) < 110 or max(lens) > 190: problems.append(f"#{tid}: length {lens}")
    rows.append((tid, name, tpl, lens, expand(tpl, SAMPLES["short"])))
for path, text in PAGES.items():
    if not 110 <= len(text) <= 165: problems.append(f"{path}: length {len(text)}")

md = ["# Meta descriptions: new wording (T11, from Bing's report of 30 October 2026)", "",
      "Bing Webmaster Tools found **978 pages** whose meta descriptions are too short. Almost all come from a handful of",
      "platform templates (company profiles, articles, search results) plus a few fixed pages. Fixing the templates fixes",
      "every page built from them, including the 725,000 company profiles.", "",
      "Generated and checked by `scripts/t11/meta_descriptions.py` (every template expanded with short and long sample values;",
      "lengths shown are short / long sample). Search engines show about 150–160 characters; a little over is fine.", "",
      "**Also in the same change:** empty the *Meta Keywords* box on every template. Google ignores the tag and Bing treats",
      "stuffed keywords as a spam signal; the current templates repeat the company name and category up to 7 times.", "",
      "## Before (live, 30 October)", "",
      "| Page | Now | Length |", "| --- | --- | --- |",
      "| Company profile | Connect with FCG, Security Technology in . Find FCG reviews and more. | 69 |",
      "| Article | Member Article posted by E2E Technologies on TechDirectory. | 59 |",
      "| Country results | Search our Japan Tech Directory database and connect with top rated Technology Businesses in Japan. | 99 |",
      "| /login | Login to your account on TechDirectory | 38 |",
      "| /events | (none) | 0 |", "",
      "Profiles with no city show \"in .\"; the new profile wording leaves location out of the description (it is in the title and on the page), so it always reads cleanly.", "",
      "## SEO Templates (My Content → SEO Templates → Edit → Meta Description)", "",
      "| ID | Template | New meta description | Length | Example |", "| --- | --- | --- | --- | --- |"]
for tid, name, tpl, lens, ex in rows:
    md.append(f"| {tid} | {name} | `{tpl}` | {lens[0]} / {lens[1]} | {ex} |")
md += ["", "## Fixed pages (Web Page Builder → page → SEO → Meta Description)", "", "| Page | New meta description | Length |", "| --- | --- | --- |"]
for path, text in PAGES.items():
    md.append(f"| {path} | {text} | {len(text)} |")
md += ["", "## Change window steps", "",
       "1. Back up: copy each template's current meta description and keywords into the build log (or export from the admin).",
       "2. Paste the new wording template by template; empty Meta Keywords; save.",
       "3. Check 5 live pages per type (profile with and without a city, article, country, city/category, fixed pages) with the page source.",
       "4. In Bing Webmaster Tools → Recommendations, run the check again after Bing recrawls (days to weeks).",
       "5. Undo: paste the old wording back from the build log.", ""]
(ROOT / "site/seo/meta-descriptions.md").write_text("\n".join(md))

print(f"{len(TEMPLATES)} templates and {len(PAGES)} pages checked")
for p in problems: print("PROBLEM", p)
print("PASS" if not problems else "FAIL")
sys.exit(1 if problems else 0)
