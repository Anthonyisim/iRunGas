/**
 * iRunGas — supabase.js
 * Supabase client initialisation and typed database helpers.
 *
 * ── SETUP ──────────────────────────────────────────────────────────
 * 1. Create a free Supabase project at https://supabase.com
 * 2. Run supabase/schema.sql in your project's SQL Editor.
 * 3. Go to Settings → API and copy your Project URL + anon key.
 * 4. Replace the two constants below, OR use a .env file with a
 *    bundler (Vite / Parcel) and reference import.meta.env values.
 * ──────────────────────────────────────────────────────────────────
 */

/* eslint-disable no-unused-vars */
'use strict';

// ── CONFIG ──────────────────────────────────────────────────────────
// Replace with your real Supabase credentials.
// NEVER commit live keys to a public repo — use .env in production.
const SUPABASE_URL      = 'https://pcficaouuqqgvgtcxgum.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZmljYW91dXFxZ3ZndGN4Z3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDA5MDksImV4cCI6MjA4OTA3NjkwOX0.y-Ae6XJeogBnFWBhgwqYK0_PyL-Oq4z_a7B8pxfWfnA
';

// ── CLIENT SINGLETON ─────────────────────────────────────────────────
let _client = null;

function getClient () {
  if (_client) return _client;
  if (typeof window.supabase === 'undefined') {
    console.warn('[iRunGas] Supabase JS not loaded — running in mock mode.');
    return null;
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// ── HELPERS ──────────────────────────────────────────────────────────
function sleep (ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Insert a consumer waitlist entry.
 * @param {{first_name:string, last_name:string, email:string, phone?:string,
 *          lga:string, cylinder_size?:string}} data
 * @returns {Promise<{success:boolean, error:string|null}>}
 */
async function insertConsumer (data) {
  const db = getClient();
  const payload = {
    first_name:    data.first_name,
    last_name:     data.last_name,
    email:         data.email.toLowerCase(),
    phone:         data.phone   || null,
    lga:           data.lga,
    cylinder_size: data.cylinder_size || null,
    source:        'landing_page',
    created_at:    new Date().toISOString(),
  };

  if (!db) {
    // Mock mode — no real DB
    console.log('[iRunGas mock] insertConsumer:', payload);
    await sleep(700);
    return { success: true, error: null };
  }

  const { error } = await db.from('waitlist_consumers').insert(payload);
  if (error) {
    if (error.code === '23505') return { success: true, error: null }; // duplicate → treat as ok
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}

/**
 * Insert a supplier waitlist entry.
 * @param {{first_name:string, last_name:string, email:string, phone:string,
 *          business_name:string, lga:string, nmdpra_number?:string,
 *          monthly_volume?:string}} data
 * @returns {Promise<{success:boolean, error:string|null}>}
 */
async function insertSupplier (data) {
  const db = getClient();
  const payload = {
    first_name:     data.first_name,
    last_name:      data.last_name,
    email:          data.email.toLowerCase(),
    phone:          data.phone,
    business_name:  data.business_name,
    lga:            data.lga,
    nmdpra_number:  data.nmdpra_number || null,
    monthly_volume: data.monthly_volume || null,
    source:         'landing_page',
    created_at:     new Date().toISOString(),
  };

  if (!db) {
    console.log('[iRunGas mock] insertSupplier:', payload);
    await sleep(700);
    return { success: true, error: null };
  }

  const { error } = await db.from('waitlist_suppliers').insert(payload);
  if (error) {
    if (error.code === '23505') return { success: true, error: null };
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}

// Expose to window so main.js can call without a bundler
window.IRG       = window.IRG || {};
window.IRG.db    = { insertConsumer, insertSupplier };
