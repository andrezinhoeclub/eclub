// feed.js — v1.0 — publicações (cartões, curtir, comentar, seguir) usadas no início e no perfil
(function () {
  'use strict';
  const { sb, links, fotoProtegida, abrirVisor, sexos, avatar, tempo, toast } = window.BASE;

  function el(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function cartao(p, eu, aoMudar) {
    const c = el('article', 'post');

    // Cabeçalho
    const cab = el('div', 'cab');
    const av = el('a', 'av'); av.href = 'perfil.html?id=' + encodeURIComponent(p.autor);
    avatar(av, p, 120);
    const quem = el('div', 'quem');
    const nome = el('a'); nome.href = av.href;
    nome.append(sexos(p), ' ' + p.apelido, el('span', 'suave', ' . ' + p.uf));
    quem.append(nome, el('small', null, tempo(p.criado_em)));
    cab.append(av, quem);

    // Opções (seguir / apagar / denunciar)
    const opc = el('div', 'mais-opcoes');
    const bOpc = el('button', null, p.autor === eu.id ? 'opções ▾' : (p.sigo ? 'parar de seguir ▾' : 'seguir ▾'));
    bOpc.type = 'button';
    const lista = el('div', 'opcoes oculto');
    const opcao = (texto, acao) => { const b = el('button', null, texto); b.type = 'button'; b.addEventListener('click', async () => { lista.classList.add('oculto'); await acao(); }); lista.appendChild(b); };
    if (p.autor === eu.id) {
      opcao('🗑 Apagar publicação', async () => {
        if (!c.dataset.confirma) { c.dataset.confirma = '1'; toast('Toque de novo em "Apagar" para confirmar.'); setTimeout(() => delete c.dataset.confirma, 4000); return; }
        const { error } = await sb.from('posts').delete().eq('id', p.id);
        if (error) { toast('Não foi possível apagar.'); return; }
        if (p.fotos && p.fotos.length) await sb.storage.from('fotos').remove(p.fotos);
        c.remove();
      });
    } else {
      opcao(p.sigo ? 'Parar de seguir' : 'Seguir', async () => {
        const { data, error } = await sb.rpc('alternar_seguir', { p_membro: p.autor });
        if (error) { toast('Não foi possível.'); return; }
        toast(data ? 'Agora você segue ' + p.apelido : 'Você deixou de seguir ' + p.apelido);
        if (aoMudar) aoMudar();
      });
      opcao('Ver perfil', () => { location.href = av.href; });
      opcao('⚠️ Denunciar', () => { location.href = av.href + '#denunciar'; });
    }
    bOpc.addEventListener('click', (e) => { e.stopPropagation(); lista.classList.toggle('oculto'); });
    document.addEventListener('click', () => lista.classList.add('oculto'));
    opc.append(bOpc, lista);
    cab.appendChild(opc);
    c.appendChild(cab);

    // Texto
    if (p.texto) c.appendChild(el('div', 'txt', p.texto));

    // Fotos
    if (p.fotos && p.fotos.length) {
      const g = el('div', 'fotos n' + Math.min(p.fotos.length, 4));
      c.appendChild(g);
      links(p.fotos).then(u => {
        p.fotos.forEach(f => {
          if (!u[f]) return;
          const box = el('div', 'f');
          box.appendChild(fotoProtegida(u[f], p.fotos.length === 1 ? { largura: 1000 } : { cortar: true, largura: 500 }));
          box.addEventListener('click', () => abrirVisor(u[f]));
          g.appendChild(box);
        });
      });
    }

    // Rodapé: curtir e comentar
    const rod = el('div', 'rodape');
    const bCurtir = el('button'); bCurtir.type = 'button';
    const bComent = el('button'); bComent.type = 'button';
    let curtidas = p.curtidas, curti = p.eu_curti, nComent = p.comentarios;
    const pintar = () => {
      bCurtir.textContent = (curti ? '❤️ Curtiu' : '🤍 Curtir') + (curtidas ? ' (' + curtidas + ')' : '');
      bCurtir.classList.toggle('curti', curti);
      bComent.textContent = '💬 Comentar' + (nComent ? ' (' + nComent + ')' : '');
    };
    pintar();
    bCurtir.addEventListener('click', async () => {
      bCurtir.disabled = true;
      const { data, error } = await sb.rpc('alternar_curtida', { p_post: p.id });
      bCurtir.disabled = false;
      if (error || !data || !data[0]) { toast('Não foi possível curtir.'); return; }
      curti = data[0].curtido; curtidas = data[0].total; pintar();
    });

    const area = el('div', 'coments oculto');
    const listaC = el('div');
    const novo = el('form', 'novo-coment');
    const inp = el('input'); inp.type = 'text'; inp.maxLength = 1000; inp.placeholder = 'Escreva um comentário…';
    const env = el('button', null, 'Enviar'); env.type = 'submit';
    novo.append(inp, env);
    area.append(listaC, novo);

    async function carregarComentarios() {
      const { data } = await sb.rpc('comentarios_do_post', { p_post: p.id });
      listaC.innerHTML = '';
      (data || []).forEach(k => {
        const d = el('div', 'coment');
        const a = el('a', null, k.apelido); a.href = 'perfil.html?id=' + encodeURIComponent(k.autor);
        d.append(a, ' ' + k.texto + ' ', el('span', 'suave', '· ' + tempo(k.criado_em)));
        if (k.posso_apagar) {
          const x = el('button', 'apagar', 'apagar'); x.type = 'button';
          x.addEventListener('click', async () => {
            await sb.from('comentarios').delete().eq('id', k.id);
            nComent = Math.max(0, nComent - 1); pintar(); carregarComentarios();
          });
          d.append(' ', x);
        }
        listaC.appendChild(d);
      });
    }
    bComent.addEventListener('click', () => {
      area.classList.toggle('oculto');
      if (!area.classList.contains('oculto')) { carregarComentarios(); inp.focus(); }
    });
    novo.addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = inp.value.trim(); if (!t) return;
      env.disabled = true;
      const { error } = await sb.from('comentarios').insert({ post: p.id, autor: eu.id, texto: t });
      env.disabled = false;
      if (error) { toast(/Limite/.test(error.message) ? error.message : 'Não foi possível comentar.'); return; }
      inp.value = ''; nComent++; pintar(); carregarComentarios();
    });

    rod.append(bCurtir, bComent);
    c.append(rod, area);
    return c;
  }

  // Lista com "carregar mais"
  function lista(container, eu, modo, autor, textoVazio) {
    let ultimo = null, acabou = false, carregando = false;
    const mais = el('button', 'btn secundario oculto', 'Carregar mais'); mais.type = 'button';
    const vazio = el('div', 'cartao oculto'); vazio.appendChild(el('p', 'suave', textoVazio || 'Nada por aqui ainda.'));
    container.innerHTML = '';
    const caixa = el('div');
    container.append(caixa, vazio, mais);

    async function carregar(reiniciar) {
      if (carregando) return; carregando = true;
      if (reiniciar) { ultimo = null; acabou = false; caixa.innerHTML = ''; }
      mais.classList.add('oculto');
      const { data, error } = await sb.rpc('feed', { p_modo: modo, p_autor: autor || null, p_antes: ultimo, p_limite: 15 });
      carregando = false;
      if (error) { vazio.classList.remove('oculto'); vazio.firstChild.textContent = 'Erro ao carregar as publicações.'; return; }
      vazio.classList.toggle('oculto', !(reiniciar && data.length === 0));
      data.forEach(p => caixa.appendChild(cartao(p, eu, () => carregar(true))));
      if (data.length) ultimo = data[data.length - 1].criado_em;
      acabou = data.length < 15;
      mais.classList.toggle('oculto', acabou);
    }
    mais.addEventListener('click', () => carregar(false));
    carregar(true);
    return { recarregar: () => carregar(true) };
  }

  window.FEED = { cartao, lista };
})();
