import fs from 'node:fs';
import path from 'node:path';
import LegacyApp from '../../../components/LegacyApp';

const html = fs.readFileSync(path.join(process.cwd(), 'content', 'resources.html'), 'utf8');
const scripts = [{"src": "/apps/resources.js"}];

export default function Page() {
  return <LegacyApp html={html} scripts={scripts} />;
}
