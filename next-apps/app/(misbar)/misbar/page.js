import fs from 'node:fs';
import path from 'node:path';
import LegacyApp from '../../../components/LegacyApp';

const html = fs.readFileSync(path.join(process.cwd(), 'content', 'misbar.html'), 'utf8');
const scripts = [{"src": "https://docs.opencv.org/4.x/opencv.js", "async": true}, {"src": "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"}, {"src": "https://cdn.jsdelivr.net/npm/chart.js@4"}, {"src": "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"}, {"src": "/apps/misbar.js"}];

export default function Page() {
  return <LegacyApp html={html} scripts={scripts} />;
}
