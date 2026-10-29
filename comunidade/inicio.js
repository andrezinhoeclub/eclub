// inicio.js — v2.0 — Siga-me / Últimas: destaques, Ao Vivo, stories, publicar e feed
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

  // ---------- Ao Vivo ----------
  UFS.forEach(u => { const o = document.createElement('option'); o.value = u; o.textContent = u; $('ufAoVivo').appendChild(o); });
  try { const s = localStorage.getItem('filtroUf'); if (s) $('ufAoVivo').value = s; } catch (e) {}
  async function aoVivo() {
    const uf = $('ufAoVivo').value || null;
    const { data } = await sb.rpc('contagem_ao_vivo', { p_uf: uf });
    $('linkAoVivo').textContent = 'Ao Vivo (' + (data || 0) + ')';
    $('linkAoVivo').href = 'aovivo.html?online=1' + (uf ? '&uf=' + uf : '');
    $('ufAoVivo').options[0].textContent = 'todos estados';
  }
  $('ufAoVivo').addEventListener('change', () => { try { localStorage.setItem('filtroUf', $('ufAoVivo').value); } catch (e) {} aoVivo(); stories(); });
  aoVivo();

  // ---------- Stories: eu + membros ativos recentemente ----------
  async function stories() {
    const box = $('stories'); box.innerHTML = '';
    const meu = document.createElement('a'); meu.className = 'story eu'; meu.href = '#'; meu.title = 'Publicar foto';
    const d0 = document.createElement('span'); d0.className = 'dentro'; meu.appendChild(d0);
    const mais = document.createElement('span'); mais.className = 'mais'; mais.textContent = '+'; meu.appendChild(mais);
    avatar(d0, eu, 140);
    meu.addEventListener('click', (e) => { e.preventDefault(); abrirCompor(true); });
    box.appendChild(meu);

    let q = sb.from('perfis_publicos').select('id, apelido, tipo, foto_perfil, ultimo_acesso')
      .neq('id', eu.id).not('foto_perfil', 'is', null)
      .order('ultimo_acesso', { ascending: false, nullsFirst: false }).limit(20);
    if ($('ufAoVivo').value) q = q.eq('uf', $('ufAoVivo').value);
    const { data } = await q;
    const urls = await links((data || []).map(p => p.foto_perfil));
    (data || []).forEach(p => {
      if (!urls[p.foto_perfil]) return;
      const a = document.createElement('a'); a.className = 'story'; a.href = 'perfil.html?id=' + encodeURIComponent(p.id); a.title = p.apelido;
      const d = document.createElement('span'); d.className = 'dentro';
      d.appendChild(fotoProtegida(urls[p.foto_perfil], { cortar: true, largura: 140 }));
      a.appendChild(d); box.appendChild(a);
    });
  }
  stories();

  // ---------- Publicar ----------
  const escolhidas = [];
  function abrirCompor(comFoto) {
    $('compor').classList.remove('oculto');
    $('compor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (comFoto) $('cArquivos').click(); else $('cTexto').focus();
  }
  $('bTexto').addEventListener('click', () => abrirCompor(false));
  $('bFoto').addEventListener('click', () => abrirCompor(true));
  $('bVideo').addEventListener('click', emBreve);
  $('cAddFoto').addEventListener('click', () => $('cArquivos').click());

  function desenharPrevias() {
    $('cPrevias').innerHTML = '';
    escolhidas.forEach((b, i) => {
      const img = document.createElement('img'); img.src = URL.createObjectURL(b); img.alt = 'Foto ' + (i + 1);
      img.title = 'Toque para tirar';
      img.addEventListener('click', () => { escolhidas.splice(i, 1); desenharPrevias(); });
      $('cPrevias').appendChild(img);
    });
  }
  $('cArquivos').addEventListener('change', async () => {
    const arqs = [...$('cArquivos').files]; $('cArquivos').value = '';
    for (const a of arqs) {
      if (escolhidas.length >= 4) { msg('mCompor', 'info', 'No máximo 4 fotos por publicação.'); break; }
      try { escolhidas.push(await prepararFoto(a)); } catch (e) { msg('mCompor', 'erro', e.message); }
    }
    desenharPrevias();
  });

  $('cPublicar').addEventListener('click', async () => {
    const texto = $('cTexto').value.trim();
    if (!texto && !escolhidas.length) { msg('mCompor', 'erro', 'Escreva algo ou escolha uma foto.'); return; }
    $('cPublicar').disabled = true; msg('mCompor', 'info', 'Publicando…');
    const caminhos = [];
    try {
      for (const b of escolhidas) {
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
  $('abaPub').textContent = modoUltimas ? 'Últimas' : 'Publicações';
  function mostrarAba(aba) {
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('sel', b.dataset.aba === aba));
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

  mostrarAba('pub');
})();
