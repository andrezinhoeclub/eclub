// minhas.js — v1.1 — "Minhas Coisas" (como no CRS): Amigos, Seguidores, Paqueras, Favoritos, Anotações e Depoimentos
// minhas.html?ver=amigos|seguidores|paqueras|anotacoes|depoimentos [&id=<perfil>] [&aba=...]
(async function () {
  'use strict';
  const { sb, $, moldura, exigirMembro, avatar, sexos, toast, UFS } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, (new URLSearchParams(location.search).get('ver') || 'amigos') === 'amigos' && !new URLSearchParams(location.search).get('id') ? 'amigos' : '');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const qs = new URLSearchParams(location.search);
  const ver = qs.get('ver') || 'amigos';
  const dono = qs.get('id') || null;            // ver a lista de outro perfil
  const meu = !dono || dono === eu.id;
  let nomeDono = eu.apelido;
  if (!meu) {
    const { data: p } = await sb.from('perfis_publicos').select('apelido').eq('id', dono).maybeSingle();
    nomeDono = (p && p.apelido) || 'perfil';
  }
  UFS.forEach(u => $('fUf').appendChild(new Option(u, u)));
  const dataBr = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const NOME_T = { real: 'Real', virtual: 'Virtual', conflito: 'Conflito' };

  function linha(p, info, botoes) {
    const d = el('div', 'mc-p');
    const id = p.membro || p.outro;
    const av = el('a', 'av'); av.href = id === eu.id ? 'meu-perfil.html' : 'perfil.html?id=' + encodeURIComponent(id);
    avatar(av, Object.assign({}, p, { id, tipo: p.tipo || p.tipo_perfil }), 110);
    const tx = el('div', 'tx');
    const n = el('a', 'nome'); n.href = av.href; n.append(sexos(Object.assign({}, p, { tipo: p.tipo || p.tipo_perfil })), ' ' + p.apelido + (p.uf ? ' . ' + p.uf : ''));
    tx.appendChild(n);
    (info || []).forEach(x => tx.appendChild(x));
    d.append(av, tx);
    if (botoes && botoes.length) { const b = el('div', 'bts'); botoes.forEach(x => b.appendChild(x)); d.appendChild(b); }
    return d;
  }
  const botao = (t, cls, fn) => { const b = el('button', cls || '', t); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const vazio = (t) => el('div', 'mc-vazio', t);
  function abas(lista, atual, aoTrocar) {
    const box = $('abas'); box.innerHTML = '';
    lista.forEach(([k, rot, n]) => {
      const b = el('button', k === atual ? 'sel' : ''); b.type = 'button'; b.append(rot);
      if (n != null) b.append(' ', el('span', 'n', '(' + n + ')'));
      b.addEventListener('click', () => { history.replaceState({}, '', location.pathname + '?' + new URLSearchParams(Object.assign(Object.fromEntries(qs), { aba: k }))); aoTrocar(k); });
      box.appendChild(b);
    });
  }
  $('fUf').addEventListener('change', () => recarregar());
  $('fTipo').addEventListener('change', () => recarregar());
  let recarregar = () => {};

  // =================== AMIGOS ===================
  async function amigos(aba) {
    $('titulo').textContent = meu ? 'Lista de Amigos' : 'Amigos de ' + nomeDono;
    $('filtros').classList.remove('oculto');
    let c = null;
    if (meu) { const { data } = await sb.rpc('contagem_amigos'); c = (data && data[0]) || {}; }
    const lista = meu
      ? [['todos', 'Todos os Amigos', c.total], ['verificados', '📍 Verificados', c.verificados], ['intimos', '🔥 Íntimos', c.intimos],
         ['reais', 'Reais', c.reais], ['virtuais', 'Virtuais', c.virtuais], ['conflitos', 'Conflitos', c.conflitos],
         ['pedidos', '📩 Pedidos', c.pedidos], ['enviados', 'Enviados', c.enviados]]
      : [['reais', 'Amigos Reais'], ['verificados', 'Verificados por GPS'], ['comum', 'Em comum'], ['todos', 'Todos']];
    aba = lista.some(x => x[0] === aba) ? aba : (meu ? (c && c.pedidos ? 'pedidos' : 'todos') : 'reais');
    abas(lista, aba, amigos);
    recarregar = () => amigos(aba);
    // Estatísticas e aviso (como no CRS)
    const topo = $('topoExtra'); topo.innerHTML = '';
    if (meu) {
      topo.appendChild(el('div', 'mc-aviso', 'Estatísticas: ' + (c.total || 0) + ' amigos · ' + (c.reais || 0) + ' Reais · ' + (c.virtuais || 0) + ' Virtuais · ' + (c.conflitos || 0) + ' Conflitos'));
      const av = el('div', 'mc-aviso'); av.innerHTML = '⚠️ <b>Amigo Real</b> é quem você conhece pessoalmente. Adicionar um perfil como Amigo Real sem conhecê-lo pessoalmente é fraude e pode tirar você da Comunidade. ' +
        '<b>Íntimo</b> é quem você já se relacionou intimamente — só você sabe quem marcou. <b>Conflito</b>: um disse Real e o outro Virtual. <b>Verificados</b>: amigos reais que fizeram check-in no mesmo lugar que você.';
      topo.appendChild(av);
    }
    const { data, error } = await sb.rpc('lista_amigos', { p_dono: dono, p_filtro: aba, p_tipo: $('fTipo').value || null, p_uf: $('fUf').value || null });
    const box = $('lista'); box.innerHTML = '';
    if (error) { box.appendChild(vazio('Não foi possível carregar: ' + error.message)); return; }
    if (!data.length) { box.appendChild(vazio(aba === 'pedidos' ? 'Nenhum pedido de amizade.' : 'Ninguém por aqui.')); return; }
    data.forEach(p => {
      const info = [];
      const s = el('small');
      if (p.tipo_amizade) { s.append('Amizade '); s.appendChild(el('span', 'mc-tag ' + p.tipo_amizade, NOME_T[p.tipo_amizade])); }
      if (p.intimo) s.appendChild(el('span', 'mc-tag ret', '🔥 Íntimo'));
      if (p.gps) s.appendChild(el('span', 'mc-tag real', '📍 GPS'));
      s.append(' · ' + (p.cidade ? p.cidade + ' · ' : '') + 'desde ' + dataBr(p.desde));
      info.push(s);
      const bts = [];
      if (meu && aba === 'pedidos') {
        info.push(el('small', null, p.pedido_real ? 'Disse que conhece você na vida real' : 'Disse que conhece você só no virtual'));
        bts.push(botao('Conheço no Real', 'ok', () => responder(p, true, true)), botao('Só no Virtual', '', () => responder(p, true, false)), botao('Recusar', '', () => responder(p, false)));
      } else if (meu && aba === 'enviados') {
        bts.push(botao('Cancelar pedido', '', async () => { await sb.rpc('remover_amizade', { p_id: p.membro }); toast('Pedido cancelado'); amigos(aba); }));
      } else if (meu) {
        bts.push(botao(p.intimo ? 'Tirar Íntimo' : '🔥 Íntimo', '', async () => { const { error: e } = await sb.rpc('marcar_intimo', { p_id: p.membro, p_sim: !p.intimo }); toast(e ? e.message : (p.intimo ? 'Tirado dos Íntimos' : 'Marcado como Íntimo (só você sabe)')); amigos(aba); }));
      }
      box.appendChild(linha(p, info, bts));
    });
    async function responder(p, aceitar, real) {
      const { error: e } = await sb.rpc('responder_amizade', { p_id: p.membro, p_aceitar: aceitar, p_real: !!real });
      toast(e ? e.message : (aceitar ? 'Agora vocês são amigos ✓' : 'Pedido recusado')); amigos(aba);
      if (window.BASE.avisos) window.BASE.avisos();
    }
  }

  // =================== SEGUIDORES ===================
  async function seguidores(aba) {
    $('titulo').textContent = meu ? 'Lista de Seguidores' : 'Seguidores de ' + nomeDono;
    $('filtros').classList.remove('oculto');
    aba = aba === 'eu_sigo' ? 'eu_sigo' : 'me_seguem';
    abas([['me_seguem', meu ? 'Me Seguem' : 'Seguem ' + nomeDono], ['eu_sigo', meu ? 'Eu Sigo' : nomeDono + ' segue']], aba, seguidores);
    recarregar = () => seguidores(aba);
    $('topoExtra').innerHTML = '';
    const { data, error } = await sb.rpc('lista_seguidores', { p_dono: dono, p_modo: aba, p_tipo: $('fTipo').value || null, p_uf: $('fUf').value || null });
    const box = $('lista'); box.innerHTML = '';
    if (error) { box.appendChild(vazio('Não foi possível carregar.')); return; }
    if (!data.length) { box.appendChild(vazio('Ninguém por aqui.')); return; }
    $('topoExtra').appendChild(el('div', 'mc-aviso', data.length + (data.length === 1 ? ' perfil' : ' perfis')));
    data.forEach(p => box.appendChild(linha(p, [el('small', null, (p.online ? '🟢 online agora · ' : '') + (p.cidade || '') + ' · desde ' + dataBr(p.desde))])));
  }

  // =================== PAQUERAS e FAVORITOS ===================
  async function paqueras(aba) {
    $('titulo').textContent = 'Minhas Paqueras';
    aba = ['todas', 'retribuidas', 'favoritos'].includes(aba) ? aba : 'todas';
    abas([['todas', '💘 Todas'], ['retribuidas', '💞 Retribuídas'], ['favoritos', '⭐ Favoritos']], aba, paqueras);
    const topo = $('topoExtra'); topo.innerHTML = '';
    topo.appendChild(el('div', 'mc-aviso', aba === 'favoritos'
      ? 'Favoritos são os perfis que você marcou com ⭐ para achar fácil depois. Ninguém fica sabendo.'
      : 'Paquera é segredo: a pessoa só fica sabendo se também paquerar você — aí vira uma paquera Retribuída 💞 e os dois são avisados.'));
    const box = $('lista'); box.innerHTML = '';
    if (aba === 'favoritos') {
      const { data } = await sb.rpc('meus_favoritos');
      if (!data || !data.length) { box.appendChild(vazio('Você ainda não favoritou ninguém. Use o botão ⭐ Favoritar no perfil.')); return; }
      data.forEach(p => box.appendChild(linha(p, [el('small', null, (p.online ? '🟢 online agora · ' : '') + (p.cidade || ''))],
        [botao('Tirar ⭐', '', async () => { await sb.rpc('favoritar', { p_id: p.membro }); toast('Tirado dos favoritos'); paqueras(aba); })])));
      return;
    }
    const { data } = await sb.rpc('minhas_paqueras', { p_modo: aba });
    if (window.BASE.avisos) window.BASE.avisos();
    if (!data || !data.length) { box.appendChild(vazio(aba === 'retribuidas' ? 'Nenhuma paquera retribuída ainda.' : 'Você ainda não paquerou ninguém. Use o botão 💘 Paquerar no perfil.')); return; }
    data.forEach(p => {
      const s = el('small'); s.append('paquerado em ' + dataBr(p.criado_em));
      if (p.retribuida) s.appendChild(el('span', 'mc-tag ret', (p.nova ? '🆕 ' : '') + '💞 Retribuída'));
      const bts = [botao('Desfazer', '', async () => { await sb.rpc('paquerar', { p_id: p.membro }); toast('Paquera desfeita'); paqueras(aba); })];
      if (p.retribuida) { const c = botao('💬 Chat', 'ok', () => { location.href = 'chat.html?com=' + encodeURIComponent(p.membro); }); bts.unshift(c); }
      box.appendChild(linha(p, [s], bts));
    });
  }

  // =================== ANOTAÇÕES ===================
  async function anotacoes() {
    $('titulo').textContent = 'Minhas Anotações';
    $('abas').innerHTML = '';
    $('topoExtra').innerHTML = '';
    $('topoExtra').appendChild(el('div', 'mc-aviso', 'Anotações que você fez sobre perfis. Só você vê. Para anotar, abra o perfil → mais… → Anotação.'));
    const { data } = await sb.rpc('minhas_anotacoes');
    const box = $('lista'); box.innerHTML = '';
    $('titulo').textContent = 'Minhas Anotações (' + ((data || []).length) + ')';
    if (!data || !data.length) { box.appendChild(vazio('Você fez 0 anotações.')); return; }
    data.forEach(p => {
      const nota = el('span', 'nota', p.texto);
      box.appendChild(linha(p, [el('small', null, 'atualizada em ' + dataBr(p.atualizado_em)), nota], [
        botao('Editar', '', () => { location.href = 'perfil.html?id=' + encodeURIComponent(p.membro) + '#anotacao'; }),
        botao('Apagar', '', async (e) => {
          const b = e.currentTarget; if (!b.dataset.ok) { b.dataset.ok = '1'; b.textContent = 'Confirmar'; setTimeout(() => { delete b.dataset.ok; b.textContent = 'Apagar'; }, 4000); return; }
          await sb.rpc('salvar_anotacao', { p_id: p.membro, p_texto: '' }); toast('Anotação apagada'); anotacoes();
        })]));
    });
  }

  // =================== DEPOIMENTOS ===================
  async function depoimentos(aba) {
    const alvo = dono || eu.id;
    $('titulo').textContent = 'Depoimentos de ' + nomeDono;
    aba = aba === 'enviados' ? 'enviados' : 'recebidos';
    const { data } = await sb.rpc('depoimentos_de', { p_id: alvo, p_modo: aba });
    const lista = data || [];
    abas([['recebidos', 'Recebidos'], ['enviados', 'Enviados']], aba, depoimentos);
    // Postar depoimento (só para Amigo Real)
    const topo = $('topoExtra'); topo.innerHTML = '';
    if (!meu) {
      const { data: rel } = await sb.rpc('relacao_com', { p_id: alvo });
      const r = (rel && rel[0]) || {};
      const caixa = el('div', 'mc-dep');
      caixa.appendChild(el('b', null, 'Postar Depoimento para ' + nomeDono));
      if (r.posso_depoimento) {
        const t = el('textarea'); t.rows = 4; t.maxLength = 2000; t.placeholder = 'Conte como é a amizade de vocês, como são pessoalmente…'; t.style.marginTop = '8px';
        const b = el('button', 'btn', 'Enviar depoimento'); b.type = 'button'; b.style.marginTop = '8px';
        b.addEventListener('click', async () => {
          b.disabled = true; const { data: m, error: e } = await sb.rpc('postar_depoimento', { p_para: alvo, p_texto: t.value });
          b.disabled = false; toast(e ? e.message : m); if (!e) { t.value = ''; depoimentos('enviados'); }
        });
        caixa.append(t, b);
      } else caixa.appendChild(el('p', 'suave', 'Você não é Amigo Real de ' + nomeDono + '. Só é possível enviar Depoimentos para Amigo Real.'));
      topo.appendChild(caixa);
    } else topo.appendChild(el('div', 'mc-aviso', 'Depoimentos só podem ser enviados entre Amigos Reais. Os que você recebe só aparecem no seu perfil depois que você aceitar.'));
    const box = $('lista'); box.innerHTML = '';
    if (!lista.length) { box.appendChild(vazio(aba === 'recebidos' ? 'Nenhum depoimento recebido.' : 'Nenhum depoimento enviado.')); return; }
    lista.forEach(d => {
      const c = el('div', 'mc-dep');
      const tp = el('div', 'dep-topo');
      const av = el('a', 'av'); av.href = 'perfil.html?id=' + encodeURIComponent(d.outro); avatar(av, Object.assign({ id: d.outro }, d), 90);
      const nm = el('div'); const a = el('a', null); a.href = av.href; a.style.cssText = 'font-weight:700;color:var(--texto);text-decoration:none;border:0;background:none;padding:0';
      a.append(sexos(d), ' ' + (aba === 'enviados' ? 'para ' : '') + d.apelido + (d.uf ? ' . ' + d.uf : ''));
      nm.append(a, el('small', 'suave', ' · ' + dataBr(d.criado_em)));
      if (d.status === 'pendente') nm.appendChild(el('div', 'pend', aba === 'enviados' ? '⏳ aguardando aceitar' : '⏳ aguardando você aceitar'));
      tp.append(av, nm); c.appendChild(tp);
      c.appendChild(el('p', null, d.texto));
      const bt = el('div'); bt.style.cssText = 'display:flex;gap:8px';
      if (d.posso_aceitar) {
        bt.appendChild(botao('Aceitar', 'btn', async () => { await sb.rpc('responder_depoimento', { p_id: d.id, p_aceitar: true }); toast('Depoimento aceito ✓'); depoimentos(aba); if (window.BASE.avisos) window.BASE.avisos(); }));
        bt.appendChild(botao('Recusar', 'btn secundario', async () => { await sb.rpc('responder_depoimento', { p_id: d.id, p_aceitar: false }); toast('Depoimento recusado'); depoimentos(aba); if (window.BASE.avisos) window.BASE.avisos(); }));
      } else if (d.posso_apagar) {
        bt.appendChild(botao('Apagar', 'btn secundario', async (e) => {
          const b = e.currentTarget; if (!b.dataset.ok) { b.dataset.ok = '1'; b.textContent = 'Toque de novo'; setTimeout(() => { delete b.dataset.ok; b.textContent = 'Apagar'; }, 4000); return; }
          await sb.rpc('apagar_depoimento', { p_id: d.id }); toast('Depoimento apagado'); depoimentos(aba);
        }));
      }
      [...bt.children].forEach(b => { b.style.width = 'auto'; b.style.padding = '8px 14px'; });
      if (bt.children.length) c.appendChild(bt);
      box.appendChild(c);
    });
  }

  const PAGS = { amigos, seguidores, paqueras, anotacoes, depoimentos };
  (PAGS[ver] || amigos)(qs.get('aba'));
})();
