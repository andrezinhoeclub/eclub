// checkin.js — v1.0 — check-in a qualquer hora: lugares perto pelo GPS, cadastrar o lugar onde estou
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, flyer, toast } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, '');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };

  // Visibilidade (lembrada neste aparelho)
  let visivel = 'privado';
  try { visivel = localStorage.getItem('cl_ck_vis') || 'privado'; } catch (e) {}
  const pintar = () => document.querySelectorAll('#ckVis .chip').forEach(c => c.classList.toggle('sel', c.dataset.v === visivel));
  document.querySelectorAll('#ckVis .chip').forEach(c => c.addEventListener('click', () => {
    visivel = c.dataset.v; pintar(); try { localStorage.setItem('cl_ck_vis', visivel); } catch (e) {}
  }));
  pintar();

  function posicao() {
    return new Promise((ok, falha) => {
      if (!navigator.geolocation) return falha(new Error('Este aparelho não informa a localização.'));
      navigator.geolocation.getCurrentPosition(p => ok(p.coords), (e) => falha(new Error(
        e.code === 1 ? 'Você não permitiu a localização. Toque no cadeado ao lado do endereço do site (ou nas configurações do celular) e permita a localização para a Comunidade.'
        : e.code === 3 ? 'O GPS demorou para responder. Vá para perto da entrada ou de uma janela e tente de novo.'
        : 'Não consegui pegar a sua localização. Confira se a localização do celular está ligada.')),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
  }
  const dist = (m) => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : m + ' m';

  let pos = null, onde = null;
  async function checkin(lugar, botao) {
    botao.disabled = true;
    const { data, error } = await sb.rpc('fazer_checkin', { p_lugar: lugar, p_lat: pos.latitude, p_lng: pos.longitude,
      p_precisao: Math.round(pos.accuracy || 0), p_visivel: visivel, p_evento: null });
    const r = data && data[0];
    if (error || !r || !r.ok) { botao.disabled = false; toast((r && r.mensagem) || (error && error.message) || 'Não foi possível.'); return false; }
    botao.textContent = '✓ Feito'; botao.classList.add('feito');
    try { navigator.vibrate && navigator.vibrate(80); } catch (e) {}
    toast(r.mensagem + (visivel === 'feed' ? ' · publicado no Siga-me' : ''));
    return true;
  }

  $('bProcurar').addEventListener('click', async () => {
    $('bProcurar').disabled = true; msg('mPerto', 'info', '📡 Pegando a sua localização pelo GPS…');
    try { pos = await posicao(); } catch (e) { msg('mPerto', 'erro', e.message); $('bProcurar').disabled = false; return; }
    $('bProcurar').disabled = false;
    if (pos.accuracy > 300) msg('mPerto', 'info', '⚠️ O GPS está impreciso (' + Math.round(pos.accuracy) + ' m). Se o lugar não aparecer, vá para perto da entrada e procure de novo.');
    else msg('mPerto');
    $('bProcurar').textContent = '🔄 Procurar de novo';
    const { data, error } = await sb.rpc('lugares_perto', { p_lat: pos.latitude, p_lng: pos.longitude, p_km: 3 });
    const box = $('listaPerto'); box.innerHTML = '';
    $('secPerto').classList.remove('oculto'); $('secNovo').classList.remove('oculto');
    if (error) { box.textContent = 'Não foi possível buscar: ' + error.message; return; }
    const lista = data || [];
    $('tituloPerto').textContent = lista.length ? 'Perto de você (' + lista.length + ')' : 'Perto de você';
    if (!lista.length) box.appendChild(el('p', 'suave', 'Nenhum lugar cadastrado num raio de 3 km. Cadastre abaixo o lugar onde você está.'));
    lista.forEach(l => {
      const d = el('div', 'lp');
      const th = el('span', 'th'); const im = el('img'); im.alt = ''; im.src = l.foto ? flyer(l.foto) : 'logo-ouro.png'; if (!l.foto) im.className = 'sem'; th.appendChild(im);
      const tx = el('div', 'tx'); const a = el('a', null, l.nome); a.href = 'lugar.html?id=' + l.id;
      const dentro = l.distancia_m <= l.raio_m + Math.min(pos.accuracy || 0, 100);
      tx.append(a, el('small', null, (dentro ? '📍 Você está aqui' : 'a ' + dist(l.distancia_m)) +
        (l.checkins_12h ? ' · 🔥 ' + l.checkins_12h + ' check-in' + (l.checkins_12h > 1 ? 's' : '') + ' hoje' : '') +
        (l.media ? ' · ★ ' + String(l.media).replace('.', ',') : '')));
      if (l.cidade) tx.appendChild(el('small', null, [l.endereco, l.cidade + (l.uf ? ' - ' + l.uf : '')].filter(Boolean).join(', ')));
      const b = el('button', null, dentro ? 'Check-in' : 'Longe'); b.type = 'button'; b.disabled = !dentro;
      if (l.meu_ultimo && Date.now() - new Date(l.meu_ultimo).getTime() < 6 * 3600e3) { b.textContent = '✓ Feito'; b.classList.add('feito'); }
      b.addEventListener('click', () => checkin(l.id, b));
      d.append(th, tx, b); box.appendChild(d);
    });
    // Onde estou (cidade/UF) pelo mapa gratuito do OpenStreetMap, para cadastrar um lugar novo
    onde = null; $('nOnde').textContent = '';
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=' + pos.latitude + '&lon=' + pos.longitude,
        { referrerPolicy: 'strict-origin-when-cross-origin', headers: { 'Accept-Language': 'pt-BR' } });
      const j = await r.json(); const ad = j.address || {};
      const uf = (ad['ISO3166-2-lvl4'] || '').replace('BR-', '');
      onde = { cidade: ad.city || ad.town || ad.village || ad.municipality || '', uf: /^[A-Z]{2}$/.test(uf) ? uf : '',
               endereco: [ad.road, ad.house_number].filter(Boolean).join(', ') + (ad.suburb ? ' - ' + ad.suburb : '') };
      $('nOnde').textContent = '📍 ' + [onde.endereco, onde.cidade && (onde.cidade + (onde.uf ? ' - ' + onde.uf : ''))].filter(Boolean).join(', ');
    } catch (e) { /* sem cidade: o lugar é criado só com a localização */ }
  });

  $('nCriar').addEventListener('click', async () => {
    const nome = $('nNome').value.trim();
    if (!pos) { msg('mNovo', 'erro', 'Toque primeiro em "Achar lugares perto de mim".'); return; }
    if (nome.length < 2) { msg('mNovo', 'erro', 'Digite o nome do lugar.'); return; }
    if (pos.accuracy > 150) { msg('mNovo', 'erro', 'O GPS está impreciso (' + Math.round(pos.accuracy) + ' m). Vá para a porta do lugar e procure de novo antes de cadastrar.'); return; }
    $('nCriar').disabled = true; msg('mNovo', 'info', 'Cadastrando…');
    const { data: id, error } = await sb.rpc('criar_lugar_aqui', { p_nome: nome, p_lat: pos.latitude, p_lng: pos.longitude,
      p_cidade: onde && onde.cidade || null, p_uf: onde && onde.uf || null, p_endereco: onde && onde.endereco || null });
    if (error) { $('nCriar').disabled = false; msg('mNovo', 'erro', error.message); return; }
    const ok = await checkin(id, $('nCriar'));
    msg('mNovo', ok ? 'ok' : 'info', ok ? 'Lugar cadastrado e check-in feito ✓ Abrindo a página do lugar…' : 'Lugar cadastrado.');
    setTimeout(() => { location.href = 'lugar.html?id=' + id; }, 1500);
  });

  if (new URLSearchParams(location.search).get('auto')) $('bProcurar').click();
})();
