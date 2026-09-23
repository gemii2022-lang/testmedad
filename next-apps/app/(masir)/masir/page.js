import fs from 'node:fs';
import path from 'node:path';
import LegacyApp from '../../../components/LegacyApp';

const html = fs.readFileSync(path.join(process.cwd(), 'content', 'masir.html'), 'utf8');
const scripts = [{"src": "/apps/masir.js", "module": true}];

export default function Page() {
  return <LegacyApp html={html} scripts={scripts} />;
}
