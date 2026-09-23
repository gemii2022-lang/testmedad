'use client';
import { useEffect } from 'react';

// يحمّل سكربتات التطبيق الأصلي بالترتيب بعد ظهور الـ HTML، مع حماية من التحميل المزدوج (Strict Mode)
const cache = new Map();

function load({ src, module }) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((resolve) => {
      const el = document.createElement('script');
      el.src = src;
      if (module) el.type = 'module';
      el.onload = () => resolve();
      el.onerror = () => { console.error('Failed to load', src); resolve(); };
      document.body.appendChild(el);
    }));
  }
  return cache.get(src);
}

export default function LegacyApp({ html, scripts }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const s of scripts) {
        if (cancelled) return;
        const p = load(s);
        if (!s.async) await p;
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />;
}
