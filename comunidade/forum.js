// forum.js — v1.0 — Fórum CL (como o Fórum do CRS): tópicos, respostas, favoritos/ocultos, busca, textos do Siga-me
// forum.html            → lista
// forum.html?t=<id>     → tópico
// forum.html?criar=1    → criar tópico
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, avatar, sexos, toast, tempo } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'forum');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const qs = new URLSearchParams(location.search);
  const quando = (iso) => tempo ? tempo(iso) : new Date(iso).toLocaleString('pt-BR');
  const mostrar = (v) => ['vLista', 'vCriar', 'vTopico'].forEach(x => $(x).classList.toggle('oculto', x !== v));
  $('voltar').addEventListener('click', (e) => { e.preventDefault(); location.href = 'forum.html'; });

  let EST = {};
  async function estatisticas() {
    const { data } = await sb.rpc('forum_estatisticas');
    EST = (data && data[0]) || {};
    $('stats').innerHTML = '';
    $('stats').append(el('b', null, 'Estatísticas do Fórum'), el('br'),
      (EST.topicos || 0) + ' tópicos criados · ' + (EST.respostas || 0) + ' respostas · ' + (EST.foristas || 0) + ' foristas', el('br'),
      'Suas respostas: ' + (EST.minhas || 0));
    $('txtMinimo').textContent = EST.minimo ? 'Você precisa ter no mínimo ' + EST.minimo + ' respostas em tópicos existentes para poder criar um novo tópico (você tem ' + (EST.minhas || 0) + ').' : '';
  }

  // ---------- LISTA ----------
  let aba = 'topicos', sub = 'principais';
  document.querySelectorAll('#abas button').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.a; document.querySelectorAll('#abas button').forEach(x => x.classList.toggle('sel', x === b));
    $('sub').classList.toggle('oculto', aba !== 'topicos'); carregar();
  }));
  document.querySelectorAll('#sub .chip').forEach(c => c.addEventListener('click', () => {
    sub = c.dataset.s; document.querySelectorAll('#sub .chip').forEach(x => x.classList.toggle('sel', x === c)); carregar();
  }));
  $('bBuscar').addEventListener('click', () => carregar());
  $('busca').addEventListener('keydown', (e) => { if (e.key === 'Enter') carregar(); });

  function linhaTopico(t) {
    const a = el('a', 'fo-t'); a.href = 'forum.html?t=' + t.id;
    const av = el('span', 'av'); if (t.autor) avatar(av, Object.assign({ id: t.autor }, t), 90);
    const tx = el('div', 'tx'); const b = el('b');
    if (t.novas) b.appendChild(el('span', 'fo-novo'));
    b.append((t.fixo ? '📌 ' : '') + (t.favorito ? '⭐ ' : '') + t.titulo);
    if (t.fechado) b.appendChild(el('span', 'fo-tag', 'fechado'));
    const s = el('small'); s.append(sexos(t), ' ' + (t.apelido || 'perfil removido') + (t.uf ? ' . ' + t.uf : '') + ' · última resposta ' + quando(t.ultima_em));
    tx.append(b, s);
    const n = el('div', 'num'); n.append(el('b', null, String(t.respostas)), el('br'), t.respostas === 1 ? 'resposta' : 'respostas');
    a.append(av, tx, n); return a;
  }
  async function carregar() {
    const box = $('lista'); box.innerHTML = '<div class="cartao suave">Carregando…</div>';
    const busca = $('busca').value.trim();
    if (aba === 'textos' && !busca) {
      const { data } = await sb.rpc('forum_textos');
      box.innerHTML = '';
      if (!data || !data.length) { box.appendChild(el('div', 'cartao suave', 'Nenhuma publicação de texto ainda.')); return; }
      data.forEach(p => {
        const r = el('div', 'fo-r');
        const av = el('a', 'av'); av.href = 'perfil.html?id=' + encodeURIComponent(p.autor); avatar(av, Object.assign({ id: p.autor }, p), 90);
        const tx = el('div', 'tx'); const q = el('div', 'quem'); const n = el('a'); n.href = av.href; n.append(sexos(p), ' ' + p.apelido + (p.uf ? ' . ' + p.uf : ''));
        q.append(n, el('small', null, ' · ' + quando(p.criado_em) + (p.comentarios ? ' · ' + p.comentarios + ' comentários' : '')));
        tx.append(q, el('p', null, p.texto)); r.append(av, tx); box.appendChild(r);
      });
      return;
    }
    const { data, error } = await sb.rpc('forum_topicos_lista', { p_aba: sub, p_busca: busca || null });
    box.innerHTML = '';
    if (error) { box.appendChild(el('div', 'cartao', 'Não foi possível carregar: ' + error.message)); return; }
    if (busca) box.appendChild(el('div', 'cartao suave', (data.length ? data.length + ' tópicos com "' : 'Nada encontrado para "') + busca + '"'));
    if (!data.length && !busca) box.appendChild(el('div', 'cartao suave', sub === 'meus' ? 'Você ainda não participou de nenhum tópico.' : sub === 'outros' ? 'Nenhum tópico em Outros.' : 'Nenhum tópico ainda. Que tal começar o primeiro?'));
    data.forEach(t => box.appendChild(linhaTopico(t)));
  }

  // ---------- CRIAR ----------
  $('bCriar').addEventListener('click', () => { location.href = 'forum.html?criar=1'; });
  $('cPublicar').addEventListener('click', async () => {
    const t = $('cTitulo').value.trim(), x = $('cTexto').value.trim();
    if (t.length < 5) { msg('mCriar', 'erro', 'Escreva um título (pelo menos 5 letras).'); return; }
    if (x.length < 10) { msg('mCriar', 'erro', 'Escreva o texto do tópico (pelo menos 10 letras).'); return; }
    $('cPublicar').disabled = true;
    const { data: id, error } = await sb.rpc('forum_criar', { p_titulo: t, p_texto: x });
    $('cPublicar').disabled = false;
    if (error) { msg('mCriar', 'erro', error.message); return; }
    location.replace('forum.html?t=' + id);
  });

  // ---------- TÓPICO ----------
  let T = null, ultimo = 0;
  function linhaResposta(r, abertura) {
    const d = el('div', 'fo-r' + (abertura ? ' abertura' : ''));
    const av = el('a', 'av'); av.href = r.autor ? 'perfil.html?id=' + encodeURIComponent(r.autor) : '#'; if (r.autor) avatar(av, Object.assign({ id: r.autor }, r), 90);
    const tx = el('div', 'tx'); const q = el('div', 'quem');
    const n = el('a'); n.href = av.href; n.append(sexos(r), ' ' + (r.apelido || 'perfil removido') + (r.uf ? ' . ' + r.uf : ''));
    q.append(n, el('small', null, ' · ' + quando(r.criado_em) + (r.posts_autor != null ? ' · ' + r.posts_autor + ' respostas no Fórum' : '')));
    tx.append(q, el('p', null, r.texto));
    if (r.posso_apagar && !abertura) {
      const ap = el('button', 'ap', 'apagar'); ap.type = 'button';
      ap.addEventListener('click', async () => {
        if (!ap.dataset.ok) { ap.dataset.ok = '1'; ap.textContent = 'toque de novo para apagar'; setTimeout(() => { delete ap.dataset.ok; ap.textContent = 'apagar'; }, 4000); return; }
        await sb.rpc('forum_apagar_resposta', { p_id: r.id }); d.remove(); toast('Resposta apagada');
      });
      tx.appendChild(ap);
    }
    d.append(av, tx); return d;
  }
  async function abrirTopico(id) {
    mostrar('vTopico'); $('voltar').classList.remove('oculto');
    const { data } = await sb.rpc('forum_topico', { p_id: id });
    T = data && data[0];
    if (!T) { $('tCab').innerHTML = ''; $('tCab').appendChild(el('div', 'cartao', 'Tópico não encontrado.')); $('tResponder').classList.add('oculto'); return; }
    document.title = T.titulo + ' · Fórum CL';
    $('titulo').textContent = 'Fórum CL';
    const cab = $('tCab'); cab.innerHTML = '';
    const c = el('div', 'cartao'); c.style.padding = '14px';
    const h = el('h2', null, (T.fixo ? '📌 ' : '') + T.titulo); h.style.margin = '0 0 8px';
    c.appendChild(h);
    const bt = el('div', 'chips');
    const fav = el('span', 'chip' + (T.favorito ? ' sel' : ''), T.favorito ? '⭐ Favorito' : '☆ Favorito');
    fav.addEventListener('click', async () => { T.favorito = !T.favorito; await sb.rpc('forum_marcar', { p_topico: T.id, p_favorito: T.favorito, p_oculto: T.favorito ? false : null }); abrirTopico(T.id); toast(T.favorito ? 'Fixado em Principais' : 'Tirado dos favoritos'); });
    const oc = el('span', 'chip' + (T.oculto ? ' sel' : ''), T.oculto ? '🙈 Oculto' : 'Ocultar');
    oc.addEventListener('click', async () => { T.oculto = !T.oculto; await sb.rpc('forum_marcar', { p_topico: T.id, p_favorito: T.oculto ? false : null, p_oculto: T.oculto }); abrirTopico(T.id); toast(T.oculto ? 'Movido para Outros' : 'Voltou para Principais'); });
    bt.append(fav, oc);
    if (T.sou_admin) {
      const fx = el('span', 'chip', T.fixo ? 'Desafixar' : '📌 Fixar'); fx.addEventListener('click', async () => { await sb.rpc('forum_admin', { p_id: T.id, p_fixo: !T.fixo, p_fechado: null }); abrirTopico(T.id); });
      const fe = el('span', 'chip', T.fechado ? 'Reabrir' : '🔒 Fechar'); fe.addEventListener('click', async () => { await sb.rpc('forum_admin', { p_id: T.id, p_fixo: null, p_fechado: !T.fechado }); abrirTopico(T.id); });
      bt.append(fx, fe);
    }
    if (T.posso_apagar && (T.sou_admin || !T.respostas)) {
      const ap = el('span', 'chip', '🗑 Apagar tópico');
      ap.addEventListener('click', async () => {
        if (!ap.dataset.ok) { ap.dataset.ok = '1'; ap.textContent = 'Toque de novo'; setTimeout(() => { delete ap.dataset.ok; ap.textContent = '🗑 Apagar tópico'; }, 4000); return; }
        await sb.rpc('forum_apagar_topico', { p_id: T.id }); location.replace('forum.html');
      });
      bt.appendChild(ap);
    }
    c.appendChild(bt); cab.appendChild(c);
    cab.appendChild(linhaResposta(Object.assign({}, T, { posts_autor: null }), true));
    cab.appendChild(el('div', 'titulo-secao', T.respostas + (T.respostas === 1 ? ' resposta' : ' respostas')));
    $('tResponder').classList.toggle('oculto', T.fechado && !T.sou_admin);
    if (T.fechado) cab.appendChild(el('div', 'cartao suave', '🔒 Este tópico foi fechado pela administração.'));
    $('tRespostas').innerHTML = ''; ultimo = 0; await carregarRespostas();
  }
  async function carregarRespostas() {
    const { data } = await sb.rpc('forum_respostas', { p_topico: T.id, p_depois: ultimo });
    (data || []).forEach(r => { $('tRespostas').appendChild(linhaResposta(r)); ultimo = Math.max(ultimo, r.id); });
  }
  $('rEnviar').addEventListener('click', async () => {
    const t = $('rTexto').value.trim();
    if (t.length < 2) { msg('mResp', 'erro', 'Escreva sua resposta.'); return; }
    $('rEnviar').disabled = true;
    const { error } = await sb.rpc('forum_responder', { p_topico: T.id, p_texto: t });
    $('rEnviar').disabled = false;
    if (error) { msg('mResp', 'erro', error.message); return; }
    $('rTexto').value = ''; msg('mResp'); await carregarRespostas();
    $('tRespostas').lastElementChild && $('tRespostas').lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ---------- Início ----------
  await estatisticas();
  if (qs.get('t')) abrirTopico(Number(qs.get('t')));
  else if (qs.get('criar')) {
    mostrar('vCriar'); $('voltar').classList.remove('oculto'); $('titulo').textContent = 'Criar Tópico';
    if (EST.minimo && EST.minhas < EST.minimo) {
      msg('mCriar', 'erro', 'Você precisa ter no mínimo ' + EST.minimo + ' respostas em tópicos existentes para criar um novo tópico. Você tem ' + (EST.minhas || 0) + '. Participe dos tópicos que já existem!');
      $('cPublicar').disabled = true;
    }
  } else { mostrar('vLista'); carregar(); }
})();
