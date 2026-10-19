// ============================================
// [7/50] ITWS Platform - Utilities
// Path: assets/js/utils.js
// ============================================
// 💡 أدوات مساعدة تُستخدم في كل الصفحات
// 💡 مقسمة لأقسام واضحة: تواريخ، توليد، تحقق، toast، إلخ
// ============================================

(function () {
  'use strict';

  // ============================================
  // 1. التاريخ والوقت
  // ============================================
  function formatDate(date, options) {
    if (!date) return '-';
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ar-EG', options || {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatDateShort(date) {
    return formatDate(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  function formatDateTime(date) {
    if (!date) return '-';
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatTime(date) {
    if (!date) return '-';
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  function timeAgo(date) {
    if (!date) return '-';
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    var seconds = Math.floor((Date.now() - d.getTime()) / 1000);

    if (seconds < 0) return 'الآن';
    if (seconds < 60) return 'الآن';
    if (seconds < 3600) return 'منذ ' + Math.floor(seconds / 60) + ' دقيقة';
    if (seconds < 86400) return 'منذ ' + Math.floor(seconds / 3600) + ' ساعة';
    if (seconds < 604800) return 'منذ ' + Math.floor(seconds / 86400) + ' يوم';
    if (seconds < 2592000) return 'منذ ' + Math.floor(seconds / 604800) + ' أسبوع';
    if (seconds < 31536000) return 'منذ ' + Math.floor(seconds / 2592000) + ' شهر';
    return 'منذ ' + Math.floor(seconds / 31536000) + ' سنة';
  }

  function toISODate(date) {
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  }

  // ============================================
  // 2. توليد المعرفات والأكواد
  // ============================================
  function generateCertificateCode() {
    var year = new Date().getFullYear();
    var random = '';
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون I,O,0,1 لتجنب اللبس
    for (var i = 0; i < 6; i++) {
      random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'NTI-' + year + '-' + random;
  }

  function generateRequestNumber() {
    var year = new Date().getFullYear();
    var random = Math.floor(1000 + Math.random() * 9000);
    return 'REQ-' + year + '-' + random;
  }

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getVisitorId() {
    var key = (window.ITWS_CONFIG && window.ITWS_CONFIG.STORAGE_KEYS && window.ITWS_CONFIG.STORAGE_KEYS.VISITOR_ID) || 'itws_visitor_id';
    try {
      var id = localStorage.getItem(key);
      if (!id) {
        id = 'v_' + generateUUID().replace(/-/g, '').substring(0, 20);
        localStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return 'v_' + generateUUID().replace(/-/g, '').substring(0, 20);
    }
  }

  // ============================================
  // 3. التحقق (Validation)
  // ============================================
  function isValidEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function isValidEgyptianNationalId(id) {
    if (!id) return false;
    var str = String(id).trim();
    if (!/^[0-9]{14}$/.test(str)) return false;
    // التحقق من Century (2 = 1900s, 3 = 2000s)
    var century = str.charAt(0);
    if (century !== '2' && century !== '3') return false;
    // التحقق من الشهر (01-12)
    var month = parseInt(str.substring(3, 5), 10);
    if (month < 1 || month > 12) return false;
    // التحقق من اليوم (01-31)
    var day = parseInt(str.substring(5, 7), 10);
    if (day < 1 || day > 31) return false;
    return true;
  }

  function isValidEgyptianPhone(phone) {
    if (!phone) return false;
    var cleaned = String(phone).replace(/[\s\-\(\)]/g, '');
    return /^01[0125][0-9]{8}$/.test(cleaned);
  }

  function isValidUrl(url) {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getNationalIdInfo(id) {
    if (!isValidEgyptianNationalId(id)) return null;
    var str = String(id);
    var century = str.charAt(0) === '2' ? 1900 : 2000;
    var year = century + parseInt(str.substring(1, 3), 10);
    var month = parseInt(str.substring(3, 5), 10);
    var day = parseInt(str.substring(5, 7), 10);

    return {
      birthDate: new Date(year, month - 1, day),
      year: year,
      month: month,
      day: day,
      governorate: str.substring(7, 9),
      gender: parseInt(str.charAt(12), 10) % 2 === 1 ? 'male' : 'female'
    };
  }

  // ============================================
  // 4. النصوص والأمان
  // ============================================
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function truncate(str, length) {
    if (!str) return '';
    length = length || 50;
    var s = String(str);
    return s.length > length ? s.substring(0, length) + '...' : s;
  }

  function slugify(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[^\w\u0621-\u064A\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  // ============================================
  // 5. Toast Notifications
  // ============================================
  var toastContainer = null;
  function getToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) {
      return toastContainer;
    }
    toastContainer = document.getElementById('itws-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'itws-toast-container';
      toastContainer.className = 'itws-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3500;
    var container = getToastContainer();

    var toast = document.createElement('div');
    toast.className = 'itws-toast itws-toast-' + type;
    toast.setAttribute('role', 'alert');
    toast.textContent = String(message);

    container.appendChild(toast);

    var timer = setTimeout(function () {
      dismissToast(toast);
    }, duration);

    toast.addEventListener('click', function () {
      clearTimeout(timer);
      dismissToast(toast);
    });

    return toast;
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('itws-toast-hide');
    setTimeout(function () {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // ============================================
  // 6. Debounce & Throttle
  // ============================================
  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, ms || 300);
    };
  }

  function throttle(fn, ms) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= (ms || 300)) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }

  // ============================================
  // 7. Clipboard
  // ============================================
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        showToast('تم النسخ', 'success', 2000);
        return true;
      }).catch(function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('تم النسخ', 'success', 2000);
      return true;
    } catch (e) {
      showToast('تعذر النسخ', 'error', 2000);
      return false;
    }
  }

  // ============================================
  // 8. DOM Helpers
  // ============================================
  function $(selector, context) {
    return (context || document).querySelector(selector);
  }

  function $$(selector, context) {
    return Array.prototype.slice.call((context || document).querySelectorAll(selector));
  }

  function createElement(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') {
          el.className = attrs[k];
        } else if (k === 'textContent') {
          el.textContent = attrs[k];
        } else if (k === 'innerHTML') {
          el.innerHTML = attrs[k];
        } else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          el.addEventListener(k.substring(2).toLowerCase(), attrs[k]);
        } else if (k === 'dataset' && typeof attrs[k] === 'object') {
          Object.keys(attrs[k]).forEach(function (dk) {
            el.dataset[dk] = attrs[k][dk];
          });
        } else {
          el.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children != null) {
      if (Array.isArray(children)) {
        children.forEach(function (c) {
          if (c == null) return;
          if (typeof c === 'string') {
            el.appendChild(document.createTextNode(c));
          } else {
            el.appendChild(c);
          }
        });
      } else if (typeof children === 'string') {
        el.appendChild(document.createTextNode(children));
      } else {
        el.appendChild(children);
      }
    }
    return el;
  }

  function show(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.remove('hidden');
  }

  function hide(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.add('hidden');
  }

  // ============================================
  // 9. Loading State
  // ============================================
  function setLoading(button, isLoading, loadingText) {
    if (!button) return;
    if (isLoading) {
      button.dataset._originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span>' + (loadingText || 'جاري التحميل...');
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset._originalHtml || button.innerHTML;
      delete button.dataset._originalHtml;
    }
  }

  // ============================================
  // 10. File Helpers
  // ============================================
  function fileSize(bytes) {
    if (!bytes) return '0 B';
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  function validateFile(file, options) {
    options = options || {};
    var maxSize = options.maxSize || 10 * 1024 * 1024;
    var allowedTypes = options.allowedTypes || [];

    if (!file) {
      return { valid: false, error: 'الملف غير موجود' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'حجم الملف يجب أن يكون أقل من ' + fileSize(maxSize) };
    }

    if (allowedTypes.length > 0 && allowedTypes.indexOf(file.type) === -1) {
      return { valid: false, error: 'نوع الملف غير مسموح' };
    }

    return { valid: true, error: null };
  }

  // ============================================
  // 11. Misc
  // ============================================
  function getQueryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name);
    } catch (e) {
      return null;
    }
  }

  function setQueryParam(name, value) {
    try {
      var params = new URLSearchParams(window.location.search);
      if (value == null) params.delete(name);
      else params.set(name, value);
      var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', newUrl);
    } catch (e) {}
  }

  function redirectTo(url, delay) {
    if (delay) {
      setTimeout(function () { window.location.href = url; }, delay);
    } else {
      window.location.href = url;
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function range(start, end, step) {
    step = step || 1;
    var arr = [];
    for (var i = start; step > 0 ? i <= end : i >= end; i += step) {
      arr.push(i);
    }
    return arr;
  }

  function chunk(arr, size) {
    var result = [];
    for (var i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  function groupBy(arr, keyFn) {
    return arr.reduce(function (acc, item) {
      var key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  function unique(arr) {
    return arr.filter(function (item, idx) {
      return arr.indexOf(item) === idx;
    });
  }

  // ============================================
  // التصدير
  // ============================================
  window.Utils = {
    // Date
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    formatDateTime: formatDateTime,
    formatTime: formatTime,
    timeAgo: timeAgo,
    toISODate: toISODate,

    // Generation
    generateCertificateCode: generateCertificateCode,
    generateRequestNumber: generateRequestNumber,
    generateUUID: generateUUID,
    getVisitorId: getVisitorId,

    // Validation
    isValidEmail: isValidEmail,
    isValidEgyptianNationalId: isValidEgyptianNationalId,
    isValidEgyptianPhone: isValidEgyptianPhone,
    isValidUrl: isValidUrl,
    getNationalIdInfo: getNationalIdInfo,

    // Text
    escapeHtml: escapeHtml,
    truncate: truncate,
    slugify: slugify,

    // UI
    showToast: showToast,
    dismissToast: dismissToast,
    setLoading: setLoading,
    show: show,
    hide: hide,

    // Async
    debounce: debounce,
    throttle: throttle,
    sleep: sleep,

    // Clipboard
    copyToClipboard: copyToClipboard,

    // DOM
    $: $,
    $$: $$,
    createElement: createElement,

    // Files
    fileSize: fileSize,
    validateFile: validateFile,

    // URL
    getQueryParam: getQueryParam,
    setQueryParam: setQueryParam,
    redirectTo: redirectTo,

    // Arrays
    range: range,
    chunk: chunk,
    groupBy: groupBy,
    unique: unique
  };

  // ============ Debug ============
  if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
    console.log('%c✅ [ITWS] Utils loaded', 'color: #10B981; font-weight: bold;');
  }

})();
