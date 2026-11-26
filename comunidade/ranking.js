// ranking.js — v1.0 — Ranking CL: fotos e membros mais curtidos (semana, mês, sempre)
(async function () {
  'use strict';
  const { sb, $, moldura, exigirMembro, links, fotoProtegida } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'ranking');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };

  let aba = 'fotos', per = 'semana';
  document.querySelectorAll('#abas button').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.a; document.querySelectorAll('#abas button').forEach(x => x.classList.toggle('sel', x === b)); carregar();
  }));
  document.querySelectorAll('#per .chip').forEach(c => c.addEventListener('click', () => {
    per = c.dataset.p; document.querySelectorAll('#per .chip').forEach(x => x.classList.toggle('sel', x === c)); carregar();
  }));

  async function carregar() {
    const lista = $('lista'); lista.innerHTML = '';
    if (aba === 'fotos') {
      const { data } = await sb.rpc('ranking_fotos', { p_periodo: per });
      if (!data || !data.length) { lista.appendChild(el('div', 'cartao suave', 'Ainda não há curtidas neste período.')); return; }
      const urls = await links(data.map(f => f.caminho));
      const grade = el('div', 'rk-grade');
      data.forEach(f => {
        if (!urls[f.caminho]) return;
        const d = el('div', 'rk-f');
        d.appendChild(fotoProtegida(urls[f.caminho], { cortar: true, largura: 360, dono: f.autor }));
        d.appendChild(el('span', 'pos', f.posicao));
        d.appendChild(el('div', 'inf', '❤️ ' + f.curtidas + ' · ' + f.apelido));
        d.addEventListener('click', () => { location.href = 'perfil.html?id=' + encodeURIComponent(f.autor); });
        grade.appendChild(d);
      });
      lista.appendChild(grade);
    } else {
      const { data } = await sb.rpc('ranking_membros', { p_periodo: per });
      if (!data || !data.length) { lista.appendChild(el('div', 'cartao suave', 'Ainda não há curtidas neste período.')); return; }
      data.forEach(m => {
        const a = el('a', 'rk-m'); a.href = 'perfil.html?id=' + encodeURIComponent(m.membro);
        const tx = el('div', 'tx'); tx.append(el('b', null, m.apelido), el('br'), el('small', null, '❤️ ' + m.curtidas + ' curtidas'));
        a.append(el('div', 'pos', m.posicao), tx); lista.appendChild(a);
      });
    }
  }
  carregar();
})();
