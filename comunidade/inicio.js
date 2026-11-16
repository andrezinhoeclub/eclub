// inicio.js — v2.5 — Siga-me / Últimas: destaques, CL Ao Vivo (stories), publicar e feed
(async function () {
  'use strict';
  const { sb, $, msg, links, fotoProtegida, avatar, tempo, prepararFoto, moldura, exigirMembro, emBreve, UFS } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  const params = new URLSearchParams(location.search);
  const modoUltimas = params.get('aba') === 'ultimas';
  moldura(eu, assinatura, modoUltimas ? 'ultimas' : 'sigame');

  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');

  // ---------- Destaques ----------
  sb.from('destaques').select('titulo, subtitulo, link').eq('ativo', true).order('ordem').limit(3)
    .then(({ data }) => (data || []).forEach(d => {
      const a = document.createElement(d.link ? 'a' : 'div');
      a.className = 'destaque';
      if (d.link) { a.href = d.link; if (/^https:/.test(d.link)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } }
      const b = document.createElement('b'); b.textContent = d.titulo;
      const s = document.createElement('span'); s.textContent = d.subtitulo || '';
      a.append(b, s); $('destaques').appendChild(a);
    }));

  // ---------- CL Ao Vivo (stories) ----------
  // Bolinhas: primeiro os amigos, depois quem eu sigo, depois os demais; quem já vi tudo vai para o fim.
  async function contagemEstados() {
    const { data } = await sb.rpc('aovivo_estados');
    const qtd = {}; let total = 0;
    (data || []).forEach(r => { qtd[r.uf] = Number(r.qtd); total += Number(r.qtd); });
    [...$('ufAoVivo').options].forEach(o => { o.textContent = (o.value || 'todos estados') + ' (' + (o.value ? (qtd[o.value] || 0) : total) + ')'; });
  }
  UFS.forEach(u => { const o = document.createElement('option'); o.value = u; o.textContent = u; $('ufAoVivo').appendChild(o); });
  try { const s = localStorage.getItem('filtroUf'); if (s) $('ufAoVivo').value = s; } catch (e) {}
  const stories = () => window.AOVIVO.barra($('stories'), eu, $('ufAoVivo').value || null);
  $('ufAoVivo').addEventListener('change', () => { try { localStorage.setItem('filtroUf', $('ufAoVivo').value); } catch (e) {} stories(); });
  contagemEstados(); stories();

  // ---------- Publicar ----------
  const escolhidas = [];
  function abrirCompor(comFoto) {
    $('compor').classList.remove('oculto');
    $('compor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (comFoto) { if (window.EDITOR_FOTO) window.EDITOR_FOTO.carregarDetector().catch(() => {}); } else $('cTexto').focus();
  }
  $('bTexto').addEventListener('click', () => abrirCompor(false));
  $('bFoto').addEventListener('click', () => abrirCompor(true));
  $('bVideo').addEventListener('click', emBreve);
  $('cAddFoto').addEventListener('click', () => $('cArquivos').click());
  $('cTirar').addEventListener('click', () => $('cCamera').click());

  // Cada foto: { orig (sem edição, fica só no celular), estado (quadrados), blob (com os rostos escondidos) }
  function desenharPrevias() {
    $('cPrevias').innerHTML = '';
    escolhidas.forEach((f, i) => {
      const pv = document.createElement('div'); pv.className = 'pv';
      const img = document.createElement('img'); img.src = URL.createObjectURL(f.blob); img.alt = 'Foto ' + (i + 1);
      img.title = 'Toque para editar';
      img.addEventListener('click', async () => {
        const r = await window.EDITOR_FOTO.editar(f.orig, f.estado);
        if (r) { f.blob = r.blob; f.estado = r.estado; desenharPrevias(); }
      });
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Tirar foto');
      x.addEventListener('click', () => { escolhidas.splice(i, 1); desenharPrevias(); });
      pv.append(img, x); $('cPrevias').appendChild(pv);
    });
  }
  async function receberFotos(input) {
    const arqs = [...input.files]; input.value = '';
    msg('mCompor');
    for (const a of arqs) {
      if (escolhidas.length >= 4) { msg('mCompor', 'info', 'No máximo 4 fotos por publicação.'); break; }
      try {
        const orig = await prepararFoto(a);
        const r = await window.EDITOR_FOTO.editar(orig);
        if (r) escolhidas.push({ orig, estado: r.estado, blob: r.blob });
      } catch (e) { msg('mCompor', 'erro', e.message); }
      desenharPrevias();
    }
  }
  $('cArquivos').addEventListener('change', () => receberFotos($('cArquivos')));
  $('cCamera').addEventListener('change', () => receberFotos($('cCamera')));

  $('cPublicar').addEventListener('click', async () => {
    const texto = $('cTexto').value.trim();
    if (!texto && !escolhidas.length) { msg('mCompor', 'erro', 'Escreva algo ou escolha uma foto.'); return; }
    $('cPublicar').disabled = true; msg('mCompor', 'info', 'Publicando…');
    const caminhos = [];
    try {
      for (const f of escolhidas) {
        const b = f.blob;
        const caminho = eu.id + '/post-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        const up = await sb.storage.from('fotos').upload(caminho, b, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw new Error('Falha ao enviar a foto.');
        const ins = await sb.from('fotos').insert({ dono: eu.id, caminho, album: 'post' });
        if (ins.error) { await sb.storage.from('fotos').remove([caminho]); throw new Error('Falha ao salvar a foto.'); }
        caminhos.push(caminho);
      }
      const { error } = await sb.from('posts').insert({ autor: eu.id, texto: texto || null, fotos: caminhos });
      if (error) throw new Error(/Limite|máximo|Escreva/.test(error.message) ? error.message : 'Não foi possível publicar.');
    } catch (e) {
      if (caminhos.length) { await sb.from('fotos').delete().in('caminho', caminhos); await sb.storage.from('fotos').remove(caminhos); }
      $('cPublicar').disabled = false; msg('mCompor', 'erro', e.message); return;
    }
    $('cPublicar').disabled = false;
    $('cTexto').value = ''; escolhidas.length = 0; desenharPrevias();
    $('compor').classList.add('oculto'); msg('mCompor');
    mostrarAba('hist');
  });
  if (params.get('postar') === 'foto') abrirCompor(true);

  // ---------- Abas ----------
  // Últimas (igual ao CRS): Fotolog · Perfis (membros novos) · Acessos (quem entrou por último)
  $('abaPub').textContent = modoUltimas ? '📷 Fotolog' : 'Publicações';
  if (modoUltimas) {
    const [, b2, b3] = document.querySelectorAll('#abas button');
    b2.dataset.aba = 'perfis'; b2.textContent = '🆕 Perfis';
    b3.dataset.aba = 'acessos'; b3.textContent = '🟢 Acessos';
  }
  let tipoUlt = '';
  const segTipo = document.createElement('div'); segTipo.className = 'ult-tipo oculto';
  [['', 'Todos'], ['casal', 'Casais'], ['solteiro', 'Homens'], ['solteira', 'Mulheres']].forEach(([v, t]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.v = v; if (!v) b.classList.add('sel');
    b.addEventListener('click', () => { tipoUlt = v; segTipo.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); mostrarAba(abaAtual); });
    segTipo.appendChild(b);
  });
  $('lista').before(segTipo);
  let abaAtual = 'pub';

  async function gradePerfis(lista) {
    const box = $('lista'); box.innerHTML = '<p class="suave" style="text-align:center">Carregando…</p>';
    const { data, error } = await sb.rpc('ultimas_perfis', { p_lista: lista, p_tipo: tipoUlt || null, p_uf: null });
    box.innerHTML = '';
    if (error || !data || !data.length) {
      const c = document.createElement('div'); c.className = 'cartao';
      c.appendChild(Object.assign(document.createElement('p'), { className: 'suave', textContent: error ? 'Não foi possível carregar.' : 'Ninguém por aqui ainda.' }));
      box.appendChild(c); return;
    }
    const u = await links(data.map(p => p.foto_perfil).filter(Boolean));
    const g = document.createElement('div'); g.className = 'ult-grade';
    data.forEach(p => {
      const a = document.createElement('a'); a.className = 'ult-p'; a.href = 'perfil.html?id=' + encodeURIComponent(p.id);
      const f = document.createElement('span'); f.className = 'ft';
      if (p.foto_perfil && u[p.foto_perfil]) f.appendChild(fotoProtegida(u[p.foto_perfil], { cortar: true, largura: 260, dono: p.id }));
      else f.textContent = p.tipo === 'casal' ? '💑' : (p.tipo === 'solteira' ? '👩' : '👨');
      if (p.online) f.appendChild(Object.assign(document.createElement('i'), { className: 'on', title: 'online agora' }));
      if (lista === 'novos' && Date.now() - new Date(p.quando).getTime() < 3 * 86400e3) f.appendChild(Object.assign(document.createElement('em'), { textContent: 'NOVO' }));
      const n = document.createElement('b'); n.className = 'sx-' + p.tipo; n.append(window.BASE.sexos(p), ' ' + p.apelido);
      const c = document.createElement('small'); c.textContent = [p.uf, p.cidade].filter(Boolean).join(' . ');
      const q = document.createElement('small'); q.className = 'qd'; q.textContent = (lista === 'novos' ? 'entrou ' : '') + tempo(p.quando);
      a.append(f, n, c, q); g.appendChild(a);
    });
    box.appendChild(g);
  }

  function mostrarAba(aba) {
    abaAtual = aba;
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('sel', b.dataset.aba === aba));
    segTipo.classList.toggle('oculto', !(aba === 'perfis' || aba === 'acessos'));
    if (aba === 'perfis' || aba === 'acessos') { gradePerfis(aba === 'perfis' ? 'novos' : 'acessos'); return; }
    if (aba === 'pub') {
      window.FEED.lista($('lista'), eu, modoUltimas ? 'ultimas' : 'seguindo', null,
        modoUltimas ? 'Ainda não há publicações.'
                    : 'Aqui aparecem as publicações de quem você segue. Abra as "Últimas" na barra de baixo para conhecer membros e seguir.');
    } else if (aba === 'hist') {
      window.FEED.lista($('lista'), eu, 'autor', eu.id, 'Você ainda não publicou nada. Use os botões Texto ou Foto.');
    } else {
      atividades();
    }
  }
  document.querySelectorAll('#abas button').forEach(b => b.addEventListener('click', () => mostrarAba(b.dataset.aba)));

  async function atividades() {
    const box = $('lista'); box.innerHTML = '';
    sb.rpc('marcar_visto', { p_chave: 'fotolog' }).then(() => window.BASE.avisos && window.BASE.avisos());
    const { data } = await sb.rpc('minhas_atividades', { p_limite: 50 });
    if (!data || !data.length) {
      const c = document.createElement('div'); c.className = 'cartao';
      const p = document.createElement('p'); p.className = 'suave'; p.textContent = 'Quando alguém curtir, comentar ou começar a seguir vocês, aparece aqui.';
      c.appendChild(p); box.appendChild(c); return;
    }
    const txt = { curtiu: 'curtiu sua publicação ❤️', comentou: 'comentou sua publicação 💬', seguiu: 'começou a seguir vocês ➕' };
    data.forEach(a => {
      const d = document.createElement('div'); d.className = 'atividade';
      const l = document.createElement('a'); l.href = 'perfil.html?id=' + encodeURIComponent(a.quem); l.textContent = a.apelido;
      const s = document.createElement('small'); s.textContent = tempo(a.quando);
      d.append(l, ' ' + (txt[a.tipo] || ''), s); box.appendChild(d);
    });
  }

  mostrarAba(params.get('ver') === 'atividades' ? 'ativ' : (modoUltimas && params.get('ver') === 'perfis' ? 'perfis' : 'pub'));
})();
