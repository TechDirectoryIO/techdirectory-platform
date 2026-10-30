/*
 * B46 · Sponsored-post orders on autopilot (Build Scope 28.2), as a Cloudflare Worker (free plan).
 *
 *   POST /order            order form -> checks before payment -> Stripe Checkout link
 *   POST /stripe-webhook   payment confirmed -> link, safety and originality checks -> publish, refund or queue
 *   GET  /image/:id        the buyer's image, so the TD platform can fetch it when the post is created
 *   GET  /queue            owner: borderline posts waiting (Authorization: Bearer ADMIN_TOKEN)
 *   POST /queue/:id/publish | /queue/:id/refund
 *   POST /pause | /resume  owner: the pause switch (orders stop; paid orders go to the queue)
 *   GET  /health
 *
 * Never publishes unless every check passes. Any error after payment puts the order in the
 * owner's queue: it is neither published nor refunded automatically.
 *
 * Secrets (wrangler secret put, never in GitHub): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 * TD_API_KEY, WEB_RISK_KEY, COPYSCAPE_USER, COPYSCAPE_KEY, INDEXNOW_KEY, BREVO_API_KEY, ADMIN_TOKEN.
 */
import Checks from "../../../../site/js/b46-sponsored-checks.js";
import Markup from "../../../../site/js/b46-post-markup.js";
import { workerSanitizer } from "./sanitizer.js";

const CURRENCIES = { USD: "PRICE_USD", GBP: "PRICE_GBP", EUR: "PRICE_EUR" };
const MAX_IMAGE = 2 * 1024 * 1024;
const RESERVE_MINUTES = 35; // Stripe Checkout link lives 30 minutes

export default {
  async fetch(request, env, ctx) {
    env = await resolveSecrets(env);
    const url = new URL(request.url);
    const cors = corsHeaders(env, request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const p = url.pathname.replace(/\/+$/, "");
      if (request.method === "POST" && p === "/order") return withCors(await handleOrder(request, env), cors);
      if (request.method === "POST" && p === "/stripe-webhook") return await handleWebhook(request, env, ctx);
      if (request.method === "GET" && p.startsWith("/image/")) return await serveImage(p.slice(7), env);
      if (request.method === "GET" && p === "/health") return json({ ok: true, paused: await isPaused(env) });
      if (p === "/queue" || p.startsWith("/queue/") || p === "/pause" || p === "/resume") {
        if (!(await isAdmin(request, env))) return json({ error: "unauthorised" }, 401);
        return await handleAdmin(request, env, p);
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      console.error("b46 error", e && e.stack || e);
      return withCors(json({ error: "server", message: "Something went wrong and you have not been charged. Please try again in a few minutes." }, 500), cors);
    }
  },
};

/* ---------- Order intake (before payment) ---------- */

async function handleOrder(request, env) {
  if (await isPaused(env)) return json({ error: "paused", message: "Orders are paused for a short while. Your draft is saved; please try again later." }, 503);

  const fd = await request.formData();
  const f = (k) => String(fd.get(k) || "").trim();
  const order = {
    name: f("name"), email: f("email").toLowerCase(), company: f("company"), website: f("website"),
    title: f("title"), category: f("category"), html: String(fd.get("html") || ""),
    metaDescription: f("metaDescription"),
    tags: f("tags").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
    imageAlt: f("imageAlt"), currency: f("currency").toUpperCase() || "USD", policyAccepted: f("policyAccepted"),
  };

  const missing = ["name", "email", "company", "website", "title", "category", "html", "policyAccepted"].filter((k) => !order[k]);
  if (missing.length) return json({ error: "missing", message: "Please fill in: " + missing.join(", ") + "." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) return json({ error: "email", message: "Please check your email address." }, 400);
  let site;
  try { site = new URL(order.website); } catch { site = null; }
  if (!site || site.protocol !== "https:") return json({ error: "website", message: "Your website must start with https://" }, 400);
  if (!CURRENCIES[order.currency] || !env[CURRENCIES[order.currency]]) return json({ error: "currency", message: "Please choose USD, GBP or EUR." }, 400);

  const image = fd.get("image");
  let imageInfo = null;
  if (!image || typeof image === "string") return json({ error: "image", message: "Please add a featured image." }, 400);
  if (image.size > MAX_IMAGE) return json({ error: "image", message: "The image must be 2 MB or smaller." }, 400);
  if (!/^image\/(jpeg|png|webp)$/.test(image.type)) return json({ error: "image", message: "The image must be JPEG, PNG or WebP." }, 400);
  const bytes = new Uint8Array(await image.arrayBuffer());
  imageInfo = { type: image.type, size: image.size, ...imageSize(bytes) };

  order.buyerDomains = [site.hostname.replace(/^www\./, "")];
  const pre = runChecks(order, imageInfo, null, await history(env, order));
  const hard = pre.checks.filter((c) => c.result === "fail");
  if (hard.length) {
    return json({ error: "checks", message: "Please fix these before paying: " + hard.map((c) => c.label + (c.detail ? " (" + c.detail + ")" : "")).join("; ") + ".", checks: pre.checks }, 422);
  }

  // 100% unique (owner, 30 October 2026): refuse text whose paragraphs were already published on TechDirectory.
  for (const fp of await fingerprints(pre.cleanHtml)) {
    if (await env.ORDERS.get("fp:" + fp)) {
      return json({ error: "duplicate", message: "Part of this article has already been published on TechDirectory. Sponsored posts must be 100% unique." }, 422);
    }
  }

  if (!(await reservePlace(env))) {
    return json({ error: "full", message: "This week's sponsored-post places are taken. New places open on Monday; your draft is saved." }, 409);
  }

  const id = newId();
  await env.ORDERS.put("img:" + id, bytes, { metadata: { type: image.type } });
  const record = { id, status: "awaiting_payment", createdAt: new Date().toISOString(), order: { ...order, html: pre.cleanHtml, metaDescription: pre.metaDescription, tags: pre.tags }, image: imageInfo };
  await putOrder(env, record);

  const site_ = env.SITE_URL.replace(/\/$/, "");
  const session = await stripe(env, "POST", "/v1/checkout/sessions", {
    mode: "payment",
    "line_items[0][price]": env[CURRENCIES[order.currency]],
    "line_items[0][quantity]": "1",
    customer_email: order.email,
    client_reference_id: id,
    "metadata[order_id]": id,
    "payment_intent_data[metadata][order_id]": id,
    "payment_intent_data[description]": "TechDirectory sponsored post: " + order.title.slice(0, 80),
    success_url: site_ + "/sponsored-post?paid=1",
    cancel_url: site_ + "/sponsored-post",
    expires_at: String(Math.floor(Date.now() / 1000) + 30 * 60),
  });
  record.checkoutSession = session.id;
  await putOrder(env, record);
  return json({ checkoutUrl: session.url, orderId: id });
}

/* ---------- Stripe webhook (after payment) ---------- */

async function handleWebhook(request, env, ctx) {
  const body = await request.text();
  if (!(await verifyStripe(body, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "signature" }, 400);
  }
  const event = JSON.parse(body);
  const obj = event.data && event.data.object || {};
  const id = obj.metadata && obj.metadata.order_id || obj.client_reference_id;
  if (!id) return json({ ok: true, ignored: event.type });
  const rec = await getOrder(env, id);
  if (!rec) return json({ ok: true, unknown: id });

  if (event.type === "checkout.session.expired") {
    if (rec.status === "awaiting_payment") { rec.status = "expired"; await putOrder(env, rec); await releasePlace(env); }
    return json({ ok: true });
  }
  if (event.type !== "checkout.session.completed" || obj.payment_status !== "paid") return json({ ok: true, ignored: event.type });
  if (rec.status !== "awaiting_payment") return json({ ok: true, duplicate: rec.status }); // Stripe retries: act once

  rec.status = "checking";
  rec.paidAt = new Date().toISOString();
  rec.paymentIntent = obj.payment_intent;
  rec.amount = { total: obj.amount_total, currency: obj.currency };
  await putOrder(env, rec);
  const work = processPaid(env, rec);
  if (ctx && ctx.waitUntil) ctx.waitUntil(work); else await work;
  return json({ ok: true });
}

export async function processPaid(env, rec) {
  try {
    if (await isPaused(env)) return await toQueue(env, rec, "Paused when payment arrived");
    const net = await networkChecks(env, rec.order);
    const r = runChecks(rec.order, rec.image, net, await history(env, rec.order));
    rec.checks = r.checks;
    rec.result = r.result;
    if (r.result === "pass") return await publish(env, rec, r);
    if (r.result === "fail") return await refund(env, rec, r.checks.filter((c) => c.result === "fail"));
    return await toQueue(env, rec, "Borderline: " + r.checks.filter((c) => c.result === "borderline").map((c) => c.label).join(", "));
  } catch (e) {
    rec.error = String(e && e.message || e);
    return await toQueue(env, rec, "Error after payment: " + rec.error);
  }
}

function runChecks(order, imageInfo, network, hist) {
  return Checks.run({
    title: order.title, html: order.html, category: order.category,
    metaDescription: order.metaDescription, tags: order.tags,
    buyerDomains: order.buyerDomains, image: { width: imageInfo && imageInfo.width || 0 },
    network: network || undefined, history: hist,
  }, workerSanitizer);
}

async function networkChecks(env, order) {
  const clean = workerSanitizer.sanitize(order.html, { ALLOWED_TAGS: Checks.RULES.allowedTags, ALLOWED_ATTR: Checks.RULES.allowedAttr });
  const urls = [...clean.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map((m) => m[1]).filter((u) => /^https?:/i.test(u));
  const links = {};
  for (const u of [...new Set(urls)]) {
    const host = safeHost(u);
    links[u] = {
      status: await linkStatus(u),
      safe: await webRiskSafe(env, u),
      rejectedBefore: host ? !!(await env.ORDERS.get("rejdomain:" + host)) : false,
    };
  }
  return { links, originality: await originality(env, order) };
}

async function linkStatus(u) {
  try {
    let r = await fetch(u, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (r.status === 405 || r.status === 403) r = await fetch(u, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
    return r.status;
  } catch { return 0; }
}

async function webRiskSafe(env, u) {
  if (!env.WEB_RISK_KEY) return undefined; // not checked -> borderline
  const q = new URLSearchParams({ uri: u, key: env.WEB_RISK_KEY });
  for (const t of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]) q.append("threatTypes", t);
  const r = await fetch("https://webrisk.googleapis.com/v1/uris:search?" + q, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return undefined;
  const j = await r.json();
  return !(j && j.threat);
}

async function originality(env, order) {
  // Owner decision, 30 October 2026: own content only (a company may reuse its own press release), confirmed by the
  // buyer's tick box; no automatic check until ORIGINALITY_CHECK = "on" and Copyscape keys are added.
  if (env.ORIGINALITY_CHECK !== "on") return "off";
  if (!env.COPYSCAPE_USER || !env.COPYSCAPE_KEY) return undefined; // switched on but not set up -> borderline
  const text = order.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const body = new URLSearchParams({ u: env.COPYSCAPE_USER, k: env.COPYSCAPE_KEY, o: "csearch", e: "UTF-8", f: "json", t: text });
  const r = await fetch("https://www.copyscape.com/api/", { method: "POST", body, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return undefined;
  const j = await r.json();
  if (j.error) return undefined;
  const site = (env.SITE_URL || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  const top = Math.max(0, ...(j.result || []).filter((x) => !String(x.url || "").includes(site)).map((x) => Number(x.percentmatched) || 0));
  return top >= Number(env.ORIGINALITY_FAIL_PCT || 40) ? "exact" : top >= Number(env.ORIGINALITY_FLAG_PCT || 10) ? "partial" : "none";
}

async function history(env, order) {
  const key = "hist:" + historyKey(order);
  const h = (await env.ORDERS.get(key, "json")) || [];
  const yearAgo = Date.now() - 365 * 864e5;
  return { refusals12m: h.filter((t) => t > yearAgo).length };
}
const historyKey = (o) => (o.buyerDomains && o.buyerDomains[0]) || o.email.split("@")[1];

/* ---------- Outcomes ---------- */

async function publish(env, rec, r) {
  const o = rec.order;
  const slug = slugify(o.title) + "-" + rec.id.slice(0, 6);
  const site = env.SITE_URL.replace(/\/$/, "");
  const url = site + (env.TD_POST_PATH || "/sponsored/") + slug;
  const now = new Date().toISOString();
  const imageUrl = env.WORKER_URL.replace(/\/$/, "") + "/image/" + rec.id;
  const m = Markup.build({
    url, title: o.title, html: r.cleanHtml, metaDescription: r.metaDescription, tags: r.tags,
    categoryName: o.category, company: o.company, companyUrl: o.website,
    image: { url: imageUrl, width: rec.image.width, height: rec.image.height, alt: o.imageAlt || o.title },
    datePublished: now, dateModified: now,
  });
  const created = await tdCreatePost(env, {
    title: o.title, slug, body: m.body + m.jsonld.map((x) => '<script type="application/ld+json">' + JSON.stringify(x).replace(/</g, "\\u003c") + "</script>").join(""),
    metaDescription: r.metaDescription, tags: r.tags, imageUrl,
  });
  rec.status = "published";
  rec.publishedAt = now;
  for (const fp of await fingerprints(r.cleanHtml)) await env.ORDERS.put("fp:" + fp, rec.id);
  rec.url = created.url || url;
  rec.tdPostId = created.id;
  await putOrder(env, rec);
  await indexNow(env, [rec.url]);
  await email(env, o.email, "Your sponsored post is live on TechDirectory",
    `Hello ${o.name},\n\nYour article "${o.title}" passed every check and is now live:\n${rec.url}\n\nIt is labelled Sponsored and stays live for at least 12 months.\n\nTechDirectory`);
  return rec;
}

async function refund(env, rec, fails) {
  await stripe(env, "POST", "/v1/refunds", { payment_intent: rec.paymentIntent, "metadata[order_id]": rec.id, reason: "requested_by_customer" });
  rec.status = "refunded";
  rec.refundedAt = new Date().toISOString();
  rec.reasons = fails.map((c) => c.label + (c.detail ? ": " + c.detail : ""));
  await putOrder(env, rec);
  const key = "hist:" + historyKey(rec.order);
  const h = (await env.ORDERS.get(key, "json")) || [];
  h.push(Date.now());
  await env.ORDERS.put(key, JSON.stringify(h));
  for (const u of unsafeLinks(rec)) { const host = safeHost(u); if (host) await env.ORDERS.put("rejdomain:" + host, rec.id); }
  await email(env, rec.order.email, "Your sponsored post could not be published: full refund sent",
    `Hello ${rec.order.name},\n\nWe could not publish "${rec.order.title}" and have refunded your payment in full. Reason:\n- ${rec.reasons.join("\n- ")}\n\nYou can fix this and submit once more at no charge: reply to this email with the corrected article.\n\nSponsored content policy: ${env.SITE_URL.replace(/\/$/, "")}/sponsored-content-policy\n\nTechDirectory`);
  return rec;
}

async function toQueue(env, rec, reason) {
  rec.status = "queued";
  rec.queueReason = reason;
  rec.queuedAt = new Date().toISOString();
  await putOrder(env, rec);
  await env.ORDERS.put("queue:" + rec.id, "1");
  if (env.OWNER_EMAIL) await email(env, env.OWNER_EMAIL, "Sponsored post waiting for you: " + rec.order.title.slice(0, 60),
    `${reason}\n\nOrder ${rec.id} from ${rec.order.company} (${rec.order.email}).\nDecide within 3 working days: publish or refund from the queue.`);
  return rec;
}

function unsafeLinks(rec) {
  const safety = (rec.checks || []).find((c) => c.id === "safety");
  if (!safety || safety.result !== "fail") return [];
  return [...String(rec.order.html).matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((u) => (safety.detail || "").includes(safeHost(u) || "\u0000"));
}

/* ---------- Owner queue and pause switch ---------- */

async function handleAdmin(request, env, p) {
  if (p === "/pause" && request.method === "POST") { await env.ORDERS.put("paused", "1"); return json({ paused: true }); }
  if (p === "/resume" && request.method === "POST") { await env.ORDERS.delete("paused"); return json({ paused: false }); }
  if (p === "/queue" && request.method === "GET") {
    const list = await env.ORDERS.list({ prefix: "queue:" });
    const items = [];
    for (const k of list.keys) {
      const rec = await getOrder(env, k.name.slice(6));
      if (rec) items.push({ id: rec.id, title: rec.order.title, company: rec.order.company, reason: rec.queueReason, paidAt: rec.paidAt, checks: rec.checks });
    }
    return json({ items });
  }
  const m = p.match(/^\/queue\/([a-z0-9]+)\/(publish|refund)$/);
  if (m && request.method === "POST") {
    const rec = await getOrder(env, m[1]);
    if (!rec || rec.status !== "queued") return json({ error: "not in queue" }, 404);
    if (m[2] === "publish") {
      const r = Checks.run({ title: rec.order.title, html: rec.order.html, category: rec.order.category, metaDescription: rec.order.metaDescription, tags: rec.order.tags, buyerDomains: rec.order.buyerDomains, image: { width: rec.image.width } }, workerSanitizer);
      await publish(env, rec, r);
    } else {
      await refund(env, rec, [{ id: "owner", label: "Did not meet the sponsored content policy", detail: "" }]);
    }
    await env.ORDERS.delete("queue:" + rec.id);
    return json({ id: rec.id, status: rec.status, url: rec.url });
  }
  return json({ error: "not found" }, 404);
}

/* ---------- Weekly cap (Build Scope 28: at most 15 a week) ---------- */

function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return "week:" + y + "-W" + String(w).padStart(2, "0");
}
async function reservePlace(env) {
  const key = weekKey();
  const n = Number(await env.ORDERS.get(key)) || 0;
  if (n >= Number(env.WEEKLY_CAP || 15)) return false;
  await env.ORDERS.put(key, String(n + 1), { expirationTtl: 21 * 864e2 });
  return true;
}
async function releasePlace(env) {
  const key = weekKey();
  const n = Number(await env.ORDERS.get(key)) || 0;
  if (n > 0) await env.ORDERS.put(key, String(n - 1), { expirationTtl: 21 * 864e2 });
}

/* ---------- Services ---------- */

async function stripe(env, method, path, params) {
  const r = await fetch("https://api.stripe.com" + path, {
    method,
    headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Stripe " + path + ": " + (j.error && j.error.message || r.status));
  return j;
}

// TD platform API (post create). Field names are confirmed against the API page in the
// admin (Developer Hub) in the change window; they are kept in one place for that reason.
async function tdCreatePost(env, p) {
  const site = env.SITE_URL.replace(/\/$/, "");
  const form = new URLSearchParams({
    data_id: env.TD_POST_TYPE_ID, user_id: env.TD_AUTHOR_USER_ID,
    post_title: p.title, post_filename: p.slug, post_content: p.body, post_status: "1",
    post_tags: p.tags.join(","), post_meta_description: p.metaDescription, post_image: p.imageUrl,
  });
  const r = await fetch(site + "/api/v2/data_posts/create", {
    method: "POST", headers: { "X-Api-Key": env.TD_API_KEY, "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== "success") throw new Error("TD post create failed: " + (j.message || r.status));
  const msg = typeof j.message === "object" ? j.message : {};
  return { id: msg.post_id || msg.id, url: msg.post_url || null };
}

async function indexNow(env, urls) {
  if (!env.INDEXNOW_KEY || !urls.length) return;
  const host = new URL(env.SITE_URL).host;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: env.INDEXNOW_KEY, keyLocation: `https://${host}/${env.INDEXNOW_KEY}.txt`, urlList: urls }),
    });
  } catch { /* a missed ping is harmless: the sitemap catches it */ }
}

// Transactional email through Brevo's API (no lists, campaigns or templates are touched).
async function email(env, to, subject, text) {
  if (!env.BREVO_API_KEY) { await env.ORDERS.put("outbox:" + newId(), JSON.stringify({ to, subject, text, at: Date.now() }), { expirationTtl: 30 * 864e2 }); return; }
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: "TechDirectory", email: env.SENDER_EMAIL }, to: [{ email: to }], subject, textContent: text }),
  }).catch(() => {});
}

/* ---------- Helpers ---------- */

// One fingerprint per paragraph of 25+ words (case, spacing and punctuation ignored), so a resubmitted
// article is caught even if a sentence or two is changed elsewhere in it.
export async function fingerprints(html) {
  const paras = String(html).split(/<\/(?:p|li|blockquote|h2|h3)>/i)
    .map((p) => p.replace(/<[^>]+>/g, " ").toLowerCase().replace(/[^a-z0-9à-ɏ\s]/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.split(" ").length >= 25);
  const out = [];
  for (const p of new Set(paras)) {
    const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p)));
    out.push([...d.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join(""));
  }
  return out;
}

// Keys can live in Cloudflare's Secrets Store (account level, bound to this Worker) or as Worker secrets.
// A Secrets Store binding is an object with get(); a Worker secret is a plain string. Both work.
const SECRET_NAMES = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TD_API_KEY", "WEB_RISK_KEY", "COPYSCAPE_USER",
  "COPYSCAPE_KEY", "INDEXNOW_KEY", "BREVO_API_KEY", "ADMIN_TOKEN"];
export async function resolveSecrets(env) {
  const out = { ...env };
  for (const n of SECRET_NAMES) {
    const v = env[n];
    if (v && typeof v === "object" && typeof v.get === "function") {
      try { out[n] = await v.get(); } catch { out[n] = ""; } // missing secret = service treated as not set up
    }
  }
  return out;
}

async function verifyStripe(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")).filter((x) => x.length === 2).map(([k, v]) => [k, v]));
  const sigs = header.split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + payload)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => timingSafeEqual(s, hex));
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function isAdmin(request, env) {
  const h = request.headers.get("authorization") || "";
  return !!env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 32 && timingSafeEqual(h, "Bearer " + env.ADMIN_TOKEN);
}
const isPaused = async (env) => (await env.ORDERS.get("paused")) === "1";
const getOrder = (env, id) => env.ORDERS.get("order:" + id, "json");
const putOrder = (env, rec) => env.ORDERS.put("order:" + rec.id, JSON.stringify(rec));
const newId = () => [...crypto.getRandomValues(new Uint8Array(10))].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 70).replace(/-+$/, "");
function safeHost(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } }
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } }); }
function corsHeaders(env, request) {
  const origin = request.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim());
  return allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : {};
}
function withCors(res, cors) { for (const [k, v] of Object.entries(cors)) res.headers.set(k, v); return res; }
async function serveImage(id, env) {
  if (!/^[a-z0-9]{8,32}$/.test(id)) return json({ error: "not found" }, 404);
  const { value, metadata } = await env.ORDERS.getWithMetadata("img:" + id, "arrayBuffer");
  if (!value) return json({ error: "not found" }, 404);
  return new Response(value, { headers: { "Content-Type": (metadata && metadata.type) || "image/jpeg", "Cache-Control": "public, max-age=86400" } });
}

// Width and height from the file header (PNG, JPEG, WebP), so the image check can't be faked by the form.
export function imageSize(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { width: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, height: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0 };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1], len = b[i + 2] << 8 | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: b[i + 5] << 8 | b[i + 6], width: b[i + 7] << 8 | b[i + 8] };
      i += 2 + len;
    }
  }
  if (b[0] === 0x52 && b[8] === 0x57 && b[12] === 0x56) { // RIFF....WEBPVP8
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === "VP8 ") return { width: (b[26] | b[27] << 8) & 0x3fff, height: (b[28] | b[29] << 8) & 0x3fff };
    if (kind === "VP8L") { const v = b[21] | b[22] << 8 | b[23] << 16 | b[24] << 24; return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
    if (kind === "VP8X") return { width: 1 + (b[24] | b[25] << 8 | b[26] << 16), height: 1 + (b[27] | b[28] << 8 | b[29] << 16) };
  }
  return { width: 0, height: 0 };
}
