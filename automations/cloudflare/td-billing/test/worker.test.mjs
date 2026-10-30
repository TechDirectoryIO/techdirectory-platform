// B70 plan payments: tests with Stripe and the TD API mocked. Run: node test/worker.test.mjs
import worker from "../src/worker.js";

class KV { constructor() { this.m = new Map(); } async get(k) { return this.m.has(k) ? this.m.get(k) : null; } async put(k, v) { this.m.set(k, v); } }
const SECRET = "whsec_billing_test";
const PLANS = { "featured:month:USD": "price_f_m_usd", "featured:month:GBP": "price_f_m_gbp", "featured:year:GBP": "price_f_y_gbp", "premium:month:GBP": "price_p_m_gbp" };
const TD_PLAN_IDS = { basic: "1", featured: "2", premium: "3" };
const env = (x = {}) => ({ BILLING: new KV(), SITE_URL: "https://www.techdirectory.io", ALLOWED_ORIGIN: "https://www.techdirectory.io",
  STRIPE_SECRET_KEY: "rk_test", STRIPE_BILLING_WEBHOOK_SECRET: SECRET, TD_API_KEY: "td", PLANS: JSON.stringify(PLANS), TD_PLAN_IDS: JSON.stringify(TD_PLAN_IDS),
  PORTAL_LOGIN_URL: "https://billing.stripe.com/p/login/test_123", ...x });

let calls = [], members = {}, customers = {}, tdDown = false;
const ok = (j, s = 200) => new Response(JSON.stringify(j), { status: s, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  url = String(url); const body = init.body ? String(init.body) : ""; calls.push({ url, method: init.method || "GET", body });
  if (url.includes("/api/v2/user/get/")) { const id = url.split("/").pop(); return members[id] ? ok({ status: "success", message: [members[id]] }) : ok({ status: "error", message: "not found" }, 404); }
  if (url.includes("/api/v2/user/update")) { if (tdDown) return ok({ status: "error", message: "down" }, 503); const p = new URLSearchParams(body); members[p.get("user_id")].subscription_id = p.get("subscription_id"); return ok({ status: "success" }); }
  if (url.includes("/v1/customers/search")) { const id = decodeURIComponent(url).match(/'(\d+)'/)[1]; const c = Object.values(customers).find((c) => c.metadata.td_member_id === id); return ok({ data: c ? [c] : [] }); }
  if (url.match(/\/v1\/customers\/cus_/)) { const id = url.split("/").pop(); return ok(customers[id]); }
  if (url.endsWith("/v1/customers")) { const p = new URLSearchParams(body); const id = "cus_" + (Object.keys(customers).length + 1); customers[id] = { id, email: p.get("email"), metadata: { td_member_id: p.get("metadata[td_member_id]") } }; return ok(customers[id]); }
  if (url.endsWith("/v1/checkout/sessions")) return ok({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" });
  return ok({}, 404);
};
const reset = () => { calls = []; tdDown = false; members = { "501": { user_id: "501", email: "featured+test@techdirectory.io", company: "Featured Test", subscription_id: "1" }, "502": { user_id: "502", email: "other@example.com", company: "Other", subscription_id: "1" } }; customers = {}; };
const req = (path, body, headers = {}) => new Request("https://billing.techdirectory.io" + path, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", origin: "https://www.techdirectory.io", ...headers } });
async function signed(event, offset = 0) {
  const payload = JSON.stringify(event), t = Math.floor(Date.now() / 1000) + offset;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + payload)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new Request("https://billing.techdirectory.io/stripe-webhook", { method: "POST", body: payload, headers: { "stripe-signature": `t=${t},v1=${sig}` } });
}
const hit = (s) => calls.filter((c) => c.url.includes(s));
const results = []; const t = (n, c, d = "") => results.push([n, !!c, d]);
const run = (r, e) => worker.fetch(r, e, {});

{ reset(); const e = env(); const r = await run(req("/checkout", { plan: "featured", interval: "month", currency: "GBP", memberId: "501" }), e); const j = await r.json();
  const s = new URLSearchParams(hit("/v1/checkout/sessions")[0]?.body || "");
  t("Checkout opens a Stripe subscription page in pounds", r.status === 200 && j.url.startsWith("https://checkout.stripe.com") && s.get("mode") === "subscription" && s.get("line_items[0][price]") === "price_f_m_gbp", JSON.stringify(j));
  t("Member's email comes from the TD platform, not the browser", customers.cus_1?.email === "featured+test@techdirectory.io" && s.get("customer") === "cus_1");
  t("Payment methods are left to Stripe's settings (wallets, Link, PayPal, Direct Debit)", !s.has("payment_method_types[0]"));
  t("Member and plan travel with the subscription", s.get("subscription_data[metadata][member_id]") === "501" && s.get("subscription_data[metadata][plan]") === "featured");
  t("Promo codes allowed; back to the account on success, pricing on cancel", s.get("allow_promotion_codes") === "true" && /account\/home\?upgraded=featured/.test(s.get("success_url")) && /pricing/.test(s.get("cancel_url")));
  t("Order page origin allowed (CORS)", r.headers.get("access-control-allow-origin") === "https://www.techdirectory.io");
  await run(req("/checkout", { plan: "featured", interval: "year", currency: "GBP", memberId: "501" }), e);
  t("Same member reuses the same Stripe customer", Object.keys(customers).length === 1); }

{ reset(); const e = env();
  const a = await run(req("/checkout", { plan: "growth", interval: "month", currency: "GBP", memberId: "501" }), e);
  const b = await run(req("/checkout", { plan: "featured", interval: "month", currency: "JPY", memberId: "501" }), e);
  const c = await run(req("/checkout", { plan: "featured", interval: "month", currency: "GBP", memberId: "" }), e);
  const d = await run(req("/checkout", { plan: "featured", interval: "month", currency: "GBP", memberId: "999" }), e);
  t("Unknown plan, currency or price refused before Stripe", a.status === 400 && b.status === 400 && !hit("/v1/checkout").length);
  t("Not signed in, or no such member: refused", c.status === 401 && d.status === 404); }

const completed = (member, plan, customer, status = "paid", id = "evt_1") => ({ id, type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: status, customer, metadata: { member_id: member, plan } } } });

{ reset(); const e = env(); await run(req("/checkout", { plan: "featured", interval: "month", currency: "GBP", memberId: "501" }), e);
  const r = await run(await signed(completed("501", "featured", "cus_1")), e); const j = await r.json();
  t("Card or wallet payment: member moved to Featured in the TD platform", members["501"].subscription_id === "2" && /501 -> featured/.test(j.action), JSON.stringify(j));
  await run(await signed(completed("501", "featured", "cus_1")), e);
  t("Stripe sends the event twice: acted on once", hit("/api/v2/user/update").length === 1); }

{ reset(); const e = env(); await run(req("/checkout", { plan: "featured", interval: "month", currency: "GBP", memberId: "501" }), e);
  await run(await signed(completed("501", "featured", "cus_1", "unpaid", "evt_dd")), e);
  t("Direct Debit not cleared yet: plan not changed", members["501"].subscription_id === "1");
  await run(await signed({ id: "evt_dd2", type: "checkout.session.async_payment_succeeded", data: { object: { customer: "cus_1", metadata: { member_id: "501", plan: "featured" } } } }), e);
  t("Direct Debit clears: member moved to Featured", members["501"].subscription_id === "2"); }

{ reset(); const e = env(); await run(req("/checkout", { plan: "featured", interval: "month", currency: "GBP", memberId: "501" }), e);
  const r = await run(await signed(completed("502", "featured", "cus_1", "paid", "evt_x")), e); const j = await r.json();
  t("Member ID edited to someone else: nobody's plan changes", members["502"].subscription_id === "1" && /does not match/.test(j.action), JSON.stringify(j)); }

{ reset(); const e = env(); await run(req("/checkout", { plan: "featured", interval: "month", currency: "GBP", memberId: "501" }), e);
  await run(await signed(completed("501", "featured", "cus_1", "paid", "evt_a")), e);
  const sub = (status, id, price = "price_p_m_gbp") => ({ id, type: "customer.subscription.updated", data: { object: { status, customer: "cus_1", metadata: { member_id: "501", plan: "featured" }, items: { data: [{ price: { id: price } }] } } } });
  await run(await signed(sub("active", "evt_b")), e);
  t("Upgrade in the portal (Featured to Premium): plan follows the price", members["501"].subscription_id === "3");
  await run(await signed(sub("past_due", "evt_c")), e);
  t("Renewal failed, Stripe retrying: member keeps the plan meanwhile", members["501"].subscription_id === "3");
  await run(await signed({ id: "evt_d", type: "customer.subscription.deleted", data: { object: { customer: "cus_1", metadata: { member_id: "501" } } } }), e);
  t("Cancelled or retries used up: back to Basic", members["501"].subscription_id === "1"); }

{ reset(); const e = env(); await run(req("/checkout", { plan: "featured", interval: "month", currency: "GBP", memberId: "501" }), e); tdDown = true;
  const r = await run(await signed(completed("501", "featured", "cus_1", "paid", "evt_down")), e);
  t("TD platform down: Stripe is told to retry later (event not marked done)", r.status === 500 && !(await e.BILLING.get("evt:evt_down")));
  tdDown = false; await run(await signed(completed("501", "featured", "cus_1", "paid", "evt_down")), e);
  t("Stripe's retry then succeeds", members["501"].subscription_id === "2"); }

{ reset(); const e = env(); const bad = await signed(completed("501", "featured", "cus_1"));
  const tampered = new Request(bad.url, { method: "POST", body: (await bad.text()).replace("featured", "premium"), headers: bad.headers });
  const old = await signed(completed("501", "featured", "cus_1"), -600);
  t("Tampered or replayed webhook refused", (await run(tampered, e)).status === 400 && (await run(old, e)).status === 400 && !hit("user/update").length); }

{ reset(); const r = await run(new Request("https://billing.techdirectory.io/manage"), env());
  t("'Manage billing' goes to Stripe's customer portal (update card, invoices, cancel)", r.status === 302 && r.headers.get("location").startsWith("https://billing.stripe.com/")); }

{ reset(); const store = (v) => ({ get: async () => v });
  const e = env({ STRIPE_SECRET_KEY: store("rk_test"), STRIPE_BILLING_WEBHOOK_SECRET: store(SECRET), TD_API_KEY: store("td") });
  const r = await run(req("/checkout", { plan: "featured", interval: "month", currency: "USD", memberId: "501" }), e);
  t("Keys from Cloudflare's Secrets Store work", r.status === 200); }

const w = Math.max(...results.map(([n]) => n.length)); let f = 0;
for (const [n, ok_, d] of results) { if (!ok_) f++; console.log(`${ok_ ? "PASS" : "FAIL"}  ${n.padEnd(w)}  ${ok_ ? "" : d}`); }
console.log(`\n${results.length - f} of ${results.length} checks passed`); process.exit(f ? 1 : 0);
