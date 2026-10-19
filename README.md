markdown
# 🏛️ منصة نقابة تكنولوجيا المعلومات والبرمجيات

<div align="right">

منصة رسمية متكاملة **لتوثيق الشهادات التدريبية** و**اعتماد الأكاديميات** تحت مظلة **نقابة تكنولوجيا المعلومات والبرمجيات** — **لجنة التحول الرقمي والتدريب**.

النظام مبني بالكامل بـ **HTML + Vanilla JavaScript + Supabase**، بدون build step، ويعمل مباشرة من أي static host.

</div>

---

## 📋 المحتويات

- [نظرة عامة](#-نظرة-عامة)
- [المميزات الرئيسية](#-المميزات-الرئيسية)
- [التقنيات المستخدمة](#-التقنيات-المستخدمة)
- [الهوية البصرية](#-الهوية-البصرية)
- [هيكل المشروع](#-هيكل-المشروع)
- [البدء السريع](#-البدء-السريع)
- [إعداد Supabase](#-إعداد-supabase)
- [الأدوار والصلاحيات](#-الأدوار-والصلاحيات)
- [نظام الثيمات](#-نظام-الثيمات)
- [بيئة التطوير](#-بيئة-التطوير)
- [النشر](#-النشر)
- [الأمان](#-الأمان)
- [الترخيص](#-الترخيص)

---

## 🎯 نظرة عامة

المنصة بتحل مشكلة **الشهادات المزورة** و**الأكاديميات غير المعتمدة** في مصر من خلال:

1. **سجل مركزي** لكل شهادة تصدرها أكاديمية معتمدة من النقابة
2. **نظام اعتماد رسمي** للأكاديميات (تقديم → مراجعة → زيارة → اعتماد → قرار مختوم)
3. **تحقق فوري** من صحة أي شهادة عبر الكود أو الرقم القومي
4. **توليد CV احترافي** لكل متدرب تلقائياً من شهاداته
5. **لوحة تحكم حية** للنقابة بمؤشرات لحظية

### المشكلة اللي بيحلها

| المشكلة | الحل |
|---------|------|
| شهادات مزورة في السوق | كود فريد + QR + ختم رقمي |
| جهات التوظيف مش عارفة تتحقق | صفحة تحقق عامة + رابط دائم |
| أكاديميات غير معتمدة | نظام اعتماد رسمي بمراحل |
| ضياع شهادات الطالب | صفحة الطالب بالرقم القومي |
| مفيش بيانات مركزية | لوحة تحكم للنقابة |

---

## ✨ المميزات الرئيسية

### 🌐 الموقع العام (للزوار — بدون تسجيل دخول)

- ✅ **بحث فوري** عن شهادة بالكود أو بالرقم القومي
- ✅ **دليل الأكاديميات** المعتمدة مع فرز بالتصنيف والمحافظة
- ✅ **صفحة الطالب** العامة (كل شهاداته في مكان واحد)
- ✅ **تحميل CV احترافي** بصيغة PDF
- ✅ **تقديم طلب اعتماد** أكاديمية (فورم متعدد الخطوات)
- ✅ **متابعة حالة الطلب** (Tracker شفاف لكل مرحلة)
- ✅ **عرض عدد الزوار الحاليين** بشكل حي

### 👨‍💼 لوحة الإدارة (للنقابة)

- ✅ **إحصائيات حية** (أكاديميات، شهادات، زوار، مستخدمين متصلين)
- ✅ **Kanban Board** لطلبات الاعتماد (سحب وإفلات بين المراحل)
- ✅ **إدارة الأكاديميات** (إضافة، تعديل، تصنيف، اعتماد)
- ✅ **إدارة الشهادات** (إضافة، تعديل، توليد PDF)
- ✅ **إدارة التصنيفات** (أمن سيبراني، تطوير، ذكاء اصطناعي، إلخ)
- ✅ **تقارير مفصلة** + رسوم بيانية + تصدير
- ✅ **سجل النشاطات** (كل حركة في النظام)
- ✅ **إدارة المستخدمين** (صلاحيات متعددة)

### ⚙️ إعدادات النقيب العام

- ✅ **تغيير كل مسمى** في المنصة (اسم النقابة، اللجنة، رئيس اللجنة، النقيب...)
- ✅ **رفع اللوجو والختم** للنقابة (يظهران في التبويب والشهادات)
- ✅ **إدارة الثيمات** (إضافة، تعديل، تحديد الافتراضي)
- ✅ **تعديل كل نص** في المنصة (label by label)
- ✅ **مسميات مراحل الاعتماد** (تخصيص كل مرحلة)
- ✅ **إعدادات الأمان** (max login attempts، session timeout)

### 🎨 نظام الثيمات

- ✅ **6 ثيمات جاهزة** (الافتراضي = **وطني داكن** 🇪🇬)
- ✅ **الزائر يختار** ثيمه المحلي → يُحفظ في `localStorage`
- ✅ **النقيب يحدد الافتراضي** → ينطبق على كل زائر جديد
- ✅ **تغيير فوري** (Real-time) لما النقيب يغير الافتراضي
- ✅ **FOUC Prevention** (مفيش وميض ألوان عند التحميل)

### 🤖 الخدمات الذكية (AI)

- ✅ **توليد CV احترافي** بمعايير عالمية من شهادات الطالب
- ✅ **OCR** لقراءة السجل التجاري والبطاقة الضريبية
- ✅ **كشف تناقضات** في طلبات الاعتماد

### 🔒 الأمان

- ✅ **RLS Policies** على كل جدول في Supabase
- ✅ **حماية المسارات** حسب الدور
- ✅ **تسجيل محاولات الدخول** (ناجحة وفاشلة)
- ✅ **تسجيل كل نشاط** (من عمل إيه وامتى ومن أي IP)
- ✅ **Service Role Key** ممنوع في client-side

---

## 🛠️ التقنيات المستخدمة

| الفئة | التقنية | السبب |
|-------|---------|-------|
| **Frontend** | HTML5 + Vanilla JavaScript | سريع، بسيط، بدون build step |
| **Styling** | CSS3 + CSS Variables | نظام ثيمات مرن |
| **Font** | **Cairo فقط** | واضح، مريح للعربية، خط رسمي |
| **Database** | Supabase (PostgreSQL) | مجاني، real-time، RLS مدمج |
| **Auth** | Supabase Auth | متكامل مع RLS |
| **Storage** | Supabase Storage | للصور والمستندات |
| **Realtime** | Supabase Realtime | للعدادات الحية |
| **AI** | Groq API | مجاني، سريع جداً |
| **OCR** | OCR.space | مجاني، يدعم العربية |
| **PDF** | @react-pdf/renderer / html2pdf | جودة عالية |
| **Charts** | Chart.js | خفيف، جميل |
| **Icons** | Lucide / Emoji | رسمي، نظيف |

---

## 🎨 الهوية البصرية

### الألوان الافتراضية — الثيم الوطني الداكن 🇪🇬

النظام يأتي بثيم افتراضي يحمل **هوية وطنية مصرية**:

| اللون | القيمة | الاستخدام |
|-------|--------|-----------|
| **الأحمر (علم مصر)** | `#CE1126` | Primary — أزرار، روابط، تفاصيل |
| **الأسود (علم مصر)** | `#0A0E14` | Background — الخلفية الأساسية |
| **الأبيض (علم مصر)** | `#F8FAFC` | Text — النصوص |
| **الأسود الرمادي** | `#131820` | Surface — البطاقات |

### الخط

**Cairo** فقط — من Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
الثيمات المتاحة (6)
وطني داكن 🇪🇬 — الافتراضي (أحمر + أسود + أبيض)

وطني فاتح — نفس الهوية بخلفية بيضاء

تكنولوجي — أزرق + سماوي

رسمي فاتح — أزرق ملكي + ذهبي

زمردي — أخضر زمردي داكن

ليلي ذهبي — أسود + ذهبي ملكي

📁 هيكل المشروع
text
itws-platform/
│
├── index.html                    ← صفحة البداية (Splash + Redirect)
├── home.html                     ← الصفحة الرئيسية
├── verify.html                   ← التحقق من شهادة
├── student.html                  ← صفحة الطالب + CV
├── login.html                    ← تسجيل الدخول
├── academies.html                ← دليل الأكاديميات
├── academy-details.html          ← تفاصيل أكاديمية
├── academy-apply.html            ← فورم تقديم أكاديمية
├── track.html                    ← متابعة طلب الاعتماد
│
├── portal/                       ← بوابة الأكاديميات
│   ├── index.html
│   ├── application.html
│   ├── branches.html
│   ├── courses.html
│   ├── certificates.html
│   └── profile.html
│
├── admin/                        ← لوحة الإدارة
│   ├── index.html                ← Dashboard (إحصائيات حية)
│   ├── academies.html
│   ├── academy-add.html
│   ├── academy-edit.html
│   ├── academy-details.html
│   ├── categories.html
│   ├── certificates.html
│   ├── certificate-add.html
│   ├── certificate-edit.html
│   ├── certificate-view.html
│   ├── requests.html             ← Kanban Board
│   ├── request-details.html
│   ├── reports.html
│   ├── activities.html
│   ├── users.html
│   ├── login-logs.html
│   └── settings/
│       ├── index.html
│       ├── themes.html
│       ├── texts.html
│       ├── workflow.html
│       ├── security.html
│       └── backup.html
│
├── setup.html                    ← التهيئة الأولى (مرة واحدة فقط)
│
├── assets/
│   ├── css/
│   │   ├── theme.css             ← متغيرات الثيم
│   │   ├── base.css              ← Reset + Typography
│   │   ├── components.css        ← Buttons, Cards, Forms
│   │   ├── loader.css            ← Boot Loader
│   │   └── layout.css            ← Header, Sidebar, Grid
│   │
│   ├── js/
│   │   ├── config.js             ← إعدادات Supabase (Publishable فقط)
│   │   ├── supabase-client.js    ← التهيئة
│   │   ├── themes-data.js        ← بيانات الثيمات الستة
│   │   ├── theme.js              ← نظام الثيمات + FOUC prevention
│   │   ├── utils.js              ← أدوات مساعدة
│   │   ├── session.js            ← Heartbeat للمتصليين
│   │   ├── auth-guard.js         ← حماية الصفحات
│   │   ├── app-title.js          ← العنوان واللوجو في تبويب المتصفح
│   │   ├── ui/
│   │   │   ├── header.js         ← Header مشترك للصفحات العامة
│   │   │   ├── sidebar.js        ← Sidebar للـ Admin/Portal
│   │   │   └── modal.js          ← Modals (open/confirm/alert/prompt)
│   │   └── pages/
│   │       ├── home.js
│   │       ├── verify.js
│   │       ├── student.js
│   │       ├── academy-apply.js
│   │       ├── admin/
│   │       │   ├── dashboard.js
│   │       │   ├── academies.js
│   │       │   ├── certificates.js
│   │       │   ├── requests.js
│   │       │   ├── users.js
│   │       │   └── settings.js
│   │       └── portal/
│   │           ├── dashboard.js
│   │           ├── application.js
│   │           └── branches.js
│   │
│   └── images/
│       ├── logo.svg              ← لوجو النقابة
│       ├── logo-white.svg        ← نسخة بيضاء
│       └── stamp.png             ← ختم النقابة
│
├── supabase/
│   ├── schema.sql                ← جداول قاعدة البيانات
│   ├── rls-policies.sql          ← سياسات الأمان
│   └── seed.sql                  ← البيانات الأولية (ثيمات + تصنيفات)
│
├── .gitignore
├── README.md                     ← هذا الملف
└── .env.example                  ← نموذج للمفاتيح (بدون قيم حقيقية)
🚀 البدء السريع
المتطلبات
متصفح حديث (Chrome, Edge, Firefox, Safari)

حساب Supabase مجاني (supabase.com)

خادم محلي (Live Server extension في VS Code، أو Python)

1. استنساخ المشروع
bash
git clone https://github.com/YOUR_USERNAME/itws-platform.git
cd itws-platform
2. تشغيل خادم محلي
الطريقة الأسهل (VS Code):

ثبّت إضافة Live Server

افتح index.html كليك يمين → Open with Live Server

الطريقة التانية (Python):

bash
python -m http.server 8000
الطريقة التالتة (Node.js):

bash
npx serve
3. افتح المتصفح
text
http://localhost:8000
يجب أن ترى شاشة ترحيب بالثيم الوطني الداكن، وبعدها يتم توجيهك تلقائياً.

🗄️ إعداد Supabase
1. إنشاء مشروع
افتح supabase.com/dashboard

اضغط New Project

اختار Organization، اسم المشروع، database password قوي

اختار Region قريب من مصر (Frankfurt أو Ireland)

2. تشغيل الـ SQL Scripts
افتح SQL Editor في Supabase، ونفّذ الملفات دي بالترتيب:

text
1. supabase/schema.sql          ← إنشاء الجداول
2. supabase/rls-policies.sql    ← سياسات الأمان
3. supabase/seed.sql            ← البيانات الأولية (ثيمات + تصنيفات)
3. الحصول على المفاتيح
Settings → API → انسخ:

الحقل	القيمة
Project URL	https://xxxxx.supabase.co
Anon / Publishable Key	sb_publishable_...
4. تحديث assets/js/config.js
javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_...';
⚠️ لا تحط Service Role Key هنا أبداً — ده مخصص للسيرفر فقط.

5. التهيئة الأولى (مرة واحدة)
افتح setup.html

أدخل بيانات السوبر أدمن

اضغط تهيئة النظام

⚠️ بعد التهيئة، احذف setup.html أو اقفله لحماية نفسك.

👥 الأدوار والصلاحيات
الصلاحية	زائر	committee_manager	admin	super_admin
التحقق من شهادة	✅	✅	✅	✅
البحث عن أكاديمية	✅	✅	✅	✅
تحميل CV من رقم قومي	✅	✅	✅	✅
إضافة شهادة	❌	✅	✅	✅
تعديل شهادة	❌	❌	✅	✅
حذف شهادة	❌	❌	❌	✅
اعتماد أكاديمية	❌	❌	✅	✅
إدارة التصنيفات	❌	❌	✅	✅
إدارة المستخدمين	❌	❌	❌	✅
إدارة الثيمات والإعدادات	❌	❌	❌	✅
الوصول لسجلات الدخول	❌	❌	❌	✅
الأدوار الأربعة:

super_admin — النقيب أو المسؤول التقني (كل الصلاحيات)

admin — موظف النقابة (إدارة + اعتماد، بدون حذف)

committee_manager — عضو اللجنة (مراجعة وقراءة + إضافة شهادات)

user — مستخدم عادي (قراءة فقط)

🎨 نظام الثيمات
كيف يعمل؟
text
1. theme.js يقرأ localStorage
   ├─ فيه ثيم؟ → يطبقه فوراً (قبل CSS)
   └─ مفيش؟ → يطبق الافتراضي من themes-data.js

2. بعد DOMContentLoaded → يجيب الافتراضي الحقيقي من Supabase
3. لو النقيب غير الافتراضي → realtime يحدث كل الزوار
للمستخدم العادي:
يفتح أي صفحة → يختار الثيم من الصفحة الرئيسية

الاختيار يُحفظ في localStorage.itws_theme

يفضل معاه على كل الصفحات + كل التبويبات

زر "استعادة الافتراضي" بيرجعه للثيم اللي النقيب حدده

للنقيب:
من /admin/settings/themes → يغير الثيم الافتراضي

التغيير ينطبق فوراً على كل الزوار الجدد

الزوار اللي عندهم ثيم محلي مش بيتأثروا (احترام اختيارهم)

منع FOUC (وميض الألوان):
html
<!-- في <head>، قبل أي CSS -->
<script src="assets/js/config.js"></script>
<script src="assets/js/themes-data.js"></script>
<script src="assets/js/theme.js"></script>
<link rel="stylesheet" href="assets/css/theme.css">
theme.js يطبق الألوان على documentElement.style قبل ما CSS يتحمل → مفيش وميض.

💻 بيئة التطوير
اصطلاحات التسمية
النوع	النمط	مثال
ملفات JS	kebab-case.js	auth-guard.js
ملفات CSS	kebab-case.css	components.css
ملفات HTML	kebab-case.html	academy-details.html
الدوال	camelCase	getCurrentUser()
المتغيرات	camelCase	currentUser
الثوابت	UPPER_SNAKE_CASE	MAX_LOGIN_ATTEMPTS
CSS Variables	--kebab-case	--primary-color
ترتيب تحميل الملفات (في كل صفحة HTML)
html
<head>
  <!-- 1. Theme (BEFORE CSS) -->
  <script src="assets/js/config.js"></script>
  <script src="assets/js/themes-data.js"></script>
  <script src="assets/js/theme.js"></script>
  
  <!-- 2. CSS -->
  <link rel="stylesheet" href="assets/css/theme.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/components.css">
  <link rel="stylesheet" href="assets/css/loader.css">
  <link rel="stylesheet" href="assets/css/layout.css">
</head>
<body>
  <!-- 3. Boot Loader -->
  <div class="theme-boot-loader" id="themeBootLoader">...</div>
  
  <!-- 4. المحتوى -->
  
  <!-- 5. Scripts (في نهاية body) -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="assets/js/supabase-client.js"></script>
  <script src="assets/js/utils.js"></script>
  <script src="assets/js/session.js"></script>
  <script src="assets/js/auth-guard.js"></script>
  <script src="assets/js/app-title.js"></script>
  <script src="assets/js/ui/header.js"></script>
  <script src="assets/js/ui/sidebar.js"></script>
  <script src="assets/js/ui/modal.js"></script>
</body>
🌐 النشر
Netlify (موصى به — مجاني)
ارفع المشروع على GitHub

افتح netlify.com → New Site from Git

اختار الـ repo

Build command: (اتركه فارغ)

Publish directory: .

Deploy

Vercel (بديل — مجاني)
bash
npm i -g vercel
vercel --prod
GitHub Pages (مجاني)
Settings → Pages

Source: main branch → / (root)

احفظ

⚠️ مهم بعد النشر
أضف Domain URL في Supabase → Authentication → URL Configuration → Site URL.

🔒 الأمان
القواعد الذهبية
القاعدة	التطبيق
Service Role Key	❌ ممنوع في client-side نهائياً
Publishable Key	✅ آمن للعرض (الحماية من RLS)
RLS Policies	✅ مفعّلة على كل جدول
HTTPS	✅ إلزامي في production
Session Timeout	30 دقيقة (قابل للتعديل)
Max Login Attempts	5 محاولات
قبل النشر، تأكد من:
□ .env مش مرفوع على GitHub
□ setup.html محذوف أو مقفول
□ RLS Policies مطبقة
□ HTTPS مفعّل
□ Domain URL مضاف في Supabase
□ Super Admin password قوي
□ Backup strategy جاهزة
متغيرات البيئة
bash
# ⚠️ في assets/js/config.js فقط
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...

# ⚠️ للسيرفر فقط (Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
GROQ_API_KEY=gsk_...
OCR_SPACE_API_KEY=...
📞 التواصل
القناة	المعلومة
البريد الإلكتروني	info@itws.eg
الموقع	https://itws.eg
GitHub	https://github.com/itws-eg
📄 الترخيص
<div align="right">
هذا المشروع مملوك لـ نقابة تكنولوجيا المعلومات والبرمجيات — لجنة التحول الرقمي والتدريب.

جميع الحقوق محفوظة © 2026

</div>
<div align="center">
صُنع بـ ❤️ في مصر

🇪🇬

نقابة تكنولوجيا المعلومات والبرمجيات

</div> ```
