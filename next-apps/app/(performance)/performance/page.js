import fs from 'node:fs';
import path from 'node:path';
import LegacyApp from '../../../components/LegacyApp';

const html = fs.readFileSync(path.join(process.cwd(), 'content', 'performance.html'), 'utf8');
const scripts = [{"src": "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"}, {"src": "/apps/performance.js"}];

export default function Page() {
  return <LegacyApp html={html} scripts={scripts} />;
}
