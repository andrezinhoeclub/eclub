/* App do Promoter E-CLUB — "motor" que deixa o celular instalar a tela
   promoter.html como aplicativo.
   Ele NÃO guarda cópia da tela: sempre busca a versão nova no site. Por isso,
   quando o promoter.html for atualizado no GitHub, o app do promoter já abre
   atualizado, sem precisar baixar nada de novo.
   Só cuida da abertura da tela do Promoter; listas, banco e Supabase passam
   direto, sem mexer em nada. */
const PAGINA_SEM_INTERNET = `<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>E-CLUB Promoter</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box">
<div><p style="font-size:44px;margin:0 0 12px">📶</p>
<p style="font-size:22px;font-weight:900;margin:0 0 10px">Sem internet</p>
<p style="font-size:17px;color:#bbb;margin:0 0 24px;line-height:1.5">Ligue o Wi-Fi ou os dados móveis<br>e toque no botão abaixo.</p>
<button onclick="location.reload()" style="font-size:18px;font-weight:900;padding:16px 28px;border-radius:999px;border:0;background:#e3b94e;color:#141414">TENTAR DE NOVO</button></div>
</body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.mode !== "navigate") return; // só a abertura da tela
  e.respondWith(
    fetch(req).catch(() => new Response(PAGINA_SEM_INTERNET, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }))
  );
});
