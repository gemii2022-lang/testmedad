=== SQL لإنشاء الجداول في Supabase ===

CREATE TABLE IF NOT EXISTS schools (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  declaration_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS declarations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  national_id text NOT NULL,
  id_image text,
  phone text NOT NULL,
  email text NOT NULL,
  school_id uuid REFERENCES schools(id),
  school_name text,
  declaration_text text,
  agreed boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- إذا كان الجدول موجوداً بالفعل عندك، شغّل هذا السطر فقط لإضافة العمود الجديد:
-- ALTER TABLE declarations ADD COLUMN IF NOT EXISTS id_image text;

CREATE TABLE IF NOT EXISTS settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_schools" ON schools FOR SELECT USING (true);
CREATE POLICY "admin_schools" ON schools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_declarations" ON declarations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_settings" ON settings FOR ALL USING (true) WITH CHECK (true);
