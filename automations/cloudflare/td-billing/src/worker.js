/*
 * B70 · Plan payments on Stripe's payment page (owner approved, 30 October 2026)
 *
 * Replaces the TD platform's own card form for membership plans with Stripe Checkout, so members can pay by
 * card, Apple Pay, Google Pay, Link, Revolut Pay, PayPal or Direct Debit, in pounds, euros or dollars, and a
 * declined card never wipes the form. Renewals, retries, card updates and cancellation run in Stripe Billing.
 *
 *   POST /checkout        { plan, interval, currency, memberId }  -> { url } of a Stripe Checkout page
 *   POST /stripe-webhook  Stripe events -> the member's plan in the TD platform is set through the TD API
 *   GET  /manage          redirects to Stripe's customer portal login (update card, see invoices, cancel)
 *   GET  /health
 *
 * Safety: the member's email is read from the TD platform, never taken from the browser; the plan is only
 * changed for the member named on the paid Stripe subscription; each Stripe event is acted on once; if the
 * TD platform can't be reached the event fails and Stripe retries it (for up to 3 days).
 *
 * Secrets (Cloudflare Secrets Store): STRIPE_SECRET_KEY, STRIPE_BILLING_WEBHOOK_SECRET, TD_API_KEY.
 * PLANS (a variable, not a secret): JSON map "plan:interval:currency" -> Stripe price ID.
 * TD_PLAN_IDS: JSON map plan -> the TD platform's membership plan ID ("basic" is where cancelled members go).
 */

const PLAN_NAMES = { featured: "Featured", premium: "Premium", growth: "Growth" };
const INTERVALS = ["month", "year"];
const CURRENCIES = ["USD", "GBP", "EUR"];

export default {
  async fetch(request, env, ctx) {
    env = await resolveSecrets(env);
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, "");
    const cors = corsHeaders(env, request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      if (request.method === "POST" && p === "/checkout") return withCors(await checkout(request, env), cors);
      if (request.method === "POST" && p === "/stripe-webhook") return await webhook(request, env);
      if (request.method === "GET" && p === "/manage") return env.PORTAL_LOGIN_URL ? Response.redirect(env.PORTAL_LOGIN_URL, 302) : json({ error: "not set up" }, 503);
      if (request.method === "GET" && p === "/health") return json({ ok: true });
      return json({ error: "not found" }, 404);
    } catch (e) {
      console.error("td-billing", e && e.stack || e);
      return withCors(json({ error: "server", message: "Something went wrong and you have not been charged. Please try again in a few minutes." }, 500), cors);
    }
  },
};

/* ---------- Checkout ---------- */

async function checkout(request, env) {
  const body = await readBody(request);
  const plan = String(body.plan || "").toLowerCase();
  const interval = String(body.interval || "month").toLowerCase();
  const currency = String(body.currency || "USD").toUpperCase();
  const memberId = String(body.memberId || "").trim();
  const prices = JSON.parse(env.PLANS || "{}");
  const price = prices[`${plan}:${interval}:${currency}`];
  if (!PLAN_NAMES[plan] || !INTERVALS.includes(interval) || !CURRENCIES.includes(currency) || !price) {
    return json({ error: "plan", message: "That plan isn't available in this currency. Please choose another." }, 400);
  }
  if (!/^\d{1,12}$/.test(memberId)) return json({ error: "member", message: "Please sign in to your TechDirectory account first." }, 401);

  const member = await tdGetMember(env, memberId);
  if (!member || !member.email) return json({ error: "member", message: "We couldn't find your account. Please sign in again." }, 404);

  const site = env.SITE_URL.replace(/\/$/, "");
  const customer = await findOrCreateCustomer(env, member);
  const session = await stripe(env, "POST", "/v1/checkout/sessions", {
    mode: "subscription",
    customer,
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    client_reference_id: memberId,
    "metadata[member_id]": memberId,
    "metadata[plan]": plan,
    "subscription_data[metadata][member_id]": memberId,
    "subscription_data[metadata][plan]": plan,
    allow_promotion_codes: "true",
    billing_address_collection: "auto",
    "customer_update[address]": "auto",
    "customer_update[name]": "auto",
    // Payment methods are not listed here: Stripe shows every method switched on in the dashboard that
    // supports subscriptions in this currency (cards, wallets, Link, PayPal, Bacs or SEPA Direct Debit...).
    success_url: site + "/account/home?upgraded=" + plan,
    cancel_url: site + "/pricing?checkout=cancelled",
  });
  return json({ url: session.url });
}

async function findOrCreateCustomer(env, member) {
  const found = await stripe(env, "GET", "/v1/customers/search?query=" + encodeURIComponent(`metadata['td_member_id']:'${member.id}'`));
  if (found.data && found.data[0]) return found.data[0].id;
  const c = await stripe(env, "POST", "/v1/customers", {
    email: member.email, name: member.company || member.name || "", "metadata[td_member_id]": String(member.id),
  });
  return c.id;
}

/* ---------- Webhook ---------- */

async function webhook(request, env) {
  const raw = await request.text();
  if (!(await verifyStripe(raw, request.headers.get("stripe-signature"), env.STRIPE_BILLING_WEBHOOK_SECRET))) return json({ error: "signature" }, 400);
  const event = JSON.parse(raw);
  if (await env.BILLING.get("evt:" + event.id)) return json({ ok: true, duplicate: true });

  const obj = (event.data && event.data.object) || {};
  const tdIds = JSON.parse(env.TD_PLAN_IDS || "{}");
  let action = "ignored";

  if (event.type === "checkout.session.completed" && obj.mode === "subscription") {
    // Card and wallet payments are paid now; Direct Debit can take a few days ("unpaid" until it clears).
    if (obj.payment_status === "paid" || obj.payment_status === "no_payment_required") {
      action = await setPlan(env, obj.metadata && obj.metadata.member_id, obj.metadata && obj.metadata.plan, tdIds, obj.customer);
    } else action = "waiting for payment";
  } else if (event.type === "checkout.session.async_payment_succeeded") {
    action = await setPlan(env, obj.metadata && obj.metadata.member_id, obj.metadata && obj.metadata.plan, tdIds, obj.customer);
  } else if (event.type === "customer.subscription.updated") {
    const m = obj.metadata || {};
    if (["active", "trialing"].includes(obj.status)) action = await setPlan(env, m.member_id, planOf(obj, env) || m.plan, tdIds, obj.customer);
    else if (["canceled", "unpaid", "incomplete_expired"].includes(obj.status)) action = await setPlan(env, m.member_id, "basic", tdIds, obj.customer);
    else action = "kept (" + obj.status + ")"; // past_due: Stripe is retrying; the member keeps the plan meanwhile
  } else if (event.type === "customer.subscription.deleted") {
    action = await setPlan(env, (obj.metadata || {}).member_id, "basic", tdIds, obj.customer);
  }

  await env.BILLING.put("evt:" + event.id, action, { expirationTtl: 30 * 864e2 });
  return json({ ok: true, action });
}

async function setPlan(env, memberId, plan, tdIds, customerId) {
  if (!/^\d{1,12}$/.test(String(memberId || ""))) return "no member on the subscription";
  const tdPlan = tdIds[plan];
  if (!tdPlan) return "unknown plan " + plan;
  // Only change the member whose Stripe customer this is (guards against a hand-edited member ID).
  if (customerId) {
    const c = await stripe(env, "GET", "/v1/customers/" + customerId);
    if (String((c.metadata || {}).td_member_id) !== String(memberId)) return "member does not match the customer";
  }
  await tdUpdateMember(env, memberId, tdPlan); // throws on failure -> 500 -> Stripe retries
  return "member " + memberId + " -> " + plan;
}

function planOf(sub, env) {
  const priceId = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id;
  const prices = JSON.parse(env.PLANS || "{}");
  const key = Object.keys(prices).find((k) => prices[k] === priceId);
  return key ? key.split(":")[0] : null;
}

/* ---------- TD platform API (field names confirmed in the change window) ---------- */

async function tdGetMember(env, id) {
  const r = await fetch(env.SITE_URL.replace(/\/$/, "") + "/api/v2/user/get/" + id, { headers: { "X-Api-Key": env.TD_API_KEY } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== "success") return null;
  const m = Array.isArray(j.message) ? j.message[0] : j.message || {};
  return { id: m.user_id || id, email: m.email, company: m.company, name: [m.first_name, m.last_name].filter(Boolean).join(" ") };
}

async function tdUpdateMember(env, id, tdPlanId) {
  const r = await fetch(env.SITE_URL.replace(/\/$/, "") + "/api/v2/user/update", {
    method: "PUT",
    headers: { "X-Api-Key": env.TD_API_KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ user_id: String(id), subscription_id: String(tdPlanId) }).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== "success") throw new Error("TD member update failed: " + (j.message || r.status));
}

/* ---------- Helpers ---------- */

async function stripe(env, method, path, params) {
  const r = await fetch("https://api.stripe.com" + path, {
    method,
    headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: params && method !== "GET" ? new URLSearchParams(params).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Stripe " + path.split("?")[0] + ": " + ((j.error && j.error.message) || r.status));
  return j;
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json().catch(() => ({}));
  const fd = await request.formData().catch(() => null);
  return fd ? Object.fromEntries(fd.entries()) : {};
}

const SECRET_NAMES = ["STRIPE_SECRET_KEY", "STRIPE_BILLING_WEBHOOK_SECRET", "TD_API_KEY"];
export async function resolveSecrets(env) {
  const out = { ...env };
  for (const n of SECRET_NAMES) {
    const v = env[n];
    if (v && typeof v === "object" && typeof v.get === "function") { try { out[n] = await v.get(); } catch { out[n] = ""; } }
  }
  return out;
}

async function verifyStripe(payload, header, secret) {
  if (!header || !secret) return false;
  const t = Number((header.split(",").find((x) => x.startsWith("t=")) || "").slice(2));
  const sigs = header.split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + payload)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } }); }
function corsHeaders(env, request) {
  const origin = request.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim());
  return allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : {};
}
function withCors(res, cors) { for (const [k, v] of Object.entries(cors)) res.headers.set(k, v); return res; }
