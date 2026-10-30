# T01 baseline: public site (30 October 2026)

Measured from the live site in a browser, signed out, around 00:40 UK time. Times are how long the page's HTML took to arrive, except where marked "full load". The browser pane was in the background, so full-load times are approximate; re-measure in the agreed change window.

## Site search (Build Scope 26.5)

Each query was run twice; the range covers both runs.

| Search | Time to results | Results |
| --- | --- | --- |
| "software development" | 5.2–5.4 s | 18 on the first page |
| "cyber security" | 5.9–6.0 s | 18 on the first page |
| "softwear developmnt" (misspelt) | 5.1 s | none |
| "zzqxv" (no match) | 4.3–4.4 s | none |
| "IT support", London | 0.9 s, after a 0.6 s redirect that adds `&google=` | results shown |
| "web design", New York | 0.9 s, after a 0.6 s redirect | results shown |

**Result:** keyword search across all listings takes about 5 seconds, well over the 1-second line, and misspellings return nothing. Build Scope 26.5 therefore adds B39 (hosted search index, about $30 a month, from the $1,500 cash stage). Spending needs the owner's approval.

## Key pages

| Page | HTML time | HTML size | Robots | Structured data |
| --- | --- | --- | --- | --- |
| Homepage `/` | 0.76 s first byte; full load about 8.2 s, 60 requests, about 1.8 MB | | index, follow | none valid |
| Pricing `/get-listed` | 0.43 s | 233 KB | index, follow | WebPage, WebSite/Organization |
| Categories `/categories` | 0.79 s | 991 KB | index, follow | WebPage, WebSite/Organization |
| Locations `/locations` | **17.5 s** | 1,078 KB | index, follow | WebPage, WebSite/Organization |
| Category `/artificial-intelligence` | 1.15 s | 371 KB | index, follow | WebSite/Organization |
| Sub-category `/artificial-intelligence/ai-business-analyst` | 1.16 s | 373 KB | index, follow | WebSite/Organization |
| Profile `/united-states/san-francisco/artificial-intelligence/sentient-ai` | 0.58 s | 452 KB | index, follow | LocalBusiness/ProfilePage, **NewsArticle**, WebSite/Organization |
| Reviews `/reviews` | 0.42 s | 268 KB | index, follow | WebSite/Organization |
| Blog `/blog` | 0.42 s | 332 KB | index, follow | WebSite/Organization |
| Videos `/videos` | 0.92 s | 283 KB | index, follow | WebSite/Organization |
| Events `/events` | 0.22 s, then a script redirect adding `?google=Technology+Business near+me` | | | |
| Login `/login` | 0.28 s | 259 KB | index, follow | WebPage, WebSite/Organization |
| Signup `/join` | redirects to `/get-listed` | | | |
| About `/about` | 0.27 s | 230 KB | index, follow | WebPage, WebSite/Organization |
| Contact `/contact` | 0.59 s | 256 KB | index, follow | LocalBusiness/ProfilePage, NewsArticle, WebSite/Organization |
| Checkout `/checkout` | redirects off-site (blocked from script); check signed in | | | |

## Homepage today

- H1 "Find Technology Companies"; menu: Home, Tech Companies, Advertise Your Company (/get-listed), Events, Reviews, Locations, Videos, Blog.
- Sections: Featured Businesses, Latest Blog Posts, Newest Members, Member Articles, newsletter signup. Several blog and member-article headlines are off-topic (car rental, plumbing, drug testing), matching Build Scope 4.2's reasons to remove those feeds.
- 10 ad slots (Google AdSense).
- Scripts loaded before any consent: Google Tag Manager, Google AdSense and ad-quality, Google Maps, Google Translate, optimizecdn.com.

## Profile page today (matches Build Scope 4.4.1)

- Buttons: Write a Review, Send Message, See Phone Number, Save, Get Directions, social links.
- Sections: Contact Information, Company Details, "Write About You And Your Company" (admin label showing publicly), Share This Page, Related Searches.
- Google Maps loads on every profile; the NewsArticle structured-data block is present; no badge image on this sample.

## Still to measure (needs the TD admin, Search Console, GA4 and Stripe)

Payers per plan and monthly revenue, Search Console indexed pages, clicks and top 50 landing pages, GA4 traffic by hour and weekday (to set the change window), and desktop and phone screenshots of 10 key pages with the pane in view.
