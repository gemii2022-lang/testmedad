# Next.js — أربعة تطبيقات

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

| المسار | التطبيق |
|---|---|
| `/misbar` | مسبار (تصحيح OMR) |
| `/performance` | تقييم الأداء الوظيفي |
| `/masir` | المسير (إدارة المدارس) |
| `/resources` | الموارد (الإقرار الإلكتروني) |

- `content/*.html`: محتوى `<body>` الأصلي لكل تطبيق
- `public/apps/*.js`: سكربت كل تطبيق كما هو (يُحمَّل بعد ظهور الصفحة)
- `app/(اسم)/app.css`: CSS كل تطبيق، وكل تطبيق له root layout مستقل حتى لا تتداخل الأنماط
- `supabase/resources-schema.sql`: جداول قاعدة البيانات التي كانت تعليقاً في آخر ملف الموارد
