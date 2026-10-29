// base.js — v2.0 — conexão com o banco, moldura (topo, menu, barra de baixo) e funções comuns
(function () {
  'use strict';
  const A = window.APP || {};
  if (!window.supabase || !A.SUPABASE_URL) {
    document.body.textContent = 'Site não configurado (config.js).';
    throw new Error('sem config');
  }
  const sb = window.supabase.createClient(A.SUPABASE_URL, A.SUPABASE_CHAVE_PUBLICA, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const $ = (id) => document.getElementById(id);

  function msg(id, tipo, texto) {
    const el = $(id); if (!el) return;
    el.className = 'msg ' + (tipo || '');
    el.textContent = texto || '';
  }

  function idade(dataISO) {
    if (!dataISO) return null;
    const n = new Date(dataISO + 'T12:00:00'), h = new Date();
    let i = h.getFullYear() - n.getFullYear();
    const m = h.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < n.getDate())) i--;
    return i;
  }

  function dataBR(dataISO) {
    if (!dataISO) return '';
    const [a, m, d] = String(dataISO).slice(0, 10).split('-');
    return d + '/' + m + '/' + a;
  }

  const NOME_TIPO = { casal: 'Casal', solteira: 'Solteira', solteiro: 'Solteiro' };
  function formacao(p) {
    if (p.tipo !== 'casal') return NOME_TIPO[p.tipo] || p.tipo;
    const n = (s) => s === 'M' ? 'Ele' : 'Ela';
    return 'Casal (' + n(p.sexo_1) + ' e ' + n(p.sexo_2) + ')';
  }

  // Exige login. Devolve { user, perfil } ou manda para a tela de entrar.
  async function exigirLogin() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { location.replace('entrar.html'); throw new Error('sem login'); }
    const { data: perfil } = await sb.from('perfis')
      .select('id, numero, apelido, tipo, sexo_1, sexo_2, status, verificado, foto_perfil, cidade, uf, bio, procura, isento, acesso_ate, detalhes')
      .eq('id', user.id).maybeSingle();
    if (!perfil) { await sair(); throw new Error('sem perfil'); }
    return { user, perfil };
  }

  async function sair() {
    await sb.auth.signOut();
    location.replace('entrar.html');
  }

  // Reduz a foto, tira dados escondidos (GPS, modelo do celular) e devolve JPEG
  async function prepararFoto(arquivo) {
    if (!arquivo || !/^image\//.test(arquivo.type)) throw new Error('Envie apenas fotos (JPG ou PNG).');
    if (arquivo.size > 25 * 1024 * 1024) throw new Error('Foto muito grande.');
    const url = URL.createObjectURL(arquivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const max = 1600;
      const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * escala);
      c.height = Math.round(img.naturalHeight * escala);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
      if (!blob) throw new Error('Não consegui ler esta foto. Tente outra.');
      return blob;
    } catch (e) {
      throw new Error(e && e.message && !/decode/i.test(e.message) ? e.message
        : 'Não consegui ler esta foto. Tire um print dela ou use outra.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }


  // ---------- Fotos protegidas ----------
  // Links temporários (1 hora) para arquivos da pasta privada "fotos"
  const cacheLinks = {};
  async function links(caminhos) {
    const faltam = [...new Set(caminhos.filter(c => c && !cacheLinks[c]))];
    if (faltam.length) {
      const { data } = await sb.storage.from('fotos').createSignedUrls(faltam, 3600);
      (data || []).forEach(d => { if (d.signedUrl) cacheLinks[d.path] = d.signedUrl; });
    }
    const r = {};
    caminhos.forEach(c => { if (cacheLinks[c]) r[c] = cacheLinks[c]; });
    return r;
  }

  // Desenha a foto num quadro com a marca d'água de QUEM ESTÁ VENDO (nº + apelido).
  // Se alguém vazar um print, dá para saber de quem foi.
  let marcaTexto = '';
  function definirMarca(perfil) { marcaTexto = 'nº ' + perfil.numero + ' · ' + perfil.apelido; }

  function fotoProtegida(url, opcoes) {
    const o = Object.assign({ largura: 900, cortar: false, alt: '' }, opcoes || {});
    const c = document.createElement('canvas');
    c.className = 'foto-protegida';
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', o.alt || 'Foto');
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('dragstart', e => e.preventDefault());
    // Navegação discreta: a foto vem desfocada; o primeiro toque revela
    c.addEventListener('click', e => {
      if (document.body.classList.contains('discreta') && !c.classList.contains('revelada')) {
        c.classList.add('revelada'); e.stopPropagation(); e.preventDefault();
      }
    }, true);
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
      if (o.cortar) {                 // quadrado (miniaturas)
        const lado = Math.min(w, h); sx = (w - lado) / 2; sy = (h - lado) / 2; sw = sh = lado;
        w = h = Math.min(o.largura, lado);
      } else {
        const esc = Math.min(1, o.largura / w); w = Math.round(w * esc); h = Math.round(h * esc);
      }
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      if (marcaTexto) {
        const fonte = Math.max(11, Math.round(w / 26));
        g.save();
        g.font = '600 ' + fonte + 'px Inter, Helvetica, sans-serif';
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.strokeStyle = 'rgba(0,0,0,0.18)';
        g.lineWidth = 1;
        g.translate(w / 2, h / 2); g.rotate(-Math.PI / 6);
        const passoX = g.measureText(marcaTexto).width + fonte * 3, passoY = fonte * 4;
        const lim = Math.hypot(w, h);
        for (let y = -lim; y < lim; y += passoY) {
          for (let x = -lim + ((y / passoY) % 2 ? passoX / 2 : 0); x < lim; x += passoX) {
            g.strokeText(marcaTexto, x, y); g.fillText(marcaTexto, x, y);
          }
        }
        g.restore();
      }
    };
    img.src = url;
    return c;
  }

  // "online agora", "visto hoje"…
  function visto(dataISO) {
    if (!dataISO) return '';
    const min = (Date.now() - new Date(dataISO).getTime()) / 60000;
    if (min < 15) return '🟢 online agora';
    if (min < 60 * 24) return 'visto hoje';
    if (min < 60 * 24 * 7) return 'visto esta semana';
    return 'visto há mais de uma semana';
  }

  function idades(p) {
    return p.tipo === 'casal' ? (p.idade_1 + ' e ' + p.idade_2 + ' anos') : (p.idade_1 + ' anos');
  }

  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

  // Abre a foto em tela cheia (com marca d'água)
  function abrirVisor(url) {
    const v = document.createElement('div'); v.className = 'visor';
    const fechar = document.createElement('button'); fechar.className = 'fechar'; fechar.type = 'button'; fechar.textContent = '✕ Fechar';
    const fim = () => { v.remove(); document.removeEventListener('keydown', tecla); };
    const tecla = (e) => { if (e.key === 'Escape') fim(); };
    fechar.addEventListener('click', fim);
    v.addEventListener('click', (e) => { if (e.target === v) fim(); });
    document.addEventListener('keydown', tecla);
    v.append(fotoProtegida(url, { largura: 1400 }), fechar);
    document.body.appendChild(v);
  }

  // Monta uma grade de miniaturas. fotos = [{caminho, album, ...}]
  async function gradeFotos(container, fotos, opcoes) {
    const o = opcoes || {};
    container.innerHTML = '';
    const urls = await links(fotos.map(f => f.caminho));
    fotos.forEach(f => {
      if (!urls[f.caminho]) return;
      const item = document.createElement('div'); item.className = 'item';
      item.appendChild(fotoProtegida(urls[f.caminho], { cortar: true, largura: 360 }));
      if (o.etiqueta) { const e = o.etiqueta(f); if (e) { const t = document.createElement('span'); t.className = 'etiqueta'; t.textContent = e; item.appendChild(t); } }
      item.addEventListener('click', () => (o.aoClicar ? o.aoClicar(f, urls[f.caminho]) : abrirVisor(urls[f.caminho])));
      container.appendChild(item);
    });
  }


  // ---------- Preferências deste aparelho (modo escuro, letras, discreta) ----------
  function pref(chave, padrao) { try { return localStorage.getItem('pref_' + chave) || padrao; } catch (e) { return padrao; } }
  function salvarPref(chave, valor) { try { localStorage.setItem('pref_' + chave, valor); } catch (e) {} aplicarPrefs(); }
  function aplicarPrefs() {
    const escuro = pref('escuro', 'desliga');
    const h = new Date().getHours();
    const ligar = escuro === 'liga' || (escuro === 'noite' && (h >= 19 || h < 7));
    document.documentElement.dataset.tema = ligar ? 'escuro' : 'claro';
    document.documentElement.classList.toggle('letras-grandes', pref('letras', 'normais') === 'grandes');
    if (document.body) document.body.classList.toggle('discreta', pref('discreta', 'desligada') === 'ligada');
  }
  aplicarPrefs();

  // ---------- Pequenas utilidades ----------
  function toast(texto) {
    document.querySelectorAll('.aviso-toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'aviso-toast'; t.textContent = texto;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }
  const emBreve = () => toast('Em breve nesta comunidade 😉');

  function tempo(dataISO) {
    const s = Math.max(0, (Date.now() - new Date(dataISO).getTime()) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
    const d = new Date(dataISO);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // ♂♀ coloridos conforme o perfil
  function sexos(p) {
    const f = document.createDocumentFragment();
    [p.sexo_1, p.tipo === 'casal' ? p.sexo_2 : null].filter(Boolean).forEach(sx => {
      const s = document.createElement('span'); s.className = sx === 'M' ? 'sx-m' : 'sx-f'; s.textContent = sx === 'M' ? '♂' : '♀';
      f.appendChild(s);
    });
    return f;
  }

  // Avatar redondo (foto de perfil ou emoji)
  async function avatar(el, p, largura) {
    el.textContent = p.tipo === 'casal' ? '💑' : (p.tipo === 'solteira' ? '👩' : '👨');
    if (!p.foto_perfil) return;
    const u = await links([p.foto_perfil]);
    if (u[p.foto_perfil]) { el.textContent = ''; el.appendChild(fotoProtegida(u[p.foto_perfil], { cortar: true, largura: largura || 200 })); }
  }

  // ---------- Acesso: precisa estar aprovado e com assinatura ativa ----------
  async function exigirMembro(opcoes) {
    const o = opcoes || {};
    const { user, perfil } = await exigirLogin();
    if (perfil.status !== 'aprovado') { location.replace('verificacao.html'); throw new Error('nao aprovado'); }
    const { data: ass } = await sb.rpc('minha_assinatura');
    const assinatura = (ass && ass[0]) || { ativa: false };
    if (!assinatura.ativa && !o.semAssinatura) { location.replace('planos.html'); throw new Error('sem assinatura'); }
    definirMarca(perfil);
    return { user, perfil, assinatura };
  }

  // ---------- Ícones ----------
  const ICONE = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    agenda: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M9 14h2v2H9z"/>',
    perfil: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 18c1-2.5 3-3.5 5-3.5s4 1 5 3.5"/>',
    recado: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 7l9 6 9-6"/>',
    chat: '<path d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2H10l-5 4v-4H5a2 2 0 01-2-2V7a2 2 0 012-2z"/><path d="M8 10h8M8 13h5"/>',
    camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    busca: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    sigame: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 16a0 0 0 010 0M8 12a4 4 0 014 4M8 8a8 8 0 018 8"/>',
    ultimas: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l4-4 3 3 4-5 5 6"/><circle cx="9" cy="9" r="1.5"/>',
    radar: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    forum: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M7 9h10M7 12h7M9 17l-2 3"/>',
    grupos: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
    pagamento: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
    olho: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 4l16 16"/>',
    lua: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    letra: '<path d="M4 19l5-14 5 14M6 14h6M15 19l3-8 3 8M16 16.5h4"/>',
    amigos: '<circle cx="9" cy="8" r="3"/><path d="M3 19c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c2.3 0 4.2 1.2 5 3.5"/>',
    estrela: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    coracao: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
    nota: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    convite: '<path d="M4 9l8-5 8 5v10H4z"/><path d="M4 9l8 6 8-6"/>',
    trofeu: '<path d="M8 4h8v5a4 4 0 01-8 0zM6 5H4v2a3 3 0 003 3M18 5h2v2a3 3 0 01-3 3M12 13v4M8 20h8"/>',
    lapis: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    chave: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3"/>',
    escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.8-2.5 2-2.5 4M12 17h.01"/>',
    admin: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    sair: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>'
  };
  function icone(nome) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONE[nome] || '') + '</svg>'; }

  // ---------- Moldura das telas: topo, menu lateral e barra de baixo ----------
  // ativo: 'sigame' | 'ultimas' | 'radar' | 'perfil' | 'busca' | ...
  async function moldura(perfil, assinatura, ativo) {
    const pag = (n, rotulo, href, extra) =>
      '<' + (href ? 'a href="' + href + '"' : 'button type="button"') + ' data-id="' + n + '" aria-label="' + rotulo + '"' + (extra || '') + '>' +
      icone(n) + '<span class="bolinha" id="b_' + n + '"></span></' + (href ? 'a' : 'button') + '>';

    const topo = document.createElement('div'); topo.className = 'barra-topo';
    topo.innerHTML = '<div class="icones">' +
      pag('menu', 'Menu') + pag('agenda', 'Eventos') + pag('perfil', 'Meu perfil', 'meu-perfil.html') +
      pag('recado', 'Recados') + pag('chat', 'Chat') + pag('camera', 'Publicar foto', 'inicio.html?postar=foto') +
      pag('busca', 'Buscar membros', 'aovivo.html?busca=1') + '</div>';
    document.body.prepend(topo);

    const baixo = document.createElement('div'); baixo.className = 'barra-baixo';
    const bb = (n, rotulo, href) => '<' + (href ? 'a href="' + href + '"' : 'button type="button"') + ' data-id="' + n + '">' +
      icone(n) + '<span>' + rotulo + '</span><span class="bolinha" id="bb_' + n + '"></span></' + (href ? 'a' : 'button') + '>';
    baixo.innerHTML = '<nav>' + bb('sigame', 'Siga-me', 'inicio.html') + bb('ultimas', 'Últimas', 'inicio.html?aba=ultimas') +
      bb('radar', 'Radar', 'aovivo.html') + bb('forum', 'Fórum') + bb('grupos', 'Grupos') + '</nav>';
    document.body.appendChild(baixo);

    [...topo.querySelectorAll('[data-id]'), ...baixo.querySelectorAll('[data-id]')].forEach(el => {
      if (el.dataset.id === ativo) el.classList.add('ativo');
      if (el.tagName === 'BUTTON' && el.dataset.id !== 'menu') el.addEventListener('click', emBreve);
    });
    topo.querySelector('[data-id="menu"]').addEventListener('click', () => abrirMenu(perfil, assinatura));

    // Avisos: pedidos de álbum pendentes aparecem no ícone do perfil
    sb.from('album_pedidos').select('solicitante', { count: 'exact', head: true })
      .eq('dono', perfil.id).eq('status', 'pendente')
      .then(({ count }) => { if (count) $('b_perfil').textContent = count; });

    // "Estou online" a cada 4 minutos
    sb.rpc('registrar_acesso');
    setInterval(() => { if (!document.hidden) sb.rpc('registrar_acesso'); }, 240000);
  }

  function abrirMenu(perfil, assinatura) {
    const fundo = document.createElement('div'); fundo.className = 'menu-fundo';
    const m = document.createElement('aside'); m.className = 'menu-lateral';
    const fechar = () => { fundo.remove(); m.remove(); };
    fundo.addEventListener('click', fechar);

    const item = (ic, texto, acao, dir) => {
      const el = document.createElement(typeof acao === 'string' ? 'a' : 'button');
      el.className = 'item';
      if (typeof acao === 'string') el.href = acao; else el.type = 'button';
      el.innerHTML = icone(ic) + '<span></span>';
      el.querySelector('span').textContent = texto;
      if (typeof acao === 'function') el.addEventListener('click', acao);
      if (dir) el.appendChild(dir);
      if (acao === null) { const b = document.createElement('span'); b.className = 'breve'; b.textContent = 'em breve'; el.appendChild(b); el.addEventListener('click', emBreve); }
      m.appendChild(el); return el;
    };
    const secao = (t) => { const s = document.createElement('div'); s.className = 'secao'; s.textContent = t; m.appendChild(s); };
    const alternador = (chave, opcoes, padrao) => {
      const a = document.createElement('span'); a.className = 'alternador';
      opcoes.forEach(([valor, rot]) => {
        const o = document.createElement('span'); o.textContent = rot;
        if (pref(chave, padrao) === valor) o.classList.add('sel');
        o.addEventListener('click', (e) => { e.stopPropagation(); salvarPref(chave, valor);
          a.querySelectorAll('span').forEach(x => x.classList.toggle('sel', x === o)); });
        a.appendChild(o);
      });
      return a;
    };
    const etiqueta = (t, cls) => { const e = document.createElement('span'); e.className = 'etq ' + (cls || ''); e.textContent = t; return e; };

    const bFechar = document.createElement('button'); bFechar.className = 'fechar'; bFechar.type = 'button';
    bFechar.innerHTML = icone('fechar'); bFechar.addEventListener('click', fechar); m.appendChild(bFechar);

    const eu = document.createElement('a'); eu.className = 'eu'; eu.href = 'meu-perfil.html';
    eu.innerHTML = '<span class="av"></span><b></b><small></small>';
    eu.querySelector('b').append(sexos(perfil), ' ' + perfil.apelido);
    eu.querySelector('small').textContent = 'Nº ' + perfil.numero + (assinatura.isento || assinatura.admin ? ' 👑' : '');
    eu.style.textDecoration = 'none'; eu.style.color = 'inherit';
    avatar(eu.querySelector('.av'), perfil, 100);
    m.appendChild(eu);

    secao('Configurações');
    item('pagamento', 'Pagamento', 'planos.html',
      assinatura.admin ? etiqueta('administração') : assinatura.isento ? etiqueta('isento') :
      assinatura.ativa ? etiqueta(assinatura.dias_restantes + ' dias restantes') : etiqueta('vencido', 'vencido'));
    item('olho', 'Navegação Discreta', () => {}, alternador('discreta', [['desligada', 'Desligada'], ['ligada', 'Ligada']], 'desligada'));
    item('lua', 'Modo Escuro', () => {}, alternador('escuro', [['desliga', 'Desliga'], ['noite', 'só à noite'], ['liga', 'Liga']], 'desliga'));
    item('letra', 'Letras', () => {}, alternador('letras', [['normais', 'Normais'], ['grandes', 'Grandes']], 'normais'));

    secao('Minhas coisas');
    item('recado', 'Meus Recados', null);
    item('amigos', 'Meus Amigos', null);
    item('camera', 'Meu Fotolog', 'meu-perfil.html');
    item('perfil', 'Fotos de Rosto', null);
    item('agenda', 'Minha Agenda', null);
    item('estrela', 'Meus Depoimentos', null);
    item('coracao', 'Minhas Paqueras', null);
    item('nota', 'Minhas Anotações', null);
    item('convite', 'Convidar Amigos', null);

    secao('Ferramentas');
    item('amigos', 'Meus Seguidores', null);
    item('sigame', 'Siga-me', 'inicio.html');
    item('ultimas', 'Últimas Atualizações', 'inicio.html?aba=ultimas');
    item('radar', 'Radar', 'aovivo.html');
    item('forum', 'Fórum', null);
    item('grupos', 'Círculos', null);
    item('agenda', 'Eventos', null);
    item('trofeu', 'Ranking', null);

    secao('Conta');
    item('lapis', 'Editar Meu Perfil', 'meu-perfil.html');
    item('chave', 'Trocar Senha', async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      await sb.auth.resetPasswordForEmail(user.email, { redirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') + 'entrar.html' });
      toast('Enviamos um link para o seu e-mail para criar a nova senha.');
    });
    item('escudo', 'Privacidade e Segurança', 'regras.html#privacidade');
    item('ajuda', 'Ajuda e Regras', 'regras.html');
    item('chat', 'Falar com a Administração', null);
    if (assinatura.admin) item('admin', 'Painel da Administração', 'admin.html');
    const s = item('sair', 'SAIR', sair); s.classList.add('sair');

    const rod = document.createElement('div'); rod.className = 'menu-rodape';
    rod.textContent = A.NOME + ' · Credibilidade · Responsabilidade · Segurança';
    m.appendChild(rod);

    document.body.append(fundo, m);
  }

  // ---------- Campos do perfil (Ele / Ela) e preferências ----------
  const CAMPOS = {
    pessoa: [
      ['orientacao', 'Orientação', ['Heterossexual', 'Bissexual', 'Homossexual', 'Pansexual', 'Bicurioso(a)']],
      ['etnia', 'Etnia', ['Branco', 'Negro', 'Pardo', 'Amarelo', 'Indígena', 'Outra']],
      ['cabelos', 'Cabelos', ['Preto', 'Castanho Escuro', 'Castanho Claro', 'Loiro', 'Ruivo', 'Grisalho', 'Muda com Frequência', 'Careca']],
      ['tipo_cabelo', 'Tipo de Cabelo', ['Curtos', 'Médios', 'Longos', 'Raspado', 'Outros']],
      ['olhos', 'Olhos', ['Castanhos', 'Pretos', 'Verdes', 'Azuis', 'Mel', 'Outros']],
      ['altura', 'Altura (cm)', 'numero'],
      ['peso', 'Peso (kg)', 'numero'],
      ['tipo_fisico', 'Tipo Físico', ['Magro(a)', 'Normal', 'Atlético(a)', 'Musculoso(a)', 'Fofinho(a)', 'Gordinho(a)']],
      ['fumo', 'Fumo', ['Não', 'Socialmente', 'Sim']],
      ['escolaridade', 'Escolaridade', ['Fundamental', 'Ensino Médio', 'Superior Incompleto', 'Superior Completo', 'Pós-graduação']],
      ['tatuagens', 'Tatuagens', ['Nenhuma', '1', '2', '3 ou mais']]
    ],
    geral: [
      ['estado_civil', 'Estado Civil', ['Casado(a)', 'União Estável', 'Noivo(a)', 'Namorando', 'Solteiro(a)', 'Divorciado(a)', 'Viúvo(a)']],
      ['filhos', 'Filhos', ['Não', 'Sim']]
    ],
    interesse: ['Homem', 'Mulher', 'Casal', 'Trans'],
    praticas: ['Mesmo Ambiente', 'Troca de Carícias', 'Troca de Carícias (elas)', 'Troca de Carícias (eles)',
               'Bi Feminino', 'Bi Masculino', 'Ménage Feminino', 'Ménage Masculino', 'Troca de Casais',
               'Grupal', 'Cuckold', 'Voyeur', 'Exibicionismo']
  };

  function signo(mmdd) {
    if (!mmdd) return '';
    const [m, d] = mmdd.split('-').map(Number), v = m * 100 + d;
    const t = [[120, 'Capricórnio'], [219, 'Aquário'], [320, 'Peixes'], [420, 'Áries'], [520, 'Touro'], [620, 'Gêmeos'],
               [722, 'Câncer'], [822, 'Leão'], [922, 'Virgem'], [1022, 'Libra'], [1121, 'Escorpião'], [1221, 'Sagitário'], [1231, 'Capricórnio']];
    for (const [lim, nome] of t) if (v <= lim) return nome;
    return '';
  }
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesDe = (mmdd) => (mmdd ? MESES[Number(mmdd.slice(0, 2)) - 1] : '');

  window.BASE = { sb, $, msg, idade, dataBR, formacao, exigirLogin, exigirMembro, sair, prepararFoto,
                  links, definirMarca, moldura, abrirVisor, gradeFotos, fotoProtegida, visto, idades, tempo,
                  sexos, avatar, toast, emBreve, icone, CAMPOS, signo, mesDe, UFS, NOME_TIPO, NOME: A.NOME };

  // Nome da comunidade no topo e no título
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-nome-app]').forEach(el => { el.textContent = A.NOME; });
    if (document.title.indexOf('·') < 0) document.title = document.title + ' · ' + A.NOME;
    const bSair = document.getElementById('bSair');
    if (bSair) bSair.addEventListener('click', sair);
  });
})();
