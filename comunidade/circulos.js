// circulos.js — v1.0 — Círculos (grupos de membros com mural, como os Grupos do CRS)
// circulos.html          → lista
// circulos.html?c=<id>   → um círculo
// circulos.html?criar=1  → criar círculo
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, toast, tempo } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'grupos');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const qs = new URLSearchParams(location.search);
  const quando = (iso) => (tempo ? tempo(iso) : new Date(iso).toLocaleString('pt-BR'));
  const mostrar = (v) => ['vLista', 'vCriar', 'vCirculo'].forEach(x => $(x).classList.toggle('oculto', x !== v));
  const ehAdmin = !!(assinatura && assinatura.admin);
  $('voltar').addEventListener('click', (e) => { e.preventDefault(); location.href = 'circulos.html'; });

  // ---------- LISTA ----------
  let aba = 'todos';
  document.querySelectorAll('#abas button').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.a; document.querySelectorAll('#abas button').forEach(x => x.classList.toggle('sel', x === b)); carregar();
  }));
  $('bBuscar').addEventListener('click', () => carregar());
  $('busca').addEventListener('keydown', (e) => { if (e.key === 'Enter') carregar(); });
  $('bCriar').addEventListener('click', () => { location.href = 'circulos.html?criar=1'; });

  async function carregar() {
    const lista = $('lista'); lista.innerHTML = '';
    const { data, error } = await sb.rpc('circulos_lista', { p_busca: $('busca').value.trim() || null, p_meus: aba === 'meus' });
    if (error) { lista.appendChild(el('div', 'cartao suave', 'Não foi possível carregar os círculos.')); return; }
    if (!data || !data.length) {
      lista.appendChild(el('div', 'cartao suave', aba === 'meus' ? 'Você ainda não participa de nenhum círculo.' : 'Nenhum círculo encontrado. Que tal criar o primeiro?'));
      return;
    }
    data.forEach(c => {
      const a = el('a', 'ci-item'); a.href = 'circulos.html?c=' + c.id;
      const ic = el('div', 'ic', c.entrada === 'aberta' ? '⭕' : '✋');
      const tx = el('div', 'tx');
      const b = el('b', null, c.nome);
      if (c.meu_status === 'ativo') b.appendChild(el('span', 'ci-tag ok', 'participo'));
      if (c.meu_status === 'pendente') b.appendChild(el('span', 'ci-tag', 'pedido enviado'));
      tx.append(b, el('small', null, c.membros + ' membro' + (c.membros == 1 ? '' : 's') + ' · criado por ' + c.dono_apelido + (c.ultimo_post ? ' · último post ' + quando(c.ultimo_post) : '')));
      if (c.descricao) tx.appendChild(el('small', null, c.descricao.length > 90 ? c.descricao.slice(0, 90) + '…' : c.descricao));
      a.append(ic, tx); lista.appendChild(a);
    });
  }

  // ---------- CRIAR ----------
  let entrada = 'aberta';
  document.querySelectorAll('#cEntrada .chip').forEach(c => c.addEventListener('click', () => {
    entrada = c.dataset.v; document.querySelectorAll('#cEntrada .chip').forEach(x => x.classList.toggle('sel', x === c));
  }));
  $('cSalvar').addEventListener('click', async () => {
    const nome = $('cNome').value.trim();
    if (nome.length < 3) { msg('mCriar', 'erro', 'O nome precisa ter pelo menos 3 letras.'); return; }
    $('cSalvar').disabled = true;
    const { data, error } = await sb.rpc('criar_circulo', { p_nome: nome, p_descricao: $('cDesc').value.trim(), p_entrada: entrada });
    $('cSalvar').disabled = false;
    if (error) { msg('mCriar', 'erro', error.message); return; }
    location.href = 'circulos.html?c=' + data;
  });

  // ---------- UM CÍRCULO ----------
  async function abrirCirculo(id) {
    const { data } = await sb.rpc('circulo_detalhe', { p_id: id });
    const c = data && data[0];
    $('voltar').classList.remove('oculto');
    mostrar('vCirculo');
    if (!c) { $('titulo').textContent = 'Círculo'; $('cInfo').replaceChildren(el('p', 'suave', 'Círculo não encontrado.')); ['cMembrosCx', 'cEscrever'].forEach(x => $(x).classList.add('oculto')); $('cPosts').innerHTML = ''; return; }
    $('titulo').textContent = c.nome;
    const info = $('cInfo'); info.innerHTML = '';
    info.appendChild(el('h2', null, c.nome));
    if (c.descricao) { const d = el('p', null, c.descricao); d.style.whiteSpace = 'pre-wrap'; info.appendChild(d); }
    info.appendChild(el('p', 'suave', c.membros + ' membro' + (c.membros == 1 ? '' : 's') + ' · criado por ' + c.dono_apelido + ' · ' + (c.entrada === 'aberta' ? 'entrada livre' : 'entra com aprovação do dono')));
    const acoes = el('div', 'linha-acoes');
    const botao = (txt, cls, fn) => { const b = el('button', 'btn ' + (cls || ''), txt); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; await fn(); b.disabled = false; }); acoes.appendChild(b); };
    const rpc = async (nome, args, ok) => { const { error } = await sb.rpc(nome, args); if (error) { toast(error.message); return false; } if (ok) toast(ok); return true; };
    if (!c.meu_status) botao(c.entrada === 'aberta' ? 'Entrar no círculo' : 'Pedir para entrar', '', async () => { if (await rpc('entrar_circulo', { p_id: id })) abrirCirculo(id); });
    if (c.meu_status === 'pendente') botao('Cancelar meu pedido', 'secundario', async () => { if (await rpc('sair_circulo', { p_id: id })) abrirCirculo(id); });
    if (c.meu_status === 'ativo' && !c.sou_dono) botao('Sair do círculo', 'secundario', async () => { if (await rpc('sair_circulo', { p_id: id })) abrirCirculo(id); });
    if (c.sou_dono || ehAdmin) {
      let conf = false;
      botao('Apagar círculo', 'vermelho', async () => {
        if (!conf) { conf = true; toast('Toque de novo para apagar o círculo e todo o mural.'); setTimeout(() => { conf = false; }, 4000); return; }
        if (await rpc('apagar_circulo', { p_id: id })) location.href = 'circulos.html';
      });
    }
    info.appendChild(acoes);
    if (c.sou_dono && c.pendentes > 0) info.appendChild(el('p', null, '✋ ' + c.pendentes + ' pedido(s) esperando sua resposta (veja em Membros).'));

    const ativo = c.meu_status === 'ativo' || ehAdmin;
    $('cEscrever').classList.toggle('oculto', c.meu_status !== 'ativo');
    $('cMembrosCx').classList.toggle('oculto', !ativo && !c.sou_dono);
    $('cPosts').innerHTML = '';
    if (!ativo) { $('cPosts').appendChild(el('div', 'cartao suave', 'O mural é só para quem participa do círculo.')); return; }
    carregarMembros(id, c);
    carregarPosts(id);
  }

  async function carregarMembros(id, c) {
    const { data } = await sb.rpc('circulo_membros_lista', { p_id: id });
    const cx = $('cMembros'); cx.innerHTML = '';
    (data || []).forEach(m => {
      const d = el('div', 'pessoa');
      const a = el('a', null, (m.papel === 'dono' ? '👑 ' : '') + m.apelido); a.href = 'perfil.html?id=' + encodeURIComponent(m.membro);
      const nome = el('div'); nome.appendChild(a);
      if (m.status === 'pendente') nome.appendChild(el('div', 'suave', 'quer entrar')).style.fontSize = '.75rem';
      const bs = el('div', 'botoes');
      const bt = (t, cls, fn) => { const b = el('button', cls, t); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; const { error } = await fn(); if (error) toast(error.message); abrirCirculo(id); }); bs.appendChild(b); };
      if (c.sou_dono && m.status === 'pendente') { bt('Aceitar', 'sim', () => sb.rpc('decidir_membro_circulo', { p_id: id, p_membro: m.membro, p_aceitar: true })); bt('Recusar', '', () => sb.rpc('decidir_membro_circulo', { p_id: id, p_membro: m.membro, p_aceitar: false })); }
      else if (c.sou_dono && m.papel !== 'dono') bt('Remover', '', () => sb.rpc('decidir_membro_circulo', { p_id: id, p_membro: m.membro, p_aceitar: false }));
      d.append(nome, bs); cx.appendChild(d);
    });
  }

  async function carregarPosts(id) {
    const { data } = await sb.rpc('circulo_posts_lista', { p_id: id, p_limite: 60 });
    const cx = $('cPosts'); cx.innerHTML = '';
    if (!data || !data.length) { cx.appendChild(el('div', 'cartao suave', 'Nenhuma mensagem ainda. Escreva a primeira!')); return; }
    data.forEach(p => {
      const d = el('div', 'ci-post');
      const q = el('div', 'quem'); const a = el('a', null, p.apelido); a.href = 'perfil.html?id=' + encodeURIComponent(p.autor);
      q.append(a, ' ', el('small', null, quando(p.criado_em)));
      d.append(q, el('p', null, p.texto));
      if (p.posso_apagar) { const b = el('button', 'ap', 'apagar'); b.type = 'button'; b.addEventListener('click', async () => { await sb.rpc('circulo_apagar_post', { p_post: p.id }); carregarPosts(id); }); d.appendChild(b); }
      cx.appendChild(d);
    });
  }

  $('pEnviar').addEventListener('click', async () => {
    const id = Number(qs.get('c'));
    const texto = $('pTexto').value.trim();
    if (!texto) { msg('mPost', 'erro', 'Escreva a mensagem.'); return; }
    $('pEnviar').disabled = true;
    const { error } = await sb.rpc('circulo_postar', { p_id: id, p_texto: texto });
    $('pEnviar').disabled = false;
    if (error) { msg('mPost', 'erro', error.message); return; }
    $('pTexto').value = ''; msg('mPost'); carregarPosts(id);
  });

  // ---------- Qual tela ----------
  if (qs.get('c')) abrirCirculo(Number(qs.get('c')));
  else if (qs.get('criar')) { $('voltar').classList.remove('oculto'); $('titulo').textContent = 'Criar círculo'; mostrar('vCriar'); }
  else { mostrar('vLista'); carregar(); }
})();
