# 📘 ITWS Platform — Handoff Document V5
## وثيقة تسليم المشروع الكاملة

> **اقرأها بالكامل قبل أي حاجة. لما تلصقها في شات جديد، هنكمل من غير ما نرجع لورا.**

---

# 🏛️ أولاً: نظرة عامة

| البند | التفاصيل |
|-------|---------|
| **المشروع** | ITWS Platform — منصة نقابة تكنولوجيا المعلومات والبرمجيات |
| **الجهة** | نقابة تكنولوجيا المعلومات — لجنة التحول الرقمي والتدريب |
| **الغرض** | التحقق من الشهادات + إدارة الأكاديميات + متابعة الطلبات + بوابة أكاديمية/فرع |
| **الجمهور** | زوار + متدربين + أكاديميات + إدارة النقابة + فروع |
| **الحالة** | الصفحات العامة شبه كاملة — لوحة الإدارة والبوابات لسه محتاجة |
| **GitHub Pages** | `https://itworkerssyndicate.github.io/academymangment/` |
| **الـ Base Path** | `/academymangment/` |

---

# ⚙️ ثانياً: القرارات التقنية الحاسمة (لا تتغير)

## Stack

| الطبقة | التقنية | ملاحظة |
|-------|---------|---------|
| HTML | HTML5 | `data-*` attributes |
| CSS | CSS3 + CSS Variables | **بدون** Tailwind / build step |
| JS | **Vanilla ES5/ES6 IIFE** | **مش** React، **مش** Next.js، **مش** TypeScript، **مش** Vue |
| DB | Supabase (PostgreSQL) | URL: `https://hfupkxbajpnaillsqayc.supabase.co` |
| Auth | Supabase Auth | مع RLS |
| Storage | Supabase Storage | buckets: `public-assets`, `academy-documents`, `certificate-pdfs` |
| Fonts | **Cairo + Alexandria + JetBrains Mono** | من Google Fonts |
| Icons | SVG inline | **بدون** مكتبات أيقونات خارجية |
| Host | GitHub Pages | subpath `/academymangment/` |

## 📌 القاعدة الذهبية: مفيش Build Step
- **مفيش** `npm install`
- **مفيش** `webpack` / `vite` / `parcel`
- **مفيش** `package.json` (إلا لو للـ CLI)
- كل ملف HTML بيحمل السكريبتات والـ CSS مباشرة من `<head>` + `<body>`

## Supabase Credentials (الموجودة في `config.js`)

```javascript
SUPABASE_URL = 'https://hfupkxbajpnaillsqayc.supabase.co'
SUPABASE_ANON_KEY = 'sb_publishable__9lVaIyTxYzyykQ_AY_u9w_On795zBK'
```

**⚠️ الـ Postgres connection string (`postgresql://...`) ممنوع في أي ملف client-side.** للـ CLI فقط.

---

# 🎨 ثالثاً: نظام التصميم (Neon System)

## الألوان — 8 ثيمات

**النظام الجديد بيستخدم `--accent` + `--accent-2` (مش `--primary`)**

| ID | الاسم | النوع | Accent | Accent 2 | BG |
|----|-------|------|--------|----------|-----|
| `neon-dark` ★ | نيون داكن (افتراضي) | Dark | `#00f0ff` | `#b026ff` | `#0a0c14` |
| `neon-light` | نيون فاتح | Light | `#0099ff` | `#a020f0` | `#f5f7fb` |
| `cyberpunk` | سايبر بانك | Dark | `#ff0080` | `#ffcc00` | `#0d0619` |
| `emerald` | زمردي | Dark | `#10b981` | `#fbbf24` | `#071410` |
| `royal` | ملكي | Dark | `#8b5cf6` | `#06b6d4` | `#0a0618` |
| `patriot` | وطني | Dark | `#e62e2e` | `#d4af37` | `#0a0a0a` |
| `tech-cairo` | تك القاهرة | Dark | `#e62e2e` | `#d4af37` | `#1a0a0a` |
| `minimal` | بسيط فاتح | Light | `#e62e2e` | `#1a1a1a` | `#ffffff` |

## الخطوط

```css
--font-main: 'Cairo', system-ui, sans-serif;        /* النصوص العادية */
--font-heading: 'Alexandria', 'Cairo', sans-serif;  /* العناوين */
--font-mono: 'JetBrains Mono', monospace;           /* الأكواد والأرقام */
```

## نظام المتغيرات الكامل

```css
--accent, --accent-2, --accent-rgb, --accent-2-rgb
--bg, --bg-2, --bg-3, --card-bg, --card-bg-solid
--text, --text-muted, --text-dim
--border, --border-soft, --border-strong
--success, --danger, --warning, --info (+ -rgb لكل واحد)
--radius-sm, --radius-md, --radius-lg, --radius-xl, --radius-full
--shadow-sm, --shadow-md, --shadow-lg, --shadow-xl
--glow-accent, --glow-accent-strong, --glow-accent-2
--gradient-accent: linear-gradient(135deg, var(--accent), var(--accent-2))
--transition-fast, --transition-base, --transition-slow
--header-height: 76px
--container-max: 1280px
--safe-top/right/bottom/left (env safe-area)
--z-dropdown: 800, --z-header: 900, --z-modal: 1000, --z-toast: 1100
```

## قواعد التصميم
- ✅ Canvas particles في الخلفية (60 نقطة)
- ✅ Background grid + 2 glows (accent + accent-2)
- ✅ Glassmorphism (`backdrop-filter: blur(20px)`)
- ✅ Neon glow effects على hover
- ✅ Gradient text (accent → accent-2) مع shine animation
- ✅ Floating orbs + rotating dashed circles
- ✅ Navbar يتغير عند scroll
- ✅ Live clock في الـ code card
- ✅ Alexandria للعناوين + JetBrains Mono للأكواد

---

# 📋 رابعاً: القواعد الصارمة (Rules)

## 🔴 R1 — بدون إيموجي نهائياً
- ممنوع: `🎓 ✅ ❌ 📜 🏛️ 🔍`
- مسموح: SVG inline + نصوص عربية + `✓` `×` `→` (كـ unicode نادر)
- كل الأيقونات SVG داخل الـ HTML مباشرة

## 🔴 R2 — مسارات نسبية فقط
- **ممنوع** `/home.html` أو `src="/assets/..."` (البادئة `/`)
- **مسموح** `home.html` أو `./home.html` أو `../home.html`
- `window.resolveUrl(path)` في `config.js` بيحل المسار على `BASE_PATH`

## 🔴 R3 — كل شيء من `settings` / `labels`
- ممنوع hardcode لأي: اسم، لون، نص، رقم، عنوان، زر
- النصوص: `[data-setting="key"]` → `AppSettings.get()` أو `Labels.t()`
- الألوان: `var(--accent)` من `themes.css`
- السلوكيات: `AppSettings.get('path', fallback)`

## 🔴 R4 — الثيم الافتراضي `neon-dark`
- 8 ثيمات في `themes-data.js`
- يُطبق في `<head>` قبل CSS (FOUC prevention)
- override محلي في `localStorage('itws_theme')`
- لو النقيب غيّر الافتراضي → realtime للزوار اللي معندهمش override

## 🔴 R5 — Secrets
- `SUPABASE_ANON_KEY` فقط في `config.js`
- `SUPABASE_SERVICE_ROLE_KEY` **ممنوع** في أي ملف client-side
- ممنوع `console.log` لأي data حساسة (national_id, password, tokens)

## 🔴 R6 — Supabase Client
- Global واحد: **`window.sb`**
- يُعرّف في `assets/js/supabase-client.js` (silent version — بدون console.error)
- كل الملفات بتستخدم `window.sb` أو `window.supabaseClient`

## 🔴 R7 — Realtime على الشاشات
- عبر `window.Realtime.subscribe(table, callback, options)`
- Debounce 300-800ms
- fallback polling كل 30s لو WS قطع

## 🔴 R8 — الصلاحيات
- **DB level**: RLS policies
- **JS level**: `Permissions.can(action, resource, scope)`
- **UI level**: إخفاء/تعطيل الأزرار

## 🔴 R9 — الخطوط
- Cairo + Alexandria + JetBrains Mono فقط
- ممنوع أي خط تاني

## 🔴 R10 — اللغة العربية
- `dir="rtl"` على `<html>`
- الأرقام والأكواد اللاتينية `dir="ltr"`

## 🔴 R11 — بيانات حساسة
- ممنوع national_id في localStorage / URL / sessionStorage
- ممنوع password في أي مكان
- tokens فقط في Supabase Auth storage

## 🔴 R12 — Responsive (R13)
- mobile-first
- `env(safe-area-inset-*)` على كل حاجة
- touch targets ≥ 44px
- `clamp()` للخطوط
- breakpoints: 480px, 640px, 768px, 1024px

## 🔴 R13 — Security Layer
- `assets/js/security.js` فعال على كل الصفحات
- بيمنع: F12, Ctrl+Shift+I/J/C/K, Ctrl+U, Ctrl+S, Right-click, Copy (ما عدا الحقول), Drag images
- **⚠️ Deterrent فقط — مش أمان حقيقي**. الحماية الحقيقية = RLS + Rate limiting

---

# 📁 خامساً: هيكل الملفات

```
academymangment/
│
├── index.html                          ← Splash (لسه محتاج تصميم جديد)
├── home.html                           ✅ جاهز (تصميم neon كامل)
├── verify.html                         ✅ جاهز
├── student.html                        ⏳ التالي
├── academies.html                      ⏳
├── academy-details.html                ⏳
├── academy-apply.html                  ⏳
├── track.html                          ⏳
├── login.html                          ⏳ (محتاج تحديث للتصميم الجديد)
├── reset-password.html                 ⏳
├── 404.html                            ⏳
│
├── admin/                              ❌ كلها محتاجة بناء
│   ├── index.html                      ← Dashboard
│   ├── settings/*                      ← 8 صفحات
│   ├── users/*                         ← 4 صفحات
│   ├── branches/*                      ← 3 صفحات
│   ├── academies/*                     ← 5 صفحات
│   ├── certificates/*                  ← 4 صفحات
│   ├── requests/*                      ← 2 صفحات
│   ├── union-courses/*                 ← 3 صفحات
│   ├── reports/, activities.html, login-logs.html
│
├── portal/                             ❌ كلها محتاجة بناء (بوابة أكاديمية)
├── branch/                             ❌ كلها محتاجة بناء (بوابة فرع)
│
├── assets/
│   ├── css/
│   │   ├── theme.css                   ✅ V4 (8 themes + نظام كامل)
│   │   ├── base.css                    ✅ V4 (Reset + typography)
│   │   ├── components.css              ✅ V4 (Buttons, Cards, Forms, Modals, Toasts, Loaders, Skeleton, Alerts, Tabs)
│   │   └── pages.css                   ✅ V4 (Navbar, Hero, Code Card, Sections, CTA, Footer, BG Canvas)
│   │
│   ├── js/
│   │   ├── config.js                   ✅ Silent V3 (بدون console.error)
│   │   ├── settings-defaults.js        ✅ V2 (13 groups — نفس اللي في seed.sql)
│   │   ├── supabase-client.js          ✅ Silent V3 (بدون console.error)
│   │   ├── themes-data.js              ✅ V5 (8 themes — accent system)
│   │   ├── theme.js                    ✅ V3 (Theme manager للـ 8 themes)
│   │   ├── app-settings.js             ✅ V1 (من الردود القديمة)
│   │   ├── labels.js                   ✅ V1
│   │   ├── permissions.js              ✅ V1
│   │   ├── session.js                  ✅ V1
│   │   ├── auth-guard.js               ✅ V1
│   │   ├── app-title.js                ✅ V1
│   │   ├── realtime.js                 ✅ V1
│   │   ├── utils.js                    ✅ V1
│   │   ├── icons.js                    ✅ V1 (66 SVG icons)
│   │   ├── security.js                 ✅ V1 (deterrent — F12/copy/right-click)
│   │   │
│   │   ├── ui/
│   │   │   ├── header.js               ✅ V5 (للصفحات التانية — يستخدم neon system)
│   │   │   ├── sidebar.js              ⏳ محتاج تحديث للتصميم الجديد
│   │   │   ├── modal.js                ⏳ محتاج تحديث
│   │   │   ├── toast.js                ⏳ محتاج تحديث
│   │   │   ├── dropdown.js             ⏳ محتاج تحديث
│   │   │   └── table.js                ⏳ محتاج تحديث
│   │   │
│   │   └── pages/
│   │       ├── home.js                 ✅ V5 (يربط [data-setting] + branding + stats)
│   │       ├── verify.js               ✅ V3 (كامل)
│   │       ├── student.js              ⏳ التالي
│   │       ├── academies.js            ⏳
│   │       ├── academy-details.js      ⏳
│   │       ├── academy-apply.js        ⏳
│   │       ├── track.js                ⏳
│   │       ├── login.js                ⏳
│   │       ├── splash.js               ⏳
│   │       └── admin/, portal/, branch/ (كلهم لسه)
│   │
│   └── images/
│       ├── logo.svg                    ✅ موجود
│       └── stamp.png                   ✅ موجود
│
└── supabase/
    ├── schema.sql                      ✅ (28 جدول + indexes + triggers + helper functions)
    ├── rls-policies.sql                ✅ (RLS لكل جدول)
    └── seed.sql                        ✅ (27 محافظة + 8 themes + labels + settings)
```

---

# 🗄️ سادساً: قاعدة البيانات (ملخص)

## الجداول الـ 28

```
governorates, branches, academy_categories, profiles, academies,
academy_branches, academy_courses, academy_documents, academy_ratings,
accreditation_requests, request_stage_history, sessions, user_requests,
login_logs, activities, union_courses, certificate_templates,
certificates, certificate_revocations, search_logs, notifications,
email_templates, backups, system_status, settings, labels, themes, permissions
```

## Helper Functions (13)

```sql
get_user_role(), get_user_branch(), get_user_governorate(), get_user_academy()
is_super_admin(), is_committee(), is_branch_level(), is_academy_level()
has_permission(resource, action)
set_updated_at(), update_academy_rating(), handle_new_user(), handle_certificate_revocation()
```

## Settings Groups في DB (13)

```
app_identity, behavior, theme, accreditation, certificates, security,
uploads, footer, features, ratings, splash, realtime, notifications
```

## الـ 16 Role

```
super_admin, committee_head, committee_deputy, committee_member,
branch_president, branch_first_deputy, branch_second_deputy,
branch_secretary, branch_secretary_assistant,
branch_treasurer, branch_treasurer_assistant,
branch_agent, branch_agent_assistant,
academy_owner, academy_manager, user, pending_user
```

## الصلاحيات (عينة)

| Role | Resource | Action | Scope |
|------|----------|--------|-------|
| super_admin | كل شيء | read/create/update/delete | global |
| committee_head | certificates | read/create | global |
| branch_president | certificates | read | governorate |
| academy_owner | certificates | read/create | academy |
| user | certificates | read | self |

---

# 🎯 سابعاً: الملفات المُنجزة بالتفصيل

## ✅ الملفات اللي اتبعتت وجاهزة (12 ملف)

### CSS (4 ملفات)
1. `assets/css/theme.css` — 8 themes + نظام متغيرات كامل + body/base + responsive fonts
2. `assets/css/base.css` — Reset + typography + forms base + utilities + animations
3. `assets/css/components.css` — Buttons (6 variants) + Cards + Forms + Checkbox/Toggle + Badges + Chips + Avatars + Alerts + Skeleton + Spinner + Tabs + Divider + Toast + Modal + Empty State
4. `assets/css/pages.css` — Navbar (fixed + scrolled) + Theme Panel + Hero (grid + orbs) + Code Card (with clock) + About Card + Head Card + Features + Types + Steps + CTA + Footer + BG Canvas + BG Grid + BG Glow

### JS (8 ملفات)
5. `assets/js/config.js` — Silent (بدون console.error) + resolveUrl + BASE_PATH + ITWS_CONFIG + ITWS_CONFIG_VALID
6. `assets/js/themes-data.js` — 8 themes (neon-dark, neon-light, cyberpunk, emerald, royal, patriot, tech-cairo, minimal)
7. `assets/js/theme.js` — Theme manager (change, reset, getCurrent, getAll, onChange, isDark) + FOUC prevention
8. `assets/js/security.js` — Deterrent layer (F12, Ctrl+Shift+I/J/C/K, Ctrl+U, Ctrl+S, Right-click, Copy, Drag) + Console warning
9. `assets/js/ui/header.js` — Header component V5 (للصفحات التانية) + theme picker + mobile menu
10. `assets/js/pages/home.js` — Logic للـ home.html + `[data-setting]` binder + stats + realtime
11. `assets/js/pages/verify.js` — منطق التحقق الكامل + render cert card + actions (print/pdf/share/copy) + URL auto-verify
12. `assets/js/supabase-client.js` — Silent V3 (بدون console.error) + connection state + auth helpers + query helpers + storage helpers

### HTML (2 ملف)
13. `home.html` — Canvas particles + live clock + code card + about + head + features + services + steps + CTA + footer + theme panel + mobile menu
14. `verify.html` — Search card + loading + error + cert result + actions + 3 info cards

### Supabase (3 ملفات — جزئية)
15. `supabase/schema.sql` — 28 جدول (الملف كامل)
16. `supabase/rls-policies.sql` — RLS شامل
17. `supabase/seed.sql` — 27 محافظة + 8 themes + labels + settings + permissions matrix

---

# ⏳ ثامناً: الملفات المتبقية (بالترتيب)

## المرحلة 1 — الصفحات العامة (5 ملفات)

| # | الملف | المسار | ملاحظات |
|---|-------|--------|---------|
| 18 | `student.html` | `student.html` | صفحة المتدرب — بحث بالرقم القومي + عرض الشهادات + CV builder |
| 19 | `assets/js/pages/student.js` | نفس المسار | منطق البحث + CV + render |
| 20 | `academies.html` | `academies.html` | دليل الأكاديميات — filters + grid + pagination |
| 21 | `assets/js/pages/academies.js` | نفس المسار | منطق الفلترة + البحث + render + pagination |
| 22 | `track.html` | `track.html` | متابعة طلب — search + timeline |
| 23 | `assets/js/pages/track.js` | نفس المسار | منطق البحث + timeline rendering + SLA |
| 24 | `academy-details.html` | `academy-details.html` | تفاصيل أكاديمية — profile + branches + courses + reviews |
| 25 | `assets/js/pages/academy-details.js` | نفس المسار | منطق العرض + rating flow |
| 26 | `academy-apply.html` | `academy-apply.html` | فورم تقديم — multi-step |
| 27 | `assets/js/pages/academy-apply.js` | نفس المسار | منطق الفورم + validation + submit |
| 28 | `login.html` | `login.html` | **محتاج تحديث للتصميم الجديد** — كان Navy+Gold قديم |
| 29 | `assets/js/pages/login.js` | نفس المسار | **محتاج تحديث** — يظهر اسم اللجنة والنقيب |
| 30 | `index.html` (Splash) | `index.html` | splash screen جديد بـ neon |
| 31 | `assets/js/pages/splash.js` | نفس المسار | منطق الـ splash + redirect |
| 32 | `404.html` | `404.html` | صفحة 404 بالتصميم الجديد |

## المرحلة 2 — UI Components (5 ملفات)

| # | الملف | ملاحظات |
|---|-------|---------|
| 33 | `assets/js/ui/sidebar.js` | Sidebar للأدمن/البوابة — **محتاج تحديث** للـ neon |
| 34 | `assets/js/ui/modal.js` | Modal — **محتاج تحديث** للـ neon |
| 35 | `assets/js/ui/toast.js` | Toast — **محتاج تحديث** للـ neon |
| 36 | `assets/js/ui/dropdown.js` | Dropdown — **محتاج تحديث** للـ neon |
| 37 | `assets/js/ui/table.js` | Data table — **محتاج تحديث** للـ neon |

## المرحلة 3 — لوحة الإدارة (33 شاشة)

```
admin/index.html (Dashboard)
admin/settings/index.html + themes.html + labels.html + workflow.html + security.html + ratings.html + certificates.html + backup.html
admin/users/index.html + requests.html + roles.html + permissions.html
admin/branches/index.html + add.html + edit.html
admin/academies/index.html + add.html + edit.html + details.html + ratings.html
admin/certificates/index.html + add.html + edit.html + revoke.html
admin/requests/index.html + details.html
admin/union-courses/index.html + add.html + edit.html
admin/reports/index.html
admin/activities.html
admin/login-logs.html
```

**+ JS لكل شاشة في `assets/js/pages/admin/`**

## المرحلة 4 — بوابة الأكاديمية (8 شاشات)

```
portal/index.html (Dashboard)
portal/certificates/index.html + add.html + edit.html
portal/reports.html
portal/profile.html
portal/application.html
portal/courses.html
```

## المرحلة 5 — بوابة الفرع (4 شاشات)

```
branch/index.html
branch/users.html
branch/academies.html
branch/certificates.html
```

---

# 🔧 تاسعاً: التكامل بين الملفات (مهم جداً)

## ترتيب التحميل في `<head>` (كل الصفحات)

```html
<head>
  <!-- 1. Settings Defaults -->
  <script src="assets/js/settings-defaults.js"></script>

  <!-- 2. Config -->
  <script src="assets/js/config.js"></script>

  <!-- 3. Themes (FOUC prevention) -->
  <script src="assets/js/themes-data.js"></script>
  <script src="assets/js/theme.js"></script>

  <!-- 4. App Settings + Labels -->
  <script src="assets/js/app-settings.js"></script>
  <script src="assets/js/labels.js"></script>

  <!-- 5. Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Alexandria:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">

  <!-- 6. CSS -->
  <link rel="stylesheet" href="assets/css/theme.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/components.css">
  <link rel="stylesheet" href="assets/css/pages.css">
</head>
```

## ترتيب التحميل في نهاية `<body>`

```html
<body>
  <!-- المحتوى -->

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="assets/js/supabase-client.js"></script>
  <script src="assets/js/utils.js"></script>
  <script src="assets/js/icons.js"></script>
  <script src="assets/js/permissions.js"></script>
  <script src="assets/js/session.js"></script>
  <script src="assets/js/auth-guard.js"></script>
  <script src="assets/js/app-title.js"></script>
  <script src="assets/js/realtime.js"></script>
  <script src="assets/js/ui/header.js"></script>
  <script src="assets/js/ui/modal.js"></script>
  <script src="assets/js/ui/toast.js"></script>
  <script src="assets/js/ui/dropdown.js"></script>
  <script src="assets/js/security.js"></script>
  <script src="assets/js/pages/[page-name].js"></script>
</body>
```

## الفرق بين `home.html` والصفحات التانية

| الصفحة | فيها navbar مدمج؟ | بتستخدم `header.js`؟ |
|--------|-------------------|---------------------|
| `home.html` | ✅ مدمج (inline) | ❌ لأ |
| `verify.html` | ❌ | ✅ `<div id="headerContainer">` |
| `student.html` | ❌ | ✅ |
| `academies.html` | ❌ | ✅ |
| `track.html` | ❌ | ✅ |
| `academy-details.html` | ❌ | ✅ |
| `academy-apply.html` | ❌ | ✅ |
| `login.html` | ❌ | ❌ (مفيش navbar) |

---

# 🎯 عاشراً: الملف التالي المطلوب

## ⏳ الملف التالي: `student.html` + `assets/js/pages/student.js`

### `student.html` — المتطلبات
- ✅ نفس تصميم `verify.html` (navbar via header.js)
- ✅ hero + search card (بالرقم القومي 14 رقم)
- ✅ loading + error + result
- ✅ profile card + certificates list
- ✅ CV builder button
- ✅ print styles

### `student.js` — المتطلبات
- ✅ بحث بـ national_id (14 رقم)
- ✅ إخفاء الرقم القومي في profile (`********1234`)
- ✅ ربط `certificates` table
- ✅ grade class mapping (excellent / very-good / good / pass / fail)
- ✅ CV builder (html2pdf أو print)
- ✅ **ممنوع** تخزين national_id في localStorage / URL / console
- ✅ `search_logs` بـ hash فقط

---

# 🚨 حادي عشر: مشاكل حرجة اتحلت (لا ترجعها)

## 1. `header.js` القديم كان فيه `?.` → SyntaxError
- **الحل**: `header.js` V5 كامل ES5-safe (بدون `?.` ولا `??` ولا `=>`)

## 2. `config.js` و `supabase-client.js` كانوا بيرموا `console.error` كتير
- **الحل**: نسخة silent — بتشتغل بـ fallbacks بدون أي console output

## 3. `themes-data.js` القديم كان فيه 17 theme بألوان متشابهة
- **الحل**: V5 بـ 8 themes كل واحد له accent مختلف + accent-2 مختلف

## 4. `theme.js` القديم كان بيستخدم `--primary` (نظام قديم)
- **الحل**: V3 بيستخدم `--accent` + `--accent-2` (متوافق مع `themes.css`)

## 5. `logo.svg` كان 404
- **الحل**: موجود في `assets/images/logo.svg` (SVG بسيط بـ Cairo + النون)

## 6. `home.html` navbar مش ظاهر
- **الحل**: `home.html` فيه navbar مدمج (مش `header.js`)، بيظهر مباشرة

## 7. الصفحات التانية كانت فاضية
- **الحل**: `header.js` بيعرض فوراً حتى لو auth failed

---

# 🎨 ثاني عشر: قواعد التصميم للأجيال الجاية

عند بناء أي صفحة جديدة، التزم بالتالي:

## 1. ابدأ من `verify.html` كـ template
- فيه كل الأنماط: hero, search, loading, error, result, info
- غير المحتوى والـ logic بس

## 2. استخدم `pages.css` classes
- `.navbar`, `.section`, `.section-head`, `.section-title`, `.section-desc`
- `.hero`, `.hero-inner`, `.hero-content`, `.hero-title`, `.gradient-text`
- `.btn`, `.btn-primary`, `.btn-outline`, `.btn-lg`
- `.card`, `.card-body`, `.badge`, `.badge-accent`

## 3. ألوان
- استخدم `var(--accent)` / `var(--accent-2)` — **ممنوع** hardcode
- `rgba(var(--accent-rgb), 0.15)` للـ soft backgrounds
- `var(--glow-accent)` للـ glow effects

## 4. Radius
- `var(--radius-md)` = 12px للـ cards
- `var(--radius-lg)` = 16px للـ hero cards
- `var(--radius-full)` = 100px للـ badges

## 5. Responsive
- mobile-first: base = mobile، إضافات للـ larger screens
- `@media (min-width: 640px)`, `@media (min-width: 1024px)`
- `env(safe-area-inset-*)` للـ notch
- touch targets ≥ 44px

## 6. Animations
- `fadeUp` للـ cards المعروضة
- `fadeIn` للـ state changes
- `shine` للـ gradient text
- `float` للـ orbs
- `pulse` للـ dot-pulse
- يحترم `prefers-reduced-motion`

---

# 📝 ثالث عشر: Seed Data الموجود

## في `seed.sql`:
- ✅ 27 محافظة مصرية (بأكواد، أسماء عربي/إنجليزي، regions)
- ✅ 6 تصنيفات أكاديميات
- ✅ 8 themes في DB (نفس اللي في `themes-data.js`)
- ✅ 13 settings groups
- ✅ ~65 label (common, auth, home, verify, student, track, admin, portal, branch, errors, notifications, nav, pages)
- ✅ ~35 permission entry (super_admin, committee_head, branch_president, academy_owner)

## الـ Default Theme في DB:
```json
{
  "theme": {
    "default_theme": "neon-dark",
    "allow_user_override": true,
    "fade_transition_ms": 200
  }
}
```

## الـ Splash Config (في DB):
```json
{
  "splash": {
    "enabled": true,
    "min_duration_ms": 2200,
    "max_duration_ms": 4500,
    "loading_texts": ["جاري التحميل...", "تحضير المنصة...", "مرحباً بك..."],
    ...
  }
}
```

---

# 🚀 رابع عشر: طريقة المتابعة في شات جديد

## الرسالة الأولى (الصقها)

```
مرحباً، أنا بطور مشروع ITWS Platform (منصة نقابة تكنولوجيا المعلومات).

دي وثيقة التسليم الكاملة:
[الصق هذه الوثيقة كاملة]

الحالة الحالية:
- آخر ملف اتبعت: verify.html + verify.js
- الملف التالي المطلوب: student.html + student.js

القواعد الثابتة:
1. بدون إيموجي (SVG فقط)
2. مسارات نسبية (مفيش / في البداية)
3. Cairo + Alexandria + JetBrains Mono فقط
4. كل حاجة من settings/labels (مفيش hardcode)
5. الثيم الافتراضي: neon-dark
6. 8 themes بـ accent + accent-2
7. ES5-safe (بدون ?. ولا ?? ولا =>)
8. security.js (deterrent) فعال على كل صفحة

ابعتلي student.html + student.js
```

## بعد كل ملف:
- **لو تمام**: قول "اللي بعده"
- **لو فيه مشكلة**: اشرح إيه اللي حصل
- **لو محتاج تعديل**: قول "عدل كذا"

---

# 📊 خامس عشر: Checklist قبل النشر النهائي

```
□ كل الملفات مرفوعة على GitHub
□ config.js فيه SUPABASE_URL + SUPABASE_ANON_KEY الصح
□ schema.sql + rls-policies.sql + seed.sql اتنفذوا في Supabase
□ لا يوجد Service Role Key في أي ملف HTML/JS
□ .env مش مرفوع على GitHub (.gitignore شغال)
□ RLS policies مفعّلة على كل الجداول
□ كل اللينكات نسبية (مفيش / في البداية)
□ مفيش إيموجي في أي ملف
□ Cairo + Alexandria + JetBrains Mono في كل الصفحات
□ الثيم الافتراضي neon-dark
□ اسم النقابة واللوجو يظهروا في التبويب (app-title.js)
□ Theme picker شغال (8 ثيمات)
□ security.js فعال (F12/copy/right-click blocked)
□ كل [data-setting] attributes تتعمر
□ Realtime شغال على settings/academies/certificates
□ mobile responsive على 375px
□ Console نظيف (مفيش errors حمراء)
```

---

# 🎯 سادس عشر: ملاحظات مهمة

## 1. الـ Design System
**الـ Design System الحالي = Neon System** (من `themes.css` اللي المستخدم بعته). **مش** Navy+Gold اللي كان في ردود سابقة. أي صفحة جديدة لازم تتبع الـ neon system.

## 2. الـ Security is Deterrent ONLY
`security.js` **مش أمان حقيقي** — بيبطئ المستخدم العادي فقط. الحماية الحقيقية = RLS + Rate limiting على Supabase.

## 3. الـ AI Assistant
المستخدم طلب "AI يشتغل على المنصة" لكن **مفيش ملف AI اتبعت لسه**. لو المطلوب:
- Chatbot عائم
- AI search
- Voice assistant
- AI suggestions

محتاجين نتفق على التفاصيل الأول.

## 4. الـ Page-Specific CSS
بعض الصفحات محتاجة CSS مخصص inline (زي `home.html` و `verify.html`). لكن الأساس من `pages.css` + `components.css`.

## 5. الـ Realtime Updates
كل صفحة بتشترك على الجداول اللي بتقرأ منها **بس** — عبر `window.Realtime.subscribe(table, callback, options)`.

## 6. الـ Multi-Language
المنصة دلوقتي **عربي فقط**. لو محتاج إنجليزي، `labels` table عنده `en_value` لكن مش مستخدم في UI.

---

# ✅ خلاصة سريعة

1. **Project**: منصة نقابة تكنولوجيا المعلومات — **Vanilla JS + Supabase** (مش React)
2. **Design**: Neon system — **8 themes** بـ `--accent` + `--accent-2`
3. **Fonts**: Cairo + Alexandria + JetBrains Mono
4. **Auth**: Supabase Auth + RLS
5. **Security**: Deterrent layer (F12/copy/right-click)
6. **Done**: 4 CSS + 8 JS + 2 HTML + 3 SQL (17 ملف)
7. **Pending**: 15 ملف صفحات + 5 UI + 33 Admin + 8 Portal + 4 Branch + 3 Splash/404 = **68 ملف**
8. **Next**: `student.html` + `student.js`
9. **Base Path**: `/academymangment/`
10. **Default Theme**: `neon-dark`

---

**آخر تحديث**: بعد إرسال `verify.html` + `verify.js`
**التالي**: `student.html` + `student.js`

---

انتهت وثيقة التسليم. الصقها في شات جديد وقول **"ابعت student.html + student.js"** وهنكمل من غير أي لبس.
