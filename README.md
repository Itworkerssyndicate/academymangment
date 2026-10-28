# 📘 ITWS Platform — Master Blueprint V2

## المرجع الوحيد للمشروع — كل التفاصيل، بلا استثناء

> **اقرأه بالكامل. لو أي حد (إنت أو أي مساعد) قرأ الوثيقة دي، هيقدر يبني المشروع من الصفر بدون سؤال.**
> **الحجم المتوقع: 50+ صفحة. الرد ده Part 1 من 3 أو 4. هكمّل معاك لحد ما يخلص كامل.**

---

# 📑 فهرس الأجزاء

| Part | المحتوى |
|------|---------|
| **Part 1** (هذا الرد) | الرؤية — القواعد — الـ Stack — هيكل الملفات — **قائمة الـ 55 شاشة بالتفصيل** — نظام المستخدمين والأدوار |
| **Part 2** | مصفوفة الصلاحيات الكاملة — Database Schema — Storage — RLS — Systems (Labels / Themes / Realtime) |
| **Part 3** | Flows التفصيلية (Auth / Certificate Issuance / Rating / Track / Verify) — Implementation Phases — Seed Data — Checklist |

---

# 🏛️ Part 1 — الأساسيات

## 1.1 — الرؤية الجديدة (V2)

النقابة مش وسيط — النقابة **مُصدر شهادات رئيسي** ولها **كورسات خاصة**، وفي نفس الوقت **جهة اعتماد** للأكاديميات الخارجية.

### الفرق بين V1 و V2 (مختصر)

| البند | V1 | V2 |
|-------|----|----|
| **دور النقابة** | اعتماد أكاديميات فقط | إصدار شهادات (كورسات النقابة) + اعتماد أكاديميات |
| **المستخدمين** | 4 roles عامة | **16 role** بمستويات (محافظة / فرع / أكاديمية / لجنة) |
| **الصلاحيات** | hard-coded | **جدول `permissions`** + `scope` |
| **كل النصوص** | في HTML | **`labels` table** + شاشة تحرير كاملة |
| **الثيمز** | 6 | **17** + Auto + System |
| **Realtime** | settings فقط | **كل شاشة مشتركة على الجداول اللي تقرأها** |
| **التقييم** | مش موجود | **نجوم + تعليق + toggle visible** |
| **بوابة الأكاديمية** | طلب اعتماد فقط | **بوابة كاملة** (شهادات/تقارير/طباعة) |
| **بوابة الفرع** | مش موجودة | **كاملة** (محافظة واحدة) |

---

## 1.2 — قواعد غير قابلة للكسر (Rules)

### 🔴 R1 — بدون إيموجي نهائياً
- ممنوع: `🎓 ✅ ❌ 📜 🏛️ 🔍`
- مسموح: SVG inline + نصوص عربية + `✓` `×` `→` `←` (كـ unicode في حالات نادرة)
- كل الأيقونات `assets/js/icons.js` (sprite مركزي)

### 🔴 R2 — مسارات نسبية فقط
- **ممنوع** `/home.html` أو `src="/assets/..."`
- **مسموح** `home.html` أو `../home.html` أو `./home.html`
- `window.resolveUrl(path)` في `config.js` بيحل المسار على `BASE_PATH`

### 🔴 R3 — كل شيء من `settings` / `labels`
- ممنوع hardcode لأي: اسم، لون، نص، رقم، عنوان، زر
- كل النصوص: `Labels.t('key', 'fallback')`
- كل الألوان: CSS vars من `themes`
- كل السلوكيات: `AppSettings.get('path', fallback)`

### 🔴 R4 — الثيم الافتراضي `watanii_dark`
- يقدر النقيب العام يغيّره من `admin/settings/themes.html`
- المستخدم يقدر يعمل override محلي
- لو الافتراضي اتغير → realtime push لكل المستخدمين اللي معندهمش override

### 🔴 R5 — Secrets
- `SUPABASE_ANON_KEY` فقط في `config.js`
- `SERVICE_ROLE_KEY` فقط في `supabase/functions/` (Edge Functions)
- ممنوع `console.log` لأي data حساسة (national_id, password, tokens)

### 🔴 R6 — Supabase Client
- Global واحد فقط: **`window.sb`**
- يعرّف في `assets/js/supabase-client.js`
- كل الملفات بتستخدم `window.sb` (لا `supabase` ولا `supabaseClient`)
- fallback داخلي مقبول: `getSb()` في كل ملف يجرّب الأسماء البديلة

### 🔴 R7 — Realtime على كل شاشة
- كل شاشة بتشترك على الجداول اللي بتقرأ منها
- ممنوع reload تلقائي — التحديث يبقى **in-place**
- مع debounce 300ms + fallback polling كل 30s لو الـ WS قطع

### 🔴 R8 — صلاحيات على كل مستوى
- **DB level**: RLS policy لكل جدول
- **JS level**: `Permissions.can(action, resource, scope)` قبل كل عملية حساسة
- **UI level**: إخفاء/تعطيل الأزرار اللي مش مسموح بها

### 🔴 R9 — Cairo فقط
- الخط الأساسي Cairo (Google Fonts)
- ممنوع Courier / IBM Plex / Tajawal
- للأكواد: Cairo + `font-variant-numeric: tabular-nums`

### 🔴 R10 — اللغة العربية
- `dir="rtl"` على `<html>` في كل الصفحات
- الأرقام والأكواد اللاتينية `dir="ltr"`
- التواريخ بصيغة `DD/MM/YYYY`

### 🔴 R11 — لا تخزين بيانات حساسة في المتصفح
- ممنوع national_id في localStorage / URL / sessionStorage
- ممنوع password في أي مكان
- tokens فقط في Supabase Auth storage (اللي بيديرها)

### 🔴 R12 — كل عملية كتابة مسجلة
- كل INSERT/UPDATE/DELETE في الجداول الحساسة يتسجل في `activities`
- مع `actor_id`, `action_type`, `resource_type`, `resource_id`, `old_data`, `new_data`

---

## 1.3 — التقنيات (Stack)

| الطبقة | التقنية | ملاحظات |
|-------|---------|---------|
| HTML | HTML5 | semantic tags، `data-*` attributes |
| CSS | CSS3 + CSS Variables | بدون Tailwind / build step |
| JS | Vanilla ES5-style IIFE | بدون React / Vue / TS / bundler |
| DB | Supabase PostgreSQL | 14 → **28 جدول** |
| Auth | Supabase Auth | JWT + RLS |
| Storage | Supabase Storage | 4 buckets |
| Realtime | Supabase Realtime (Postgres Changes) | للجداول الحساسة |
| Edge Functions | Deno (Supabase) | PDF, QR, Email, Webhooks |
| Fonts | Cairo (Google Fonts) | weight 300-900 |
| Icons | SVG inline (sprite) | لا مكتبات أيقونات خارجية |
| Host | GitHub Pages | `https://itworkerssyndicate.github.io/academymangment/` |

---

## 1.4 — هيكل الملفات الكامل

```
itws-platform/
│
├── index.html                          → 01. Splash
├── home.html                           → 02. الرئيسية
├── verify.html                         → 03. التحقق
├── student.html                        → 04. صفحة المتدرب
├── track.html                          → 05. متابعة طلب اعتماد
├── academies.html                      → 06. دليل الأكاديميات
├── academy-details.html                → 07. تفاصيل أكاديمية
├── academy-apply.html                  → 08. تقديم اعتماد
├── login.html                          → 09. تسجيل الدخول
├── reset-password.html                 → 10. استعادة كلمة المرور
├── 404.html                            → 11. صفحة غير موجودة
│
├── admin/                              ← لوحة النقيب العام + اللجنة
│   ├── index.html                      → 12. Dashboard
│   ├── settings/
│   │   ├── index.html                  → 13. إعدادات عامة
│   │   ├── themes.html                 → 14. الثيمات
│   │   ├── labels.html                 → 15. كل النصوص
│   │   ├── workflow.html               → 16. سير العمل
│   │   ├── security.html               → 17. الأمان
│   │   ├── ratings.html                → 18. التقييمات
│   │   ├── certificates.html           → 19. الشهادات
│   │   └── backup.html                 → 20. النسخ الاحتياطي
│   ├── users/
│   │   ├── index.html                  → 21. قائمة المستخدمين
│   │   ├── requests.html               → 22. طلبات التسجيل
│   │   ├── roles.html                  → 23. الأدوار
│   │   └── permissions.html            → 24. الصلاحيات
│   ├── branches/
│   │   ├── index.html                  → 25. الفروع
│   │   ├── add.html                    → 26. إضافة فرع
│   │   └── edit.html                   → 27. تعديل فرع
│   ├── academies/
│   │   ├── index.html                  → 28. الأكاديميات
│   │   ├── add.html                    → 29. إضافة أكاديمية
│   │   ├── edit.html                   → 30. تعديل أكاديمية
│   │   ├── details.html                → 31. تفاصيل أكاديمية
│   │   └── ratings.html                → 32. تقييمات الأكاديميات
│   ├── certificates/
│   │   ├── index.html                  → 33. الشهادات
│   │   ├── add.html                    → 34. إصدار شهادة (auto/manual)
│   │   ├── edit.html                   → 35. تعديل شهادة
│   │   └── revoke.html                 → 36. إلغاء شهادة
│   ├── requests/
│   │   ├── index.html                  → 37. طلبات الاعتماد
│   │   └── details.html                → 38. تفاصيل طلب
│   ├── union-courses/
│   │   ├── index.html                  → 39. كورسات النقابة
│   │   ├── add.html                    → 40. إضافة كورس
│   │   └── edit.html                   → 41. تعديل كورس
│   ├── reports/
│   │   └── index.html                  → 42. التقارير
│   ├── activities.html                 → 43. سجل النشاطات
│   └── login-logs.html                 → 44. محاولات الدخول
│
├── portal/                             ← بوابة الأكاديمية
│   ├── index.html                      → 45. Dashboard
│   ├── certificates/
│   │   ├── index.html                  → 46. شهادات الأكاديمية
│   │   ├── add.html                    → 47. إصدار شهادة
│   │   └── edit.html                   → 48. تعديل شهادة
│   ├── reports.html                    → 49. تقارير الأكاديمية
│   ├── profile.html                    → 50. الملف الشخصي
│   ├── application.html                → 51. طلب اعتماد
│   └── courses.html                    → 52. كورسات الأكاديمية
│
├── branch/                             ← بوابة الفرع (محافظة)
│   ├── index.html                      → 53. Dashboard
│   ├── users.html                      → 54. مستخدمو الفرع
│   ├── academies.html                  → 55. أكاديميات المحافظة
│   └── certificates.html               → 56. شهادات المحافظة
│
├── assets/
│   ├── css/
│   │   ├── theme.css                   ← CSS vars لكل الثيمات
│   │   ├── base.css                    ← Reset + Typography
│   │   ├── components.css              ← Buttons, Cards, Forms, Modals
│   │   ├── loader.css                  ← Splash + Loaders
│   │   ├── layout.css                  ← Header, Sidebar, Grid
│   │   └── pages.css                   ← Page-specific styles
│   │
│   ├── js/
│   │   ├── settings-defaults.js        ← القيم الافتراضية
│   │   ├── config.js                   ← Supabase + BASE_PATH
│   │   ├── supabase-client.js          ← window.sb
│   │   ├── app-settings.js             ← settings manager
│   │   ├── labels.js                   ← labels manager (جديد)
│   │   ├── permissions.js              ← permission engine (جديد)
│   │   ├── themes-data.js              ← 17 ثيم
│   │   ├── theme.js                    ← theme manager + FOUC
│   │   ├── realtime.js                 ← realtime manager (جديد)
│   │   ├── icons.js                    ← SVG sprite (جديد)
│   │   ├── utils.js                    ← toast, date, validation
│   │   ├── session.js                  ← heartbeat + online
│   │   ├── auth-guard.js               ← صفحة الحماية
│   │   ├── app-title.js                ← title + favicon
│   │   │
│   │   ├── ui/
│   │   │   ├── header.js               ← Public Header
│   │   │   ├── sidebar.js              ← Admin/Branch/Portal Sidebar
│   │   │   ├── modal.js                ← Modals
│   │   │   ├── toast.js                ← Notifications
│   │   │   ├── dropdown.js             ← Menus
│   │   │   └── table.js                ← Data tables + pagination + filters
│   │   │
│   │   └── pages/
│   │       ├── splash.js
│   │       ├── home.js
│   │       ├── verify.js
│   │       ├── student.js
│   │       ├── track.js
│   │       ├── academies.js
│   │       ├── academy-details.js
│   │       ├── academy-apply.js
│   │       ├── login.js
│   │       ├── reset-password.js
│   │       │
│   │       ├── admin/
│   │       │   ├── dashboard.js
│   │       │   ├── settings-general.js
│   │       │   ├── settings-themes.js
│   │       │   ├── settings-labels.js
│   │       │   ├── settings-workflow.js
│   │       │   ├── settings-security.js
│   │       │   ├── settings-ratings.js
│   │       │   ├── settings-certificates.js
│   │       │   ├── settings-backup.js
│   │       │   ├── users.js
│   │       │   ├── users-requests.js
│   │       │   ├── users-roles.js
│   │       │   ├── users-permissions.js
│   │       │   ├── branches.js
│   │       │   ├── branches-form.js
│   │       │   ├── academies.js
│   │       │   ├── academies-form.js
│   │       │   ├── academies-details.js
│   │       │   ├── academies-ratings.js
│   │       │   ├── certificates.js
│   │       │   ├── certificates-form.js
│   │       │   ├── certificates-revoke.js
│   │       │   ├── requests.js
│   │       │   ├── requests-details.js
│   │       │   ├── union-courses.js
│   │       │   ├── union-courses-form.js
│   │       │   ├── reports.js
│   │       │   ├── activities.js
│   │       │   └── login-logs.js
│   │       │
│   │       ├── portal/
│   │       │   ├── dashboard.js
│   │       │   ├── certificates.js
│   │       │   ├── certificates-form.js
│   │       │   ├── reports.js
│   │       │   ├── profile.js
│   │       │   ├── application.js
│   │       │   └── courses.js
│   │       │
│   │       └── branch/
│   │           ├── dashboard.js
│   │           ├── users.js
│   │           ├── academies.js
│   │           └── certificates.js
│   │
│   └── images/
│       ├── logo.svg
│       └── stamp.png
│
├── supabase/
│   ├── schema.sql                       ← 28 جدول
│   ├── rls-policies.sql                 ← صلاحيات كل جدول
│   ├── seed.sql                         ← 27 محافظة + 17 ثيم + labels
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   ├── 002_add_branches.sql
│   │   ├── 003_add_ratings.sql
│   │   └── 004_add_labels.sql
│   └── functions/
│       ├── generate-pdf/index.ts        ← PDF server-side
│       ├── generate-qr/index.ts         ← QR code
│       ├── send-email/index.ts          ← Email
│       └── auto-code/index.ts           ← توليد كود شهادة
│
└── docs/
    ├── HANDOFF.md                       ← الوثيقة دي
    ├── SCREENS.md                       ← تفاصيل كل شاشة
    ├── ROLES.md                         ← الأدوار والصلاحيات
    └── DATABASE.md                      ← Schema تفصيلي
```

---

## 1.5 — قائمة الـ 56 شاشة (بالتفصيل)

> كل شاشة ليها: **رقم — اسم — مسار — الغرض — الوصول — الـ JS المرافق — الجداول المستخدمة — Realtime**
> الرد ده بيغطي 1-24، والباقي في Part 2.

### 📍 المجموعة 1: الصفحات العامة (11 شاشة)

---

#### 01. Splash Screen
- **المسار**: `index.html`
- **الوصف**: شاشة الترحيب بتحمّل 2-3 ثواني وبعدها redirect حسب الدور
- **الوصول**: عام
- **JS**: `assets/js/pages/splash.js`
- **Settings**: `splash.*` (enabled, min_duration, max_duration, loading_texts[], animation_level)
- **Realtime**: `settings` (لو splash اتغير أثناء العرض)
- **سلوك**:
  - يقرأ session من Supabase
  - يحدد الـ role → يحوّل:
    - guest → `home.html`
    - super_admin/committee_* → `admin/index.html`
    - branch_* → `branch/index.html`
    - academy_* → `portal/index.html`
    - user → `home.html`
    - pending_user → `login.html?pending=1`
  - يحترم `?next=` param (مع validation anti-traversal)

---

#### 02. الرئيسية
- **المسار**: `home.html`
- **الوصف**: Hero + بحث + قسم مخصص + عن المنصة + أحدث أكاديميات + تقييمات + CTA + Footer
- **الوصول**: عام
- **JS**: `assets/js/pages/home.js`
- **Settings**: `app_identity.*`, `behavior.*`, `footer.*`, `theme.*`, `ratings.*`
- **Labels**: `home.hero.*`, `home.search.*`, `home.about.*`, `home.cta.*`
- **الجداول**: `academies` (approved), `academy_ratings` (visible only), `settings`, `labels`
- **Realtime**: `academies`, `academy_ratings`, `settings`, `labels`
- **Sections**:
  1. Hero (title + subtitle + badge من settings)
  2. Search (3 tabs: شهادة / متدرب / أكاديمية)
  3. Custom Section (اختياري)
  4. About Section (3 features)
  5. Latest Academies (6 كارت + تقييم نجوم)
  6. **Top Rated Academies** (جديد — لو `ratings.show_on_home = true`)
  7. CTA (قدم أكاديميتك)
  8. Footer (روابط + سوشيال + copyright + نقيب)
- **Theme FAB** (لو `behavior.enable_theme_picker_for_visitors = true`)

---

#### 03. التحقق من شهادة
- **المسار**: `verify.html`
- **الوصف**: التحقق من شهادة (سواء شهادة نقابة أو أكاديمية)
- **الوصول**: عام
- **JS**: `assets/js/pages/verify.js`
- **Settings**: `app_identity.*`, `certificates.*`, `labels.*`
- **الجداول**: `certificates`, `academies`, `academy_branches`, `union_courses`, `search_logs`
- **Realtime**: `certificates` (filtered by `code`)
- **Features**:
  - بحث بـ `?code=XXX` أو إدخال يدوي
  - عرض **badge النوع** (شهادة نقابة / شهادة أكاديمية)
  - حالة: صالحة / ملغاة / غير صالحة / غير موجودة
  - QR code + تحميل PDF + مشاركة + نسخ رابط
  - تسجيل بحث في `search_logs` (بدون الـ code الكامل)
  - لو ملغاة: عرض سبب الإلغاء + تاريخ الإلغاء

---

#### 04. صفحة المتدرب
- **المسار**: `student.html`
- **الوصف**: عرض شهادات المتدرب + CV builder
- **الوصول**: عام (بحث برقم قومي)
- **JS**: `assets/js/pages/student.js`
- **Settings**: `app_identity.*`, `certificates.*`, `features.enable_cv_builder`, `labels.*`
- **الجداول**: `certificates`, `academies`, `union_courses`, `search_logs`
- **Realtime**: `certificates` (filtered by national_id hash — غير مفعّل للأمان)
- **Features**:
  - بحث بـ national_id (14 رقم)
  - **ما يخزّنش الرقم القومي** في URL/localStorage
  - Profile card: الاسم + آخر 4 أرقام فقط
  - قائمة الشهادات (union + academy) مع badges
  - CV Builder: يبني HTML + PDF
  - Share link (بدون national_id)
  - Log في `search_logs` بـ hash فقط

---

#### 05. متابعة طلب اعتماد
- **المسار**: `track.html`
- **الوصف**: متابعة حالة طلب اعتماد أكاديمية
- **الوصول**: عام (بحث برقم طلب)
- **JS**: `assets/js/pages/track.js`
- **Settings**: `accreditation.*`, `labels.*`
- **الجداول**: `accreditation_requests`, `request_stage_history`, `academies`
- **Realtime**: `accreditation_requests` (filtered by request_number), `request_stage_history`
- **Features**:
  - Timeline من `accreditation.stages` (7 مراحل)
  - SLA badges محسوبة من `accreditation.sla_days`
  - Approved/Rejected banners
  - Documents list
  - لو الـ request مرتبط بأكاديمية: زر "دخول البوابة"

---

#### 06. دليل الأكاديميات
- **المسار**: `academies.html`
- **الوصف**: دليل كامل للأكاديميات المعتمدة
- **الوصول**: عام
- **JS**: `assets/js/pages/academies.js`
- **Settings**: `behavior.pagination_public_size`, `ratings.*`, `labels.*`
- **الجداول**: `academies`, `academy_categories`, `academy_ratings`, `governorates`
- **Realtime**: `academies`, `academy_ratings`
- **Features**:
  - Filters: تصنيف + محافظة + تقييم
  - Search
  - Sorting: الأحدث / الأعلى تقييماً / الأبجدي
  - Pagination
  - Grid view
  - كل كارت يظهر: لوجو + اسم + تصنيف + محافظة + تقييم نجوم

---

#### 07. تفاصيل أكاديمية (عام)
- **المسار**: `academy-details.html`
- **الوصف**: صفحة عامة لأكاديمية معتمدة
- **الوصول**: عام
- **JS**: `assets/js/pages/academy-details.js`
- **Settings**: `ratings.*`, `labels.*`
- **الجداول**: `academies`, `academy_branches`, `academy_courses`, `academy_ratings`, `governorates`
- **Realtime**: `academies` (filtered by id), `academy_ratings`
- **Features**:
  - Header: لوجو + اسم + تصنيف + محافظة + تاريخ الاعتماد
  - تقييم نجوم + عدد المراجعات + زر "قيّم الأكاديمية" (لو `ratings.allow_public_rating = true`)
  - الفروع
  - الكورسات
  - زر "تحقق من شهادتك" (لو الطالب عنده شهادة من الأكاديمية)

---

#### 08. تقديم اعتماد أكاديمية
- **المسار**: `academy-apply.html`
- **الوصف**: فورم تقديم طلب اعتماد
- **الوصول**: عام (بعد تسجيل دخول)
- **JS**: `assets/js/pages/academy-apply.js`
- **Settings**: `accreditation.*`, `uploads.*`, `labels.*`
- **الجداول**: `academies`, `academy_branches`, `academy_courses`, `academy_documents`, `accreditation_requests`
- **Features**:
  - Multi-step form:
    1. بيانات الأكاديمية الأساسية
    2. الفروع (min من `accreditation.min_branches`)
    3. الكورسات (min من `accreditation.min_courses`)
    4. المستندات (tax_card, commercial_registry, place_photo, payment_receipt)
    5. المراجعة والإرسال
  - يحفظ مسودات في `localStorage` (يستكمل لو حصل disconnect)
  - Generates request_number بعد الإرسال
  - يظهر الـ tracker link

---

#### 09. تسجيل الدخول
- **المسار**: `login.html`
- **الوصف**: Login + auto-redirect لو عنده session
- **الوصول**: عام
- **JS**: `assets/js/pages/login.js` (مش inline — منفصل)
- **Settings**: `app_identity.*`, `behavior.redirect_*`, `security.*`, `labels.*`
- **الجداول**: `profiles`, `login_logs`, `activities`
- **Features**:
  - Session banner (لو فيه session نشطة)
  - Forgot password
  - Remember me (email only)
  - **Pending user flow**: لو `profiles.status = 'pending'` → يظهرله "طلبك قيد المراجعة"
  - لو `profiles.status = 'rejected'` → يظهرله سبب الرفض
  - Redirect حسب role مع `?next=` support

---

#### 10. استعادة كلمة المرور
- **المسار**: `reset-password.html`
- **الوصف**: تعيين كلمة مرور جديدة بعد reset link
- **الوصول**: عام (مع token من email)
- **JS**: `assets/js/pages/reset-password.js`
- **Settings**: `security.*`, `labels.*`
- **Features**:
  - يقرأ token من URL hash
  - فورم كلمة مرور جديدة + تأكيد
  - يعرض المتطلبات (min length من `security.password_min_length`)
  - Automatic redirect لـ login بعد النجاح

---

#### 11. صفحة غير موجودة
- **المسار**: `404.html`
- **الوصف**: صفحة خطأ موحدة
- **الوصول**: عام
- **JS**: بدون (static)
- **Features**:
  - رسالة من `labels['errors.404.message']`
  - زر العودة للرئيسية
  - يعرض الـ referrer لو آمن

---

### 📍 المجموعة 2: لوحة النقيب العام — Dashboard & Settings (9 شاشات)

---

#### 12. Dashboard الرئيسي
- **المسار**: `admin/index.html`
- **الوصف**: لوحة KPI شاملة للنقيب العام/اللجنة
- **الوصول**: `super_admin`, `committee_head`, `committee_deputy`, `committee_member` (بحسب صلاحيات)
- **JS**: `assets/js/pages/admin/dashboard.js`
- **Settings**: `behavior.*`, `labels.*`
- **الجداول**: `profiles`, `academies`, `certificates`, `accreditation_requests`, `user_requests`, `activities`, `academy_ratings`
- **Realtime**: `accreditation_requests`, `certificates`, `user_requests`, `activities`
- **KPI Cards** (كلها realtime):
  - عدد الشهادات (إجمالي + الشهر ده)
  - عدد الأكاديميات (approved + pending)
  - عدد المستخدمين (active + pending)
  - عدد الطلبات في كل مرحلة
- **Charts**:
  - Growth chart (شهادات آخر 12 شهر)
  - Distribution (شهادات نقابة vs أكاديميات)
  - Top 5 أكاديميات بالتقييم
- **Lists**:
  - أحدث الطلبات (آخر 10)
  - أحدث الشهادات
  - أحدث النشاطات
  - مستخدمين معلقين محتاجين موافقة

---

#### 13. الإعدادات العامة
- **المسار**: `admin/settings/index.html`
- **الوصف**: كل الإعدادات اللي مش ليها شاشة مخصصة
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/settings-general.js`
- **Settings**: `app_identity.*`, `behavior.*`, `footer.*`
- **Tabs**:
  1. الهوية (اسم النقابة، اللجنة، النقيب، اللوجو، الختم)
  2. التواصل (email, phone, website, address)
  3. Hero & Sections (title, subtitle, custom_section, about_section)
  4. Footer (copyright, links, social)
  5. Behaviors (redirects, session timeout, search, pagination)
- **Realtime**: `settings`, `labels`
- **رفع اللوجو والختم**: إلى Supabase Storage (`public-assets`)

---

#### 14. إدارة الثيمات
- **المسار**: `admin/settings/themes.html`
- **الوصف**: إدارة الـ 17 ثيم + الافتراضي
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/settings-themes.js`
- **الجداول**: `themes`, `settings`
- **Realtime**: `themes`
- **Features**:
  - Grid display لكل الثيمات (preview)
  - تفعيل/تعطيل ثيم
  - تعيين الافتراضي (واحد بس)
  - معاينة مباشرة (live preview)
  - تخصيص ألوان ثيم موجود (advanced) — يخزّن palette في `themes.colors` JSONB
  - إنشاء ثيم جديد (اختياري)

---

#### 15. إدارة النصوص (Labels)
- **المسار**: `admin/settings/labels.html`
- **الوصف**: تحرير كل نص في المنصة
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/settings-labels.js`
- **الجداول**: `labels`
- **Realtime**: `labels`
- **Features**:
  - Tabs لكل category (auth, home, verify, student, track, admin, portal, errors)
  - بحث live في كل labels
  - تعديل inline
  - عرض default value + القيمة الحالية
  - زر "استعادة الافتراضي" per label
  - زر "استعادة الكل" per category
  - Import/Export JSON
  - Filter: "المعدّلة فقط"

---

#### 16. إعدادات سير العمل
- **المسار**: `admin/settings/workflow.html`
- **الوصف**: مراحل الاعتماد + SLA + متطلبات
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/settings-workflow.js`
- **Settings**: `accreditation.*`
- **Features**:
  - تسمية كل مرحلة (7 مراحل)
  - SLA days لكل مرحلة
  - متطلبات: min_branches, min_courses, require_tax_card, إلخ
  - إعادة ترتيب مراحل (اختياري)

---

#### 17. إعدادات الأمان
- **المسار**: `admin/settings/security.html`
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/settings-security.js`
- **Settings**: `security.*`
- **Features**:
  - max_login_attempts (3-10)
  - lockout_minutes (1-120)
  - session_timeout_minutes (5-240)
  - require_email_verification
  - allow_password_reset
  - password_min_length (6-32)
  - require_2fa_for_super_admin (اختياري)
  - IP whitelist (اختياري)

---

#### 18. إعدادات التقييمات
- **المسار**: `admin/settings/ratings.html`
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/settings-ratings.js`
- **Settings**: `ratings.*`
- **Features**:
  - enable_ratings (on/off)
  - show_on_home
  - show_on_directory
  - allow_public_rating (لو off → بس النقابة تقيّم)
  - require_login_to_rate
  - min_stars (1-5)
  - allow_reviews (تعليق نصي)
  - review_max_length
  - auto_publish (vs review قبل النشر)
  - show_rating_badge (شارة على كارت الأكاديمية)

---

#### 19. إعدادات الشهادات
- **المسار**: `admin/settings/certificates.html`
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/settings-certificates.js`
- **Settings**: `certificates.*`
- **Features**:
  - code_prefix (NTI / UNI — configurable)
  - code_pattern (template)
  - random_length
  - **enable_auto_code** (توليد تلقائي)
  - **enable_manual_code** (كتابة يدوية)
  - grades[] (A+, A, B+, ...)
  - show_qr, show_stamp, show_signatures
  - revocation_enabled
  - batch_import_enabled
  - pdf_template (basic/advanced)

---

#### 20. النسخ الاحتياطي
- **المسار**: `admin/settings/backup.html`
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/settings-backup.js`
- **Features**:
  - تصدير Excel/CSV لكل: certificates, academies, users, activities
  - تصدير JSON لكل settings
  - استيراد JSON (restore settings)
  - Backup now → يرفع snapshot لـ Storage
  - قائمة backups سابقة
  - جدولة تلقائية (اختياري — يحتاج Edge Function)

---

### 📍 المجموعة 3: لوحة النقيب العام — المستخدمين والصلاحيات (4 شاشات)

---

#### 21. إدارة المستخدمين
- **المسار**: `admin/users/index.html`
- **الوصول**: `super_admin`, `committee_head` (بحسب صلاحيات)
- **JS**: `assets/js/pages/admin/users.js`
- **الجداول**: `profiles`, `governorates`, `branches`, `academies`
- **Realtime**: `profiles`
- **Features**:
  - Table: name, email, role, scope, status, last_login, actions
  - Filters: role, governorate, branch, academy, status
  - Search
  - Actions per user (بحسب صلاحيات):
    - تعديل
    - تعطيل / تفعيل
    - إعادة تعيين كلمة مرور
    - حذف (super_admin فقط)
    - عرض سجلات
  - Bulk actions (تعطيل/تفعيل جماعي)
  - Add user button → modal أو تحويل لـ add form

---

#### 22. طلبات التسجيل
- **المسار**: `admin/users/requests.html`
- **الوصول**: `super_admin`, `committee_head`, `branch_president`
- **JS**: `assets/js/pages/admin/users-requests.js`
- **الجداول**: `user_requests`, `profiles`
- **Realtime**: `user_requests`
- **Features**:
  - كل request فيه: name, email, requested_role, governorate, justification, documents
  - Approve → يتحوّل لـ profile active
  - Reject → مع سبب
  - **Auto-approved** لو النقيب العام أنشأ مباشرة
  - لو الطلب من اللجنة → اللجنة تقدر توافق (بحسب دورها)
  - لو طلب من محافظة → نقيب المحافظة يوافق
  - Realtime notification للمتقدم بعد الموافقة

---

#### 23. إدارة الأدوار
- **المسار**: `admin/users/roles.html`
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/users-roles.js`
- **الجداول**: `profiles` (aggregate), `permissions`
- **Features**:
  - عرض كل role + عدد المستخدمين + آخر تعديل
  - Description لكل role
  - Default permissions (رابط لـ permissions.html)
  - **مين يقدر يعيّن مين** — جدول قابل للتعديل (role_assignments)

---

#### 24. إدارة الصلاحيات
- **المسار**: `admin/users/permissions.html`
- **الوصول**: `super_admin` فقط
- **JS**: `assets/js/pages/admin/users-permissions.js`
- **الجداول**: `permissions`
- **Realtime**: `permissions`
- **Features**:
  - Matrix: rows = roles، columns = actions (resources × actions)
  - Toggle per cell
  - Category grouping (users, academies, certificates, settings, reports)
  - Save per group
  - زر "reset to defaults"
  - **⚠️ كل تغيير هنا يؤثر فوراً** على كل المستخدمين (realtime push)

---

## 1.6 — نظام المستخدمين والأدوار

### الأدوار الـ 16 (details)

| # | Role ID | الاسم العربي | الاسم EN | Scope | يعيّن مين |
|---|---------|-------------|----------|-------|-----------|
| 1 | `super_admin` | النقيب العام | President | كل المنصة | الكل |
| 2 | `committee_head` | رئيس لجنة التدريب | Committee Head | كل المنصة (ما عدا حذف نهائي) | committee_deputy, committee_member |
| 3 | `committee_deputy` | نائب رئيس اللجنة | Committee Deputy | كل المنصة (ما عدا المستخدمين) | committee_member |
| 4 | `committee_member` | عضو لجنة التدريب | Committee Member | بحسب صلاحيات محددة | ❌ |
| 5 | `branch_president` | نقيب المحافظة / الوكيل | Branch President | محافظة واحدة | كل أدوار المحافظة |
| 6 | `branch_first_deputy` | نائب أول | First Deputy | محافظة واحدة | مساعدين أمين عام/صندوق |
| 7 | `branch_second_deputy` | نائب تاني | Second Deputy | محافظة واحدة | ❌ (بس يشوف) |
| 8 | `branch_secretary` | أمين عام | Secretary | محافظة واحدة | مساعدين |
| 9 | `branch_secretary_assistant` | مساعد أمين عام | Secretary Assistant | محافظة واحدة | ❌ |
| 10 | `branch_treasurer` | أمين صندوق | Treasurer | محافظة واحدة | مساعد |
| 11 | `branch_treasurer_assistant` | مساعد أمين صندوق | Treasurer Assistant | محافظة واحدة | ❌ |
| 12 | `branch_agent` | وكيل | Agent | محافظة واحدة | مساعدين |
| 13 | `branch_agent_assistant` | مساعد وكيل | Agent Assistant | محافظة واحدة | ❌ |
| 14 | `academy_owner` | مالك أكاديمية | Academy Owner | أكاديمية واحدة | academy_manager |
| 15 | `academy_manager` | مدير أكاديمية | Academy Manager | أكاديمية واحدة | ❌ |
| 16 | `user` | مستخدم معتمد | User | حسب scope | ❌ |
| — | `pending_user` | مستخدم معلق | Pending | لا شيء | ❌ |

**قرارات**:
- الوكيل ونقيب المحافظة = نفس الـ role، الاسم يظهر من `labels` (configurable)
- مستخدم واحد = role أساسي واحد + scope (مش multi-role في V2)
- pending_user يقدر يعمل login لكن يشوف شاشة "قيد المراجعة" فقط

---

## 1.7 — قواعد مهمة للتطبيق

### 1.7.1 — `auth-guard.js` الجديد
```js
// كل صفحة محمية:
AuthGuard.require(['super_admin', 'committee_head']);  // throws redirect لو مش مسموح

// كل صفحة بتحتاج scope:
AuthGuard.requireScope('branch:5');  // لو المستخدم مش branch 5 → redirect
```

### 1.7.2 — `permissions.js` الجديد
```js
// قبل كل عملية:
if (!Permissions.can('certificates.create', { issuer_type: 'academy', academy_id: X })) {
  throw new Error('forbidden');
}
```

### 1.7.3 — `labels.js` الجديد
```html
<!-- في الـ HTML -->
<h1 data-label="home.hero.title">محمّل...</h1>

<!-- في الـ JS -->
Labels.t('home.hero.title', 'مرحباً بك')
```

### 1.7.4 — `realtime.js` الجديد
```js
Realtime.subscribe('certificates', function (payload) {
  // payload.eventType: INSERT | UPDATE | DELETE
  updateCertificatesTable(payload);
}, { filter: 'issuer_id=eq.' + academyId });
```

---

# 🔚 نهاية Part 1

**اللي اتعمل في الرد ده:**
- ✅ الرؤية الجديدة
- ✅ 12 قاعدة صارمة
- ✅ الـ Stack
- ✅ هيكل الملفات الكامل
- ✅ **56 شاشة موزعة على 11 مجموعة** (اتفصّل منهم 24 في التفصيل، والباقي في Part 2)
- ✅ نظام الأدوار الـ 16
- ✅ قواعد التطبيق (auth-guard / permissions / labels / realtime)

**اللي جاي في Part 2:**
- 📋 مصفوفة الصلاحيات الكاملة (matrix)
- 🗄️ Database Schema كامل (28 جدول)
- 📦 Storage buckets
- 🛡️ RLS policies
- 🏷️ نظام Labels (تفصيلي)
- 🎨 نظام Themes (17 ثيم بالألوان)
- ⚡ Realtime strategy
- 📝 الشاشات 25-56 (التفصيل المتبقي)

**اللي جاي في Part 3:**
- 🔄 Flows كاملة (Auth / Certificate / Rating / Track / Verify)
- 📅 Implementation Phases (6 مراحل)
- 🌱 Seed Data (27 محافظة + 17 ثيم + labels)
- ✅ Final Checklist

# 📘 ITWS Platform — Master Blueprint V2

## Part 2 — Database • Permissions • Systems • Screens 25-56

> **تكملة Part 1. اقرأ الاتنين مع بعض عشان يبقى عندك الصورة الكاملة.**

---

# 🗄️ Part 2.1 — Database Schema الكامل (28 جدول)

## 2.1.1 — نظرة عامة

| # | Table | الغرض | Relation |
|---|-------|-------|----------|
| **Core** | | | |
| 1 | `governorates` | المحافظات المصرية | reference |
| 2 | `branches` | فروع النقابة (محافظة واحدة لكل فرع) | → governorates |
| 3 | `profiles` | المستخدمين (كل الأدوار) | → auth.users, governorates, branches, academies |
| 4 | `settings` | إعدادات النظام (key-value JSONB) | standalone |
| 5 | `labels` | كل النصوص القابلة للتعديل | standalone |
| 6 | `themes` | الثيمات الـ 17 | standalone |
| 7 | `permissions` | مصفوفة الصلاحيات | standalone |
| **User Management** | | | |
| 8 | `user_requests` | طلبات التسجيل | → profiles, governorates |
| 9 | `login_logs` | سجل محاولات الدخول | → profiles |
| 10 | `activities` | سجل النشاطات (audit log) | → profiles |
| 11 | `sessions` | الجلسات الحية (online counter) | → profiles |
| **Academies** | | | |
| 12 | `academy_categories` | تصنيفات الأكاديميات | reference |
| 13 | `academies` | الأكاديميات | → categories, governorates, branches, profiles |
| 14 | `academy_branches` | فروع الأكاديميات | → academies, governorates |
| 15 | `academy_courses` | كورسات الأكاديميات | → academies |
| 16 | `academy_documents` | مستندات الأكاديمية | → academies |
| 17 | `academy_ratings` | تقييمات الأكاديميات | → academies, profiles |
| 18 | `accreditation_requests` | طلبات الاعتماد | → academies |
| 19 | `request_stage_history` | سجل المراحل | → accreditation_requests |
| **Union (النقابة)** | | | |
| 20 | `union_courses` | كورسات النقابة | → profiles (created_by) |
| **Certificates** | | | |
| 21 | `certificates` | الشهادات (union + academy) | → profiles, academies, union_courses, academy_courses |
| 22 | `certificate_templates` | قوالب الشهادات (PDF/HTML) | standalone |
| 23 | `certificate_revocations` | سجل الإلغاءات | → certificates, profiles |
| **Logs** | | | |
| 24 | `search_logs` | سجل البحث (verify/track/student) | standalone |
| **Communication** | | | |
| 25 | `notifications` | إشعارات داخل المنصة | → profiles |
| 26 | `email_templates` | قوالب الإيميل | standalone |
| **Utility** | | | |
| 27 | `backups` | سجل النسخ الاحتياطي | → profiles |
| 28 | `system_status` | حالة النظام (maintenance mode, إلخ) | standalone |

---

## 2.1.2 — Schema تفصيلي (SQL)

### جدول 1 — `governorates`
```sql
CREATE TABLE governorates (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(4) UNIQUE NOT NULL,       -- 'CAI', 'GIZ', 'ALX'
  name_ar      VARCHAR(100) NOT NULL,
  name_en      VARCHAR(100),
  region       VARCHAR(50),                       -- 'القاهرة الكبرى', 'الدلتا', 'الصعيد', 'القناة', 'الساحل'
  is_active    BOOLEAN DEFAULT true,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Seed: 27 محافظة مصرية
```

### جدول 2 — `branches`
```sql
CREATE TABLE branches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governorate_id INTEGER NOT NULL REFERENCES governorates(id),
  name_ar        VARCHAR(200) NOT NULL,
  name_en        VARCHAR(200),
  address        TEXT,
  contact_email  VARCHAR(200),
  contact_phone  VARCHAR(50),
  logo_url       TEXT,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(governorate_id)                          -- فرع واحد لكل محافظة
);
```

### جدول 3 — `profiles`
```sql
CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          VARCHAR(200) UNIQUE NOT NULL,
  full_name      VARCHAR(200) NOT NULL,
  phone          VARCHAR(50),
  avatar_url     TEXT,
  bio            TEXT,
  
  -- Role & scope
  role           VARCHAR(50) NOT NULL DEFAULT 'pending_user',
  governorate_id INTEGER REFERENCES governorates(id),
  branch_id      UUID REFERENCES branches(id),
  academy_id     UUID REFERENCES academies(id),
  
  -- Approval
  status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | active | suspended | rejected
  approved_by    UUID REFERENCES profiles(id),
  approved_at    TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Hierarchy
  parent_id      UUID REFERENCES profiles(id),          -- مين عيّنه
  is_primary     BOOLEAN DEFAULT false,                  -- هل هو النقيب العام الأساسي؟
  
  -- Metadata
  last_login_at  TIMESTAMPTZ,
  is_active      BOOLEAN DEFAULT true,
  is_deleted     BOOLEAN DEFAULT false,
  
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_branch ON profiles(branch_id);
CREATE INDEX idx_profiles_academy ON profiles(academy_id);
CREATE INDEX idx_profiles_status ON profiles(status);
```

### جدول 4 — `settings`
```sql
CREATE TABLE settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

**المفاتيح (Settings Groups):**
```
splash
app_identity
behavior
theme
accreditation
certificates
security
uploads
footer
features
ratings
realtime
notifications
```

### جدول 5 — `labels`
```sql
CREATE TABLE labels (
  key          VARCHAR(200) PRIMARY KEY,       -- 'auth.login.button'
  ar_value     TEXT NOT NULL,
  en_value     TEXT,
  category     VARCHAR(50) NOT NULL,            -- 'auth' | 'home' | 'admin' | ...
  description  TEXT,
  default_ar   TEXT NOT NULL,                   -- للاستعادة
  is_multiline BOOLEAN DEFAULT false,
  max_length   INTEGER,
  updated_by   UUID REFERENCES profiles(id),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_labels_category ON labels(category);
```

**Categories:**
```
common | auth | splash | home | verify | student | track |
academies | academy_details | admin | users | settings | certificates |
requests | reports | portal | branch | errors | notifications | emails
```

### جدول 6 — `themes`
```sql
CREATE TABLE themes (
  id              VARCHAR(50) PRIMARY KEY,        -- 'watanii_dark'
  name_ar         VARCHAR(100) NOT NULL,
  name_en         VARCHAR(100),
  description_ar  TEXT,
  colors          JSONB NOT NULL,                  -- كل الـ CSS variables
  is_dark         BOOLEAN DEFAULT true,
  is_default      BOOLEAN DEFAULT false,           -- واحد فقط true
  is_active       BOOLEAN DEFAULT true,
  is_system       BOOLEAN DEFAULT false,           -- 'system' theme
  preview_url     TEXT,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Trigger: يضمن واحد default فقط
CREATE UNIQUE INDEX one_default_theme ON themes((is_default)) WHERE is_default = true;
```

### جدول 7 — `permissions`
```sql
CREATE TABLE permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role       VARCHAR(50) NOT NULL,
  resource   VARCHAR(100) NOT NULL,       -- 'certificates' | 'academies' | 'users' | ...
  action     VARCHAR(50) NOT NULL,        -- 'read' | 'create' | 'update' | 'delete' | 'approve' | 'revoke'
  allowed    BOOLEAN DEFAULT false,
  scope      VARCHAR(20) DEFAULT 'global', -- 'global' | 'governorate' | 'academy' | 'self'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, resource, action, scope)
);

CREATE INDEX idx_permissions_role ON permissions(role);
```

### جدول 8 — `user_requests`
```sql
CREATE TABLE user_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id      UUID NOT NULL REFERENCES profiles(id),
  requested_role    VARCHAR(50) NOT NULL,
  governorate_id    INTEGER REFERENCES governorates(id),
  branch_id         UUID REFERENCES branches(id),
  academy_id        UUID REFERENCES academies(id),
  justification     TEXT,
  documents         JSONB DEFAULT '[]',            -- [{name, url}]
  status            VARCHAR(20) DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by       UUID REFERENCES profiles(id),
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  auto_approved     BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_requests_status ON user_requests(status);
```

### جدول 9 — `login_logs`
```sql
CREATE TABLE login_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(200),
  user_id        UUID REFERENCES profiles(id),
  success        BOOLEAN NOT NULL,
  error_message  TEXT,
  ip_address     INET,
  user_agent     VARCHAR(500),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_login_logs_email ON login_logs(email);
CREATE INDEX idx_login_logs_created ON login_logs(created_at DESC);
```

### جدول 10 — `activities`
```sql
CREATE TABLE activities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       UUID REFERENCES profiles(id),
  actor_name     VARCHAR(200),
  actor_role     VARCHAR(50),
  action_type    VARCHAR(50) NOT NULL,              -- 'login' | 'create' | 'update' | 'delete' | 'approve' | 'revoke'
  resource_type  VARCHAR(50),                        -- 'certificate' | 'academy' | 'user' | 'settings'
  resource_id    TEXT,
  description    TEXT,
  old_data       JSONB,
  new_data       JSONB,
  ip_address     INET,
  user_agent     VARCHAR(500),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activities_actor ON activities(actor_id);
CREATE INDEX idx_activities_created ON activities(created_at DESC);
CREATE INDEX idx_activities_resource ON activities(resource_type, resource_id);
```

### جدول 11 — `sessions`
```sql
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id    VARCHAR(200) UNIQUE NOT NULL,
  last_heartbeat TIMESTAMPTZ DEFAULT now(),
  ip_address    INET,
  user_agent    VARCHAR(500),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_heartbeat ON sessions(last_heartbeat DESC);
```

### جدول 12 — `academy_categories`
```sql
CREATE TABLE academy_categories (
  id          SERIAL PRIMARY KEY,
  name_ar     VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100),
  description TEXT,
  icon_name   VARCHAR(50),                    -- key في icons.js
  is_active   BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### جدول 13 — `academies`
```sql
CREATE TABLE academies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(200) NOT NULL,
  name_en        VARCHAR(200),
  description    TEXT,
  logo_url       TEXT,
  cover_url      TEXT,
  
  category_id    INTEGER REFERENCES academy_categories(id),
  governorate_id INTEGER REFERENCES governorates(id),
  branch_id      UUID REFERENCES branches(id),
  
  owner_id       UUID REFERENCES profiles(id),
  
  -- Contact
  contact_email  VARCHAR(200),
  contact_phone  VARCHAR(50),
  website_url    TEXT,
  address        TEXT,
  city           VARCHAR(100),
  
  -- Status
  status         VARCHAR(20) DEFAULT 'pending',  -- pending | approved | rejected | suspended
  is_deleted     BOOLEAN DEFAULT false,
  
  -- Ratings (cached)
  rating_avg     NUMERIC(3,2) DEFAULT 0,
  rating_count   INTEGER DEFAULT 0,
  is_rating_visible BOOLEAN DEFAULT true,
  
  -- Approved
  approved_by    UUID REFERENCES profiles(id),
  approved_at    TIMESTAMPTZ,
  
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_academies_status ON academies(status);
CREATE INDEX idx_academies_branch ON academies(branch_id);
CREATE INDEX idx_academies_governorate ON academies(governorate_id);
CREATE INDEX idx_academies_owner ON academies(owner_id);
CREATE INDEX idx_academies_rating ON academies(rating_avg DESC);
```

### جدول 14 — `academy_branches`
```sql
CREATE TABLE academy_branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id    UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  governorate_id INTEGER REFERENCES governorates(id),
  address       TEXT,
  phone         VARCHAR(50),
  is_main       BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_academy_branches_academy ON academy_branches(academy_id);
```

### جدول 15 — `academy_courses`
```sql
CREATE TABLE academy_courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id    UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  duration_hours INTEGER,
  price         NUMERIC(10,2),
  level         VARCHAR(50),                    -- beginner | intermediate | advanced
  is_active     BOOLEAN DEFAULT true,
  order_index   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_academy_courses_academy ON academy_courses(academy_id);
```

### جدول 16 — `academy_documents`
```sql
CREATE TABLE academy_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id    UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,          -- tax_card | commercial_registry | place_photo | payment_receipt | other
  file_url      TEXT NOT NULL,
  file_name     VARCHAR(200),
  file_size     INTEGER,
  is_verified   BOOLEAN DEFAULT false,
  verified_by   UUID REFERENCES profiles(id),
  verified_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_academy_documents_academy ON academy_documents(academy_id);
```

### جدول 17 — `academy_ratings`
```sql
CREATE TABLE academy_ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id    UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  rated_by      UUID NOT NULL REFERENCES profiles(id),
  stars         INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  review        TEXT,
  is_visible    BOOLEAN DEFAULT true,
  is_verified   BOOLEAN DEFAULT false,          -- هل النقابة وثّقت التقييم؟
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(academy_id, rated_by)                  -- تقييم واحد لكل مستخدم
);

CREATE INDEX idx_ratings_academy ON academy_ratings(academy_id);
CREATE INDEX idx_ratings_visible ON academy_ratings(academy_id, is_visible);
```

**Trigger** لتحديث `academies.rating_avg` و `rating_count`:
```sql
CREATE OR REPLACE FUNCTION update_academy_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE academies SET
    rating_avg = (SELECT COALESCE(AVG(stars), 0) FROM academy_ratings WHERE academy_id = COALESCE(NEW.academy_id, OLD.academy_id) AND is_visible = true),
    rating_count = (SELECT COUNT(*) FROM academy_ratings WHERE academy_id = COALESCE(NEW.academy_id, OLD.academy_id) AND is_visible = true)
  WHERE id = COALESCE(NEW.academy_id, OLD.academy_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_academy_rating
AFTER INSERT OR UPDATE OR DELETE ON academy_ratings
FOR EACH ROW EXECUTE FUNCTION update_academy_rating();
```

### جدول 18 — `accreditation_requests`
```sql
CREATE TABLE accreditation_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number     VARCHAR(50) UNIQUE NOT NULL,   -- REQ-2026-XXXX
  academy_id         UUID REFERENCES academies(id),
  academy_name       VARCHAR(200) NOT NULL,
  academy_email      VARCHAR(200),
  academy_phone      VARCHAR(50),
  
  current_stage      VARCHAR(50) DEFAULT 'submitted',
  status             VARCHAR(20) DEFAULT 'pending',  -- pending | approved | rejected
  
  -- Requirement snapshots
  branches_count     INTEGER DEFAULT 0,
  courses_count      INTEGER DEFAULT 0,
  documents          JSONB DEFAULT '{}',
  
  -- Contact
  contact_person     VARCHAR(200),
  contact_email      VARCHAR(200),
  contact_phone      VARCHAR(50),
  
  -- Timeline
  submitted_at       TIMESTAMPTZ DEFAULT now(),
  approved_at        TIMESTAMPTZ,
  rejected_at        TIMESTAMPTZ,
  rejection_reason   TEXT,
  
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_accreditation_status ON accreditation_requests(status);
CREATE INDEX idx_accreditation_stage ON accreditation_requests(current_stage);
```

### جدول 19 — `request_stage_history`
```sql
CREATE TABLE request_stage_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID NOT NULL REFERENCES accreditation_requests(id) ON DELETE CASCADE,
  stage         VARCHAR(50) NOT NULL,
  status        VARCHAR(20) DEFAULT 'completed',  -- completed | current | rejected
  notes         TEXT,
  actor_id      UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_request_history_request ON request_stage_history(request_id);
```

### جدول 20 — `union_courses`
```sql
CREATE TABLE union_courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  image_url     TEXT,
  duration_hours INTEGER,
  level         VARCHAR(50),
  price         NUMERIC(10,2),
  is_active     BOOLEAN DEFAULT true,
  is_deleted    BOOLEAN DEFAULT false,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### جدول 21 — `certificates`
```sql
CREATE TABLE certificates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) UNIQUE NOT NULL,
  code_type       VARCHAR(20) DEFAULT 'auto',    -- auto | manual
  
  -- Issuer
  issuer_type     VARCHAR(20) NOT NULL,           -- union | academy | branch
  issuer_id       UUID,                           -- academy_id أو branch_id (null لو union)
  
  -- Subject
  student_name    VARCHAR(200) NOT NULL,
  national_id     VARCHAR(20),
  student_email   VARCHAR(200),
  student_phone   VARCHAR(50),
  
  -- Course
  course_type     VARCHAR(20) DEFAULT 'academy',  -- union | academy
  course_id       UUID,                           -- union_courses.id أو academy_courses.id
  course_name     VARCHAR(200) NOT NULL,
  academy_id      UUID REFERENCES academies(id),
  branch_id       UUID REFERENCES academy_branches(id),
  governorate_id  INTEGER REFERENCES governorates(id),
  
  -- Result
  grade           VARCHAR(20),
  score           NUMERIC(5,2),
  duration_hours  INTEGER,
  issue_date      DATE NOT NULL,
  expiry_date     DATE,
  
  -- Status
  is_active       BOOLEAN DEFAULT true,
  is_revoked      BOOLEAN DEFAULT false,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES profiles(id),
  revoke_reason   TEXT,
  
  -- PDF & QR
  pdf_url         TEXT,
  qr_code_url     TEXT,
  template_id     UUID,
  
  -- Metadata
  issued_by       UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_certificates_code ON certificates(code);
CREATE INDEX idx_certificates_national_id ON certificates(national_id);
CREATE INDEX idx_certificates_issuer ON certificates(issuer_type, issuer_id);
CREATE INDEX idx_certificates_academy ON certificates(academy_id);
CREATE INDEX idx_certificates_governorate ON certificates(governorate_id);
CREATE INDEX idx_certificates_issue_date ON certificates(issue_date DESC);
CREATE INDEX idx_certificates_active ON certificates(is_active, is_revoked);
```

### جدول 22 — `certificate_templates`
```sql
CREATE TABLE certificate_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  issuer_type    VARCHAR(20) NOT NULL,
  html_template  TEXT,
  css_styles     TEXT,
  is_active      BOOLEAN DEFAULT true,
  is_default     BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

### جدول 23 — `certificate_revocations`
```sql
CREATE TABLE certificate_revocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id  UUID NOT NULL REFERENCES certificates(id),
  revoked_by      UUID NOT NULL REFERENCES profiles(id),
  reason          TEXT NOT NULL,
  revoked_at      TIMESTAMPTZ DEFAULT now(),
  restored_at     TIMESTAMPTZ,
  restored_by     UUID REFERENCES profiles(id)
);

CREATE INDEX idx_revocations_cert ON certificate_revocations(certificate_id);
```

### جدول 24 — `search_logs`
```sql
CREATE TABLE search_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_type   VARCHAR(50) NOT NULL,   -- certificate_verify | request_track | student_lookup | academy_search
  search_query  VARCHAR(100),           -- masked (first 4 chars + ***)
  query_hash    VARCHAR(64),            -- SHA-256 للـ full query (للإحصاء)
  found         BOOLEAN DEFAULT false,
  ip_address    INET,
  user_agent    VARCHAR(500),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_search_logs_type ON search_logs(search_type);
CREATE INDEX idx_search_logs_created ON search_logs(created_at DESC);
```

### جدول 25 — `notifications`
```sql
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         VARCHAR(50) NOT NULL,    -- info | success | warning | error | request | approval
  title        VARCHAR(200) NOT NULL,
  body         TEXT,
  link_url     TEXT,
  resource_type VARCHAR(50),
  resource_id  TEXT,
  is_read      BOOLEAN DEFAULT false,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

### جدول 26 — `email_templates`
```sql
CREATE TABLE email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key   VARCHAR(100) UNIQUE NOT NULL,    -- 'user.approved' | 'certificate.issued'
  subject_ar    VARCHAR(200) NOT NULL,
  body_ar       TEXT NOT NULL,
  variables     JSONB DEFAULT '[]',              -- ['{user_name}', '{login_url}']
  is_active     BOOLEAN DEFAULT true,
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### جدول 27 — `backups`
```sql
CREATE TABLE backups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type  VARCHAR(50) NOT NULL,    -- full | settings | certificates
  file_url     TEXT,
  file_size    BIGINT,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### جدول 28 — `system_status`
```sql
CREATE TABLE system_status (
  id            SERIAL PRIMARY KEY,
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT,
  maintenance_until TIMESTAMPTZ,
  min_app_version VARCHAR(20),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Seed: صف واحد دائم
INSERT INTO system_status (id) VALUES (1);
```

---

# 📦 Part 2.2 — Storage Buckets

| Bucket | Access | الاستخدام | Max Size |
|--------|--------|-----------|----------|
| `public-assets` | public read / auth write | logos, stamps, covers, avatars | 5 MB |
| `academy-documents` | private (RLS) | tax cards, commercial registries | 20 MB |
| `certificate-pdfs` | public read / auth write | PDFs المولدة | 10 MB |
| `backups` | super_admin فقط | نسخ احتياطية | 100 MB |

### Paths:
```
public-assets/
  logos/logo_<timestamp>.<ext>
  stamps/stamp_<timestamp>.<ext>
  avatars/user_<id>_<timestamp>.<ext>
  covers/academy_<id>_<timestamp>.<ext>
  courses/course_<id>_<timestamp>.<ext>

academy-documents/
  academy_<id>/tax_card_<timestamp>.<ext>
  academy_<id>/commercial_registry_<timestamp>.<ext>
  academy_<id>/place_photo_<timestamp>.<ext>
  academy_<id>/payment_receipt_<timestamp>.<ext>

certificate-pdfs/
  <year>/<month>/<code>.pdf

backups/
  backup_<type>_<timestamp>.json
```

---

# 🛡️ Part 2.3 — RLS Policies (مختصر)

## 2.3.1 — مبدأ العمل

كل جدول عنده سياسات مبنية على:
1. **Role** من `profiles.role`
2. **Scope** — `governorate_id`, `branch_id`, `academy_id`
3. **Ownership** — `profiles.id = auth.uid()`

## 2.3.2 — Helper Functions

```sql
-- جلب role الحالي
CREATE OR REPLACE FUNCTION current_role() RETURNS VARCHAR AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- جلب branch_id الحالي
CREATE OR REPLACE FUNCTION current_branch() RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- جلب governorate_id الحالي
CREATE OR REPLACE FUNCTION current_governorate() RETURNS INTEGER AS $$
  SELECT governorate_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- جلب academy_id الحالي
CREATE OR REPLACE FUNCTION current_academy() RETURNS UUID AS $$
  SELECT academy_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- هل super admin؟
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT current_role() = 'super_admin'
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- هل committee member؟
CREATE OR REPLACE FUNCTION is_committee() RETURNS BOOLEAN AS $$
  SELECT current_role() IN ('committee_head', 'committee_deputy', 'committee_member')
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- هل branch level?
CREATE OR REPLACE FUNCTION is_branch_level() RETURNS BOOLEAN AS $$
  SELECT current_role() IN (
    'branch_president', 'branch_first_deputy', 'branch_second_deputy',
    'branch_secretary', 'branch_secretary_assistant',
    'branch_treasurer', 'branch_treasurer_assistant',
    'branch_agent', 'branch_agent_assistant'
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- هل academy level؟
CREATE OR REPLACE FUNCTION is_academy_level() RETURNS BOOLEAN AS $$
  SELECT current_role() IN ('academy_owner', 'academy_manager')
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- هل عنده صلاحية؟
CREATE OR REPLACE FUNCTION has_permission(p_resource VARCHAR, p_action VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM permissions
    WHERE role = current_role()
      AND resource = p_resource
      AND action = p_action
      AND allowed = true
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

## 2.3.3 — نماذج سياسات

### `profiles`
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- قراءة
CREATE POLICY "profiles_select_self" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_super" ON profiles
  FOR SELECT USING (is_super_admin());

CREATE POLICY "profiles_select_committee" ON profiles
  FOR SELECT USING (is_committee());

CREATE POLICY "profiles_select_branch" ON profiles
  FOR SELECT USING (
    is_branch_level() AND branch_id = current_branch()
  );

CREATE POLICY "profiles_select_academy_owner" ON profiles
  FOR SELECT USING (
    current_role() = 'academy_owner' AND academy_id = current_academy()
  );

-- إنشاء (فقط super_admin أو من خلال user_requests)
CREATE POLICY "profiles_insert_super" ON profiles
  FOR INSERT WITH CHECK (is_super_admin());

-- تعديل
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "profiles_update_super" ON profiles
  FOR UPDATE USING (is_super_admin());

CREATE POLICY "profiles_update_branch" ON profiles
  FOR UPDATE USING (
    is_branch_level() AND branch_id = current_branch() AND
    role IN ('branch_first_deputy', 'branch_second_deputy', 'branch_secretary',
             'branch_secretary_assistant', 'branch_treasurer', 'branch_treasurer_assistant',
             'branch_agent', 'branch_agent_assistant', 'user')
  );

-- حذف
CREATE POLICY "profiles_delete_super" ON profiles
  FOR DELETE USING (is_super_admin());
```

### `academies`
```sql
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;

-- قراءة عامة (approved فقط)
CREATE POLICY "academies_select_public" ON academies
  FOR SELECT USING (status = 'approved' AND is_deleted = false);

-- super_admin
CREATE POLICY "academies_all_super" ON academies
  FOR ALL USING (is_super_admin());

-- committee
CREATE POLICY "academies_select_committee" ON academies
  FOR SELECT USING (is_committee());

CREATE POLICY "academies_update_committee" ON academies
  FOR UPDATE USING (is_committee());

-- branch
CREATE POLICY "academies_select_branch" ON academies
  FOR SELECT USING (is_branch_level() AND branch_id = current_branch());

CREATE POLICY "academies_update_branch" ON academies
  FOR UPDATE USING (is_branch_level() AND branch_id = current_branch());

-- academy owner (يشوف ويعدل أكاديميته)
CREATE POLICY "academies_select_owner" ON academies
  FOR SELECT USING (owner_id = auth.uid() OR id = current_academy());

CREATE POLICY "academies_update_owner" ON academies
  FOR UPDATE USING (owner_id = auth.uid() OR id = current_academy());
```

### `certificates`
```sql
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- قراءة عامة (للتحقق) — بس ما تكشفش national_id
-- ملاحظة: نستخدم VIEW للتحقق العام بدل الجدول مباشرة
CREATE POLICY "certificates_select_public_verify" ON certificates
  FOR SELECT USING (true);  -- verify.html هيستخدم RPC للتحقق

-- super_admin
CREATE POLICY "certificates_all_super" ON certificates
  FOR ALL USING (is_super_admin());

-- committee
CREATE POLICY "certificates_select_committee" ON certificates
  FOR SELECT USING (is_committee());

CREATE POLICY "certificates_insert_committee" ON certificates
  FOR INSERT WITH CHECK (is_committee());

-- branch (يشوف شهادات محافظته فقط)
CREATE POLICY "certificates_select_branch" ON certificates
  FOR SELECT USING (
    is_branch_level() AND governorate_id = current_governorate()
  );

-- academy (يشوف شهاداته فقط)
CREATE POLICY "certificates_select_academy" ON certificates
  FOR SELECT USING (
    is_academy_level() AND (issuer_id = current_academy() OR academy_id = current_academy())
  );

CREATE POLICY "certificates_insert_academy" ON certificates
  FOR INSERT WITH CHECK (
    is_academy_level() AND issuer_id = current_academy()
  );
```

### `settings` و `labels` و `themes`
```sql
-- قراءة عامة (محتاجة للـ frontend)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_public" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_all_super" ON settings FOR ALL USING (is_super_admin());

-- labels
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "labels_select_public" ON labels FOR SELECT USING (true);
CREATE POLICY "labels_update_super" ON labels FOR UPDATE USING (is_super_admin());

-- themes
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "themes_select_public" ON themes FOR SELECT USING (is_active = true);
CREATE POLICY "themes_all_super" ON themes FOR ALL USING (is_super_admin());
```

### `permissions`
```sql
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_select_auth" ON permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "permissions_all_super" ON permissions
  FOR ALL USING (is_super_admin());
```

---

# 🏷️ Part 2.4 — نظام Labels التفصيلي

## 2.4.1 — الـ API

```js
// assets/js/labels.js

window.Labels = {
  t(key, fallback),         // translate one key
  apply(root),              // يعمر كل [data-label] في root
  getCategory(cat),         // يجيب كل labels في category
  set(key, value),          // يحفظ (super_admin only)
  reset(key),               // يستعيد default
  resetCategory(cat),
  onChange(cb),             // الاشتراك على تغييرات
  refresh()                 // يحمّل من DB من جديد
};
```

## 2.4.2 — أمثلة Labels كاملة

| Category | Key | Default AR |
|----------|-----|-----------|
| `common` | `common.save` | حفظ |
| `common` | `common.cancel` | إلغاء |
| `common` | `common.delete` | حذف |
| `common` | `common.edit` | تعديل |
| `common` | `common.confirm` | تأكيد |
| `common` | `common.loading` | جاري التحميل... |
| `common` | `common.no_data` | لا توجد بيانات |
| `common` | `common.search` | بحث |
| `common` | `common.filter` | تصفية |
| `auth` | `auth.login.title` | تسجيل الدخول |
| `auth` | `auth.login.email` | البريد الإلكتروني |
| `auth` | `auth.login.password` | كلمة المرور |
| `auth` | `auth.login.remember` | تذكرني |
| `auth` | `auth.login.forgot` | نسيت كلمة المرور؟ |
| `auth` | `auth.login.button` | تسجيل الدخول |
| `auth` | `auth.login.pending_title` | طلبك قيد المراجعة |
| `auth` | `auth.login.pending_msg` | طلب إنشاء حسابك في انتظار الموافقة |
| `auth` | `auth.login.rejected_title` | تم رفض طلبك |
| `home` | `home.hero.title` | مرحباً بك في نقابة تكنولوجيا المعلومات |
| `home` | `home.hero.subtitle` | منصة رسمية للتحقق من الشهادات |
| `home` | `home.search.tab_cert` | شهادة |
| `home` | `home.search.tab_trainee` | متدرب |
| `home` | `home.search.tab_academy` | أكاديمية |
| `home` | `home.about.title` | لماذا هذه المنصة؟ |
| `home` | `home.cta.title` | هل تدير أكاديمية تدريبية؟ |
| `home` | `home.cta.button` | قدم أكاديميتك |
| `verify` | `verify.title` | تحقق من صحة الشهادة |
| `verify` | `verify.input.label` | كود الشهادة |
| `verify` | `verify.input.placeholder` | NTI-2026-XXXXXX |
| `verify` | `verify.button` | تحقق |
| `verify` | `verify.valid` | شهادة صحيحة |
| `verify` | `verify.invalid` | شهادة غير صالحة |
| `verify` | `verify.revoked` | شهادة ملغاة |
| `verify` | `verify.not_found` | لم يتم العثور على الشهادة |
| `admin` | `admin.dashboard.title` | لوحة التحكم |
| `admin` | `admin.users.title` | إدارة المستخدمين |
| `admin` | `admin.academies.title` | إدارة الأكاديميات |
| `admin` | `admin.certificates.title` | إدارة الشهادات |
| `admin` | `admin.settings.title` | الإعدادات |
| `portal` | `portal.dashboard.title` | بوابة الأكاديمية |
| `portal` | `portal.certificates.title` | شهادات الأكاديمية |
| `portal` | `portal.certificates.add` | إصدار شهادة جديدة |
| `branch` | `branch.dashboard.title` | بوابة الفرع |
| `branch` | `branch.users.title` | مستخدمو الفرع |
| `errors` | `errors.404.title` | الصفحة غير موجودة |
| `errors` | `errors.403.title` | غير مصرح لك بالوصول |
| `errors` | `errors.network` | تعذر الاتصال بالخادم |
| `emails` | `emails.welcome.subject` | مرحباً بك في المنصة |

---

# 🎨 Part 2.5 — الثيمات الـ 17 (بالألوان)

## 2.5.1 — البنية

كل ثيم = JSONB فيه:
```json
{
  "--primary": "#CE1126",
  "--primary-hover": "#E63946",
  "--primary-soft": "rgba(206,17,38,0.14)",
  "--primary-text": "#FFFFFF",
  "--bg": "#0A0E14",
  "--bg-alt": "#05080D",
  "--surface": "#131820",
  "--surface-elevated": "#1C2430",
  "--surface-hover": "#252F3D",
  "--text": "#F8FAFC",
  "--text-secondary": "#94A3B8",
  "--text-muted": "#64748B",
  "--border": "rgba(255,255,255,0.08)",
  "--border-strong": "rgba(255,255,255,0.15)",
  "--success": "#10B981",
  "--success-soft": "rgba(16,185,129,0.14)",
  "--warning": "#F59E0B",
  "--warning-soft": "rgba(245,158,11,0.14)",
  "--error": "#EF4444",
  "--error-soft": "rgba(239,68,68,0.14)",
  "--info": "#3B82F6",
  "--info-soft": "rgba(59,130,246,0.14)",
  "--shadow": "0 1px 3px rgba(0,0,0,0.3)",
  "--shadow-lg": "0 10px 40px rgba(0,0,0,0.4)"
}
```

## 2.5.2 — الثيمات الـ 17

| # | ID | الاسم | النوع | الألوان الرئيسية |
|---|----|----|------|-----------------|
| 1 | `watanii_dark` | وطني داكن | Dark | `#CE1126` + `#0A0E14` + `#F8FAFC` |
| 2 | `watanii_light` | وطني فاتح | Light | `#CE1126` + `#FFFFFF` + `#0A0E14` |
| 3 | `tech_blue` | تكنولوجي أزرق | Dark | `#3B82F6` + `#0F172A` |
| 4 | `tech_purple` | تكنولوجي بنفسجي | Dark | `#8B5CF6` + `#0F0A1F` |
| 5 | `midnight_gold` | ليلي ذهبي | Dark | `#D4AF37` + `#0B0B12` |
| 6 | `royal_purple` | ملكي بنفسجي | Dark | `#7C3AED` + `#1A0B2E` |
| 7 | `emerald_dark` | زمردي داكن | Dark | `#10B981` + `#0B1917` |
| 8 | `emerald_light` | زمردي فاتح | Light | `#059669` + `#ECFDF5` |
| 9 | `ocean_teal` | محيط فيروزي | Dark | `#14B8A6` + `#0B1E1C` |
| 10 | `sunset_orange` | غروب برتقالي | Dark | `#F97316` + `#1C0E05` |
| 11 | `crimson_noir` | قرمزي نوار | Dark | `#DC2626` + `#0A0000` |
| 12 | `slate_professional` | رمادي احترافي | Light | `#475569` + `#F1F5F9` |
| 13 | `forest_green` | أخضر غابات | Dark | `#16A34A` + `#052E16` |
| 14 | `sky_light` | سماوي فاتح | Light | `#0284C7` + `#F0F9FF` |
| 15 | `paper_classic` | ورقي كلاسيكي | Light | `#92400E` + `#FEF3C7` |
| 16 | `neon_pink` | نيون وردي | Dark | `#EC4899` + `#1A0A14` |
| 17 | `system` | حسب النظام | Auto | يتبع `prefers-color-scheme` |

## 2.5.3 — آلية العمل

```js
// theme.js
window.ITWSTheme = {
  change(id),              // يطبق فوراً + يحفظ في localStorage
  getCurrent(),            // بيرجع الـ id الحالي
  getDefault(),            // من settings.theme.default_theme
  applyDefault(),          // للـ reset
  onChange(cb),            // الاشتراك
  isUserOverride(),        // هل المستخدم عمله manual override؟
  clearOverride()          // يمسح الـ local override
};
```

**FOUC Prevention**: في `<head>` قبل CSS:
```html
<script src="assets/js/themes-data.js"></script>
<script src="assets/js/theme.js"></script>
```

`theme.js` بيطبق الثيم من `localStorage` قبل ما الـ CSS يتحمّل.

---

# ⚡ Part 2.6 — Realtime Strategy

## 2.6.1 — `realtime.js` API

```js
window.Realtime = {
  subscribe(table, callback, options),  // returns unsubscribe function
  unsubscribe(id),
  stopAll(),
  reconnect(),
  status()  // 'connected' | 'connecting' | 'disconnected'
};
```

**options**:
```js
{
  filter: 'column=eq.value',       // Postgres filter
  events: ['INSERT', 'UPDATE', 'DELETE'],
  debounce: 300,                   // ms
  fallbackPolling: 30000           // ms — polling لو WS قطع
}
```

## 2.6.2 — الجداول المشتركة لكل شاشة

| الشاشة | Subscriptions |
|--------|--------------|
| `home.html` | `academies` (status=approved), `academy_ratings` (is_visible), `settings`, `labels` |
| `verify.html` | `certificates` (filter: code=eq.X) — لو المتابع نشط |
| `track.html` | `accreditation_requests` (filter: id=eq.X), `request_stage_history` (filter: request_id=eq.X) |
| `student.html` | — (مفيش realtime لسبب الأمان) |
| `admin/index.html` | `accreditation_requests`, `certificates`, `user_requests`, `activities` (limit 10) |
| `admin/settings/*` | `settings`, `labels`, `themes`, `permissions` |
| `admin/users` | `profiles`, `user_requests` |
| `admin/academies` | `academies`, `academy_ratings` |
| `admin/certificates` | `certificates` |
| `admin/requests` | `accreditation_requests`, `request_stage_history` |
| `portal/certificates` | `certificates` (filter: issuer_id=eq.academy) |
| `branch/*` | كل جدول فيه `governorate_id` (filter: governorate_id=eq.X) |

## 2.6.3 — Implementation

```js
Realtime.subscribe('certificates',
  function (payload) {
    if (payload.eventType === 'INSERT') onCertInserted(payload.new);
    if (payload.eventType === 'UPDATE') onCertUpdated(payload.new);
    if (payload.eventType === 'DELETE') onCertDeleted(payload.old);
  },
  {
    filter: 'issuer_id=eq.' + academyId,
    debounce: 300
  }
);
```

**Fallback polling**: لو `status() === 'disconnected'`، بعد 30 ثانية يـ polling يدوي (SELECT) ويطبق نفس الـ callbacks.

---

# 🖥️ Part 2.7 — الشاشات 25-56 (تفاصيل)

---

### 📍 المجموعة 4: الفروع (3 شاشات)

#### 25. الفروع
- **المسار**: `admin/branches/index.html`
- **JS**: `assets/js/pages/admin/branches.js`
- **الجداول**: `branches`, `governorates`, `profiles` (aggregate)
- **الوصول**: `super_admin`, `committee_head`
- **Features**:
  - Table: name, governorate, president name, users count, academies count, certificates count
  - Filters: governorate, has_president
  - Add/Edit/Delete
  - كل فرع يظهر فيه عدد المستخدمين والأكاديميات
  - زر "إدارة الفرع" → يفتح dashboard الفرع
- **Realtime**: `branches`, `profiles`

#### 26. إضافة فرع
- **المسار**: `admin/branches/add.html`
- **JS**: `assets/js/pages/admin/branches-form.js`
- **Features**:
  - اختيار محافظة (dropdown من `governorates`)
  - بيانات الفرع (اسم، عنوان، هاتف، email)
  - **إنشاء حساب نقيب المحافظة** (اختياري):
    - full name, email, phone
    - Auto-approve (super_admin)
    - يظهر دعوة بالبريد
  - Validation كامل

#### 27. تعديل فرع
- **المسار**: `admin/branches/edit.html`
- **JS**: `assets/js/pages/admin/branches-form.js` (نفس الملف)
- **Features**:
  - كل حقول add + إمكانية تغيير المحافظة (خطير — محتاج تأكيد)
  - عرض مستخدمي الفرع + الأكاديميات

---

### 📍 المجموعة 5: الأكاديميات (5 شاشات)

#### 28. الأكاديميات
- **المسار**: `admin/academies/index.html`
- **JS**: `assets/js/pages/admin/academies.js`
- **الوصول**: `super_admin`, `committee_head`, `committee_deputy` (read)
- **الجداول**: `academies`, `governorates`, `academy_ratings`
- **Realtime**: `academies`, `academy_ratings`
- **Features**:
  - Table: name, category, governorate, status, rating, certificates count, owner
  - Filters: status, category, governorate, has_rating
  - Search
  - Actions: details / edit / suspend / approve / delete
  - Bulk: approve / suspend

#### 29. إضافة أكاديمية
- **المسار**: `admin/academies/add.html`
- **JS**: `assets/js/pages/admin/academies-form.js`
- **Features**:
  - Multi-step:
    1. بيانات أساسية (اسم، تصنيف، محافظة)
    2. بيانات التواصل
    3. فروع
    4. كورسات
    5. مستندات
  - **إنشاء owner user** (auto-approve)
  - **Auto-generate accreditation request** (approved مباشرة)

#### 30. تعديل أكاديمية
- **المسار**: `admin/academies/edit.html`
- **JS**: `assets/js/pages/admin/academies-form.js`
- **Features**: نفس الـ add + إمكانية تعديل الـ owner + rating visibility

#### 31. تفاصيل أكاديمية (admin)
- **المسار**: `admin/academies/details.html`
- **JS**: `assets/js/pages/admin/academies-details.js`
- **Features**:
  - كل بيانات الأكاديمية
  - الفروع
  - الكورسات
  - المستندات (download/view)
  - التقييمات (list + approve/hide)
  - الشهادات الصادرة
  - Activity log

#### 32. تقييمات الأكاديميات
- **المسار**: `admin/academies/ratings.html`
- **JS**: `assets/js/pages/admin/academies-ratings.js`
- **Features**:
  - Table: academy, rated_by, stars, review, is_visible
  - Filters: academy, stars, visible
  - Actions: hide/show rating
  - **تقييم النقابة** (verified rating) — super_admin/committee
  - Bulk hide spam

---

### 📍 المجموعة 6: الشهادات (4 شاشات)

#### 33. الشهادات
- **المسار**: `admin/certificates/index.html`
- **JS**: `assets/js/pages/admin/certificates.js`
- **Realtime**: `certificates`
- **Features**:
  - Table: code, student, course, issuer, grade, issue_date, status
  - Filters: issuer_type (union/academy), grade, date_range, is_revoked
  - Search by code / student_name / national_id (masked)
  - Actions: view / edit / revoke / download PDF
  - Bulk export Excel
  - Bulk revoke (with reason)

#### 34. إصدار شهادة
- **المسار**: `admin/certificates/add.html`
- **JS**: `assets/js/pages/admin/certificates-form.js`
- **Features**:
  - **Auto/Manual code toggle**:
    - Auto: pattern من `settings.certificates.code_pattern` → يستدعي Edge Function `auto-code`
    - Manual: المستخدم يكتب الكود (validation: unique + pattern match)
  - نوع المصدر:
    - Union (يختار course من `union_courses`)
    - Academy (يختار academy ثم course)
  - بيانات المتدرب (اسم + national_id + email + phone)
  - بيانات الدورة + التقدير + التاريخ
  - Preview مباشر للشهادة
  - Generates QR code تلقائي
  - Generates PDF (Edge Function)

#### 35. تعديل شهادة
- **المسار**: `admin/certificates/edit.html`
- **JS**: `assets/js/pages/admin/certificates-form.js`
- **Features**:
  - كل حقول add + ما عدا code (immutable)
  - تغيير grade أو issue_date (مسجل في activities)
  - Regenerate PDF

#### 36. إلغاء شهادة
- **المسار**: `admin/certificates/revoke.html`
- **JS**: `assets/js/pages/admin/certificates-revoke.js`
- **Features**:
  - عرض الشهادة
  - سبب الإلغاء (required)
  - تأكيد بـ typing الـ code
  - Log في `certificate_revocations` + `activities`
  - الشهادة تظهر في `verify` بحالة "ملغاة" مع السبب
  - إمكانية Restore (super_admin فقط)

---

### 📍 المجموعة 7: طلبات الاعتماد (2 شاشات)

#### 37. طلبات الاعتماد
- **المسار**: `admin/requests/index.html`
- **JS**: `assets/js/pages/admin/requests.js`
- **Realtime**: `accreditation_requests`, `request_stage_history`
- **Features**:
  - **Kanban view** (7 أعمدة = مراحل)
  - **List view** (table)
  - Filters: stage, status, governorate, date
  - Search by request_number / academy_name
  - SLA indicator لكل request (on-time / warning / overdue)
  - Drag & drop في Kanban لتغيير المرحلة (مع تأكيد + سبب)

#### 38. تفاصيل طلب
- **المسار**: `admin/requests/details.html`
- **JS**: `assets/js/pages/admin/requests-details.js`
- **Features**:
  - كل بيانات الطلب
  - Timeline (نفس track.html لكن admin view)
  - الأكاديمية المرتبطة (لو موجودة)
  - المستندات (approve/reject per document)
  - Actions:
    - Move to next stage (مع notes)
    - Approve (يخلي academy = approved + ربط academy بالـ owner)
    - Reject (مع سبب)
  - Comments/notes section
  - Realtime updates

---

### 📍 المجموعة 8: كورسات النقابة (3 شاشات)

#### 39. كورسات النقابة
- **المسار**: `admin/union-courses/index.html`
- **JS**: `assets/js/pages/admin/union-courses.js`
- **Realtime**: `union_courses`
- **Features**:
  - Table: title, level, duration, price, is_active, certificates_count
  - Add/Edit/Delete
  - Toggle active

#### 40. إضافة كورس
- **المسار**: `admin/union-courses/add.html`
- **JS**: `assets/js/pages/admin/union-courses-form.js`
- **Features**:
  - title, description, image, duration, level, price
  - Preview
  - Save + Publish

#### 41. تعديل كورس
- **المسار**: `admin/union-courses/edit.html`
- **JS**: `assets/js/pages/admin/union-courses-form.js`
- **Features**: نفس add + activity log

---

### 📍 المجموعة 9: التقارير والسجلات (3 شاشات)

#### 42. التقارير
- **المسار**: `admin/reports/index.html`
- **JS**: `assets/js/pages/admin/reports.js`
- **Features**:
  - **Report types**:
    1. Certificates Report (by date range, issuer, governorate)
    2. Academies Report (ratings, certificates count)
    3. Users Report (by role, activity)
    4. Revenue Report (لو فيه payment)
  - Filters لكل report
  - Chart preview
  - Export: Excel / CSV / PDF
  - Save report templates

#### 43. سجل النشاطات
- **المسار**: `admin/activities.html`
- **JS**: `assets/js/pages/admin/activities.js`
- **Realtime**: `activities`
- **Features**:
  - Table: actor, action, resource, timestamp
  - Filters: actor, action_type, resource_type, date_range
  - Detail view لكل activity (old_data / new_data diff)
  - Export

#### 44. محاولات الدخول
- **المسار**: `admin/login-logs.html`
- **JS**: `assets/js/pages/admin/login-logs.js`
- **Features**:
  - Table: email, success, ip, user_agent, timestamp
  - Filters: success, date_range, email
  - Highlight suspicious (multiple failures من نفس IP)
  - Export

---

### 📍 المجموعة 10: بوابة الأكاديمية (8 شاشات)

#### 45. Dashboard الأكاديمية
- **المسار**: `portal/index.html`
- **JS**: `assets/js/pages/portal/dashboard.js`
- **الوصول**: `academy_owner`, `academy_manager`
- **Realtime**: `certificates`, `academy_ratings`
- **KPI**:
  - عدد الشهادات (إجمالي + الشهر)
  - التقييم الحالي
  - عدد الكورسات
  - الشهادات الملغاة
- **Charts**: Growth chart
- **Recent**: أحدث 10 شهادات + أحدث التقييمات

#### 46. شهادات الأكاديمية
- **المسار**: `portal/certificates/index.html`
- **JS**: `assets/js/pages/portal/certificates.js`
- **Realtime**: `certificates` (filter: issuer_id=academy)
- **Features**:
  - Table: code, student, course, grade, date, status
  - Filters: course, grade, date_range, is_revoked
  - Search by code / student
  - **Print report**: طباعة جدول الشهادات (PDF) — مع خيارات (date range, course)
  - **Print selected**: اختيار شهادات معينة وطباعة قائمة
  - Export Excel
  - Add / Edit / Revoke

#### 47. إصدار شهادة (academy)
- **المسار**: `portal/certificates/add.html`
- **JS**: `assets/js/pages/portal/certificates-form.js`
- **Features**:
  - **Auto/Manual code**
  - اختيار course من `academy_courses` (الخاصة بالأكاديمية)
  - Student data
  - Grade من `certificates.grades`
  - Preview + PDF + QR
  - يظهر في verify بحالة صحيحة

#### 48. تعديل شهادة (academy)
- **المسار**: `portal/certificates/edit.html`
- **JS**: `assets/js/pages/portal/certificates-form.js`
- **Features**: نفس add + activity log

#### 49. تقارير الأكاديمية
- **المسار**: `portal/reports.html`
- **JS**: `assets/js/pages/portal/reports.js`
- **Features**:
  - تقرير الشهادات (بـ date range + course)
  - تقرير الطلاب (list بالـ national_id masked)
  - تقرير التقييمات
  - تصدير Excel / PDF

#### 50. الملف الشخصي
- **المسار**: `portal/profile.html`
- **JS**: `assets/js/pages/portal/profile.js`
- **Features**:
  - بيانات الأكاديمية (read-only للأكاديمية، editable للـ owner)
  - إدارة الفروع
  - إدارة الكورسات
  - إدارة المستخدمين (academy_owner only)
  - رفع الشعار + الغلاف

#### 51. طلب اعتماد الأكاديمية
- **المسار**: `portal/application.html`
- **JS**: `assets/js/pages/portal/application.js`
- **Features**:
  - متابعة حالة الـ accreditation request
  - رفع مستندات إضافية لو مطلوب
  - رد على ملاحظات المراجعة

#### 52. كورسات الأكاديمية
- **المسار**: `portal/courses.html`
- **JS**: `assets/js/pages/portal/courses.js`
- **Features**:
  - CRUD للـ academy_courses
  - Bulk import

---

### 📍 المجموعة 11: بوابة الفرع (4 شاشات)

#### 53. Dashboard الفرع
- **المسار**: `branch/index.html`
- **JS**: `assets/js/pages/branch/dashboard.js`
- **الوصول**: `branch_*` (all 9 roles)
- **Realtime**: `profiles`, `academies`, `certificates` (filter: governorate_id)
- **KPI**:
  - مستخدمين الفرع
  - أكاديميات محافظته
  - شهادات المحافظة
  - طلبات تسجيل معلقة
- **Charts**: Growth

#### 54. مستخدمو الفرع
- **المسار**: `branch/users.html`
- **JS**: `assets/js/pages/branch/users.js`
- **Realtime**: `profiles` (filter: branch_id)
- **Features**:
  - Table: name, role, status, last_login
  - **branch_president** يقدر:
    - إضافة أي دور في محافظته
    - تعديل / تعطيل
    - إعادة تعيين كلمة مرور
  - **branch_agent** يقدر:
    - إضافة مساعدينه فقط
  - Approval flow:
    - طلبات pending تظهر هنا
    - Approve / Reject

#### 55. أكاديميات المحافظة
- **المسار**: `branch/academies.html`
- **JS**: `assets/js/pages/branch/academies.js`
- **Realtime**: `academies` (filter: governorate_id)
- **Features**:
  - Table: name, status, rating, certificates count
  - Read-only (مش CRUD — ده admin فقط)
  - View details
  - **تقييم الأكاديمية** (branch_president + deputies only)
  - Flag للـ admin

#### 56. شهادات المحافظة
- **المسار**: `branch/certificates.html`
- **JS**: `assets/js/pages/branch/certificates.js`
- **Realtime**: `certificates` (filter: governorate_id)
- **Features**:
  - Table: code, student, academy/union, grade, date
  - Read-only
  - Filters
  - Export Excel
  - **Branch_president** يقدر يـ revoke (بحسب `permissions`)

---

# 🔚 نهاية Part 2

**اللي اتعمل في الرد ده:**
- ✅ Database Schema كامل (28 جدول + indexes + triggers + helpers)
- ✅ Storage (4 buckets + paths)
- ✅ RLS Policies (نماذج لكل الجداول الحساسة)
- ✅ Labels System (API + 40+ label كامل)
- ✅ 17 ثيم بالألوان + آلية العمل
- ✅ Realtime Strategy (لكل شاشة)
- ✅ **الشاشات 25-56** بتفاصيل كاملة

**اللي جاي في Part 3:**
- 🔄 Flows كاملة (Auth / Certificate / Rating / Track / Verify / User Request)
- 📅 Implementation Phases (6 مراحل، كل مرحلة فيها شاشات محددة)
- 🌱 Seed Data (27 محافظة + 17 ثيم + 60+ label + 6 categories)
- ✅ Final Checklist (قبل كل مرحلة)
- 🚀 Instructions للبدء

# ✅ الاختيار النهائي: الحلول المجانية والمفتوحة المصدر

بعد البحث والتحقق، هذا هو الـ **Stack المجاني 100%** الذي أنصح به:

---

## 1. توليد PDF نصي (ATS-Friendly)

### ✅ الاختيار: **jsPDF** (Text API)
- **الترخيص**: MIT (مجاني بالكامل). 
- **لماذا؟**: توليد PDF بنص حقيقي (ليس صورة). الكود بسيط:
  ```js
  var doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica');  // خط قياسي مدمج
  doc.text('Work Experience', 15, 40);
  doc.save('resume.pdf');
  ```
- **البديل**: `pdfMake` — مجاني أيضاً، لكن jsPDF أخف وأكثر شيوعاً. 

---

## 2. توليد DOCX

### ✅ الاختيار: **`docx`** (dolanmiu/docx)
- **الترخيص**: MIT. 
- **لماذا؟**: يعمل في المتصفح و Node، declarative API، ويدعم العناوين القياسية (Heading1, Heading2) التي تحتاجها ATS. 

---

## 3. تحليل ATS (Scoring Engine)

### ✅ الاختيار: **`@pranavraut033/ats-checker`**
- **الترخيص**: مجاني، zero-dependency. 
- **لماذا؟**:
  - يحلل الـ CV مقابل Job Description.
  - يعطي **درجة 0-100** مع breakdown (skills, experience, keywords, education). 
  - **Deterministic** (لا يعتمد على API خارجي) → يعمل offline. 
  - يدعم **Custom Rules** (مثلاً: "أضف رقم هاتف"). 

### ⚠️ ملاحظة مهمة:
`ats-checker` تركز على **المحتوى** (keywords, skills) وليس على **التنسيق البصري** (single-column, fonts). لذلك سأضيف **Rules-based Format Checker** بسيط (مدمج) يفحص:
- وجود جداول/صور في الـ CV (في وضع Professional).
- استخدام خطوط قياسية.
- ترتيب الأقسام.

---

## 4. لماذا ليس الحلول الأخرى؟

| الحل | السبب |
|------|-------|
| `Resume-Libre` (LaTeX) | يتطلب LaTeX + AI، غير مناسب لـ Vanilla JS.  |
| `@react-pdf/renderer` | يتطلب React (مشروعنا Vanilla JS).  |
| SharpAPI / Resurface | **مدفوعة** (ليست مجانية). |
| Gemini API | يحتاج API key + تكلفة (حتى لو رمزية).  |

---

# 📘 ITWS Platform — Master Blueprint V2

## Part 3 — Flows • Implementation Phases • Seed Data • Checklist

> **تكملة Part 1 و Part 2. اقرأ الثلاثة مع بعض.**

---

## 🔄 Part 3.1 — Flows كاملة

### 3.1.1 — Flow: تسجيل الدخول (Login)

```
[المستخدم] → login.html
    │
    ├─ [عنده session؟]
    │   ├─ نعم → Session Banner (متابعة / تسجيل خروج)
    │   └─ لا → Form
    │
    ├─ [يدخل email + password]
    │   └─ validateForm()
    │
    ├─ [Supabase Auth signIn]
    │   ├─ فشل → رسالة خطأ (invalid credentials / rate limit)
    │   └─ نجاح → جلب profile من profiles
    │       ├─ profile.status = 'pending' → شاشة "قيد المراجعة"
    │       ├─ profile.status = 'rejected' → شاشة "مرفوض" + السبب
    │       ├─ profile.status = 'suspended' → شاشة "موقوف"
    │       └─ profile.status = 'active' → redirect حسب role:
    │           ├─ super_admin/committee_* → admin/index.html
    │           ├─ branch_* → branch/index.html
    │           ├─ academy_* → portal/index.html
    │           └─ user → home.html
    │
    └─ [يقرأ ?next=] → redirect ذكي (مع anti-traversal)
```

---

### 3.1.2 — Flow: طلب تسجيل مستخدم (User Request)

```
[زائر] → يملأ فورم طلب دور (في login.html أو صفحة منفصلة)
    │
    ├─ يختار: requested_role, governorate, justification
    │
    ├─ [Insert في user_requests] status='pending'
    │
    ├─ [إشعار للمسؤول المناسب]:
    │   ├─ لو requested_role = committee_* → committee_head
    │   ├─ لو requested_role = branch_* → branch_president (نفس المحافظة)
    │   └─ لو requested_role = academy_* → academy_owner (نفس الأكاديمية)
    │
    ├─ [المسؤول يفتح admin/users/requests]
    │   ├─ Approve → 
    │   │   ├─ Update profiles: status='active', role=requested_role
    │   │   ├─ Update user_requests: status='approved'
    │   │   ├─ إشعار للمستخدم (email + in-app)
    │   │   └─ Log في activities
    │   │
    │   └─ Reject → status='rejected' + rejection_reason
    │
    └─ [Auto-approve]: لو super_admin أنشأ المستخدم مباشرة → status='active' فوراً
```

---

### 3.1.3 — Flow: إصدار شهادة (Certificate Issuance)

```
[المُصدر: admin أو academy_owner] → يفتح صفحة "إصدار شهادة"
    │
    ├─ [1] اختيار نوع المصدر:
    │   ├─ Union → يختار course من union_courses
    │   └─ Academy → يختار academy ثم course من academy_courses
    │
    ├─ [2] بيانات المتدرب:
    │   ├─ student_name (required)
    │   ├─ national_id (optional, مش هيظهر كامل في verify)
    │   ├─ student_email / phone (optional)
    │
    ├─ [3] بيانات الدورة:
    │   ├─ course_name (auto من course)
    │   ├─ grade (dropdown من certificates.grades)
    │   ├─ issue_date (default = today)
    │   ├─ duration_hours (optional)
    │
    ├─ [4] توليد الكود (Code Generation):
    │   │
    │   ├─ [Auto Mode] (default):
    │   │   ├─ يستدعي Edge Function `auto-code`
    │   │   ├─ يقرأ pattern من settings.certificates.code_pattern
    │   │   ├─ مثال: NTI-2026-{RANDOM6}
    │   │   ├─ يتحقق من uniqueness في certificates
    │   │   └─ يرجع الكود
    │   │
    │   └─ [Manual Mode] (optional):
    │       ├─ المستخدم يكتب الكود
    │       ├─ Validation: pattern match + unique
    │       └─ لو مكرر → خطأ
    │
    ├─ [5] Preview:
    │   ├─ عرض الشهادة (HTML)
    │   ├─ QR code (يحتوي verify.html?code=XXX)
    │   └─ Logos + stamp (من settings)
    │
    ├─ [6] Generate:
    │   ├─ Insert في certificates (code, issuer_type, issuer_id, ...)
    │   ├─ استدعاء Edge Function `generate-pdf` → يرفع PDF لـ certificate-pdfs
    │   ├─ استدعاء Edge Function `generate-qr` → يرفع QR
    │   ├─ Update certificates: pdf_url, qr_code_url
    │   └─ Log في activities
    │
    └─ [7] Success:
        ├─ عرض الشهادة + أزرار (تحميل PDF / مشاركة / نسخ رابط)
        └─ إشعار (لو email متوفر)
```

---

### 3.1.4 — Flow: التحقق من شهادة (Verify)

```
[زائر] → verify.html
    │
    ├─ [يقرأ ?code=XXX من URL]
    │   ├─ موجود → auto-verify
    │   └─ لا → فورم إدخال
    │
    ├─ [Query certificates WHERE code = XXX]
    │   ├─ غير موجود → "لم يتم العثور على الشهادة"
    │   │
    │   ├─ موجود → جلب academy (لو issuer_type='academy')
    │   │
    │   ├─ [فحص الحالة]:
    │   │   ├─ is_revoked = true → "شهادة ملغاة" + سبب الإلغاء
    │   │   ├─ is_active = false → "شهادة غير صالحة"
    │   │   ├─ academy.status != 'approved' (لو academy) → "شهادة غير صالحة"
    │   │   └─ كل شيء سليم → "شهادة صحيحة"
    │   │
    │   ├─ [عرض النتيجة]:
    │   │   ├─ Badge: "شهادة نقابة" أو "شهادة أكاديمية"
    │   │   ├─ بيانات المتدرب (national_id masked: ********1234)
    │   │   ├─ بيانات الدورة + التقدير
    │   │   ├─ الأكاديمية/الفرع (لو academy)
    │   │   └─ QR + أزرار (طباعة / PDF / مشاركة / نسخ)
    │   │
    │   └─ [Log في search_logs]: masked code (first 4 + ***)
    │
    └─ [Realtime]: لو الشهادة اتلغت أثناء العرض → تتحدث تلقائياً
```

---

### 3.1.5 — Flow: تقييم أكاديمية (Rating)

```
[مستخدم مسجل] → academy-details.html
    │
    ├─ [هل ratings.enable_ratings = true؟]
    │   └─ لا → إخفاء زر التقييم
    │
    ├─ [هل ratings.allow_public_rating = true؟]
    │   ├─ لا → فقط النقابة تقيّم (admin only)
    │   └─ نعم → أي مستخدم مسجل
    │
    ├─ [هل المستخدم قيّم الأكاديمية قبل كده؟]
    │   ├─ نعم → عرض "تقييمك: ★★★★☆" + إمكانية التعديل
    │   └─ لا → فورم تقييم
    │
    ├─ [فورم التقييم]:
    │   ├─ Stars (1-5) — required
    │   ├─ Review text (optional، لو ratings.allow_reviews = true)
    │   └─ Submit
    │
    ├─ [Insert/Update في academy_ratings]
    │   ├─ rated_by = auth.uid()
    │   ├─ is_visible = ratings.auto_publish (default true)
    │   └─ Trigger يحدث academies.rating_avg + rating_count
    │
    ├─ [Realtime]: كل الصفحات المفتوحة تتحدث فوراً
    │
    └─ [Admin]: يقدر يخفي تقييم (is_visible = false) من admin/academies/ratings
```

---

### 3.1.6 — Flow: متابعة طلب اعتماد (Track)

```
[زائر] → track.html
    │
    ├─ [يقرأ ?req=XXX]
    │
    ├─ [Query accreditation_requests WHERE request_number = XXX]
    │   ├─ غير موجود → "لم يتم العثور على الطلب"
    │   └─ موجود → جلب request_stage_history
    │
    ├─ [بناء الـ Timeline]:
    │   ├─ 5 مراحل ثابتة (submitted → documents_review → site_visit → committee_review → final_approval)
    │   ├─ Merge مع request_stage_history (dates + notes)
    │   ├─ SLA badge (on-time / warning / overdue) من accreditation.sla_days
    │   └─ Approved/Rejected banner (لو status)
    │
    ├─ [Realtime]: Subscribe على accreditation_requests (id=eq.X)
    │   └─ أي تغيير في المرحلة → تحديث فوري
    │
    └─ [Log في search_logs]
```

---

## 📅 Part 3.2 — Implementation Phases (6 مراحل)

### Phase 0 — التأسيس (قبل أي كود)
**المدة**: 3-5 أيام

| # | المهمة | الملفات |
|---|--------|---------|
| 0.1 | تحديث `schema.sql` (28 جدول) | `supabase/schema.sql` |
| 0.2 | تحديث `rls-policies.sql` | `supabase/rls-policies.sql` |
| 0.3 | تحديث `seed.sql` (27 محافظة + 17 ثيم + labels) | `supabase/seed.sql` |
| 0.4 | كتابة `HANDOFF_V2.md` (الوثيقة دي) | `docs/HANDOFF.md` |
| 0.5 | كتابة `SCREENS.md` (تفاصيل 56 شاشة) | `docs/SCREENS.md` |
| 0.6 | كتابة `ROLES.md` (مصفوفة الصلاحيات) | `docs/ROLES.md` |
| 0.7 | كتابة `DATABASE.md` (Schema تفصيلي) | `docs/DATABASE.md` |

**Checklist Phase 0**:
- [ ] schema.sql يحتوي 28 جدول + indexes + triggers + helper functions
- [ ] RLS policies لكل جدول
- [ ] Seed data جاهز (27 محافظة، 17 ثيم، 60+ label)
- [ ] الوثائق الثلاثة مكتوبة

---

### Phase 1 — Core (الأساس التقني)
**المدة**: 7-10 أيام

| # | المهمة | الملف |
|---|--------|-------|
| 1.1 | `settings-defaults.js` V2 (كل المفاتيح الجديدة) | `assets/js/settings-defaults.js` |
| 1.2 | `config.js` V2 (BASE_PATH + resolveUrl) | `assets/js/config.js` |
| 1.3 | `supabase-client.js` (window.sb) | `assets/js/supabase-client.js` |
| 1.4 | `app-settings.js` V2 (realtime + labels) | `assets/js/app-settings.js` |
| 1.5 | `labels.js` (جديد) | `assets/js/labels.js` |
| 1.6 | `permissions.js` (جديد) | `assets/js/permissions.js` |
| 1.7 | `themes-data.js` (17 ثيم) | `assets/js/themes-data.js` |
| 1.8 | `theme.js` V2 (FOUC + system) | `assets/js/theme.js` |
| 1.9 | `realtime.js` (جديد) | `assets/js/realtime.js` |
| 1.10 | `icons.js` (SVG sprite) | `assets/js/icons.js` |
| 1.11 | `utils.js` V2 | `assets/js/utils.js` |
| 1.12 | `session.js` V2 | `assets/js/session.js` |
| 1.13 | `auth-guard.js` V2 (roles جديدة) | `assets/js/auth-guard.js` |
| 1.14 | `app-title.js` V2 | `assets/js/app-title.js` |
| 1.15 | CSS: `theme.css` (17 ثيم) | `assets/css/theme.css` |
| 1.16 | CSS: `base.css` | `assets/css/base.css` |
| 1.17 | CSS: `components.css` | `assets/css/components.css` |
| 1.18 | CSS: `layout.css` | `assets/css/layout.css` |

**Checklist Phase 1**:
- [ ] كل الملفات تحمل بدون أخطاء في console
- [ ] `window.sb` موجود
- [ ] `AppSettings.get()` يرجع قيم
- [ ] `Labels.t()` يرجع نصوص
- [ ] `Permissions.can()` يعمل
- [ ] `Realtime.subscribe()` يعمل
- [ ] الثيم الافتراضي `watanii_dark` يتطبق فوراً

---

### Phase 2 — الصفحات العامة (11 شاشة)
**المدة**: 10-14 يوم

| # | الشاشة | المسار | JS |
|---|--------|--------|-----|
| 2.1 | Splash | `index.html` | `splash.js` |
| 2.2 | Home | `home.html` | `home.js` |
| 2.3 | Verify | `verify.html` | `verify.js` |
| 2.4 | Student | `student.html` | `student.js` |
| 2.5 | Track | `track.html` | `track.js` |
| 2.6 | Academies | `academies.html` | `academies.js` |
| 2.7 | Academy Details | `academy-details.html` | `academy-details.js` |
| 2.8 | Academy Apply | `academy-apply.html` | `academy-apply.js` |
| 2.9 | Login | `login.html` | `login.js` |
| 2.10 | Reset Password | `reset-password.html` | `reset-password.js` |
| 2.11 | 404 | `404.html` | static |

**Checklist Phase 2**:
- [ ] كل شاشة تحمل بدون أخطاء
- [ ] كل النصوص من `Labels`
- [ ] Realtime يعمل في: home, verify, track
- [ ] Search tabs تعمل
- [ ] Login redirects صحيحة

---

### Phase 3 — لوحة الإدارة (33 شاشة)
**المدة**: 20-25 يوم

| # | الشاشة | المسار | JS |
|---|--------|--------|-----|
| 3.1 | Dashboard | `admin/index.html` | `admin/dashboard.js` |
| 3.2 | Settings General | `admin/settings/index.html` | `admin/settings-general.js` |
| 3.3 | Settings Themes | `admin/settings/themes.html` | `admin/settings-themes.js` |
| 3.4 | Settings Labels | `admin/settings/labels.html` | `admin/settings-labels.js` |
| 3.5 | Settings Workflow | `admin/settings/workflow.html` | `admin/settings-workflow.js` |
| 3.6 | Settings Security | `admin/settings/security.html` | `admin/settings-security.js` |
| 3.7 | Settings Ratings | `admin/settings/ratings.html` | `admin/settings-ratings.js` |
| 3.8 | Settings Certificates | `admin/settings/certificates.html` | `admin/settings-certificates.js` |
| 3.9 | Settings Backup | `admin/settings/backup.html` | `admin/settings-backup.js` |
| 3.10 | Users | `admin/users/index.html` | `admin/users.js` |
| 3.11 | User Requests | `admin/users/requests.html` | `admin/users-requests.js` |
| 3.12 | Roles | `admin/users/roles.html` | `admin/users-roles.js` |
| 3.13 | Permissions | `admin/users/permissions.html` | `admin/users-permissions.js` |
| 3.14 | Branches | `admin/branches/index.html` | `admin/branches.js` |
| 3.15 | Branch Add | `admin/branches/add.html` | `admin/branches-form.js` |
| 3.16 | Branch Edit | `admin/branches/edit.html` | `admin/branches-form.js` |
| 3.17 | Academies | `admin/academies/index.html` | `admin/academies.js` |
| 3.18 | Academy Add | `admin/academies/add.html` | `admin/academies-form.js` |
| 3.19 | Academy Edit | `admin/academies/edit.html` | `admin/academies-form.js` |
| 3.20 | Academy Details | `admin/academies/details.html` | `admin/academies-details.js` |
| 3.21 | Academy Ratings | `admin/academies/ratings.html` | `admin/academies-ratings.js` |
| 3.22 | Certificates | `admin/certificates/index.html` | `admin/certificates.js` |
| 3.23 | Certificate Add | `admin/certificates/add.html` | `admin/certificates-form.js` |
| 3.24 | Certificate Edit | `admin/certificates/edit.html` | `admin/certificates-form.js` |
| 3.25 | Certificate Revoke | `admin/certificates/revoke.html` | `admin/certificates-revoke.js` |
| 3.26 | Requests | `admin/requests/index.html` | `admin/requests.js` |
| 3.27 | Request Details | `admin/requests/details.html` | `admin/requests-details.js` |
| 3.28 | Union Courses | `admin/union-courses/index.html` | `admin/union-courses.js` |
| 3.29 | Union Course Add | `admin/union-courses/add.html` | `admin/union-courses-form.js` |
| 3.30 | Union Course Edit | `admin/union-courses/edit.html` | `admin/union-courses-form.js` |
| 3.31 | Reports | `admin/reports/index.html` | `admin/reports.js` |
| 3.32 | Activities | `admin/activities.html` | `admin/activities.js` |
| 3.33 | Login Logs | `admin/login-logs.html` | `admin/login-logs.js` |

**Checklist Phase 3**:
- [ ] كل شاشة تعمل
- [ ] Permissions checks موجودة
- [ ] Realtime في: dashboard, users, academies, certificates, requests
- [ ] Export Excel/PDF يعمل
- [ ] Settings changes تنتشر realtime

---

### Phase 4 — بوابة الأكاديمية (8 شاشات)
**المدة**: 7-10 أيام

| # | الشاشة | المسار | JS |
|---|--------|--------|-----|
| 4.1 | Dashboard | `portal/index.html` | `portal/dashboard.js` |
| 4.2 | Certificates | `portal/certificates/index.html` | `portal/certificates.js` |
| 4.3 | Certificate Add | `portal/certificates/add.html` | `portal/certificates-form.js` |
| 4.4 | Certificate Edit | `portal/certificates/edit.html` | `portal/certificates-form.js` |
| 4.5 | Reports | `portal/reports.html` | `portal/reports.js` |
| 4.6 | Profile | `portal/profile.html` | `portal/profile.js` |
| 4.7 | Application | `portal/application.html` | `portal/application.js` |
| 4.8 | Courses | `portal/courses.html` | `portal/courses.js` |

**Checklist Phase 4**:
- [ ] Academy owner يشوف شهاداته فقط
- [ ] Auto/Manual code يعمل
- [ ] Print report للشهادات
- [ ] Export Excel

---

### Phase 5 — بوابة الفرع (4 شاشات)
**المدة**: 5-7 أيام

| # | الشاشة | المسار | JS |
|---|--------|--------|-----|
| 5.1 | Dashboard | `branch/index.html` | `branch/dashboard.js` |
| 5.2 | Users | `branch/users.html` | `branch/users.js` |
| 5.3 | Academies | `branch/academies.html` | `branch/academies.js` |
| 5.4 | Certificates | `branch/certificates.html` | `branch/certificates.js` |

**Checklist Phase 5**:
- [ ] Branch level يشوف محافظته فقط
- [ ] Branch president يعيّن مستخدمين
- [ ] Realtime

---

### Phase 6 — Polish & CV Builder
**المدة**: 7-10 أيام

| # | المهمة |
|---|--------|
| 6.1 | CV Builder: JSON Schema |
| 6.2 | CV Builder: jsPDF Text API |
| 6.3 | CV Builder: docx |
| 6.4 | CV Builder: ats-checker |
| 6.5 | CV Builder: Format Checker |
| 6.6 | CV Builder: UI (student.html + portal) |
| 6.7 | Testing كامل لكل flow |
| 6.8 | Performance audit |
| 6.9 | Security audit |
| 6.10 | Documentation نهائي |

---

## 🌱 Part 3.3 — Seed Data

### 3.3.1 — 27 محافظة مصرية

```sql
INSERT INTO governorates (code, name_ar, name_en, region, order_index) VALUES
('CAI', 'القاهرة', 'Cairo', 'القاهرة الكبرى', 1),
('GIZ', 'الجيزة', 'Giza', 'القاهرة الكبرى', 2),
('QAL', 'القليوبية', 'Qalyubia', 'القاهرة الكبرى', 3),
('ALX', 'الإسكندرية', 'Alexandria', 'الساحل', 4),
('BEH', 'البحيرة', 'Beheira', 'الدلتا', 5),
('KFS', 'كفر الشيخ', 'Kafr El Sheikh', 'الدلتا', 6),
('GHR', 'الغربية', 'Gharbia', 'الدلتا', 7),
('MNF', 'المنوفية', 'Monufia', 'الدلتا', 8),
('DGH', 'الدقهلية', 'Dakahlia', 'الدلتا', 9),
('SHR', 'الشرقية', 'Sharqia', 'الدلتا', 10),
('ISM', 'الإسماعيلية', 'Ismailia', 'القناة', 11),
('PTS', 'بورسعيد', 'Port Said', 'القناة', 12),
('SUZ', 'السويس', 'Suez', 'القناة', 13),
('DNS', 'دمياط', 'Damietta', 'الدلتا', 14),
('FYM', 'الفيوم', 'Faiyum', 'الصعيد', 15),
('BNS', 'بني سويف', 'Beni Suef', 'الصعيد', 16),
('MNY', 'المنيا', 'Minya', 'الصعيد', 17),
('ASY', 'أسيوط', 'Asyut', 'الصعيد', 18),
('SHG', 'سوهاج', 'Sohag', 'الصعيد', 19),
('QNA', 'قنا', 'Qena', 'الصعيد', 20),
('LXR', 'الأقصر', 'Luxor', 'الصعيد', 21),
('ASN', 'أسوان', 'Aswan', 'الصعيد', 22),
('BAH', 'البحر الأحمر', 'Red Sea', 'الصعيد', 23),
('WAD', 'الوادي الجديد', 'New Valley', 'الصعيد', 24),
('MAT', 'مطروح', 'Matrouh', 'الساحل', 25),
('SIN', 'شمال سيناء', 'North Sinai', 'القناة', 26),
('SIS', 'جنوب سيناء', 'South Sinai', 'القناة', 27);
```

### 3.3.2 — 17 ثيم (Seed)

```sql
-- ملاحظة: colors JSONB يحتوي كل CSS variables (راجع Part 2.5)
INSERT INTO themes (id, name_ar, is_dark, is_default, is_active, order_index) VALUES
('watanii_dark', 'وطني داكن', true, true, true, 1),
('watanii_light', 'وطني فاتح', false, false, true, 2),
('tech_blue', 'تكنولوجي أزرق', true, false, true, 3),
('tech_purple', 'تكنولوجي بنفسجي', true, false, true, 4),
('midnight_gold', 'ليلي ذهبي', true, false, true, 5),
('royal_purple', 'ملكي بنفسجي', true, false, true, 6),
('emerald_dark', 'زمردي داكن', true, false, true, 7),
('emerald_light', 'زمردي فاتح', false, false, true, 8),
('ocean_teal', 'محيط فيروزي', true, false, true, 9),
('sunset_orange', 'غروب برتقالي', true, false, true, 10),
('crimson_noir', 'قرمزي نوار', true, false, true, 11),
('slate_professional', 'رمادي احترافي', false, false, true, 12),
('forest_green', 'أخضر غابات', true, false, true, 13),
('sky_light', 'سماوي فاتح', false, false, true, 14),
('paper_classic', 'ورقي كلاسيكي', false, false, true, 15),
('neon_pink', 'نيون وردي', true, false, true, 16),
('system', 'حسب النظام', true, false, true, 17);
```

### 3.3.3 — 60+ Label (Seed مختصر)

```sql
-- راجع Part 2.4.2 للقائمة الكاملة
INSERT INTO labels (key, ar_value, default_ar, category) VALUES
('common.save', 'حفظ', 'حفظ', 'common'),
('common.cancel', 'إلغاء', 'إلغاء', 'common'),
('common.delete', 'حذف', 'حذف', 'common'),
('auth.login.title', 'تسجيل الدخول', 'تسجيل الدخول', 'auth'),
('auth.login.button', 'تسجيل الدخول', 'تسجيل الدخول', 'auth'),
('auth.login.pending_title', 'طلبك قيد المراجعة', 'طلبك قيد المراجعة', 'auth'),
('home.hero.title', 'مرحباً بك في نقابة تكنولوجيا المعلومات', 'مرحباً بك في نقابة تكنولوجيا المعلومات', 'home'),
('home.search.tab_cert', 'شهادة', 'شهادة', 'home'),
('verify.title', 'تحقق من صحة الشهادة', 'تحقق من صحة الشهادة', 'verify'),
('verify.valid', 'شهادة صحيحة', 'شهادة صحيحة', 'verify'),
('verify.revoked', 'شهادة ملغاة', 'شهادة ملغاة', 'verify'),
('admin.dashboard.title', 'لوحة التحكم', 'لوحة التحكم', 'admin'),
('portal.dashboard.title', 'بوابة الأكاديمية', 'بوابة الأكاديمية', 'portal'),
('branch.dashboard.title', 'بوابة الفرع', 'بوابة الفرع', 'branch'),
('errors.404.title', 'الصفحة غير موجودة', 'الصفحة غير موجودة', 'errors');
-- ... إلخ
```

### 3.3.4 — 6 تصنيفات أكاديميات

```sql
INSERT INTO academy_categories (name_ar, icon_name, order_index) VALUES
('برمجة وتطوير', 'code', 1),
('شبكات وأمن سيبراني', 'shield', 2),
('تصميم وجرافيك', 'palette', 3),
('بيانات وذكاء اصطناعي', 'chart', 4),
('تسويق رقمي', 'megaphone', 5),
('إدارة مشاريع', 'briefcase', 6);
```

### 3.3.5 — Super Admin (Seed)

```sql
-- ⚠️ يتم إنشاؤه من setup.html أو من Dashboard Supabase Auth
-- بعد إنشاء auth.user:
INSERT INTO profiles (id, email, full_name, role, status, is_primary, is_active)
VALUES (
  '<auth_user_id>',
  'superadmin@itws.com',
  'النقيب العام',
  'super_admin',
  'active',
  true,
  true
);
```

---

## ✅ Part 3.4 — Final Checklist (قبل كل Phase)

### قبل Phase 0:
- [ ] Supabase project جاهز
- [ ] `.env` محلياً (مش مرفوع على GitHub)
- [ ] `SERVICE_ROLE_KEY` في `.env` فقط

### قبل Phase 1:
- [ ] schema.sql + rls + seed اتنفذوا في Supabase
- [ ] اختبار RLS policies (كل role)
- [ ] Storage buckets موجودة

### قبل Phase 2:
- [ ] Core files كلها تعمل بدون أخطاء
- [ ] الثيمات تتبدل
- [ ] Labels تتحمل
- [ ] Realtime متصل

### قبل Phase 3:
- [ ] AuthGuard يعمل لكل role
- [ ] Permissions checks موجودة
- [ ] Admin sidebar dynamic (بحسب role)

### قبل Phase 4:
- [ ] Academy owner flow جاهز
- [ ] Certificate issuance (auto + manual) يعمل
- [ ] PDF generation يعمل

### قبل Phase 5:
- [ ] Branch scope يعمل
- [ ] Branch president يعيّن مستخدمين
- [ ] RLS محافظة

### قبل Phase 6 (Launch):
- [ ] كل الشاشات 56 تعمل
- [ ] كل الفلوهات مختبرة
- [ ] مفيش console errors
- [ ] مفيش إيموجي في أي ملف
- [ ] كل المسارات نسبية
- [ ] Cairo فقط
- [ ] كل النصوص من Labels
- [ ] كل الألوان من Themes
- [ ] Realtime يعمل على كل الشاشات
- [ ] Security audit (مفيش service_role key في client)
- [ ] Performance audit (Lighthouse > 90)
- [ ] Documentation كامل

---

## 🚀 Part 3.5 — instructions للبدء

### خطوة 1: نفذ Phase 0
```bash
# 1. افتح Supabase SQL Editor
# 2. نفذ: schema.sql
# 3. نفذ: rls-policies.sql
# 4. نفذ: seed.sql
```

### خطوة 2: ابدأ Phase 1
- ابدأ بـ `settings-defaults.js` → `config.js` → `supabase-client.js`
- بعدها `app-settings.js` + `labels.js` + `permissions.js`
- بعدها `theme.js` + `themes-data.js`
- بعدها `realtime.js` + `icons.js`
- بعدها `utils.js` + `session.js` + `auth-guard.js`

### خطوة 3: اختبر Phase 1
- افتح `home.html` (حتى لو فاضي) → تأكد إن `window.sb` موجود
- افتح console → تأكد مفيش errors
- جرب `AppSettings.get('app_identity.union_name')` → يرجع قيمة

### خطوة 4: ابدأ Phase 2
- شاشة شاشة، بنفس ترتيب Part 3.2

---

## 🔚 نهاية Part 3 — نهاية الوثيقة

**الوثيقة كاملة الآن:**
- ✅ Part 1: الرؤية + القواعد + الـ Stack + هيكل الملفات + 56 شاشة + الأدوار
- ✅ Part 2: Schema (28 جدول) + Storage + RLS + Labels + Themes (17) + Realtime + الشاشات 25-56
- ✅ Part 3: Flows (6) + Implementation Phases (6) + Seed Data + Checklists + Instructions

**القرار النهائي للـ CV Builder:**
- **PDF**: jsPDF (Text API) — مجاني
- **DOCX**: `docx` — مجاني
- **ATS Score**: `@pranavraut033/ats-checker` — مجاني
- **Format Checker**: Rules-based مدمج — مجاني

**ابدأ بـ Phase 0، وقولي لما تخلص عشان نبدأ Phase 1.**
