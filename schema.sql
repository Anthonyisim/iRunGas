-- ══════════════════════════════════════════════════════════════════
-- iRunGas — Supabase Database Schema
-- Version: 1.1 — Security fix: SECURITY INVOKER views + explicit grants
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- SECURITY CHANGE LOG (v1.0 → v1.1)
-- ─────────────────────────────────────────────────────────────────
-- PROBLEM: Views created without WITH (security_invoker = true) default
--          to SECURITY DEFINER in PostgreSQL / Supabase. A SECURITY DEFINER
--          view executes with the privileges of the view *owner* (typically
--          the postgres superuser), completely bypassing Row Level Security
--          policies on the underlying tables. Any role — including the
--          anonymous 'anon' role — could therefore query these views and
--          read aggregated counts from waitlist_consumers and
--          waitlist_suppliers, tables that are supposed to be INSERT-only
--          for anonymous callers.
--
-- AFFECTED VIEWS (all three recreated below with the fix):
--   • public.waitlist_summary
--   • public.signups_by_lga
--   • public.daily_signups
--
-- FIX APPLIED:
--   1. Recreate all three views WITH (security_invoker = true).
--      This forces the view to execute under the CALLER'S privileges,
--      so RLS on the underlying tables is respected at all times.
--   2. Explicitly REVOKE all privileges from the 'anon' role on the views.
--   3. Explicitly GRANT SELECT only to the 'authenticated' role.
--   4. Drop order respects dependencies: daily_signups → signups_by_lga
--      → waitlist_summary (innermost first).
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

-- ── ROW LEVEL SECURITY — TABLES ─────────────────────────────────────
ALTER TABLE public.waitlist_consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_suppliers ENABLE ROW LEVEL SECURITY;

-- Idempotent: drop policies before recreating
DROP POLICY IF EXISTS "anon_insert_consumers"  ON public.waitlist_consumers;
DROP POLICY IF EXISTS "anon_insert_suppliers"  ON public.waitlist_suppliers;
DROP POLICY IF EXISTS "auth_select_consumers"  ON public.waitlist_consumers;
DROP POLICY IF EXISTS "auth_select_suppliers"  ON public.waitlist_suppliers;

-- Anonymous: INSERT only (landing page signups)
CREATE POLICY "anon_insert_consumers" ON public.waitlist_consumers
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_insert_suppliers" ON public.waitlist_suppliers
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated (admin dashboard): full SELECT
CREATE POLICY "auth_select_consumers" ON public.waitlist_consumers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_select_suppliers" ON public.waitlist_suppliers
  FOR SELECT TO authenticated USING (true);

-- No anon SELECT  — protects user PII (email, phone, name)
-- No UPDATE/DELETE for anon — immutable audit trail

-- ══════════════════════════════════════════════════════════════════
-- SECURITY FIX: ANALYTICS VIEWS
-- ══════════════════════════════════════════════════════════════════
--
-- ROOT CAUSE
-- ----------
-- PostgreSQL views default to SECURITY DEFINER behaviour: the view
-- body runs with the privileges of the view OWNER, not the caller.
-- In Supabase the default owner is the 'postgres' superuser, so:
--
--   SELECT * FROM public.waitlist_summary;   -- called by 'anon'
--
-- ...executes internally as 'postgres', bypasses every RLS policy
-- on waitlist_consumers and waitlist_suppliers, and returns rows.
-- The anon caller reads data they should never see.
--
-- FIX: WITH (security_invoker = true)
-- ------------------------------------
-- This PostgreSQL 15+ option makes the view body run as the
-- CALLING role. The anon role only has INSERT on the base tables
-- (via RLS policy "anon_insert_consumers"). A SELECT through the
-- view therefore fails RLS → returns 0 rows / permission error.
-- The authenticated role has SELECT (via "auth_select_consumers")
-- → view returns results as expected.
--
-- ADDITIONAL DEFENCE-IN-DEPTH
-- ----------------------------
-- Even with security_invoker, we revoke view-level SELECT from
-- anon and PUBLIC, and grant it only to authenticated. This closes
-- any edge-case where a future Supabase version or pg_catalog change
-- might re-grant public privileges on newly created objects.
-- ══════════════════════════════════════════════════════════════════

-- Drop in reverse dependency order (no cross-dependencies here, but
-- dropping innermost first is correct practice)
DROP VIEW IF EXISTS public.daily_signups;
DROP VIEW IF EXISTS public.signups_by_lga;
DROP VIEW IF EXISTS public.waitlist_summary;

-- ── VIEW: waitlist_summary ──────────────────────────────────────────
-- One row per type (consumer | supplier).
-- Returns: total signups, distinct LGA count, first and latest signup.
-- Used by: admin dashboard headline stats.
CREATE VIEW public.waitlist_summary
  WITH (security_invoker = true)
AS
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

-- ── VIEW: signups_by_lga ────────────────────────────────────────────
-- Consumer signups aggregated by Local Government Area, ordered by
-- volume descending.  Used for coverage heatmaps and demand
-- prioritisation in the operations dashboard.
CREATE VIEW public.signups_by_lga
  WITH (security_invoker = true)
AS
SELECT
  lga,
  COUNT(*) FILTER (WHERE source = 'landing_page') AS from_landing_page,
  COUNT(*)                                          AS total
FROM public.waitlist_consumers
GROUP BY lga
ORDER BY total DESC;

-- ── VIEW: daily_signups ─────────────────────────────────────────────
-- Daily consumer signup counts in the Africa/Lagos (WAT, UTC+1)
-- timezone.  Used for momentum tracking and marketing attribution.
CREATE VIEW public.daily_signups
  WITH (security_invoker = true)
AS
SELECT
  DATE(created_at AT TIME ZONE 'Africa/Lagos') AS day,
  COUNT(*)                                      AS consumers
FROM public.waitlist_consumers
GROUP BY 1
ORDER BY 1 DESC;

-- ── EXPLICIT PRIVILEGE GRANTS ON VIEWS ─────────────────────────────
-- Defence-in-depth: lock view-level access independent of RLS.

-- 1. Revoke from PUBLIC (catches any implicit grants Supabase applies
--    to new objects in the public schema)
REVOKE ALL ON public.waitlist_summary  FROM PUBLIC;
REVOKE ALL ON public.signups_by_lga   FROM PUBLIC;
REVOKE ALL ON public.daily_signups    FROM PUBLIC;

-- 2. Revoke explicitly from the anon role
REVOKE ALL ON public.waitlist_summary  FROM anon;
REVOKE ALL ON public.signups_by_lga   FROM anon;
REVOKE ALL ON public.daily_signups    FROM anon;

-- 3. Grant SELECT only to authenticated (logged-in admin users)
GRANT SELECT ON public.waitlist_summary  TO authenticated;
GRANT SELECT ON public.signups_by_lga   TO authenticated;
GRANT SELECT ON public.daily_signups    TO authenticated;

-- ── POST-MIGRATION VERIFICATION QUERIES ─────────────────────────────
-- Run these after applying this migration to confirm the fix:
--
-- 1. Verify security_invoker is ON for all three views:
--
--    SELECT c.relname AS view_name,
--           c.relrowsecurity,
--           pg_catalog.pg_get_viewdef(c.oid, true) AS definition
--    FROM   pg_catalog.pg_class c
--    JOIN   pg_catalog.pg_namespace n ON n.oid = c.relnamespace
--    WHERE  c.relkind = 'v'
--      AND  n.nspname = 'public'
--      AND  c.relname IN ('waitlist_summary','signups_by_lga','daily_signups');
--
--    → Look for 'security_invoker=on' in each view's definition header.
--
-- 2. Confirm anon has NO privileges on the views (expect 0 rows):
--
--    SELECT grantee, table_name, privilege_type
--    FROM   information_schema.role_table_grants
--    WHERE  table_schema = 'public'
--      AND  table_name   IN ('waitlist_summary','signups_by_lga','daily_signups')
--      AND  grantee      = 'anon';
--
-- 3. Confirm authenticated has SELECT (expect 3 rows):
--
--    SELECT grantee, table_name, privilege_type
--    FROM   information_schema.role_table_grants
--    WHERE  table_schema = 'public'
--      AND  table_name   IN ('waitlist_summary','signups_by_lga','daily_signups')
--      AND  grantee      = 'authenticated';
--
-- 4. Smoke-test authenticated access (should return rows):
--
--    SELECT * FROM public.waitlist_summary;
--    SELECT * FROM public.signups_by_lga   LIMIT 10;
--    SELECT * FROM public.daily_signups    LIMIT 10;
--
-- 5. Confirm underlying table row counts are accessible:
--
--    SELECT COUNT(*) FROM public.waitlist_consumers;
--    SELECT COUNT(*) FROM public.waitlist_suppliers;
-- ══════════════════════════════════════════════════════════════════
