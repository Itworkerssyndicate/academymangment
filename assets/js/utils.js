/* ============================================================
   ITWS Platform — Utilities V2
   File: assets/js/utils.js
   Description: 17 categories of helper functions

   Load order: AFTER config.js + icons.js

   Features:
   - DOM helpers ($, $$, createEl, on, off, ...)
   - String utilities (escapeHtml, truncate, slugify, ...)
   - Number formatting (Arabic/English)
   - Date formatting (Arabic, relative, ISO)
   - Validation (email, phone, url, national_id, ...)
   - Storage (safe localStorage)
   - Object utilities (clone, merge, pick, omit, ...)
   - Function utilities (debounce, throttle, once, retry)
   - Async (sleep, withTimeout)
   - Clipboard (copy)
   - File (download, size, read)
   - URL (query params)
   - Toast (unified notifications)
   - Scroll (smooth, lock)
   - Device detection
   - Misc (uuid, randomInt)

   Rules:
   - No emoji
   - ES5-style IIFE
   - No external dependencies
   - All functions are pure where possible
   ============================================================ */

(function () {
  'use strict';

  if (window.Utils && window.Utils._initialized) {
    return;
  }

  /* ============================================================
     0. LOGGING
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Utils]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  /* ============================================================
     1. DOM HELPERS
     ============================================================ */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    var nl = (root || document).querySelectorAll(selector);
    return Array.prototype.slice.call(nl);
  }

  function createEl(tag, attrs, children) {
    if (!tag) return null;
    var el = document.createElement(tag);

    if (attrs && typeof attrs === 'object') {
      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val === null || val === undefined) return;

        if (key === 'className' || key === 'class') {
          el.className = String(val);
        } else if (key === 'textContent' || key === 'text') {
          el.textContent = String(val);
        } else if (key === 'innerHTML' || key === 'html') {
          el.innerHTML = String(val);
        } else if (key === 'style' && typeof val === 'object') {
          Object.keys(val).forEach(function (prop) {
            el.style[prop] = val[prop];
          });
        } else if (key.indexOf('data-') === 0 || key.indexOf('aria-') === 0) {
          el.setAttribute(key, String(val));
        } else if (key === 'on' && typeof val === 'object') {
          Object.keys(val).forEach(function (evt) {
            el.addEventListener(evt, val[evt]);
          });
        } else {
          el.setAttribute(key, String(val));
        }
      });
    }

    if (children) {
      if (Array.isArray(children)) {
        children.forEach(function (child) {
          if (child == null) return;
          if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
          } else if (child.nodeType) {
            el.appendChild(child);
          }
        });
      } else if (typeof children === 'string') {
        el.textContent = children;
      } else if (children.nodeType) {
        el.appendChild(children);
      }
    }

    return el;
  }

  function on(el, event, selector, handler) {
    if (!el || !event) return function () {};
    if (typeof selector === 'function') {
      el.addEventListener(event, selector);
      return function () { el.removeEventListener(event, selector); };
    }
    var delegatedHandler = function (e) {
      var target = e.target;
      while (target && target !== el) {
        if (target.matches && target.matches(selector)) {
          handler.call(target, e);
          return;
        }
        target = target.parentNode;
      }
    };
    el.addEventListener(event, delegatedHandler);
    return function () { el.removeEventListener(event, delegatedHandler); };
  }

  function off(el, event, handler) {
    if (el && event && handler) el.removeEventListener(event, handler);
  }

  function show(el) {
    if (!el) return;
    el.style.display = '';
    el.removeAttribute('hidden');
  }

  function hide(el) {
    if (!el) return;
    el.style.display = 'none';
  }

  function toggle(el, force) {
    if (!el) return;
    var shouldShow = force !== undefined ? !!force : el.style.display === 'none' || el.hasAttribute('hidden');
    if (shouldShow) show(el);
    else hide(el);
  }

  function addClass(el, cls) {
    if (!el || !cls) return;
    cls.split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
  }

  function removeClass(el, cls) {
    if (!el || !cls) return;
    cls.split(/\s+/).forEach(function (c) { if (c) el.classList.remove(c); });
  }

  function toggleClass(el, cls, force) {
    if (!el || !cls) return;
    if (force === undefined) el.classList.toggle(cls);
    else if (force) el.classList.add(cls);
    else el.classList.remove(cls);
  }

  function hasClass(el, cls) {
    return !!(el && cls && el.classList.contains(cls));
  }

  /* ============================================================
     2. STRING UTILITIES
     ============================================================ */

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/`/g, '&#096;');
  }

  function unescapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#096;/g, '`')
      .replace(/&amp;/g, '&');
  }

  function truncate(str, maxLength, suffix) {
    if (str == null) return '';
    var s = String(str);
    if (s.length <= maxLength) return s;
    return s.substring(0, maxLength) + (suffix || '...');
  }

  function slugify(str) {
    if (!str) return '';
    return String(str)
      .trim()
      .toLowerCase()
      .replace(/[^\u0621-\u064Aa-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function camelCase(str) {
    if (!str) return '';
    return String(str).replace(/[-_\s]+(.)?/g, function (_, c) {
      return c ? c.toUpperCase() : '';
    });
  }

  function capitalize(str) {
    if (!str) return '';
    var s = String(str);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function padStart(str, length, pad) {
    str = String(str);
    pad = pad || '0';
    while (str.length < length) str = pad + str;
    return str;
  }

  function stripWhitespace(str) {
    return str ? String(str).replace(/\s+/g, ' ').trim() : '';
  }

  function contains(str, search, caseSensitive) {
    if (!str || !search) return false;
    if (caseSensitive) return String(str).indexOf(search) !== -1;
    return String(str).toLowerCase().indexOf(String(search).toLowerCase()) !== -1;
  }

  /* ============================================================
     3. NUMBER UTILITIES
     ============================================================ */

  function formatNumber(num, options) {
    options = options || {};
    var n = Number(num);
    if (isNaN(n)) return options.fallback || '0';

    var decimals = options.decimals != null ? options.decimals : 0;
    var thousandsSep = options.thousandsSep || ',';
    var decimalSep = options.decimalSep || '.';
    var useGrouping = options.useGrouping !== false;

    var fixed = n.toFixed(decimals);
    var parts = fixed.split('.');
    var intPart = parts[0];
    var decPart = parts[1] || '';

    // Handle negative
    var sign = '';
    if (intPart.charAt(0) === '-') {
      sign = '-';
      intPart = intPart.substring(1);
    }

    // Add thousands separator
    if (useGrouping) {
      var formatted = '';
      var count = 0;
      for (var i = intPart.length - 1; i >= 0; i--) {
        formatted = intPart.charAt(i) + formatted;
        count++;
        if (count % 3 === 0 && i > 0) formatted = thousandsSep + formatted;
      }
      intPart = formatted;
    }

    return sign + intPart + (decPart ? decimalSep + decPart : '');
  }

  function formatArabicNumber(num) {
    var n = Number(num);
    if (isNaN(n)) return '٠';
    var arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(n).split('').map(function (d) {
      var i = '0123456789'.indexOf(d);
      return i >= 0 ? arabicDigits[i] : d;
    }).join('');
  }

  function parseNumber(str, fallback) {
    if (str == null) return fallback != null ? fallback : 0;
    var cleaned = String(str).replace(/[^\d.\-]/g, '');
    var n = parseFloat(cleaned);
    return isNaN(n) ? (fallback != null ? fallback : 0) : n;
  }

  function round(num, decimals) {
    decimals = decimals || 0;
    var factor = Math.pow(10, decimals);
    return Math.round(Number(num) * factor) / factor;
  }

  function clamp(num, min, max) {
    return Math.min(Math.max(Number(num), min), max);
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /* ============================================================
     4. DATE UTILITIES
     ============================================================ */

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      var d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  function formatDate(value, options) {
    options = options || {};
    var date = parseDate(value);
    if (!date) return options.fallback || '';

    var format = options.format || 'DD/MM/YYYY';
    var day = pad2(date.getDate());
    var month = pad2(date.getMonth() + 1);
    var year = date.getFullYear();
    var hours = pad2(date.getHours());
    var minutes = pad2(date.getMinutes());
    var seconds = pad2(date.getSeconds());

    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', String(year))
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  function formatDateTime(value, options) {
    options = options || {};
    return formatDate(value, {
      format: options.format || 'DD/MM/YYYY HH:mm',
      fallback: options.fallback
    });
  }

  function formatRelative(value) {
    var date = parseDate(value);
    if (!date) return '';

    var diff = Date.now() - date.getTime();
    var absDiff = Math.abs(diff);
    var isFuture = diff < 0;

    var MINUTE = 60 * 1000;
    var HOUR = 60 * MINUTE;
    var DAY = 24 * HOUR;
    var WEEK = 7 * DAY;
    var MONTH = 30 * DAY;
    var YEAR = 365 * DAY;

    var prefix = isFuture ? 'بعد ' : 'منذ ';
    var suffix = '';

    if (absDiff < MINUTE) return 'الآن';
    if (absDiff < HOUR) { suffix = Math.floor(absDiff / MINUTE) + ' دقيقة'; }
    else if (absDiff < DAY) { suffix = Math.floor(absDiff / HOUR) + ' ساعة'; }
    else if (absDiff < WEEK) { suffix = Math.floor(absDiff / DAY) + ' يوم'; }
    else if (absDiff < MONTH) { suffix = Math.floor(absDiff / WEEK) + ' أسبوع'; }
    else if (absDiff < YEAR) { suffix = Math.floor(absDiff / MONTH) + ' شهر'; }
    else { suffix = Math.floor(absDiff / YEAR) + ' سنة'; }

    return prefix + suffix;
  }

  function daysBetween(date1, date2) {
    var d1 = parseDate(date1);
    var d2 = parseDate(date2);
    if (!d1 || !d2) return 0;
    return Math.floor((d2 - d1) / (24 * 60 * 60 * 1000));
  }

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function nowISO() {
    return new Date().toISOString();
  }

  /* ============================================================
     5. VALIDATION
     ============================================================ */

  function isEmail(str) {
    if (!str) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(str).trim());
  }

  function isEgyptPhone(str) {
    if (!str) return false;
    var cleaned = String(str).replace(/[\s\-()]/g, '');
    // +201xxxxxxxxx, 00201xxxxxxxxx, 01xxxxxxxxx, 201xxxxxxxxx
    return /^(\+?20|0020|0)?1[0-9]{9}$/.test(cleaned);
  }

  function isNationalId(str) {
    if (!str) return false;
    var cleaned = String(str).replace(/\D/g, '');
    if (cleaned.length !== 14) return false;
    // Egyptian ID structure:
    // digit 1: century (2=1900-1999, 3=2000-2099)
    // digits 2-7: birth date YYMMDD
    // digits 8-9: governorate
    // digits 10-13: serial
    // digit 14: gender (odd=male, even=female) + checksum
    var century = parseInt(cleaned.charAt(0), 10);
    if (century !== 2 && century !== 3) return false;
    var month = parseInt(cleaned.substring(3, 5), 10);
    var day = parseInt(cleaned.substring(5, 7), 10);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    return true;
  }

  function isUrl(str) {
    if (!str) return false;
    try {
      var url = new URL(String(str));
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function isStrongPassword(str) {
    if (!str) return false;
    if (String(str).length < 8) return false;
    // at least one letter + one number
    return /[a-zA-Z]/.test(str) && /[0-9]/.test(str);
  }

  function isEmpty(val) {
    if (val == null) return true;
    if (typeof val === 'string') return val.trim().length === 0;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === 'object') return Object.keys(val).length === 0;
    return false;
  }

  function validateForm(fields) {
    if (!fields || typeof fields !== 'object') return { valid: true, errors: [] };

    var errors = [];
    Object.keys(fields).forEach(function (name) {
      var field = fields[name];
      if (!field || !field.validator) return;
      var value = field.value;
      if (field.required && isEmpty(value)) {
        errors.push({ field: name, message: field.requiredMessage || 'هذا الحقل مطلوب' });
        return;
      }
      if (!isEmpty(value) && !field.validator(value)) {
        errors.push({ field: name, message: field.invalidMessage || 'قيمة غير صحيحة' });
      }
    });

    return { valid: errors.length === 0, errors: errors };
  }

  /* ============================================================
     6. STORAGE
     ============================================================ */

  function storageGet(key, fallback, storage) {
    try {
      var s = storage === 'session' ? sessionStorage : localStorage;
      var raw = s.getItem(key);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return raw;
      }
    } catch (e) {
      log('error', 'Storage get failed', e);
      return fallback;
    }
  }

  function storageSet(key, value, storage) {
    try {
      var s = storage === 'session' ? sessionStorage : localStorage;
      var str = typeof value === 'string' ? value : JSON.stringify(value);
      s.setItem(key, str);
      return true;
    } catch (e) {
      log('error', 'Storage set failed', e);
      return false;
    }
  }

  function storageRemove(key, storage) {
    try {
      var s = storage === 'session' ? sessionStorage : localStorage;
      s.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function storageClear(prefix) {
    try {
      if (!prefix) {
        localStorage.clear();
        sessionStorage.clear();
        return true;
      }
      [localStorage, sessionStorage].forEach(function (s) {
        var keys = [];
        for (var i = 0; i < s.length; i++) {
          var k = s.key(i);
          if (k && k.indexOf(prefix) === 0) keys.push(k);
        }
        keys.forEach(function (k) { s.removeItem(k); });
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ============================================================
     7. OBJECT UTILITIES
     ============================================================ */

  function clone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(clone);
    var copy = {};
    Object.keys(obj).forEach(function (k) { copy[k] = clone(obj[k]); });
    return copy;
  }

  function merge(target, source) {
    if (!target || typeof target !== 'object') target = {};
    if (!source || typeof source !== 'object') return target;
    Object.keys(source).forEach(function (k) {
      var sv = source[k];
      var tv = target[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv) &&
          tv && typeof tv === 'object' && !Array.isArray(tv)) {
        target[k] = merge(tv, sv);
      } else {
        target[k] = clone(sv);
      }
    });
    return target;
  }

  function pick(obj, keys) {
    if (!obj || !Array.isArray(keys)) return {};
    var result = {};
    keys.forEach(function (k) {
      if (k in obj) result[k] = obj[k];
    });
    return result;
  }

  function omit(obj, keys) {
    if (!obj || !Array.isArray(keys)) return {};
    var result = {};
    Object.keys(obj).forEach(function (k) {
      if (keys.indexOf(k) === -1) result[k] = obj[k];
    });
    return result;
  }

  function getPath(obj, path, fallback) {
    if (!obj || !path) return fallback;
    var parts = String(path).split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
      if (current == null || typeof current !== 'object') return fallback;
      current = current[parts[i]];
    }
    return current === undefined ? fallback : current;
  }

  function isEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var aKeys = Object.keys(a);
    var bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(function (k) { return isEqual(a[k], b[k]); });
  }

  /* ============================================================
     8. FUNCTION UTILITIES
     ============================================================ */

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, wait || 300);
    };
  }

  function throttle(fn, limit) {
    var inThrottle = false;
    return function () {
      var context = this;
      var args = arguments;
      if (!inThrottle) {
        fn.apply(context, args);
        inThrottle = true;
        setTimeout(function () { inThrottle = false; }, limit || 300);
      }
    };
  }

  function once(fn) {
    var called = false;
    return function () {
      if (called) return;
      called = true;
      return fn.apply(this, arguments);
    };
  }

  function retry(fn, options) {
    options = options || {};
    var maxAttempts = options.maxAttempts || 3;
    var delay = options.delay || 1000;
    var backoff = options.backoff || 2;

    return new Promise(function (resolve, reject) {
      var attempt = 0;
      function tryOnce() {
        attempt++;
        Promise.resolve().then(fn).then(resolve).catch(function (err) {
          if (attempt >= maxAttempts) return reject(err);
          setTimeout(tryOnce, delay * Math.pow(backoff, attempt - 1));
        });
      }
      tryOnce();
    });
  }

  /* ============================================================
     9. ASYNC
     ============================================================ */

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function withTimeout(promise, ms, message) {
    var timeout = new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error(message || 'انتهت مهلة العملية'));
      }, ms);
    });
    return Promise.race([promise, timeout]);
  }

  /* ============================================================
     10. CLIPBOARD
     ============================================================ */

  function copyToClipboard(text) {
    var str = text == null ? '' : String(text);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(str)
        .then(function () { return true; })
        .catch(function () { return fallbackCopy(str); });
    }
    return Promise.resolve(fallbackCopy(str));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  /* ============================================================
     11. FILE UTILITIES
     ============================================================ */

  function downloadBlob(blob, filename) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (e) {
      log('error', 'downloadBlob failed', e);
      return false;
    }
  }

  function downloadFile(url, filename) {
    try {
      var a = document.createElement('a');
      a.href = url;
      if (filename) a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch (e) {
      return false;
    }
  }

  function formatFileSize(bytes) {
    if (bytes == null) return '';
    var b = Number(bytes);
    if (isNaN(b) || b < 0) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
    return (b / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  function readAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('file is required'));
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  function readAsText(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('file is required'));
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsText(file);
    });
  }

  /* ============================================================
     12. URL UTILITIES
     ============================================================ */

  function getQueryParam(name, url) {
    try {
      var target = url ? new URL(url, window.location.origin) : new URL(window.location.href);
      return target.searchParams.get(name);
    } catch (e) {
      return null;
    }
  }

  function setQueryParam(name, value, url) {
    try {
      var target = url ? new URL(url, window.location.origin) : new URL(window.location.href);
      if (value === null || value === undefined) target.searchParams.delete(name);
      else target.searchParams.set(name, value);
      if (url) return target.toString();
      window.history.replaceState({}, '', target.toString());
      return target.toString();
    } catch (e) {
      return null;
    }
  }

  function removeQueryParam(name, url) {
    return setQueryParam(name, null, url);
  }

  function getAllQueryParams(url) {
    try {
      var target = url ? new URL(url, window.location.origin) : new URL(window.location.href);
      var result = {};
      target.searchParams.forEach(function (v, k) { result[k] = v; });
      return result;
    } catch (e) {
      return {};
    }
  }

  /* ============================================================
     13. TOAST NOTIFICATIONS
     ============================================================ */

  var toastCounter = 0;

  function showToast(message, type, options) {
    options = options || {};
    var duration = options.duration != null ? options.duration : (type === 'error' ? 8000 : 4000);

    var containerId = 'itws-toast-container';
    var container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.cssText =
        'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
        'z-index:99999;display:flex;flex-direction:column;gap:10px;' +
        'pointer-events:none;max-width:calc(100vw - 40px);';
      if (document.body) document.body.appendChild(container);
      else document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(container);
      });
    }

    var toastId = 'itws-toast-' + (++toastCounter);

    // Colors from theme
    var colors = {
      success: { bg: 'var(--success-soft, rgba(16,185,129,0.15))', text: 'var(--success, #10B981)', border: 'var(--success, #10B981)' },
      error: { bg: 'var(--error-soft, rgba(239,68,68,0.15))', text: 'var(--error, #EF4444)', border: 'var(--error, #EF4444)' },
      warning: { bg: 'var(--warning-soft, rgba(245,158,11,0.15))', text: 'var(--warning, #F59E0B)', border: 'var(--warning, #F59E0B)' },
      info: { bg: 'var(--info-soft, rgba(59,130,246,0.15))', text: 'var(--info, #3B82F6)', border: 'var(--info, #3B82F6)' }
    };
    var palette = colors[type] || colors.info;

    var toast = document.createElement('div');
    toast.id = toastId;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.style.cssText =
      'padding:14px 20px;border-radius:12px;font-family:Cairo,sans-serif;' +
      'font-size:14px;font-weight:600;line-height:1.6;' +
      'background:' + palette.bg + ';' +
      'color:' + palette.text + ';' +
      'border:1px solid ' + palette.border + ';' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.15);' +
      'pointer-events:auto;cursor:pointer;' +
      'max-width:400px;word-wrap:break-word;' +
      'animation:itwsToastIn 0.3s ease;' +
      'opacity:0;transform:translateY(-10px);transition:opacity 0.2s,transform 0.2s;';

    toast.textContent = String(message);

    // Click to dismiss
    toast.addEventListener('click', function () { dismiss(toast); });

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(function () { dismiss(toast); }, duration);
    }

    return toastId;
  }

  function dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }

  function hideToast(id) {
    var el = document.getElementById(id);
    if (el) dismiss(el);
  }

  function clearAllToasts() {
    var container = document.getElementById('itws-toast-container');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
  }

  // Inject CSS keyframes once
  if (!document.getElementById('itws-toast-keyframes')) {
    var style = document.createElement('style');
    style.id = 'itws-toast-keyframes';
    style.textContent = '@keyframes itwsToastIn{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}';
    if (document.head) document.head.appendChild(style);
  }

  /* ============================================================
     14. SCROLL
     ============================================================ */

  function scrollToTop(smooth) {
    try {
      window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  function scrollToEl(el, options) {
    if (!el) return;
    options = options || {};
    try {
      el.scrollIntoView({
        behavior: options.smooth ? 'smooth' : 'auto',
        block: options.block || 'start',
        inline: options.inline || 'nearest'
      });
    } catch (e) {
      el.scrollIntoView();
    }
  }

  function lockScroll() {
    try {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = (window.innerWidth - document.documentElement.clientWidth) + 'px';
    } catch (e) {}
  }

  function unlockScroll() {
    try {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    } catch (e) {}
  }

  /* ============================================================
     15. DEVICE DETECTION
     ============================================================ */

  function isMobile() {
    return window.innerWidth <= 640;
  }

  function isTablet() {
    return window.innerWidth > 640 && window.innerWidth <= 1024;
  }

  function isDesktop() {
    return window.innerWidth > 1024;
  }

  function isTouchDevice() {
    return ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (navigator.msMaxTouchPoints > 0);
  }

  function prefersDarkMode() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  /* ============================================================
     16. MISC
     ============================================================ */

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function randomString(length, charset) {
    var chars = charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var result = '';
    for (var i = 0; i < (length || 8); i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function hashCode(str) {
    if (!str) return 0;
    var hash = 0;
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /* ============================================================
     17. FORM HELPERS
     ============================================================ */

  function serializeForm(form) {
    if (!form) return {};
    var result = {};
    var formData = new FormData(form);
    formData.forEach(function (value, key) {
      if (result[key] !== undefined) {
        if (!Array.isArray(result[key])) result[key] = [result[key]];
        result[key].push(value);
      } else {
        result[key] = value;
      }
    });
    return result;
  }

  function fillForm(form, data) {
    if (!form || !data) return;
    Object.keys(data).forEach(function (key) {
      var field = form.elements[key];
      if (!field) return;
      if (field.type === 'checkbox') field.checked = !!data[key];
      else if (field.type === 'radio') {
        var radios = form.querySelectorAll('[name="' + key + '"]');
        radios.forEach(function (r) { r.checked = (r.value === data[key]); });
      } else {
        field.value = data[key] == null ? '' : data[key];
      }
    });
  }

  function resetForm(form) {
    if (!form) return;
    if (typeof form.reset === 'function') form.reset();
    var fields = form.querySelectorAll('input, textarea, select');
    fields.forEach(function (f) {
      if (f.type === 'checkbox' || f.type === 'radio') f.checked = false;
      else f.value = '';
    });
  }

  /* ============================================================
     18. EXPORT
     ============================================================ */

  var Utils = {
    _initialized: true,

    // DOM
    $: $, $$: $$, createEl: createEl, on: on, off: off,
    show: show, hide: hide, toggle: toggle,
    addClass: addClass, removeClass: removeClass, toggleClass: toggleClass, hasClass: hasClass,

    // String
    escapeHtml: escapeHtml, escapeAttr: escapeAttr, unescapeHtml: unescapeHtml,
    truncate: truncate, slugify: slugify, camelCase: camelCase,
    capitalize: capitalize, padStart: padStart, stripWhitespace: stripWhitespace,
    contains: contains,

    // Number
    formatNumber: formatNumber, formatArabicNumber: formatArabicNumber,
    parseNumber: parseNumber, round: round, clamp: clamp, randomInt: randomInt,

    // Date
    parseDate: parseDate, formatDate: formatDate, formatDateTime: formatDateTime,
    formatRelative: formatRelative, daysBetween: daysBetween,
    todayISO: todayISO, nowISO: nowISO,

    // Validation
    isEmail: isEmail, isEgyptPhone: isEgyptPhone, isNationalId: isNationalId,
    isUrl: isUrl, isStrongPassword: isStrongPassword,
    isEmpty: isEmpty, validateForm: validateForm,

    // Storage
    storageGet: storageGet, storageSet: storageSet,
    storageRemove: storageRemove, storageClear: storageClear,

    // Object
    clone: clone, merge: merge, pick: pick, omit: omit,
    getPath: getPath, isEqual: isEqual,

    // Function
    debounce: debounce, throttle: throttle, once: once, retry: retry,

    // Async
    sleep: sleep, withTimeout: withTimeout,

    // Clipboard
    copyToClipboard: copyToClipboard,

    // File
    downloadBlob: downloadBlob, downloadFile: downloadFile,
    formatFileSize: formatFileSize,
    readAsDataURL: readAsDataURL, readAsText: readAsText,

    // URL
    getQueryParam: getQueryParam, setQueryParam: setQueryParam,
    removeQueryParam: removeQueryParam, getAllQueryParams: getAllQueryParams,

    // Toast
    showToast: showToast, hideToast: hideToast, clearAllToasts: clearAllToasts,

    // Scroll
    scrollToTop: scrollToTop, scrollToEl: scrollToEl,
    lockScroll: lockScroll, unlockScroll: unlockScroll,

    // Device
    isMobile: isMobile, isTablet: isTablet, isDesktop: isDesktop,
    isTouchDevice: isTouchDevice, prefersDarkMode: prefersDarkMode,
    prefersReducedMotion: prefersReducedMotion,

    // Misc
    uuid: uuid, randomString: randomString, hashCode: hashCode,

    // Form
    serializeForm: serializeForm, fillForm: fillForm, resetForm: resetForm
  };

  window.Utils = Utils;

  /* ============================================================
     19. SHORTHAND GLOBALS
     ============================================================ */

  // Toast - most used
  window.showToast = function (msg, type, options) { return showToast(msg, type, options); };
  window.toast = window.showToast;

  // Common utilities
  window.escapeHtml = escapeHtml;
  window.formatDate = function (v, opts) { return formatDate(v, opts); };
  window.formatDateTime = formatDateTime;
  window.formatNumber = formatNumber;
  window.formatRelative = formatRelative;
  window.debounce = debounce;
  window.throttle = throttle;
  window.copyToClipboard = copyToClipboard;
  window.downloadFile = downloadFile;
  window.downloadBlob = downloadBlob;
  window.sleep = sleep;
  window.uuid = uuid;

  /* ============================================================
     20. DEBUG LOG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[Utils]', 'color: #10B981; font-weight: bold;', 'Loaded', {
        categories: 17,
        functions: Object.keys(Utils).length - 1
      });
    } catch (e) {}
  }

})();
