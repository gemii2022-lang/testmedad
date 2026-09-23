import './app.css';

export const metadata = { title: "نظام الإقرار الإلكتروني" };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
