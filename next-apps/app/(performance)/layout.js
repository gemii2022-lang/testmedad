import './app.css';

export const metadata = { title: "نظام تقييم الأداء الوظيفي" };
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#1a3a5c' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" />
        <link rel="manifest" href={"data:application/json,{\"name\":\"نظام التقييم\",\"short_name\":\"التقييم\",\"display\":\"standalone\",\"background_color\":\"#1a3a5c\",\"theme_color\":\"#1a3a5c\"}"} />
      </head>
      <body>{children}</body>
    </html>
  );
}
