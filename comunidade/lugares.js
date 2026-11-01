// lugares.js — v1.0 — "Lugares para Avaliar": para avaliar / já avaliados / todos
(async function () {
  'use strict';
  const { sb, $, moldura, exigirMembro, flyer, UFS } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'agenda');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const params = new URLSearchParams(location.search);
  let aba = ['avaliar', 'avaliados', 'todos'].includes(params.get('aba')) ? params.get('aba') : 'avaliar';
  UFS.forEach(u => $('bUf').appendChild(new Option(u, u)));
  $('bUf').value = eu.uf || '';

  window.estrelas = function (nota) {
    const s = el('span', 'estrelas'); const n = Math.round(Number(nota) || 0);
    for (let i = 1; i <= 5; i++) { const x = el('span', i <= n ? null : 'vazia', '★'); s.appendChild(x); }
    return s;
  };

  function item(l) {
    const a = el('a', 'lugar-item'); a.href = 'lugar.html?id=' + l.id;
    const t = el('div', 'txt');
    t.appendChild(el('h3', null, l.nome));
    const n = el('div'); n.appendChild(estrelas(aba === 'avaliados' ? l.minha_nota : l.media));
    n.appendChild(el('span', 'nota-qtd', aba === 'avaliados' ? 'sua nota' : '(' + (l.total || 0) + ')'));
    t.appendChild(n);
    t.appendChild(el('div', 'onde', [l.endereco, l.cidade && (l.cidade + (l.uf ? ' - ' + l.uf : ''))].filter(Boolean).join(' · ')));
    if (aba === 'avaliar' && l.ultima_visita) t.appendChild(el('div', 'onde', 'Você esteve lá em ' + new Date(l.ultima_visita).toLocaleDateString('pt-BR')));
    const th = el('div', 'thumb');
    if (l.foto) { const i = el('img'); i.src = flyer(l.foto); i.alt = ''; i.loading = 'lazy'; th.appendChild(i); }
    else { const i = el('img', 'sem'); i.src = 'logo-ouro.png'; i.alt = ''; th.appendChild(i); }
    a.append(t, th);
    return a;
  }

  let timer;
  async function carregar() {
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('sel', b.dataset.aba === aba));
    $('busca').classList.toggle('oculto', aba !== 'todos');
    const busca = $('bTexto').value.trim().replace(/[%_\\]/g, '');
    const { data, error } = await sb.rpc('lista_lugares', { p_modo: aba, p_uf: aba === 'todos' ? ($('bUf').value || null) : null, p_busca: busca || null });
    const box = $('lista'); box.innerHTML = '';
    if (error) { box.appendChild(el('div', 'cartao', 'Não foi possível carregar.')); return; }
    (data || []).forEach(l => box.appendChild(item(l)));
    if (!(data || []).length) box.appendChild(el('div', 'cartao', aba === 'avaliar'
      ? 'Não há lugares para avaliar. Depois de ir a um evento confirmado, o lugar aparece aqui.'
      : aba === 'avaliados' ? 'Você ainda não avaliou nenhum lugar.' : 'Nenhum lugar encontrado.'));
  }
  document.querySelectorAll('#abas button').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.aba; history.replaceState({}, '', 'lugares.html?aba=' + aba); carregar();
  }));
  $('bUf').addEventListener('change', carregar);
  $('bTexto').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(carregar, 350); });
  carregar();
})();
