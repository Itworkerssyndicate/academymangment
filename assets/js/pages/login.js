/* ============================================================
   ITWS Platform — Login Page V3 (Official + Fallback-safe)
   File: assets/js/pages/login.js
   
   ⚠️ يعمل حتى لو Supabase مش متصل — fallbacks كاملة
   🎨 Navy + Gold + Red مصري رسمي + Cairo
   ⚙️ كل حاجة من app_identity (union, committee, president, logo, features)
   ============================================================ */

(function () {
  'use strict';

  if (window.LoginPage && window.LoginPage._initialized) return;

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[LoginPage]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  }

  function getSetting(path, fallback) {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get(path);
        if (v !== undefined && v !== null) return v;
      }
    } catch (e) {}
    try {
      if (typeof window.getSettingDefault === 'function') {
        var d = window.getSettingDefault(path);
        if (d !== undefined && d !== null) return d;
      }
    } catch (e) {}
    return fallback;
  }

  function getLabel(key, fallback) {
    try {
      if (window.Labels && typeof window.Labels.t === 'function') {
        var v = window.Labels.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function safeStorageRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  function $(id) { return document.getElementById(id); }
  function setText(id, text) { var el = $(id); if (el) el.textContent = text || ''; }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error(getLabel('errors.timeout', 'انتهت مهلة العملية') + (label ? ' — ' + label : '')));
        }, ms);
      })
    ]);
  }

  /* ============================================================
     2. CONFIG
     ============================================================ */

  var AUTH_TIMEOUT_MS = 25000;
  var PROFILE_TIMEOUT_MS = 10000;
  var SESSION_TIMEOUT_MS = 6000;
  var MAX_ATTEMPTS = 5;
  var REMEMBER_KEY = 'itws_saved_email';

  /* ============================================================
     3. STATE
     ============================================================ */

  var state = {
    _initialized: false,
    submitting: false,
    attempts: 0,
    existingUser: null,
    existingProfile: null,
    settingsUnsub: null
  };

  /* ============================================================
     4. OFFICIAL CSS INJECTION
     ============================================================ */

  var STYLE_ID = 'itws-login-official-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = ''

      /* ===== ROOT FALLBACKS ===== */
      + ':root{'
      + '--itws-navy:#0A1628;'
      + '--itws-navy-alt:#0F1E33;'
      + '--itws-navy-surface:#142540;'
      + '--itws-navy-elevated:#1B2F4D;'
      + '--itws-gold:#D4A843;'
      + '--itws-gold-soft:rgba(212,168,67,0.15);'
      + '--itws-red:#C8102E;'
      + '--itws-red-hover:#A50D26;'
      + '--itws-text:#F5F3EE;'
      + '--itws-text-secondary:#B8C4D6;'
      + '--itws-text-muted:#7A8BA5;'
      + '--itws-border:rgba(255,255,255,0.08);'
      + '}'

      /* ===== RESET OLD STYLES FROM login.html ===== */
      + '.auth-layout, .auth-form-side, .auth-brand-side{'
      + 'background:transparent !important;'
      + 'border:none !important;'
      + '}'

      /* ===== MAIN LAYOUT ===== */
      + '.itws-login{'
      + 'min-height:100vh;min-height:100dvh;'
      + 'display:grid;grid-template-columns:1fr;'
      + 'background:var(--itws-navy);'
      + 'font-family:"Cairo",sans-serif;'
      + 'padding-top:env(safe-area-inset-top);'
      + 'padding-bottom:env(safe-area-inset-bottom);'
      + '}'
      + '@media (min-width:1024px){.itws-login{grid-template-columns:1fr 1fr;}}'

      /* ===== FORM SIDE (right on desktop) ===== */
      + '.itws-login-form{'
      + 'display:flex;flex-direction:column;justify-content:center;align-items:center;'
      + 'padding:clamp(24px,5vw,48px) clamp(20px,4vw,40px);'
      + 'position:relative;z-index:2;'
      + '}'
      + '.itws-login-form-inner{width:100%;max-width:440px;}'

      /* ===== HEADER (form) ===== */
      + '.itws-login-header{text-align:center;margin-bottom:32px;}'
      + '.itws-login-logo{'
      + 'display:none;width:72px;height:72px;margin:0 auto 16px;'
      + 'border-radius:8px;'
      + 'background:linear-gradient(135deg,var(--itws-red),var(--itws-red-hover));'
      + 'border:2px solid var(--itws-gold);'
      + 'color:#FFFFFF;'
      + 'align-items:center;justify-content:center;'
      + 'font-weight:800;font-size:26px;overflow:hidden;'
      + 'box-shadow:0 4px 16px rgba(200,16,46,0.4);'
      + '}'
      + '.itws-login-logo img{width:100%;height:100%;object-fit:contain;padding:6px;background:var(--itws-navy-alt);}'
      + '@media (max-width:1023px){.itws-login-logo{display:flex;}}'
      + '.itws-login-title{'
      + 'font-size:clamp(24px,4vw,30px);font-weight:800;'
      + 'color:var(--itws-text);margin:0 0 8px;line-height:1.25;'
      + '}'
      + '.itws-login-subtitle{'
      + 'font-size:13.5px;color:var(--itws-text-muted);'
      + 'margin:0;line-height:1.6;'
      + '}'

      /* ===== ALERTS ===== */
      + '.auth-alert{'
      + 'display:none;padding:14px 16px;border-radius:6px;'
      + 'font-size:13px;font-weight:500;margin-bottom:20px;'
      + 'line-height:1.6;text-align:right;'
      + 'border-width:1px;border-style:solid;'
      + '}'
      + '.auth-alert.show{display:block;animation:itwsFadeIn 0.25s ease;}'
      + '.auth-alert.error{background:rgba(200,16,46,0.12);border-color:var(--itws-red);color:#F87171;}'
      + '.auth-alert.success{background:rgba(16,185,129,0.12);border-color:#10B981;color:#34D399;}'
      + '.auth-alert.info{background:var(--itws-gold-soft);border-color:var(--itws-gold);color:var(--itws-gold);}'
      + '@keyframes itwsFadeIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}'

      /* ===== SESSION BANNER ===== */
      + '.itws-session-banner{'
      + 'display:none;padding:16px;margin-bottom:20px;'
      + 'background:var(--itws-navy-alt);'
      + 'border:1px solid var(--itws-gold);'
      + 'border-inline-start:3px solid var(--itws-gold);'
      + 'border-radius:6px;'
      + '}'
      + '.itws-session-banner.is-visible{display:block;animation:itwsFadeIn 0.25s ease;}'
      + '.itws-session-head{display:flex;align-items:center;gap:12px;margin-bottom:12px;}'
      + '.itws-session-icon{'
      + 'width:40px;height:40px;border-radius:6px;'
      + 'background:var(--itws-gold-soft);color:var(--itws-gold);'
      + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;'
      + '}'
      + '.itws-session-text{flex:1;min-width:0;}'
      + '.itws-session-title{font-size:13px;font-weight:700;color:var(--itws-text);margin:0 0 3px;}'
      + '.itws-session-info{font-size:11.5px;color:var(--itws-text-muted);margin:0;word-break:break-word;}'
      + '.itws-session-actions{display:flex;gap:8px;flex-wrap:wrap;}'
      + '.itws-session-btn{'
      + 'flex:1;min-width:120px;padding:9px 16px;'
      + 'border-radius:6px;font-family:inherit;font-size:12.5px;font-weight:600;'
      + 'cursor:pointer;transition:all 0.15s ease;border:1px solid var(--itws-border);'
      + 'background:transparent;color:var(--itws-text-secondary);min-height:40px;'
      + '}'
      + '.itws-session-btn:hover{border-color:var(--itws-gold);color:var(--itws-gold);background:var(--itws-gold-soft);}'
      + '.itws-session-btn.primary{background:var(--itws-red);border-color:var(--itws-red);color:#FFFFFF;}'
      + '.itws-session-btn.primary:hover{background:var(--itws-red-hover);border-color:var(--itws-gold);}'

      /* ===== FORM ===== */
      + '.auth-form{display:flex;flex-direction:column;gap:18px;}'
      + '.form-field{display:flex;flex-direction:column;gap:8px;}'
      + '.form-field label{'
      + 'font-size:13px;font-weight:600;color:var(--itws-text-secondary);'
      + 'letter-spacing:0.2px;'
      + '}'
      + '.input-wrap{position:relative;display:flex;align-items:center;}'
      + '.input-wrap input{'
      + 'width:100%;padding:13px 48px 13px 16px;'
      + 'background:var(--itws-navy-alt);'
      + 'border:1.5px solid var(--itws-border);'
      + 'border-radius:6px;'
      + 'color:var(--itws-text);'
      + 'font-family:inherit;font-size:14px;font-weight:500;'
      + 'transition:all 0.2s ease;outline:none;'
      + 'min-height:48px;'
      + '}'
      + '.input-wrap input:focus{'
      + 'border-color:var(--itws-gold);'
      + 'background:var(--itws-navy-surface);'
      + 'box-shadow:0 0 0 3px var(--itws-gold-soft);'
      + '}'
      + '.input-wrap input::placeholder{color:var(--itws-text-muted);font-weight:400;}'
      + '.input-wrap input[type="email"],.input-wrap input[type="password"]{direction:ltr;text-align:left;}'
      + '.input-icon{'
      + 'position:absolute;right:14px;top:50%;transform:translateY(-50%);'
      + 'color:var(--itws-text-muted);width:18px;height:18px;'
      + 'pointer-events:none;transition:color 0.2s ease;'
      + '}'
      + '.input-wrap input:focus ~ .input-icon{color:var(--itws-gold);}'
      + '.input-toggle{'
      + 'position:absolute;left:10px;top:50%;transform:translateY(-50%);'
      + 'width:34px;height:34px;border-radius:6px;background:transparent;'
      + 'border:none;color:var(--itws-text-muted);cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'transition:all 0.15s ease;padding:0;'
      + '}'
      + '.input-toggle:hover{background:var(--itws-gold-soft);color:var(--itws-gold);}'
      + '.input-toggle svg{width:18px;height:18px;}'

      /* ===== ROW (remember + forgot) ===== */
      + '.form-row{'
      + 'display:flex;align-items:center;justify-content:space-between;gap:12px;'
      + 'flex-wrap:wrap;margin-top:-4px;'
      + '}'
      + '.form-checkbox{'
      + 'display:flex;align-items:center;gap:8px;cursor:pointer;'
      + 'user-select:none;font-size:13px;color:var(--itws-text-secondary);'
      + '}'
      + '.form-checkbox input{width:16px;height:16px;accent-color:var(--itws-red);cursor:pointer;}'
      + '.form-link{'
      + 'font-size:13px;color:var(--itws-gold);text-decoration:none;'
      + 'font-weight:600;transition:color 0.15s ease;'
      + '}'
      + '.form-link:hover{color:#E8BE5C;text-decoration:underline;}'

      /* ===== SUBMIT ===== */
      + '.form-submit{'
      + 'width:100%;padding:14px;'
      + 'background:var(--itws-red);color:#FFFFFF;'
      + 'border:1px solid var(--itws-red);border-radius:6px;'
      + 'font-family:inherit;font-size:15px;font-weight:700;'
      + 'cursor:pointer;transition:all 0.2s ease;'
      + 'display:flex;align-items:center;justify-content:center;gap:10px;'
      + 'margin-top:4px;min-height:52px;letter-spacing:0.3px;'
      + 'box-shadow:0 2px 12px rgba(200,16,46,0.3);'
      + '}'
      + '.form-submit:hover:not(:disabled){'
      + 'background:var(--itws-red-hover);border-color:var(--itws-gold);'
      + 'transform:translateY(-1px);'
      + 'box-shadow:0 4px 20px rgba(212,168,67,0.4);'
      + '}'
      + '.form-submit:disabled{opacity:0.6;cursor:not-allowed;transform:none;}'
      + '.form-submit .spinner{'
      + 'width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);'
      + 'border-top-color:#FFFFFF;border-radius:50%;'
      + 'animation:itwsSpin 0.7s linear infinite;'
      + '}'
      + '@keyframes itwsSpin{to{transform:rotate(360deg);}}'

      /* ===== DIVIDER ===== */
      + '.itws-divider{'
      + 'display:flex;align-items:center;gap:12px;'
      + 'color:var(--itws-text-muted);font-size:12px;font-weight:500;'
      + 'margin:8px 0;'
      + '}'
      + '.itws-divider::before,.itws-divider::after{'
      + 'content:"";flex:1;height:1px;background:var(--itws-border);'
      + '}'

      /* ===== FOOTER LINKS ===== */
      + '.auth-footer{text-align:center;margin-top:24px;}'
      + '.auth-footer p{font-size:13px;color:var(--itws-text-muted);margin:0 0 12px;}'
      + '.auth-footer-link{'
      + 'display:inline-flex;align-items:center;gap:8px;'
      + 'padding:10px 18px;margin:4px;'
      + 'background:transparent;border:1px solid var(--itws-border);'
      + 'border-radius:6px;color:var(--itws-text-secondary);'
      + 'font-family:inherit;font-size:13px;font-weight:600;'
      + 'text-decoration:none;cursor:pointer;transition:all 0.15s ease;'
      + 'min-height:44px;'
      + '}'
      + '.auth-footer-link:hover{'
      + 'border-color:var(--itws-gold);color:var(--itws-gold);'
      + 'background:var(--itws-gold-soft);'
      + '}'
      + '.auth-footer-link svg{width:16px;height:16px;}'

      /* ===== BRAND SIDE (left on desktop) ===== */
      + '.itws-brand-side{'
      + 'display:none;position:relative;'
      + 'background:linear-gradient(135deg,var(--itws-navy-alt) 0%,var(--itws-navy-surface) 100%);'
      + 'border-inline-end:1px solid var(--itws-border);'
      + 'align-items:center;justify-content:center;'
      + 'padding:clamp(40px,6vw,80px) clamp(32px,4vw,56px);'
      + 'overflow:hidden;'
      + '}'
      + '@media (min-width:1024px){.itws-brand-side{display:flex;}}'

      /* Hexagon pattern background */
      + '.itws-brand-side::before{'
      + 'content:"";position:absolute;inset:0;'
      + 'background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3E%3Cpath d=\'M30 0L45 8.66v17.32L30 34.64 15 25.98V8.66z M30 34.64L45 43.3v17.32M30 34.64L15 43.3v17.32\' stroke=\'%23D4A843\' stroke-width=\'0.5\' fill=\'none\' opacity=\'0.08\'/%3E%3C/svg%3E");'
      + 'background-size:60px 60px;'
      + 'opacity:0.6;pointer-events:none;'
      + '}'

      /* Gold radial glow */
      + '.itws-brand-side::after{'
      + 'content:"";position:absolute;inset:0;'
      + 'background:radial-gradient(ellipse 60% 50% at 50% 40%, rgba(212,168,67,0.08) 0%, transparent 60%);'
      + 'pointer-events:none;'
      + '}'

      + '.itws-brand-content{position:relative;z-index:1;text-align:center;max-width:400px;}'
      + '.itws-brand-logo{'
      + 'width:120px;height:120px;margin:0 auto 28px;'
      + 'border-radius:12px;'
      + 'background:linear-gradient(135deg,var(--itws-red),var(--itws-red-hover));'
      + 'border:3px solid var(--itws-gold);'
      + 'color:#FFFFFF;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'font-size:42px;font-weight:800;'
      + 'overflow:hidden;'
      + 'box-shadow:0 0 0 8px rgba(212,168,67,0.1),0 20px 60px rgba(200,16,46,0.3);'
      + 'animation:itwsLogoIn 0.8s cubic-bezier(0.4,0,0.2,1);'
      + '}'
      + '.itws-brand-logo img{width:100%;height:100%;object-fit:contain;padding:12px;background:var(--itws-navy-alt);}'
      + '@keyframes itwsLogoIn{from{opacity:0;transform:scale(0.9);}to{opacity:1;transform:scale(1);}}'

      + '.itws-brand-union{'
      + 'font-size:clamp(20px,2.4vw,26px);font-weight:800;'
      + 'color:var(--itws-text);margin:0 0 8px;line-height:1.3;'
      + 'letter-spacing:-0.3px;'
      + '}'
      + '.itws-brand-committee{'
      + 'font-size:clamp(13px,1.5vw,15px);font-weight:600;'
      + 'color:var(--itws-gold);margin:0 0 32px;line-height:1.5;'
      + 'letter-spacing:0.3px;'
      + '}'

      /* Gold divider line */
      + '.itws-brand-divider{'
      + 'width:60px;height:2px;margin:0 auto 32px;'
      + 'background:linear-gradient(90deg, transparent, var(--itws-gold), transparent);'
      + '}'

      /* President */
      + '.itws-brand-president{'
      + 'padding-top:24px;'
      + 'border-top:1px solid var(--itws-border);'
      + 'display:inline-block;'
      + '}'
      + '.itws-brand-president-label{'
      + 'font-size:11px;font-weight:600;'
      + 'color:var(--itws-text-muted);'
      + 'letter-spacing:1.5px;text-transform:uppercase;'
      + 'margin:0 0 4px;'
      + '}'
      + '.itws-brand-president-name{'
      + 'font-size:clamp(14px,1.7vw,16px);font-weight:700;'
      + 'color:var(--itws-gold);margin:0;line-height:1.4;'
      + '}'

      /* Features */
      + '.itws-brand-features{'
      + 'display:flex;flex-direction:column;gap:10px;'
      + 'text-align:right;margin-top:32px;padding-top:24px;'
      + 'border-top:1px solid var(--itws-border);'
      + '}'
      + '.itws-brand-feature{'
      + 'display:flex;align-items:flex-start;gap:10px;'
      + 'font-size:12.5px;line-height:1.6;'
      + 'color:var(--itws-text-secondary);'
      + '}'
      + '.itws-brand-feature-icon{'
      + 'width:20px;height:20px;border-radius:50%;'
      + 'background:var(--itws-gold-soft);color:var(--itws-gold);'
      + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;'
      + 'margin-top:1px;'
      + '}'
      + '.itws-brand-feature-icon svg{width:11px;height:11px;}'

      /* ===== NOSCRIPT / NO-SB BANNER ===== */
      + '.itws-nosb-banner{'
      + 'padding:14px 16px;margin-bottom:20px;'
      + 'background:rgba(200,16,46,0.1);'
      + 'border:1px solid var(--itws-red);'
      + 'border-radius:6px;'
      + 'color:#F87171;font-size:12.5px;line-height:1.6;'
      + 'display:none;'
      + '}'
      + '.itws-nosb-banner.show{display:block;}'

      /* ===== REDUCED MOTION ===== */
      + '@media (prefers-reduced-motion: reduce){'
      + '.itws-brand-logo{animation:none !important;}'
      + '.form-submit:hover{transform:none;}'
      + '}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     5. ICONS (inline fallback)
     ============================================================ */

  var ICONS = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    logIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
    logOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  function icon(name, size) {
    try {
      if (window.Icons && typeof window.Icons.get === 'function') {
        var svg = window.Icons.get(name, { size: size || 18 });
        if (svg) return svg;
      }
    } catch (e) {}
    return ICONS[name] || '';
  }

  /* ============================================================
     6. ALERTS
     ============================================================ */

  function showAlert(message, type) {
    var el = $('authAlert');
    if (!el) { showToast(message, type); return; }
    el.textContent = message;
    el.className = 'auth-alert show ' + (type || 'info');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    var timeout = type === 'error' ? 12000 : 8000;
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function () {
      if (el.textContent === message) el.className = 'auth-alert';
    }, timeout);
  }

  function hideAlert() {
    var el = $('authAlert');
    if (el) el.className = 'auth-alert';
  }

  /* ============================================================
     7. BUTTON STATE
     ============================================================ */

  function setLoading(isLoading) {
    var btn = $('loginBtn');
    var text = $('loginBtnText');
    if (!btn || !text) return;

    if (isLoading) {
      btn.disabled = true;
      text.innerHTML = '<span class="spinner"></span> ' + getLabel('auth.login.loading', 'جاري التحقق...');
    } else {
      btn.disabled = false;
      text.textContent = getLabel('auth.login.button', 'تسجيل الدخول');
    }
  }

  /* ============================================================
     8. VALIDATION
     ============================================================ */

  function validateEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
  }

  function validateForm() {
    var emailEl = $('emailInput');
    var pwEl = $('passwordInput');
    if (!emailEl || !pwEl) return null;

    var email = emailEl.value.trim();
    var password = pwEl.value;

    if (!email) {
      showAlert(getLabel('auth.login.errors.email_required', 'الرجاء إدخال البريد الإلكتروني'), 'error');
      emailEl.focus();
      return null;
    }
    if (!validateEmail(email)) {
      showAlert(getLabel('auth.login.errors.email_invalid', 'البريد الإلكتروني غير صحيح'), 'error');
      emailEl.focus();
      return null;
    }
    if (!password) {
      showAlert(getLabel('auth.login.errors.password_required', 'الرجاء إدخال كلمة المرور'), 'error');
      pwEl.focus();
      return null;
    }
    var minLen = getSetting('security.password_min_length', 6);
    if (password.length < minLen) {
      showAlert(getLabel('auth.login.errors.password_short', 'كلمة المرور قصيرة جداً') + ' (' + minLen + ')', 'error');
      pwEl.focus();
      return null;
    }
    return { email: email, password: password };
  }

  /* ============================================================
     9. REMEMBER ME
     ============================================================ */

  function loadRememberMe() {
    var saved = safeStorageGet(REMEMBER_KEY);
    if (!saved) return;
    var emailEl = $('emailInput');
    var rememberEl = $('rememberMe');
    if (emailEl) emailEl.value = saved;
    if (rememberEl) rememberEl.checked = true;
  }

  function saveRememberMe() {
    var emailEl = $('emailInput');
    var rememberEl = $('rememberMe');
    if (!emailEl || !rememberEl) return;
    var email = emailEl.value.trim();
    if (rememberEl.checked && email) safeStorageSet(REMEMBER_KEY, email);
    else safeStorageRemove(REMEMBER_KEY);
  }

  /* ============================================================
     10. PASSWORD TOGGLE
     ============================================================ */

  function initPasswordToggle() {
    var toggle = $('passwordToggle');
    var input = $('passwordInput');
    if (!toggle || !input) return;

    toggle.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = show ? ICONS.eyeOff : ICONS.eye;
      toggle.setAttribute('aria-label', show
        ? getLabel('auth.login.hide_password', 'إخفاء كلمة المرور')
        : getLabel('auth.login.show_password', 'إظهار كلمة المرور'));
      input.focus();
    });
  }

  /* ============================================================
     11. REDIRECT
     ============================================================ */

  function getDestForRole(role) {
    if (!role) return 'home.html';
    if (role === 'super_admin' || role === 'committee_head' ||
        role === 'committee_deputy' || role === 'committee_member') {
      return resolve(getSetting('behavior.redirect_admin_to', 'admin/index.html'));
    }
    if (role.indexOf('branch_') === 0) return resolve('branch/index.html');
    if (role === 'academy_owner' || role === 'academy_manager') return resolve('portal/index.html');
    return resolve(getSetting('behavior.redirect_user_to', 'home.html'));
  }

  function getSafeNextParam() {
    try {
      var params = new URLSearchParams(window.location.search);
      var next = params.get('next');
      if (!next) return null;
      var decoded = decodeURIComponent(next);
      if (decoded.indexOf('//') !== -1) return null;
      if (decoded.indexOf(':') !== -1) return null;
      if (decoded.indexOf('..') !== -1) return null;
      return decoded.replace(/^\//, '');
    } catch (e) { return null; }
  }

  function redirectAfterLogin(profile) {
    var dest = getDestForRole(profile ? profile.role : null);
    var next = getSafeNextParam();
    if (next) dest = resolve(next);
    setTimeout(function () { window.location.href = dest; }, 600);
  }

  /* ============================================================
     12. LOG ATTEMPT
     ============================================================ */

  function logAttempt(email, success, errorMessage) {
    var sb = getSb();
    if (!sb) return;
    Promise.resolve().then(function () {
      return sb.from('login_logs').insert({
        email: email, success: success,
        error_message: errorMessage || null,
        user_agent: (navigator.userAgent || '').substring(0, 200)
      });
    }).catch(function () {});
  }

  function logActivity(user, profile) {
    var sb = getSb();
    if (!sb || !user || !profile) return;
    Promise.resolve().then(function () {
      return sb.from('activities').insert({
        actor_id: user.id,
        actor_name: profile.full_name || user.email,
        actor_role: profile.role,
        action_type: 'login',
        resource_type: 'auth',
        resource_id: user.id,
        description: getLabel('activities.login', 'تسجيل دخول'),
        user_agent: (navigator.userAgent || '').substring(0, 200)
      });
    }).catch(function () {});
  }

  /* ============================================================
     13. FETCH PROFILE
     ============================================================ */

  function fetchProfile(userId) {
    var sb = getSb();
    if (!sb) return Promise.reject(new Error('Supabase not available'));
    var query = sb.from('profiles')
      .select('id, email, full_name, phone, avatar_url, role, status, is_active, is_deleted, governorate_id, branch_id, academy_id')
      .eq('id', userId).maybeSingle();
    return withTimeout(query, PROFILE_TIMEOUT_MS, getLabel('auth.login.loading_profile', 'جلب بيانات الحساب'))
      .then(function (res) {
        if (res && res.error) throw new Error(res.error.message);
        return res ? res.data : null;
      });
  }

  /* ============================================================
     14. STATUS HANDLERS
     ============================================================ */

  function signOutSilently() {
    var sb = getSb();
    if (sb && sb.auth) {
      Promise.resolve().then(function () { return sb.auth.signOut(); }).catch(function () {});
    }
  }

  function handlePendingState(profile) {
    signOutSilently();
    showAlert(getLabel('auth.login.pending_title', 'طلبك قيد المراجعة') + '. ' + getLabel('auth.login.pending_msg', 'طلبك في انتظار الموافقة من الإدارة'), 'info');
    dispatchEvent('itws:login-pending', { profile: profile });
  }
  function handleRejectedState(profile) {
    signOutSilently();
    var reason = profile.rejection_reason ? ' — ' + profile.rejection_reason : '';
    showAlert(getLabel('auth.login.rejected_title', 'تم رفض طلبك') + reason, 'error');
  }
  function handleSuspendedState(profile) {
    signOutSilently();
    showAlert(getLabel('auth.login.suspended_title', 'هذا الحساب موقوف') + '. ' + getLabel('auth.login.suspended_msg', 'تواصل مع الإدارة'), 'error');
  }
  function handleInactiveState() {
    signOutSilently();
    showAlert(getLabel('auth.login.inactive_title', 'هذا الحساب معطل') + '. ' + getLabel('auth.login.inactive_msg', 'تواصل مع الإدارة'), 'error');
  }

  /* ============================================================
     15. ERROR MAPPING
     ============================================================ */

  function mapAuthError(error) {
    var code = (error && error.code) || '';
    var msg = (error && error.message) || '';
    var lower = msg.toLowerCase();
    if (code === 'invalid_credentials' || lower.indexOf('invalid login credentials') !== -1) {
      return getLabel('auth.login.errors.invalid_credentials', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    if (code === 'email_not_confirmed' || lower.indexOf('email not confirmed') !== -1) {
      return getLabel('auth.login.errors.email_not_confirmed', 'البريد الإلكتروني لم يتم تأكيده');
    }
    if (lower.indexOf('rate limit') !== -1 || lower.indexOf('too many') !== -1) {
      return getLabel('auth.login.errors.rate_limit', 'محاولات كثيرة. حاول بعد دقيقة');
    }
    if (lower.indexOf('timeout') !== -1 || lower.indexOf('مهلة') !== -1) return msg;
    return msg || getLabel('auth.login.errors.generic', 'فشل تسجيل الدخول');
  }

  /* ============================================================
     16. LOGIN
     ============================================================ */

  function handleLogin(e) {
    if (e) e.preventDefault();
    if (state.submitting) return;
    hideAlert();

    var data = validateForm();
    if (!data) return;

    if (state.attempts >= MAX_ATTEMPTS) {
      showAlert(getLabel('auth.login.errors.too_many_attempts', 'تم تجاوز الحد الأقصى للمحاولات'), 'error');
      return;
    }

    var sb = getSb();
    if (!sb) {
      showAlert(getLabel('errors.network', 'تعذر الاتصال بالخادم') + '. ' + getLabel('errors.reload', 'أعد تحميل الصفحة'), 'error');
      return;
    }

    state.submitting = true;
    setLoading(true);

    var signInPromise;
    if (typeof sb.auth.signInWithPassword === 'function') {
      signInPromise = sb.auth.signInWithPassword({ email: data.email, password: data.password });
    } else if (typeof sb.auth.signInWithEmailAndPassword === 'function') {
      signInPromise = sb.auth.signInWithEmailAndPassword(data.email, data.password);
    } else {
      state.submitting = false; setLoading(false);
      showAlert(getLabel('errors.generic', 'خطأ في النظام'), 'error');
      return;
    }

    withTimeout(signInPromise, AUTH_TIMEOUT_MS, 'تسجيل الدخول')
      .then(function (res) {
        if (res && res.error) throw res.error;
        var user = (res && res.data && res.data.user) || (res && res.user) || null;
        if (!user) throw new Error(getLabel('auth.login.errors.no_user', 'لم يتم استلام البيانات'));
        return fetchProfile(user.id).then(function (profile) {
          if (!profile) {
            signOutSilently();
            throw new Error(getLabel('auth.login.errors.no_profile', 'الحساب غير مكتمل'));
          }
          return { user: user, profile: profile };
        });
      })
      .then(function (result) {
        var user = result.user, profile = result.profile;

        if (profile.is_deleted === true) { handleInactiveState(); logAttempt(data.email, false, 'deleted'); state.submitting = false; setLoading(false); return; }
        if (profile.status === 'pending') { handlePendingState(profile); logAttempt(data.email, true, 'pending'); state.submitting = false; setLoading(false); return; }
        if (profile.status === 'rejected') { handleRejectedState(profile); logAttempt(data.email, true, 'rejected'); state.submitting = false; setLoading(false); return; }
        if (profile.status === 'suspended') { handleSuspendedState(profile); logAttempt(data.email, true, 'suspended'); state.submitting = false; setLoading(false); return; }
        if (profile.status !== 'active' || profile.is_active === false) { handleInactiveState(); logAttempt(data.email, false, 'inactive'); state.submitting = false; setLoading(false); return; }

        logAttempt(data.email, true, null);
        logActivity(user, profile);
        dispatchEvent('itws:login-success', { user: user, profile: profile });

        showAlert(getLabel('auth.login.success', 'تم تسجيل الدخول بنجاح') + '. ' + getLabel('auth.login.redirecting', 'جاري التحويل...'), 'success');

        try {
          if (window.Permissions && typeof window.Permissions.setProfile === 'function') {
            window.Permissions.setProfile(profile);
          }
        } catch (err) {}

        state.submitting = false; setLoading(false);
        redirectAfterLogin(profile);
      })
      .catch(function (error) {
        state.attempts++;
        state.submitting = false; setLoading(false);
        var msg = mapAuthError(error);
        showAlert(msg, 'error');
        logAttempt(data.email, false, msg);
        var pwEl = $('passwordInput');
        if (pwEl) { pwEl.value = ''; pwEl.focus(); }
        dispatchEvent('itws:login-failed', { error: error, attempts: state.attempts });
      });
  }

  /* ============================================================
     17. FORGOT PASSWORD
     ============================================================ */

  function handleForgot(e) {
    if (e) e.preventDefault();
    var emailEl = $('emailInput');
    if (!emailEl) return;
    var email = emailEl.value.trim();
    if (!email || !validateEmail(email)) {
      showAlert(getLabel('auth.login.errors.email_for_reset', 'أدخل بريدك الإلكتروني أولاً'), 'error');
      emailEl.focus();
      return;
    }
    var sb = getSb();
    if (!sb) { showAlert(getLabel('errors.network', 'تعذر الاتصال'), 'error'); return; }

    showAlert(getLabel('auth.login.sending_reset', 'جاري إرسال رابط الاستعادة...'), 'info');
    var redirectTo = window.location.origin + window.location.pathname.replace(/login\.html.*/, 'reset-password.html');
    var resetPromise = sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });

    withTimeout(resetPromise, AUTH_TIMEOUT_MS, 'إرسال الرابط')
      .then(function () {
        showAlert(getLabel('auth.login.reset_sent', 'تم إرسال رابط الاستعادة. تحقق من بريدك'), 'success');
      })
      .catch(function (err) {
        if (err && err.code === 'user_not_found') {
          showAlert(getLabel('auth.login.reset_sent', 'تم إرسال رابط الاستعادة. تحقق من بريدك'), 'success');
          return;
        }
        showAlert((err && err.message) || getLabel('auth.login.errors.reset_failed', 'تعذر الإرسال'), 'error');
      });
  }

  /* ============================================================
     18. SESSION BANNER
     ============================================================ */

  function showSessionBanner(user, profile) {
    state.existingUser = user;
    state.existingProfile = profile;

    var banner = $('authSessionBanner');
    if (!banner) {
      // Inject banner into form area
      var formInner = document.querySelector('.itws-login-form-inner') || document.querySelector('.auth-form-wrapper');
      if (!formInner) return;
      var header = formInner.querySelector('.itws-login-header') || formInner.querySelector('.auth-header');
      if (!header) return;

      banner = document.createElement('div');
      banner.id = 'authSessionBanner';
      banner.className = 'itws-session-banner';
      banner.setAttribute('role', 'status');
      banner.innerHTML = ''
        + '<div class="itws-session-head">'
        +   '<div class="itws-session-icon">' + icon('user', 18) + '</div>'
        +   '<div class="itws-session-text">'
        +     '<p class="itws-session-title" id="authSessionTitle">' + escapeHtml(getLabel('auth.session.title', 'لديك جلسة نشطة')) + '</p>'
        +     '<p class="itws-session-info" id="authSessionText"></p>'
        +   '</div>'
        + '</div>'
        + '<div class="itws-session-actions">'
        +   '<button type="button" class="itws-session-btn primary" id="authSessionContinue">' + escapeHtml(getLabel('auth.session.continue', 'متابعة')) + '</button>'
        +   '<button type="button" class="itws-session-btn" id="authSessionLogout">' + escapeHtml(getLabel('auth.session.logout', 'تسجيل الخروج')) + '</button>'
        + '</div>';
      header.parentNode.insertBefore(banner, header.nextSibling);

      // Bind events
      var continueBtn = banner.querySelector('#authSessionContinue');
      if (continueBtn) continueBtn.addEventListener('click', handleSessionContinue);
      var logoutBtn = banner.querySelector('#authSessionLogout');
      if (logoutBtn) logoutBtn.addEventListener('click', handleSessionLogout);
    }

    var name = (profile && profile.full_name) || (user && user.email) || '';
    var textEl = $('authSessionText');
    if (textEl) {
      textEl.textContent = name
        ? getLabel('auth.session.signed_in_as', 'مسجل الدخول كـ') + ' ' + name
        : getLabel('auth.session.signed_in', 'لديك جلسة نشطة على هذا الجهاز');
    }
    banner.classList.add('is-visible');
  }

  function hideSessionBanner() {
    var banner = $('authSessionBanner');
    if (banner) banner.classList.remove('is-visible');
    state.existingUser = null;
    state.existingProfile = null;
  }

  function checkExistingSession() {
    var sb = getSb();
    if (!sb || !sb.auth) return Promise.resolve();
    return withTimeout(sb.auth.getSession(), SESSION_TIMEOUT_MS, 'فحص الجلسة')
      .then(function (res) {
        var session = res && res.data && res.data.session;
        if (!session || !session.user) return;
        return fetchProfile(session.user.id).then(function (profile) {
          if (!profile) return;
          if (profile.status !== 'active' || profile.is_active === false || profile.is_deleted === true) return;
          showSessionBanner(session.user, profile);
          dispatchEvent('itws:session-banner-shown', { profile: profile });
        });
      })
      .catch(function () {});
  }

  function handleSessionLogout() {
    var btn = $('authSessionLogout');
    if (btn) { btn.disabled = true; btn.textContent = getLabel('auth.session.logging_out', 'جاري الخروج...'); }

    var doLogout = (window.Session && typeof window.Session.logout === 'function')
      ? window.Session.logout
      : function () {
          var sb = getSb();
          if (sb && sb.auth) return sb.auth.signOut().catch(function () {});
          return Promise.resolve();
        };

    Promise.resolve(doLogout()).catch(function () {}).then(function () {
      hideSessionBanner();
      hideAlert();
      showAlert(getLabel('auth.logout.success', 'تم تسجيل الخروج'), 'success');
      if (btn) { btn.disabled = false; btn.textContent = getLabel('auth.session.logout', 'تسجيل الخروج'); }
      var emailEl = $('emailInput');
      if (emailEl) emailEl.focus();
    });
  }

  function handleSessionContinue() {
    if (!state.existingProfile) { window.location.reload(); return; }
    showAlert(getLabel('auth.login.redirecting', 'جاري التحويل...'), 'info');
    redirectAfterLogin(state.existingProfile);
  }

  /* ============================================================
     19. BUILD OFFICIAL LAYOUT
     ============================================================ */

  function buildOfficialLayout() {
    var body = document.body;
    if (!body) return;

    // Get existing form elements
    var existingForm = $('loginForm');
    var existingAlert = $('authAlert');
    if (!existingForm) return;

    // Extract existing form fields
    var emailInput = $('emailInput');
    var passwordInput = $('passwordInput');
    var passwordToggle = $('passwordToggle');
    var rememberMe = $('rememberMe');
    var forgotLink = $('forgotLink');
    var loginBtn = $('loginBtn');
    var loginBtnText = $('loginBtnText');

    if (!emailInput || !passwordInput || !loginBtn) return;

    // Get settings
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var committeeName = getSetting('app_identity.committee_name', 'لجنة التحول الرقمي والتدريب');
    var presidentName = getSetting('app_identity.president_name', 'المحاسب / محمود جميل');
    var presidentLabel = getSetting('app_identity.president_label', 'النقيب العام');
    var logoUrl = getSetting('app_identity.logo_url', '');
    var showBrandSide = getSetting('login.show_branding_side', true) !== false;

    // Features
    var features = getSetting('app_identity.login_features', null);
    if (!Array.isArray(features) || features.length === 0) {
      features = [
        { text: getLabel('login.feature_1', 'التحقق الرسمي من صحة الشهادات التدريبية') },
        { text: getLabel('login.feature_2', 'قاعدة بيانات مركزية لجميع الأكاديميات المعتمدة') },
        { text: getLabel('login.feature_3', 'نظام اعتماد رسمي يضمن جودة التدريب') },
        { text: getLabel('login.feature_4', 'شهادات موثقة مع QR للتحقق السريع') }
      ];
    }

    // Logo HTML
    var logoHtml = logoUrl
      ? '<img src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(unionName) + '" onerror="this.parentNode.textContent=\'ن\';">'
      : escapeHtml((unionName || 'ن').charAt(0));

    // Build new structure
    var wrapper = document.createElement('div');
    wrapper.className = 'itws-login';

    // ─── Form side ───
    var formSide = document.createElement('div');
    formSide.className = 'itws-login-form';

    var formInner = document.createElement('div');
    formInner.className = 'itws-login-form-inner';

    // Header
    var header = document.createElement('div');
    header.className = 'itws-login-header';
    header.innerHTML = ''
      + '<div class="itws-login-logo">' + logoHtml + '</div>'
      + '<h1 class="itws-login-title">' + escapeHtml(getLabel('auth.login.title', 'تسجيل الدخول')) + '</h1>'
      + '<p class="itws-login-subtitle">' + escapeHtml(getLabel('auth.login.subtitle', 'مرحباً بك في النظام الرسمي')) + '</p>';
    formInner.appendChild(header);

    // No-SB banner (hidden by default)
    var nosbBanner = document.createElement('div');
    nosbBanner.id = 'itwsNosbBanner';
    nosbBanner.className = 'itws-nosb-banner';
    nosbBanner.innerHTML = icon('info', 14) + ' <strong>' + escapeHtml(getLabel('login.nosb_title', 'إعدادات الاتصال غير مكتملة')) + '</strong>: '
      + escapeHtml(getLabel('login.nosb_text', 'تحقق من config.js — بدون اتصال، لن يعمل تسجيل الدخول'));
    formInner.appendChild(nosbBanner);

    // Alert
    if (existingAlert) {
      formInner.appendChild(existingAlert);
    } else {
      var alertEl = document.createElement('div');
      alertEl.id = 'authAlert';
      alertEl.className = 'auth-alert';
      formInner.appendChild(alertEl);
    }

    // Form (move existing)
    formInner.appendChild(existingForm);
    formSide.appendChild(formInner);

    // ─── Brand side ───
    var brandSide = document.createElement('div');
    brandSide.className = 'itws-brand-side';

    var brandContent = document.createElement('div');
    brandContent.className = 'itws-brand-content';

    var featuresHtml = features.map(function (f) {
      return '<div class="itws-brand-feature">'
        + '<div class="itws-brand-feature-icon">' + ICONS.check + '</div>'
        + '<div>' + escapeHtml(f.text || '') + '</div>'
        + '</div>';
    }).join('');

    brandContent.innerHTML = ''
      + '<div class="itws-brand-logo">' + logoHtml + '</div>'
      + '<h2 class="itws-brand-union">' + escapeHtml(unionName) + '</h2>'
      + '<p class="itws-brand-committee">' + escapeHtml(committeeName) + '</p>'
      + '<div class="itws-brand-divider"></div>'
      + '<div class="itws-brand-president">'
      +   '<p class="itws-brand-president-label">' + escapeHtml(presidentLabel) + '</p>'
      +   '<p class="itws-brand-president-name">' + escapeHtml(presidentName) + '</p>'
      + '</div>'
      + '<div class="itws-brand-features">' + featuresHtml + '</div>';
    brandSide.appendChild(brandContent);

    // Assemble
    wrapper.appendChild(formSide);
    if (showBrandSide) wrapper.appendChild(brandSide);

    // Replace body content
    body.innerHTML = '';
    body.appendChild(wrapper);
  }

  /* ============================================================
     20. INIT FORM BINDINGS (after layout build)
     ============================================================ */

  function bindFormEvents() {
    var form = $('loginForm');
    if (form && !form._loginBound) {
      form._loginBound = true;
      form.addEventListener('submit', function (e) {
        saveRememberMe();
        handleLogin(e);
      });
    }

    var forgotLink = $('forgotLink');
    if (forgotLink && !forgotLink._loginBound) {
      forgotLink._loginBound = true;
      forgotLink.addEventListener('click', handleForgot);
    }

    var emailInput = $('emailInput');
    var pwInput = $('passwordInput');
    [emailInput, pwInput].forEach(function (el) {
      if (el && !el._loginBound) {
        el._loginBound = true;
        el.addEventListener('input', hideAlert);
      }
    });
  }

  /* ============================================================
     21. UPDATE CONTENT (on settings change)
     ============================================================ */

  function updateContent() {
    // Rebuild the whole layout with new settings
    buildOfficialLayout();
    bindFormEvents();
    initPasswordToggle();
    loadRememberMe();
  }

  /* ============================================================
     22. CHECK SB STATUS
     ============================================================ */

  function checkSbStatus() {
    var sb = getSb();
    var banner = $('itwsNosbBanner');
    if (!banner) return;

    if (!sb) {
      banner.classList.add('show');
      // Disable form
      var btn = $('loginBtn');
      if (btn) {
        btn.disabled = true;
        btn.title = getLabel('login.nosb_title', 'إعدادات الاتصال غير مكتملة');
      }
    } else {
      banner.classList.remove('show');
    }
  }

  /* ============================================================
     23. INIT
     ============================================================ */

  function init() {
    if (state._initialized) return;
    state._initialized = true;

    injectStyles();

    // Build official layout (replaces old one)
    buildOfficialLayout();

    // Bind events
    bindFormEvents();
    initPasswordToggle();
    loadRememberMe();

    // Check sb
    checkSbStatus();

    // Load session (may show banner)
    checkExistingSession();

    // URL flags
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('pending') === '1') showAlert(getLabel('auth.login.pending_title', 'طلبك قيد المراجعة') + '. ' + getLabel('auth.login.pending_msg', 'في انتظار الموافقة'), 'info');
      else if (params.get('rejected') === '1') showAlert(getLabel('auth.login.rejected_title', 'تم رفض طلبك'), 'error');
      else if (params.get('suspended') === '1') showAlert(getLabel('auth.login.suspended_title', 'هذا الحساب موقوف'), 'error');
      else if (params.get('inactive') === '1') showAlert(getLabel('auth.login.inactive_title', 'هذا الحساب معطل'), 'error');
    } catch (e) {}

    // Settings changes
    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      state.settingsUnsub = window.AppSettings.onChange(function (s, key) {
        if (!key || key === 'app_identity' || key === 'login') {
          updateContent();
        }
      });
    }

    // Wait for sb-ready
    window.addEventListener('itws:sb-ready', function () {
      checkSbStatus();
    });

    // Focus management
    setTimeout(function () {
      var emailEl = $('emailInput');
      var pwEl = $('passwordInput');
      if (emailEl && !emailEl.value) emailEl.focus();
      else if (pwEl) pwEl.focus();
    }, 300);

    log('debug', 'Login page ready');
  }

  /* ============================================================
     24. EXPORT
     ============================================================ */

  window.LoginPage = {
    _initialized: true,
    init: init,
    refresh: updateContent,
    checkSession: checkExistingSession,
    getState: function () {
      return {
        submitting: state.submitting,
        attempts: state.attempts,
        hasExistingSession: !!(state.existingUser && state.existingProfile)
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[LoginPage]', 'color: #D4A843; font-weight: bold;', 'Official login ready');
    } catch (e) {}
  }

})();
