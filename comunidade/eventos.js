// eventos.js — v1.0 — lista de eventos, agenda e detalhe com confirmação de presença
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, avatar, flyer, toast } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'agenda');
  $('carregando').classList.add('oculto');

  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  function blocoData(iso) {
    const d = new Date(iso), b = el('div', 'ev-data');
    b.append(el('small', null, DIAS[d.getDay()]), el('b', null, String(d.getDate())), el('span', null, MESES[d.getMonth()]));
    return b;
  }
  const horaTxt = (e) => {
    const d = new Date(e.inicio);
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return dias[d.getDay()] + ', a partir das ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
      (e.fim ? ' até ' + new Date(e.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  };

  // =================== LISTA ===================
  const params = new URLSearchParams(location.search);
  let aba = ['agenda', 'anteriores'].includes(params.get('aba')) ? params.get('aba') : 'proximos';

  async function lista() {
    $('telaDetalhe').classList.add('oculto');
    $('telaLista').classList.remove('oculto');
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('sel', b.dataset.aba === aba));
    const { data } = await sb.rpc('lista_eventos', { p_modo: aba });
    const evs = data || [];
    $('lista').innerHTML = '';
    $('vazio').classList.toggle('oculto', evs.length > 0);
    $('txtVazio').textContent = aba === 'agenda' ? 'Você ainda não confirmou presença em nenhum evento.'
      : aba === 'anteriores' ? 'Nenhum evento anterior.' : 'Nenhum evento marcado por enquanto. Fique de olho!';
    evs.forEach(e => {
      const a = el('a', 'ev-card'); a.href = 'eventos.html?id=' + e.id;
      if (e.capa) { const img = el('img', 'flyer'); img.src = flyer(e.capa); img.alt = e.titulo; img.loading = 'lazy'; a.appendChild(img); }
      else a.appendChild(el('div', 'flyer vazio', '🎉'));
      const linha = el('div', 'ev-linha');
      const info = el('div', 'ev-info');
      info.appendChild(el('div', 'hora', horaTxt(e)));
      const h = el('h3', null, e.titulo);
      if (e.minha) h.appendChild(el('span', 'ev-tag ' + (e.minha === 'talvez' ? 'talvez' : ''), e.minha === 'vou' ? 'Vou' : 'Talvez'));
      info.appendChild(h);
      info.appendChild(el('div', 'onde', [e.organizador, e.local, e.cidade && (e.cidade + (e.uf ? ' . ' + e.uf : ''))].filter(Boolean).join(' · ')));
      info.appendChild(el('div', 'conta', '✅ ' + e.vao + ' vão · 🤔 ' + e.talvez + ' talvez'));
      linha.append(blocoData(e.inicio), info);
      a.appendChild(linha);
      a.addEventListener('click', (ev) => { ev.preventDefault(); history.pushState({}, '', a.href); detalhe(e.id); });
      $('lista').appendChild(a);
    });
  }
  document.querySelectorAll('#abas button').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.aba; history.replaceState({}, '', 'eventos.html' + (aba === 'proximos' ? '' : '?aba=' + aba)); lista();
  }));

  // =================== DETALHE ===================
  let atual = null;
  async function detalhe(id) {
    const { data } = await sb.rpc('evento_detalhe', { p_evento: id });
    const e = data && data[0];
    if (!e) { toast('Evento não encontrado.'); history.replaceState({}, '', 'eventos.html'); lista(); return; }
    atual = e;
    window.scrollTo(0, 0);
    $('telaLista').classList.add('oculto');
    $('telaDetalhe').classList.remove('oculto');
    document.title = e.titulo + ' · ' + window.APP.NOME;
    $('dFlyer').classList.toggle('oculto', !e.capa);
    if (e.capa) $('dFlyer').src = flyer(e.capa);
    $('dData').replaceWith(Object.assign(blocoData(e.inicio), { id: 'dData' }));
    $('dHora').textContent = new Date(e.inicio).toLocaleDateString('pt-BR') + ' · ' + horaTxt(e);
    $('dTitulo').textContent = e.titulo;
    $('dOrg').textContent = e.organizador ? 'Organização: ' + e.organizador : '';
    $('dLocal').innerHTML = '';
    const onde = [e.local, e.endereco, e.cidade && (e.cidade + (e.uf ? ' . ' + e.uf : ''))].filter(Boolean).join(' — ');
    if (onde) {
      $('dLocal').append('📍 ' + onde + ' ');
      const mapa = el('a', null, '(ver no mapa)');
      mapa.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([e.local, e.endereco, e.cidade, e.uf].filter(Boolean).join(', '));
      mapa.target = '_blank'; mapa.rel = 'noopener noreferrer';
      $('dLocal').appendChild(mapa);
    }
    $('dDescricao').textContent = e.descricao || '';
    $('dLink').classList.toggle('oculto', !e.link);
    if (e.link) { $('dLink').href = e.link; $('dLink').textContent = e.link_texto || 'Lista e ingressos'; }
    const passado = new Date(e.fim || (new Date(e.inicio).getTime() + 8 * 3600000)) < new Date();
    $('respostas').parentElement.classList.toggle('oculto', passado);
    $('respostas').parentElement.previousElementSibling.classList.toggle('oculto', passado);
    pintarResposta(e.minha, e.meu_discreto);
    msg('mResp');
    quemVai();
  }

  function pintarResposta(minha, discreto) {
    document.querySelectorAll('#respostas button').forEach(b => {
      b.classList.toggle('sel', b.dataset.r === (minha || 'nao') && !!minha);
      b.classList.toggle('talvez', b.dataset.r === 'talvez');
    });
    $('dDiscreto').checked = !!discreto;
  }

  async function responder(r) {
    const { error } = await sb.rpc('responder_evento', { p_evento: atual.id, p_resposta: r, p_discreto: $('dDiscreto').checked });
    if (error) { msg('mResp', 'erro', 'Não foi possível salvar.'); return; }
    atual.minha = r === 'nao' ? null : r; atual.meu_discreto = $('dDiscreto').checked;
    pintarResposta(atual.minha, atual.meu_discreto);
    msg('mResp', 'ok', r === 'nao' ? 'Ok, retiramos você da lista.' :
      (r === 'vou' ? 'Presença confirmada ✓' : 'Marcado como talvez ✓') + (atual.meu_discreto ? ' (discreto)' : '') + ' — está na sua agenda.');
    quemVai();
  }
  document.querySelectorAll('#respostas button').forEach(b => b.addEventListener('click', () => responder(b.dataset.r)));
  $('dDiscreto').addEventListener('change', () => { if (atual && atual.minha) responder(atual.minha); });

  async function quemVai() {
    const { data } = await sb.rpc('quem_vai', { p_evento: atual.id });
    const lista = data || [];
    $('quemVai').innerHTML = '';
    $('ninguem').classList.toggle('oculto', lista.length > 0);
    const det = await sb.rpc('evento_detalhe', { p_evento: atual.id });
    const e = det.data && det.data[0];
    if (e) $('tQuem').textContent = 'Quem vai · ✅ ' + e.vao + ' · 🤔 ' + e.talvez;
    lista.forEach(p => {
      const a = el('a'); a.href = p.membro === eu.id ? 'meu-perfil.html' : 'perfil.html?id=' + encodeURIComponent(p.membro);
      const av = el('span', 'av' + (p.resposta === 'talvez' ? ' talvez' : '')); avatar(av, p, 120);
      a.append(av, el('span', null, p.apelido));
      $('quemVai').appendChild(a);
    });
  }

  $('voltar').addEventListener('click', (ev) => { ev.preventDefault(); history.pushState({}, '', 'eventos.html'); lista(); });
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('id');
    if (id) detalhe(Number(id)); else lista();
  });

  const idInicial = Number(params.get('id'));
  if (idInicial) detalhe(idInicial); else lista();
})();
