// recados.js — v1.0 — mural de recados do próprio membro
(async function () {
  'use strict';
  const { sb, $, moldura, exigirMembro } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'recado');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');

  window.FEED.recados($('mural'), eu.id, eu, { meu: true });
  await sb.rpc('vi_meus_recados');
  if (window.BASE.avisos) window.BASE.avisos();
})();
