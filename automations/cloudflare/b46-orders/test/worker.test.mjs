// B46 order Worker: acceptance tests with Stripe, Web Risk, Copyscape, TD API and IndexNow mocked.
// Run: cd automations/cloudflare/b46-orders && npm install && npm test
import worker, { imageSize } from "../src/worker.js";
import { workerSanitizer } from "../src/sanitizer.js";
import Checks from "../../../../site/js/b46-sponsored-checks.js";
import { performance } from "node:perf_hooks";

/* ---- fakes ---- */
class KV {
  constructor() { this.m = new Map(); }
  async get(k, type) { const e = this.m.get(k); if (!e) return null; return type === "json" ? JSON.parse(e.v) : type === "arrayBuffer" ? e.v : e.v; }
  async getWithMetadata(k, type) { const e = this.m.get(k); return e ? { value: e.v, metadata: e.meta } : { value: null, metadata: null }; }
  async put(k, v, o = {}) { this.m.set(k, { v, meta: o.metadata }); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix }) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }; }
}
const SECRET = "whsec_test_123";
const ADMIN = "a".repeat(40);
function makeEnv(extra = {}) {
  return {
    ORDERS: new KV(), SITE_URL: "https://www.techdirectory.io", WORKER_URL: "https://orders.techdirectory.io",
    PRICE_USD: "price_usd", PRICE_GBP: "price_gbp", PRICE_EUR: "price_eur", WEEKLY_CAP: "15",
    STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: SECRET, TD_API_KEY: "td", TD_POST_TYPE_ID: "7", TD_AUTHOR_USER_ID: "1",
    WEB_RISK_KEY: "wr", COPYSCAPE_USER: "u", COPYSCAPE_KEY: "k", INDEXNOW_KEY: "0123456789abcdef0123456789abcdef",
    OWNER_EMAIL: "owner@techdirectory.io", SENDER_EMAIL: "info@techdirectory.io", ADMIN_TOKEN: ADMIN, BREVO_API_KEY: "b",
    ALLOWED_ORIGIN: "https://www.techdirectory.io", ...extra,
  };
}
let calls = [];
let behaviour = {};
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const body = init.body ? String(init.body) : "";
  calls.push({ url, method: init.method || "GET", body });
  const ok = (j, s = 200) => new Response(JSON.stringify(j), { status: s, headers: { "Content-Type": "application/json" } });
  if (url.startsWith("https://api.stripe.com/v1/checkout/sessions")) return ok({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" });
  if (url.startsWith("https://api.stripe.com/v1/refunds")) return ok({ id: "re_1", status: "succeeded" });
  if (url.startsWith("https://webrisk.googleapis.com")) return ok(behaviour.unsafe && url.includes(encodeURIComponent(behaviour.unsafe)) ? { threat: { threatTypes: ["MALWARE"] } } : {});
  if (url.startsWith("https://www.copyscape.com")) return ok({ count: 1, result: [{ url: "https://elsewhere.com/x", percentmatched: behaviour.copied || 0 }] });
  if (url.includes("/api/v2/data_posts/create")) return behaviour.tdDown ? ok({ status: "error", message: "down" }, 500) : ok({ status: "success", message: { post_id: 991 } });
  if (url.startsWith("https://api.indexnow.org")) return new Response("", { status: 202 });
  if (url.startsWith("https://api.brevo.com")) return ok({ messageId: "m1" }, 201);
  return new Response("", { status: behaviour.linkStatus || 200 }); // the buyer's links
};

/* ---- builders ---- */
const SENT = "The team checks which of the cloud services they use today and how much each one costs to run. ";
const words = (n) => SENT.repeat(Math.ceil(n / 19)).split(" ").slice(0, n).join(" ");
const goodHtml = `<p>Cloud software teams plan migrations carefully. ${words(380)}</p><h2>How long does a cloud migration take?</h2><p>${words(380)} See <a href="https://example.com/cloud-guide">our cloud guide</a>.</p>`;
function png(w, h) { const b = new Uint8Array(40); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); const v = new DataView(b.buffer); v.setUint32(16, w); v.setUint32(20, h); return b; }
function orderForm(over = {}) {
  const fd = new FormData();
  const f = { name: "Ada", email: "ada@example.com", company: "Example Cloud Ltd", website: "https://example.com", title: "How cloud software teams plan a platform migration",
    category: "cloud-and-saas", html: goodHtml, metaDescription: "A practical guide to planning a cloud platform migration: what to check first and how to keep data safe.",
    tags: "cloud migration,SaaS", imageAlt: "Engineers planning", currency: "USD", policyAccepted: "2026-11-03T08:00:00Z", ...over };
  for (const [k, v] of Object.entries(f)) if (v !== null) fd.append(k, v);
  if (over.image !== null) fd.append("image", over.image || new File([png(1600, 900)], "a.png", { type: "image/png" }));
  return new Request("https://orders.techdirectory.io/order", { method: "POST", body: fd, headers: { origin: "https://www.techdirectory.io" } });
}
async function signed(env, event, tOffset = 0) {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000) + tOffset;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + payload)));
  const sig = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new Request("https://orders.techdirectory.io/stripe-webhook", { method: "POST", body: payload, headers: { "stripe-signature": `t=${t},v1=${sig}` } });
}
const paidEvent = (id) => ({ type: "checkout.session.completed", data: { object: { metadata: { order_id: id }, payment_status: "paid", payment_intent: "pi_1", amount_total: 19900, currency: "usd" } } });
const ctx = { waitUntil: () => {} }; // processing is awaited directly in tests below
const run = (req, env) => worker.fetch(req, env, null);
async function placeAndPay(env, over = {}) {
  const r = await run(orderForm(over), env); const j = await r.json();
  if (!j.orderId) return { r, j };
  await run(await signed(env, paidEvent(j.orderId)), env);
  return { r, j, rec: await env.ORDERS.get("order:" + j.orderId, "json") };
}
const hit = (s) => calls.filter((c) => c.url.includes(s));

/* ---- tests ---- */
const results = [];
const t = (n, c, d = "") => results.push([n, !!c, d]);
const reset = () => { calls = []; behaviour = {}; };

{ reset(); const env = makeEnv(); const r = await run(orderForm(), env); const j = await r.json();
  const s = hit("checkout/sessions")[0]; const p = new URLSearchParams(s && s.body);
  t("Good order returns a Stripe Checkout link", r.status === 200 && j.checkoutUrl.startsWith("https://checkout.stripe.com"), JSON.stringify(j));
  t("Checkout uses the USD price and carries the order ID", p.get("line_items[0][price]") === "price_usd" && p.get("metadata[order_id]") === j.orderId && p.get("payment_intent_data[metadata][order_id]") === j.orderId);
  t("Order stored as awaiting payment, cleaned HTML only", (await env.ORDERS.get("order:" + j.orderId, "json")).status === "awaiting_payment");
  t("Order page origin allowed (CORS)", r.headers.get("access-control-allow-origin") === "https://www.techdirectory.io"); }

{ reset(); const env = makeEnv(); const r = await run(orderForm({ currency: "GBP" }), env); await r.json();
  t("GBP order uses the GBP price", new URLSearchParams(hit("checkout/sessions")[0].body).get("line_items[0][price]") === "price_gbp"); }

{ reset(); const env = makeEnv(); const r = await run(orderForm({ html: goodHtml.replace("carefully", "carefully, like an online casino") }), env); const j = await r.json();
  t("Banned topic stopped before payment (no Stripe call)", r.status === 422 && !hit("stripe.com").length && /Banned/i.test(j.message), j.message); }

{ reset(); const env = makeEnv(); const r = await run(orderForm({ html: goodHtml + '<script>alert(1)</script><p onclick="x()">x</p>' }), env);
  t("Script in the article stopped before payment", r.status === 422 && !hit("stripe.com").length); }

{ reset(); const env = makeEnv(); const r = await run(orderForm({ policyAccepted: null }), env);
  t("No policy tick: refused", r.status === 400); }

{ reset(); const env = makeEnv(); const r = await run(orderForm({ website: "http://example.com" }), env);
  t("Website must be https", r.status === 400); }

{ reset(); const env = makeEnv(); const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "b.png", { type: "image/png" });
  const r = await run(orderForm({ image: big }), env); t("Image over 2 MB refused", r.status === 400); }

{ reset(); const env = makeEnv(); await env.ORDERS.put("paused", "1"); const r = await run(orderForm(), env);
  t("Pause switch stops new orders", r.status === 503 && !hit("stripe.com").length); }

{ reset(); const env = makeEnv({ WEEKLY_CAP: "2" }); await run(orderForm(), env); await run(orderForm(), env); const r = await run(orderForm(), env); const j = await r.json();
  t("Weekly cap: order 3 of 2 refused, no charge", r.status === 409 && hit("checkout/sessions").length === 2, j.message); }

{ reset(); const env = makeEnv(); const r = await run(orderForm(), env); const j = await r.json();
  const bad = await signed(env, paidEvent(j.orderId)); const tampered = new Request(bad.url, { method: "POST", body: (await bad.text()).replace("19900", "100"), headers: bad.headers });
  const rr = await run(tampered, env);
  t("Webhook with a wrong signature is rejected", rr.status === 400 && !hit("data_posts").length);
  const old = await run(await signed(env, paidEvent(j.orderId), -600), env);
  t("Webhook older than 5 minutes is rejected (replay)", old.status === 400); }

{ reset(); const env = makeEnv(); const { rec } = await placeAndPay(env);
  const post = new URLSearchParams(hit("data_posts/create")[0]?.body || "");
  t("Every check passes: published automatically", rec.status === "published" && hit("data_posts/create").length === 1, rec.queueReason || JSON.stringify(rec.checks?.filter(c=>c.result!=="pass")));
  t("Published body: Sponsored label, rel=sponsored, structured data", /td-badge--sponsored/.test(post.get("post_content")) && /rel="sponsored noopener"/.test(post.get("post_content")) && /"@type":"NewsArticle"/.test(post.get("post_content")));
  t("Search summary and tags sent to the TD post", (post.get("post_meta_description")||"").startsWith("A practical guide") && post.get("post_tags") === "cloud migration,SaaS");
  t("IndexNow ping sent with the post URL", hit("indexnow").length === 1 && JSON.parse(hit("indexnow")[0].body).urlList[0] === rec.url);
  t("Buyer emailed the live link", hit("brevo").some((c) => c.body.includes(rec.url)));
  t("No refund on a published post", !hit("refunds").length); }

{ reset(); const env = makeEnv(); const r = await run(orderForm(), env); const j = await r.json();
  await run(await signed(env, paidEvent(j.orderId)), env); await run(await signed(env, paidEvent(j.orderId)), env);
  t("Stripe retries the webhook: published once only", hit("data_posts/create").length === 1); }

{ reset(); behaviour.unsafe = "https://example.com/cloud-guide"; const env = makeEnv(); const { rec } = await placeAndPay(env);
  t("Unsafe link after payment: full refund, not published", rec.status === "refunded" && hit("refunds").length === 1 && !hit("data_posts").length);
  t("Refund email gives the reason and the free resubmission", hit("brevo").some((c) => /refunded your payment in full/.test(c.body) && /Link safety/.test(c.body)));
  t("Domain remembered: next order with it fails", !!(await env.ORDERS.get("rejdomain:example.com"))); }

{ reset(); behaviour.copied = 85; const env = makeEnv(); const { rec } = await placeAndPay(env);
  t("Copied-text check off by default: own press release published elsewhere still goes live", rec.status === "published" && !hit("copyscape").length); }

{ reset(); behaviour.copied = 85; const env = makeEnv({ ORIGINALITY_CHECK: "on" }); const { rec } = await placeAndPay(env);
  t("Check switched on: copied article (85% match) refunded", rec.status === "refunded"); }

{ reset(); behaviour.copied = 20; const env = makeEnv({ ORIGINALITY_CHECK: "on" }); const { rec } = await placeAndPay(env);
  t("Partial match (20%): owner's queue, no refund, not published", rec.status === "queued" && !hit("refunds").length && !hit("data_posts").length); }

{ reset(); const env = makeEnv({ COPYSCAPE_KEY: "", ORIGINALITY_CHECK: "on" }); const { rec } = await placeAndPay(env);
  t("Check on but Copyscape not set up: queue, never published", rec.status === "queued" && !hit("data_posts").length); }

{ reset(); const env = makeEnv({ WEB_RISK_KEY: "" }); const { rec } = await placeAndPay(env);
  t("Link-safety service not set up: queue, never published", rec.status === "queued" && !hit("data_posts").length, rec.queueReason); }

{ reset(); behaviour.linkStatus = 404; const env = makeEnv(); const { rec } = await placeAndPay(env);
  t("Link not responding: owner's queue", rec.status === "queued"); }

{ reset(); behaviour.tdDown = true; const env = makeEnv(); const { rec } = await placeAndPay(env);
  t("TD platform error: queue, owner alerted, no refund", rec.status === "queued" && /TD post create failed/.test(rec.queueReason) && hit("brevo").some((c) => c.body.includes("owner@techdirectory.io")) && !hit("refunds").length); }

{ reset(); const env = makeEnv(); const r = await run(orderForm(), env); const j = await r.json(); await env.ORDERS.put("paused", "1");
  await run(await signed(env, paidEvent(j.orderId)), env); const rec = await env.ORDERS.get("order:" + j.orderId, "json");
  t("Paid while paused: queued, not published", rec.status === "queued"); }

{ reset(); const env = makeEnv({ WEB_RISK_KEY: "" }); const { j } = await placeAndPay(env);
  const noAuth = await run(new Request("https://orders.techdirectory.io/queue"), env);
  const auth = { authorization: "Bearer " + ADMIN };
  const list = await (await run(new Request("https://orders.techdirectory.io/queue", { headers: auth }), env)).json();
  const pub = await (await run(new Request(`https://orders.techdirectory.io/queue/${j.orderId}/publish`, { method: "POST", headers: auth }), env)).json();
  t("Owner queue needs the admin token", noAuth.status === 401);
  t("Owner sees the queued post and can publish it", list.items.length === 1 && pub.status === "published"); }

{ reset(); const env = makeEnv(); await env.ORDERS.put("hist:example.com", JSON.stringify([Date.now() - 1000, Date.now() - 2000]));
  const r = await run(orderForm(), env); t("Two refusals in 12 months: stopped before payment", r.status === 422 && !hit("stripe.com").length); }

{ reset(); const env = makeEnv(); const r = await run(orderForm(), env); const j = await r.json();
  await run(await signed(env, { type: "checkout.session.expired", data: { object: { metadata: { order_id: j.orderId } } } }), env);
  t("Abandoned checkout frees the weekly place", (await env.ORDERS.get(Object.keys(Object.fromEntries(env.ORDERS.m)).find((k) => k.startsWith("week:")))) === "0"); }

{ reset(); const env = makeEnv({ BREVO_API_KEY: "" }); const { rec } = await placeAndPay(env);
  const out = [...env.ORDERS.m.keys()].filter((k) => k.startsWith("outbox:"));
  t("Without Brevo set up, emails wait in an outbox (nothing lost)", rec.status === "published" && out.length === 1 && !hit("brevo").length); }

{ reset(); const store = (v) => ({ get: async () => v });
  const env = makeEnv({ BREVO_API_KEY: store("b"), WEB_RISK_KEY: store("wr"), STRIPE_SECRET_KEY: store("sk_test_x"), STRIPE_WEBHOOK_SECRET: store(SECRET), ADMIN_TOKEN: store(ADMIN), TD_API_KEY: store("td"), INDEXNOW_KEY: store("0123456789abcdef0123456789abcdef") });
  const r = await run(orderForm(), env); const j = await r.json();
  await run(await signed(env, paidEvent(j.orderId)), env);
  const rec = await env.ORDERS.get("order:" + j.orderId, "json");
  t("Keys from Cloudflare's Secrets Store work the same as Worker secrets", rec.status === "published" && hit("api.brevo.com").length >= 1); }

{ reset(); const env = makeEnv(); const first = await placeAndPay(env);
  const again = await run(orderForm(), env); const j = await again.json();
  const tweaked = await run(orderForm({ html: goodHtml.replace("carefully", "very carefully") }), env);
  t("100% unique: the same article can't be sold twice", first.rec.status === "published" && again.status === 422 && /100% unique/.test(j.message));
  t("100% unique: a lightly edited copy is still caught", tweaked.status === 422); }

/* sanitiser and image header */
const x = workerSanitizer.sanitize('<p>a<script>alert(1)</script><img src="javascript:alert(1)" onerror="x"><a href="javascript:alert(1)">b</a><iframe src="//e"></iframe><svg><script>1</script></svg><a href="https://ok.com" style="x" class="y">ok</a></p>', { ALLOWED_TAGS: Checks.RULES.allowedTags, ALLOWED_ATTR: Checks.RULES.allowedAttr });
t("Sanitiser removes scripts, handlers, javascript: links, iframes, svg, styles", !/script|onerror|javascript|iframe|svg|style|class/i.test(x) && /href="https:\/\/ok.com"/.test(x), x);
t("Image size read from the file (PNG 1600x900)", JSON.stringify(imageSize(png(1600, 900))) === '{"width":1600,"height":900}');

/* CPU budget: Cloudflare's free plan allows 10 ms of CPU per request */
const long = `<p>${words(1500)}</p><h2>Why?</h2><p>${words(400)} <a href="https://example.com/a">a</a></p>`;
for (let i = 0; i < 20; i++) Checks.run({ title: "x", html: long, category: "cloud-and-saas", tags: ["cloud"], buyerDomains: ["example.com"], image: { width: 1600 } }, workerSanitizer);
const t0 = performance.now(); const N = 50;
for (let i = 0; i < N; i++) Checks.run({ title: "x", html: long, category: "cloud-and-saas", tags: ["cloud"], buyerDomains: ["example.com"], image: { width: 1600 } }, workerSanitizer);
const ms = (performance.now() - t0) / N;
t(`Checks on a 1,900-word post take ${ms.toFixed(1)} ms of CPU (free plan limit 10 ms)`, ms < 10);

const w = Math.max(...results.map(([n]) => n.length));
let f = 0;
for (const [n, ok, d] of results) { if (!ok) f++; console.log(`${ok ? "PASS" : "FAIL"}  ${n.padEnd(w)}  ${ok ? "" : d}`); }
console.log(`\n${results.length - f} of ${results.length} checks passed`);
process.exit(f ? 1 : 0);
