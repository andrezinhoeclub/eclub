// novidades.js — v1.0 — página de novidades (arte + atalhos)
(async function () {
  'use strict';
  const { $, moldura, exigirMembro } = window.BASE;
  const { perfil, assinatura } = await exigirMembro({ semAssinatura: true });
  moldura(perfil, assinatura, '');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
})();
