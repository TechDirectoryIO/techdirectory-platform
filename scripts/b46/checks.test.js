// B46 safe-publishing checks: unit tests (Build Scope 28.2.1, 28.2.2, 28.4)
// Run: cd scripts/b46 && npm install && node checks.test.js
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const DOMPurify = createDOMPurify(new JSDOM("").window);
const C = require("../../site/js/b46-sponsored-checks.js");

const para = (n, w = "cloud software teams migrate platform infrastructure and the data they rely on") => {
  const words = w.split(" ");
  return Array.from({ length: n }, (_, i) => words[i % words.length]).join(" ");
};
// ~800 English words about cloud software, two subheadings, one link to the buyer's site
const goodHtml =
  `<p>Cloud software is changing how teams plan the move to a new platform, and this guide explains the steps that matter for the business.</p>` +
  `<h2>Why the move matters</h2><p>${para(250)} and the team.</p>` +
  `<p>See how <a href="https://example.com/cloud">our migration service</a> handles it.</p>` +
  `<h3>What to check first</h3><p>${para(300)} with the data.</p><p>${para(220)} for the business.</p>`;
const base = {
  title: "How cloud software teams plan a platform migration",
  html: goodHtml,
  category: "cloud-and-saas",
  buyerDomains: ["example.com"],
  image: { width: 1600, name: "cloud-migration.jpg" },
  network: { links: { "https://example.com/cloud": { status: 200, safe: true } }, originality: "none" },
  history: { refusals12m: 0 },
  metaDescription: "A practical guide to planning a cloud platform migration: what to check first, who to involve and how to keep data safe.",
  tags: ["cloud migration", "SaaS", "infrastructure"],
};
const run = (over) => C.run(Object.assign({}, base, over), DOMPurify);
const results = [];
const t = (name, cond, detail = "") => results.push([name, !!cond, detail]);

let r = run({});
t("A clean technology post passes every check", r.result === "pass", JSON.stringify(r.checks.filter((c) => c.result !== "pass")));
t("Every link gets rel=\"sponsored noopener\" and a new tab", /<a href="https:\/\/example.com\/cloud" rel="sponsored noopener" target="_blank">/.test(r.cleanHtml));

r = run({ html: goodHtml.replace("cloud software", "online casino tips for cloud software") });
t("A banned word is a hard fail (refund)", r.result === "fail" && r.checks.find((c) => c.id === "topics").result === "fail");

r = run({ html: goodHtml.replace("Cloud software is changing", "Cloud software, like crypto, is changing") });
t("A single ambiguous term goes to the queue", r.result === "borderline" && r.checks.find((c) => c.id === "topics").result === "borderline");

r = run({ html: goodHtml + `<p>Also <a href="https://example.com/a">one</a>, <a href="https://example.com/b">two</a>.</p>`,
          network: { links: {}, originality: "none" } });
t("More than 2 links is a hard fail", r.checks.find((c) => c.id === "links").result === "fail" && r.result === "fail");

r = run({ html: goodHtml.replace("our migration service", "cheap cloud hosting") });
t("A money word in link text is a hard fail", r.checks.find((c) => c.id === "anchors").result === "fail");

r = run({ html: goodHtml.replace("our migration service", "read our very detailed cloud migration service guide") });
t("Link text over 5 words is borderline", r.checks.find((c) => c.id === "anchors").result === "borderline");

r = run({ html: `<p>Cloud software teams.</p><h2>x</h2><p>${para(200)}</p>` });
t("Under 500 words is a hard fail", r.checks.find((c) => c.id === "length").result === "fail");
r = run({ html: goodHtml + `<p>${para(2600)}</p>` });
const lenC = r.checks.find((c) => c.id === "length");
t("3,001–4,000 words goes to the queue", lenC.result === "borderline", lenC.detail);
r = run({});
t("500–999 words passes with the 1,000-word recommendation", r.checks.find((c) => c.id === "length").result === "pass" && (r.words >= 1000 || /1,000 or more recommended/.test(r.checks.find((c) => c.id === "length").detail)));

r = run({ html: goodHtml + `<script>alert(1)</script>` });
t("Pasted HTML with a script is cleaned and hard-fails", !/script/i.test(r.cleanHtml) && r.checks.find((c) => c.id === "html").result === "fail");
r = run({ html: goodHtml.replace("<h2>", '<h2 style="color:red" class="big">') });
t("Inline styles are removed and the post goes to the queue", !/style=|class=/.test(r.cleanHtml) && r.checks.find((c) => c.id === "html").result === "borderline");
r = run({ html: goodHtml.replace('href="https://example.com/cloud"', 'href="javascript:alert(1)"') });
t("javascript: links are removed", !/javascript:/i.test(r.cleanHtml) && r.result === "fail");

r = run({ network: { links: { "https://example.com/cloud": { status: 200, safe: false } }, originality: "none" } });
t("An unsafe link is a hard fail", r.checks.find((c) => c.id === "safety").result === "fail");
r = run({ network: { links: { "https://example.com/cloud": { status: 404, safe: true } }, originality: "none" } });
t("A link that doesn't respond is borderline", r.checks.find((c) => c.id === "safety").result === "borderline");

r = run({ network: { links: base.network.links, originality: "exact" } });
t("Copied text is a hard fail", r.checks.find((c) => c.id === "originality").result === "fail");
r = run({ network: undefined });
t("Before the network checks run, nothing auto-publishes", r.result === "borderline");

r = run({ title: "A guide for growing teams", html: goodHtml.replace("Cloud software is changing how teams plan the move to a new platform", "Growing teams need a plan") , category: "cybersecurity" });
t("Off-topic for the chosen category goes to the queue, not a refund", r.checks.find((c) => c.id === "relevance").result === "borderline" && r.result === "borderline");

r = run({ html: goodHtml.replace(/<h[23]>[^<]*<\/h[23]>/g, "") });
t("No subheading is borderline", r.checks.find((c) => c.id === "format").result === "borderline");
r = run({ image: { width: 800 } });
t("A small featured image is borderline", r.checks.find((c) => c.id === "format").result === "borderline");

r = run({ history: { refusals12m: 2 } });
t("Two refusals in 12 months is a hard fail", r.checks.find((c) => c.id === "history").result === "fail");
r = run({ history: { refusals12m: 1 } });
t("One refusal in 12 months is borderline", r.checks.find((c) => c.id === "history").result === "borderline");

r = run({ html: goodHtml.replace("https://example.com/cloud", "https://another-site.com/x"),
          network: { links: { "https://another-site.com/x": { status: 200, safe: true } }, originality: "none" } });
t("A link to someone else's site is borderline", r.checks.find((c) => c.id === "links").result === "borderline");

r = run({ tags: ["cloud", "online casino"] });
t("A banned word in a tag is a hard fail", r.result === "fail");
r = run({ metaDescription: "" });
t("A blank search summary is made from the first paragraph", r.metaDescription.startsWith("Cloud software is changing") && r.metaDescription.length <= 160, r.metaDescription);
r = run({ metaDescription: "Too short." });
t("A search summary under 70 characters is borderline", r.checks.find((c) => c.id === "seo").result === "borderline");
r = run({ tags: [] });
t("No tags is borderline", r.checks.find((c) => c.id === "seo").result === "borderline");
r = run({ title: "A".repeat(90) + " cloud software" });
t("A title over 70 characters is borderline", r.checks.find((c) => c.id === "seo").result === "borderline");
r = run({ tags: ["a", "b", "c", "d", "e", "f"] });
t("Only 5 tags are kept", r.tags.length === 5);

const w = Math.max(...results.map(([n]) => n.length));
let fails = 0;
for (const [n, ok, d] of results) { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${n.padEnd(w)}  ${ok ? "" : d}`); }
console.log(`\n${results.length - fails} of ${results.length} checks passed`);
process.exit(fails ? 1 : 0);
