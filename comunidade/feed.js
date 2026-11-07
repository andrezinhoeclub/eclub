// feed.js — v1.5 — publicações (curtir, comentar, seguir) e mural de recados
(function () {
  'use strict';
  const { sb, links, fotoProtegida, abrirVisor, sexos, avatar, tempo, toast, flyer } = window.BASE;

  function el(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }

  // ---------- Cartão do check-in (mapinha + lugar + quem esteve), como no CRS ----------
  const CSS_CK = `
.ckc{margin:8px 0 4px;border:1px solid var(--linha);border-radius:12px;overflow:hidden;background:var(--cartao2)}
.ckc .mapa{position:relative;height:130px;overflow:hidden;background:#d9d3c7}
.ckc .mapa .tiles{position:absolute;width:768px;height:768px;display:grid;grid-template-columns:repeat(3,256px)}
.ckc .mapa .tiles img{width:256px;height:256px;display:block}
.ckc .mapa .pino{position:absolute;left:50%;top:65px;transform:translate(-50%,-100%);font-size:30px;line-height:1;filter:drop-shadow(0 2px 2px #0006)}
.ckc .mapa .osm{position:absolute;right:4px;bottom:2px;font-size:9px;color:#333;background:#fff9;padding:0 3px;border-radius:3px}
.ckc .casa{display:flex;gap:10px;align-items:center;padding:10px 12px;text-decoration:none;color:var(--texto)}
.ckc .casa .tx{flex:1;min-width:0}
.ckc .casa b{display:block;font-size:1.02rem}
.ckc .casa .est{color:var(--marca);font-size:.85rem}
.ckc .casa small{display:block;color:var(--suave);font-size:.78rem}
.ckc .casa img{width:62px;height:62px;border-radius:8px;object-fit:cover;flex:0 0 62px}
.ckc .faixa{background:#2f9e44;color:#fff;text-align:center;font:700 .72rem Inter,sans-serif;letter-spacing:.06em;padding:5px}
.ckc .gente a{display:flex;gap:10px;align-items:center;padding:7px 12px;border-top:1px solid var(--linha);text-decoration:none;color:var(--texto);font-size:.88rem}
.ckc .gente .av{width:30px;height:30px;border-radius:50%;overflow:hidden;flex:0 0 30px;display:flex;align-items:center;justify-content:center;background:var(--cartao)}
.ckc .gente .av canvas{width:100%;height:100%}
.ckc .gente small{display:block;color:var(--suave);font-size:.74rem}`;
  function cssCk() { if (document.getElementById('css-ckc')) return; const s = document.createElement('style'); s.id = 'css-ckc'; s.textContent = CSS_CK; document.head.appendChild(s); }
  function miniMapa(lat, lng) {
    const z = 16, n = Math.pow(2, z), r = lat * Math.PI / 180;
    const xt = (lng + 180) / 360 * n, yt = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
    const tx = Math.floor(xt), ty = Math.floor(yt), px = (xt - tx) * 256, py = (yt - ty) * 256;
    const m = el('div', 'mapa'), t = el('div', 'tiles');
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const im = el('img'); im.alt = ''; im.loading = 'lazy'; im.referrerPolicy = 'strict-origin-when-cross-origin';
      im.src = 'https://tile.openstreetmap.org/' + z + '/' + (tx + i) + '/' + (ty + j) + '.png'; t.appendChild(im);
    }
    t.style.left = 'calc(50% - ' + Math.round(256 + px) + 'px)'; t.style.top = Math.round(65 - 256 - py) + 'px';
    m.append(t, el('span', 'pino', '📍'), el('span', 'osm', '© OpenStreetMap'));
    return m;
  }
  const horaCk = (iso) => { const d = new Date(iso), h = new Date(); const hoje = d.toDateString() === h.toDateString();
    return (hoje ? 'Hoje' : d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })) + ', às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + 'h'; };
  async function cartaoCheckin(box, p) {
    const { data } = await sb.rpc('cartoes_checkin', { p_posts: [p.id] });
    const k = data && data[0]; if (!k) return;
    cssCk(); box.innerHTML = '';
    const card = el('div', 'ckc');
    if (k.lat != null && k.lng != null) card.appendChild(miniMapa(k.lat, k.lng));
    const casa = el('a', 'casa'); casa.href = 'lugar.html?id=' + k.lugar;
    const tx = el('div', 'tx'); tx.appendChild(el('b', null, k.nome));
    if (k.media) tx.appendChild(el('span', 'est', '★'.repeat(Math.round(k.media)) + '☆'.repeat(5 - Math.round(k.media)) + ' ' + String(k.media).replace('.', ',')));
    tx.appendChild(el('small', null, [k.endereco, k.cidade && (k.cidade + (k.uf ? ' - ' + k.uf : ''))].filter(Boolean).join(', ')));
    casa.appendChild(tx);
    if (k.foto) { const im = el('img'); im.alt = ''; im.src = flyer(k.foto); casa.appendChild(im); }
    card.appendChild(casa);
    if (k.estiveram) card.appendChild(el('div', 'faixa', k.estiveram + (k.estiveram === 1 ? ' PESSOA ESTEVE AQUI' : ' PESSOAS ESTIVERAM AQUI')));
    const g = el('div', 'gente');
    (k.pessoas || []).forEach(q => {
      const a = el('a'); a.href = 'perfil.html?id=' + encodeURIComponent(q.membro);
      const av = el('span', 'av'); avatar(av, q, 80);
      const t = el('div'); const b = el('b'); b.append(sexos(q), ' ' + q.apelido + (q.uf ? ' . ' + q.uf : ''));
      t.append(b, el('small', null, horaCk(q.quando))); a.append(av, t); g.appendChild(a);
    });
    card.appendChild(g); box.appendChild(card);
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
    quem.append(nome, el('small', null, (p.evento ? 'Confirmou presença no evento · ' : '') + tempo(p.criado_em)));
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
      if (p.fotos && p.fotos.length) opcao('📷 Denunciar foto com rosto', () => {
        if (c.querySelector('.den-post')) return;
        const box = el('div', 'den-post');
        box.style.cssText = 'margin:8px 0;padding:10px 12px;border:1px solid #e5484d66;border-radius:10px;background:#e5484d14;font-size:.88rem';
        box.appendChild(el('div', null, 'Denunciar esta publicação por mostrar rosto? A administração confere e apaga se for o caso. Quem publicou não fica sabendo quem denunciou.'));
        const bt = el('div'); bt.style.cssText = 'display:flex;gap:8px;margin-top:8px';
        const sim = el('button', 'btn', 'Denunciar'); sim.type = 'button'; sim.style.cssText = 'flex:1;padding:9px';
        const nao = el('button', 'btn secundario', 'Cancelar'); nao.type = 'button'; nao.style.cssText = 'flex:1;padding:9px';
        nao.addEventListener('click', () => box.remove());
        sim.addEventListener('click', async () => {
          sim.disabled = true;
          const { error } = await sb.rpc('denunciar_post', { p_post: p.id, p_motivo: 'rosto_a_mostra' });
          box.remove(); toast(error ? 'Não foi possível denunciar: ' + error.message : 'Denúncia enviada ✓ Obrigado por cuidar da comunidade.');
        });
        bt.append(sim, nao); box.appendChild(bt);
        cab.after(box);
      });
      opcao('⚠️ Denunciar perfil', () => { location.href = av.href + '#denunciar'; });
    }
    bOpc.addEventListener('click', (e) => { e.stopPropagation(); lista.classList.toggle('oculto'); });
    document.addEventListener('click', () => lista.classList.add('oculto'));
    opc.append(bOpc, lista);
    cab.appendChild(opc);
    c.appendChild(cab);

    // Evento (confirmou presença)
    if (p.evento) {
      const ev = el('a', 'ev-no-post'); ev.href = 'eventos.html?id=' + p.evento;
      if (p.ev_capa) { const img = el('img'); img.src = flyer(p.ev_capa); img.alt = p.ev_titulo || 'Evento'; img.loading = 'lazy'; ev.appendChild(img); }
      const d = new Date(p.ev_inicio);
      const linha = el('div', 'ev-linha');
      const dt = el('div', 'ev-data');
      dt.append(el('small', null, ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][d.getDay()]), el('b', null, String(d.getDate())),
                el('span', null, ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][d.getMonth()]));
      const inf = el('div', 'ev-info');
      inf.append(el('div', 'hora', 'a partir das ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
                 el('h3', null, p.ev_titulo || ''), el('div', 'onde', p.ev_local || ''));
      linha.append(dt, inf); ev.appendChild(linha);
      c.appendChild(ev);
    }

    // Texto
    if (p.texto && /^📍 Fez check-in em /.test(p.texto)) {
      const sub = cab.querySelector('small'); if (sub) sub.textContent = 'Fez check-in ' + horaCk(p.criado_em);
      const box = el('div'); box.appendChild(el('div', 'txt', p.texto)); c.appendChild(box);
      cartaoCheckin(box, p);
    } else if (p.texto) c.appendChild(el('div', 'txt', p.texto));

    // Fotos
    if (p.fotos && p.fotos.length) {
      const g = el('div', 'fotos n' + Math.min(p.fotos.length, 4));
      c.appendChild(g);
      links(p.fotos).then(u => {
        p.fotos.forEach(f => {
          if (!u[f]) return;
          const box = el('div', 'f');
          box.appendChild(fotoProtegida(u[f], p.fotos.length === 1 ? { largura: 1000, dono: p.autor } : { cortar: true, largura: 500, dono: p.autor }));
          box.addEventListener('click', () => abrirVisor(u[f], p.autor));
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


  // ---------- Mural de recados de um perfil ----------
  // opcoes: { meu: true } no mural do próprio membro (mostra "Responder")
  function recados(container, perfilId, eu, opcoes) {
    const o = opcoes || {};
    let ultimo = null;
    container.innerHTML = '';
    const caixa = el('div');
    const vazio = el('div', 'cartao oculto'); vazio.appendChild(el('p', 'suave', o.meu ? 'Ninguém deixou recado ainda.' : 'Seja o primeiro a deixar um recado!'));
    const mais = el('button', 'btn secundario oculto', 'Ver recados anteriores'); mais.type = 'button';
    container.append(caixa, vazio, mais);

    async function carregar(reiniciar) {
      if (reiniciar) { ultimo = null; caixa.innerHTML = ''; }
      const { data } = await sb.rpc('recados_do_perfil', { p_perfil: perfilId, p_antes: ultimo });
      const lista = data || [];
      vazio.classList.toggle('oculto', !(reiniciar && lista.length === 0));
      lista.forEach(r => {
        const d = el('div', 'recado');
        const av = el('a', 'av'); av.href = 'perfil.html?id=' + encodeURIComponent(r.autor); avatar(av, r, 120);
        const corpo = el('div', 'corpo');
        const nome = el('a'); nome.href = av.href; nome.append(sexos(r), ' ' + r.apelido, el('span', 'suave', ' . ' + r.uf + ' · ' + tempo(r.criado_em)));
        const acoes = el('div', 'acoes-rec');
        if (o.meu && r.autor !== eu.id) { const resp = el('a', null, '↩ Responder no mural'); resp.href = 'perfil.html?id=' + encodeURIComponent(r.autor) + '#recados'; acoes.appendChild(resp); }
        if (r.autor !== eu.id) { const ch = el('a', null, '💬 Chat'); ch.href = 'chat.html?com=' + encodeURIComponent(r.autor); acoes.appendChild(ch); }
        if (r.posso_apagar) {
          const x = el('button', null, 'Apagar'); x.type = 'button';
          x.addEventListener('click', async () => {
            if (!x.dataset.ok) { x.dataset.ok = '1'; x.textContent = 'Toque de novo'; setTimeout(() => { delete x.dataset.ok; x.textContent = 'Apagar'; }, 3500); return; }
            await sb.from('recados').delete().eq('id', r.id); d.remove();
          });
          acoes.appendChild(x);
        }
        corpo.append(nome, el('p', null, r.texto), acoes);
        d.append(av, corpo); caixa.appendChild(d);
      });
      if (lista.length) ultimo = lista[lista.length - 1].criado_em;
      mais.classList.toggle('oculto', lista.length < 30);
    }
    mais.addEventListener('click', () => carregar(false));
    carregar(true);
    return { recarregar: () => carregar(true) };
  }

  window.FEED = { cartao, lista, recados };
})();
