# T01 platform fit check and baseline: TD admin (30 October 2026)

Read in the TD admin, signed in by the owner, between 01:15 and 01:25 UK time. Nothing was changed. No member names, emails or exports are recorded here.

## Account and resources

| Item | Value | What it means for the build |
| --- | --- | --- |
| Platform build | 4.0; last update check 30 January 2026, updates waiting | Run the 12-point check after any platform update (1.1) |
| Members | 725,246 of a 1,000,000 limit | 940 more than the 724,306 audit figure; room for about 275,000 more |
| New members | 2 today, 1,122 in 7 days, 4,745 in 30 days | Confirms about 5,000 signups a month |
| Storage | 29.96 of 55 GB (54%) | Fine for now |
| **Bandwidth (October)** | **240.51 of 10 GB, 2,405% used** | **Urgent: owner to check with platform support whether overage is being charged or the site will be throttled.** The Website Bandwidth Boost add-on is not active |
| **Platform email limit** | **10,246 of 95,000 a month used** | **Build Scope 17.2 assumes up to 8,000 claim emails a day; the platform allows about 3,100 a day in total.** B03 must plan to this cap or send claims through another route |
| Website email | support@ address working | |
| Google Maps key | None entered, yet profiles still load the Maps script | Supports B12 (replace with free maps) |
| Lifetime revenue | $5,280.99; past due $2,559; upcoming $9 | See payers below |
| Moderation queue | 4,310 items: 4,205 form inquiries, 22 leads, 83 past due | Old inquiries need a decision before B47 (Inbox) |
| Interactions | 22,871 member leads, 680 member reviews | Lead and review history exists to migrate |

## Plans and payers

| Plan (ID) | Members | Revenue to date | Price on plan | Lead price | Search priority | Category limit |
| --- | --- | --- | --- | --- | --- | --- |
| Basic (3) | 724,395 | – | Free | $5 | 3 | 3 |
| Featured (2) | 52 | $2,481 | $29 / $290 | $10 | 2 | 5 |
| Premium (1) | 19 | $2,560 | $49 / $490 | $1 | 1 | 10 |
| Author – Blog Contributor (4) | 2 | $0 | $200 / $2,000 | – | 0 | 10 |

Three plans show "updated 29 October 2026".

**Subscriptions (27 in total, $5,041 generated):**

| Status | Plan and price | Count | Note |
| --- | --- | --- | --- |
| Active | Featured $9 a month (legacy price) | 3 | 2 paying on time; 1 with 11 payments past due |
| Active | Featured $20 a month (legacy price) | 2 | Both past due (1 and 37 payments) |
| Active | Premium $50 a year (legacy price) | 12 | All 12 past due (1–4 payments each) |
| Ended | Featured and Premium | 6 | |

**Paying on time today: 2 subscriptions at $9 a month, about $18 MRR.** The other 15 "active" subscriptions are past due. Legacy prices ($9, $20 a month; $50 a year) differ from the plan prices, so "Premium Legacy $49" in Build Scope 6.1 needs revisiting: existing payers sit at $50 a year and $9 or $20 a month.

**For the owner (not recorded here):** one paying Featured member is an online gambling site. Gambling is excluded from advertising (8.1) and from sponsored posts (28.1).

## Fit check (Build Scope 1.1 step 3)

| Assumed feature | Result | Evidence / workaround |
| --- | --- | --- |
| Custom member fields | Yes | Member forms (About, Additional Details, Contact Details) |
| Per-plan limits and search priority | **Yes** | Search priority, category limit and post permissions on each plan |
| Annual billing | **Yes** | Annual prices on every paid plan |
| Coupon codes | **Yes** | Coupon Codes page; Easy Coupon Codes add-on active |
| Reviews | **Yes** | 680 reviews; Reply to Member Reviews active; Star Ratings for Posts, Reviews with Photos inactive |
| Lead matching with per-plan lead prices | **Partly** | Leads and a lead price per plan exist; **Automatic Lead Matching** and **Lead Price by Category** add-ons are inactive. T21 either activates them (cost, needs owner) or matches through Make |
| Banner zones | To confirm | Google AdSense runs (10 slots on the homepage); banner manager not yet checked |
| Sponsored / featured placement | **Yes** | Feature Members and Members-Only Content active; Highlight Member Results, Pin Featured Posts inactive |
| Per-profile robots | Partly | Global `meta_robots` setting and Hidden Member Profiles add-on; per-profile noindex to confirm in B03/T14 |
| Custom head widgets | To confirm | Widget Manager list came back empty in this session; re-check |
| Cache clearing | **Yes** | "Refresh Live Site" |
| Webhooks | **Yes** | 33 events. **On: Sign Up (free), Sign Up (paid, on-site), Sign Up (paid, off-site)** — set up by another session; leave alone |
| API access | **Yes** | 2 keys exist ("TD email sync", "TechDirectory OpenAI Development", created 24 and 29 October); rate limits to confirm |
| 301 redirects | **Yes** | 57,819 rules; CSV import |
| robots.txt, .htaccess | **Yes** | Editable in Developer Hub |
| Database and hosting control panel | **Yes** | MySQL and cPanel access from Developer Hub (useful for backups and a search index) |
| Full restore point | **No** | 14-Day Website Backups add-on inactive. Backup comes from our own exports plus a database dump (owner approves) |
| Member data export | **Yes** | Export Member Data add-on active |
| Claim listings | **Yes** | Claimable Business Listings active |
| Teams / multiple users per account | **Yes** | Multi-Member Manager active (supports B53) |
| Affiliate tracking | **Yes** | Post Affiliate Pro Integration active (supports B50) |
| Multiple locations | **Yes** | Multi-Location Listings active |
| GDPR consent fields | **Yes** | Active |
| Member messaging | **Partly** | Contact forms and Forms Inbox; Private Member Chat inactive (B47) |
| Report a listing | **No** | Report This Page inactive (B07) |
| Languages | **Partly** | Google Website Translator only (loads before consent; B05 retires it). Translated interface to confirm for B33 |
| VAT | No | Tax & VAT Manager inactive; plan is fixed Stripe tax rates |
| Payment gateway | **Yes** | Stripe, active |
| Search speed | **Fails** | Keyword search about 5 s; Expanded Keyword Search, Insta-Load Search Results, Global Website Search inactive. B39 needed (26.5) |

## Existing content (Build Scope 29 register, first pass)

| Post type (ID) | URL | Posts | Build Scope plan |
| --- | --- | --- | --- |
| Member Article (15) | /articles | 3,173 | Change: approval first, becomes company announcements (T20) |
| Classified (6) | /classifieds | 1,679 | Change: becomes Apps & Tools (B19) |
| Video (13) | /videos | 652 | Keep: under Resources |
| Photo Album (10) | /photo-albums | 495 | Review: evidence needed |
| Product (11) | /products | 481 | Review: evidence needed |
| Event (8) | /events | 110 | Change: Events (B22) |
| Coupon (7) | /coupons | 97 | Change: perks (B19) |
| Blog Article (14) | /blog | 68 | Keep: Resources |
| Job Listing (9) | /jobs | 68 | Change: Opportunities (B20) |
| Audio File (5) | /audio-files | 22 | Review: retire candidate after evidence |
| Discussion (73) | /discussions | 0 | Review: retire candidate |
| Property (12) | /properties | 0 | Review: retire candidate |

Web pages: /home, /get-listed, /about, /about/contact, /about/privacy and /about/terms (both updated 28 October), /events-calendar, /getmatched ("Get Matched"), /login, /categories.

Email templates: 18 custom and 27 newsletter templates. **Not touched** — the newsletter session owns Brevo and newsletter templates. One saved template promotes a crypto film and a data-security report; crypto promotion is outside 21.1 if sent from TechDirectory.

Add-ons: 37 of 79 active. Active: 800+ Google Fonts Pack, Admin Activity Tracking, Admin Role Permissions, All-In-One SEO Pack, Bookmark Counter, Bookmark My Favorites, Claimable Business Listings, Community Comments, Detect Visitor Locations, Downloadable PDF Invoices, Easy Coupon Codes, Export Member Data, Express Member Signup, Feature Members, GDPR Consent Fields, Google Map Search Results, Google Search Assist, Google Sitemap Generator, Google Website Translator, Grid View Search Results, Hidden Member Profiles, Homepage Clickable Maps, Homepage Image Slider, Limit Posts per Member, Member Limit Boost, Member Profile Analytics, Member Profile Badges, Members-Only Content, Multi-Location Listings, Multi-Member Manager, Post Affiliate Pro Integration, Predictive Keyword Search, Reply to Member Reviews, Side-By-Side Pricing Plans, Simple Events Calendar, Spam Form Protector, Website Storage Boost.

## Still to do in T01

- Backup exports into the private Drive folder TD Backups/2026-10-30/ (needs the owner's go-ahead on method, below).
- Search Console, GA4 and Stripe baselines (each needs the owner's sign-in).
- Widget Manager, menus, forms, sidebars, SEO templates and banner zones for the register.
- Platform support: confirm whether a restore point exists and how long a restore takes; ask about the bandwidth overage.
- Held for owner approval: 4 test members and the rollback rehearsal (both change the live site).
