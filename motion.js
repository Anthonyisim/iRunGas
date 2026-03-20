/**
 * iRunGas — motion.js  (v3 — GitHub Pages fix)
 *
 * Uses Framer Motion for the Web (Motion One API) v11.
 * CDN: https://cdn.jsdelivr.net/npm/motion@11/dist/motion.js
 * Window global: window.Motion
 *
 * STRATEGY
 * ─────────
 * CSS is the primary animation system. This file enhances it.
 * If the CDN fails or this script errors, the page remains
 * 100% visible: CSS fadeUp, chipfloat, and ride animations play.
 *
 * Key fixes vs v2:
 *  - motion-ready class added via requestAnimationFrame (deferred),
 *    so the CSS fadeUp animation gets at least one paint frame before
 *    motion-ready suppresses transitions on .reveal/.stagger.
 *    (Previously added synchronously, racing with first CSS paint.)
 *  - .fade-in elements: NO manual opacity/transform reset before
 *    animation. Motion's animate() sets inline styles directly and
 *    inline styles always override CSS — no need to force the start
 *    state, which was blanking the hero before Motion could re-show it.
 *  - motionScroll aliased (not 'scroll') to avoid window.scroll shadow.
 */

;(function () {
  'use strict';

  function init () {
    var M = window.Motion;
    if (!M || typeof M.animate !== 'function') return;

    var animate       = M.animate;
    var motionScroll  = M.scroll;   /* aliased — never use bare 'scroll' */
    var inView        = M.inView;
    var stagger       = M.stagger;
    var spring        = M.spring;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* Add motion-ready AFTER one animation frame — this lets the browser
       paint the CSS fadeUp animation at least once before we suppress
       CSS transitions on .reveal/.stagger. Without this deferral, there
       is a race where motion-ready lands before the first CSS paint and
       the hero flickers invisible. */
    requestAnimationFrame(function () {
      document.documentElement.classList.add('motion-ready');
    });

    /* ── HELPERS ─────────────────────────────────────────────────── */
    function q  (sel) { return document.querySelector(sel); }
    function qa (sel) { return [].slice.call(document.querySelectorAll(sel)); }

    function sa (target, kf, opts) {
      try {
        if (!target) return { then: function () { return this; } };
        return animate(target, kf, opts) || { then: function () { return this; } };
      } catch (e) {
        return { then: function () { return this; } };
      }
    }

    /* Spring presets */
    var sSnap   = spring({ stiffness: 400, damping: 30 });
    var sBounce = spring({ stiffness: 300, damping: 20 });
    var sSmooth = spring({ stiffness: 180, damping: 22 });
    var sGent   = spring({ stiffness: 120, damping: 20 });

    /* ── 1. HERO ─────────────────────────────────────────────────── */
    /* NOTE: We do NOT force opacity:0 / transform on .fade-in here.
       The CSS animation already starts them hidden. Motion's animate()
       writes inline styles which win over the CSS animation automatically.
       Forcing the start state was causing the blank-hero bug. */
    function initHero () {
      var items = qa('#hero .fade-in');
      if (!items.length) return;

      /* Small delay so CSS animation has already started playing.
         Motion then takes over mid-flight via inline styles. */
      sa(items, { opacity: [0, 1], y: [32, 0] }, {
        delay: stagger(0.12, { start: 0.1 }),
        duration: 0.7,
        easing: sSmooth,
      });

      var wm = q('.hero-wordmark');
      if (wm) {
        sa(wm, { opacity: [0, 1], x: [60, 0] }, {
          delay: 0.55, duration: 1.1, easing: sGent,
        });
      }

      var mc = q('.mockup-card');
      if (mc) {
        sa(mc, { opacity: [0, 1], scale: [0.88, 1], y: [20, 0] }, {
          delay: 0.3, duration: 0.85, easing: sBounce,
        });
      }
    }

    /* ── 2. CHIPS ────────────────────────────────────────────────── */
    function initChips () {
      [{ sel: '.chip--tl', d: 0.8 }, { sel: '.chip--br', d: 1.05 }]
        .forEach(function (cfg) {
          var chip = q(cfg.sel);
          if (!chip) return;
          sa(chip, { opacity: [0, 1], y: [16, 0] }, {
            delay: cfg.d, duration: 0.55, easing: sBounce,
          }).then(function () {
            sa(chip, { y: [0, -10, 0] }, {
              repeat: Infinity, duration: 4.5 + cfg.d * 0.5, easing: 'ease-in-out',
            });
          });
        });
    }

    /* ── 3. NAV LOGO ─────────────────────────────────────────────── */
    function initNavLogo () {
      var logo = q('.logo-img:not(.logo-img--footer)');
      if (!logo) return;
      sa(logo, { opacity: [0, 1], scale: [0.7, 1] }, {
        delay: 0.05, duration: 0.5, easing: sSnap,
      });
    }

    /* ── 4. SCROLL REVEALS ───────────────────────────────────────── */
    function initScrollReveals () {
      qa('.reveal').forEach(function (el) {
        var d = parseFloat(getComputedStyle(el).getPropertyValue('--d') || '0');
        inView(el, function () {
          sa(el, { opacity: [0, 1], y: [30, 0] }, {
            delay: d, duration: 0.65, easing: sSmooth,
          });
        }, { margin: '0px 0px -60px 0px' });
      });

      qa('.reveal-l').forEach(function (el) {
        inView(el, function () {
          sa(el, { opacity: [0, 1], x: [-32, 0] }, {
            duration: 0.7, easing: sSmooth,
          });
        }, { margin: '0px 0px -60px 0px' });
      });

      qa('.reveal-r').forEach(function (el) {
        inView(el, function () {
          sa(el, { opacity: [0, 1], x: [32, 0] }, {
            duration: 0.7, easing: sSmooth,
          });
        }, { margin: '0px 0px -60px 0px' });
      });

      qa('.stagger').forEach(function (container) {
        var children = [].slice.call(container.children);
        inView(container, function () {
          sa(children, { opacity: [0, 1], y: [22, 0] }, {
            delay: stagger(0.09, { start: 0.04 }),
            duration: 0.55,
            easing: spring({ stiffness: 200, damping: 24 }),
          });
        }, { margin: '0px 0px -40px 0px' });
      });
    }

    /* ── 5. HOVER INTERACTIONS ───────────────────────────────────── */
    function initHover () {
      function hs (el, inV, outV) {
        el.addEventListener('mouseenter', function () {
          sa(el, inV, { duration: 0.3, easing: spring({ stiffness: 320, damping: 26 }) });
        });
        el.addEventListener('mouseleave', function () {
          sa(el, outV, { duration: 0.4, easing: spring({ stiffness: 260, damping: 28 }) });
        });
      }

      qa('.feat-card').forEach(function (c) { hs(c, { scale: 1.025, y: -4 }, { scale: 1, y: 0 }); });
      qa('.stat-card').forEach(function (c) { hs(c, { scale: 1.04,  y: -3 }, { scale: 1, y: 0 }); });
      qa('.lga-card' ).forEach(function (c) { hs(c, { y: -5, scale: 1.02 }, { y: 0, scale: 1 }); });

      qa('.btn-primary, .btn-submit--dark, .btn-submit, .nav-cta').forEach(function (btn) {
        btn.addEventListener('mouseenter', function () {
          sa(btn, { scale: 1.03, y: -2 }, { duration: 0.25, easing: spring({ stiffness: 400, damping: 24 }) });
        });
        btn.addEventListener('mouseleave', function () {
          sa(btn, { scale: 1, y: 0 }, { duration: 0.35, easing: spring({ stiffness: 350, damping: 28 }) });
        });
        btn.addEventListener('mousedown', function () {
          sa(btn, { scale: 0.97 }, { duration: 0.12, easing: spring({ stiffness: 500, damping: 30 }) });
        });
        btn.addEventListener('mouseup', function () {
          sa(btn, { scale: 1 }, { duration: 0.2, easing: spring({ stiffness: 400, damping: 22 }) });
        });
      });

      qa('.step').forEach(function (step) {
        var icon = step.querySelector('.step-icon');
        if (!icon) return;
        step.addEventListener('mouseenter', function () {
          sa(icon, { scale: [1, 1.2, 1.1], rotate: [0, -10, 0] }, {
            duration: 0.45, easing: sBounce,
          });
        });
      });
    }

    /* ── 6. STEP NUMBERS ─────────────────────────────────────────── */
    function initStepNums () {
      qa('.step-num').forEach(function (el, i) {
        inView(el, function () {
          sa(el, { opacity: [0, 1], scale: [0.5, 1.1, 1] }, {
            delay: i * 0.12, duration: 0.55, easing: sBounce,
          });
        }, { margin: '0px 0px -40px 0px' });
      });
    }

    /* ── 7. COUNTERS ─────────────────────────────────────────────── */
    function initCounters () {
      qa('.stat-n').forEach(function (el) {
        var text   = el.textContent.trim();
        var m      = text.match(/[\d.]+/);
        if (!m) return;
        var target = parseFloat(m[0]);
        var prefix = text.startsWith('₦') ? '₦' : '';
        var suffix = text.replace(/[\d.]+/, '').replace(/^[₦]/, '');
        var isInt  = Number.isInteger(target);
        el.setAttribute('aria-label', text);
        inView(el, function () {
          var t0 = null, dur = 1200;
          function tick (ts) {
            if (!t0) t0 = ts;
            var p = Math.min((ts - t0) / dur, 1);
            var v = 1 - Math.pow(2, -10 * p);
            el.textContent = prefix + (isInt ? Math.round(v * target) : (v * target).toFixed(1)) + suffix;
            if (p < 1) requestAnimationFrame(tick);
          }
          el.textContent = prefix + '0' + suffix;
          requestAnimationFrame(tick);
        }, { margin: '0px 0px -80px 0px' });
      });
    }

    /* ── 8. PERKS ────────────────────────────────────────────────── */
    function initPerks () {
      var list = q('.perks');
      if (!list) return;
      var items = qa('.perks li');
      items.forEach(function (item) {
        item.style.opacity   = '0';
        item.style.transform = 'translateX(-16px)';
      });
      inView(list, function () {
        sa(items, { opacity: [0, 1], x: [-16, 0] }, {
          delay: stagger(0.1, { start: 0.15 }),
          duration: 0.5,
          easing: spring({ stiffness: 200, damping: 24 }),
        });
      }, { margin: '0px 0px -80px 0px' });
    }

    /* ── 9. FORM TABS ────────────────────────────────────────────── */
    function initFormAnim () {
      var wl = document.getElementById('waitlist');
      if (wl) {
        var tabs = qa('.tab');
        tabs.forEach(function (tab) {
          tab.style.opacity   = '0';
          tab.style.transform = 'translateY(12px)';
        });
        inView(wl, function () {
          sa(tabs, { opacity: [0, 1], y: [12, 0] }, {
            delay: stagger(0.08, { start: 0.2 }),
            duration: 0.45,
            easing: spring({ stiffness: 240, damping: 24 }),
          });
        }, { margin: '0px 0px -60px 0px' });
      }

      qa('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          sa(tab, { scale: [1, 0.95, 1] }, {
            duration: 0.3, easing: spring({ stiffness: 400, damping: 20 }),
          });
        });
      });
    }

    /* ── 10. FORM SUCCESS ────────────────────────────────────────── */
    function initFormSuccess () {
      var panel = document.getElementById('form-success');
      if (!panel) return;
      var obs = new MutationObserver(function () {
        if (!panel.style.display || panel.style.display === 'none') return;
        sa(panel, { opacity: [0, 1], scale: [0.88, 1], y: [24, 0] }, {
          duration: 0.55, easing: spring({ stiffness: 280, damping: 22 }),
        });
        var anim = panel.querySelector('.success-anim');
        if (anim) {
          sa(anim, { scale: [0.5, 1.15, 1] }, {
            delay: 0.1, duration: 0.55, easing: sBounce,
          });
        }
      });
      obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
    }

    /* ── 11. MOBILE MENU ─────────────────────────────────────────── */
    function initMobileMenu () {
      var menu  = document.getElementById('mobileMenu');
      var btn   = document.getElementById('hamburger');
      if (!menu || !btn) return;

      var menuObs = new MutationObserver(function () {
        var open = menu.classList.contains('open');
        if (open) {
          sa(menu, { opacity: [0, 1], y: [-20, 0] }, {
            duration: 0.35, easing: spring({ stiffness: 260, damping: 26 }),
          });
        } else {
          sa(menu, { opacity: [1, 0], y: [0, -12] }, {
            duration: 0.25, easing: spring({ stiffness: 300, damping: 28 }),
          });
        }
      });
      menuObs.observe(menu, { attributes: true, attributeFilter: ['class'] });

      var spans = qa('#hamburger span');
      if (spans.length === 3) {
        var btnObs = new MutationObserver(function () {
          var open = btn.classList.contains('open');
          if (open) {
            sa(spans[0], { rotate: 45,  y:  7 }, { duration: 0.28, easing: spring({ stiffness: 300, damping: 24 }) });
            sa(spans[1], { opacity: 0, scaleX: 0 }, { duration: 0.2 });
            sa(spans[2], { rotate: -45, y: -7 }, { duration: 0.28, easing: spring({ stiffness: 300, damping: 24 }) });
          } else {
            sa(spans[0], { rotate: 0, y: 0 }, { duration: 0.28, easing: spring({ stiffness: 280, damping: 22 }) });
            sa(spans[1], { opacity: 1, scaleX: 1 }, { duration: 0.25, delay: 0.04 });
            sa(spans[2], { rotate: 0, y: 0 }, { duration: 0.28, easing: spring({ stiffness: 280, damping: 22 }) });
          }
        });
        btnObs.observe(btn, { attributes: true, attributeFilter: ['class'] });
      }
    }

    /* ── 12. TICKER PAUSE ────────────────────────────────────────── */
    function initTicker () {
      var ticker = q('.ticker');
      var inner  = q('.ticker-inner');
      if (!ticker || !inner) return;
      ticker.addEventListener('mouseenter', function () {
        sa(inner, { opacity: 0.55 }, { duration: 0.3 });
        inner.style.animationPlayState = 'paused';
      });
      ticker.addEventListener('mouseleave', function () {
        sa(inner, { opacity: 1 }, { duration: 0.3 });
        inner.style.animationPlayState = 'running';
      });
    }

    /* ── 13. SCROLL PROGRESS BAR ─────────────────────────────────── */
    function initScrollProgress () {
      if (typeof motionScroll !== 'function') return;
      var bar = document.createElement('div');
      bar.id = 'irg-scroll-progress';
      bar.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'height:3px', 'width:0%',
        'background:linear-gradient(90deg,#E8400C,#FF6B3A)',
        'z-index:9999', 'pointer-events:none',
        'border-radius:0 2px 2px 0',
        'box-shadow:0 0 8px rgba(232,64,12,.5)',
      ].join(';');
      document.body.appendChild(bar);
      motionScroll(function (info) {
        bar.style.width = ((info && info.y ? info.y.progress : 0) * 100) + '%';
      });
    }

    /* ── 14. GPS TRACKING DOT ────────────────────────────────────── */
    function initTrackingDot () {
      var dot   = q('.fg-dot:not(.fg-dot--dest)');
      var pulse = q('.fg-pulse');
      if (!dot) return;
      sa(dot,   { x: [0, 96, 0] }, { repeat: Infinity, duration: 3.2, easing: 'ease-in-out' });
      if (pulse) {
        sa(pulse, { scale: [0.6, 2.2], opacity: [0.7, 0] }, {
          repeat: Infinity, duration: 1.6, easing: 'ease-out',
        });
      }
    }

    /* ── BOOT ────────────────────────────────────────────────────── */
    [
      ['Hero',           initHero],
      ['Chips',          initChips],
      ['NavLogo',        initNavLogo],
      ['Reveals',        initScrollReveals],
      ['Hover',          initHover],
      ['StepNums',       initStepNums],
      ['Counters',       initCounters],
      ['Perks',          initPerks],
      ['FormAnim',       initFormAnim],
      ['FormSuccess',    initFormSuccess],
      ['MobileMenu',     initMobileMenu],
      ['Ticker',         initTicker],
      ['ScrollProgress', initScrollProgress],
      ['TrackingDot',    initTrackingDot],
    ].forEach(function (pair) {
      try { pair[1](); }
      catch (e) { console.warn('[iRunGas motion] ' + pair[0] + ': ' + e.message); }
    });

    console.log(
      '%c ⚡ iRunGas %c Motion v3 ready ',
      'background:#E8400C;color:#fff;padding:4px 10px;border-radius:6px 0 0 6px;font-weight:700;font-family:sans-serif',
      'background:#1D7A55;color:#fff;padding:4px 10px;border-radius:0 6px 6px 0;font-family:sans-serif'
    );
  }

  /* Entry point */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
