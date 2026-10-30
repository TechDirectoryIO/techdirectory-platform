/*
 * B46 · Safe-publishing checks for sponsored posts (Build Scope 28.2.1, 28.2.2)
 *
 * One rule set, used in two places:
 *   - on the /sponsored-post order page, as live guidance before payment;
 *   - after payment, by the automation that decides publish / refund / queue.
 *
 * TDSponsoredChecks.run(input, DOMPurify) -> { result: "pass" | "borderline" | "fail",
 *                                             checks: [{ id, label, result, detail }],
 *                                             cleanHtml, words, links }
 *
 * input = {
 *   title, html, category,             // from the order form
 *   metaDescription, tags: [..],       // search summary and up to 5 topic tags (blank summary = made from the first paragraph)
 *   buyerDomains: ["example.com"],     // the buyer's own sites (from the order form)
 *   image: { width },                  // featured image width in px
 *   network: {                         // filled in after payment; missing = borderline
 *     links: { "<url>": { status: 200, safe: true, rejectedBefore: false } },
 *     originality: "off" | "none" | "partial" | "exact"   // "off" = check switched off by the owner
 *   },
 *   history: { refusals12m: 0 }        // refused or unpublished posts from this email/domain
 * }
 *
 * Rules and word lists live in TD_SPONSORED_RULES so the owner can change them
 * without a rebuild (Build Scope 28.2.1, last paragraph).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TDSponsoredChecks = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RULES = {
    words: { pass: [600, 1500], hardBelow: 450, hardAbove: 2000 },
    maxLinks: 2,
    wordsPerLink: 300,
    anchorMaxWords: 5,
    minImageWidth: 1200,
    moneyWords: ["casino", "loan", "loans", "cheap", "buy now", "best price", "discount", "payday", "betting", "bet",
                 "crypto", "bitcoin", "forex", "click here", "lowest price", "free money"],
    /* a single clear match is a hard fail */
    bannedClear: ["online casino", "casino", "gambling", "sports betting", "slot gacor", "slot online", "judi", "togel",
                  "kalyan matka", "satta", "porn", "escort", "adult content", "payday loan", "cbd oil", "cannabis",
                  "buy followers", "fake reviews", "essay writing service", "write my essay", "hacking service",
                  "hack account", "firearms", "ammunition", "binary options", "forex signals", "crypto signals",
                  "memecoin", "ico presale", "token presale"],
    /* one of these alone is borderline (a person checks); two or more is a hard fail */
    bannedAmbiguous: ["crypto", "cryptocurrency", "bitcoin", "ethereum", "token", "nft", "betting", "bet", "loan", "loans",
                      "credit", "mortgage", "insurance", "investment", "invest", "trading", "forex", "cbd", "weapon",
                      "hack", "hacking", "essay", "casino", "slot", "pharmacy", "weight loss", "supplement"],
    categories: {
      "artificial-intelligence": ["ai", "artificial intelligence", "machine learning", "llm", "model", "automation", "data"],
      "cybersecurity": ["security", "cyber", "threat", "breach", "compliance", "identity", "encryption", "risk"],
      "cloud-and-saas": ["cloud", "saas", "platform", "infrastructure", "software", "hosting", "kubernetes", "migration"],
      "software-development": ["software", "development", "developer", "app", "application", "code", "engineering", "api"],
      "it-services": ["it", "managed services", "support", "network", "infrastructure", "helpdesk", "outsourcing"],
      "data-and-analytics": ["data", "analytics", "dashboard", "bi", "warehouse", "reporting", "insight"],
      "marketing-technology": ["martech", "marketing technology", "crm", "automation", "analytics", "platform", "software"],
      "ecommerce-technology": ["ecommerce", "e-commerce", "online store", "checkout", "platform", "software"],
      "fintech": ["fintech", "payments", "banking software", "payment platform", "regtech", "finance software"],
      "health-technology": ["health tech", "healthtech", "ehr", "emr", "telehealth", "digital health", "clinical software"],
      "hr-technology": ["hr tech", "hris", "payroll software", "recruitment software", "workforce", "people platform"],
      "telecom-and-connectivity": ["telecom", "5g", "connectivity", "network", "voip", "broadband", "iot"],
      "hardware-and-devices": ["hardware", "device", "devices", "chip", "semiconductor", "server", "laptop", "iot"],
      "business-technology": ["technology", "software", "digital", "platform", "automation", "tools", "it"]
    },
    seo: { titleMax: 70, descMin: 70, descMax: 160, maxTags: 5, tagMax: 30 },
    allowedTags: ["p", "h2", "h3", "strong", "em", "a", "ul", "ol", "li", "blockquote", "img", "br"],
    allowedAttr: ["href", "src", "alt"],
    forbiddenTags: ["script", "iframe", "form", "object", "embed", "input", "button", "frame", "frameset", "link", "meta", "style"]
  };

  var ENGLISH_STOPWORDS = ["the", "and", "to", "of", "a", "in", "is", "for", "that", "it", "on", "with", "as", "are",
    "this", "be", "by", "or", "your", "you", "can", "an", "from", "at", "their", "more", "how", "will", "not", "they", "have"];

  function textOf(html) {
    return String(html || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
  }
  function words(s) { var m = String(s || "").toLowerCase().match(/[a-z0-9À-ɏ][a-z0-9À-ɏ'’\-]*/g); return m || []; }
  function hasPhrase(text, phrase) {
    var re = new RegExp("(^|[^a-z0-9])" + phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)");
    return re.test(text);
  }
  function hostOf(url) { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch (e) { return ""; } }
  function domainMatches(host, domains) {
    return (domains || []).some(function (d) { d = String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
      return d && (host === d || host.slice(-(d.length + 1)) === "." + d); });
  }

  /* a search summary made from the first paragraph, cut at a word boundary */
  function autoDescription(text, max) {
    text = String(text || "").replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    var cut = text.slice(0, max); cut = cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\-–—]$/, "");
    return cut + "…";
  }

  function sanitize(html, DOMPurify) {
    var raw = String(html || "");
    var forbidden = RULES.forbiddenTags.filter(function (t) { return new RegExp("<\\s*" + t + "\\b", "i").test(raw); });
    var hasEventHandlers = /\son[a-z]+\s*=/i.test(raw) || /javascript\s*:/i.test(raw);
    var hadStyles = /\sstyle\s*=/i.test(raw) || /\sclass\s*=/i.test(raw);
    var clean = DOMPurify.sanitize(raw, { ALLOWED_TAGS: RULES.allowedTags, ALLOWED_ATTR: RULES.allowedAttr,
      ALLOWED_URI_REGEXP: /^(?:https?:|\/|#)/i });
    /* fail closed: a sanitiser that isn't working (e.g. no DOM) returns the input unchanged */
    if (/<\s*(script|iframe|object|embed|form|style)\b|\son[a-z]+\s*=|javascript\s*:/i.test(clean)) {
      throw new Error("TD sanitiser check failed: unsafe HTML survived cleaning");
    }
    /* every link: rel="sponsored noopener" and a new tab, whatever the writer typed */
    clean = clean.replace(/<a\b([^>]*)>/gi, function (m, attrs) {
      var href = (attrs.match(/\shref="([^"]*)"/i) || [])[1];
      return href ? '<a href="' + href + '" rel="sponsored noopener" target="_blank">' : "<a>";
    });
    return { html: clean, forbidden: forbidden, scriptLike: forbidden.length > 0 || hasEventHandlers, hadStyles: hadStyles };
  }

  function linksIn(html) {
    var out = [], re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, m;
    while ((m = re.exec(html))) out.push({ url: m[1], anchor: textOf(m[2]) });
    return out;
  }

  function run(input, DOMPurify) {
    input = input || {};
    var checks = [];
    function add(id, label, result, detail) { checks.push({ id: id, label: label, result: result, detail: detail || "" }); }

    /* Clean HTML (28.2.2) */
    var s = sanitize(input.html, DOMPurify);
    if (s.scriptLike) add("html", "Clean HTML", "fail", "Removed: " + (s.forbidden.join(", ") || "script code"));
    else if (s.hadStyles) add("html", "Clean HTML", "borderline", "Inline styles and classes were removed");
    else add("html", "Clean HTML", "pass", "");

    var body = textOf(s.html);
    var w = words(body);
    var n = w.length;
    var R = RULES.words;

    /* Length */
    if (n < R.hardBelow || n > R.hardAbove) add("length", "Length", "fail", n + " words (600–1,500 accepted)");
    else if (n < R.pass[0] || n > R.pass[1]) add("length", "Length", "borderline", n + " words (600–1,500 accepted)");
    else add("length", "Length", "pass", n + " words");

    /* Links */
    var links = linksIn(s.html);
    var buyer = input.buyerDomains || [];
    if (links.length > RULES.maxLinks) add("links", "Links", "fail", links.length + " links (at most 2)");
    else {
      var foreign = links.filter(function (l) { return !domainMatches(hostOf(l.url), buyer); });
      var tooDense = links.length > 0 && n / links.length < RULES.wordsPerLink;
      if (foreign.length) add("links", "Links", "borderline", "Link to a site that isn't yours: " + foreign.map(function (l) { return hostOf(l.url); }).join(", "));
      else if (tooDense) add("links", "Links", "borderline", "Fewer than 300 words per link");
      else add("links", "Links", "pass", links.length + " link" + (links.length === 1 ? "" : "s"));
    }

    /* Anchor text */
    var anchorFail = [], anchorLong = [];
    links.forEach(function (l) {
      var a = l.anchor.toLowerCase();
      if (RULES.moneyWords.some(function (mw) { return hasPhrase(a, mw); })) anchorFail.push(l.anchor);
      else if (words(a).length > RULES.anchorMaxWords) anchorLong.push(l.anchor);
    });
    if (anchorFail.length) add("anchors", "Link wording", "fail", "Money word in: " + anchorFail.join(" | "));
    else if (anchorLong.length) add("anchors", "Link wording", "borderline", "Longer than 5 words: " + anchorLong.join(" | "));
    else add("anchors", "Link wording", "pass", "");

    /* Banned topics: title, text, link addresses and image name */
    var tags = (input.tags || []).map(function (x) { return String(x).trim(); }).filter(Boolean);
    var hay = [input.title, body, input.metaDescription || "", tags.join(" "), links.map(function (l) { return l.url + " " + l.anchor; }).join(" "),
               (input.image && input.image.name) || ""].join(" ").toLowerCase();
    var clear = RULES.bannedClear.filter(function (t) { return hasPhrase(hay, t); });
    var amb = RULES.bannedAmbiguous.filter(function (t) { return hasPhrase(hay, t); });
    if (clear.length || amb.length >= 2) add("topics", "Banned topics", "fail", "Found: " + clear.concat(amb).join(", "));
    else if (amb.length === 1) add("topics", "Banned topics", "borderline", "Found: " + amb[0]);
    else add("topics", "Banned topics", "pass", "");

    /* Link safety (after payment: status code and Safe Browsing result per link) */
    var net = input.network || null;
    if (!links.length) add("safety", "Link safety", "pass", "No links");
    else if (!net || !net.links) add("safety", "Link safety", "borderline", "Not checked yet");
    else {
      var bad = [], down = [], unchecked = [];
      links.forEach(function (l) {
        var r = net.links[l.url];
        if (!r) { down.push(l.url); return; }
        if (r.safe === false || r.rejectedBefore) bad.push(l.url);
        else if (r.safe !== true) unchecked.push(l.url);          /* safety lookup missing or failed: never assume safe */
        else if (!(r.status >= 200 && r.status < 400)) down.push(l.url);
      });
      if (bad.length) add("safety", "Link safety", "fail", "Unsafe or previously rejected: " + bad.join(", "));
      else if (unchecked.length) add("safety", "Link safety", "borderline", "Safety not checked: " + unchecked.join(", "));
      else if (down.length) add("safety", "Link safety", "borderline", "Not responding: " + down.join(", "));
      else add("safety", "Link safety", "pass", "");
    }

    /* Originality */
    var orig = net && net.originality;
    if (orig === "off") add("originality", "Originality", "pass", "Not checked: buyer confirms the post is their own content (owner decision, 30 October 2026)");
    else if (orig === "exact") add("originality", "Originality", "fail", "Opening or closing paragraph found elsewhere");
    else if (orig === "none") add("originality", "Originality", "pass", "");
    else add("originality", "Originality", "borderline", orig === "partial" ? "Partial match found" : "Not checked yet");

    /* Relevance: the chosen category's keywords in the title or first paragraph */
    var first = textOf((s.html.match(/<p>([\s\S]*?)<\/p>/i) || [])[1] || "");
    var lead = ((input.title || "") + " " + first).toLowerCase();
    var kws = RULES.categories[input.category] || [];
    if (!kws.length) add("relevance", "Relevance", "borderline", "Choose a technology category");
    else if (kws.some(function (k) { return hasPhrase(lead, k); })) add("relevance", "Relevance", "pass", "");
    else add("relevance", "Relevance", "borderline", "The title and first paragraph don't mention the chosen category");

    /* Language and format */
    var stop = w.filter(function (x) { return ENGLISH_STOPWORDS.indexOf(x) !== -1; }).length;
    var english = n === 0 ? false : stop / n >= 0.15;
    var headings = (s.html.match(/<h[23]\b/gi) || []).length;
    var imgW = input.image && input.image.width;
    var issues = [];
    if (!english) issues.push("may not be in English");
    if (!headings) issues.push("no subheading");
    if (!(imgW >= RULES.minImageWidth)) issues.push("featured image narrower than 1,200 px");
    add("format", "Language and format", issues.length ? "borderline" : "pass", issues.join("; "));

    /* Search and AI summary: title, meta description and tags */
    var S = RULES.seo, seoIssues = [];
    var firstPara = textOf((s.html.match(/<p>([\s\S]*?)<\/p>/i) || [])[1] || "");
    var desc = String(input.metaDescription || "").trim() || autoDescription(firstPara, S.descMax - 5);
    if ((input.title || "").length > S.titleMax) seoIssues.push("title longer than " + S.titleMax + " characters (may be cut off in search results)");
    if (desc.length < S.descMin || desc.length > S.descMax) seoIssues.push("search summary is " + desc.length + " characters (70–160 works best)");
    if (!tags.length) seoIssues.push("no topic tags");
    if (tags.length > S.maxTags) seoIssues.push("more than " + S.maxTags + " tags");
    if (tags.some(function (x) { return x.length > S.tagMax; })) seoIssues.push("a tag longer than " + S.tagMax + " characters");
    add("seo", "Search summary and tags", seoIssues.length ? "borderline" : "pass", seoIssues.join("; "));

    /* Buyer history */
    var ref = (input.history && input.history.refusals12m) || 0;
    if (ref >= 2) add("history", "Order history", "fail", ref + " refused posts in 12 months");
    else if (ref === 1) add("history", "Order history", "borderline", "1 refused post in 12 months");
    else add("history", "Order history", "pass", "");

    var result = checks.some(function (c) { return c.result === "fail"; }) ? "fail"
      : checks.some(function (c) { return c.result === "borderline"; }) ? "borderline" : "pass";
    return { result: result, checks: checks, cleanHtml: s.html, words: n, links: links,
             metaDescription: desc, tags: tags.slice(0, S.maxTags) };
  }

  return { run: run, sanitize: sanitize, autoDescription: autoDescription, RULES: RULES };
});
