# ⚡ iRunGas v3.1

**Cooking gas, delivered fast. The smart way.**

Production-ready landing page with full waitlist collection, real brand logo, Framer Motion spring animations, and hardened Supabase security. Built with vanilla HTML / CSS / JS and Supabase. No build step. No framework. Just open `index.html`.

---

## What's in v3.1

| # | Change | Files |
|---|---|---|
| 1 | **Real brand logo** — PNG extracted from SVG, embedded as inline base64. Replaces placeholder SVG flame icon in nav, footer, and favicon. | `index.html`, `style.css` |
| 2 | **Security fix — SECURITY INVOKER views** — All three analytics views (`waitlist_summary`, `signups_by_lga`, `daily_signups`) recreated with `WITH (security_invoker = true)` to respect RLS. `REVOKE` from `anon` / `PUBLIC`, `GRANT SELECT` to `authenticated` only. | `supabase/schema.sql` |
| 3 | **Framer Motion animations** — New `motion.js` file uses the Motion for the Web (Framer) API: 13 animation systems including spring hero entrance, scroll-triggered reveals via `inView`, hover spring interactions, scroll progress bar, counter animations, and mobile menu morph. Replaces all CSS keyframe and transition-based animations. | `motion.js`, `style.css` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS (ES2020) |
| Font | Poppins (Google Fonts) |
| Animations | **Motion for the Web v11** (Framer Motion API) |
| Backend / DB | Supabase (PostgreSQL 15) |
| Auth | Supabase Row Level Security |
| Hosting | GitHub Pages · Netlify · Vercel (zero-config) |

---

## Project Structure

```
irungas/
├── index.html           Main landing page (logo, Motion CDN, motion.js script)
├── style.css            Design system — initial animation states only (Motion owns transitions)
├── main.js              UI, validation, sanitisation, rate limiting (unchanged)
├── motion.js            Framer Motion for the Web — all spring animations
├── supabase.js          Supabase client + typed DB helpers (unchanged)
├── supabase/
│   └── schema.sql       DB tables, RLS, SECURITY INVOKER analytics views
├── .env.example         Environment variable template
├── .gitignore
└── README.md
```

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/irungas.git
cd irungas
```

### 2. Set up Supabase

1. Sign up at [supabase.com](https://supabase.com) → create a new project
2. Go to **SQL Editor → New Query**, paste all of `supabase/schema.sql`, click **Run**
3. Go to **Settings → API** and copy:
   - **Project URL** — `https://abcdefgh.supabase.co`
   - **anon / public key** — starts with `eyJ…`

### 3. Add credentials

Edit `supabase.js` lines 20–21:

```js
const SUPABASE_URL      = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

> **For production with a bundler (Vite / Parcel):**
> ```bash
> cp .env.example .env
> # Fill in real values — never commit .env
> ```
> Then reference `import.meta.env.VITE_SUPABASE_URL` etc.

### 4. Open

```bash
# No build needed:
open index.html

# Or serve locally (recommended — avoids CORS issues):
npx serve .
# or:
python3 -m http.server 3000
```

---

## Database Schema

### Tables

#### `waitlist_consumers`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | — | Auto PK |
| `first_name` | TEXT | ✓ | 1–60 chars |
| `last_name` | TEXT | ✓ | 1–60 chars |
| `email` | TEXT | ✓ | Unique · RFC regex |
| `phone` | TEXT | | Optional · 7–20 chars |
| `lga` | TEXT | ✓ | Lagos LGA |
| `cylinder_size` | TEXT | | 3kg / 5kg / 12.5kg / 25kg |
| `source` | TEXT | — | Default `landing_page` |
| `created_at` | TIMESTAMPTZ | — | Auto |

#### `waitlist_suppliers`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | — | Auto PK |
| `first_name` | TEXT | ✓ | |
| `last_name` | TEXT | ✓ | |
| `email` | TEXT | ✓ | Unique |
| `phone` | TEXT | ✓ | |
| `business_name` | TEXT | ✓ | 2–120 chars |
| `lga` | TEXT | ✓ | |
| `nmdpra_number` | TEXT | | Optional |
| `monthly_volume` | TEXT | | Optional |
| `source` | TEXT | — | Default `landing_page` |
| `created_at` | TIMESTAMPTZ | — | Auto |

### Row Level Security

| Role | consumers | suppliers |
|---|---|---|
| `anon` (landing page) | INSERT ✓ | INSERT ✓ |
| `anon` | SELECT ✗ | SELECT ✗ |
| `authenticated` (admin) | SELECT ✓ | SELECT ✓ |

### Analytics Views

All three views are secured with `WITH (security_invoker = true)` — they run as the **calling role**, so RLS on the underlying tables is always enforced.

```sql
-- Admin only (authenticated role required)
SELECT * FROM public.waitlist_summary;   -- consumer + supplier totals
SELECT * FROM public.signups_by_lga;    -- breakdown by LGA
SELECT * FROM public.daily_signups;     -- daily trend (Africa/Lagos TZ)
```

> **Important:** Querying these views with the `anon` key will return 0 rows — this is correct and expected. They are intentionally restricted to authenticated admin sessions.

---

## Security

### View Security (v3.1 fix)

Prior to v3.1, all three analytics views defaulted to `SECURITY DEFINER` — they ran with the `postgres` superuser's privileges, bypassing RLS entirely. Any unauthenticated request could read waitlist counts.

**Fix applied in `supabase/schema.sql`:**

```sql
-- BEFORE (insecure — SECURITY DEFINER default)
CREATE OR REPLACE VIEW public.waitlist_summary AS SELECT ...

-- AFTER (SECURITY INVOKER — RLS always enforced)
CREATE VIEW public.waitlist_summary
  WITH (security_invoker = true)
AS SELECT ...

-- Defence-in-depth: explicit privilege control
REVOKE ALL ON public.waitlist_summary FROM PUBLIC;
REVOKE ALL ON public.waitlist_summary FROM anon;
GRANT SELECT ON public.waitlist_summary TO authenticated;
```

The same pattern is applied to `signups_by_lga` and `daily_signups`.

**To apply to an existing database:**

Run `supabase/schema.sql` again — it is fully idempotent. The `DROP VIEW IF EXISTS` statements handle the recreation safely. No data is affected.

**To verify the fix after applying:**

```sql
-- Should return 0 rows (anon has no view access)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('waitlist_summary', 'signups_by_lga', 'daily_signups')
  AND grantee = 'anon';

-- Should return 3 rows with privilege_type = 'SELECT'
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('waitlist_summary', 'signups_by_lga', 'daily_signups')
  AND grantee = 'authenticated';
```

### Input Validation (`main.js`)

- Name fields: letters, hyphens, apostrophes only · 1–60 chars
- Email: RFC-compliant regex · max 254 chars
- Phone: digits, `+`, `-`, `()` only · 7–20 chars
- First invalid field receives focus automatically on submit

### Input Sanitisation (`main.js → sanitise()`)

- HTML tags stripped
- Control characters removed
- Internal whitespace collapsed
- Hard cap at 512 chars
- Email forced to lowercase

### Rate Limiting (`main.js`)

- **60 seconds** minimum between submissions
- **3 attempts** max per rolling 60-minute window
- State in `localStorage`
- Live countdown shown to user

### Database (`supabase/schema.sql`)

- `CHECK` constraints on all text fields
- Email validated with PostgreSQL regex
- `UNIQUE` on email prevents duplicate signups
- No anon `SELECT` — users cannot read other people's data

---

## Animations (`motion.js`)

All animations use the **Framer Motion for the Web** API (Motion v11), loaded from CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/motion@11/dist/motion.js"></script>
```

### Animation systems

| System | API used | Description |
|---|---|---|
| Hero entrance | `animate` + `stagger` | Badge, heading, body, CTAs cascade in with spring physics |
| Mockup card | `animate` | Spring pop-in from `scale(0.88)` |
| Floating chips | `animate` (chained) | Spring entrance → infinite float loop |
| Scroll reveals | `inView` + `animate` | Vertical, left, right slide-ins with spring |
| Stagger grids | `inView` + `stagger` | LGA cards, feature cards stagger in on scroll |
| Hover — cards | `mouseenter/leave` | `scale` + `y` spring on feature, stat, LGA cards |
| Hover — buttons | `mouseenter/leave/down/up` | Scale + lift + press-depth spring on all CTAs |
| Counter animation | `inView` + `rAF` | Stat numbers count up from 0 on scroll entry |
| Mobile menu | `MutationObserver` + `animate` | `clipPath` + spring slide on open/close |
| Hamburger → X | `MutationObserver` + `animate` | Lines rotate/fade to X with spring |
| Form success | `MutationObserver` + `animate` | Scale + fade spring entrance on signup success |
| Scroll progress | `scroll` | Orange progress bar at top of page |
| GPS graphic | `animate` (Infinity) | Moving dot + pulse ring on tracking feature card |

### Spring presets used

```js
springSnappy  = { stiffness: 400, damping: 30 }  // buttons, nav
springBouncy  = { stiffness: 300, damping: 20 }  // icons, step numbers
springSmooth  = { stiffness: 180, damping: 22 }  // section reveals
springGentle  = { stiffness: 120, damping: 20 }  // wordmark, hero copy
```

### Reduced motion

Both `style.css` and `motion.js` check `prefers-reduced-motion: reduce`. If the user has this preference:

- CSS: all `.reveal`, `.fade-in`, `.stagger` elements are shown immediately (`opacity:1; transform:none`)
- JS: `motion.js` returns early — no animations run at all

---

## Deployment

### GitHub Pages (free, zero-config)

```bash
git init
git add .
git commit -m "🚀 Launch iRunGas v3.1"
git remote add origin https://github.com/YOUR_USERNAME/irungas.git
git push -u origin main
```

Then: **GitHub → Settings → Pages → Source: Deploy from branch → `main` / `/(root)`**

Live at: `https://YOUR_USERNAME.github.io/irungas/`

### Netlify (drag & drop)

Drag the project folder onto [app.netlify.com/drop](https://app.netlify.com/drop). Live in seconds.

### Vercel (CLI)

```bash
npx vercel
```

---

## Colour Palette

| Token | Hex | Role |
|---|---|---|
| `--fire` | `#E8400C` | Brand / primary CTA |
| `--fire-hov` | `#C93408` | Button hover |
| `--fire-pale` | `#FEF1EC` | Tint backgrounds |
| `--char` | `#111318` | Primary text |
| `--sand` | `#F7F3EE` | Alternate section bg |
| `--green` | `#1D7A55` | Trust / verified only |
| `--mid` | `#6B7280` | Secondary text |
| `--line` | `#E4E4E4` | Borders, dividers |

---

## Customisation

**Change LGA options** — edit the `<option>` lists inside `#form-consumer` and `#form-supplier` in `index.html`.

**Change colours** — edit CSS variables in `style.css` `:root {}`.

**Disable animations** — remove the `<script src="motion.js"></script>` tag from `index.html`. The CSS initial states (`opacity:0`) will stay permanently visible — also remove the `.fade-in`, `.reveal`, `.stagger` classes from elements in `index.html`, or add this to `style.css`:

```css
.reveal, .reveal-l, .reveal-r, .stagger > *, .fade-in {
  opacity: 1 !important;
  transform: none !important;
}
```

**Add email notifications** — set up a Supabase Database Webhook on `INSERT` for both tables, pointing to a Zapier / Make.com flow.

**Admin dashboard** — query the analytics views using the Supabase Dashboard Table Editor, or build a protected admin page that signs in with `supabase.auth.signInWithPassword()` before calling the views.

---

## Changelog

### v3.1 (March 2026)
- **Logo:** Real iRunGas brand PNG extracted from SVG — nav, footer, favicon updated
- **Security:** `waitlist_summary`, `signups_by_lga`, `daily_signups` views recreated with `SECURITY INVOKER`; explicit `REVOKE`/`GRANT` privilege control added
- **Animations:** Added `motion.js` (Framer Motion for the Web v11) — 13 animation systems; removed conflicting CSS keyframes/transitions

### v3.0 (March 2026)
- Initial production landing page
- Dual waitlist forms (consumer + supplier)
- Supabase integration with RLS
- Client-side validation, sanitisation, rate limiting

---

© 2026 iRunGas Technologies Ltd. · Lagos, Nigeria
