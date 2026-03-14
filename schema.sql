-- ══════════════════════════════════════════════════════════════════
-- iRunGas — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABLE: waitlist_consumers ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist_consumers (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name     TEXT         NOT NULL     CHECK (length(trim(first_name)) BETWEEN 1 AND 60),
  last_name      TEXT         NOT NULL     CHECK (length(trim(last_name))  BETWEEN 1 AND 60),
  email          TEXT         NOT NULL     CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  phone          TEXT                      CHECK (phone IS NULL OR length(phone) BETWEEN 7 AND 20),
  lga            TEXT         NOT NULL,
  cylinder_size  TEXT,
  source         TEXT         NOT NULL     DEFAULT 'landing_page',
  created_at     TIMESTAMPTZ  NOT NULL     DEFAULT NOW(),

  CONSTRAINT uq_consumers_email UNIQUE (email)
);

-- ── TABLE: waitlist_suppliers ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist_suppliers (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name      TEXT         NOT NULL     CHECK (length(trim(first_name))     BETWEEN 1 AND 60),
  last_name       TEXT         NOT NULL     CHECK (length(trim(last_name))      BETWEEN 1 AND 60),
  email           TEXT         NOT NULL     CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  phone           TEXT         NOT NULL     CHECK (length(phone) BETWEEN 7 AND 20),
  business_name   TEXT         NOT NULL     CHECK (length(trim(business_name))  BETWEEN 2 AND 120),
  lga             TEXT         NOT NULL,
  nmdpra_number   TEXT                      CHECK (nmdpra_number IS NULL OR length(nmdpra_number) BETWEEN 4 AND 40),
  monthly_volume  TEXT,
  source          TEXT         NOT NULL     DEFAULT 'landing_page',
  created_at      TIMESTAMPTZ  NOT NULL     DEFAULT NOW(),

  CONSTRAINT uq_suppliers_email UNIQUE (email)
);

-- ── INDEXES ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cons_email   ON public.waitlist_consumers (email);
CREATE INDEX IF NOT EXISTS idx_cons_lga     ON public.waitlist_consumers (lga);
CREATE INDEX IF NOT EXISTS idx_cons_created ON public.waitlist_consumers (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sup_email    ON public.waitlist_suppliers (email);
CREATE INDEX IF NOT EXISTS idx_sup_lga      ON public.waitlist_suppliers (lga);
CREATE INDEX IF NOT EXISTS idx_sup_created  ON public.waitlist_suppliers (created_at DESC);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────
ALTER TABLE public.waitlist_consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_suppliers ENABLE ROW LEVEL SECURITY;

-- Anonymous: INSERT only (landing page signups)
CREATE POLICY "anon_insert_consumers" ON public.waitlist_consumers
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_insert_suppliers" ON public.waitlist_suppliers
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated (admin): full SELECT
CREATE POLICY "auth_select_consumers" ON public.waitlist_consumers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_select_suppliers" ON public.waitlist_suppliers
  FOR SELECT TO authenticated USING (true);

-- No anon SELECT — protects user privacy
-- No UPDATE / DELETE for anon — immutable audit trail

-- ── ANALYTICS VIEWS ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.waitlist_summary AS
SELECT
  'consumer'            AS type,
  COUNT(*)              AS total,
  COUNT(DISTINCT lga)   AS lga_count,
  MIN(created_at)       AS first_signup,
  MAX(created_at)       AS latest_signup
FROM public.waitlist_consumers
UNION ALL
SELECT
  'supplier'            AS type,
  COUNT(*)              AS total,
  COUNT(DISTINCT lga)   AS lga_count,
  MIN(created_at)       AS first_signup,
  MAX(created_at)       AS latest_signup
FROM public.waitlist_suppliers;

CREATE OR REPLACE VIEW public.signups_by_lga AS
SELECT
  lga,
  COUNT(*) FILTER (WHERE source = 'landing_page') AS from_landing_page,
  COUNT(*)                                          AS total
FROM public.waitlist_consumers
GROUP BY lga
ORDER BY total DESC;

CREATE OR REPLACE VIEW public.daily_signups AS
SELECT
  DATE(created_at AT TIME ZONE 'Africa/Lagos') AS day,
  COUNT(*) AS consumers
FROM public.waitlist_consumers
GROUP BY 1
ORDER BY 1 DESC;

-- ── VERIFY ──────────────────────────────────────────────────────────
-- Run these queries after setup to verify everything works:
--
-- SELECT * FROM public.waitlist_summary;
-- SELECT * FROM public.signups_by_lga;
-- SELECT * FROM public.daily_signups;
-- SELECT COUNT(*) FROM public.waitlist_consumers;
-- SELECT COUNT(*) FROM public.waitlist_suppliers;
