# Meta descriptions: new wording (T11, from Bing's report of 30 October 2026)

Bing Webmaster Tools found **978 pages** whose meta descriptions are too short. Almost all come from a handful of
platform templates (company profiles, articles, search results) plus a few fixed pages. Fixing the templates fixes
every page built from them, including the 725,000 company profiles.

Generated and checked by `scripts/t11/meta_descriptions.py` (every template expanded with short and long sample values;
lengths shown are short / long sample). Search engines show about 150–160 characters; a little over is fine.

**Also in the same change:** empty the *Meta Keywords* box on every template. Google ignores the tag and Bing treats
stuffed keywords as a spam signal; the current templates repeat the company name and category up to 7 times.

## Before (live, 30 October)

| Page | Now | Length |
| --- | --- | --- |
| Company profile | Connect with FCG, Security Technology in . Find FCG reviews and more. | 69 |
| Article | Member Article posted by E2E Technologies on TechDirectory. | 59 |
| Country results | Search our Japan Tech Directory database and connect with top rated Technology Businesses in Japan. | 99 |
| /login | Login to your account on TechDirectory | 38 |
| /events | (none) | 0 |

Profiles with no city show "in ."; the new profile wording leaves location out of the description (it is in the title and on the page), so it always reads cleanly.

## SEO Templates (My Content → SEO Templates → Edit → Meta Description)

| ID | Template | New meta description | Length | Example |
| --- | --- | --- | --- | --- |
| 100 | Member Profile - Main Listing | `%%%Full_name%%% (%Profession_name%) on TechDirectory: see its services, location, contact details and reviews, and compare similar technology companies.` | 131 / 175 | FCG (Software) on TechDirectory: see its services, location, contact details and reviews, and compare similar technology companies. |
| 101 | Member Profile - Contact Form | `Contact %%%Full_name%%% (%Profession_name%) through TechDirectory: send a message or project details and get a reply by email. See its profile and reviews first.` | 140 / 184 | Contact FCG (Software) through TechDirectory: send a message or project details and get a reply by email. See its profile and reviews first. |
| 102 | Member Profile - Write a Review | `Write a review of %%%Full_name%%% (%Profession_name%) on TechDirectory. Share your experience to help other businesses choose the right technology provider.` | 135 / 179 | Write a review of FCG (Software) on TechDirectory. Share your experience to help other businesses choose the right technology provider. |
| 103 | Member Profile - View Review | `Read a customer review of %%%Full_name%%% (%Profession_name%) on TechDirectory, then see the company's profile, services and other reviews.` | 118 / 162 | Read a customer review of FCG (Software) on TechDirectory, then see the company's profile, services and other reviews. |
| 200 | Search Results - Members - Default | `Find and compare %%Profession%% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 126 / 126 | Find and compare Technology Businesses on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 201 | Search Results - Members - Main Category Only | `Find and compare %%Profession_name%% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 123 / 137 | Find and compare Software Companies on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 202 | Search Results - Members - Sub Category Only | `Find and compare %Service_name% providers on TechDirectory: company profiles, services, reviews and contact details in one place.` | 118 / 136 | Find and compare SEO providers on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 203 | Search Results - Members - Main / Sub Category | `Find and compare %%Profession_name%% offering %Service_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 136 / 168 | Find and compare Software Companies offering SEO on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 204 | Search Results - Members - Country Only | `Find and compare %%Profession%% in %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 135 / 143 | Find and compare Technology Businesses in Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 205 | Search Results - Members - Country / Main | `Find and compare %%Profession_name%% in %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 132 / 154 | Find and compare Software Companies in Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 206 | Search Results - Members - Country / Sub | `Find and compare %Service_name% providers in %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 127 / 153 | Find and compare SEO providers in Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 207 | Search Results - Members - Country / Main / Sub | `Find and compare %%Profession_name%% offering %Service_name% in %Country_name% on TechDirectory, with profiles, reviews and contact details.` | 119 / 159 | Find and compare Software Companies offering SEO in Japan on TechDirectory, with profiles, reviews and contact details. |
| 208 | Search Results - Members - Country / State | `Find and compare %%Profession%% in %State_name%, %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 142 / 155 | Find and compare Technology Businesses in Texas, Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 209 | Search Results - Members - Country / State / Main | `Find and compare %%Profession_name%% in %State_name%, %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 139 / 166 | Find and compare Software Companies in Texas, Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 210 | Search Results - Members - Country / State / Sub | `Find and compare %Service_name% providers in %State_name%, %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 134 / 165 | Find and compare SEO providers in Texas, Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 211 | Search Results - Members - Country / State / Main / Sub | `Find and compare %%Profession_name%% offering %Service_name% in %State_name%, %Country_name% on TechDirectory, with profiles, reviews and contact details.` | 126 / 171 | Find and compare Software Companies offering SEO in Texas, Japan on TechDirectory, with profiles, reviews and contact details. |
| 212 | Search Results - Members - Country / City | `Find and compare %%Profession%% in %City_name%, %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 142 / 158 | Find and compare Technology Businesses in Leeds, Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 213 | Search Results - Members - Country / City / Main | `Find and compare %%Profession_name%% in %City_name%, %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 139 / 169 | Find and compare Software Companies in Leeds, Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 214 | Search Results - Members - Country / City / Sub | `Find and compare %Service_name% providers in %City_name%, %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 134 / 168 | Find and compare SEO providers in Leeds, Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 215 | Search Results - Members - Country / City / Main / Sub | `Find and compare %%Profession_name%% offering %Service_name% in %City_name%, %Country_name% on TechDirectory, with profiles, reviews and contact details.` | 126 / 174 | Find and compare Software Companies offering SEO in Leeds, Japan on TechDirectory, with profiles, reviews and contact details. |
| 216 | Search Results - Members - Country / State / City | `Find and compare %%Profession%% in %City_name%, %State_name%, %Country_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 149 / 170 | Find and compare Technology Businesses in Leeds, Texas, Japan on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 217 | Search Results - Members - Country / State / City / Main | `Find and compare %%Profession_name%% in %City_name%, %State_name%, %Country_name% on TechDirectory, with profiles, reviews and contact details.` | 120 / 155 | Find and compare Software Companies in Leeds, Texas, Japan on TechDirectory, with profiles, reviews and contact details. |
| 218 | Search Results - Members - Country / State / City / Sub | `Find and compare %Service_name% providers in %City_name%, %State_name%, %Country_name% on TechDirectory, with profiles, reviews and contact details.` | 115 / 154 | Find and compare SEO providers in Leeds, Texas, Japan on TechDirectory, with profiles, reviews and contact details. |
| 219 | Search Results - Members - Country / State / City / Main / Sub | `Find and compare %%Profession_name%% offering %Service_name% in %City_name%, %State_name%, %Country_name% on TechDirectory, with profiles, reviews and contact details.` | 133 / 186 | Find and compare Software Companies offering SEO in Leeds, Texas, Japan on TechDirectory, with profiles, reviews and contact details. |
| 220 | Search Results - Members - State | `Find and compare %%Profession%% in %State_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 135 / 140 | Find and compare Technology Businesses in Texas on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 221 | Search Results - Members - State / Main | `Find and compare %%Profession_name%% in %State_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 132 / 151 | Find and compare Software Companies in Texas on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 222 | Search Results - Members - State / Sub | `Find and compare %Service_name% providers in %State_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 127 / 150 | Find and compare SEO providers in Texas on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 223 | Search Results - Members - State / Main / Sub | `Find and compare %%Profession_name%% offering %Service_name% in %State_name% on TechDirectory, with profiles, reviews and contact details.` | 119 / 156 | Find and compare Software Companies offering SEO in Texas on TechDirectory, with profiles, reviews and contact details. |
| 224 | Search Results - Members - State / City | `Find and compare %%Profession%% in %City_name%, %State_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 142 / 155 | Find and compare Technology Businesses in Leeds, Texas on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 225 | Search Results - Members - State / City / Main | `Find and compare %%Profession_name%% in %City_name%, %State_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 139 / 166 | Find and compare Software Companies in Leeds, Texas on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 226 | Search Results - Members - State / City / Sub | `Find and compare %Service_name% providers in %City_name%, %State_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 134 / 165 | Find and compare SEO providers in Leeds, Texas on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 227 | Search Results - Members - State / City / Main / Sub | `Find and compare %%Profession_name%% offering %Service_name% in %City_name%, %State_name% on TechDirectory, with profiles, reviews and contact details.` | 126 / 171 | Find and compare Software Companies offering SEO in Leeds, Texas on TechDirectory, with profiles, reviews and contact details. |
| 228 | Search Results - Members - City | `Find and compare %%Profession%% in %City_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 135 / 143 | Find and compare Technology Businesses in Leeds on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 229 | Search Results - Members - City / Main | `Find and compare %%Profession_name%% in %City_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 132 / 154 | Find and compare Software Companies in Leeds on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 230 | Search Results - Members - City / Sub | `Find and compare %Service_name% providers in %City_name% on TechDirectory: company profiles, services, reviews and contact details in one place.` | 127 / 153 | Find and compare SEO providers in Leeds on TechDirectory: company profiles, services, reviews and contact details in one place. |
| 231 | Search Results - Members - City / Main / Sub | `Find and compare %%Profession_name%% offering %Service_name% in %City_name% on TechDirectory, with profiles, reviews and contact details.` | 119 / 159 | Find and compare Software Companies offering SEO in Leeds on TechDirectory, with profiles, reviews and contact details. |
| 302 | Details Page - Post Details | `%%%Post_title%%% – a %Data_name% by %%%Full_name%%% on TechDirectory. Read it and see the author's company profile.` | 114 / 183 | What is hosted Exchange? – a Member Article by FCG on TechDirectory. Read it and see the author's company profile. |
| 400 | Billing - Checkout | `Choose your TechDirectory plan and check out securely. List your technology business, get found by buyers and manage your company profile from one dashboard.` | 157 / 157 | Choose your TechDirectory plan and check out securely. List your technology business, get found by buyers and manage your company profile from one dashboard. |
| 503 | Member reviews | `Customer reviews and ratings for %%%Full_name%%% (%Profession_name%) on TechDirectory. Read what clients say, then compare similar technology companies.` | 131 / 175 | Customer reviews and ratings for FCG (Software) on TechDirectory. Read what clients say, then compare similar technology companies. |

## Fixed pages (Web Page Builder → page → SEO → Meta Description)

| Page | New meta description | Length |
| --- | --- | --- |
| /about | About TechDirectory: the directory where businesses find, compare and contact technology companies worldwide. How it works, who it is for and how to get listed. | 160 |
| /about/contact | Contact TechDirectory by email for help with your listing, your account, advertising or partnerships. We reply within 1 working day; we don't take calls. | 153 |
| /about/terms | TechDirectory Terms of Use: the rules for using the site, listing a business, posting content and paying for plans and services. Please read before you sign up. | 160 |
| /about/privacy | TechDirectory Privacy Policy: what personal information we collect, why we use it, how long we keep it and how to use your data protection rights. | 146 |
| /login | Sign in to your TechDirectory account to manage your company profile, reply to enquiries and reviews, and see how buyers are finding your business. | 147 |
| /locations | Browse technology companies by country, state and city on TechDirectory. Find local software, IT, digital and tech service providers and compare their profiles. | 160 |
| /categories | Browse technology companies by category on TechDirectory: software, IT services, cloud, cybersecurity, digital marketing and more. Compare profiles and reviews. | 160 |
| /events | Technology events listed by companies on TechDirectory: conferences, webinars, launches and meetups. See dates, places and organisers, and add your own event. | 158 |
| /get-listed | List your technology business on TechDirectory for free. Choose a plan, create your company profile and get found by businesses searching for tech providers. | 157 |
| /join | Join TechDirectory and create a free profile for your technology company. Add your services, location and contact details so buyers can find and contact you. | 157 |
| /articles | Articles and company news from technology businesses on TechDirectory: guides, product updates and announcements. Read the latest and see each author's profile. | 160 |
| /blog | TechDirectory guides for technology buyers: how to choose providers, compare costs and plan projects, plus rankings of leading technology companies by sector. | 158 |
| /reviews | Read customer reviews of technology companies on TechDirectory. See ratings and feedback on software, IT and digital service providers before you hire. | 151 |
| /videos | Watch videos from technology companies on TechDirectory: product demos, explainers and company introductions. Find the business behind each video. | 146 |

## Change window steps

1. Back up: copy each template's current meta description and keywords into the build log (or export from the admin).
2. Paste the new wording template by template; empty Meta Keywords; save.
3. Check 5 live pages per type (profile with and without a city, article, country, city/category, fixed pages) with the page source.
4. In Bing Webmaster Tools → Recommendations, run the check again after Bing recrawls (days to weeks).
5. Undo: paste the old wording back from the build log.
