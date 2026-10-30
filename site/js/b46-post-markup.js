/*
 * B46 · Published sponsored post: search and AI markup (Build Scope 28.1, 35.3, 35.5)
 *
 * TDSponsoredPost.build(post) -> { head, body, jsonld }
 * Used by the publish step after every check passes. The TD platform's post fields
 * receive: title, body, meta description, tags and the head block.
 *
 * post = { id, url, title, html (clean, from the checks), metaDescription, tags: [..],
 *          category, categoryName, company, companyUrl, image: { url, width, height, alt },
 *          datePublished, dateModified }   // ISO dates
 *
 * What it guarantees:
 *  - Clearly labelled "Sponsored" in the page and in structured data (sponsor = the buyer).
 *  - Title, meta description, canonical, Open Graph and Twitter tags for search and sharing.
 *  - NewsArticle structured data with headline, description, dates, image, author and
 *    publisher, keywords from the tags (the old <meta name="keywords"> tag is not used:
 *    Google ignores it and Bing treats it as spam).
 *  - The whole article in the HTML (no script needed to read it), with a visible
 *    published and "Last updated" date (dateModified, 35.3).
 *  - Breadcrumb data: Home > Publishing > Sponsored > title.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TDSponsoredPost = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var SITE = "https://www.techdirectory.io";
  var ORG = { "@type": "Organization", "@id": SITE + "/#organization", name: "TechDirectory", url: SITE + "/",
              logo: { "@type": "ImageObject", url: SITE + "/td-assets/techdirectory-logo-primary.png" } };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function day(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  }
  function jsonScript(obj) { return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, "\\u003c") + "</script>"; }

  function build(p) {
    var tags = (p.tags || []).slice(0, 5);
    var modified = p.dateModified || p.datePublished;
    var title = p.title + " | Sponsored | TechDirectory";

    var article = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "@id": p.url + "#article",
      mainEntityOfPage: p.url,
      headline: String(p.title).slice(0, 110),
      description: p.metaDescription,
      datePublished: p.datePublished,
      dateModified: modified,
      image: p.image && p.image.url ? [{ "@type": "ImageObject", url: p.image.url, width: p.image.width, height: p.image.height }] : undefined,
      author: { "@type": "Organization", name: p.company, url: p.companyUrl },
      sponsor: { "@type": "Organization", name: p.company, url: p.companyUrl },
      publisher: ORG,
      articleSection: "Sponsored",
      keywords: tags.join(", "),
      about: p.categoryName ? { "@type": "Thing", name: p.categoryName } : undefined,
      isAccessibleForFree: true,
      inLanguage: "en"
    };
    var crumbs = {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Publishing", item: SITE + "/publishing" },
        { "@type": "ListItem", position: 3, name: "Sponsored", item: SITE + "/sponsored" },
        { "@type": "ListItem", position: 4, name: p.title, item: p.url }
      ]
    };
    JSON.parse(JSON.stringify(article)); // drops undefined fields

    var head = [
      "<title>" + esc(title) + "</title>",
      '<meta name="description" content="' + esc(p.metaDescription) + '">',
      '<link rel="canonical" href="' + esc(p.url) + '">',
      '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">',
      '<meta property="og:type" content="article">',
      '<meta property="og:title" content="' + esc(p.title) + '">',
      '<meta property="og:description" content="' + esc(p.metaDescription) + '">',
      '<meta property="og:url" content="' + esc(p.url) + '">',
      p.image && p.image.url ? '<meta property="og:image" content="' + esc(p.image.url) + '">' : "",
      '<meta property="og:site_name" content="TechDirectory">',
      '<meta property="article:published_time" content="' + esc(p.datePublished) + '">',
      '<meta property="article:modified_time" content="' + esc(modified) + '">',
      '<meta property="article:section" content="Sponsored">'
    ].concat(tags.map(function (t) { return '<meta property="article:tag" content="' + esc(t) + '">'; }))
     .concat(['<meta name="twitter:card" content="summary_large_image">',
              jsonScript(JSON.parse(JSON.stringify(article))), jsonScript(crumbs)])
     .filter(Boolean).join("\n");

    var body =
      '<article class="td-post td-post--sponsored" itemscope>' +
      '<p class="td-post__label"><span class="td-badge td-badge--sponsored">Sponsored</span> ' +
      '<a href="/sponsored-content-policy">What this means</a></p>' +
      "<h1>" + esc(p.title) + "</h1>" +
      '<p class="td-post__byline">Sponsored by <a href="' + esc(p.companyUrl) + '" rel="sponsored noopener" target="_blank">' + esc(p.company) + "</a>" +
      ' · Published <time datetime="' + esc(p.datePublished) + '">' + esc(day(p.datePublished)) + "</time>" +
      (modified && modified !== p.datePublished ? ' · Last updated <time datetime="' + esc(modified) + '">' + esc(day(modified)) + "</time>" : "") + "</p>" +
      (p.image && p.image.url ? '<img class="td-post__image" src="' + esc(p.image.url) + '" alt="' + esc(p.image.alt) + '" width="' + esc(p.image.width) + '" height="' + esc(p.image.height) + '" loading="eager">' : "") +
      '<div class="td-post__body">' + p.html + "</div>" +
      (tags.length ? '<p class="td-post__tags">Topics: ' + tags.map(function (t) { return '<span class="td-post__tag">' + esc(t) + "</span>"; }).join(" ") + "</p>" : "") +
      '<p class="td-post__disclosure">This is a paid post written by ' + esc(p.company) + ". TechDirectory checked it against its " +
      '<a href="/sponsored-content-policy">sponsored content policy</a> but does not endorse it. Links are marked as sponsored.</p>' +
      "</article>";

    return { head: head, body: body, jsonld: [JSON.parse(JSON.stringify(article)), crumbs] };
  }

  return { build: build };
});
