const isProd = process.env.NODE_ENV === 'production';

// كانت هذه الإعدادات في وسوم <meta> داخل تطبيق الأداء الوظيفي؛ الأفضل أن تكون HTTP headers.
// CSP مفعّلة في الإنتاج فقط لأن وضع التطوير يحتاج eval.
const performanceHeaders = [
  { key: 'Content-Security-Policy', value: "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https: data: blob:; connect-src 'self' https://mpqoumurkrvtusksicaj.supabase.co; frame-ancestors 'none';" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
];

export default {
  async headers() {
    return isProd ? [{ source: '/performance', headers: performanceHeaders }] : [];
  },
};
