/* ============================================================
   ITWS Platform — Security (Deterrent Layer)
   File: assets/js/security.js

   ⚠️ DETERRENT ONLY — NOT real security
   Real security = RLS + server-side validation
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWS_SECURITY_ACTIVE) return;
  window.ITWS_SECURITY_ACTIVE = true;

  // ============================================================
  // CONFIG — toggle each rule
  // ============================================================
  var CFG = {
    blockF12: true,
    blockDevToolsShortcuts: true,
    blockContextMenu: true,
    blockViewSource: true,
    blockSave: true,
    blockCopy: true,
    blockPaste: false,
    blockCut: false,
    blockSelection: false,
    showWarningOnBlock: true,
    allowInputsCopyPaste: true,
    warningDuration: 3000
  };

  // ============================================================
  // HELPERS
  // ============================================================

  function showWarning(msg) {
    if (!CFG.showWarningOnBlock) return;

    var existing = document.getElementById('itws-security-warning');
    if (existing) existing.remove();

    var box = document.createElement('div');
    box.id = 'itws-security-warning';
    box.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'z-index:999999;padding:14px 24px;' +
      'background:rgba(239,68,68,0.95);color:#fff;' +
      'border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;' +
      'font-weight:700;box-shadow:0 20px 60px rgba(0,0,0,0.5);' +
      'pointer-events:none;max-width:calc(100vw - 40px);' +
      'animation:itwsSecurityIn 0.3s ease;text-align:center;line-height:1.6;';

    box.textContent = msg || 'هذا الإجراء غير مسموح';

    var style = document.getElementById('itws-security-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'itws-security-styles';
      style.textContent =
        '@keyframes itwsSecurityIn{' +
          'from{opacity:0;transform:translateX(-50%) translateY(-10px);}' +
          'to{opacity:1;transform:translateX(-50%) translateY(0);}' +
        '}' +
        '@keyframes itwsSecurityOut{' +
          'from{opacity:1;}' +
          'to{opacity:0;transform:translateX(-50%) translateY(-10px);}' +
        '}';
      document.head.appendChild(style);
    }

    document.body.appendChild(box);

    setTimeout(function () {
      if (box.parentNode) {
        box.style.animation = 'itwsSecurityOut 0.3s ease';
        setTimeout(function () {
          if (box.parentNode) box.parentNode.removeChild(box);
        }, 300);
      }
    }, CFG.warningDuration);
  }

  function isInputTarget(target) {
    if (!target) return false;
    var tag = target.tagName ? target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return false;
  }

  // ============================================================
  // KEYBOARD SHORTCUTS BLOCK
  // ============================================================

  document.addEventListener('keydown', function (e) {
    // F12
    if (CFG.blockF12 && e.key === 'F12') {
      e.preventDefault();
      showWarning('فتح أدوات المطور غير مسموح');
      return false;
    }

    // Ctrl+Shift+I / J / C / K
    if (CFG.blockDevToolsShortcuts && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      var k = (e.key || '').toLowerCase();
      if (k === 'i' || k === 'j' || k === 'c' || k === 'k') {
        e.preventDefault();
        showWarning('فتح أدوات المطور غير مسموح');
        return false;
      }
    }

    // Ctrl+U (View Source)
    if (CFG.blockViewSource && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      var ku = (e.key || '').toLowerCase();
      if (ku === 'u') {
        e.preventDefault();
        showWarning('عرض المصدر غير مسموح');
        return false;
      }
    }

    // Ctrl+S (Save Page)
    if (CFG.blockSave && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      var ks = (e.key || '').toLowerCase();
      if (ks === 's') {
        e.preventDefault();
        showWarning('حفظ الصفحة غير مسموح');
        return false;
      }
    }
  }, true);

  // ============================================================
  // CONTEXT MENU
  // ============================================================

  if (CFG.blockContextMenu) {
    document.addEventListener('contextmenu', function (e) {
      // Allow on inputs if configured
      if (CFG.allowInputsCopyPaste && isInputTarget(e.target)) return;
      e.preventDefault();
      showWarning('القائمة اليمنى غير مسموحة');
      return false;
    }, true);
  }

  // ============================================================
  // COPY / PASTE / CUT
  // ============================================================

  document.addEventListener('copy', function (e) {
    if (!CFG.blockCopy) return;
    if (CFG.allowInputsCopyPaste && isInputTarget(e.target)) return;
    // Allow copy from inputs
    var sel = window.getSelection();
    if (sel && isInputTarget(sel.anchorNode ? sel.anchorNode.parentElement : null)) return;
    e.preventDefault();
    showWarning('النسخ غير مسموح على هذه الصفحة');
    return false;
  }, true);

  if (CFG.blockPaste) {
    document.addEventListener('paste', function (e) {
      if (CFG.allowInputsCopyPaste && isInputTarget(e.target)) return;
      e.preventDefault();
      showWarning('اللصق غير مسموح');
      return false;
    }, true);
  }

  if (CFG.blockCut) {
    document.addEventListener('cut', function (e) {
      if (CFG.allowInputsCopyPaste && isInputTarget(e.target)) return;
      e.preventDefault();
      showWarning('القص غير مسموح');
      return false;
    }, true);
  }

  // ============================================================
  // SELECTION
  // ============================================================

  if (CFG.blockSelection) {
    document.addEventListener('selectstart', function (e) {
      if (CFG.allowInputsCopyPaste && isInputTarget(e.target)) return;
      e.preventDefault();
      return false;
    }, true);
  }

  // ============================================================
  // DISABLE DRAG (images)
  // ============================================================

  document.addEventListener('dragstart', function (e) {
    var target = e.target;
    if (target && target.tagName && target.tagName.toUpperCase() === 'IMG') {
      e.preventDefault();
      return false;
    }
  }, true);

  // ============================================================
  // CONSOLE WARNING (visible only when DevTools opened)
  // ============================================================

  try {
    console.log(
      '%c⚠️ STOP',
      'color:#ff0080;font-size:60px;font-weight:900;text-shadow:0 0 20px #ff0080;'
    );
    console.log(
      '%cهذه المنطقة مخصصة للمطورين المصرح لهم فقط.',
      'color:#e62e2e;font-size:20px;font-weight:800;'
    );
    console.log(
      '%cأي محاولة تلاعب أو تعديل غير مصرح به قد تخضع للمساءلة القانونية.',
      'color:#ffcc00;font-size:16px;font-weight:600;'
    );
  } catch (e) {}

  // ============================================================
  // EXPORT
  // ============================================================

  window.ITWS_SECURITY = {
    active: true,
    config: CFG,
    showWarning: showWarning
  };

  try {
    console.log('%c[Security]', 'color: #e62e2e; font-weight: bold;',
      'Deterrent layer active');
  } catch (e) {}

})();
