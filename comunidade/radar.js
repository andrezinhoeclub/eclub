// radar.js — v1.0 — Radar (como no CRS): pessoas e lugares perto, check-in/check-out, cutucar, "a fim de", invisível
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, flyer, toast, avatar, sexos } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'radar');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const AFIM = ['Barzinho', 'Balada', 'Sexo', 'Swing', 'Ménage', 'Conversar', 'Conhecer gente nova', 'Encontro a dois', 'Festa liberal', 'Viajar'];

  function posicao() {
    return new Promise((ok, falha) => {
      if (!navigator.geolocation) return falha(new Error('Este aparelho não informa a localização.'));
      navigator.geolocation.getCurrentPosition(p => ok(p.coords), (e) => falha(new Error(
        e.code === 1 ? 'Você não permitiu a localização. Toque no cadeado ao lado do endereço do site (ou nas configurações do celular) e permita a localização para a Comunidade.'
        : e.code === 3 ? 'O GPS demorou para responder. Tente de novo perto de uma janela.'
        : 'Não consegui pegar a sua localização. Confira se a localização do celular está ligada.')),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    });
  }
  const haQuanto = (iso) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 2 ? 'agora' : m < 60 ? 'há ' + m + ' min' : 'há ' + Math.round(m / 60) + ' h';
  };
  const dist = (m) => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : m + ' m';

  let CFG = null, pos = null;
  async function lerConfig() {
    const { data } = await sb.rpc('radar_minha_config');
    CFG = (data && data[0]) || { ativo: false, esconder_de: [] };
    return CFG;
  }
  function pintarStatus() {
    $('rdStatus').textContent = CFG.ativo
      ? (CFG.invisivel ? '👻 Você está invisível · ' : '🟢 Radar ligado · ') + 'localização atualizada ' + haQuanto(CFG.atualizado_em) + (CFG.precisao_m ? ' (precisão ' + CFG.precisao_m + ' m)' : '')
      : 'Pessoas e lugares perto de você';
    // Onde estou (check-in ativo)
    const box = $('rdAqui'); box.innerHTML = '';
    if (CFG.checkin_lugar) {
      const d = el('div', 'rd-aqui');
      const t = el('div'); t.append('📍 Você está no ', Object.assign(el('a', null, CFG.checkin_nome), { href: 'lugar.html?id=' + CFG.checkin_lugar }));
      t.querySelector('a').style.cssText = 'color:var(--marca);font-weight:700';
      const b = el('button', null, 'Fazer check-out'); b.type = 'button';
      b.addEventListener('click', async () => { await sb.rpc('fazer_checkout'); toast('Check-out feito ✓'); await lerConfig(); pintarStatus(); });
      d.append(t, b); box.appendChild(d);
    }
  }

  async function atualizarLocal(silencioso) {
    if (!silencioso) msg('mRadar', 'info', '📡 Pegando a sua localização…');
    try {
      pos = await posicao();
      const { error } = await sb.rpc('radar_atualizar', { p_lat: pos.latitude, p_lng: pos.longitude, p_precisao: Math.round(pos.accuracy || 0) });
      if (error) throw new Error(error.message);
      msg('mRadar'); return true;
    } catch (e) { if (!silencioso) msg('mRadar', 'erro', e.message); return false; }
  }

  async function iniciar() {
    await lerConfig();
    if (!CFG.ativo) { $('rdAtivar').classList.remove('oculto'); $('rdConteudo').classList.add('oculto'); pintarStatus(); return; }
    $('rdAtivar').classList.add('oculto'); $('rdConteudo').classList.remove('oculto');
    await atualizarLocal(true); await lerConfig(); pintarStatus();
    carregarPessoas(); carregarCutucadas(); pintarConfig();
    if (aba === 'lugares') carregarLugares();
  }
  $('bAtivar').addEventListener('click', async () => { $('bAtivar').disabled = true; if (await atualizarLocal(false)) await iniciar(); $('bAtivar').disabled = false; });

  // ---------- Abas ----------
  let aba = 'pessoas';
  const ABAS = { pessoas: 'abaPessoas', lugares: 'abaLugares', config: 'abaConfig' };
  document.querySelectorAll('#abasRd button').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.aba;
    document.querySelectorAll('#abasRd button').forEach(x => x.classList.toggle('sel', x === b));
    Object.entries(ABAS).forEach(([k, id]) => $(id).classList.toggle('oculto', k !== aba));
    if (aba === 'lugares') carregarLugares();
  }));

  // ---------- Pessoas ----------
  let modo = 'proximos', tipo = '';
  const chips = (id, fn) => document.querySelectorAll('#' + id + ' .chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll('#' + id + ' .chip').forEach(x => x.classList.toggle('sel', x === c)); fn(c.dataset.v);
  }));
  chips('rdModo', v => { modo = v; carregarPessoas(); });
  chips('rdTipo', v => { tipo = v; carregarPessoas(); });

  function linhaPessoa(p, botao) {
    const d = el('div', 'rd-p');
    const av = el('a', 'av'); av.href = 'perfil.html?id=' + encodeURIComponent(p.membro || p.de); avatar(av, Object.assign({ id: p.membro || p.de }, p), 120);
    if (p.online) av.appendChild(el('span', 'on'));
    const tx = el('div', 'tx');
    const n = el('a', 'nome'); n.href = av.href; n.append(sexos(p), ' ' + p.apelido + (p.uf ? ' . ' + p.uf : ''));
    tx.appendChild(n);
    return { d, av, tx, botao };
  }
  async function carregarPessoas() {
    const box = $('listaPessoas'); box.innerHTML = '<p class="suave">Procurando…</p>';
    const { data, error } = await sb.rpc('radar_pessoas', { p_modo: modo, p_tipo: tipo || null });
    box.innerHTML = '';
    if (error) { box.textContent = 'Não foi possível: ' + error.message; return; }
    if (!data || !data.length) { box.appendChild(el('p', 'suave', 'Ninguém com o Radar ligado perto de você agora. Volte mais tarde ou chame os amigos para ativar o Radar!')); return; }
    data.forEach(p => {
      const { d, av, tx } = linhaPessoa(p);
      tx.appendChild(el('small', null, p.distancia + (p.online ? ' · 🟢 online agora' : ' · visto ' + haQuanto(p.atualizado_em))));
      if (p.checkin_nome) { const c = el('small', 'ck'); c.append('📍 está no ', Object.assign(el('a', null, p.checkin_nome), { href: 'lugar.html?id=' + p.checkin_lugar })); c.querySelector('a').style.color = 'var(--marca)'; tx.appendChild(c); }
      if (p.a_fim) tx.appendChild(el('span', 'afim', '🔥 A fim de ' + p.a_fim.toLowerCase() + ' hoje'));
      const b = el('button', null, p.cutuquei ? 'Cutucado' : '👉 Cutucar'); b.type = 'button'; b.disabled = p.cutuquei;
      b.addEventListener('click', async () => {
        b.disabled = true;
        const { data: r, error: e } = await sb.rpc('cutucar', { p_para: p.membro });
        toast(e ? e.message : r); if (!e) b.textContent = 'Cutucado'; else b.disabled = false;
      });
      d.append(av, tx, b); box.appendChild(d);
    });
  }
  async function carregarCutucadas() {
    const { data } = await sb.rpc('minhas_cutucadas');
    const box = $('listaCutucadas'); box.innerHTML = '';
    $('secCutucadas').classList.toggle('oculto', !(data && data.length));
    (data || []).forEach(c => {
      const { d, av, tx } = linhaPessoa(c);
      tx.appendChild(el('small', null, (c.nova ? '🆕 ' : '') + 'cutucou você ' + haQuanto(c.criado_em)));
      const b = el('button', null, '👉 Cutucar de volta'); b.type = 'button';
      b.addEventListener('click', async () => { b.disabled = true; const { data: r, error: e } = await sb.rpc('cutucar', { p_para: c.de }); toast(e ? e.message : r); });
      d.append(av, tx, b); box.appendChild(d);
    });
    if (window.BASE.avisos) window.BASE.avisos();
  }

  // ---------- Lugares ----------
  let visivel = 'privado';
  try { visivel = localStorage.getItem('cl_ck_vis') || 'privado'; } catch (e) {}
  const pintarVis = () => document.querySelectorAll('#ckVis .chip').forEach(c => c.classList.toggle('sel', c.dataset.v === visivel));
  document.querySelectorAll('#ckVis .chip').forEach(c => c.addEventListener('click', () => { visivel = c.dataset.v; pintarVis(); try { localStorage.setItem('cl_ck_vis', visivel); } catch (e) {} }));
  pintarVis();
  async function carregarLugares() {
    const box = $('listaLugares'); box.innerHTML = '<p class="suave">Procurando lugares…</p>';
    if (!pos) await atualizarLocal(false);
    if (!pos) { box.innerHTML = ''; return; }
    const { data, error } = await sb.rpc('lugares_perto', { p_lat: pos.latitude, p_lng: pos.longitude, p_km: 5 });
    box.innerHTML = '';
    if (error) { box.textContent = 'Não foi possível: ' + error.message; return; }
    if (!data || !data.length) { box.appendChild(el('p', 'suave', 'Nenhum lugar cadastrado num raio de 5 km.')); return; }
    data.forEach(l => {
      const d = el('div', 'lp');
      const th = el('span', 'th'); const im = el('img'); im.alt = ''; im.src = l.foto ? flyer(l.foto) : 'logo-ouro.png'; if (!l.foto) im.className = 'sem'; th.appendChild(im);
      const tx = el('div', 'tx'); const a = el('a', null, l.nome); a.href = 'lugar.html?id=' + l.id;
      const dentro = l.distancia_m <= l.raio_m + Math.min(pos.accuracy || 0, 100);
      tx.append(a, el('small', null, (dentro ? '📍 Você está aqui' : 'a ' + dist(l.distancia_m)) +
        (l.checkins_12h ? ' · 🔥 ' + l.checkins_12h + ' aqui agora' : '') + (l.media ? ' · ★ ' + String(l.media).replace('.', ',') : '')));
      const aqui = CFG.checkin_lugar === l.id;
      const b = el('button', null, aqui ? '✓ Você está aqui' : dentro ? 'Check-in' : 'Longe'); b.type = 'button';
      b.disabled = !dentro || aqui; if (aqui) b.classList.add('feito');
      b.addEventListener('click', async () => {
        b.disabled = true;
        const { data: r0, error: e } = await sb.rpc('fazer_checkin', { p_lugar: l.id, p_lat: pos.latitude, p_lng: pos.longitude,
          p_precisao: Math.round(pos.accuracy || 0), p_visivel: visivel, p_evento: null });
        const r = r0 && r0[0];
        if (e || !r || !r.ok) { b.disabled = false; toast((r && r.mensagem) || (e && e.message) || 'Não foi possível.'); return; }
        try { navigator.vibrate && navigator.vibrate(80); } catch (x) {}
        toast(r.mensagem + (visivel === 'feed' ? ' · publicado no Siga-me' : ''));
        await lerConfig(); pintarStatus(); carregarLugares();
      });
      d.append(th, tx, b); box.appendChild(d);
    });
  }

  // ---------- Ajustes ----------
  function pintarConfig() {
    $('cfgInvisivel').checked = !!CFG.invisivel;
    document.querySelectorAll('.cfgEsc').forEach(c => { c.checked = (CFG.esconder_de || []).includes(c.value); });
    const box = $('rdAfim'); box.innerHTML = '';
    [null].concat(AFIM).forEach(o => {
      const c = el('span', 'chip' + ((CFG.a_fim || null) === o ? ' sel' : ''), o ? o : 'Nada específico');
      c.addEventListener('click', async () => {
        const { error } = await sb.rpc('radar_a_fim', { p_texto: o });
        if (error) { toast(error.message); return; }
        CFG.a_fim = o; pintarConfig(); toast(o ? '🔥 A fim de ' + o.toLowerCase() + ' hoje (por 24h)' : 'Status tirado');
      });
      box.appendChild(c);
    });
  }
  $('cfgSalvar').addEventListener('click', async () => {
    const esc = [...document.querySelectorAll('.cfgEsc')].filter(c => c.checked).map(c => c.value);
    const { error } = await sb.rpc('radar_salvar', { p_invisivel: $('cfgInvisivel').checked, p_esconder: esc });
    if (error) { toast(error.message); return; }
    toast('Ajustes salvos ✓'); await lerConfig(); pintarStatus(); carregarPessoas();
  });
  $('bDesligar').addEventListener('click', async () => {
    if (!$('bDesligar').dataset.ok) { $('bDesligar').dataset.ok = '1'; $('bDesligar').textContent = 'Toque de novo para desligar'; setTimeout(() => { delete $('bDesligar').dataset.ok; $('bDesligar').textContent = 'Desligar o Radar e apagar minha localização'; }, 4000); return; }
    await sb.rpc('radar_desligar'); toast('Radar desligado. Sua localização foi apagada.'); pos = null; iniciar();
  });

  await iniciar();
  // Enquanto o Radar está aberto, atualiza a localização a cada 5 minutos
  setInterval(async () => { if (!document.hidden && CFG && CFG.ativo) { await atualizarLocal(true); await lerConfig(); pintarStatus(); } }, 300000);
})();
