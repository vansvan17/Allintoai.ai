# ALLXAI beta: login, request, recommendation

Milestone 2 of the beta UI plug-ins. Adds working accounts, the request form and the rule-based recommendation to the existing MVP. Existing pages (index, app, loading) are untouched; `login.html` keeps its layout and left panel, only the form and script changed.

## Files

| File | What it is |
| --- | --- |
| `login.html` | Sign in / create account, Users / Team / Enterprise, password reset |
| `request.html` | Request form, free-try check, list of past requests |
| `result.html` | Model pick, model combination, savings / ROI / time estimates |
| `beta/config.js` | Supabase URL and anon key (empty = local preview mode) |
| `beta/data.js` | Auth and data calls, Supabase or local preview |
| `beta/recommender.js` | Model table, categories, estimate assumptions, rules |
| `beta/ui.js`, `beta/beta.css` | Shared header and styles |
| `plans.html` | Plans: Users, Team, Enterprise, Pay as you go; records the chosen plan |
| `businesses.html` | Businesses on ALL×AI: listed businesses with ops accuracy, no models |
| `valued.html` | Who we value at ALL×AI, the ranked list |
| `index.html` | Homepage fixes: brand line, Pricing and Who we value links, Get Started goes to sign-up, pricing anchor, use cases, hidden testimonials section |
| `supabase/schema.sql` | Tables, row level security, free-try limit, plan choices, listings |

## Supabase setup (about 10 minutes)

1. Create a free project at supabase.com, ideally in Chandan's account so he owns the data.
2. SQL Editor > New query > paste `supabase/schema.sql` > Run.
3. Authentication > URL Configuration: set Site URL to `https://allxaiapp.com` and add `https://allxaiapp.com/login.html` to Redirect URLs.
4. Authentication > Sign In / Providers > Email: leave "Confirm email" on. Users get a confirmation link, then sign in.
5. Project Settings > API: copy the Project URL and the anon public key into `beta/config.js`.
6. Commit and push. GitHub Pages serves it as before.

Supabase's built-in email sender is rate limited and meant for testing. Before real users sign up in numbers, add SMTP under Authentication > Emails.

## How the pieces behave

- Account type and business name are saved on sign-up through a database trigger. Users can't change their plan or account type from the browser.
- Each request is readable only by the account that created it (row level security).
- Free plan accounts get one request. The limit is enforced in the database, not only in the page. To give an account more, set `plan` on its row in `profiles` (Table Editor) to `users`, `team`, `enterprise` or `payg`.
- Choosing a plan adds a row to `plan_choices`. Nothing is charged. To activate, set `plan` on the user's `profiles` row, which also lifts the free-try limit.
- Businesses page: add rows to `listings` in the Table Editor (name, sector, ops accuracy, sort order). Only add businesses that agreed to be listed. There is no model column, by design.
- After sign-in, users land on the businesses page, then go on to a request.
- Testimonials: add entries to `TESTIMONIALS` near the bottom of `index.html`. The section stays hidden while the list is empty.
- The result is stored with the request, so an old result keeps showing what the user saw even after the model table changes.

## Before going public

Pay as you go shows "Price on request" until the rate is set in the `PLANS` list at the top of the script in `plans.html`.


`beta/recommender.js` ships with placeholder models (Model A to E) and example ratings, and the result page shows a "Sample ratings" tag while `SAMPLE_DATA = true`. Replace `MODELS` with the approved list, check `CATEGORIES` minutes and `ASSUMPTIONS`, then set `SAMPLE_DATA = false`.

## Local preview

With `beta/config.js` empty, everything runs in the browser using localStorage and a yellow bar says so. Useful for review before Supabase exists. Do not ship to production in this mode.

```
python3 -m http.server 8000
# open http://localhost:8000/login.html
```
