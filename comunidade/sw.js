// sw.js — v1.1 — Comunidade Liberal
// Deixa o site instalável como app. Não guarda páginas nem dados pessoais:
// tudo vem sempre da internet; só a tela "sem conexão" fica salva no aparelho.
const CACHE = 'cl-offline-v1';
const OFFLINE = ['offline.html', 'logo-ouro.png', 'icone-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;          // fotos, banco, chat: direto da internet
  // Páginas sempre conferidas no servidor (no-cache): mudança no site aparece na hora, no app e no navegador
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((r) => r.redirected ? Response.redirect(r.url, 302) : r)
      .catch(() => fetch(e.request).catch(() => caches.match('offline.html')))
  );
});
