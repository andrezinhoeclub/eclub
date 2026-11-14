// aovivo-ver.js — v1.2 — CL Ao Vivo (stories): barra de bolinhas, visualizador, curtir, comentar, quem viu e postar
// Uso (inicio.js): AOVIVO.barra(caixa, eu, uf)   ·   AOVIVO.postar(eu)
(function () {
  'use strict';
  const { sb, $, links, fotoProtegida, avatar, tempo, prepararFoto, posicao, toast } = window.BASE;
  const TEMPO_FOTO = 6000;          // 6 s por foto
  const POR_VEZ = 40;
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ICONE = { casal: '💑', solteira: '👩', solteiro: '👨' };
  const erroTexto = (e) => String((e && e.message) || e || 'Erro').replace(/^RADAR:\s*/, '');

  // =================== Barra de bolinhas ===================
  let estado = { caixa: null, eu: null, uf: null, autores: [], pulou: 0, acabou: false, carregando: false };

  async function barra(caixa, eu, uf) {
    estado = { caixa, eu, uf: uf || null, autores: [], pulou: 0, acabou: false, carregando: false };
    caixa.innerHTML = '';
    limpar();
    // Eu: bolinha com "+" (postar). Se tenho Ao Vivo no ar, a bolinha fica verde e abre as minhas fotos.
    const meu = el('a', 'story eu'); meu.href = '#'; meu.title = 'CL Ao Vivo: postar foto';
    const d0 = el('span', 'dentro'); meu.appendChild(d0);
    const mais = el('span', 'mais', '+'); mais.title = 'Postar no Ao Vivo'; meu.appendChild(mais);
    avatar(d0, eu, 140);
    caixa.appendChild(meu);
    let tenho = 0;
    sb.rpc('aovivo_de', { p_autor: eu.id }).then(({ data }) => { tenho = (data || []).length; meu.classList.toggle('tem', tenho > 0); });
    // curtidas/comentários novos no meu Ao Vivo: bolinha vermelha na minha foto
    const aviso = el('span', 'bolinha av-aviso'); meu.appendChild(aviso);
    const pintar = (n) => { aviso.textContent = n ? (n > 99 ? '99+' : n) : ''; };
    pintar(window.BASE.notif && window.BASE.notif.aovivo);
    document.addEventListener('notificacoes', (ev) => pintar(ev.detail.aovivo));
    meu.addEventListener('click', (e) => {
      e.preventDefault();
      if (e.target === mais || !tenho) { postar(eu); return; }
      sb.rpc('marcar_visto', { p_chave: 'aovivo' }).then(() => window.BASE.avisos && window.BASE.avisos());
      abrir([{ autor: eu.id, apelido: eu.apelido, tipo: eu.tipo, foto_perfil: eu.foto_perfil, eu: true }], 0);
    });
    if (!caixa.dataset.rolagem) {
      caixa.dataset.rolagem = '1';
      caixa.addEventListener('scroll', () => { if (caixa.scrollLeft + caixa.clientWidth > caixa.scrollWidth - 200) maisAutores(); }, { passive: true });
    }
    await maisAutores();
  }

  async function maisAutores() {
    const s = estado;
    if (s.carregando || s.acabou) return;
    s.carregando = true;
    const { data, error } = await sb.rpc('aovivo_barra', { p_uf: s.uf, p_limite: POR_VEZ, p_pular: s.pulou });
    s.carregando = false;
    if (s !== estado) return;                       // trocou de estado enquanto carregava
    if (error) return;
    const lista = data || [];
    s.pulou += lista.length; if (lista.length < POR_VEZ) s.acabou = true;
    if (!s.autores.length && !lista.length) {
      s.caixa.appendChild(el('span', 'story-vazio', 'Ninguém no Ao Vivo' + (s.uf ? ' em ' + s.uf : '') + '. Seja o primeiro! 📸'));
      return;
    }
    const urls = await links(lista.map(a => a.foto_perfil).filter(Boolean));
    lista.forEach(a => {
      const i = s.autores.length; s.autores.push(a);
      const b = el('a', 'story' + (a.nao_vistos > 0 ? '' : ' visto')); b.href = '#'; b.title = a.apelido;
      const d = el('span', 'dentro');
      if (a.foto_perfil && urls[a.foto_perfil]) d.appendChild(fotoProtegida(urls[a.foto_perfil], { cortar: true, largura: 140, dono: a.autor }));
      else d.textContent = ICONE[a.tipo] || '👤';
      b.appendChild(d);
      b.addEventListener('click', (e) => { e.preventDefault(); abrir(s.autores, i); });
      a.bolinha = b;
      s.caixa.appendChild(b);
    });
  }

  // Apaga do cofre as minhas fotos do Ao Vivo que já passaram de 24 horas
  let limpou = false;
  async function limpar() {
    if (limpou) return; limpou = true;
    const { data } = await sb.rpc('aovivo_limpar');
    if (data && data.length) await sb.storage.from('fotos').remove(data);
  }

  // =================== Visualizador ===================
  let V = null;   // estado do visualizador aberto

  async function abrir(autores, iAutor) {
    fechar();
    const tela = el('div', 'av-tela'); tela.setAttribute('role', 'dialog'); tela.setAttribute('aria-label', 'CL Ao Vivo');
    const barras = el('div', 'av-barras');
    const topo = el('div', 'av-topo');
    const av = el('div', 'av-av'), nome = el('div', 'av-nome'), bFechar = el('button', null, '×');
    bFechar.type = 'button'; bFechar.setAttribute('aria-label', 'Fechar');
    topo.append(av, nome, bFechar);
    const meio = el('div', 'av-meio');
    const legenda = el('div', 'av-legenda');
    const base = el('div', 'av-base');
    tela.append(barras, topo, meio, legenda, base);
    document.body.appendChild(tela); document.body.style.overflow = 'hidden';
    V = { tela, barras, av, nome, meio, legenda, base, autores, iAutor, itens: [], i: 0, timer: null, inicio: 0, gasto: 0, pausado: false, folha: null };
    bFechar.addEventListener('click', fechar);
    document.addEventListener('keydown', teclas);
    // segurar = pausa
    meio.addEventListener('pointerdown', () => pausar(true));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => meio.addEventListener(ev, () => { if (!V.folha) pausar(false); }));
    await carregarAutor(iAutor);
  }

  function teclas(e) {
    if (!V) return;
    if (e.key === 'Escape') { if (V.folha) fecharFolha(); else fechar(); }
    if (V.folha) return;
    if (e.key === 'ArrowRight') proxima();
    if (e.key === 'ArrowLeft') anterior();
  }

  function fechar() {
    if (!V) return;
    clearTimeout(V.timer); cancelAnimationFrame(V.raf);
    if (V.folha) V.folha.remove();
    V.tela.remove(); document.body.style.overflow = '';
    document.removeEventListener('keydown', teclas);
    const eraEu = V.autores[0] && V.autores[0].eu;
    V = null;
    if (estado.caixa && eraEu) barra(estado.caixa, estado.eu, estado.uf);  // pode ter apagado
  }

  async function carregarAutor(i, doFim) {
    const a = V.autores[i];
    if (!a) { fechar(); return; }
    V.iAutor = i;
    V.meio.innerHTML = ''; V.meio.appendChild(el('div', 'av-carregando', 'Carregando…'));
    const { data, error } = await sb.rpc('aovivo_de', { p_autor: a.autor });
    if (!V) return;
    if (error || !data || !data.length) { return i + 1 < V.autores.length ? carregarAutor(i + 1) : fechar(); }
    V.itens = data;
    // cabeçalho
    V.av.innerHTML = ''; V.av.textContent = ICONE[a.tipo] || '👤';
    if (a.foto_perfil) avatar(V.av, { tipo: a.tipo, foto_perfil: a.foto_perfil, id: a.autor }, 80);
    const primeiroNaoVisto = data.findIndex(x => !x.visto);
    V.i = doFim ? data.length - 1 : (primeiroNaoVisto >= 0 ? primeiroNaoVisto : 0);
    V.barras.innerHTML = '';
    data.forEach(() => { const t = el('i'); t.appendChild(el('b')); V.barras.appendChild(t); });
    mostrar();
  }

  async function mostrar() {
    const a = V.autores[V.iAutor], it = V.itens[V.i];
    clearTimeout(V.timer); cancelAnimationFrame(V.raf);
    [...V.barras.children].forEach((t, k) => { t.firstChild.style.width = k < V.i ? '100%' : '0'; });
    // nome + quando + onde
    V.nome.innerHTML = '';
    const ln = el('a', null, a.apelido); ln.href = 'perfil.html?id=' + encodeURIComponent(a.autor);
    V.nome.append(ln, el('small', null, tempo(it.criado_em) + (it.cidade ? ' · 📍 ' + it.cidade + (it.uf ? ' - ' + it.uf : '') : '')));
    // foto (com a marca d'água do dono)
    V.meio.innerHTML = '';
    const u = await links([it.caminho]);
    if (!V || V.itens[V.i] !== it) return;
    if (u[it.caminho]) V.meio.appendChild(fotoProtegida(u[it.caminho], { largura: 1080, dono: a.autor, alt: 'Foto do Ao Vivo de ' + a.apelido }));
    else V.meio.appendChild(el('div', 'av-carregando', 'Foto indisponível.'));
    const esq = el('div', 'av-esq'), dir = el('div', 'av-dir');
    esq.addEventListener('click', anterior); dir.addEventListener('click', proxima);
    V.meio.append(esq, dir);
    V.legenda.textContent = it.titulo || '';
    desenharBase(a, it);
    // marca como visto
    if (!it.visto && !a.eu) {
      it.visto = true; sb.rpc('aovivo_ver', { p_id: it.id });
      a.nao_vistos = Math.max(0, (a.nao_vistos || 1) - 1);
      if (a.bolinha && !a.nao_vistos) a.bolinha.classList.add('visto');
    }
    V.gasto = 0; V.pausado = false; correr();
  }

  function correr() {
    V.inicio = performance.now();
    const barra = V.barras.children[V.i] && V.barras.children[V.i].firstChild;
    const passo = () => {
      if (!V || V.pausado) return;
      const t = V.gasto + (performance.now() - V.inicio);
      if (barra) barra.style.width = Math.min(100, t / TEMPO_FOTO * 100) + '%';
      if (t >= TEMPO_FOTO) { proxima(); return; }
      V.raf = requestAnimationFrame(passo);
    };
    V.raf = requestAnimationFrame(passo);
  }
  function pausar(sim) {
    if (!V || V.pausado === sim) return;
    if (sim) { V.gasto += performance.now() - V.inicio; V.pausado = true; cancelAnimationFrame(V.raf); }
    else { V.pausado = false; correr(); }
  }
  function proxima() {
    if (!V || V.folha) return;
    if (V.i + 1 < V.itens.length) { V.i++; mostrar(); }
    else if (V.iAutor + 1 < V.autores.length) carregarAutor(V.iAutor + 1);
    else fechar();
  }
  function anterior() {
    if (!V || V.folha) return;
    if (V.i > 0) { V.i--; mostrar(); }
    else if (V.iAutor > 0) carregarAutor(V.iAutor - 1, true);
    else mostrar();
  }

  function desenharBase(a, it) {
    V.base.innerHTML = '';
    const bt = (txt, fn, cls) => { const b = el('button', cls || null, txt); b.type = 'button'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); }); V.base.appendChild(b); return b; };
    if (!a.eu) bt((it.curti ? '❤️ ' : '🤍 ') + it.curtidas, async (b) => {
      const { data, error } = await sb.rpc('aovivo_curtir', { p_id: it.id });
      if (error) { toast(erroTexto(error)); return; }
      it.curti = data.curti; it.curtidas = data.total;
      b.textContent = (it.curti ? '❤️ ' : '🤍 ') + it.curtidas; b.classList.toggle('on', it.curti);
    }, it.curti ? 'on' : '');
    bt('💬 ' + it.comentarios, () => comentarios(a, it));
    if (it.posso_apagar) bt('👁 ' + it.visualizacoes, () => quemViu(it));
    else V.base.appendChild(el('span', 'suave', '👁 ' + it.visualizacoes)).style.cssText = 'color:#fff9;font-size:.85rem;padding:0 6px';
    V.base.appendChild(el('span', 'esp'));
    if (it.posso_apagar) bt('🗑️', async (b) => {
      if (!b.dataset.ok) { b.dataset.ok = '1'; b.textContent = 'Apagar?'; pausar(true); setTimeout(() => { if (b.isConnected) { delete b.dataset.ok; b.textContent = '🗑️'; } }, 4000); return; }
      const { data, error } = await sb.rpc('aovivo_apagar', { p_id: it.id });
      if (error) { toast(erroTexto(error)); return; }
      if (data) sb.storage.from('fotos').remove([data]);
      toast('Foto apagada do Ao Vivo ✓');
      V.itens.splice(V.i, 1);
      if (!V.itens.length) { fechar(); if (estado.caixa) barra(estado.caixa, estado.eu, estado.uf); return; }
      V.barras.lastChild.remove(); if (V.i >= V.itens.length) V.i = V.itens.length - 1; mostrar();
    });
  }

  // =================== Folhas de baixo (comentários / quem viu) ===================
  function abrirFolha(titulo) {
    fecharFolha(); pausar(true);
    const f = el('div', 'av-folha'); const cab = el('div', 'cab'); const x = el('button', null, '×'); x.type = 'button';
    cab.append(el('span', null, titulo), x); const corpo = el('div', 'corpo');
    f.append(cab, corpo); document.body.appendChild(f);
    x.addEventListener('click', fecharFolha);
    V.folha = f; return { f, corpo };
  }
  function fecharFolha() { if (!V || !V.folha) return; V.folha.remove(); V.folha = null; pausar(false); }

  function linhaPessoa(p, textoCima, textoBaixo) {
    const it = el('div', 'item'); const mini = el('div', 'mini'); mini.textContent = ICONE[p.tipo] || '👤';
    if (p.foto_perfil) avatar(mini, { tipo: p.tipo, foto_perfil: p.foto_perfil, id: p.id }, 70);
    const txt = el('div', 'txt'); const a = el('a', null, p.apelido); a.href = 'perfil.html?id=' + encodeURIComponent(p.id);
    txt.appendChild(a); if (textoCima) txt.append(' ', textoCima);
    if (textoBaixo) txt.appendChild(el('small', null, textoBaixo));
    it.append(mini, txt); return it;
  }

  async function comentarios(a, itemAv) {
    const { f, corpo } = abrirFolha('Comentários');
    const env = el('div', 'enviar'); const inp = el('input'); inp.maxLength = 500; inp.placeholder = 'Escreva um comentário…';
    const b = el('button', null, 'Enviar'); b.type = 'button'; env.append(inp, b); f.appendChild(env);
    async function carregar() {
      corpo.innerHTML = '';
      const { data } = await sb.rpc('aovivo_lista_comentarios', { p_id: itemAv.id });
      if (!data || !data.length) { corpo.appendChild(el('p', 'suave', 'Nenhum comentário ainda. Seja o primeiro!')); return; }
      data.forEach(c => {
        const ln = linhaPessoa({ id: c.autor, apelido: c.apelido, tipo: c.tipo, foto_perfil: c.foto_perfil }, c.texto, tempo(c.criado_em));
        if (c.posso_apagar) {
          const x = el('button', 'apagar', 'apagar'); x.type = 'button';
          x.addEventListener('click', async () => {
            const { error } = await sb.rpc('aovivo_apagar_comentario', { p_id: c.id });
            if (error) { toast(erroTexto(error)); return; }
            itemAv.comentarios = Math.max(0, itemAv.comentarios - 1); desenharBase(a, itemAv); carregar();
          });
          ln.appendChild(x);
        }
        corpo.appendChild(ln);
      });
      corpo.scrollTop = corpo.scrollHeight;
    }
    async function enviar() {
      const t = inp.value.trim(); if (!t) return;
      b.disabled = true;
      const { error } = await sb.rpc('aovivo_comentar', { p_id: itemAv.id, p_texto: t });
      b.disabled = false;
      if (error) { toast(erroTexto(error)); return; }
      inp.value = ''; itemAv.comentarios++; desenharBase(a, itemAv); carregar();
    }
    b.addEventListener('click', enviar);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
    carregar();
  }

  async function quemViu(itemAv) {
    const { corpo } = abrirFolha('Quem viu (' + itemAv.visualizacoes + ')');
    corpo.appendChild(el('p', 'suave', 'Carregando…'));
    const { data } = await sb.rpc('aovivo_quem_viu', { p_id: itemAv.id });
    corpo.innerHTML = '';
    if (!data || !data.length) { corpo.appendChild(el('p', 'suave', 'Ninguém viu ainda.')); return; }
    data.forEach(v => corpo.appendChild(linhaPessoa({ id: v.membro, apelido: v.apelido, tipo: v.tipo, foto_perfil: v.foto_perfil },
      v.curtiu ? '❤️' : '', tempo(v.visto_em))));
  }

  // =================== Postar no Ao Vivo ===================
  async function onde(pos) {
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=' + pos.latitude + '&lon=' + pos.longitude,
        { referrerPolicy: 'strict-origin-when-cross-origin', headers: { 'Accept-Language': 'pt-BR' } });
      const ad = (await r.json()).address || {};
      const uf = (ad['ISO3166-2-lvl4'] || '').replace('BR-', '');
      return { cidade: ad.city || ad.town || ad.village || ad.municipality || '', uf: /^[A-Z]{2}$/.test(uf) ? uf : '' };
    } catch (e) { return { cidade: '', uf: '' }; }
  }

  function postar(eu) {
    if (document.querySelector('.av-postar')) return;
    const f = el('div', 'av-folha av-postar'); const cab = el('div', 'cab'); const x = el('button', null, '×'); x.type = 'button';
    cab.append(el('span', null, '📸 Postar no CL Ao Vivo'), x);
    const corpo = el('div', 'corpo'); f.append(cab, corpo); document.body.appendChild(f);
    x.addEventListener('click', () => f.remove());
    corpo.innerHTML =
      '<p class="suave" style="margin-top:0;font-size:.86rem">A foto fica no Ao Vivo por <b>24 horas</b> e mostra a sua cidade. Para postar, o <b>Radar</b> precisa estar ligado: ao publicar, a sua localização é atualizada.</p>' +
      '<div class="aviso-rosto" style="margin-bottom:10px">🚫 <b>Proibido rosto à mostra.</b> Ao escolher a foto, o app procura os rostos e esconde; confira antes de publicar.</div>' +
      '<img class="previa oculto" alt="Prévia">' +
      '<div class="linha"><button type="button" class="btn secundario" data-c="cam">📷 Tirar foto</button><button type="button" class="btn secundario" data-c="gal">🖼️ Galeria</button></div>' +
      '<textarea maxlength="150" placeholder="Legenda (opcional)"></textarea>' +
      '<div class="onde"></div>' +
      '<button type="button" class="btn" data-c="pub" style="width:100%" disabled>Publicar no Ao Vivo</button>' +
      '<div class="msg"></div>';
    const q = (s) => corpo.querySelector(s);
    const aviso = (tipo, t) => { const m = q('.msg'); m.className = 'msg' + (tipo ? ' ' + tipo : ''); m.textContent = t || ''; };
    let foto = null, orig = null, estadoEd = null;
    if (window.EDITOR_FOTO) window.EDITOR_FOTO.carregarDetector().catch(() => {});
    const input = (camera) => {
      const i = el('input'); i.type = 'file'; i.accept = 'image/*'; if (camera) i.setAttribute('capture', 'environment');
      i.addEventListener('change', async () => {
        const arq = i.files[0]; if (!arq) return;
        aviso('info', 'Preparando a foto…');
        try {
          orig = await prepararFoto(arq);
          const r = await window.EDITOR_FOTO.editar(orig);
          if (!r) { aviso(); return; }
          foto = r.blob; estadoEd = r.estado;
          const pv = q('.previa'); pv.src = URL.createObjectURL(foto); pv.classList.remove('oculto');
          q('[data-c=pub]').disabled = false; aviso();
        } catch (e) { aviso('erro', erroTexto(e)); }
      });
      i.click();
    };
    q('[data-c=cam]').addEventListener('click', () => input(true));
    q('[data-c=gal]').addEventListener('click', () => input(false));
    q('.previa').addEventListener('click', async () => {
      if (!orig) return;
      const r = await window.EDITOR_FOTO.editar(orig, estadoEd);
      if (r) { foto = r.blob; estadoEd = r.estado; q('.previa').src = URL.createObjectURL(foto); }
    });
    q('[data-c=pub]').addEventListener('click', async () => {
      if (!foto) return;
      const bPub = q('[data-c=pub]'); bPub.disabled = true;
      let caminho = null;
      try {
        aviso('info', 'Atualizando o Radar (localização)…');
        const pos = await posicao(60000);
        const r1 = await sb.rpc('radar_atualizar', { p_lat: pos.latitude, p_lng: pos.longitude, p_precisao: Math.round(pos.accuracy || 0) });
        if (r1.error) throw r1.error;
        const lugar = await onde(pos);
        q('.onde').textContent = lugar.cidade ? '📍 ' + lugar.cidade + (lugar.uf ? ' - ' + lugar.uf : '') : '';
        aviso('info', 'Enviando a foto…');
        caminho = eu.id + '/aovivo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        const up = await sb.storage.from('fotos').upload(caminho, foto, { contentType: 'image/jpeg', upsert: false });
        if (up.error) { caminho = null; throw new Error('Falha ao enviar a foto.'); }
        const ins = await sb.from('fotos').insert({ dono: eu.id, caminho, album: 'aovivo' });
        if (ins.error) throw new Error('Falha ao salvar a foto.');
        const { error } = await sb.rpc('aovivo_postar', { p_caminho: caminho, p_titulo: q('textarea').value.trim() || null, p_cidade: lugar.cidade || null, p_uf: lugar.uf || null });
        if (error) throw error;
      } catch (e) {
        if (caminho) { await sb.from('fotos').delete().eq('caminho', caminho); await sb.storage.from('fotos').remove([caminho]); }
        bPub.disabled = false; aviso('erro', erroTexto(e)); return;
      }
      f.remove(); toast('Foto publicada no Ao Vivo ✓');
      if (estado.caixa) barra(estado.caixa, estado.eu, estado.uf);
    });
  }

  window.AOVIVO = { barra, postar, abrir };
})();
