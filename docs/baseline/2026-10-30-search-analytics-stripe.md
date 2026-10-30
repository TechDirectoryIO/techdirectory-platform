# T01 baseline: Search Console, GA4 and Stripe (30 October 2026)

Read-only, around 02:15–02:30 UK time, in the owner's Chrome. Nothing was changed. No customer names or emails are recorded here.

## Accounts

| Tool | Where TechDirectory lives | Note |
| --- | --- | --- |
| Search Console | Google account slot 1 in Chrome (`/u/1/`), domain property `techdirectory.io` | The default Chrome account (TechBullion's) has no access to it |
| GA4 | Account "TechDirectory", property "TechDirectory - GA4", Google account slot 1 | |
| Stripe | Account "TechDirectory", **live mode**; balance and payouts in pounds, charges in dollars | No Stripe Billing subscriptions: the TD platform charges saved cards itself each month ("TechDirectory - Invoice #…") |

## Search Console (last 28 days unless stated)

| Measure | Value |
| --- | --- |
| Web search clicks | 293 (1,655 in the last 3 months) |
| Impressions | 22,200 |
| Average CTR | 1.3% |
| Average position | 30.4 |
| **Indexed pages** | **127,986** |
| **Not indexed pages** | **2,781,122** |
| Core Web Vitals | Desktop: 16 good, 236 poor URLs. Mobile: no data |
| Enhancements | Breadcrumbs 230 valid; Profile page 112 valid, 2 invalid; Review snippets 31 valid |
| Unread messages | 87 |

**Top landing pages by clicks:** `/` 208 (position 2.5); `/get-listed` 11; one Edmonton home-services profile 7; `/login` 6; a "kalyan-matka" profile 4 (an Indian gambling term, a spam listing ranking for it); a shipping profile 3. `/get-listed` and `/login` each get about 3,400 impressions at position 1 with almost no clicks. The homepage brings 71% of all search clicks.

**What it means:** organic search is small today (about 10 clicks a day). The 2.8 million not-indexed pages back Build Scope 5.3 (noindex thin pages) and 17.9 (non-tech records). The "AL11/AL12" alert baselines are 293 clicks and 127,986 indexed pages.

## GA4

| Measure | Value |
| --- | --- |
| Active users, last calendar year | 390,000 |
| Sessions, last calendar year | 547,000 |
| Views, last calendar year | 2.3 million |
| Active users in the last 30 minutes (02:20) | 16–17 |

**Sessions by channel, last 30 days:** Direct 40,000; Organic Search 1,700; Referral 618; Organic Social 45; AI Assistant 16; Email 1.

**Last 7 days by source:** direct 8,700; google organic 370; temp-mail.org referral 17.

**Top pages by views, last 30 days:** Profile 9,800; Home 8,000; Contact 6,200; Basic signup 5,800; pricing (`/get-listed`) 5,800; About 5,200.

**Top countries, last 30 days:** United States 22,000; Brazil 3,700; Colombia 2,100; Ecuador 1,200; Philippines 845; Venezuela 827; United Kingdom 737. Top cities in 7 days include Bogota, Sao Paulo, Quito and Guayaquil.

**What it means:** direct traffic is about 24 times organic search, signup and contact pages are among the most viewed, and visits from disposable-email sites appear. This pattern fits automated or spam signups. It supports B08 (Turnstile, disposable-email block) and B17 (signup risk scoring), and means the "about 5,000 signups a month" includes a share of spam that T03/B02 must measure before the conversion model is trusted.

**Traffic by hour and weekday** (to set the change window) needs a custom exploration, which would create an item in GA4; not done. The default window in Build Scope 1.1 stands (Tuesday–Thursday, 07:00–09:00 UK) until the owner wants it measured.

## Stripe (live)

| Month | Succeeded | Failed |
| --- | --- | --- |
| October 2026 (to 30th) | 3 payments: $9, $20, $9 = **$38** | 3 payments: $9 (insufficient funds), $20 (not allowed), $50 (invalid account) |
| September 2026 | $9, $20, $9 seen | $9, $20 failed |

Last payout: £6.19 on 22 October. Payments are platform invoices on saved cards, not Stripe Billing.

**What it means:** current recurring revenue is about **$38 a month**, matching the admin's 2–3 subscriptions paying on time. Build Scope 6.3 plans Stripe products and prices; because recurring billing runs inside the TD platform, T06 must confirm whether new plan prices are set in the TD admin (most likely) rather than as Stripe Billing products, and how GBP and EUR prices (B32) are charged when the platform bills.
