// pwa.js — v1.0 — app instalável (páginas sem login: entrar, instalar, início)
(function () {
  'use strict';
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  let pedido = null;
  const ua = navigator.userAgent || '';
  const P = window.PWA = {
    ios: /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && 'ontouchend' in document),
    android: /android/i.test(ua),
    instalado: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
    podeInstalar: () => !!pedido,
    async instalar() {
      if (!pedido) return false;
      pedido.prompt();
      const r = await pedido.userChoice.catch(() => null);
      pedido = null;
      document.dispatchEvent(new Event('pwa-mudou'));
      return r && r.outcome === 'accepted';
    }
  };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; document.dispatchEvent(new Event('pwa-mudou')); });
  window.addEventListener('appinstalled', () => { P.instalado = true; pedido = null; document.dispatchEvent(new Event('pwa-mudou')); });
})();
