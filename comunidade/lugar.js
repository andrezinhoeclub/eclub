// lugar.js — v1.4 — página do lugar: check-in por GPS, informações, quem já esteve, avaliações e fotos
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, flyer, avatar, sexos, toast, prepararFoto, UFS } = window.BASE;
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'agenda');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const id = Number(new URLSearchParams(location.search).get('id'));
  UFS.forEach(u => $('eUf').appendChild(new Option(u, u)));
  const ROTULOS = ['', 'Fraco', 'Regular', 'Bom', 'Ótimo', 'Fantástico'];
  const ASPECTOS = { estrutura: ['🏛️', 'Estrutura', 'da'], atendimento: ['🤝', 'Atendimento', 'do'], musica: ['🎵', 'Música', 'da'],
                     frequentadores: ['👥', 'Frequentadores', 'dos'], custo: ['💰', 'Custo-benefício', 'do'] };
  const fraseAsp = (asp, gostou, plural) => {
    const a = ASPECTOS[asp]; if (!a) return '';
    return a[0] + ' ' + (gostou ? (plural ? 'Gostaram ' : 'Gostou ') : (plural ? 'Não gostaram ' : 'Não gostou ')) + a[2] + ' ' + a[1];
  };
  function estrelas(nota) {
    const s = el('span', 'estrelas'); const n = Math.round(Number(nota) || 0);
    for (let i = 1; i <= 5; i++) s.appendChild(el('span', i <= n ? null : 'vazia', '★'));
    return s;
  }
  function haQuanto(iso) {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (dias < 1) return 'Hoje';
    if (dias < 30) return 'Há ' + dias + (dias === 1 ? ' dia' : ' dias');
    const m = Math.floor(dias / 30.4); if (m < 12) return 'Há ' + m + (m === 1 ? ' mês' : ' meses');
    const a = Math.floor(dias / 365); return 'Há ' + a + (a === 1 ? ' ano' : ' anos');
  }
  if (document.referrer.includes('eventos.html')) $('voltar').href = 'javascript:history.back()';

  let L = null;
  async function carregar() {
    const { data } = await sb.rpc('lugar_detalhe', { p_lugar: id });
    L = data && data[0];
    if (!L) { $('erro').classList.remove('oculto'); return; }
    $('tela').classList.remove('oculto');
    document.title = L.nome + ' · ' + window.APP.NOME;
    $('nome').textContent = L.nome;
    $('nota').innerHTML = ''; $('nota').appendChild(estrelas(L.media));
    $('notaTxt').textContent = L.total ? ROTULOS[Math.round(L.media)] + ' (' + L.total + (L.total === 1 ? ' avaliação)' : ' avaliações)') : 'Ainda sem avaliações';
    // Destaques do que mais falaram
    const ch = $('chips'); ch.innerHTML = '';
    (L.aspectos || []).forEach(a => ch.appendChild(el('span', 'chip-asp' + (a.gostou ? '' : ' nao'), fraseAsp(a.aspecto, a.gostou, true) + ' (' + a.n + ')')));
    const bA = el('button', 'bt-avaliar', L.minha_nota ? '✏️ Minha avaliação' : '⭐ Avaliar'); bA.type = 'button'; bA.addEventListener('click', abrirDialogo);
    ch.appendChild(bA);
    $('bAvaliar2').textContent = L.minha_nota ? '✏️ Editar minha avaliação' : '⭐ Avaliar este lugar';
    // Banner
    const ban = $('banner'); ban.querySelectorAll('img.foto').forEach(i => i.remove());
    if (L.foto) { const i = el('img', 'foto'); i.src = flyer(L.foto); i.alt = ''; ban.appendChild(i); }
    // Informações
    const end = [L.endereco, L.cidade && (L.cidade + (L.uf ? ' - ' + L.uf : ''))].filter(Boolean).join(', ');
    $('endereco').textContent = end || 'Endereço não informado';
    $('mapa').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([L.nome, L.endereco, L.cidade, L.uf].filter(Boolean).join(', '));
    $('euVou').href = 'eventos.html?criar=agenda&lugar=' + L.id;
    $('eventosAqui').classList.toggle('oculto', !L.eventos_futuros);
    $('eventosAqui').textContent = '🎉 ' + L.eventos_futuros + (L.eventos_futuros === 1 ? ' evento marcado aqui' : ' eventos marcados aqui');
    $('eventosAqui').href = 'eventos.html?uf=' + encodeURIComponent(L.uf || '');
    $('site').classList.toggle('oculto', !L.site); if (L.site) { $('site').href = L.site; $('siteTxt').textContent = L.site.replace(/^https?:\/\//, ''); }
    $('func').classList.toggle('oculto', !L.funcionamento); $('funcTxt').textContent = L.funcionamento || '';
    $('sobre').classList.toggle('oculto', !L.sobre); $('sobreTxt').textContent = L.sobre || '';
    $('editarBox').classList.toggle('oculto', !L.posso_editar);
    carregarQuem();
    carregarCheckin();
  }

  // ---------- Check-in por GPS ----------
  const qs = new URLSearchParams(location.search);
  const eventoCk = Number(qs.get('evento')) || null;
  let CK = null, visivel = 'privado';
  const posicao = () => window.BASE.posicao();
  const hora = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  function pintarVis() { document.querySelectorAll('#ckVis .chip').forEach(c => c.classList.toggle('sel', c.dataset.v === visivel)); }
  document.querySelectorAll('#ckVis .chip').forEach(c => c.addEventListener('click', async () => {
    visivel = c.dataset.v; pintarVis();
    // já fez check-in nas últimas horas? muda a visibilidade na hora
    if (CK && CK.meu_ultimo && Date.now() - new Date(CK.meu_ultimo).getTime() < 6 * 3600e3) {
      await sb.rpc('mudar_visibilidade_checkin', { p_lugar: id, p_visivel: visivel === 'feed' ? 'publico' : visivel });
      toast(visivel !== 'privado' ? 'Agora você aparece na página do lugar' : 'Seu check-in agora é só seu'); carregarCheckin(); carregarQuem();
    }
  }));

  async function carregarCheckin() {
    const { data } = await sb.rpc('lugar_checkin_info', { p_lugar: id });
    CK = data && data[0]; if (!CK) return;
    const temLocal = CK.lat != null && CK.lng != null;
    if (CK.meu_visivel && !(visivel === 'feed' && CK.meu_visivel === 'publico')) { visivel = CK.meu_visivel; pintarVis(); }
    $('ckAgora').textContent = CK.agora_total ? '🔥 ' + CK.agora_total + (CK.agora_total === 1 ? ' perfil fez' : ' perfis fizeram') + ' check-in nas últimas 12h' : '';
    if (!temLocal) $('ckStatus').textContent = 'Este lugar ainda não tem a localização marcada, então o check-in ainda não funciona aqui.';
    else if (CK.meu_ultimo) $('ckStatus').textContent = '✓ Seu último check-in aqui: ' + hora(CK.meu_ultimo) + '. O check-in vale como "estive aqui" e libera avaliar o lugar.';
    else $('ckStatus').textContent = 'Está aqui agora? Faça check-in: o celular confere pelo GPS se você está no lugar (até ' + CK.raio_m + ' m). Vale como "estive aqui" e libera avaliar o lugar.';
    $('ckFazer').disabled = !temLocal;
    if (temLocal) $('mapa').href = 'https://www.google.com/maps/search/?api=1&query=' + CK.lat + ',' + CK.lng;
    // Quem está aqui agora (só quem escolheu aparecer)
    const box = $('ckLista'); box.innerHTML = '';
    (CK.agora || []).forEach(p => {
      const a = el('a', 'ck-pessoa'); a.href = p.membro === eu.id ? 'meu-perfil.html' : 'perfil.html?id=' + encodeURIComponent(p.membro);
      const av = el('span', 'av'); avatar(av, p, 80);
      const t = el('div'); const b = el('b'); b.append(sexos(p), ' ' + p.apelido + (p.uf ? ' . ' + p.uf : ''));
      t.append(b, el('small', 'suave', ' · check-in ' + new Date(p.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })));
      a.append(av, t); box.appendChild(a);
    });
    // Marcar a localização (admin, quem criou, responsável)
    $('ckMarcar').classList.toggle('oculto', !CK.posso_marcar);
    $('ckLocalTxt').textContent = temLocal ? '✓ marcada (raio ' + CK.raio_m + ' m)' : '— ainda não marcada';
    $('ckRaio').value = String([80, 150, 250, 400].reduce((m, v) => Math.abs(v - CK.raio_m) < Math.abs(m - CK.raio_m) ? v : m, 150));
  }

  $('ckFazer').addEventListener('click', async () => {
    $('ckFazer').disabled = true; msg('ckMsg', 'info', '📡 Pegando a sua localização pelo GPS…');
    try {
      const c = await posicao();
      const { data, error } = await sb.rpc('fazer_checkin', { p_lugar: id, p_lat: c.latitude, p_lng: c.longitude,
        p_precisao: Math.round(c.accuracy || 0), p_visivel: visivel, p_evento: eventoCk });
      if (error) throw new Error(error.message);
      const r = data && data[0];
      msg('ckMsg', r && r.ok ? 'ok' : 'erro', (r && r.mensagem) || 'Não foi possível.');
      if (r && r.ok) { try { navigator.vibrate && navigator.vibrate(80); } catch (e) {} carregarCheckin(); carregarQuem(); carregar_estive(); }
    } catch (e) { msg('ckMsg', 'erro', e.message); }
    $('ckFazer').disabled = false;
  });
  // depois do check-in, libera o botão de avaliar sem recarregar a página
  function carregar_estive() { if (L) L.estive = true; }

  async function salvarLocal(lat, lng) {
    const { error } = await sb.rpc('definir_local_lugar', { p_lugar: id, p_lat: lat, p_lng: lng, p_raio: Number($('ckRaio').value) });
    if (error) { msg('ckMarcarMsg', 'erro', error.message); return false; }
    msg('ckMarcarMsg', 'ok', 'Localização salva ✓ O check-in já funciona aqui.'); $('ckAchado').classList.add('oculto'); carregarCheckin(); return true;
  }
  $('ckAqui').addEventListener('click', async () => {
    msg('ckMarcarMsg', 'info', '📡 Pegando a localização…');
    try {
      const c = await posicao();
      if (c.accuracy > 100) { msg('ckMarcarMsg', 'erro', 'O GPS está impreciso (' + Math.round(c.accuracy) + ' m). Vá para a porta da casa, ao ar livre, e tente de novo.'); return; }
      salvarLocal(c.latitude, c.longitude);
    } catch (e) { msg('ckMarcarMsg', 'erro', e.message); }
  });
  $('ckRaio').addEventListener('change', () => { if (CK && CK.lat != null) salvarLocal(CK.lat, CK.lng); });
  // Busca gratuita no OpenStreetMap (sem custo do Google)
  $('ckBuscar').addEventListener('click', async () => {
    const q = [L.endereco, L.cidade, L.uf, 'Brasil'].filter(Boolean).join(', ');
    if (!L.endereco) { msg('ckMarcarMsg', 'erro', 'Coloque o endereço do lugar primeiro (em Editar informações).'); return; }
    msg('ckMarcarMsg', 'info', '🔎 Procurando "' + q + '"…');
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=' + encodeURIComponent(q),
        { referrerPolicy: 'strict-origin-when-cross-origin', headers: { 'Accept-Language': 'pt-BR' } });
      const lista = await r.json();
      if (!lista.length) { msg('ckMarcarMsg', 'erro', 'Não achei este endereço no mapa. Confira o endereço ou use "Estou na casa".'); return; }
      const a = lista[0], lat = Number(a.lat), lng = Number(a.lon);
      msg('ckMarcarMsg');
      const box = $('ckAchado'); box.innerHTML = ''; box.classList.remove('oculto');
      box.append(el('div', null, 'Encontrei: ' + a.display_name));
      const ver = el('a', null, '🗺️ conferir no mapa'); ver.href = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng; ver.target = '_blank'; ver.rel = 'noopener noreferrer';
      const ok = el('button', 'btn', 'Está certo, salvar'); ok.type = 'button'; ok.style.marginTop = '8px';
      ok.addEventListener('click', () => salvarLocal(lat, lng));
      box.append(ver, ok);
    } catch (e) { msg('ckMarcarMsg', 'erro', 'Não consegui buscar agora. Tente de novo ou use "Estou na casa".'); }
  });
  if (qs.get('checkin')) setTimeout(() => { $('ckBox').classList.add('ck-foco'); $('ckBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 600);

  async function carregarQuem() {
    const { data } = await sb.rpc('quem_esteve_no_lugar', { p_lugar: id });
    const box = $('quem'); box.innerHTML = '';
    const n = (data || []).length;
    $('tituloQuem').textContent = n ? n + (n === 1 ? ' perfil já esteve aqui' : ' perfis já estiveram aqui') : 'Ninguém da comunidade marcou presença aqui ainda';
    (data || []).forEach(p => {
      const a = el('a', 'pessoa-linha'); a.href = p.membro === eu.id ? 'meu-perfil.html' : 'perfil.html?id=' + encodeURIComponent(p.membro);
      const av = el('span', 'av'); avatar(av, p, 100);
      const t = el('div'); const b = el('b'); b.append(sexos(p), ' ' + p.apelido + ' . ' + (p.uf || ''));
      t.append(b, el('small', null, haQuanto(p.quando) + (p.cidade ? ' · ' + p.cidade : '')));
      a.append(av, t); box.appendChild(a);
    });
  }

  // ---------- Avaliações ----------
  let ultimaData = null;
  async function carregarAvaliacoes(mais) {
    if (!mais) { $('avaliacoes').innerHTML = ''; ultimaData = null; }
    const { data } = await sb.rpc('avaliacoes_do_lugar', { p_lugar: id, p_antes: ultimaData });
    const lista = data || [];
    lista.forEach(a => {
      const d = el('div', 'aval');
      const av = el('a', 'av'); av.href = a.minha ? 'meu-perfil.html' : 'perfil.html?id=' + encodeURIComponent(a.autor); avatar(av, a, 100);
      const c = el('div', 'corpo');
      const nome = el('a'); nome.href = av.href; nome.style.cssText = 'color:var(--texto);text-decoration:none;font-weight:700';
      nome.append(sexos(a), ' ' + a.apelido + ' . ' + (a.uf || ''));
      c.appendChild(nome);
      if (a.texto) c.appendChild(el('p', null, a.texto));
      if (a.aspecto) { const x = el('div', 'chips-asp'); x.appendChild(el('span', 'chip-asp' + (a.gostou ? '' : ' nao'), fraseAsp(a.aspecto, a.gostou, false))); c.appendChild(x); }
      const r = el('div', 'rod'); r.append(estrelas(a.nota), el('span', null, ROTULOS[a.nota]), el('span', null, new Date(a.criado_em).toLocaleDateString('pt-BR')));
      if (a.minha) {
        const ed = el('button', null, 'Editar'); ed.type = 'button'; ed.style.color = 'var(--marca)'; ed.addEventListener('click', abrirDialogo);
        const x = el('button', null, 'Excluir'); x.type = 'button';
        x.addEventListener('click', async () => {
          if (!x.dataset.ok) { x.dataset.ok = '1'; x.textContent = 'Toque de novo para excluir'; setTimeout(() => { delete x.dataset.ok; x.textContent = 'Excluir'; }, 4000); return; }
          await sb.from('avaliacoes_lugares').delete().eq('id', a.id); toast('Avaliação excluída.'); carregar(); carregarAvaliacoes();
        });
        r.append(ed, x);
      }
      c.appendChild(r); d.append(av, c); $('avaliacoes').appendChild(d);
      ultimaData = a.criado_em;
    });
    if (!mais && !lista.length) $('avaliacoes').appendChild(el('div', 'cartao', 'Ninguém avaliou este lugar ainda.'));
    $('maisBox').classList.toggle('oculto', lista.length < 20);
  }
  $('bMais').addEventListener('click', () => carregarAvaliacoes(true));

  async function carregarFotos() {
    const { data } = await sb.rpc('fotos_do_lugar', { p_lugar: id });
    const g = $('fotos'); g.innerHTML = '';
    (data || []).forEach(f => { const a = el('a'); a.href = 'eventos.html?id=' + f.evento; a.title = f.titulo; const i = el('img'); i.src = flyer(f.capa); i.alt = f.titulo; i.loading = 'lazy'; a.appendChild(i); g.appendChild(a); });
    if (!(data || []).length) g.appendChild(el('div', 'cartao', 'Ainda não há fotos de eventos neste lugar.'));
  }

  // ---------- Abas ----------
  let aba = 'info';
  function mostrarAba(a) {
    aba = a;
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('sel', b.dataset.aba === a));
    $('abaInfo').classList.toggle('oculto', a !== 'info');
    $('abaAval').classList.toggle('oculto', a !== 'aval');
    $('abaFotos').classList.toggle('oculto', a !== 'fotos');
    if (a === 'aval') carregarAvaliacoes();
    if (a === 'fotos') carregarFotos();
  }
  document.querySelectorAll('#abas button').forEach(b => b.addEventListener('click', () => mostrarAba(b.dataset.aba)));

  // ---------- Diálogo de avaliação ----------
  let nota = 0;
  for (let i = 1; i <= 5; i++) {
    const b = el('button', null, '★'); b.type = 'button'; b.setAttribute('aria-label', i + ' estrelas · ' + ROTULOS[i]);
    b.addEventListener('click', () => { nota = i; pintarNotas(); });
    $('notas').appendChild(b);
  }
  function pintarNotas() {
    [...$('notas').children].forEach((b, i) => b.classList.toggle('on', i < nota));
    $('rotuloNota').textContent = nota ? ROTULOS[nota] : 'Toque nas estrelas';
  }
  Object.entries(ASPECTOS).forEach(([k, a]) => {
    const l = el('label'); const r = el('input'); r.type = 'radio'; r.name = 'aspecto'; r.value = k;
    r.addEventListener('change', () => $('gostouBox').classList.remove('oculto'));
    l.append(r, ' ' + a[0] + ' ' + a[1]); $('aspectos').appendChild(l);
  });
  function abrirDialogo() {
    $('dlg').classList.remove('oculto');
    const pode = L.estive;
    $('dlgBloqueado').classList.toggle('oculto', pode);
    $('dlgForm').classList.toggle('oculto', !pode);
    $('dlgTitulo').textContent = (L.minha_nota ? 'Sua avaliação · ' : 'Avaliar · ') + L.nome;
    nota = L.minha_nota || 0; pintarNotas();
    document.querySelectorAll('input[name=aspecto]').forEach(r => { r.checked = r.value === L.meu_aspecto; });
    $('gostouBox').classList.toggle('oculto', !L.meu_aspecto);
    const g = document.querySelector('input[name=gostou][value="' + (L.meu_gostou === false ? 'nao' : 'sim') + '"]'); if (g) g.checked = true;
    $('dTexto').value = L.meu_texto || '';
    msg('dMsg');
  }
  const fechar = () => $('dlg').classList.add('oculto');
  $('dlgOk').addEventListener('click', fechar);
  $('dCancelar').addEventListener('click', fechar);
  $('dlg').addEventListener('click', (e) => { if (e.target === $('dlg')) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  $('bAvaliar2').addEventListener('click', abrirDialogo);
  $('dSalvar').addEventListener('click', async () => {
    if (!nota) { msg('dMsg', 'erro', 'Escolha de 1 a 5 estrelas.'); return; }
    const asp = (document.querySelector('input[name=aspecto]:checked') || {}).value || null;
    const gostou = (document.querySelector('input[name=gostou]:checked') || {}).value !== 'nao';
    $('dSalvar').disabled = true;
    const { data, error } = await sb.rpc('avaliar_lugar', { p_lugar: id, p_nota: nota, p_aspecto: asp, p_gostou: gostou, p_texto: $('dTexto').value });
    $('dSalvar').disabled = false;
    if (error) { msg('dMsg', 'erro', error.message); return; }
    fechar();
    toast(data === 'criada' ? 'Avaliação publicada ✓' + ($('dTexto').value.trim().length >= 80 ? ' Ela também aparece no Siga-me.' : '') : 'Avaliação atualizada ✓');
    await carregar(); mostrarAba('aval');
  });

  // ---------- Completar informações (quem cadastrou o lugar ou admin) ----------
  $('bEditar').addEventListener('click', () => {
    $('formEditar').classList.toggle('oculto');
    $('eNome').value = L.nome || ''; $('eCidade').value = L.cidade || ''; $('eUf').value = L.uf || '';
    $('eEndereco').value = L.endereco || ''; $('eSite').value = L.site || ''; $('eFunc').value = L.funcionamento || ''; $('eSobre').value = L.sobre || '';
    $('admBox').classList.toggle('oculto', !L.sou_admin);
    $('respAtual').textContent = L.responsavel_apelido ? 'Hoje: ' + L.responsavel_apelido + ' (nº ' + L.responsavel_numero + ').' : 'Hoje: ninguém.';
  });
  $('eSalvar').addEventListener('click', async () => {
    const site = $('eSite').value.trim();
    if (site && !/^https?:\/\//.test(site)) { msg('eMsg', 'erro', 'O site precisa começar com https://'); return; }
    $('eSalvar').disabled = true; msg('eMsg', 'info', 'Salvando…');
    const nomeNovo = $('eNome').value.trim();
    if (nomeNovo.length < 2) { msg('eMsg', 'erro', 'Preencha o nome da casa.'); $('eSalvar').disabled = false; return; }
    const dados = { nome: nomeNovo, cidade: $('eCidade').value.trim() || null, uf: $('eUf').value || null, endereco: $('eEndereco').value.trim() || null, site: site || null, funcionamento: $('eFunc').value.trim() || null, sobre: $('eSobre').value.trim() || null };
    try {
      const arq = $('eFoto').files[0];
      if (arq) {
        if (arq.size > 8 * 1024 * 1024) throw new Error('Foto maior que 8 MB.');
        const blob = await prepararFoto(arq);
        const caminho = eu.id + '/lugar-' + id + '-' + Date.now() + '.jpg';
        const up = await sb.storage.from('eventos').upload(caminho, blob, { contentType: 'image/jpeg' });
        if (up.error) throw new Error('Não foi possível enviar a foto.');
        dados.foto = caminho;
      }
      const { error } = await sb.from('lugares').update(dados).eq('id', id);
      if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Já existe um lugar com esse nome nesta cidade.' : error.message);
      msg('eMsg', 'ok', 'Informações salvas ✓'); $('eFoto').value = '';
      setTimeout(() => $('formEditar').classList.add('oculto'), 900);
      carregar();
    } catch (e) { msg('eMsg', 'erro', e.message); }
    $('eSalvar').disabled = false;
  });

  async function definirResp(numero) {
    const { data, error } = await sb.rpc('admin_responsavel_lugar', { p_lugar: id, p_numero: numero });
    if (error) { msg('eRespMsg', 'erro', error.message); return; }
    msg('eRespMsg', 'ok', numero ? data + ' agora é o responsável ✓' : 'Responsável removido ✓');
    $('eResp').value = ''; carregar();
  }
  $('eRespSalvar').addEventListener('click', () => {
    const n = parseInt($('eResp').value.replace(/\D/g, ''), 10);
    if (!n) { msg('eRespMsg', 'erro', 'Digite o nº do membro.'); return; }
    definirResp(n);
  });
  $('eRespTirar').addEventListener('click', () => definirResp(null));

  await carregar();
  mostrarAba(new URLSearchParams(location.search).get('aba') === 'aval' ? 'aval' : 'info');
})();
