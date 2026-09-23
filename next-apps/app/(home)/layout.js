export const metadata = { title: 'التطبيقات' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f6f4ee' }}>{children}</body>
    </html>
  );
}
