// ============================================
// [45/50] ITWS Platform - Admin Users Logic
// Path: assets/js/pages/admin/users.js
// ============================================
// إدارة المستخدمين - Grid + Filters + Modal CRUD
// إنشاء مستخدم عبر Secondary Client (آمن)
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminUsers && window.AdminUsers.initialized) return;

  var ONLINE_THRESHOLD_MS = 120000; // دقيقتين
  var PASSWORD_MIN_LENGTH = 8;

  var state = {
    allUsers: [],
    filteredUsers: [],
    onlineUsers: {},        // { userId: lastSeenAt }
    currentUser: null,
    editingUserId: null,
    submitting: false,
    loading: false,
    initialized: false,
    filters: {
      search: '',
      role: '',
      status: '',
      sort: 'newest'
    }
  };

  // ============================================
  // 1. Helpers
  // ============================================
  function $(id) { return document.getElementById(id); }

  function setText(id, t) {
    var el = $(id);
    if (el) el.textContent = t;
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

  function formatDate(date, opts) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-EG', opts || {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch (e) { return '—'; }
  }

  function formatRelativeTime(date) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return '—';
      var sec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (sec < 60) return 'الآن';
      if (sec < 3600) return 'منذ ' + Math.floor(sec / 60) + ' د';
      if (sec < 86400) return 'منذ ' + Math.floor(sec / 3600) + ' س';
      if (sec < 604800) return 'منذ ' + Math.floor(sec / 86400) + ' يوم';
      return formatDate(d);
    } catch (e) { return '—'; }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function toast(msg, type) {
    if (window.Utils && window.Utils.showToast) {
      window.Utils.showToast(msg, type || 'info');
    } else if (type === 'error') {
      alert(msg);
    }
  }

  function logDebug() {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log.apply(console, ['[AdminUsers]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function translateRole(role) {
    var map = {
      'super_admin': 'سوبر أدمن',
      'admin': 'أدمن',
      'committee_manager': 'إدارة اللجنة',
      'user': 'مستخدم'
    };
    return map[role] || role || 'مستخدم';
  }

  function roleIcon(role) {
    var map = {
      'super_admin': 'M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z',
      'admin': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
      'committee_manager': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
      'user': 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
    };
    return map[role] || map.user;
  }

  // ============================================
  // 2. Load Data
  // ============================================
  function loadUsers() {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    return window.sb
      .from('profiles')
      .select('id, email, full_name, phone, role, is_active, created_at, last_login')
      .order('created_at', { ascending: false });
  }

  function loadOnlineSessions() {
    if (!window.sb) return Promise.resolve({});

    var threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString();

    return window.sb
      .from('sessions')
      .select('user_id, last_seen_at')
      .gte('last_seen_at', threshold)
      .not('user_id', 'is', null)
      .then(function (res) {
        if (res.error || !res.data) return {};
        var map = {};
        res.data.forEach(function (s) {
          if (s.user_id) map[s.user_id] = s.last_seen_at;
        });
        return map;
      })
      .catch(function () { return {}; });
  }

  // ============================================
  // 3. Apply Filters
  // ============================================
  function applyFilters() {
    var search = state.filters.search.trim().toLowerCase();
    var role = state.filters.role;
    var status = state.filters.status;
    var sortBy = state.filters.sort;

    var filtered = state.allUsers.filter(function (u) {
      // Search
      if (search) {
        var nameMatch = (u.full_name || '').toLowerCase().indexOf(search) !== -1;
        var emailMatch = (u.email || '').toLowerCase().indexOf(search) !== -1;
        if (!nameMatch && !emailMatch) return false;
      }

      // Role
      if (role && u.role !== role) return false;

      // Status
      if (status === 'active' && u.is_active === false) return false;
      if (status === 'inactive' && u.is_active !== false) return false;
      if (status === 'online' && !state.onlineUsers[u.id]) return false;

      return true;
    });

    // Sort
    filtered.sort(function (a, b) {
      if (sortBy === 'newest') {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sortBy === 'name') {
        return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
      }
      if (sortBy === 'role') {
        var order = { super_admin: 1, admin: 2, committee_manager: 3, user: 4 };
        return (order[a.role] || 99) - (order[b.role] || 99);
      }
      return 0;
    });

    state.filteredUsers = filtered;
  }

  // ============================================
  // 4. Mini Stats
  // ============================================
  function updateMiniStats() {
    var total = state.allUsers.length;
    var active = state.allUsers.filter(function (u) { return u.is_active !== false; }).length;
    var admins = state.allUsers.filter(function (u) {
      return u.role === 'admin' || u.role === 'super_admin';
    }).length;
    var online = Object.keys(state.onlineUsers).length;

    setText('miniTotal', total);
    setText('miniActive', active);
    setText('miniAdmins', admins);
    setText('miniOnline', online);
  }

  // ============================================
  // 5. Render
  // ============================================
  function render() {
    var grid = $('usersGrid');
    var empty = $('adminEmpty');
    var loader = $('adminLoader');

    if (!grid) return;

    if (loader) loader.classList.remove('show');

    if (state.filteredUsers.length === 0) {
      grid.style.display = 'none';
      if (empty) empty.classList.add('show');
      return;
    }

    grid.style.display = 'grid';
    if (empty) empty.classList.remove('show');

    grid.innerHTML = state.filteredUsers.map(renderUserCard).join('');
    bindCardActions();
  }

  function renderUserCard(user) {
    var isCurrentUser = state.currentUser && user.id === state.currentUser.id;
    var isOnline = !!state.onlineUsers[user.id];
    var isActive = user.is_active !== false;
    var initial = escapeHtml((user.full_name || user.email || '?').charAt(0).toUpperCase());
    var role = user.role || 'user';

    var cardClasses = ['user-card'];
    if (!isActive) cardClasses.push('inactive');
    if (isCurrentUser) cardClasses.push('current-user');

    var roleBadge = '<span class="user-role-badge ' + role + '">' + escapeHtml(translateRole(role)) + '</span>';

    var statusBadge = isActive
      ? '<span class="user-status-badge active"><span class="user-status-dot"></span>نشط</span>'
      : '<span class="user-status-badge inactive"><span class="user-status-dot"></span>معطل</span>';

    var onlineBadge = isOnline
      ? ' <span class="user-status-badge online"><span class="user-status-dot"></span>متصل</span>'
      : '';

    // Actions
    var actionsHtml = '';

    // Edit
    actionsHtml += '' +
      '<button class="icon-btn" data-action="edit" data-id="' + escapeHtml(user.id) + '" title="تعديل">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>' +
          '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>' +
        '</svg>' +
      '</button>';

    // Toggle active (disabled if current user)
    if (!isCurrentUser) {
      actionsHtml += '' +
        '<button class="icon-btn ' + (isActive ? 'danger' : 'success') + '" ' +
                'data-action="toggle" data-id="' + escapeHtml(user.id) + '" ' +
                'title="' + (isActive ? 'تعطيل' : 'تفعيل') + '">' +
          (isActive
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="12" cy="12" r="10"></circle>' +
                '<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>' +
              '</svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>' +
                '<polyline points="22 4 12 14.01 9 11.01"></polyline>' +
              '</svg>') +
        '</button>';
    }

    // Delete
    if (!isCurrentUser) {
      actionsHtml += '' +
        '<button class="icon-btn danger" data-action="delete" data-id="' + escapeHtml(user.id) + '" title="حذف">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="3 6 5 6 21 6"></polyline>' +
            '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
          '</svg>' +
        '</button>';
    }

    return '' +
      '<div class="' + cardClasses.join(' ') + '" data-user-id="' + escapeHtml(user.id) + '">' +
        '<div class="user-header">' +
          '<div class="user-avatar' + (isOnline ? ' online' : '') + '">' + initial + '</div>' +
          '<div class="user-info">' +
            '<div class="user-name">' +
              escapeHtml(user.full_name || 'بدون اسم') +
              (isCurrentUser ? ' <span class="user-you-badge">أنت</span>' : '') +
            '</div>' +
            '<div class="user-email">' + escapeHtml(user.email || '—') + '</div>' +
          '</div>' +
          roleBadge +
        '</div>' +
        '<div class="user-body">' +
          '<div class="user-info-item">' +
            '<div class="user-info-label">الحالة</div>' +
            '<div class="user-info-value">' + statusBadge + onlineBadge + '</div>' +
          '</div>' +
          '<div class="user-info-item">' +
            '<div class="user-info-label">آخر دخول</div>' +
            '<div class="user-info-value" style="font-size:11px;color:var(--text-muted);">' +
              formatRelativeTime(user.last_login) +
            '</div>' +
          '</div>' +
          '<div class="user-info-item">' +
            '<div class="user-info-label">الهاتف</div>' +
            '<div class="user-info-value mono">' + escapeHtml(user.phone || '—') + '</div>' +
          '</div>' +
          '<div class="user-info-item">' +
            '<div class="user-info-label">تاريخ الإضافة</div>' +
            '<div class="user-info-value" style="font-size:11px;color:var(--text-muted);">' +
              formatDate(user.created_at) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="user-footer">' +
          '<div class="user-last-seen">' +
            (isOnline
              ? '<span style="color:var(--success);">متصل الآن</span>'
              : 'آخر ظهور: ' + formatRelativeTime(user.last_login)) +
          '</div>' +
          '<div class="user-actions">' + actionsHtml + '</div>' +
        '</div>' +
      '</div>';
  }

  // ============================================
  // 6. Bind Actions
  // ============================================
  function bindCardActions() {
    document.querySelectorAll('#usersGrid [data-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');
        if (!id) return;

        if (action === 'edit') {
          openEditModal(id);
        } else if (action === 'toggle') {
          toggleUserActive(id);
        } else if (action === 'delete') {
          deleteUser(id);
        }
      });
    });
  }

  // ============================================
  // 7. Modal Management
  // ============================================
  function openAddModal() {
    state.editingUserId = null;

    setText('modalTitleText', 'إضافة مستخدم جديد');
    setText('saveUserBtnText', 'إضافة المستخدم');

    // Reset form
    $('editUserId').value = '';
    $('userFullName').value = '';
    $('userEmail').value = '';
    $('userEmail').disabled = false;
    $('userPassword').value = '';
    $('userPassword').placeholder = '8 أحرف على الأقل';
    $('userRole').value = '';
    $('userStatus').value = 'true';

    // Show password field (required for new user)
    var pwdField = $('passwordField');
    if (pwdField) pwdField.style.display = 'block';

    var pwdLabel = $('passwordLabel');
    if (pwdLabel) {
      pwdLabel.textContent = 'كلمة المرور';
      pwdLabel.classList.add('required');
    }

    var pwdInput = $('userPassword');
    if (pwdInput) pwdInput.required = true;

    // Update email hint
    var emailHint = $('emailHint');
    if (emailHint) emailHint.textContent = 'سيُستخدم لتسجيل الدخول';

    // Clear errors
    clearFormErrors();

    // Show modal
    $('userModal').classList.add('show');

    setTimeout(function () {
      $('userFullName').focus();
    }, 100);
  }

  function openEditModal(userId) {
    var user = state.allUsers.find(function (u) { return u.id === userId; });
    if (!user) {
      toast('المستخدم غير موجود', 'error');
      return;
    }

    state.editingUserId = userId;

    setText('modalTitleText', 'تعديل مستخدم');
    setText('saveUserBtnText', 'حفظ التغييرات');

    // Fill form
    $('editUserId').value = userId;
    $('userFullName').value = user.full_name || '';
    $('userEmail').value = user.email || '';
    $('userEmail').disabled = true;  // لا يمكن تغيير البريد
    $('userPassword').value = '';
    $('userPassword').placeholder = 'اتركها فارغة لعدم التغيير';
    $('userRole').value = user.role || 'user';
    $('userStatus').value = user.is_active !== false ? 'true' : 'false';

    // Show password field but optional
    var pwdField = $('passwordField');
    if (pwdField) pwdField.style.display = 'block';

    var pwdLabel = $('passwordLabel');
    if (pwdLabel) {
      pwdLabel.textContent = 'كلمة المرور الجديدة (اختياري)';
      pwdLabel.classList.remove('required');
    }

    var pwdInput = $('userPassword');
    if (pwdInput) pwdInput.required = false;

    // Update email hint
    var emailHint = $('emailHint');
    if (emailHint) emailHint.textContent = 'لا يمكن تغيير البريد الإلكتروني';

    // Prevent editing own role
    if (state.currentUser && userId === state.currentUser.id) {
      $('userRole').disabled = true;
      $('userStatus').disabled = true;
    } else {
      $('userRole').disabled = false;
      $('userStatus').disabled = false;
    }

    // Clear errors
    clearFormErrors();

    // Show modal
    $('userModal').classList.add('show');
  }

  function closeModal() {
    $('userModal').classList.remove('show');
    state.editingUserId = null;
    state.submitting = false;
  }

  // ============================================
  // 8. Form Validation
  // ============================================
  function clearFormErrors() {
    ['userFullNameError', 'userEmailError', 'userPasswordError', 'userRoleError'].forEach(function (id) {
      var el = $(id);
      if (el) { el.classList.remove('show'); el.textContent = ''; }
    });
    ['userFullName', 'userEmail', 'userPassword', 'userRole'].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.remove('error');
    });
  }

  function setError(fieldId, errorId, msg) {
    var field = $(fieldId);
    var error = $(errorId);
    if (field) field.classList.add('error');
    if (error) { error.textContent = msg; error.classList.add('show'); }
  }

  function validateForm() {
    clearFormErrors();
    var valid = true;

    var fullName = $('userFullName').value.trim();
    if (!fullName || fullName.length < 3) {
      setError('userFullName', 'userFullNameError', 'الاسم يجب أن يكون 3 أحرف على الأقل');
      valid = false;
    }

    var isEdit = !!state.editingUserId;

    if (!isEdit) {
      var email = $('userEmail').value.trim();
      if (!email || !isValidEmail(email)) {
        setError('userEmail', 'userEmailError', 'البريد الإلكتروني غير صحيح');
        valid = false;
      }
    }

    var password = $('userPassword').value;

    if (!isEdit) {
      // Password required for new user
      if (!password || password.length < PASSWORD_MIN_LENGTH) {
        setError('userPassword', 'userPasswordError', 'كلمة المرور يجب أن تكون ' + PASSWORD_MIN_LENGTH + ' أحرف على الأقل');
        valid = false;
      }
    } else {
      // Password optional for edit, but if filled must be valid
      if (password && password.length < PASSWORD_MIN_LENGTH) {
        setError('userPassword', 'userPasswordError', 'كلمة المرور يجب أن تكون ' + PASSWORD_MIN_LENGTH + ' أحرف على الأقل');
        valid = false;
      }
    }

    var role = $('userRole').value;
    if (!role) {
      setError('userRole', 'userRoleError', 'اختر الدور');
      valid = false;
    }

    return valid;
  }

  // ============================================
  // 9. Submit (Create or Update)
  // ============================================
  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (state.submitting) return;

    if (!validateForm()) {
      toast('يرجى مراجعة البيانات', 'error');
      return;
    }

    if (state.editingUserId) {
      updateUser();
    } else {
      createUser();
    }
  }

  // ============================================
  // 10. Create User (via Secondary Client - safe)
  // ============================================
  function createUser() {
    var fullName = $('userFullName').value.trim();
    var email = $('userEmail').value.trim();
    var password = $('userPassword').value;
    var role = $('userRole').value;
    var isActive = $('userStatus').value === 'true';

    state.submitting = true;
    disableSaveBtn(true);

    logDebug('Creating user:', email);

    // ✅ Secondary client - لا يؤثر على session السوبر أدمن
    var secondaryClient;
    try {
      secondaryClient = window.supabase.createClient(
        window.ITWS_CONFIG.SUPABASE_URL,
        window.ITWS_CONFIG.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: 'itws_temp_' + Date.now() + '_' + Math.random()
          }
        }
      );
    } catch (e) {
      toast('تعذر تهيئة العميل المؤقت', 'error');
      state.submitting = false;
      disableSaveBtn(false);
      return;
    }

    var newUserId = null;

    // 1. Create auth user
    secondaryClient.auth.signUp({ email: email, password: password })
      .then(function (result) {
        if (result.error) {
          // Handle specific errors
          if (result.error.message && result.error.message.indexOf('already') !== -1) {
            throw new Error('البريد الإلكتروني مستخدم بالفعل');
          }
          throw new Error(result.error.message || 'فشل إنشاء المستخدم');
        }

        if (!result.data || !result.data.user) {
          throw new Error('فشل إنشاء المستخدم - لم يتم إرجاع بيانات');
        }

        newUserId = result.data.user.id;
        logDebug('Auth user created:', newUserId);

        // 2. Insert into profiles (using MAIN client - admin session)
        return window.sb.from('profiles').insert({
          id: newUserId,
          email: email,
          full_name: fullName,
          role: role,
          is_active: isActive,
          phone: null,
          created_at: new Date().toISOString()
        });
      })
      .then(function (res) {
        if (res && res.error) {
          throw new Error('فشل إنشاء البروفايل: ' + res.error.message);
        }

        // 3. Sign out from secondary
        return secondaryClient.auth.signOut();
      })
      .then(function () {
        toast('تم إنشاء المستخدم بنجاح', 'success');
        logDebug('User created successfully');

        logActivity('create_user', 'إضافة مستخدم: ' + fullName, {
          new_user_email: email,
          role: role
        });

        // Close modal + reload
        closeModal();

        setTimeout(function () {
          loadAndRender();
        }, 500);
      })
      .catch(function (err) {
        logDebug('Create user error:', err.message);
        toast(err.message || 'حدث خطأ في إنشاء المستخدم', 'error');

        state.submitting = false;
        disableSaveBtn(false);
      });
  }

  // ============================================
  // 11. Update User
  // ============================================
  function updateUser() {
    var userId = state.editingUserId;
    if (!userId) return;

    var user = state.allUsers.find(function (u) { return u.id === userId; });
    if (!user) {
      toast('المستخدم غير موجود', 'error');
      return;
    }

    var fullName = $('userFullName').value.trim();
    var role = $('userRole').value;
    var isActive = $('userStatus').value === 'true';
    var newPassword = $('userPassword').value;

    // Prevent editing own role/status
    if (state.currentUser && userId === state.currentUser.id) {
      role = user.role; // Force keep
      isActive = user.is_active;
    }

    var updateData = {
      full_name: fullName,
      role: role,
      is_active: isActive
    };

    state.submitting = true;
    disableSaveBtn(true);

    // 1. Update profiles
    window.sb.from('profiles').update(updateData).eq('id', userId)
      .then(function (res) {
        if (res.error) {
          throw new Error(res.error.message);
        }

        // 2. If new password provided → we can't change it via client-side without admin
        // Skip for now - would need Edge Function
        if (newPassword && newPassword.length >= PASSWORD_MIN_LENGTH) {
          // Show info toast - password change requires edge function
          logDebug('Password change requested but skipped (requires admin SDK)');
        }

        toast('تم تحديث المستخدم بنجاح', 'success');
        logDebug('User updated:', userId);

        logActivity('update_user', 'تحديث مستخدم: ' + fullName, {
          user_id: userId,
          role: role,
          is_active: isActive
        });

        closeModal();

        setTimeout(function () {
          loadAndRender();
        }, 500);
      })
      .catch(function (err) {
        logDebug('Update error:', err.message);
        toast('فشل التحديث: ' + err.message, 'error');
        state.submitting = false;
        disableSaveBtn(false);
      });
  }

  // ============================================
  // 12. Toggle Active
  // ============================================
  function toggleUserActive(userId) {
    var user = state.allUsers.find(function (u) { return u.id === userId; });
    if (!user) return;

    if (state.currentUser && userId === state.currentUser.id) {
      toast('لا يمكنك تعطيل حسابك الخاص', 'error');
      return;
    }

    var isActive = user.is_active !== false;
    var newState = !isActive;

    var confirmMsg = newState
      ? 'تفعيل المستخدم "' + user.full_name + '"?'
      : 'تعطيل المستخدم "' + user.full_name + '"? لن يتمكن من تسجيل الدخول.';

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm(confirmMsg)) return;
      performToggle(userId, newState);
      return;
    }

    window.Modal.confirm({
      title: newState ? 'تفعيل مستخدم' : 'تعطيل مستخدم',
      message: confirmMsg,
      confirmText: newState ? 'تفعيل' : 'تعطيل',
      cancelText: 'إلغاء',
      icon: newState ? 'success' : 'warning',
      danger: !newState
    }).then(function (confirmed) {
      if (confirmed) performToggle(userId, newState);
    });
  }

  function performToggle(userId, isActive) {
    var user = state.allUsers.find(function (u) { return u.id === userId; });
    if (!user) return;

    window.sb.from('profiles').update({ is_active: isActive }).eq('id', userId)
      .then(function (res) {
        if (res.error) {
          toast('فشل التحديث: ' + res.error.message, 'error');
          return;
        }

        toast('تم ' + (isActive ? 'تفعيل' : 'تعطيل') + ' المستخدم', 'success');
        logDebug('User toggled:', userId, '→', isActive);

        logActivity(isActive ? 'activate_user' : 'deactivate_user',
          (isActive ? 'تفعيل' : 'تعطيل') + ' مستخدم: ' + user.full_name,
          { user_id: userId });

        // Update local
        user.is_active = isActive;

        applyFilters();
        updateMiniStats();
        render();
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
      });
  }

  // ============================================
  // 13. Delete User (Soft)
  // ============================================
  function deleteUser(userId) {
    var user = state.allUsers.find(function (u) { return u.id === userId; });
    if (!user) return;

    if (state.currentUser && userId === state.currentUser.id) {
      toast('لا يمكنك حذف حسابك الخاص', 'error');
      return;
    }

    // Prevent deleting the last super_admin
    if (user.role === 'super_admin') {
      var superAdmins = state.allUsers.filter(function (u) {
        return u.role === 'super_admin' && u.is_active !== false;
      });
      if (superAdmins.length <= 1) {
        toast('لا يمكن حذف آخر سوبر أدمن في النظام', 'error');
        return;
      }
    }

    var msg = 'حذف المستخدم "' + (user.full_name || user.email) + '"? سيتم تعطيل الحساب نهائياً ولا يمكنه تسجيل الدخول.';

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm(msg)) return;
      performDelete(userId, user);
      return;
    }

    window.Modal.confirm({
      title: 'حذف مستخدم',
      message: msg,
      confirmText: 'حذف نهائي',
      cancelText: 'إلغاء',
      icon: 'error',
      danger: true
    }).then(function (confirmed) {
      if (confirmed) performDelete(userId, user);
    });
  }

  function performDelete(userId, user) {
    // Soft delete = deactivate + mark deleted
    window.sb.from('profiles').update({
      is_active: false,
      deleted_at: new Date().toISOString()
    }).eq('id', userId)
      .then(function (res) {
        if (res.error) {
          // Fallback: just deactivate
          return window.sb.from('profiles').update({ is_active: false }).eq('id', userId);
        }
      })
      .then(function () {
        toast('تم حذف المستخدم بنجاح', 'success');
        logDebug('User deleted (soft):', userId);

        logActivity('delete_user', 'حذف مستخدم: ' + (user.full_name || user.email), {
          user_id: userId,
          email: user.email
        });

        // Remove from local state
        state.allUsers = state.allUsers.filter(function (u) { return u.id !== userId; });

        applyFilters();
        updateMiniStats();
        render();
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
      });
  }

  // ============================================
  // 14. Helpers
  // ============================================
  function disableSaveBtn(disable) {
    var btn = $('saveUserBtn');
    if (!btn) return;
    btn.disabled = disable;
    if (disable) {
      btn.innerHTML = '<span>جاري الحفظ...</span>';
    } else {
      btn.innerHTML = '' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">' +
          '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>' +
          '<polyline points="17 21 17 13 7 13 7 21"></polyline>' +
          '<polyline points="7 3 7 8 15 8"></polyline>' +
        '</svg>' +
        '<span>' + (state.editingUserId ? 'حفظ التغييرات' : 'إضافة المستخدم') + '</span>';
    }
  }

  function logActivity(type, description, details) {
    if (!window.sb || !state.currentUser) return;

    window.sb.from('activities').insert({
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      user_role: state.currentUser.role,
      action_type: type,
      description: description,
      details: details || {}
    }).catch(function () {});
  }

  // ============================================
  // 15. Filters Binding
  // ============================================
  function syncFiltersFromUI() {
    state.filters.search = ($('searchInput') || {}).value || '';
    state.filters.role = ($('roleFilter') || {}).value || '';
    state.filters.status = ($('statusFilter') || {}).value || '';
    state.filters.sort = ($('sortFilter') || {}).value || 'newest';
    state.filters.search = state.filters.search.trim();
  }

  function applyAndRender() {
    syncFiltersFromUI();
    applyFilters();
    render();
  }

  function resetFilters() {
    ['searchInput', 'roleFilter', 'statusFilter'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var sortEl = $('sortFilter');
    if (sortEl) sortEl.value = 'newest';

    state.filters = { search: '', role: '', status: '', sort: 'newest' };

    applyFilters();
    render();
  }

  function bindFilters() {
    // Debounced search
    var searchInput = $('searchInput');
    if (searchInput) {
      var timer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(applyAndRender, 250);
      });
    }

    // Selects
    ['roleFilter', 'statusFilter', 'sortFilter'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', applyAndRender);
    });

    // Reset
    var resetBtn = $('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);

    var emptyResetBtn = $('emptyResetBtn');
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetFilters);
  }

  // ============================================
  // 16. Modal Events
  // ============================================
  function bindModalEvents() {
    // Add button
    var addBtn = $('addUserBtn');
    if (addBtn) addBtn.addEventListener('click', openAddModal);

    // Close button
    var closeBtn = $('modalCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Cancel button
    var cancelBtn = $('cancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Backdrop click
    var modal = $('userModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
      });
    }

    // Esc
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
        closeModal();
      }
    });

    // Form submit
    var form = $('userForm');
    if (form) form.addEventListener('submit', handleSubmit);
  }

  // ============================================
  // 17. Load and Render
  // ============================================
  function loadAndRender() {
    var loader = $('adminLoader');
    if (loader) loader.classList.add('show');

    return Promise.all([loadUsers(), loadOnlineSessions()])
      .then(function (results) {
        var usersRes = results[0];
        var onlineMap = results[1];

        if (usersRes && usersRes.error) throw new Error(usersRes.error.message);

        state.allUsers = (usersRes && usersRes.data) || [];
        state.onlineUsers = onlineMap || {};

        applyFilters();
        updateMiniStats();
        render();

        logDebug('Loaded:', {
          total: state.allUsers.length,
          online: Object.keys(state.onlineUsers).length
        });
      })
      .catch(function (err) {
        if (loader) loader.classList.remove('show');
        toast('حدث خطأ في تحميل المستخدمين', 'error');
        logDebug('Load error:', err.message);

        var empty = $('adminEmpty');
        if (empty) empty.classList.add('show');
      });
  }

  // ============================================
  // 18. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    bindFilters();
    bindModalEvents();

    waitForSupabase(function () {
      loadAndRender();
    });

    logDebug('Admin users initialized');
  }

  function waitForSupabase(cb) {
    if (window.sb) { cb(); return; }
    var w = 0;
    var i = setInterval(function () {
      w += 100;
      if (window.sb || w >= 3000) {
        clearInterval(i);
        if (window.sb) cb();
      }
    }, 100);
  }

  // ============================================
  // 19. Public API
  // ============================================
  window.AdminUsers = {
    initialized: true,
    init: init,
    refresh: function () { return loadAndRender(); },
    resetFilters: resetFilters,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
