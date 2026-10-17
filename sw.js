// Service worker: permite abrir la app sin señal (también al escanear un QR).
// Si cambias index.html, sube el número de versión para que los teléfonos actualicen.
const VERSION = 'tableros-esm-v7';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  './favicon.png', './logo-globo.png', './logo-geovita.png',
  './lib/jsQR.js', './lib/qrcode.js', './lib/jspdf.umd.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const conTiempo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // El servidor (Apps Script) y el generador de QR siempre van directo a la red
  if (/(^|\.)google\.com$|googleusercontent\.com$|quickchart\.io$/.test(url.hostname)) return;

  // Páginas (incluye abrir el link del QR ?id=...): red con 4 s de espera; si no hay señal, copia guardada
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const r = await conTiempo(fetch(req), 4000);
        if (r.ok) c.put('./index.html', r.clone());
        return r;
      } catch (err) {
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Resto de archivos: primero la copia guardada
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok && url.origin === location.origin) {
        (await caches.open(VERSION)).put(req, r.clone());
      }
      return r;
    } catch (err) { return Response.error(); }
  })());
});
