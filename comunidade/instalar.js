// instalar.js — v1.0 — tela "Instalar o app"
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const P = window.PWA;
  // Mostra primeiro as instruções do aparelho da pessoa
  const ordem = P.ios ? ['iphone', 'android', 'pc'] : P.android ? ['android', 'iphone', 'pc'] : ['pc', 'android', 'iphone'];
  const lista = $('passos');
  ordem.forEach(id => lista.appendChild($('p-' + id)));
  $('p-' + ordem[0]).open = true;

  function atualizar() {
    const bt = $('bInstalar'), msg = $('mInstalar');
    if (P.instalado) { bt.classList.add('oculto'); msg.textContent = '✓ O app já está instalado neste aparelho. Abra pelo ícone na tela inicial.'; return; }
    if (P.podeInstalar()) { bt.classList.remove('oculto'); msg.textContent = 'Um toque e o ícone aparece na sua tela inicial.'; return; }
    bt.classList.add('oculto');
    msg.textContent = P.ios ? 'No iPhone a instalação é pelo botão Compartilhar do Safari: veja o passo a passo abaixo.'
                            : 'Se o botão não aparecer, siga o passo a passo abaixo para o seu aparelho.';
  }
  $('bInstalar').addEventListener('click', async () => { await P.instalar(); atualizar(); });
  document.addEventListener('pwa-mudou', atualizar);
  atualizar();
  setTimeout(atualizar, 1500);
})();
