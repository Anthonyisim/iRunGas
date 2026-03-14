# ⚡ iRunGas v3

**Cooking gas, delivered fast. The smart way.**

Production-ready landing page with full waitlist collection, built with vanilla HTML / CSS / JS and Supabase. No build step. No framework. Just open `index.html`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS (ES2020) |
| Font | Poppins (Google Fonts) |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Row Level Security (anon insert only) |
| Hosting | GitHub Pages · Netlify · Vercel (all zero-config) |

---

## Project Structure

```
irungas/
├── index.html           Main landing page
├── style.css            Full design system (Poppins, white base)
├── main.js              UI, validation, sanitisation, rate limiting
├── supabase.js          Supabase client + typed DB helpers
├── supabase/
│   └── schema.sql       DB tables, RLS policies, analytics views
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

### 2. Create Supabase database

1. Sign up at [supabase.com](https://supabase.com) → create a new project
2. Open **SQL Editor → New Query**, paste the contents of `supabase/schema.sql`, click **Run**
3. Go to **Settings → API** and copy:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public key** — starts with `eyJ…`

### 3. Add credentials

Edit `supabase.js`:

```js
const SUPABASE_URL      = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

> For production with a bundler (Vite / Parcel), use `.env`:
> ```bash
> cp .env.example .env
> # Edit .env — never commit this file
> ```
> Then reference `import.meta.env.VITE_SUPABASE_URL` etc.

### 4. Open

```bash
# No build needed:
open index.html

# Or serve locally:
npx serve .
# or:
python3 -m http.server 3000
```

---

## Database Tables

### `waitlist_consumers`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | — | Auto PK |
| `first_name` | TEXT | ✓ | Max 60 chars |
| `last_name` | TEXT | ✓ | Max 60 chars |
| `email` | TEXT | ✓ | Unique |
| `phone` | TEXT | | Optional |
| `lga` | TEXT | ✓ | Lagos LGA |
| `cylinder_size` | TEXT | | 3kg / 5kg / 12.5kg / 25kg |
| `source` | TEXT | — | Default `landing_page` |
| `created_at` | TIMESTAMPTZ | — | Auto |

### `waitlist_suppliers`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | — | Auto PK |
| `first_name` | TEXT | ✓ | |
| `last_name` | TEXT | ✓ | |
| `email` | TEXT | ✓ | Unique |
| `phone` | TEXT | ✓ | |
| `business_name` | TEXT | ✓ | |
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

---

## Security

### Input validation (client-side `main.js`)
- Name fields: letters, hyphens, apostrophes only · 1–60 chars
- Email: RFC-compliant regex · max 254 chars
- Phone: digits, `+`, `-`, `()` only · 7–20 chars
- All optional fields validated if filled
- First invalid field receives focus automatically

### Input sanitisation (`main.js` → `sanitise()`)
- HTML tags stripped (`<[^>]*>` regex)
- Control characters removed
- Internal whitespace collapsed
- Hard length cap at 512 chars
- Email forced to lowercase

### Rate limiting (client-side, `main.js`)
- **60 seconds** minimum between submissions
- **3 attempts** max per rolling 60-minute window
- State persisted in `localStorage`
- Live countdown displayed to user

### Database-level (Supabase `schema.sql`)
- `CHECK` constraints on all text fields (length + format)
- Email validated with PostgreSQL regex
- `UNIQUE` on email prevents duplicates
- No anonymous SELECT policy — users cannot read others' data

---

## Viewing Signups

In Supabase Dashboard → **Table Editor** select either table, or run:

```sql
-- Summary
SELECT * FROM public.waitlist_summary;

-- By LGA
SELECT * FROM public.signups_by_lga;

-- Daily trend
SELECT * FROM public.daily_signups;
```

---

## Deployment

### GitHub Pages (free, zero-config)

```bash
git init
git add .
git commit -m "🚀 Launch iRunGas v3"
git remote add origin https://github.com/YOUR_USERNAME/irungas.git
git push -u origin main
```

Then: **GitHub → Settings → Pages → Deploy from branch → `main` / `/(root)`**

Live at: `https://YOUR_USERNAME.github.io/irungas/`

### Netlify

Drag the project folder onto [app.netlify.com/drop](https://app.netlify.com/drop). Live in 10 seconds.

### Vercel

```bash
npx vercel
```

---

## Colour Palette

| Token | Hex | Role |
|---|---|---|
| `--fire` | `#E8400C` | Brand / primary CTA |
| `--fire-hov` | `#C93408` | Hover state |
| `--fire-pale` | `#FEF1EC` | Tint backgrounds |
| `--char` | `#111318` | Primary text |
| `--sand` | `#F7F3EE` | Alternate section bg |
| `--green` | `#1D7A55` | Trust / verified only |
| `--mid` | `#6B7280` | Secondary text |
| `--line` | `#E4E4E4` | Borders, dividers |

---

## Customisation

**Change LGA options** — edit the `<option>` lists inside `#form-consumer` and `#form-supplier` in `index.html`.

**Change colours** — edit CSS variables at the top of `style.css`.

**Add email notifications** — set up a Supabase Database Webhook on `INSERT` for both tables, pointing to a Zapier/Make.com flow that sends email to `chigazor@gmail.com`.

---

© 2026 iRunGas Technologies Ltd. · Lagos, Nigeria
