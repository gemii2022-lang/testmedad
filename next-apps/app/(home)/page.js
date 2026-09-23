export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: 24 }}>
      <h1>التطبيقات</h1>
      <ul style={{ lineHeight: 2.4, fontSize: 18 }}>
        <li><a href="/misbar">مسبار — تصحيح الاختبارات وقراءة OMR</a></li>
        <li><a href="/performance">تقييم الأداء الوظيفي</a></li>
        <li><a href="/masir">المسير — إدارة المدارس</a></li>
        <li><a href="/resources">الموارد — الإقرار الإلكتروني</a></li>
      </ul>
    </main>
  );
}
