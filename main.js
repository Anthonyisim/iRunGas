/**
 * iRunGas — main.js
 *
 * Covers:
 *  • Input validation with per-field inline errors
 *  • Input sanitisation (strip HTML, trim, normalise)
 *  • Client-side rate limiting with countdown timer
 *  • Form submission → Supabase via supabase.js helpers
 *  • Tab switching, navbar scroll, mobile menu, smooth scroll
 *  • Scroll-triggered reveal animations
 */
;(function () {
  'use strict';

  /* ── CONSTANTS ──────────────────────────────────────────────────── */
  const RATE_LIMIT_KEY = 'irg_last_submit';   // localStorage key
  const RATE_LIMIT_MS  = 60 * 1000;           // 60 seconds between attempts
  const MAX_ATTEMPTS   = 3;                   // max submissions per hour
  const ATTEMPT_KEY    = 'irg_attempts';
  const ATTEMPT_WINDOW = 60 * 60 * 1000;      // 1 hour window

  /* ── SMALL HELPERS ──────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const qsa = s => [...document.querySelectorAll(s)];

  /* ── SANITISATION ───────────────────────────────────────────────── */
  /**
   * Strip HTML tags, trim whitespace, collapse internal spaces.
   * Prevents XSS-style injections from being stored in DB.
   */
  function sanitise (raw) {
    if (typeof raw !== 'string') return '';
    return raw
      .replace(/<[^>]*>/g, '')           // strip any HTML tags
      .replace(/[^\S\r\n]+/g, ' ')       // collapse whitespace
      .replace(/[\u0000-\u001F\u007F]/g, '') // remove control chars
      .trim()
      .slice(0, 512);                    // hard length cap
  }

  function sanitiseEmail (raw) {
    return sanitise(raw)
      .toLowerCase()
      .replace(/\s/g, '');              // remove all whitespace
  }

  function sanitisePhone (raw) {
    // Keep digits, +, -, spaces, parentheses only
    return sanitise(raw).replace(/[^0-9+\-() ]/g, '').slice(0, 20);
  }

  /* ── VALIDATION RULES ───────────────────────────────────────────── */
  const NAME_RE  = /^[A-Za-zÀ-ÖØ-öø-ÿ' \-]{1,60}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^[+\d][\d\s\-()]{6,19}$/;
  const NMDPRA_RE= /^[A-Za-z0-9\-]{4,40}$/;

  /** Returns error string or '' if valid */
  function validateField (name, value) {
    switch (name) {
      case 'first_name':
      case 'last_name':
        if (!value) return 'This field is required.';
        if (!NAME_RE.test(value)) return 'Please enter a valid name (letters only).';
        return '';

      case 'email':
        if (!value) return 'Email address is required.';
        if (!EMAIL_RE.test(value)) return 'Please enter a valid email address.';
        if (value.length > 254)    return 'Email address is too long.';
        return '';

      case 'phone':
        if (!value) return ''; // optional on consumer form
        if (!PHONE_RE.test(value)) return 'Please enter a valid phone number.';
        return '';

      case 'phone_required':
        if (!value) return 'Phone number is required.';
        if (!PHONE_RE.test(value)) return 'Please enter a valid phone number.';
        return '';

      case 'business_name':
        if (!value) return 'Business name is required.';
        if (value.length < 2) return 'Please enter your full business name.';
        return '';

      case 'lga':
        if (!value) return 'Please select your LGA.';
        return '';

      case 'nmdpra_number':
        if (!value) return ''; // optional
        if (!NMDPRA_RE.test(value)) return 'Please enter a valid NMDPRA number.';
        return '';

      default:
        return '';
    }
  }

  /* ── FIELD-LEVEL UI HELPERS ─────────────────────────────────────── */
  function getErrEl (inputEl) {
    const id = inputEl.getAttribute('aria-describedby');
    if (!id) return null;
    // aria-describedby may be multiple IDs; take the error one
    const errId = id.split(' ').find(i => i.includes('err') && !i.includes('global'));
    return errId ? $(errId) : null;
  }

  function setFieldError (inputEl, msg) {
    const errEl = getErrEl(inputEl);
    if (errEl) errEl.textContent = msg;
    inputEl.classList.toggle('field-invalid', !!msg);
    inputEl.classList.toggle('field-valid',   !msg && inputEl.value.trim() !== '');
    inputEl.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function clearFieldError (inputEl) {
    setFieldError(inputEl, '');
  }

  /** Validate one input; returns true if valid */
  function validateOne (inputEl) {
    const name  = inputEl.name;
    const value = inputEl.tagName === 'SELECT'
      ? inputEl.value
      : (name === 'email' ? sanitiseEmail(inputEl.value) : sanitise(inputEl.value));

    // Determine validation key
    let key = name;
    if (name === 'phone' && inputEl.hasAttribute('required')) key = 'phone_required';

    const err = validateField(key, value);
    setFieldError(inputEl, err);
    return err === '';
  }

  /** Validate entire form; returns {valid:bool, data:Object} */
  function validateForm (form) {
    const inputs = qsa.call({ querySelectorAll: s => form.querySelectorAll(s) }, 'input[name], select[name]');
    let valid = true;
    const data = {};

    inputs.forEach(el => {
      if (!validateOne(el)) valid = false;

      // Collect sanitised value
      const raw = el.tagName === 'SELECT' ? el.value : el.value;
      if (el.name === 'email') {
        data[el.name] = sanitiseEmail(raw);
      } else if (el.name === 'phone') {
        data[el.name] = sanitisePhone(raw);
      } else {
        data[el.name] = sanitise(raw);
      }
    });

    return { valid, data };
  }

  /* ── RATE LIMITER ───────────────────────────────────────────────── */
  function getRateLimitState () {
    try {
      const raw = localStorage.getItem(RATE_LIMIT_KEY);
      return raw ? JSON.parse(raw) : { lastSubmit: 0 };
    } catch { return { lastSubmit: 0 }; }
  }

  function getAttemptState () {
    try {
      const raw = localStorage.getItem(ATTEMPT_KEY);
      return raw ? JSON.parse(raw) : { count: 0, window_start: 0 };
    } catch { return { count: 0, window_start: 0 }; }
  }

  /**
   * Returns:
   *  { allowed: true }                         — can submit
   *  { allowed: false, waitMs: number }        — too soon after last submit
   *  { allowed: false, hourly: true }          — hourly cap hit
   */
  function checkRateLimit () {
    const now   = Date.now();
    const rl    = getRateLimitState();
    const since = now - rl.lastSubmit;

    if (since < RATE_LIMIT_MS) {
      return { allowed: false, waitMs: RATE_LIMIT_MS - since };
    }

    const at = getAttemptState();
    const windowAge = now - at.window_start;
    const count = windowAge > ATTEMPT_WINDOW ? 0 : at.count;
    if (count >= MAX_ATTEMPTS) {
      return { allowed: false, hourly: true, waitMs: ATTEMPT_WINDOW - windowAge };
    }

    return { allowed: true };
  }

  function recordSubmit () {
    const now = Date.now();
    try {
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ lastSubmit: now }));
      const at  = getAttemptState();
      const windowAge = now - at.window_start;
      const base  = windowAge > ATTEMPT_WINDOW ? { count: 0, window_start: now } : at;
      localStorage.setItem(ATTEMPT_KEY, JSON.stringify({ count: base.count + 1, window_start: base.window_start }));
    } catch { /* localStorage may be unavailable */ }
  }

  /* ── RATE LIMIT UI ──────────────────────────────────────────────── */
  let _countdownTimer = null;

  function showRateLimit (waitMs) {
    const el = $('form-rate-limit');
    if (!el) return;
    el.style.display = 'flex';

    const cdEl = $('rate-limit-countdown');
    let secs = Math.ceil(waitMs / 1000);
    if (cdEl) cdEl.textContent = secs;

    clearInterval(_countdownTimer);
    _countdownTimer = setInterval(() => {
      secs--;
      if (cdEl) cdEl.textContent = Math.max(0, secs);
      if (secs <= 0) {
        clearInterval(_countdownTimer);
        el.style.display = 'none';
      }
    }, 1000);
  }

  /* ── FORM LOADING STATE ─────────────────────────────────────────── */
  function setSubmitLoading (form, loading) {
    const btn     = form.querySelector('.btn-submit');
    if (!btn) return;
    const textEl  = btn.querySelector('.btn-submit-text');
    const arrowEl = btn.querySelector('.btn-submit-arrow');
    const spinEl  = btn.querySelector('.btn-submit-spinner');

    btn.disabled = loading;
    if (textEl)  textEl.style.opacity = loading ? '.5' : '1';
    if (arrowEl) arrowEl.style.display = loading ? 'none' : '';
    if (spinEl)  spinEl.style.display  = loading ? 'block' : 'none';
  }

  /* ── GLOBAL ERROR ───────────────────────────────────────────────── */
  function showGlobalError (msg) {
    const el   = $('form-global-err');
    const text = $('form-global-err-text');
    if (!el) return;
    if (text) text.textContent = msg;
    el.style.display = 'flex';
    setTimeout(() => { el.style.display = 'none'; }, 7000);
  }

  function clearGlobalError () {
    const el = $('form-global-err');
    if (el) el.style.display = 'none';
  }

  /* ── SUCCESS STATE ──────────────────────────────────────────────── */
  function showSuccess () {
    $('form-consumer').style.display = 'none';
    $('form-supplier').style.display = 'none';
    clearGlobalError();
    const s = $('form-success');
    if (s) s.style.display = 'flex';
  }

  /* ── RESET ──────────────────────────────────────────────────────── */
  window.IRG = window.IRG || {};
  window.IRG.resetForm = function () {
    const s = $('form-success');
    if (s) s.style.display = 'none';
    $('form-consumer').reset();
    $('form-supplier').reset();

    // Clear all field states
    qsa('[class*="wl-form"] input, [class*="wl-form"] select').forEach(el => {
      el.classList.remove('field-valid', 'field-invalid');
      el.removeAttribute('aria-invalid');
    });
    qsa('.field-err').forEach(el => { el.textContent = ''; });

    // Reactivate consumer tab
    switchTab('consumer');
  };

  /* ── TAB SWITCHING ──────────────────────────────────────────────── */
  function switchTab (type) {
    qsa('.tab').forEach(t => {
      const active = t.dataset.tab === type;
      t.classList.toggle('tab--active', active);
      t.setAttribute('aria-selected', String(active));
    });
    $('form-consumer').style.display = type === 'consumer' ? 'flex' : 'none';
    $('form-supplier').style.display = type === 'supplier' ? 'flex' : 'none';
    clearGlobalError();
    $('form-rate-limit').style.display = 'none';
  }

  function initTabs () {
    qsa('.tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
  }

  /* ── LIVE VALIDATION ────────────────────────────────────────────── */
  function initLiveValidation () {
    qsa('#form-consumer input, #form-consumer select, #form-supplier input, #form-supplier select')
      .forEach(el => {
        // Validate on blur (after user has finished typing)
        el.addEventListener('blur', () => {
          if (el.value.trim() !== '' || el.hasAttribute('required')) validateOne(el);
        });
        // Clear error on input
        el.addEventListener('input', () => {
          if (el.classList.contains('field-invalid')) validateOne(el);
          clearGlobalError();
          $('form-rate-limit').style.display = 'none';
        });
        el.addEventListener('change', () => {
          if (el.tagName === 'SELECT') validateOne(el);
        });
      });
  }

  /* ── FORM SUBMIT HANDLER ────────────────────────────────────────── */
  async function handleSubmit (form) {
    // 1. Rate limit check
    const rl = checkRateLimit();
    if (!rl.allowed) {
      showRateLimit(rl.waitMs);
      return;
    }

    // 2. Validate all fields
    const { valid, data } = validateForm(form);
    if (!valid) {
      // Focus first invalid field
      const first = form.querySelector('.field-invalid');
      if (first) first.focus();
      return;
    }

    // 3. Submit
    setSubmitLoading(form, true);
    clearGlobalError();

    try {
      const type = form.dataset.type;
      let result;
      if (type === 'consumer') {
        result = await window.IRG.db.insertConsumer(data);
      } else {
        result = await window.IRG.db.insertSupplier(data);
      }

      if (result.success) {
        recordSubmit();
        showSuccess();
      } else {
        showGlobalError(result.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('[iRunGas] submit error:', err);
      showGlobalError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitLoading(form, false);
    }
  }

  function initForms () {
    ['form-consumer', 'form-supplier'].forEach(id => {
      const form = $(id);
      if (!form) return;
      form.addEventListener('submit', e => { e.preventDefault(); handleSubmit(form); });
    });
  }

  /* ── NAVBAR ─────────────────────────────────────────────────────── */
  function initNavbar () {
    const nav = $('navbar');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  /* ── MOBILE MENU ────────────────────────────────────────────────── */
  function initMobileMenu () {
    const btn  = $('hamburger');
    const menu = $('mobileMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
    });

    // Close on link click
    qsa('.mob-link, .mob-cta').forEach(a => {
      a.addEventListener('click', () => {
        menu.classList.remove('open');
        btn.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
      });
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('open');
        btn.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── SMOOTH SCROLL ──────────────────────────────────────────────── */
  function initSmoothScroll () {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80; // nav height buffer
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }

  /* ── SCROLL ANIMATIONS ──────────────────────────────────────────── */
  function initScrollAnimations () {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });

    qsa('.reveal, .reveal-l, .reveal-r, .stagger').forEach(el => io.observe(el));

    // Hero fade-ins fire immediately on load
    qsa('#hero .fade-in').forEach(el => {
      // CSS animation handles delay via --d variable; just ensure visibility
    });
  }

  /* ── CONSOLE BRAND ──────────────────────────────────────────────── */
  function logBrand () {
    console.log(
      '%c ⚡ iRunGas %c Loaded v3 ',
      'background:#E8400C;color:#fff;padding:4px 10px;border-radius:6px 0 0 6px;font-weight:700;font-family:sans-serif',
      'background:#111318;color:#fff;padding:4px 10px;border-radius:0 6px 6px 0;font-family:sans-serif'
    );
  }

  /* ── BOOT ───────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initLiveValidation();
    initForms();
    initNavbar();
    initMobileMenu();
    initSmoothScroll();
    initScrollAnimations();
    logBrand();
  });

})();
