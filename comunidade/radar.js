// radar.js — v2.0 — Radar CL no modelo do CRS. Tudo a partir da SUA localização:
// pessoas (grade com km, ✈ viagem, a fim de, check-in), filtros, novos check-ins, lugares, bate-papo do Radar.
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, flyer, toast, avatar, sexos, links, fotoProtegida, tempo } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'radar');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const km = (n) => String(Number(n).toFixed(1)).replace('.', ',') + ' km';
  const ICONE_AFIM = { Sexo: '😈', Barzinho: '🍺', Balada: '🎵' };

  let CFG = null, pos = null;
  async function lerConfig() {
    const { data } = await sb.rpc('radar_minha_config');
    CFG = (data && data[0]) || { ativo: false, esconder_de: [] };
    return CFG;
  }

  // ---------- Localização (GPS + cidade pelo mapa gratuito) ----------
  async function cidadeDe(p) {
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=' + p.latitude + '&lon=' + p.longitude,
        { referrerPolicy: 'strict-origin-when-cross-origin', headers: { 'Accept-Language': 'pt-BR' } });
      const ad = (await r.json()).address || {};
      const uf = (ad['ISO3166-2-lvl4'] || '').replace('BR-', '');
      return { cidade: ad.city || ad.town || ad.village || ad.municipality || '', uf: /^[A-Z]{2}$/.test(uf) ? uf : '' };
    } catch (e) { return { cidade: '', uf: '' }; }
  }
  let cidadeAtual = '';
  async function atualizarLocal(silencioso) {
    if (!silencioso) { $('rdSub').textContent = 'atualizando…'; }
    try {
      pos = await window.BASE.posicao(silencioso ? 120000 : 0, silencioso);
      const c = await cidadeDe(pos);
      cidadeAtual = c.cidade || cidadeAtual;
      const { error } = await sb.rpc('radar_atualizar_local', { p_lat: pos.latitude, p_lng: pos.longitude, p_precisao: Math.round(pos.accuracy || 0), p_cidade: c.cidade || null, p_uf: c.uf || null });
      if (error) throw new Error(error.message);
      msg('mRadar'); pintarTopo(); return true;
    } catch (e) { if (!silencioso) msg('mRadar', 'erro', e.message); pintarTopo(); return false; }
  }
  function pintarTopo() {
    $('rdCidade').textContent = cidadeAtual || (CFG && CFG.ativo ? 'Radar CL' : 'Radar CL');
    $('rdSub').textContent = CFG && CFG.invisivel ? '👻 você está invisível · clique para atualizar' : 'clique para atualizar';
    const box = $('rdAqui'); box.innerHTML = '';
    if (CFG && CFG.checkin_lugar) {
      const d = el('div', 'rd-aqui');
      const t = el('div'); t.append('📍 Você está no ', Object.assign(el('a', null, CFG.checkin_nome), { href: 'lugar.html?id=' + CFG.checkin_lugar }));
      t.querySelector('a').style.cssText = 'color:var(--marca);font-weight:700';
      const b = el('button', null, 'Fazer check-out'); b.type = 'button';
      b.addEventListener('click', async () => { await sb.rpc('fazer_checkout'); toast('Check-out feito ✓'); await lerConfig(); pintarTopo(); carregarPessoas(); });
      d.append(t, b); box.appendChild(d);
    }
  }
  $('bCidade').addEventListener('click', async () => {
    if (!CFG || !CFG.ativo) { $('bAtivar').click(); return; }
    if (await atualizarLocal(false)) { await lerConfig(); pintarTopo(); recarregar(); toast('Radar atualizado ✓'); }
  });

  async function iniciar() {
    await lerConfig();
    if (!CFG.ativo) { $('rdAtivar').classList.remove('oculto'); $('rdConteudo').classList.add('oculto'); pintarTopo(); return; }
    $('rdAtivar').classList.add('oculto'); $('rdConteudo').classList.remove('oculto');
    pintarTopo();
    await atualizarLocal(true); await lerConfig(); pintarTopo();
    recarregar(); carregarCutucadas();
  }
  $('bAtivar').addEventListener('click', async () => { $('bAtivar').disabled = true; if (await atualizarLocal(false)) await iniciar(); $('bAtivar').disabled = false; });
  function recarregar() { carregarPessoas(); novosCheckins(); if (aba === 'lugares') carregarLugares(); }

  // ---------- Barrinha fixa ao rolar ----------
  window.addEventListener('scroll', () => $('rdFixo').classList.toggle('ver', window.scrollY > 320), { passive: true });
  $('bTopo').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ---------- Abas ----------
  let aba = 'pessoas';
  document.querySelectorAll('#abasRd button').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.aba;
    document.querySelectorAll('#abasRd button').forEach(x => x.classList.toggle('sel', x === b));
    $('abaPessoas').classList.toggle('oculto', aba !== 'pessoas');
    $('abaLugares').classList.toggle('oculto', aba !== 'lugares');
    if (aba === 'lugares') carregarLugares();
  }));

  // ---------- Pessoas ----------
  let tipo = '', filtro = '', modo = 'proximos';
  const seg = (id, fn) => document.querySelectorAll('#' + id + ' button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#' + id + ' button').forEach(x => x.classList.toggle('sel', x === b)); fn(b.dataset.v);
  }));
  seg('rdTipo', v => { tipo = v; carregarPessoas(); });
  seg('rdModo', v => { modo = v; carregarPessoas(); });
  document.querySelectorAll('#rdFiltro button').forEach(b => b.addEventListener('click', () => {
    filtro = filtro === b.dataset.v ? '' : b.dataset.v;
    document.querySelectorAll('#rdFiltro button').forEach(x => x.classList.toggle('sel', x.dataset.v === filtro));
    carregarPessoas();
  }));
  $('bMaisFiltros').addEventListener('click', () => $('rdModo').classList.toggle('oculto'));

  async function carregarPessoas() {
    const box = $('grade'); box.innerHTML = '<div class="rd-vazio">Procurando quem está perto…</div>';
    const { data, error } = await sb.rpc('radar_grade', { p_tipo: tipo || null, p_filtro: filtro || null, p_modo: modo });
    box.innerHTML = '';
    if (error) { box.appendChild(el('div', 'rd-vazio', 'Não foi possível: ' + error.message)); return; }
    if (!data || !data.length) {
      box.appendChild(el('div', 'rd-vazio', filtro ? 'Ninguém com esse filtro perto de você agora.' : 'Ninguém com o Radar ligado perto de você agora. Volte mais tarde ou chame os amigos para ativar o Radar!'));
      return;
    }
    const urls = await links(data.map(p => p.foto_perfil).filter(Boolean));
    data.forEach(p => {
      const a = el('a', 'rd-p'); a.href = 'perfil.html?id=' + encodeURIComponent(p.membro);
      const f = el('span', 'foto'); const rec = el('span', 'rec'); f.appendChild(rec);
      if (p.foto_perfil && urls[p.foto_perfil]) rec.appendChild(fotoProtegida(urls[p.foto_perfil], { cortar: true, largura: 260, dono: p.membro }));
      else rec.textContent = p.tipo === 'casal' ? '💑' : p.tipo === 'solteira' ? '👩' : '👨';
      if (p.a_fim) f.appendChild(el('span', 'b-afim', ICONE_AFIM[p.a_fim] || '🔥'));
      if (p.viagem) f.appendChild(el('span', 'b-viagem', '✈️'));
      const nome = el('span', 'nome ' + p.tipo); nome.append(sexos(p), ' ' + p.apelido);
      const k = el('span', 'km'); if (p.checkin_lugar) k.appendChild(el('span', 'pin', '📍 ')); k.append(km(p.distancia_km));
      a.append(f, nome, k);
      if (p.checkin_nome) a.appendChild(el('span', 'lugar', p.checkin_nome));
      else a.appendChild(el('span', 'onde', p.cidade_atual || ''));
      box.appendChild(a);
    });
  }
  async function novosCheckins() {
    const { data: n } = await sb.rpc('radar_checkins_novos');
    const b = $('bNovos');
    b.classList.toggle('oculto', !n);
    if (n) b.textContent = n + (n === 1 ? ' Novo Check-in Por Perto' : ' Novos Check-ins Por Perto');
  }
  $('bNovos').addEventListener('click', () => {
    filtro = 'checkin';
    document.querySelectorAll('#rdFiltro button').forEach(x => x.classList.toggle('sel', x.dataset.v === filtro));
    carregarPessoas();
  });

  // Cutucadas recebidas
  async function carregarCutucadas() {
    const { data } = await sb.rpc('minhas_cutucadas');
    const box = $('listaCutucadas'); box.innerHTML = '';
    $('secCutucadas').classList.toggle('oculto', !(data && data.length));
    (data || []).forEach(c => {
      const d = el('div', 'rd-cutuca'); const av = el('a', 'av'); av.href = 'perfil.html?id=' + encodeURIComponent(c.de);
      avatar(av, Object.assign({ id: c.de }, c), 100);
      const tx = el('div', 'tx'); const n = el('a', null); n.href = av.href; n.append(sexos(c), ' ' + c.apelido);
      tx.append(n, el('small', null, (c.nova ? '🆕 ' : '') + 'cutucou você ' + tempo(c.criado_em)));
      const b = el('button', null, '👉 Cutucar de volta'); b.type = 'button';
      b.addEventListener('click', async () => { b.disabled = true; const { data: r, error: e } = await sb.rpc('cutucar', { p_para: c.de }); toast(e ? e.message : r); });
      d.append(av, tx, b); box.appendChild(d);
    });
    if (window.BASE.avisos) window.BASE.avisos();
  }

  // ---------- "Está a fim de que hoje?" (•••) ----------
  function fundo() { const f = el('div', 'rd-fundo'); f.addEventListener('click', (e) => { if (e.target === f) f.remove(); }); document.body.appendChild(f); return f; }
  $('bAfim').addEventListener('click', () => {
    if (!CFG || !CFG.ativo) { toast('Ative o Radar primeiro.'); return; }
    const f = fundo(); const d = el('div', 'rd-dlg'); d.appendChild(el('h3', null, 'Está a fim de que hoje?'));
    [['Sexo', '😈 Sexo', 'sexo'], ['Barzinho', '🍺 Barzinho', 'bar'], ['Balada', '🎵 Balada', 'balada'], [null, 'nada específico', 'nada']].forEach(([v, t, cls]) => {
      const b = el('button', cls + ((CFG.a_fim || null) === v ? ' atual' : ''), t); b.type = 'button';
      b.addEventListener('click', async () => {
        const { error } = await sb.rpc('radar_a_fim', { p_texto: v });
        f.remove();
        if (error) { toast(error.message); return; }
        CFG.a_fim = v; toast(v ? (ICONE_AFIM[v] + ' A fim de ' + v.toLowerCase() + ' hoje (por 24 horas)') : 'Ok, nada específico hoje');
        carregarPessoas();
      });
      d.appendChild(b);
    });
    const c = el('button', 'cancelar', 'Cancelar'); c.type = 'button'; c.addEventListener('click', () => f.remove()); d.appendChild(c);
    f.appendChild(d);
  });

  // ---------- Ajustes (⚙️) ----------
  $('bCfg').addEventListener('click', () => {
    const fl = el('div', 'rd-folha');
    const cab = el('div', 'cab'); const t = el('b', null, '⚙️ Ajustes do Radar'); const x = el('button', null, '×'); x.type = 'button';
    cab.append(t, x); const corpo = el('div', 'corpo rd-cfg'); fl.append(cab, corpo); document.body.appendChild(fl);
    x.addEventListener('click', () => fl.remove());
    if (!CFG || !CFG.ativo) { corpo.appendChild(el('p', 'suave', 'O Radar está desligado.')); return; }
    const linha = (html, marcado, valor) => { const l = el('label'); const i = el('input'); i.type = 'checkbox'; i.checked = marcado; if (valor) { i.value = valor; i.className = 'esc'; } const s = el('span'); s.innerHTML = html; l.append(i, s); corpo.appendChild(l); return i; };
    const inv = linha('<b>Ficar invisível</b><br><small class="suave">Ninguém vê você no Radar (você continua vendo os outros).</small>', !!CFG.invisivel);
    linha('Invisível para <b>casais</b> <small class="suave">(e você também não vê casais)</small>', (CFG.esconder_de || []).includes('casal'), 'casal');
    linha('Invisível para <b>mulheres solteiras</b> <small class="suave">(e você não vê elas)</small>', (CFG.esconder_de || []).includes('solteira'), 'solteira');
    linha('Invisível para <b>homens solteiros</b> <small class="suave">(e você não vê eles)</small>', (CFG.esconder_de || []).includes('solteiro'), 'solteiro');
    const salvar = el('button', 'btn', 'Salvar'); salvar.type = 'button'; salvar.style.cssText = 'width:100%;margin-top:14px';
    salvar.addEventListener('click', async () => {
      const esc = [...corpo.querySelectorAll('.esc')].filter(c => c.checked).map(c => c.value);
      const { error } = await sb.rpc('radar_salvar', { p_invisivel: inv.checked, p_esconder: esc });
      if (error) { toast(error.message); return; }
      toast('Ajustes salvos ✓'); fl.remove(); await lerConfig(); pintarTopo(); carregarPessoas();
    });
    const desl = el('button', 'btn secundario', 'Desligar o Radar e apagar minha localização'); desl.type = 'button'; desl.style.cssText = 'width:100%;margin-top:10px';
    desl.addEventListener('click', async () => {
      if (!desl.dataset.ok) { desl.dataset.ok = '1'; desl.textContent = 'Toque de novo para desligar'; return; }
      await sb.rpc('radar_desligar'); fl.remove(); toast('Radar desligado. Sua localização foi apagada.'); pos = null; cidadeAtual = ''; iniciar();
    });
    corpo.append(salvar, desl);
  });

  // ---------- Bate-papo do Radar (até 100 km de você) ----------
  let papo = null;
  function abrirPapo() {
    if (!CFG || !CFG.ativo) { toast('Ative o Radar primeiro.'); return; }
    if (papo) return;
    const fl = el('div', 'rd-folha');
    const cab = el('div', 'cab'); const t = el('b', null, '📍💬 Bate-papo do Radar'); t.appendChild(el('small', null, 'Conversa aberta com quem está a até 100 km de você · some em 24 horas'));
    const x = el('button', null, '×'); x.type = 'button'; cab.append(t, x);
    const corpo = el('div', 'corpo'); const env = el('div', 'enviar');
    const inp = el('input'); inp.maxLength = 500; inp.placeholder = 'Escreva para quem está por perto…';
    const b = el('button', null, '➤'); b.type = 'button'; env.append(inp, b);
    fl.append(cab, corpo, env); document.body.appendChild(fl);
    papo = { fl, corpo, ultimo: null, timer: null };
    const fechar = () => { clearInterval(papo.timer); fl.remove(); papo = null; };
    x.addEventListener('click', fechar);
    async function carregar() {
      if (!papo) return;
      const { data } = await sb.rpc('radar_chat', { p_depois: papo.ultimo });
      if (!papo) return;
      if (papo.ultimo === null && (!data || !data.length)) { corpo.innerHTML = ''; corpo.appendChild(el('p', 'suave', 'Ninguém conversou por aqui nas últimas 24 horas. Comece a conversa! 👋')); }
      if (!data || !data.length) return;
      if (papo.ultimo === null) corpo.innerHTML = '';
      const vazio = corpo.querySelector('p.suave'); if (vazio) vazio.remove();
      const urls = await links(data.map(m => m.foto_perfil).filter(Boolean));
      data.forEach(m => {
        const d = el('div', 'rd-msg' + (m.minha ? ' minha' : '')); const av = el('a', 'av'); av.href = 'perfil.html?id=' + encodeURIComponent(m.autor);
        if (m.foto_perfil && urls[m.foto_perfil]) av.appendChild(fotoProtegida(urls[m.foto_perfil], { cortar: true, largura: 80, dono: m.autor })); else av.textContent = m.tipo === 'casal' ? '💑' : m.tipo === 'solteira' ? '👩' : '👨';
        const bal = el('div', 'bal'); const n = el('a', null); n.href = av.href; n.append(sexos(m), ' ' + m.apelido);
        const s = el('small', null, (m.minha ? '' : km(m.distancia_km) + (m.cidade ? ' · ' + m.cidade : '') + ' · ') + tempo(m.criado_em));
        if (m.posso_apagar) { const ap = el('button', null, 'apagar'); ap.type = 'button'; ap.addEventListener('click', async () => { const { error } = await sb.rpc('radar_chat_apagar', { p_id: m.id }); if (!error) d.remove(); }); s.appendChild(ap); }
        bal.append(n, el('p', null, m.texto), s); d.append(av, bal); corpo.appendChild(d);
        papo.ultimo = Math.max(papo.ultimo || 0, m.id);
      });
      corpo.scrollTop = corpo.scrollHeight;
    }
    async function enviar() {
      const tx = inp.value.trim(); if (!tx) return;
      b.disabled = true;
      const { error } = await sb.rpc('radar_chat_enviar', { p_texto: tx });
      b.disabled = false;
      if (error) { toast(error.message.replace(/^RADAR:\s*/, '')); return; }
      inp.value = ''; carregar();
    }
    b.addEventListener('click', enviar);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
    corpo.appendChild(el('p', 'suave', 'Carregando…'));
    carregar(); papo.timer = setInterval(() => { if (!document.hidden) carregar(); }, 8000);
  }
  $('bPapo').addEventListener('click', abrirPapo);
  $('cardPapo').addEventListener('click', abrirPapo);

  // ---------- Lugares ----------
  let lgModo = 'proximos', lgCidade = null, lgBusca = '', timerBusca = null, cidadesMontadas = false;
  seg('lgModo', v => { lgModo = v; carregarLugares(); });
  $('lgBusca').addEventListener('input', () => { clearTimeout(timerBusca); timerBusca = setTimeout(() => { lgBusca = $('lgBusca').value.trim(); carregarLugares(); }, 400); });
  async function montarCidades() {
    if (cidadesMontadas || !pos) return; cidadesMontadas = true;
    const { data } = await sb.rpc('radar_cidades', { p_lat: pos.latitude, p_lng: pos.longitude });
    const box = $('lgCidades'); box.innerHTML = '';
    (data || []).forEach((c, i) => {
      const b = el('button', null, c.cidade); b.type = 'button'; if (i >= 5) b.classList.add('oculto', 'extra');
      b.addEventListener('click', () => { lgCidade = lgCidade === c.cidade ? null : c.cidade; box.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x.textContent === lgCidade)); carregarLugares(); });
      box.appendChild(b);
    });
    if ((data || []).length > 5) { const m = el('button', null, 'mais…'); m.type = 'button'; m.addEventListener('click', () => { box.querySelectorAll('.extra').forEach(x => x.classList.remove('oculto')); m.remove(); }); box.appendChild(m); }
  }
  async function carregarLugares() {
    if (!pos) { const ok = await atualizarLocal(false); if (!ok) return; }
    montarCidades();
    $('lgTitulo').textContent = lgBusca ? 'RESULTADO DA BUSCA' : lgCidade ? 'LUGARES EM ' + lgCidade.toUpperCase() : (lgModo === 'ativos' ? 'LUGARES MAIS ATIVOS PERTO DE VOCÊ' : 'LUGARES MAIS PRÓXIMOS DE VOCÊ');
    const box = $('lgLista'); box.innerHTML = '<p class="suave" style="text-align:center">Procurando…</p>';
    const { data, error } = await sb.rpc('radar_lugares', { p_lat: pos.latitude, p_lng: pos.longitude, p_modo: lgModo, p_cidade: lgCidade, p_busca: lgBusca || null });
    box.innerHTML = '';
    if (error) { box.appendChild(el('p', 'suave', 'Não foi possível: ' + error.message)); return; }
    if (!data || !data.length) { box.appendChild(el('p', 'suave', 'Nenhum lugar encontrado.')); return; }
    data.forEach(l => {
      const a = el('a', 'rd-l'); a.href = 'lugar.html?id=' + l.id;
      const tx = el('div', 'tx'); tx.appendChild(el('b', null, l.nome));
      const n = Math.round(Number(l.media || 0));
      const info = el('div', 'info');
      info.appendChild(el('span', 'estr', '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)));
      info.append(' ' + (l.avaliacoes ? '(' + l.avaliacoes + ')' : '(sem avaliação)') + ' · ');
      info.appendChild(el('i', null, km(l.distancia_km).replace(' km', ' km de distância')));
      tx.appendChild(info);
      tx.appendChild(el('div', 'end', [l.endereco, l.cidade, l.uf, 'Brasil'].filter(Boolean).join(' - ')));
      const tags = el('div', 'tags');
      if (l.ativos) tags.appendChild(el('span', 'ativo', '📍 ' + l.ativos + (l.ativos === 1 ? ' pessoa aqui agora' : ' pessoas aqui agora')));
      if (l.confirmados_hoje) tags.appendChild(el('span', 'hoje', l.confirmados_hoje + (l.confirmados_hoje === 1 ? ' Confirmado' : ' Confirmados') + ' - HOJE'));
      if (l.confirmados_amanha) tags.appendChild(el('span', null, l.confirmados_amanha + (l.confirmados_amanha === 1 ? ' Confirmado' : ' Confirmados') + ' - AMANHÃ'));
      if (l.estiveram) tags.appendChild(el('span', null, l.estiveram + (l.estiveram === 1 ? ' Pessoa já esteve aqui' : ' Pessoas já estiveram aqui')));
      if (tags.children.length) tx.appendChild(tags);
      const th = el('span', 'th'); if (l.foto) { const i = el('img'); i.src = flyer(l.foto); i.alt = ''; i.loading = 'lazy'; th.appendChild(i); } else th.textContent = '🏠';
      a.append(tx, th); box.appendChild(a);
    });
  }

  await iniciar();
  // Enquanto o Radar está aberto, atualiza a localização a cada 5 minutos
  setInterval(async () => { if (!document.hidden && CFG && CFG.ativo) { await atualizarLocal(true); await lerConfig(); pintarTopo(); novosCheckins(); } }, 300000);
})();
