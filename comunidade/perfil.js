// perfil.js — v2.8 — perfil de um membro (capa, faixas, medalhas e visitas, como no CRS)
(async function () {
  'use strict';
  const { sb, $, msg, idades, visto, avatar, sexos, gradeFotos, moldura, exigirMembro, emBreve, toast,
          CAMPOS, signo, mesDe, links, fotoProtegida } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, '');
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const previa = id === eu.id;
  if (id === eu.id && params.get('previa') !== '1') { location.replace('meu-perfil.html'); return; }
  $('carregando').classList.add('oculto');
  if (!/^[0-9a-f-]{36}$/i.test(id)) { $('naoAchado').classList.remove('oculto'); return; }

  const { data: p } = await sb.from('perfis_publicos')
    .select('id, numero, apelido, tipo, sexo_1, sexo_2, idade_1, idade_2, cidade, uf, bio, procura, foto_perfil, verificado, ultimo_acesso, criado_em, detalhes, aniv_1, aniv_2, capa')
    .eq('id', id).maybeSingle();
  if (!p) { $('naoAchado').classList.remove('oculto'); return; }
  const d = p.detalhes || {};
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };

  document.title = p.apelido + ' · ' + window.APP.NOME;
  if (previa) { $('avisoPrevia').classList.remove('oculto'); $('botoes').classList.add('oculto'); }

  // ---------- Topo ----------
  await avatar($('avatar'), p, 300);
  const online = p.ultimo_acesso && Date.now() - new Date(p.ultimo_acesso).getTime() < 15 * 60000;
  if (online) $('avatar').appendChild(el('span', 'ponto'));
  $('txtNome').append(sexos(p), p.apelido);
  $('txtUf').textContent = '. ' + p.uf;
  $('txtStatus').textContent = online ? 'Online agora' : visto(p.ultimo_acesso);
  if (!previa) sb.rpc('registrar_visita', { p_id: p.id });
  // Capa (poster) com a marca d'água do dono
  if (p.capa) links([p.capa]).then(u => { if (u[p.capa]) $('capa').prepend(fotoProtegida(u[p.capa], { largura: 1200, dono: p.id, alt: 'Capa de ' + p.apelido })); });
  if (previa) { const ed = el('a', 'editar-capa', 'Editar'); ed.href = 'meu-perfil.html#capa'; $('capa').appendChild(ed); }
  // Selos na capa: "A fim de … hoje" (Radar) e "não procura homens solteiros"
  sb.rpc('a_fim_de', { p_membro: p.id }).then(({ data: af }) => { if (af) $('selosCapa').prepend(el('span', 'fim', '🔥 A fim de ' + af.toUpperCase() + ' hoje!')); });
  if (Array.isArray(d.interesse) && d.interesse.length && !d.interesse.includes('Homem')) $('selosCapa').appendChild(el('span', null, 'Esse perfil não procura homens solteiros!'));
  if (!online) $('txtStatus').style.color = 'var(--suave)';
  $('txtCidade').textContent = p.cidade + ' . ' + p.uf;

  const anos = Math.max(0, Math.floor((Date.now() - new Date(p.criado_em).getTime()) / (365.25 * 86400000)));
  const badge = (t, cls, alvo) => (alvo || $('badges')).appendChild(el('span', 'badge ' + (cls || ''), t));  // devolve o elemento
  if (p.verificado) badge('✓ Maioridade Verificada', 'verde');
  badge('👑 ' + (anos >= 1 ? anos + (anos === 1 ? ' Ano' : ' Anos') : 'Novo') + ' na comunidade', 'ouro');
  const nomeDe = (sx, n) => ((d['p' + n] || {}).nome) || ((sx === 'M' ? 'Ele' : 'Ela') + (p.sexo_1 === p.sexo_2 ? ' ' + n : ''));
  const nomePessoa = (sx, n) => (p.tipo !== 'casal' ? '' : nomeDe(sx, n) + ': ');
  badge(nomePessoa(p.sexo_1, 1) + [signo(p.aniv_1), p.idade_1 + ' Anos'].filter(Boolean).join(' . '), p.sexo_1 === 'M' ? 'azul' : 'rosa', $('badgesIdade'));
  if (p.tipo === 'casal') badge(nomePessoa(p.sexo_2, 2) + [signo(p.aniv_2), p.idade_2 + ' Anos'].filter(Boolean).join(' . '), p.sexo_2 === 'M' ? 'azul' : 'rosa', $('badgesIdade'));
  if (p.tipo === 'casal') {
    const lib = [];
    if (d.sai_sozinho_1) lib.push((p.sexo_1 === 'M' ? 'Ele é liberado' : 'Ela é liberada') + ' para sair sozinh' + (p.sexo_1 === 'M' ? 'o' : 'a') + '.');
    if (d.sai_sozinho_2) lib.push((p.sexo_2 === 'M' ? 'Ele é liberado' : 'Ela é liberada') + ' para sair sozinh' + (p.sexo_2 === 'M' ? 'o' : 'a') + '.');
    lib.forEach(t => $('faixas').appendChild(el('div', /^Ele/.test(t) ? 'ele' : 'ela', t)));
  }

  // ---------- Botões ----------
  document.querySelectorAll('[data-breve]').forEach(b => b.addEventListener('click', emBreve));
  async function numeros() {
    const { data } = await sb.rpc('numeros_perfil', { p_id: id });
    const n = (data && data[0]) || {};
    $('nSeguidores').textContent = n.seguidores || 0;
    $('nSeguindo').textContent = n.seguindo || 0;
    $('nPosts').textContent = n.publicacoes || 0;
    $('bSeguir').classList.toggle('on', !!n.sigo);
    $('bSeguir').lastElementChild.textContent = n.sigo ? 'Seguindo' : 'Seguir';
    $('bSeguir').firstElementChild.textContent = n.sigo ? '✓' : '➕';
    if (n.convidados && !$('bConvidados')) { const b = badge('✉️ ' + n.convidados + (n.convidados === 1 ? ' Convidado' : ' Convidados'), 'azul'); b.id = 'bConvidados'; }
    if (n.padrinho_apelido) {
      $('txtPadrinho').textContent = 'Padrinho: ';
      const a = el('a', null, n.padrinho_apelido); a.href = 'perfil.html?id=' + encodeURIComponent(n.padrinho);
      $('txtPadrinho').appendChild(a);
    }
  }
  numeros();
  sb.rpc('eventos_na_agenda', { p_id: id }).then(({ data }) => {
    if (data) { const b = badge('📅 ' + data + (data === 1 ? ' Evento na Agenda' : ' Eventos na Agenda'), 'azul'); b.style.cursor = 'default'; }
  });
  $('bSeguir').addEventListener('click', async () => {
    $('bSeguir').disabled = true;
    const { data, error } = await sb.rpc('alternar_seguir', { p_membro: id });
    $('bSeguir').disabled = false;
    if (error) { toast('Não foi possível.'); return; }
    toast(data ? 'Agora você segue ' + p.apelido : 'Você deixou de seguir ' + p.apelido);
    numeros();
  });
  $('bMaisAcoes').addEventListener('click', () => $('caixaMais').classList.toggle('oculto'));

  // ---------- Amizade, Paquera, Favorito, Anotação (como no CRS) ----------
  $('lAmigos').href = 'minhas.html?ver=amigos&id=' + encodeURIComponent(id);
  $('lSeguidores').href = 'minhas.html?ver=seguidores&id=' + encodeURIComponent(id);
  $('lDepo').href = 'minhas.html?ver=depoimentos&id=' + encodeURIComponent(id);
  let R = {};
  const TIPO_T = { real: 'Amigo Real', virtual: 'Amigo Virtual', conflito: 'Conflito' };
  function rotulo(b, ic, t, on) { b.firstElementChild.textContent = ic; b.lastElementChild.textContent = t; b.classList.toggle('on', !!on); }
  async function relacao() {
    if (previa) return;
    const { data } = await sb.rpc('relacao_com', { p_id: id });
    R = (data && data[0]) || {};
    rotulo($('bPaquerar'), R.retribuida ? '💞' : '💘', R.retribuida ? 'Retribuída' : R.paquerei ? 'Paquerado' : 'Paquerar', R.paquerei);
    rotulo($('bFavoritar'), '⭐', R.favorito ? 'Favorito' : 'Favoritar', R.favorito);
    rotulo($('bAmigo'), R.amizade === 'amigos' ? '🤝' : '👥',
      R.amizade === 'amigos' ? (R.tipo === 'real' ? 'Real' : R.tipo === 'virtual' ? 'Virtual' : 'Conflito')
        : R.amizade === 'enviada' ? 'Pedido enviado' : R.amizade === 'recebida' ? 'Aceitar amigo' : 'Add Amigo', R.amizade === 'amigos');
    $('nAmigos').textContent = R.amigos || 0;
    $('nDepo').textContent = R.depoimentos || 0;
    $('anTexto').value = R.anotacao || '';
    // selos de amizade (como no CRS)
    document.querySelectorAll('.badge.amz').forEach(x => x.remove());
    const selo = (t, cls, href) => { const b = badge(t, cls + ' amz'); if (href) { b.style.cursor = 'pointer'; b.addEventListener('click', () => { location.href = href; }); } };
    const base = 'minhas.html?ver=amigos&id=' + encodeURIComponent(id);
    if (R.amigos_reais) selo('✓ ' + R.amigos_reais + ' Amigos Reais', 'verde', base + '&aba=reais');
    if (R.verificados_gps) selo('📍 ' + R.verificados_gps + ' Amigos Reais Verificados por GPS', 'verde', base + '&aba=verificados');
    selo(R.em_comum ? '🤝 ' + R.em_comum + ' Amigos Reais em comum' : 'Nenhum Amigo Real em comum', 'azul', R.em_comum ? base + '&aba=comum' : null);
    if (R.intimos_mutuos) selo('🔥 ' + R.intimos_mutuos + ' Amigos Íntimos', 'rosa');
  }
  relacao().then(medalhas);
  $('bPaquerar').addEventListener('click', async () => {
    const { data, error } = await sb.rpc('paquerar', { p_id: id });
    if (error) { toast(error.message); return; }
    toast(data === 'retribuida' ? '💞 Paquera retribuída! ' + p.apelido + ' também paquerou você.' : data === 'enviada' ? '💘 Paquera enviada em segredo. Se ' + p.apelido + ' paquerar você também, os dois ficam sabendo.' : 'Paquera desfeita');
    relacao();
  });
  $('bFavoritar').addEventListener('click', async () => {
    const { data, error } = await sb.rpc('favoritar', { p_id: id });
    toast(error ? error.message : data ? '⭐ Adicionado aos Favoritos' : 'Tirado dos Favoritos'); relacao();
  });
  $('bAnotacao').addEventListener('click', () => { $('caixaAnotacao').classList.toggle('oculto'); $('anTexto').focus(); });
  $('anSalvar').addEventListener('click', async () => {
    const { error } = await sb.rpc('salvar_anotacao', { p_id: id, p_texto: $('anTexto').value });
    toast(error ? error.message : $('anTexto').value.trim() ? 'Anotação salva ✓ (só você vê)' : 'Anotação apagada'); relacao();
  });
  if (location.hash === '#anotacao' && !previa) setTimeout(() => { $('caixaMais').classList.remove('oculto'); $('caixaAnotacao').classList.remove('oculto'); $('anTexto').focus(); }, 700);

  // ---------- Medalhas (Avaliação de Perfis, como no CRS) ----------
  const GERAIS = [['interessante', '💡 Interessante', 'Muito mais que sexo…'], ['melhor_ao_vivo', '🌟 Ainda Melhor Ao Vivo', 'Supera expectativas…'],
    ['sexy', '💋 Sexy', 'Atraente, sedutor…'], ['da_pegada', '😈 Da Pegada!', 'Curte sexo! Sem figuração…'], ['baladeiro', '🎵 Baladeiro', 'Curte festas e baladas…'],
    ['divertido', '😃 Divertido', 'Cia agradável, alto astral…'], ['inteligente', '🧠 Inteligente', 'Culto, bom papo…'], ['elegante', '🎩 Elegante', 'Fino, requintado…'],
    ['autentico', '✅ Autêntico', 'Verdadeiro, confiável…']];
  const PESSOA = { gostoso: ['Gostoso', 'Gostosa'], sarado: ['Sarado', 'Sarada'], bonito: ['Bonito', 'Bonita'], sexy: ['Sexy', 'Sexy'], safado: ['Safado', 'Safada'] };
  const nomeMed = (k, sx) => (PESSOA[k] || ['', ''])[sx === 'M' ? 0 : 1];
  function explicarMedalhas() {
    dialogo('Avaliação de Perfis', 'Os <b>Amigos Reais</b> avaliam em segredo, apontando as características que melhor descrevem o perfil. As mais apontadas aparecem aqui como medalhas.<br><br>Só Amigos Reais podem avaliar e ser avaliados. Ninguém fica sabendo como você avaliou.', []);
  }
  async function medalhas() {
    const box = $('medalhas'); box.innerHTML = '';
    const { data: m } = await sb.rpc('medalhas_de', { p_id: id });
    const med = m || {};
    const chip = (t, cls, fn) => { const b = el('span', 'badge ' + (cls || '') + (fn ? ' botao' : ''), t); if (fn) b.addEventListener('click', fn); box.appendChild(b); return b; };
    if (med.pessoa1) chip((med.pessoa1 === 'safado' ? '😈 ' : '🏅 ') + nomeMed(med.pessoa1, p.sexo_1), p.sexo_1 === 'M' ? 'azul' : 'rosa');
    if (p.tipo === 'casal' && med.pessoa2) chip((med.pessoa2 === 'safado' ? '😈 ' : '🏅 ') + nomeMed(med.pessoa2, p.sexo_2), p.sexo_2 === 'M' ? 'azul' : 'rosa');
    (med.gerais || []).forEach(k => { const g = GERAIS.find(x => x[0] === k); if (g) chip(g[1]); });
    if (!previa && R.amizade === 'amigos' && R.tipo === 'real') chip('⭐ Avaliar', 'ouro', formAvaliar);
    if (box.children.length) chip('?', '', explicarMedalhas);
  }
  async function formAvaliar() {
    const { data: a0 } = await sb.rpc('minha_avaliacao', { p_id: id });
    const atual = (a0 && a0[0]) || {};
    const f = el('div', 'dialogo-fundo'); f.style.cssText = 'position:fixed;inset:0;z-index:80;background:#000a;display:flex;align-items:flex-end;justify-content:center';
    const c = el('div', 'cartao av-perfil-form'); c.style.cssText = 'width:100%;max-width:520px;margin:0;border-radius:16px 16px 0 0;padding:16px 16px 22px;max-height:88vh;overflow-y:auto';
    c.appendChild(el('h2', null, 'Avaliar ' + p.apelido)); c.lastChild.style.marginTop = '0';
    c.appendChild(el('p', 'suave', atual.gerais ? 'Você já avaliou este perfil. Salvar de novo substitui a avaliação anterior.' : 'Sua avaliação é anônima! Ninguém vai saber como você avaliou.'));
    const g = el('div', 'grupo', 'Quais características melhor descrevem este perfil?'); g.appendChild(el('small', null, 'marque até 3 opções')); c.appendChild(g);
    const marcados = new Set(atual.gerais || []);
    GERAIS.forEach(([k, t, sub]) => {
      const l = el('label'); const i = el('input'); i.type = 'checkbox'; i.checked = marcados.has(k);
      i.addEventListener('change', () => { if (i.checked) { if (marcados.size >= 3) { i.checked = false; toast('Marque até 3 opções.'); return; } marcados.add(k); } else marcados.delete(k); });
      const s = el('span', null, t); s.appendChild(el('small', null, sub)); l.append(i, s); c.appendChild(l);
    });
    const escolhas = {};
    const pessoas = p.tipo === 'casal' ? [[1, p.sexo_1], [2, p.sexo_2]] : [[1, p.sexo_1]];
    pessoas.forEach(([n, sx]) => {
      const nome = p.tipo === 'casal' ? nomeDe(sx, n) : p.apelido;
      const gp = el('div', 'grupo', 'Qual característica melhor descreve ' + nome + '?'); gp.appendChild(el('small', null, 'marque 1 opção')); c.appendChild(gp);
      escolhas[n] = atual['pessoa' + n] || null;
      Object.keys(PESSOA).forEach(k => {
        const l = el('label'); const i = el('input'); i.type = 'radio'; i.name = 'pessoa' + n; i.checked = escolhas[n] === k;
        i.addEventListener('change', () => { escolhas[n] = k; });
        l.append(i, el('span', null, nomeMed(k, sx))); c.appendChild(l);
      });
    });
    const fechar = () => f.remove();
    const ok = el('button', 'btn', 'Salvar avaliação'); ok.type = 'button'; ok.style.cssText = 'width:100%;margin-top:14px';
    const cancel = el('button', 'btn secundario', 'Cancelar'); cancel.type = 'button'; cancel.style.cssText = 'width:100%;margin-top:8px';
    ok.addEventListener('click', async () => {
      const { error } = await sb.rpc('avaliar_perfil', { p_id: id, p_gerais: [...marcados], p_p1: escolhas[1] || null, p_p2: escolhas[2] || null });
      if (error) { toast(error.message); return; }
      fechar(); toast('Avaliação salva ✓ (anônima)'); medalhas();
    });
    cancel.addEventListener('click', fechar);
    f.addEventListener('click', (e) => { if (e.target === f) fechar(); });
    c.append(ok, cancel); f.appendChild(c); document.body.appendChild(f);
  }
  if (location.hash === '#avaliar' && !previa) setTimeout(() => formAvaliar(), 900);

  // Caixa de diálogo de amizade
  function dialogo(titulo, texto, opcoes) {
    const f = el('div', 'dialogo-fundo'); f.style.cssText = 'position:fixed;inset:0;z-index:80;background:#000a;display:flex;align-items:flex-end;justify-content:center';
    const c = el('div', 'cartao'); c.style.cssText = 'width:100%;max-width:520px;margin:0;border-radius:16px 16px 0 0;padding:18px 16px 22px';
    c.appendChild(el('h2', null, titulo)); c.lastChild.style.marginTop = '0';
    const tx = el('p', 'suave'); tx.innerHTML = texto; c.appendChild(tx);
    const fechar = () => f.remove();
    opcoes.concat([['Cancelar', 'secundario', () => {}]]).forEach(([t, cls, fn]) => {
      const b = el('button', 'btn ' + (cls || ''), t); b.type = 'button'; b.style.marginTop = '8px';
      b.addEventListener('click', async () => { fechar(); await fn(); });
      c.appendChild(b);
    });
    f.addEventListener('click', (e) => { if (e.target === f) fechar(); });
    f.appendChild(c); document.body.appendChild(f);
  }
  const avisoReal = '<br><br><b>Amigo Real</b> é quem você conhece pessoalmente. Marcar como Real sem conhecer é fraude.';
  $('bAmigo').addEventListener('click', () => {
    const nome = '<b>' + p.apelido.replace(/[<>&]/g, '') + '</b>';
    if (R.amizade === 'nenhuma' || !R.amizade) {
      dialogo('Amizade', 'Você conhece ' + nome + ' na vida real?' + avisoReal, [
        ['Conheço no Real', '', async () => { const { data, error } = await sb.rpc('pedir_amizade', { p_id: id, p_real: true }); toast(error ? error.message : data); relacao(); }],
        ['Só no Virtual', 'secundario', async () => { const { data, error } = await sb.rpc('pedir_amizade', { p_id: id, p_real: false }); toast(error ? error.message : data); relacao(); }]]);
    } else if (R.amizade === 'recebida') {
      dialogo('Pedido de amizade', nome + ' quer ser seu amigo. Você conhece ' + nome + ' na vida real?' + avisoReal, [
        ['Conheço no Real', '', async () => { await sb.rpc('responder_amizade', { p_id: id, p_aceitar: true, p_real: true }); toast('Agora vocês são amigos ✓'); relacao(); }],
        ['Só no Virtual', 'secundario', async () => { await sb.rpc('responder_amizade', { p_id: id, p_aceitar: true, p_real: false }); toast('Agora vocês são amigos ✓'); relacao(); }],
        ['Recusar amizade', 'vermelho', async () => { await sb.rpc('responder_amizade', { p_id: id, p_aceitar: false }); toast('Pedido recusado'); relacao(); }]]);
    } else if (R.amizade === 'enviada') {
      dialogo('Amizade', 'Você pediu amizade para ' + nome + '. Aguardando resposta.', [
        ['Cancelar pedido', 'vermelho', async () => { await sb.rpc('remover_amizade', { p_id: id }); toast('Pedido cancelado'); relacao(); }]]);
    } else {
      const txt = R.tipo === 'conflito'
        ? 'Vocês estão em <b>Conflito</b>: um disse que se conhecem no Real e o outro disse Virtual.'
        : 'Vocês são <b>' + TIPO_T[R.tipo] + 's</b>. O que você deseja fazer?';
      dialogo('Amizade', txt, [
        R.eu_disse_real
          ? ['Mudar para Virtual', 'secundario', async () => { await sb.rpc('mudar_amizade', { p_id: id, p_real: false }); toast('Você marcou como Virtual'); relacao(); }]
          : ['Mudar para Real', '', async () => { await sb.rpc('mudar_amizade', { p_id: id, p_real: true }); toast('Você marcou como Real'); relacao(); }],
        [R.intimo ? 'Tirar dos Íntimos' : '🔥 Marcar como Íntimo', 'secundario', async () => {
          const { error } = await sb.rpc('marcar_intimo', { p_id: id, p_sim: !R.intimo });
          toast(error ? error.message : R.intimo ? 'Tirado dos Íntimos' : 'Marcado como Íntimo (só você sabe)'); relacao(); }],
        ['Remover a Amizade', 'vermelho', async () => { await sb.rpc('remover_amizade', { p_id: id }); toast('Amizade removida'); relacao(); }]]);
    }
  });

  // ---------- Informações ----------
  $('txtNumero').textContent = '👑 Nº ' + p.numero;
  $('txtAdesao').textContent = 'Adesão: ' + new Date(p.criado_em).toLocaleDateString('pt-BR');

  function tabela(titulo, linhas) {
    const t = el('table');
    if (titulo) { const tr = el('tr'); const th = el('th', null, titulo); th.colSpan = 2; tr.appendChild(th); t.appendChild(tr); }
    linhas.filter(l => l[1] !== undefined && l[1] !== null && l[1] !== '').forEach(([k, v]) => {
      const tr = el('tr'); tr.append(el('td', null, k), el('td', null, String(v))); t.appendChild(tr);
    });
    return t;
  }
  const geral = CAMPOS.geral.map(([k, rot]) => [rot, d[k]]);
  if (geral.some(g => g[1])) $('infoGeral').appendChild(tabela(null, geral)); else $('infoGeral').remove();

  function pessoa(n, sx, idade, aniv) {
    const info = d['p' + n] || {};
    const linhas = [['Idade', idade + ' Anos'], ['Signo', signo(aniv)], ['Aniversário', mesDe(aniv)]];
    CAMPOS.pessoa.forEach(([k, rot]) => linhas.push([rot.replace(' (cm)', '').replace(' (kg)', ''),
      info[k] ? info[k] + (k === 'altura' ? ' cm' : k === 'peso' ? ' kg' : '') : '']));
    return tabela(p.tipo === 'casal' ? nomeDe(sx, n) : (sx === 'M' ? 'Ele' : 'Ela'), linhas);
  }
  $('infoPessoas').appendChild(pessoa(1, p.sexo_1, p.idade_1, p.aniv_1));
  if (p.tipo === 'casal') $('infoPessoas').appendChild(pessoa(2, p.sexo_2, p.idade_2, p.aniv_2));
  else $('infoPessoas').classList.add('um');

  // ---------- Preferências ----------
  const pref = $('preferencias');
  const linhaPref = (titulo, texto) => { if (!texto) return; const x = el('p'); x.append(el('b', null, titulo), texto); pref.appendChild(x); };
  const PLURAL = { casal: 'Casais', solteira: 'Solteiras', solteiro: 'Solteiros' };
  linhaPref('Procura:', (p.procura || []).map(t => PLURAL[t] || t).join(', ') + '.');
  if (Array.isArray(d.interesse) && d.interesse.length) linhaPref('Interesse em:', d.interesse.join(', ') + '.');
  const pr = d.praticas || {};
  const grupo = (v) => CAMPOS.praticas.filter(x => pr[x] === v).join(', ');
  linhaPref('Curte Sempre:', grupo('sempre') && grupo('sempre') + '.');
  linhaPref('Curte às Vezes:', grupo('vezes') && grupo('vezes') + '.');
  linhaPref('Não Curte:', grupo('nao') ? grupo('nao') + '.' : (Object.keys(pr).length ? 'Não informado' : ''));
  if (p.bio) { const x = el('p'); x.append(el('b', null, 'Proposta:')); const t = el('span', null, p.bio); t.style.whiteSpace = 'pre-wrap'; x.appendChild(t); pref.appendChild(x); }
  if (!pref.children.length) pref.appendChild(el('p', 'suave', 'Ainda não preenchido.'));

  $('tela').classList.remove('oculto');

  // ---------- Fotolog ----------
  const { data: publicas } = await sb.from('fotos').select('caminho, album')
    .eq('dono', id).eq('album', 'publico').order('criado_em', { ascending: false });
  $('qFotos').textContent = (publicas || []).length;
  $('nFotos').textContent = (publicas || []).length;
  if (publicas && publicas.length) await gradeFotos($('gradePublica'), publicas, { dono: id });
  else $('semFotos').classList.remove('oculto');

  // ---------- Álbum privado ----------
  async function mostrarAlbum() {
    msg('mAlbum');
    const { data: acesso } = await sb.rpc('tem_acesso_album', { p_dono: id });
    $('albumLiberado').classList.toggle('oculto', acesso !== true);
    $('albumFechado').classList.toggle('oculto', acesso === true);
    if (acesso === true) {
      const { data: priv } = await sb.from('fotos').select('caminho, album')
        .eq('dono', id).eq('album', 'privado').order('criado_em', { ascending: false });
      if (priv && priv.length) await gradeFotos($('gradePrivada'), priv, { dono: id, vistoPor: true });
      $('albumVazio').classList.toggle('oculto', !!(priv && priv.length));
      return;
    }
    const { data: ped } = await sb.from('album_pedidos').select('status')
      .eq('dono', id).eq('solicitante', eu.id).maybeSingle();
    $('bPedir').classList.toggle('oculto', !!ped && ped.status === 'pendente');
    $('bCancelarPedido').classList.toggle('oculto', !ped || ped.status !== 'pendente');
    $('txtAlbum').textContent = !ped ? 'Só quem o membro liberar consegue ver.'
      : ped.status === 'pendente' ? 'Pedido enviado. Aguardando o membro responder.'
      : 'O membro não liberou o álbum por enquanto. Você pode pedir de novo.';
  }
  $('bPedir').addEventListener('click', async () => {
    $('bPedir').disabled = true;
    await sb.from('album_pedidos').delete().eq('dono', id).eq('solicitante', eu.id);
    const { error } = await sb.from('album_pedidos').insert({ dono: id, solicitante: eu.id });
    $('bPedir').disabled = false;
    if (error) { msg('mAlbum', 'erro', 'Não foi possível enviar o pedido.'); return; }
    mostrarAlbum();
  });
  $('bCancelarPedido').addEventListener('click', async () => {
    await sb.from('album_pedidos').delete().eq('dono', id).eq('solicitante', eu.id);
    mostrarAlbum();
  });
  mostrarAlbum();

  // ---------- Recados ----------
  $('bChat').href = 'chat.html?com=' + encodeURIComponent(id);
  const mural = window.FEED.recados($('mural'), id, eu);
  $('bRecado').addEventListener('click', () => setTimeout(() => $('rTexto').focus(), 300));
  if (location.hash === '#recados') setTimeout(() => { $('recados').scrollIntoView({ block: 'start' }); $('rTexto').focus(); }, 600);
  $('rEnviar').addEventListener('click', async () => {
    const texto = $('rTexto').value.trim();
    if (!texto) { msg('mRecado', 'erro', 'Escreva o recado.'); return; }
    $('rEnviar').disabled = true;
    const { error } = await sb.from('recados').insert({ perfil: id, autor: eu.id, texto });
    $('rEnviar').disabled = false;
    if (error) { msg('mRecado', 'erro', /Limite/.test(error.message) ? error.message : 'Não foi possível enviar o recado.'); return; }
    $('rTexto').value = ''; msg('mRecado', 'ok', 'Recado enviado ✓'); mural.recarregar();
  });

  // ---------- Publicações ----------
  window.FEED.lista($('publicacoes'), eu, 'autor', id, 'Nenhuma publicação ainda.');

  // ---------- Bloquear / Denunciar ----------
  $('bBloquear').addEventListener('click', () => { $('caixaDenuncia').classList.add('oculto'); $('caixaBloquear').classList.toggle('oculto'); });
  $('bConfirmaBloqueio').addEventListener('click', async () => {
    $('bConfirmaBloqueio').disabled = true;
    const { error } = await sb.from('bloqueios').insert({ quem: eu.id, bloqueado: id });
    if (error && !/duplicate/i.test(error.message)) {
      $('bConfirmaBloqueio').disabled = false; msg('mAcoes', 'erro', 'Não foi possível bloquear.'); return;
    }
    location.replace('inicio.html');
  });
  const abrirDenuncia = () => { $('caixaMais').classList.remove('oculto'); $('caixaBloquear').classList.add('oculto'); $('caixaDenuncia').classList.remove('oculto'); };
  $('bDenunciar').addEventListener('click', () => { $('caixaBloquear').classList.add('oculto'); $('caixaDenuncia').classList.toggle('oculto'); });
  if (location.hash === '#denunciar' && !previa) { abrirDenuncia(); $('caixaDenuncia').scrollIntoView({ block: 'center' }); }
  $('bEnviarDenuncia').addEventListener('click', async () => {
    const motivo = $('dMotivo').value;
    if (!motivo) { msg('mAcoes', 'erro', 'Escolha o motivo.'); return; }
    $('bEnviarDenuncia').disabled = true;
    const { error } = await sb.from('denuncias').insert({ denunciante: eu.id, alvo: id, motivo, detalhes: $('dDetalhes').value.trim() || null });
    $('bEnviarDenuncia').disabled = false;
    if (error) {
      const dup = /duplicate/i.test(error.message);
      msg('mAcoes', dup ? 'info' : 'erro', dup ? 'Você já denunciou este perfil por esse motivo. A administração está analisando.' : 'Não foi possível enviar a denúncia.');
      return;
    }
    $('caixaDenuncia').classList.add('oculto');
    msg('mAcoes', 'ok', 'Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.');
  });
})();
