// lugares-mapa.js — v1.1 — achar casas pelo GPS e pelo nome: lugares da Comunidade + mapa gratuito (OpenStreetMap)
// Usado pelo Check-in e pelo Radar. window.LUGARES.montar(caixa, { visivel: () => 'privado'|'publico'|'feed', aoFazer })
(function () {
  'use strict';
  const { sb, flyer, toast } = window.BASE;
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const dist = (m) => m == null ? '' : m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : m + ' m';
  const OPC = { referrerPolicy: 'strict-origin-when-cross-origin', headers: { 'Accept-Language': 'pt-BR' } };
  const TIPOS = { nightclub: 'Balada', bar: 'Bar', pub: 'Bar', stripclub: 'Casa noturna', swingerclub: 'Casa de swing', love_hotel: 'Motel',
                  motel: 'Motel', biergarten: 'Bar', events_venue: 'Espaço de eventos', restaurant: 'Restaurante', hotel: 'Hotel' };
  function distM(lat1, lng1, lat2, lng2) {
    const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
    return Math.round(2 * 6371000 * Math.asin(Math.sqrt(a)));
  }
  const UF = (iso) => { const u = (iso || '').replace('BR-', ''); return /^[A-Z]{2}$/.test(u) ? u : ''; };

  // Casas noturnas, bares, swing e motéis no mapa, perto de você (Overpass / OpenStreetMap)
  async function mapaPerto(pos, raio) {
    const q = '[out:json][timeout:15];(' +
      'nwr(around:' + raio + ',' + pos.latitude + ',' + pos.longitude + ')["amenity"~"^(nightclub|bar|pub|stripclub|swingerclub|love_hotel|biergarten|events_venue)$"]["name"];' +
      'nwr(around:' + raio + ',' + pos.latitude + ',' + pos.longitude + ')["tourism"="motel"]["name"];' +
      ');out center 40;';
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, referrerPolicy: 'strict-origin-when-cross-origin' });
    const j = await r.json();
    return (j.elements || []).map(e => {
      const lat = e.lat != null ? e.lat : e.center && e.center.lat, lng = e.lon != null ? e.lon : e.center && e.center.lon, t = e.tags || {};
      return { mapa: true, nome: t.name, lat, lng, tipo: TIPOS[t.amenity] || TIPOS[t.tourism] || '',
               endereco: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', '), cidade: t['addr:city'] || '', uf: '' };
    }).filter(x => x.nome && x.lat != null);
  }
  // Busca pelo nome no mapa (Nominatim / OpenStreetMap), perto de você se tiver GPS
  async function mapaNome(texto, pos) {
    let url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&countrycodes=br&q=' + encodeURIComponent(texto);
    if (pos) url += '&viewbox=' + (pos.longitude - 0.6) + ',' + (pos.latitude + 0.6) + ',' + (pos.longitude + 0.6) + ',' + (pos.latitude - 0.6) + '&bounded=1';
    const j = await (await fetch(url, OPC)).json();
    return (j || []).map(a => {
      const ad = a.address || {};
      return { mapa: true, nome: a.name || (a.display_name || '').split(',')[0], lat: Number(a.lat), lng: Number(a.lon),
               tipo: TIPOS[a.type] || '', endereco: [ad.road, ad.house_number].filter(Boolean).join(', ') + (ad.suburb ? ' - ' + ad.suburb : ''),
               cidade: ad.city || ad.town || ad.village || ad.municipality || '', uf: UF(ad['ISO3166-2-lvl4']) };
    }).filter(x => x.nome);
  }
  // Cidade/UF de um ponto (para cadastrar um lugar do mapa)
  async function ondeFica(lat, lng) {
    try {
      const j = await (await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=' + lat + '&lon=' + lng, OPC)).json();
      const ad = j.address || {};
      return { cidade: ad.city || ad.town || ad.village || ad.municipality || '', uf: UF(ad['ISO3166-2-lvl4']),
               endereco: [ad.road, ad.house_number].filter(Boolean).join(', ') + (ad.suburb ? ' - ' + ad.suburb : '') };
    } catch (e) { return {}; }
  }

  function montar(caixa, opcoes) {
    const o = opcoes || {};
    caixa.innerHTML = '';
    const busca = el('div'); busca.style.cssText = 'display:flex;gap:8px;margin-bottom:10px';
    const inp = el('input'); inp.type = 'search'; inp.placeholder = 'Buscar pelo nome da casa…'; inp.maxLength = 60; inp.style.flex = '1';
    const bt = el('button', 'btn', '🔎'); bt.type = 'button'; bt.style.cssText = 'width:auto;padding:10px 14px';
    busca.append(inp, bt);
    const aviso = el('div', 'msg');
    const lista = el('div');
    const rod = el('p', 'suave', ''); rod.style.cssText = 'font-size:.72rem;text-align:center;margin:8px 0 0';
    rod.textContent = 'Lugares do mapa: © OpenStreetMap';
    caixa.append(busca, aviso, lista, rod);
    let pos = null;
    const msgx = (tipo, t) => { aviso.className = 'msg ' + (tipo || ''); aviso.textContent = t || ''; };

    function linha(l) {
      const d = el('div', 'lp');
      const th = el('span', 'th'); const im = el('img'); im.alt = '';
      im.src = l.foto ? flyer(l.foto) : 'logo-ouro.png'; if (!l.foto) im.className = 'sem'; th.appendChild(im);
      const tx = el('div', 'tx');
      const a = el(l.mapa ? 'b' : 'a', null, l.nome); if (!l.mapa) a.href = 'lugar.html?id=' + l.id; else a.style.cssText = 'display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      const raio = l.raio_m || 150;
      const dentro = pos && l.distancia_m != null && l.distancia_m <= raio + Math.min(pos.accuracy || 0, 100);
      tx.append(a, el('small', null, (l.mapa ? '🗺️ ' + (l.tipo || 'No mapa') + ' · ' : '') +
        (dentro ? '📍 Você está aqui' : l.distancia_m != null ? 'a ' + dist(l.distancia_m) : (l.mapa ? '' : 'sem localização marcada')) +
        (l.checkins_12h ? ' · 🔥 ' + l.checkins_12h + ' aqui agora' : '') + (l.media ? ' · ★ ' + String(l.media).replace('.', ',') : '')));
      const end = [l.endereco, l.cidade && (l.cidade + (l.uf ? ' - ' + l.uf : ''))].filter(Boolean).join(', ');
      if (end) tx.appendChild(el('small', null, end));
      const b = el('button', null, dentro ? 'Check-in' : 'Longe'); b.type = 'button'; b.disabled = !dentro;
      if (l.meu_ultimo && Date.now() - new Date(l.meu_ultimo).getTime() < 6 * 3600e3) { b.textContent = '✓ Feito'; b.classList.add('feito'); }
      b.addEventListener('click', async () => {
        b.disabled = true;
        let id = l.id;
        if (l.mapa) {     // lugar do mapa: entra na Comunidade já com a localização
          const w = (l.cidade && l.uf) ? l : Object.assign({}, l, await ondeFica(l.lat, l.lng));
          const { data, error } = await sb.rpc('criar_lugar_aqui', { p_nome: l.nome, p_lat: l.lat, p_lng: l.lng,
            p_cidade: w.cidade || null, p_uf: w.uf || null, p_endereco: w.endereco || null });
          if (error) { b.disabled = false; toast(error.message); return; }
          id = data;
        }
        const { data: r0, error: e } = await sb.rpc('fazer_checkin', { p_lugar: id, p_lat: pos.latitude, p_lng: pos.longitude,
          p_precisao: Math.round(pos.accuracy || 0), p_visivel: o.visivel ? o.visivel() : 'privado', p_evento: null });
        const r = r0 && r0[0];
        if (e || !r || !r.ok) { b.disabled = false; toast((r && r.mensagem) || (e && e.message) || 'Não foi possível.'); return; }
        b.textContent = '✓ Feito'; b.classList.add('feito');
        try { navigator.vibrate && navigator.vibrate(80); } catch (x) {}
        toast(r.mensagem + ((o.visivel && o.visivel() === 'feed') ? ' · publicado no Siga-me' : ''));
        if (o.aoFazer) o.aoFazer(id);
      });
      d.append(th, tx, b);
      return d;
    }
    // junta Comunidade + mapa, sem repetir (mesmo nome a menos de 300 m)
    function juntar(nossos, mapa) {
      const fora = mapa.filter(m => !nossos.some(n => n.nome.toLowerCase() === m.nome.toLowerCase() ||
        (n.lat != null && distM(n.lat, n.lng, m.lat, m.lng) < 60)));
      if (pos) fora.forEach(m => { m.distancia_m = distM(pos.latitude, pos.longitude, m.lat, m.lng); });
      return nossos.concat(fora.sort((a, b) => (a.distancia_m || 0) - (b.distancia_m || 0)));
    }
    function pintar(itens, titulo) {
      lista.innerHTML = '';
      if (titulo) { const h = el('div', 'suave', titulo); h.style.cssText = 'font-size:.8rem;margin:2px 0 4px'; lista.appendChild(h); }
      if (!itens.length) { lista.appendChild(el('p', 'suave', 'Nada encontrado. Tente outro nome, ou cadastre o lugar onde você está.')); return; }
      itens.forEach(l => lista.appendChild(linha(l)));
    }

    async function perto(p) {
      pos = p || pos;
      if (!pos) return;
      msgx('info', '🔎 Procurando lugares perto de você…');
      const [{ data: nossos }, mapa] = await Promise.all([
        sb.rpc('lugares_perto', { p_lat: pos.latitude, p_lng: pos.longitude, p_km: 3 }),
        mapaPerto(pos, 1500).catch(() => [])]);
      msgx();
      pintar(juntar(nossos || [], mapa), 'Perto de você');
    }
    async function porNome() {
      const t = inp.value.trim();
      if (t.length < 2) { msgx('erro', 'Digite pelo menos 2 letras do nome.'); return; }
      msgx('info', '🔎 Procurando "' + t + '"…');
      const [{ data: nossos }, mapa] = await Promise.all([
        sb.rpc('buscar_lugares', { p_busca: t, p_lat: pos ? pos.latitude : null, p_lng: pos ? pos.longitude : null }),
        mapaNome(t, pos).catch(() => [])]);
      const n = (nossos || []).map(x => Object.assign({}, x, { distancia_m: x.distancia_m }));
      msgx();
      pintar(juntar(n, mapa), 'Resultado para "' + t + '"');
    }
    bt.addEventListener('click', porNome);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') porNome(); });
    return { perto, definirPosicao: (p) => { pos = p; }, buscar: (t) => { inp.value = t; return porNome(); } };
  }

  window.LUGARES = { montar, mapaPerto, mapaNome, ondeFica };
})();
