// checkin.js — v1.5 — check-in a qualquer hora: lugares perto pelo GPS, cadastrar o lugar onde estou
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, flyer, toast } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, '');
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };

  // Check-in é sempre público (lugar + perfil + Últimas)
  const visivel = 'feed';

  const posicao = () => window.BASE.posicao();
  const dist = (m) => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : m + ' m';

  let pos = null, onde = null;
  // Lista + busca pelo nome (Comunidade e mapa do OpenStreetMap)
  const busca = window.LUGARES.montar($('listaPerto'), { visivel: () => visivel });
  async function checkin(lugar, botao) {
    botao.disabled = true;
    const { data, error } = await sb.rpc('fazer_checkin', { p_lugar: lugar, p_lat: pos.latitude, p_lng: pos.longitude,
      p_precisao: Math.round(pos.accuracy || 0), p_visivel: visivel, p_evento: null });
    const r = data && data[0];
    if (error || !r || !r.ok) { botao.disabled = false; toast((r && r.mensagem) || (error && error.message) || 'Não foi possível.'); return false; }
    botao.textContent = '✓ Feito'; botao.classList.add('feito');
    try { navigator.vibrate && navigator.vibrate(80); } catch (e) {}
    toast(r.mensagem);
    return true;
  }

  // Última localização que o celular já sabe (do Radar/uso recente): sai na hora, sem esperar o GPS
  const rapida = () => new Promise(ok => {
    try { navigator.geolocation.getCurrentPosition(p => ok(p.coords), () => ok(null), { enableHighAccuracy: false, maximumAge: 10 * 60000, timeout: 2500 }); }
    catch (e) { ok(null); }
  });
  const distM = (a, b) => { const R = 6371000, r = Math.PI / 180, dLa = (b.latitude - a.latitude) * r, dLo = (b.longitude - a.longitude) * r;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  function mostrarPerto(p) {
    pos = p;
    $('secPerto').classList.remove('oculto'); $('secNovo').classList.remove('oculto');
    busca.definirPosicao(pos); return busca.perto(pos);
  }

  $('bProcurar').addEventListener('click', async (ev) => {
    $('bProcurar').disabled = true;
    let mostrado = null;
    // ao abrir a tela: mostra logo os lugares com a localização que o celular já tem
    if (ev && ev.isTrusted === false || !ev) {
      const q = await rapida();
      if (q) { mostrado = q; mostrarPerto(q); }
    }
    msg('mPerto', 'info', mostrado ? '📡 Confirmando a sua localização pelo GPS…' : '📡 Pegando a sua localização pelo GPS…');
    let fina;
    try { fina = await posicao(); } catch (e) { $('bProcurar').disabled = false; if (!mostrado) { msg('mPerto', 'erro', e.message); return; } fina = mostrado; }
    $('bProcurar').disabled = false;
    if (fina.accuracy > 300) msg('mPerto', 'info', '⚠️ O GPS está impreciso (' + Math.round(fina.accuracy) + ' m). Se o lugar não aparecer, vá para perto da entrada e procure de novo.');
    else msg('mPerto');
    $('bProcurar').textContent = '🔄 Procurar de novo';
    // só refaz a lista se a localização boa for diferente da rápida (mais de 150 m)
    if (!mostrado || distM(mostrado, fina) > 150) await mostrarPerto(fina); else pos = fina;
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

  const qsB = new URLSearchParams(location.search);
  if (qsB.get('busca')) busca.buscar(qsB.get('busca'));
  else $('bProcurar').click();   // abriu o Check-in: já procura os lugares perto pelo GPS, sem precisar tocar
})();
