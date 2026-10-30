// B46 published post markup: tests (search, AI and labelling). Run: node post_markup.test.js
const { JSDOM } = require("jsdom");
const P = require("../../site/js/b46-post-markup.js");

const post = {
  url: "https://www.techdirectory.io/sponsored/how-cloud-software-teams-plan-a-platform-migration",
  title: "How cloud software teams plan a platform migration",
  html: '<p>Cloud software is changing how teams plan.</p><h2>How long does a migration take?</h2><p>Most take 8 to 12 weeks.</p><p>See <a href="https://example.com/cloud" rel="sponsored noopener" target="_blank">our service</a>.</p>',
  metaDescription: "A practical guide to planning a cloud platform migration: what to check first and how to keep data safe.",
  tags: ["cloud migration", "SaaS", "infrastructure"],
  categoryName: "Cloud and SaaS",
  company: "Example Cloud Ltd", companyUrl: "https://example.com",
  image: { url: "https://www.techdirectory.io/uploads/cloud.webp", width: 1600, height: 900, alt: "Engineers planning a migration" },
  datePublished: "2026-11-04T08:10:00Z", dateModified: "2026-11-20T09:00:00Z",
};
const out = P.build(post);
const html = `<!doctype html><html><head>${out.head}</head><body>${out.body}</body></html>`;
const doc = new JSDOM(html).window.document;
const $ = (s) => doc.querySelector(s);
const results = [];
const t = (n, c, d = "") => results.push([n, !!c, d]);

const a = out.jsonld[0];
t("Title tag says Sponsored and TechDirectory", $("title").textContent === post.title + " | Sponsored | TechDirectory");
t("Meta description is the search summary", $('meta[name="description"]').content === post.metaDescription);
t("No <meta name=\"keywords\"> tag", !$('meta[name="keywords"]'));
t("Canonical URL", $('link[rel="canonical"]').href === post.url);
t("Robots allows indexing and large image previews", /index, follow/.test($('meta[name="robots"]').content) && /max-image-preview:large/.test($('meta[name="robots"]').content));
t("Open Graph title, description, image and type", $('meta[property="og:type"]').content === "article" && $('meta[property="og:image"]') && $('meta[property="og:description"]'));
t("Tags as article:tag and structured-data keywords", doc.querySelectorAll('meta[property="article:tag"]').length === 3 && a.keywords === "cloud migration, SaaS, infrastructure");
t("NewsArticle with headline, description, both dates, image", a["@type"] === "NewsArticle" && a.headline && a.description && a.datePublished && a.dateModified && a.image);
t("Sponsor and author are the buyer, publisher is TechDirectory", a.sponsor.name === post.company && a.author.name === post.company && a.publisher.name === "TechDirectory");
t("Section is Sponsored in structured data", a.articleSection === "Sponsored");
const lds = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
t("Structured data parses and includes breadcrumbs", lds.length === 2 && lds[1]["@type"] === "BreadcrumbList");
t("Visible Sponsored label above the title", $(".td-post__label .td-badge--sponsored").textContent === "Sponsored" &&
  $(".td-post__label").compareDocumentPosition($("h1")) & 4);
t("Byline 'Sponsored by' with a sponsored link", /Sponsored by/.test($(".td-post__byline").textContent) && $(".td-post__byline a").rel === "sponsored noopener");
t("Visible published and Last updated dates", /Published 4 November 2026/.test($(".td-post__byline").textContent) && /Last updated 20 November 2026/.test($(".td-post__byline").textContent));
t("Whole article and question subheading in the HTML (no script needed)", /How long does a migration take\?/.test(doc.body.textContent) && !/<script/i.test(out.body));
t("Every link in the article is marked sponsored", [...doc.querySelectorAll(".td-post__body a")].every((x) => /sponsored/.test(x.rel)));
t("Disclosure line under the article", /paid post written by Example Cloud Ltd/.test($(".td-post__disclosure").textContent));
t("Image has alt text and size (no layout shift)", $(".td-post__image").alt && $(".td-post__image").getAttribute("width") === "1600");
const evil = P.build(Object.assign({}, post, { title: '</script><script>alert(1)</script>', company: '<b>x</b>' }));
t("Title and company are escaped", !/<script>alert/.test(evil.head.replace(/application\/ld\+json/g, "")) && !/<b>x<\/b>/.test(evil.body) && !/<\/script><script>/.test(evil.head));

const prOut = P.build(Object.assign({}, post, { type: "press-release", summary: "Example Cloud has launched a managed migration service for software teams." }));
const prDoc = new JSDOM(`<!doctype html><html><head>${prOut.head}</head><body>${prOut.body}</body></html>`).window.document;
t("Press release: labelled 'Press release' in title, badge, byline and data",
  /\| Press release \| TechDirectory$/.test(prDoc.querySelector("title").textContent) && prDoc.querySelector(".td-badge").textContent === "Press release" &&
  /Press release from/.test(prDoc.querySelector(".td-post__byline").textContent) && prOut.jsonld[0].articleSection === "Press release");
t("Press release: 'In short' summary sits above the release", /In short:/.test(prDoc.querySelector(".td-post__summary").textContent) &&
  prDoc.querySelector(".td-post__summary").compareDocumentPosition(prDoc.querySelector(".td-post__body")) & 4);
t("Press release: disclosure says it may appear elsewhere", /may also appear elsewhere/.test(prDoc.querySelector(".td-post__disclosure").textContent));

const w = Math.max(...results.map(([n]) => n.length));
let f = 0;
for (const [n, ok, d] of results) { if (!ok) f++; console.log(`${ok ? "PASS" : "FAIL"}  ${n.padEnd(w)}  ${ok ? "" : d}`); }
console.log(`\n${results.length - f} of ${results.length} checks passed`);
process.exit(f ? 1 : 0);
