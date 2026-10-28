/* ============================================================
   ITWS Platform — Header Component V5
   File: assets/js/ui/header.js
   
   Renders header into #headerContainer for secondary pages.
   Home.html has its own inline navbar — doesn't need this.
   ============================================================ */

(function () {
  'use strict';

  if (window.Header && window.Header._initialized) return;

  var state = {
    mounted: false,
    containerId: null,
    rootEl: null,
    profile: null,
    mobileOpen: false,
    themeOpen: false,
    themeUnsub: null,
    settingsUnsub: null,
    clickHandler: null
  };

  /* ============================================================
     HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Header]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || null;
  }

  function getSetting(path, fallback) {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get(path);
        if (v !== undefined && v !== null) return v;
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

  function $(id) { return document.getElementById(id); }

  /* ============================================================
     CSS INJECTION (uses theme.css variables)
     ============================================================ */

  var STYLE_ID = 'itws-header-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = ''
      + '.itws-navbar{position:fixed;top:0;left:0;right:0;z-index:900;'
      + 'background:rgba(10,12,20,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);'
      + 'border-bottom:1px solid var(--border);padding-top:env(safe-area-inset-top);'
      + 'transition:all 0.25s ease;font-family:var(--font-main,"Cairo",sans-serif);}'
      + '.itws-navbar.scrolled{background:rgba(10,12,20,0.95);box-shadow:0 4px 20px rgba(0,0,0,0.3);}'
      + '.itws-nav-container{max-width:1280px;margin:0 auto;padding:0 clamp(16px,3vw,32px);'
      + 'height:76px;display:flex;align-items:center;gap:20px;}'
      + '.itws-nav-logo{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;flex-shrink:0;}'
      + '.itws-logo-badge{width:46px;height:46px;border-radius:12px;'
      + 'background:linear-gradient(135deg,var(--accent),var(--accent-2));'
      + 'display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;'
      + 'box-shadow:0 0 20px rgba(var(--accent-rgb),0.3);}'
      + '.itws-logo-badge img{width:100%;height:100%;object-fit:contain;padding:4px;}'
      + '.itws-logo-badge svg{width:26px;height:26px;stroke:#000;fill:none;stroke-width:2.5;'
      + 'stroke-linecap:round;stroke-linejoin:round;}'
      + '.itws-logo-text{display:flex;flex-direction:column;line-height:1.2;}'
      + '.itws-logo-main{font-family:var(--font-heading,"Alexandria",sans-serif);'
      + 'font-size:15px;font-weight:800;color:var(--text);white-space:nowrap;'
      + 'max-width:240px;overflow:hidden;text-overflow:ellipsis;}'
      + '.itws-logo-sub{font-family:var(--font-mono,monospace);font-size:10px;font-weight:600;'
      + 'color:var(--accent);letter-spacing:1.5px;text-transform:uppercase;}'
      + '@media(min-width:640px){.itws-logo-text{display:flex;}}'
      + '.itws-nav-links{display:none;align-items:center;gap:4px;flex:1;justify-content:center;}'
      + '.itws-nav-links a{padding:10px 16px;border-radius:8px;color:var(--text-muted);'
      + 'font-size:12.5px;font-weight:700;text-decoration:none;transition:all 0.15s ease;'
      + 'white-space:nowrap;min-height:44px;display:inline-flex;align-items:center;}'
      + '.itws-nav-links a:hover{color:var(--accent);background:rgba(var(--accent-rgb),0.08);}'
      + '.itws-nav-links a.active{color:var(--accent);background:rgba(var(--accent-rgb),0.1);'
      + 'box-shadow:inset 0 -2px 0 var(--accent);}'
      + '@media(min-width:1024px){.itws-nav-links{display:flex;}}'
      + '.itws-nav-actions{display:flex;align-items:center;gap:8px;margin-inline-start:auto;}'
      + '@media(min-width:1024px){.itws-nav-actions{margin-inline-start:0;}}'
      + '.itws-icon-btn{width:44px;height:44px;border-radius:10px;background:rgba(var(--accent-rgb),0.06);'
      + 'border:1px solid var(--border);color:var(--text-muted);display:inline-flex;'
      + 'align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s ease;padding:0;flex-shrink:0;}'
      + '.itws-icon-btn:hover{background:rgba(var(--accent-rgb),0.12);border-color:rgba(var(--accent-rgb),0.3);'
      + 'color:var(--accent);box-shadow:0 0 20px rgba(var(--accent-rgb),0.3);}'
      + '.itws-icon-btn svg{width:20px;height:20px;stroke-width:2;fill:none;stroke:currentColor;'
      + 'stroke-linecap:round;stroke-linejoin:round;}'
      + '.itws-btn-login{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;'
      + 'background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#000;'
      + 'border-radius:10px;font-weight:700;font-size:12.5px;text-decoration:none;'
      + 'transition:all 0.25s ease;box-shadow:0 4px 12px rgba(var(--accent-rgb),0.3);}'
      + '.itws-btn-login:hover{transform:translateY(-1px);'
      + 'box-shadow:0 8px 24px rgba(var(--accent-rgb),0.5);}'
      + '.itws-btn-login svg{width:16px;height:16px;stroke-width:2;fill:none;stroke:currentColor;}'
      + '.itws-theme-panel{position:fixed;top:calc(76px + 16px);'
      + 'inset-inline-end:clamp(16px,3vw,32px);width:320px;max-width:calc(100vw - 32px);'
      + 'background:var(--card-bg-solid);border:1px solid rgba(var(--accent-rgb),0.25);'
      + 'border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5);z-index:1000;'
      + 'opacity:0;transform:translateY(-10px);pointer-events:none;transition:all 0.25s ease;'
      + 'max-height:calc(100vh - 120px);overflow-y:auto;}'
      + '.itws-theme-panel.open{opacity:1;transform:translateY(0);pointer-events:auto;}'
      + '.itws-theme-panel-header{padding:16px 20px;border-bottom:1px solid var(--border);'
      + 'display:flex;align-items:center;justify-content:space-between;}'
      + '.itws-theme-panel-header h4{font-family:var(--font-heading);font-size:16px;'
      + 'font-weight:800;color:var(--text);margin:0;}'
      + '.itws-theme-grid{padding:16px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}'
      + '.itws-theme-option{padding:14px 12px;border:1.5px solid var(--border);'
      + 'border-radius:12px;background:rgba(0,0,0,0.15);cursor:pointer;'
      + 'transition:all 0.15s ease;text-align:center;font-family:inherit;}'
      + '.itws-theme-option:hover{border-color:rgba(var(--accent-rgb),0.4);transform:translateY(-2px);}'
      + '.itws-theme-option.is-active{border-color:var(--accent);'
      + 'box-shadow:0 0 20px rgba(var(--accent-rgb),0.3);}'
      + '.itws-theme-swatch{width:100%;height:40px;border-radius:8px;margin-bottom:8px;}'
      + '.itws-theme-name{font-size:11px;font-weight:700;color:var(--text);}'
      + '.itws-theme-panel-footer{padding:12px 16px;border-top:1px solid var(--border);}'
      + '.itws-theme-reset{width:100%;padding:10px;background:transparent;'
      + 'border:1px solid rgba(var(--accent-rgb),0.4);border-radius:8px;color:var(--accent);'
      + 'font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.15s ease;}'
      + '.itws-theme-reset:hover{background:rgba(var(--accent-rgb),0.08);'
      + 'border-color:var(--accent);box-shadow:0 0 20px rgba(var(--accent-rgb),0.3);}'
      + '.itws-mobile-overlay{position:fixed;top:76px;left:0;right:0;'
      + 'background:var(--card-bg-solid);border-bottom:1px solid var(--border);'
      + 'padding:16px;display:none;flex-direction:column;gap:4px;z-index:899;'
      + 'animation:itwsSlideDown 0.3s ease;}'
      + '.itws-mobile-overlay.open{display:flex;}'
      + '.itws-mobile-overlay a{padding:12px 16px;border-radius:8px;color:var(--text-muted);'
      + 'font-size:14px;font-weight:700;text-decoration:none;transition:all 0.15s ease;'
      + 'min-height:44px;display:flex;align-items:center;}'
      + '.itws-mobile-overlay a:hover,.itws-mobile-overlay a.active{color:var(--accent);'
      + 'background:rgba(var(--accent-rgb),0.1);}'
      + '@keyframes itwsSlideDown{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}'
      + '@media(max-width:1023px){.itws-mobile-toggle{display:inline-flex;}}'
      + '@media(min-width:1024px){.itws-mobile-toggle{display:none;}}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     ICONS
     ============================================================ */

  var ICONS = {
    logo: '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 0-4 6 6 0 0 1 0-12 2 2 0 0 0 0-4z"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    x: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    login: '<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>'
  };

  function icon(name) {
    return ICONS[name] || ICONS.logo;
  }

  /* ============================================================
     NAV ITEMS
     ============================================================ */

  function getNavItems() {
    return [
      { href: 'home.html', label: 'الرئيسية', activeOn: 'home.html' },
      { href: 'verify.html', label: 'التحقق', activeOn: 'verify.html' },
      { href: 'student.html', label: 'صفحة المتدرب', activeOn: 'student.html' },
      { href: 'academies.html', label: 'الأكاديميات', activeOn: 'academies.html' },
      { href: 'track.html', label: 'متابعة الطلب', activeOn: 'track.html' }
    ];
  }

  function isActive(item) {
    try {
      var path = window.location.pathname || '';
      var filename = path.split('/').pop() || 'index.html';
      return item.activeOn === filename;
    } catch (e) { return false; }
  }

  /* ============================================================
     RENDER
     ============================================================ */

  function renderNavbar() {
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var unionNameEn = getSetting('app_identity.union_name_en', 'IT WORKERS SYNDICATE');
    var logoUrl = getSetting('app_identity.logo_url', '');

    var navItems = getNavItems();
    var isGuest = !state.profile;

    var logoHtml = logoUrl
      ? '<img src="' + escapeHtml(logoUrl) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';"><span style="display:none">' + icon('logo') + '</span>'
      : icon('logo');

    var navHtml = '';
    var mobileHtml = '';
    for (var i = 0; i < navItems.length; i++) {
      var item = navItems[i];
      var active = isActive(item) ? ' active' : '';
      navHtml += '<a href="' + escapeHtml(resolve(item.href)) + '" class="' + (active ? 'active' : '') + '">' + escapeHtml(item.label) + '</a>';
      mobileHtml += '<a href="' + escapeHtml(resolve(item.href)) + '" class="' + (active ? 'active' : '') + '">' + escapeHtml(item.label) + '</a>';
    }

    var loginHtml = '';
    if (isGuest) {
      loginHtml = '<a href="' + escapeHtml(resolve('login.html')) + '" class="itws-btn-login">'
        + icon('login')
        + '<span>دخول</span>'
        + '</a>';
    }

    return ''
      + '<header class="itws-navbar" id="itwsNavbar">'
      +   '<div class="itws-nav-container">'
      +     '<a href="' + escapeHtml(resolve('home.html')) + '" class="itws-nav-logo">'
      +       '<div class="itws-logo-badge">' + logoHtml + '</div>'
      +       '<div class="itws-logo-text">'
      +         '<div class="itws-logo-main">' + escapeHtml(unionName) + '</div>'
      +         '<div class="itws-logo-sub">' + escapeHtml(unionNameEn) + '</div>'
      +       '</div>'
      +     '</a>'
      +     '<nav class="itws-nav-links">' + navHtml + loginHtml + '</nav>'
      +     '<div class="itws-nav-actions">'
      +       '<button type="button" class="itws-icon-btn" id="itwsThemeBtn" aria-label="الثيمات">' + icon('palette') + '</button>'
      +       '<button type="button" class="itws-icon-btn itws-mobile-toggle" id="itwsMobileBtn" aria-label="القائمة">' + icon('menu') + '</button>'
      +     '</div>'
      +   '</div>'
      + '</header>'
      + '<div class="itws-mobile-overlay" id="itwsMobileOverlay">'
      +   mobileHtml
      +   (isGuest ? '<a href="' + escapeHtml(resolve('login.html')) + '" class="itws-btn-login" style="justify-content:center;">' + icon('login') + '<span>دخول</span></a>' : '')
      + '</div>'
      + '<div class="itws-theme-panel" id="itwsThemePanel">'
      +   '<div class="itws-theme-panel-header">'
      +     '<h4>اختر الثيم</h4>'
      +     '<button type="button" class="itws-icon-btn" id="itwsThemeClose" aria-label="إغلاق">' + icon('x') + '</button>'
      +   '</div>'
      +   '<div class="itws-theme-grid" id="itwsThemeGrid"></div>'
      +   '<div class="itws-theme-panel-footer">'
      +     '<button type="button" class="itws-theme-reset" id="itwsThemeReset">إعادة تعيين</button>'
      +   '</div>'
      + '</div>';
  }

  /* ============================================================
     THEME GRID
     ============================================================ */

  function buildThemeGrid() {
    var grid = document.getElementById('itwsThemeGrid');
    if (!grid) return;

    var themes = window.ITWSTheme ? window.ITWSTheme.getAll() : [];
    var current = window.ITWSTheme ? window.ITWSTheme.getCurrent() : '';

    grid.innerHTML = '';
    for (var i = 0; i < themes.length; i++) {
      var t = themes[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'itws-theme-option' + (t.id === current ? ' is-active' : '');
      btn.setAttribute('data-theme-id', t.id);
      btn.innerHTML =
        '<div class="itws-theme-swatch" style="background:linear-gradient(135deg,' + t.accent + ',' + t.accent2 + ');"></div>' +
        '<div class="itws-theme-name">' + escapeHtml(t.name_ar || t.id) + '</div>';

      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-theme-id');
        if (window.ITWSTheme) window.ITWSTheme.change(id);
        var opts = grid.querySelectorAll('.itws-theme-option');
        for (var j = 0; j < opts.length; j++) {
          opts[j].classList.toggle('is-active', opts[j].getAttribute('data-theme-id') === id);
        }
      });

      grid.appendChild(btn);
    }
  }

  /* ============================================================
     EVENTS
     ============================================================ */

  function bindEvents() {
    var navbar = document.getElementById('itwsNavbar');
    var mobileBtn = document.getElementById('itwsMobileBtn');
    var mobileOverlay = document.getElementById('itwsMobileOverlay');
    var themeBtn = document.getElementById('itwsThemeBtn');
    var themePanel = document.getElementById('itwsThemePanel');
    var themeClose = document.getElementById('itwsThemeClose');
    var themeReset = document.getElementById('itwsThemeReset');

    if (mobileBtn && mobileOverlay) {
      mobileBtn.addEventListener('click', function () {
        mobileOverlay.classList.toggle('open');
      });
    }

    if (themeBtn && themePanel) {
      themeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        themePanel.classList.toggle('open');
        if (themePanel.classList.contains('open')) {
          buildThemeGrid();
        }
      });
    }

    if (themeClose && themePanel) {
      themeClose.addEventListener('click', function () {
        themePanel.classList.remove('open');
      });
    }

    if (themeReset) {
      themeReset.addEventListener('click', function () {
        if (window.ITWSTheme) {
          window.ITWSTheme.reset();
          buildThemeGrid();
        }
      });
    }

    // Close on outside click
    if (state.clickHandler) {
      document.removeEventListener('click', state.clickHandler);
    }
    state.clickHandler = function (e) {
      if (themePanel && themePanel.classList.contains('open')) {
        if (!themePanel.contains(e.target) && !themeBtn.contains(e.target)) {
          themePanel.classList.remove('open');
        }
      }
    };
    document.addEventListener('click', state.clickHandler);

    // Scroll shadow
    if (navbar) {
      window.addEventListener('scroll', function () {
        if (window.scrollY > 30) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
      }, { passive: true });
    }
  }

  /* ============================================================
     AUTH
     ============================================================ */

  function loadAuth() {
    var sb = getSb();
    if (!sb || !sb.auth) return Promise.resolve();

    return sb.auth.getUser().then(function (res) {
      var user = res && res.data && res.data.user;
      if (!user) { state.profile = null; return; }
      return sb.from('profiles')
        .select('id, full_name, email, avatar_url, role, status')
        .eq('id', user.id)
        .maybeSingle()
        .then(function (r) {
          state.profile = (r && r.data) ? r.data : null;
        });
    }).catch(function () {
      state.profile = null;
    });
  }

  /* ============================================================
     RENDER + MOUNT
     ============================================================ */

  function render() {
    if (!state.rootEl) return;
    state.rootEl.innerHTML = renderNavbar();
    bindEvents();
    buildThemeGrid();
  }

  function mount(containerId) {
    if (typeof containerId !== 'string') containerId = 'headerContainer';
    var container = document.getElementById(containerId);
    if (!container) {
      log('error', 'Container not found: ' + containerId);
      return;
    }

    injectStyles();
    state.containerId = containerId;
    state.rootEl = container;

    // Render immediately
    render();
    state.mounted = true;

    // Background auth
    loadAuth().then(function () {
      render();
    }).catch(function () {});

    // Re-render on settings change
    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      if (state.settingsUnsub) { try { state.settingsUnsub(); } catch (e) {} }
      state.settingsUnsub = window.AppSettings.onChange(function (s, key) {
        if (!key || key === 'app_identity') render();
      });
    }

    // Re-build theme grid on theme change
    if (window.ITWSTheme && typeof window.ITWSTheme.onChange === 'function') {
      if (state.themeUnsub) { try { state.themeUnsub(); } catch (e) {} }
      state.themeUnsub = window.ITWSTheme.onChange(function () {
        buildThemeGrid();
      });
    }
  }

  /* ============================================================
     EXPORT
     ============================================================ */

  window.Header = {
    _initialized: true,
    mount: mount,
    render: render,
    isMounted: function () { return state.mounted; },
    getProfile: function () { return state.profile; }
  };

  window.mountHeader = mount;

  /* ============================================================
     AUTO-MOUNT
     ============================================================ */

  function autoMount() {
    var container = document.getElementById('headerContainer');
    if (!container) return;
    if (container.children.length > 0) return;
    mount('headerContainer');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  try {
    console.log('%c[Header]', 'color: #00f0ff; font-weight: bold;', 'Ready');
  } catch (e) {}

})();
