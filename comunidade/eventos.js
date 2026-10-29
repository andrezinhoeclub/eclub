// eventos.js — v2.0 — eventos no modelo do CRS: agenda por estado, criar (evento/agenda/viagem),
//                      lista aberta/fechada/secreta, chat do evento, confirmados/pendentes, gerenciar convidados
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, avatar, sexos, flyer, toast, tempo, prepararFoto, UFS } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'agenda');
  $('carregando').classList.add('oculto');

  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const mesmoDia = (a, b) => a.toDateString() === b.toDateString();
  const hora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + 'h';
  function rotuloDia(d) {
    const hoje = new Date(), amanha = new Date(Date.now() + 86400000);
    return mesmoDia(d, hoje) ? 'HOJE' : mesmoDia(d, amanha) ? 'AMANHÃ' : DIAS[d.getDay()];
  }
  function blocoData(iso) {
    const d = new Date(iso), b = el('div', 'ev-data');
    b.append(el('small', null, rotuloDia(d)), el('b', null, String(d.getDate())), el('span', null, MESES[d.getMonth()]));
    return b;
  }
  function quando(e) {
    const d = new Date(e.inicio);
    if (e.tipo === 'viagem') {
      const v = new Date(e.fim);
      return 'Ida ' + d.toLocaleDateString('pt-BR') + ' · volta ' + v.toLocaleDateString('pt-BR');
    }
    const dia = DIAS_LONGOS[d.getDay()];
    return (mesmoDia(d, new Date()) ? 'Hoje, ' + dia : dia.charAt(0).toUpperCase() + dia.slice(1)) + ', a partir das ' + hora(d);
  }
  const ICONE_TIPO = { evento: '🎉', agenda: '📍', viagem: '✈️' };

  const params = new URLSearchParams(location.search);
  UFS.forEach(u => {
    $('filtroUf').appendChild(new Option(u, u));
    $('fUf').appendChild(new Option(u, u));
  });
  for (let h = 0; h < 24; h++) $('fHora').appendChild(new Option(String(h).padStart(2, '0') + ':00h', String(h).padStart(2, '0') + ':00'));
  $('fHora').value = '22:00';
  try { $('filtroUf').value = localStorage.getItem('filtroUf') || eu.uf || ''; } catch (e) { $('filtroUf').value = eu.uf || ''; }

  function mostrar(tela) {
    ['telaLista', 'telaForm', 'telaDetalhe'].forEach(t => $(t).classList.toggle('oculto', t !== tela));
    window.scrollTo(0, 0);
  }

  // ============================== LISTA ==============================
  let aba = ['agenda', 'anteriores', 'meus'].includes(params.get('aba')) ? params.get('aba') : 'proximos';

  function itemEvento(e, destaque) {
    const a = el('a', 'ev-card' + (destaque ? ' destaque-semana' : '')); a.href = 'eventos.html?id=' + e.id;
    if (destaque) a.appendChild(el('div', 'ev-faixa', 'DESTAQUE DA SEMANA!'));
    if (e.capa) { const img = el('img', 'flyer'); img.src = flyer(e.capa); img.alt = e.titulo; img.loading = 'lazy'; a.appendChild(img); }
    const linha = el('div', 'ev-linha');
    const info = el('div', 'ev-info');
    info.appendChild(el('div', 'hora', quando(e)));
    info.appendChild(el('h3', null, (e.tipo !== 'evento' ? ICONE_TIPO[e.tipo] + ' ' : '') + e.titulo));
    if (e.chamada) info.appendChild(el('div', 'suave', e.chamada));
    if (e.local) info.appendChild(el('div', 'ev-local', e.local));
    info.appendChild(el('div', 'onde', [e.endereco, e.cidade && (e.cidade + (e.uf ? ' - ' + e.uf : ''))].filter(Boolean).join(' · ')));
    const sel = el('div', 'ev-selos');
    if (e.meu_status === 'confirmado') sel.appendChild(el('span', 'ev-selo eu', '♥ Eu Vou'));
    if (e.meu_status === 'pendente') sel.appendChild(el('span', 'ev-selo pend', '⏳ Pendente'));
    if (e.lista === 'fechada') sel.appendChild(el('span', 'ev-selo conf', 'Lista Confiável'));
    if (e.lista === 'secreta') sel.appendChild(el('span', 'ev-selo sec', '🔒 Secreto'));
    sel.appendChild(el('span', 'ev-selo', e.confirmados + (e.confirmados === 1 ? ' Confirmado' : ' Confirmados')));
    sel.appendChild(el('span', 'ev-selo leve', '💬 ' + e.mensagens + (e.mensagens === 1 ? ' Mensagem' : ' Mensagens')));
    info.appendChild(sel);
    linha.append(blocoData(e.inicio), info);
    a.appendChild(linha);
    a.addEventListener('click', (ev) => { ev.preventDefault(); history.pushState({}, '', a.href); detalhe(e.id); });
    return a;
  }

  async function lista() {
    mostrar('telaLista');
    document.title = 'Eventos · ' + window.APP.NOME;
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('sel', b.dataset.aba === aba));
    $('filtroUf').classList.toggle('oculto', aba === 'agenda' || aba === 'meus');
    $('tituloLista').textContent = aba === 'agenda' ? '📅 Minha Agenda' : aba === 'meus' ? '✏️ Criados por mim' : '📅 Agenda';
    const { data } = await sb.rpc('lista_eventos', { p_modo: aba, p_uf: $('filtroUf').value || null });
    const evs = data || [];
    $('destaque').innerHTML = ''; $('lista').innerHTML = '';
    let resto = evs;
    if (aba === 'proximos' && evs.length && evs[0].destaque) {
      $('destaque').appendChild(itemEvento(evs[0], true));
      resto = evs.slice(1);
    }
    $('tituloProximos').classList.toggle('oculto', !(aba === 'proximos' && resto.length));
    resto.forEach(e => $('lista').appendChild(itemEvento(e, false)));
    $('vazio').classList.toggle('oculto', evs.length > 0);
    $('txtVazio').textContent = aba === 'agenda' ? 'Sua agenda está vazia. Confirme presença em um evento ou crie uma agenda/viagem.'
      : aba === 'meus' ? 'Você ainda não criou nenhum evento.'
      : aba === 'anteriores' ? 'Nenhum evento anterior.' : 'Nenhum evento marcado' + ($('filtroUf').value ? ' neste estado' : '') + '. Que tal criar um?';
  }
  document.querySelectorAll('#abas button').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.aba; history.replaceState({}, '', 'eventos.html' + (aba === 'proximos' ? '' : '?aba=' + aba)); lista();
  }));
  $('filtroUf').addEventListener('change', () => { try { localStorage.setItem('filtroUf', $('filtroUf').value); } catch (e) {} lista(); });
  $('atalhoAgenda').addEventListener('click', (ev) => { ev.preventDefault(); aba = 'agenda'; history.replaceState({}, '', 'eventos.html?aba=agenda'); lista(); });
  $('atalhoCriar').addEventListener('click', (ev) => { ev.preventDefault(); $('escolherTipo').classList.toggle('oculto'); });
  document.querySelectorAll('#escolherTipo a').forEach(a => a.addEventListener('click', (ev) => {
    ev.preventDefault(); const tipo = new URL(a.href).searchParams.get('criar');
    history.pushState({}, '', 'eventos.html?criar=' + tipo); formulario(tipo, null);
  }));
  document.querySelectorAll('.lnk-voltar').forEach(a => a.addEventListener('click', (ev) => { ev.preventDefault(); history.pushState({}, '', 'eventos.html'); lista(); }));

  // ============================== CRIAR / EDITAR ==============================
  let editando = null, imagemNova = null, lugarEscolhido = null, timerLugar;
  const TEXTOS = {
    evento: ['Evento', 'NOME DO EVENTO', 'Data de início *', 'Preencha todos os campos. Os membros poderão confirmar presença.'],
    agenda: ['Agenda', 'NOME (ex.: Sexta no Bar X)', 'Data *', 'Preencha abaixo qual é o local, data e hora em que vocês vão chegar, para adicionar na sua Agenda.'],
    viagem: ['Viagem', 'NOME (ex.: Férias em Floripa)', 'Data de ida *', 'Preencha abaixo qual é seu destino e as datas de ida e volta, para adicionar na sua Agenda.']
  };
  const radio = (nome) => (document.querySelector('input[name="' + nome + '"]:checked') || {}).value;
  const marcarRadio = (nome, valor) => { const r = document.querySelector('input[name="' + nome + '"][value="' + valor + '"]'); if (r) r.checked = true; };

  function formulario(tipo, ev) {
    editando = ev; imagemNova = null; lugarEscolhido = null;
    tipo = ev ? ev.tipo : (TEXTOS[tipo] ? tipo : 'evento');
    $('telaForm').dataset.tipo = tipo;
    mostrar('telaForm');
    const t = TEXTOS[tipo];
    $('fTitulo').textContent = (ev ? 'Editar ' : '') + t[0];
    $('fAjuda').textContent = t[3];
    $('fNome').previousElementSibling.textContent = t[1] + ' *';
    $('lData').textContent = t[2];
    $('lLocal').textContent = tipo === 'viagem' ? 'Destino *' : 'Local do evento *';
    $('blocoHora').classList.toggle('oculto', tipo === 'viagem');
    $('blocoVolta').classList.toggle('oculto', tipo !== 'viagem');
    $('blocoLink').classList.toggle('oculto', tipo !== 'evento');
    $('opcoesEvento').classList.toggle('oculto', tipo !== 'evento');
    $('fLugarBusca').classList.toggle('oculto', tipo === 'viagem');
    $('fLocal').placeholder = tipo === 'viagem' ? 'Destino (ex.: Florianópolis, hotel…)' : 'Nome do local';
    // Opções fixas: travadas na edição
    document.querySelectorAll('#opcoesFixas input').forEach(i => { i.disabled = !!ev; });
    $('opcoesFixas').firstElementChild.innerHTML = ev ? '<b>Estas opções não podem ser alteradas.</b>' : '<b>Atenção:</b> depois de criado, as opções abaixo não podem ser alteradas.';
    // Valores
    const d = ev ? new Date(ev.inicio) : null;
    $('fNome').value = ev ? ev.titulo : '';
    $('fChamada').value = ev ? (ev.chamada || '') : '';
    $('fDescricao').value = ev ? (ev.descricao || '') : '';
    $('fLugarBusca').value = ''; $('fSugestoes').innerHTML = '';
    $('fLocal').value = ev ? (ev.local || '') : '';
    $('fEndereco').value = ev ? (ev.endereco || '') : '';
    $('fCidade').value = ev ? (ev.cidade || '') : (eu.cidade || '');
    $('fUf').value = ev ? (ev.uf || eu.uf || 'PR') : (eu.uf || 'PR');
    const iso = (x) => { const y = new Date(x); y.setMinutes(y.getMinutes() - y.getTimezoneOffset()); return y.toISOString(); };
    $('fData').value = d ? iso(d).slice(0, 10) : '';
    $('fHora').value = d ? String(d.getHours()).padStart(2, '0') + ':00' : '22:00';
    $('fVolta').value = ev && ev.fim ? iso(ev.fim).slice(0, 10) : '';
    $('fLink').value = ev ? (ev.link || '') : '';
    $('fImagem').value = ''; $('fPrevia').classList.toggle('oculto', !(ev && ev.capa));
    if (ev && ev.capa) $('fPrevia').src = flyer(ev.capa);
    marcarRadio('lista', ev ? ev.lista : 'aberta'); marcarRadio('publico', ev ? ev.publico : 'liberal');
    marcarRadio('exclusivo', ev ? String(ev.exclusivo) : 'true'); marcarRadio('divulgacao', ev ? ev.divulgacao : 'comunidade');
    $('fSalvar').textContent = ev ? 'Salvar alterações' : 'Criar ' + t[0].toLowerCase();
    msg('fMsg');
  }

  // Procurar lugar já cadastrado
  $('fLugarBusca').addEventListener('input', () => {
    clearTimeout(timerLugar);
    timerLugar = setTimeout(async () => {
      const q = $('fLugarBusca').value.trim();
      $('fSugestoes').innerHTML = '';
      if (q.length < 2) return;
      const { data } = await sb.rpc('buscar_lugares', { p_texto: q });
      (data || []).forEach(l => {
        const b = el('div', 'pessoa'); b.style.cursor = 'pointer';
        const t = el('div'); t.append(el('b', null, l.nome), el('div', 'suave', [l.endereco, l.cidade && (l.cidade + ' - ' + (l.uf || ''))].filter(Boolean).join(' · ')));
        b.appendChild(t);
        b.addEventListener('click', () => {
          lugarEscolhido = l.id;
          $('fLocal').value = l.nome; $('fEndereco').value = l.endereco || ''; $('fCidade').value = l.cidade || ''; if (l.uf) $('fUf').value = l.uf;
          $('fSugestoes').innerHTML = ''; $('fLugarBusca').value = '';
        });
        $('fSugestoes').appendChild(b);
      });
      if (!(data || []).length) $('fSugestoes').appendChild(el('p', 'suave', 'Não encontrado. Preencha o nome e o endereço abaixo para cadastrar o local.'));
    }, 350);
  });
  ['fLocal', 'fEndereco', 'fCidade'].forEach(i => $(i).addEventListener('input', () => { lugarEscolhido = null; }));

  $('fImagem').addEventListener('change', async () => {
    const a = $('fImagem').files[0]; if (!a) return;
    if (a.size > 6 * 1024 * 1024) { msg('fMsg', 'erro', 'Imagem maior que 6 MB.'); $('fImagem').value = ''; return; }
    try { imagemNova = await prepararFoto(a); $('fPrevia').src = URL.createObjectURL(imagemNova); $('fPrevia').classList.remove('oculto'); }
    catch (e) { msg('fMsg', 'erro', e.message); $('fImagem').value = ''; }
  });

  $('fSalvar').addEventListener('click', async () => {
    const tipo = $('telaForm').dataset.tipo;
    const titulo = $('fNome').value.trim();
    if (titulo.length < 3) { msg('fMsg', 'erro', 'Preencha o nome.'); return; }
    const local = $('fLocal').value.trim();
    if (!local) { msg('fMsg', 'erro', tipo === 'viagem' ? 'Informe o destino.' : 'Informe o local.'); return; }
    if (!$('fData').value) { msg('fMsg', 'erro', 'Informe a data.'); return; }
    const inicio = new Date($('fData').value + 'T' + (tipo === 'viagem' ? '12:00' : $('fHora').value));
    let fim = null;
    if (tipo === 'viagem') {
      if (!$('fVolta').value) { msg('fMsg', 'erro', 'Informe a data de volta.'); return; }
      fim = new Date($('fVolta').value + 'T23:00');
      if (fim <= inicio) { msg('fMsg', 'erro', 'A volta precisa ser depois da ida.'); return; }
    }
    if (!editando && inicio < new Date(Date.now() - 3600000)) { msg('fMsg', 'erro', 'A data já passou.'); return; }
    const link = $('fLink').value.trim();
    if (link && !/^https:\/\//.test(link)) { msg('fMsg', 'erro', 'O link precisa começar com https://'); return; }

    $('fSalvar').disabled = true; msg('fMsg', 'info', 'Salvando…');
    try {
      // Cadastra o lugar se ainda não existe (para aparecer na busca dos próximos)
      if (!lugarEscolhido && tipo !== 'viagem') {
        const r = await sb.from('lugares').insert({ nome: local, endereco: $('fEndereco').value.trim() || null,
          cidade: $('fCidade').value.trim() || null, uf: $('fUf').value || null, criado_por: eu.id }).select('id').single();
        if (!r.error) lugarEscolhido = r.data.id;
      }
      let capa = editando ? editando.capa : null;
      if (imagemNova) {
        const caminho = eu.id + '/evento-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
        const up = await sb.storage.from('eventos').upload(caminho, imagemNova, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw new Error('Falha ao enviar a imagem.');
        if (capa && capa.startsWith(eu.id + '/')) await sb.storage.from('eventos').remove([capa]);
        capa = caminho;
      }
      const dados = {
        titulo, chamada: $('fChamada').value.trim() || null, descricao: $('fDescricao').value.trim() || null,
        local, endereco: $('fEndereco').value.trim() || null, cidade: $('fCidade').value.trim() || null, uf: $('fUf').value || null,
        inicio: inicio.toISOString(), fim: fim ? fim.toISOString() : null, capa, lugar: lugarEscolhido,
        link: tipo === 'evento' ? (link || null) : null
      };
      let id;
      if (editando) {
        const r = await sb.from('eventos').update(dados).eq('id', editando.id);
        if (r.error) throw new Error(r.error.message);
        id = editando.id;
      } else {
        Object.assign(dados, { tipo, criado_por: eu.id, lista: radio('lista'),
          publico: tipo === 'evento' ? radio('publico') : 'liberal',
          exclusivo: tipo === 'evento' ? radio('exclusivo') === 'true' : true,
          divulgacao: tipo === 'evento' ? radio('divulgacao') : 'comunidade' });
        const r = await sb.from('eventos').insert(dados).select('id').single();
        if (r.error) throw new Error(/Limite|passou|volta/.test(r.error.message) ? r.error.message : 'Não foi possível salvar.');
        id = r.data.id;
      }
      $('fSalvar').disabled = false;
      toast(editando ? 'Alterações salvas ✓' : 'Criado ✓ Você já está na lista de confirmados.');
      history.replaceState({}, '', 'eventos.html?id=' + id);
      detalhe(id);
    } catch (e) {
      $('fSalvar').disabled = false; msg('fMsg', 'erro', e.message);
    }
  });

  // ============================== DETALHE ==============================
  let atual = null, abaDet = 'chat';

  async function detalhe(id) {
    const { data } = await sb.rpc('evento_detalhe', { p_evento: id });
    const e = data && data[0];
    if (!e) { toast('Evento não encontrado ou sem acesso.'); history.replaceState({}, '', 'eventos.html'); lista(); return; }
    atual = e;
    mostrar('telaDetalhe');
    document.title = e.titulo + ' · ' + window.APP.NOME;
    $('acoesDono').classList.toggle('oculto', !e.sou_dono);
    $('painelGerenciar').classList.add('oculto');
    $('dFlyer').classList.toggle('oculto', !e.capa);
    if (e.capa) $('dFlyer').src = flyer(e.capa);
    $('dData').replaceWith(Object.assign(blocoData(e.inicio), { id: 'dData' }));
    $('dTitulo').textContent = (e.tipo !== 'evento' ? ICONE_TIPO[e.tipo] + ' ' : '') + e.titulo;
    $('dChamada').textContent = e.chamada || '';
    const d = new Date(e.inicio);
    $('dQuando').textContent = e.tipo === 'viagem' ? quando(e)
      : (mesmoDia(d, new Date()) ? 'HOJE, ' : '') + DIAS_LONGOS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES_LONGOS[d.getMonth()] + ', a partir das ' + hora(d);
    $('dLocal').innerHTML = ''; $('dLocal').appendChild(el('b', null, e.local || ''));
    $('dEndereco').innerHTML = '';
    const end = [e.endereco, e.cidade && (e.cidade + (e.uf ? ' - ' + e.uf : ''))].filter(Boolean).join(', ');
    if (end) {
      $('dEndereco').append(end + ' ');
      const m = el('a', null, '(mapa)');
      m.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([e.local, e.endereco, e.cidade, e.uf].filter(Boolean).join(', '));
      m.target = '_blank'; m.rel = 'noopener noreferrer'; $('dEndereco').appendChild(m);
    }
    const lista = { aberta: 'Lista aberta', fechada: 'Lista confiável (o organizador aprova)', secreta: '🔒 Evento secreto' }[e.lista];
    $('dPublico').textContent = e.tipo === 'evento'
      ? 'Evento para o público ' + (e.publico === 'liberal' ? 'Liberal' : 'Misto (liberal e não-liberal)') + ' · ' +
        (e.exclusivo ? 'Exclusivo para membros' : 'Aberto ao público') + ' · ' + lista + (e.criador_apelido ? ' · Criado por ' + e.criador_apelido : '')
      : lista + (e.criador_apelido ? ' · ' + e.criador_apelido : '');
    $('dDescricao').textContent = e.descricao || '';
    $('dDescricao').classList.add('oculto');
    $('dMaisInfo').classList.toggle('oculto', !e.descricao);
    $('dLink').classList.toggle('oculto', !e.link);
    if (e.link) $('dLink').href = e.link;
    pintarParticipar();
    $('tConf').textContent = 'Confirmados (' + e.confirmados + ')';
    $('tPend').textContent = 'Pendentes (' + e.pendentes + ')';
    $('tPend').classList.toggle('oculto', !e.sou_dono || e.lista === 'aberta');
    $('abasDet').style.gridTemplateColumns = e.sou_dono && e.lista !== 'aberta' ? 'repeat(3,1fr)' : 'repeat(2,1fr)';
    $('chatEnvio').classList.remove('oculto');
    mostrarAba(abaDet === 'pendente' && $('tPend').classList.contains('oculto') ? 'chat' : abaDet);
    msg('dMsg');
  }
  $('dMaisInfo').addEventListener('click', (ev) => { ev.preventDefault(); $('dDescricao').classList.toggle('oculto'); });

  function pintarParticipar() {
    const e = atual, b = $('dParticipar');
    const passado = new Date(e.fim || (new Date(e.inicio).getTime() + 8 * 3600000)) < new Date();
    b.classList.remove('secundario', 'vermelho'); b.disabled = false;
    if (passado) { b.textContent = 'Este evento já aconteceu'; b.disabled = true; b.classList.add('secundario'); return; }
    if (e.meu_status === 'confirmado') { b.textContent = e.sou_dono && e.criador === eu.id ? '♥ Você criou e está confirmado' : '♥ Eu vou · toque para sair da lista'; b.classList.add('secundario'); b.disabled = e.criador === eu.id; }
    else if (e.meu_status === 'pendente') { b.textContent = '⏳ Pedido enviado · toque para cancelar'; b.classList.add('secundario'); }
    else if (e.lista === 'fechada') b.textContent = '♥ Pedir para entrar na lista';
    else if (e.lista === 'secreta') { b.textContent = '🔒 Só o organizador adiciona participantes'; b.disabled = true; b.classList.add('secundario'); }
    else b.textContent = '♥ Eu vou';
  }
  $('dParticipar').addEventListener('click', async () => {
    const e = atual;
    if (e.meu_status) {
      if (!$('dParticipar').dataset.ok) { $('dParticipar').dataset.ok = '1'; toast('Toque de novo para confirmar.'); setTimeout(() => delete $('dParticipar').dataset.ok, 3500); return; }
      await sb.rpc('sair_evento', { p_evento: e.id });
      msg('dMsg', 'ok', 'Você saiu da lista.');
    } else {
      const { data, error } = await sb.rpc('participar_evento', { p_evento: e.id });
      if (error) { msg('dMsg', 'erro', error.message); return; }
      msg('dMsg', 'ok', data === 'pendente' ? 'Pedido enviado! O organizador vai aprovar.' : 'Presença confirmada ✓ Está na sua agenda.');
    }
    detalhe(e.id);
  });

  // Abas do detalhe
  function mostrarAba(a) {
    abaDet = a;
    document.querySelectorAll('#abasDet button').forEach(b => b.classList.toggle('sel', b.dataset.aba === a));
    $('abaChat').classList.toggle('oculto', a !== 'chat');
    $('abaPessoas').classList.toggle('oculto', a === 'chat');
    if (a === 'chat') carregarChat(); else carregarPessoas(a);
  }
  document.querySelectorAll('#abasDet button').forEach(b => b.addEventListener('click', () => mostrarAba(b.dataset.aba)));

  async function carregarChat() {
    const { data } = await sb.rpc('mensagens_evento', { p_evento: atual.id });
    $('chatLista').innerHTML = '';
    if (!data || !data.length) { $('chatLista').appendChild(el('div', 'cartao', 'Ninguém escreveu ainda. Puxe o assunto!')); return; }
    data.forEach(m => {
      const d = el('div', 'recado');
      const av = el('a', 'av'); av.href = m.autor === eu.id ? 'meu-perfil.html' : 'perfil.html?id=' + encodeURIComponent(m.autor); avatar(av, m, 120);
      const corpo = el('div', 'corpo');
      const nome = el('a'); nome.href = av.href; nome.append(sexos(m), ' ' + m.apelido, el('span', 'suave', ' . ' + m.uf + ' · ' + tempo(m.criado_em)));
      corpo.append(nome, el('p', null, m.texto));
      if (m.posso_apagar) {
        const ac = el('div', 'acoes-rec'); const x = el('button', null, 'Apagar'); x.type = 'button';
        x.addEventListener('click', async () => { await sb.from('evento_msgs').delete().eq('id', m.id); carregarChat(); });
        ac.appendChild(x); corpo.appendChild(ac);
      }
      d.append(av, corpo); $('chatLista').appendChild(d);
    });
  }
  $('cEnviar').addEventListener('click', async () => {
    const t = $('cTexto').value.trim(); if (!t) return;
    $('cEnviar').disabled = true;
    const { error } = await sb.from('evento_msgs').insert({ evento: atual.id, autor: eu.id, texto: t });
    $('cEnviar').disabled = false;
    if (error) { toast(/Aguarde/.test(error.message) ? error.message : 'Não foi possível enviar.'); return; }
    $('cTexto').value = ''; carregarChat();
  });

  async function carregarPessoas(status) {
    const { data } = await sb.rpc('participantes_evento', { p_evento: atual.id, p_status: status });
    $('pessoas').innerHTML = '';
    const lista = data || [];
    if (!lista.length) { $('pessoas').appendChild(el('div', 'cartao', status === 'pendente' ? 'Nenhum pedido pendente.' : 'Ninguém confirmado ainda.')); return; }
    lista.forEach(p => {
      const linha = el('div', 'pessoa'); linha.style.borderRadius = '0'; linha.style.background = 'var(--cartao)';
      const esq = el('a'); esq.href = p.membro === eu.id ? 'meu-perfil.html' : 'perfil.html?id=' + encodeURIComponent(p.membro);
      esq.style.display = 'flex'; esq.style.gap = '10px'; esq.style.alignItems = 'center';
      const av = el('span', 'av-mini'); avatar(av, p, 100);
      const t = el('div'); const b = el('b'); b.append(sexos(p), ' ' + p.apelido, el('span', 'suave', ' . ' + p.uf));
      t.append(b, el('div', 'suave', p.cidade || ''));
      esq.append(av, t); linha.appendChild(esq);
      if (atual.sou_dono && p.membro !== atual.criador) {
        const bt = el('div', 'botoes');
        if (status === 'pendente') {
          const s = el('button', 'sim', 'Aprovar'); s.type = 'button';
          s.addEventListener('click', async () => { await sb.rpc('decidir_convidado', { p_evento: atual.id, p_membro: p.membro, p_aprovar: true }); detalhe(atual.id); });
          bt.appendChild(s);
        }
        const n = el('button', status === 'pendente' ? '' : 'nao', status === 'pendente' ? 'Recusar' : 'Remover'); n.type = 'button';
        n.addEventListener('click', async () => { await sb.rpc('decidir_convidado', { p_evento: atual.id, p_membro: p.membro, p_aprovar: false }); detalhe(atual.id); });
        bt.appendChild(n); linha.appendChild(bt);
      }
      $('pessoas').appendChild(linha);
    });
  }

  // Dono: gerenciar e editar
  $('dGerenciar').addEventListener('click', (ev) => { ev.preventDefault(); $('painelGerenciar').classList.toggle('oculto'); $('gNumero').focus(); });
  $('dEditar').addEventListener('click', async (ev) => {
    ev.preventDefault();
    const { data } = await sb.from('eventos').select('*').eq('id', atual.id).single();
    if (data) { history.pushState({}, '', 'eventos.html?editar=' + atual.id); formulario(data.tipo, data); }
  });
  $('gAdicionar').addEventListener('click', async () => {
    const n = parseInt($('gNumero').value.replace(/\D/g, ''), 10);
    if (!n) { msg('gMsg', 'erro', 'Digite o nº de membro.'); return; }
    const { data, error } = await sb.rpc('adicionar_convidado', { p_evento: atual.id, p_numero: n });
    if (error) { msg('gMsg', 'erro', error.message); return; }
    $('gNumero').value = ''; msg('gMsg', 'ok', data + ' foi adicionado à lista ✓');
    const e = atual; await detalhe(e.id); $('painelGerenciar').classList.remove('oculto');
  });
  $('dApagar').addEventListener('click', async () => {
    if (!$('dApagar').dataset.ok) { $('dApagar').dataset.ok = '1'; $('dApagar').textContent = 'Toque de novo para apagar'; setTimeout(() => { delete $('dApagar').dataset.ok; $('dApagar').textContent = 'Apagar evento'; }, 4000); return; }
    const capa = atual.capa;
    const { error } = await sb.from('eventos').delete().eq('id', atual.id);
    if (error) { msg('gMsg', 'erro', 'Não foi possível apagar.'); return; }
    if (capa && capa.startsWith(eu.id + '/')) await sb.storage.from('eventos').remove([capa]);
    toast('Evento apagado.'); history.replaceState({}, '', 'eventos.html'); aba = 'proximos'; lista();
  });

  // ============================== NAVEGAÇÃO ==============================
  async function rota() {
    const p = new URLSearchParams(location.search);
    if (p.get('id')) return detalhe(Number(p.get('id')));
    if (p.get('criar')) return formulario(p.get('criar'), null);
    if (p.get('editar')) {
      const { data } = await sb.from('eventos').select('*').eq('id', Number(p.get('editar'))).single();
      if (data && (data.criado_por === eu.id || assinatura.admin)) return formulario(data.tipo, data);
    }
    aba = ['agenda', 'anteriores', 'meus'].includes(p.get('aba')) ? p.get('aba') : 'proximos';
    return lista();
  }
  window.addEventListener('popstate', rota);
  rota();
})();
