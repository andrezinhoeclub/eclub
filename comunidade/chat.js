// chat.js — v1.0 — mensagens privadas em tempo real
(async function () {
  'use strict';
  const { sb, $, moldura, exigirMembro, avatar, sexos, tempo, toast, fotoProtegida, abrirVisor, prepararFoto } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'chat');
  $('carregando').classList.add('oculto');

  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dia = (iso) => {
    const d = new Date(iso), h = new Date(), ontem = new Date(Date.now() - 86400000);
    if (d.toDateString() === h.toDateString()) return 'Hoje';
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR');
  };

  // Links temporários das fotos do chat (pasta privada "chat")
  const cacheFotos = {};
  async function linksChat(caminhos) {
    const faltam = [...new Set(caminhos.filter(c => c && !cacheFotos[c]))];
    if (faltam.length) {
      const { data } = await sb.storage.from('chat').createSignedUrls(faltam, 3600);
      (data || []).forEach(d => { if (d.signedUrl) cacheFotos[d.path] = d.signedUrl; });
    }
    return cacheFotos;
  }

  // =================== LISTA ===================
  async function mostrarLista() {
    outro = null;
    document.body.classList.remove('em-conversa');
    $('telaConversa').classList.add('oculto');
    $('principal').classList.remove('oculto');
    $('telaLista').classList.remove('oculto');
    const { data } = await sb.rpc('minhas_conversas');
    const lista = data || [];
    $('conversas').innerHTML = '';
    $('semConversas').classList.toggle('oculto', lista.length > 0);
    lista.forEach(c => {
      const a = el('a', 'conv' + (c.nao_lidas ? ' nova' : ''));
      a.href = 'chat.html?com=' + encodeURIComponent(c.outro);
      const av = el('span', 'av'); avatar(av, { tipo: c.tipo, foto_perfil: c.foto_perfil }, 120);
      if (c.online) av.appendChild(el('span', 'ponto'));
      const meio = el('div', 'meio');
      const b = el('b'); b.append(sexos(c), ' ' + c.apelido);
      meio.append(b, el('span', null, (c.ultima_minha ? 'Você: ' : '') + c.ultima));
      const dir = el('div', 'dir'); const q = new Date(c.quando);
      dir.appendChild(el('span', null, q.toDateString() === new Date().toDateString() ? hora(c.quando) : q.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })));
      if (c.nao_lidas) dir.appendChild(el('span', 'qtd', c.nao_lidas));
      a.append(av, meio, dir);
      a.addEventListener('click', (e) => { e.preventDefault(); abrir(c.outro, true); });
      $('conversas').appendChild(a);
    });
  }

  // =================== CONVERSA ===================
  let outro = null, perfilOutro = null, maisAntiga = null, ultimoDia = '';

  function balao(m) {
    const minha = m.de === eu.id;
    const b = el('div', 'balao ' + (minha ? 'meu' : 'dele'));
    b.dataset.id = m.id;
    if (m.foto) {
      b.style.padding = '4px';
      linksChat([m.foto]).then(u => {
        if (!u[m.foto]) return;
        const c = fotoProtegida(u[m.foto], { largura: 600 });
        c.addEventListener('click', () => abrirVisor(u[m.foto]));
        b.insertBefore(c, b.firstChild);
      });
    }
    if (m.texto) b.appendChild(document.createTextNode(m.texto));
    const h = el('span', 'hora', hora(m.criado_em) + (minha && m.lida_em ? ' ✓✓' : minha ? ' ✓' : ''));
    b.appendChild(h);
    const box = $('msgs');
    const d = dia(m.criado_em);
    if (d !== ultimoDia) { box.appendChild(el('div', 'dia-conv', d)); ultimoDia = d; }
    box.appendChild(b);
    return b;
  }

  async function carregarMensagens(anteriores) {
    const { data } = await sb.rpc('conversa_com', { p_outro: outro, p_antes: anteriores ? maisAntiga : null, p_limite: 40 });
    const lista = (data || []).slice().reverse();     // mais antigas primeiro
    if (!anteriores) { $('msgs').innerHTML = ''; ultimoDia = ''; }
    if (lista.length) maisAntiga = lista[0].criado_em;
    if (anteriores) {
      // recoloca tudo na ordem certa (simples e confiável)
      const atuais = [...$('msgs').querySelectorAll('.balao')].length;
      const { data: tudo } = await sb.rpc('conversa_com', { p_outro: outro, p_antes: null, p_limite: Math.min(100, atuais + lista.length) });
      $('msgs').innerHTML = ''; ultimoDia = '';
      (tudo || []).slice().reverse().forEach(m => balao(m));
      if (tudo && tudo.length) maisAntiga = tudo[tudo.length - 1].criado_em;
    } else {
      lista.forEach(m => balao(m));
      $('msgs').scrollTop = $('msgs').scrollHeight;
    }
    const bt = $('msgs').querySelector('.btn-anteriores');
    if (bt) bt.remove();
    if (lista.length === 40 && $('msgs').querySelectorAll('.balao').length < 100) {
      const b = el('button', 'btn secundario btn-anteriores', 'Carregar mensagens anteriores');
      b.type = 'button'; b.style.margin = '0 0 8px';
      b.addEventListener('click', () => carregarMensagens(true));
      $('msgs').insertBefore(b, $('msgs').firstChild);
    }
  }

  async function abrir(id, empilhar) {
    if (!/^[0-9a-f-]{36}$/i.test(id) || id === eu.id) { mostrarLista(); return; }
    const { data: p } = await sb.from('perfis_publicos')
      .select('id, apelido, tipo, sexo_1, sexo_2, foto_perfil, ultimo_acesso, uf').eq('id', id).maybeSingle();
    if (!p) { toast('Este perfil não está disponível.'); mostrarLista(); return; }
    outro = id; perfilOutro = p; maisAntiga = null;
    if (empilhar) history.pushState({ com: id }, '', 'chat.html?com=' + encodeURIComponent(id));
    document.body.classList.add('em-conversa');
    $('principal').classList.add('oculto');
    $('telaConversa').classList.remove('oculto');
    $('opcoesConv').classList.add('oculto');
    $('cAvatar').innerHTML = ''; avatar($('cAvatar'), p, 120);
    const nome = $('cNome').querySelector('span'); nome.innerHTML = ''; nome.append(sexos(p), ' ' + p.apelido + ' . ' + p.uf);
    $('cNome').href = 'perfil.html?id=' + encodeURIComponent(id);
    const online = p.ultimo_acesso && Date.now() - new Date(p.ultimo_acesso).getTime() < 15 * 60000;
    $('cStatus').textContent = online ? '🟢 online agora' : (p.ultimo_acesso ? 'visto ' + tempo(p.ultimo_acesso) : '');

    const { data: posso } = await sb.rpc('posso_mandar_msg', { p_para: id });
    $('barraEnvio').classList.toggle('oculto', posso !== true);
    $('avisoEnvio').classList.toggle('oculto', posso === true);
    $('avisoEnvio').textContent = 'Este membro só recebe mensagens de quem ele segue. Deixe um recado no perfil ou siga e aguarde ele te seguir.';

    await carregarMensagens(false);
    await sb.rpc('marcar_lidas', { p_outro: id });
    if (window.BASE.avisos) window.BASE.avisos();
    if (posso === true && matchMedia('(min-width:700px)').matches) $('cTexto').focus();
  }

  // Enviar texto
  async function enviar(dados) {
    const { data, error } = await sb.from('mensagens').insert(Object.assign({ de: eu.id, para: outro }, dados))
      .select('id, de, texto, foto, criado_em, lida_em').single();
    if (error) {
      toast(/Limite/.test(error.message) ? error.message : 'Não foi possível enviar. Talvez este membro só aceite mensagens de quem ele segue.');
      return false;
    }
    balao(data); $('msgs').scrollTop = $('msgs').scrollHeight;
    return true;
  }
  $('bEnviar').addEventListener('click', async () => {
    const t = $('cTexto').value.trim(); if (!t) return;
    $('bEnviar').disabled = true;
    if (await enviar({ texto: t })) { $('cTexto').value = ''; $('cTexto').style.height = ''; }
    $('bEnviar').disabled = false; $('cTexto').focus();
  });
  $('cTexto').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && matchMedia('(min-width:700px)').matches) { e.preventDefault(); $('bEnviar').click(); }
  });
  $('cTexto').addEventListener('input', () => { const t = $('cTexto'); t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px'; });

  // Enviar foto
  $('bFoto').addEventListener('click', () => $('cArquivo').click());
  $('cArquivo').addEventListener('change', async () => {
    const arq = $('cArquivo').files[0]; $('cArquivo').value = '';
    if (!arq) return;
    try {
      toast('Enviando foto…');
      const blob = await prepararFoto(arq);
      const caminho = eu.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      const up = await sb.storage.from('chat').upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
      if (up.error) throw new Error('Falha ao enviar a foto.');
      if (!(await enviar({ foto: caminho }))) await sb.storage.from('chat').remove([caminho]);
    } catch (e) { toast(e.message); }
  });

  // Opções
  $('bOpcoes').addEventListener('click', (e) => { e.stopPropagation(); $('opcoesConv').classList.toggle('oculto'); });
  document.addEventListener('click', () => $('opcoesConv').classList.add('oculto'));
  $('oPerfil').addEventListener('click', () => { location.href = 'perfil.html?id=' + encodeURIComponent(outro); });
  $('oDenunciar').addEventListener('click', () => { location.href = 'perfil.html?id=' + encodeURIComponent(outro) + '#denunciar'; });
  let confirmaApagar = false;
  $('oApagar').addEventListener('click', async (e) => {
    if (!confirmaApagar) { e.stopPropagation(); confirmaApagar = true; $('oApagar').textContent = 'Toque de novo para apagar'; setTimeout(() => { confirmaApagar = false; $('oApagar').textContent = '🗑 Apagar conversa (só para mim)'; }, 4000); return; }
    await sb.rpc('apagar_conversa', { p_outro: outro });
    toast('Conversa apagada para você.');
    history.pushState({}, '', 'chat.html'); mostrarLista();
  });

  // Voltar
  $('bVoltar').addEventListener('click', () => { history.pushState({}, '', 'chat.html'); mostrarLista(); });
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('com');
    if (id) abrir(id, false); else mostrarLista();
  });

  // Tempo real: mensagem nova e "lida"
  try {
    sb.channel('chat-' + eu.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: 'para=eq.' + eu.id }, async (ev) => {
        const m = ev.new;
        if (outro && m.de === outro) {
          balao(m); $('msgs').scrollTop = $('msgs').scrollHeight;
          await sb.rpc('marcar_lidas', { p_outro: outro });
          if (window.BASE.avisos) window.BASE.avisos();
        } else if (!outro) mostrarLista();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensagens', filter: 'de=eq.' + eu.id }, (ev) => {
        if (!ev.new.lida_em) return;
        const b = $('msgs').querySelector('.balao.meu[data-id="' + ev.new.id + '"] .hora');
        if (b && !/✓✓/.test(b.textContent)) b.textContent = b.textContent.replace(' ✓', ' ✓✓');
      })
      .subscribe();
  } catch (e) {}

  const inicial = new URLSearchParams(location.search).get('com');
  if (inicial) abrir(inicial, false); else mostrarLista();
})();
