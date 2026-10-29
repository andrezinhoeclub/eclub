// perfil.js — v2.0 — perfil de um membro (layout em cartão central)
(async function () {
  'use strict';
  const { sb, $, msg, idades, visto, avatar, sexos, gradeFotos, moldura, exigirMembro, emBreve, toast,
          CAMPOS, signo, mesDe } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, '');
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const previa = id === eu.id;
  if (id === eu.id && params.get('previa') !== '1') { location.replace('meu-perfil.html'); return; }
  $('carregando').classList.add('oculto');
  if (!/^[0-9a-f-]{36}$/i.test(id)) { $('naoAchado').classList.remove('oculto'); return; }

  const { data: p } = await sb.from('perfis_publicos')
    .select('id, numero, apelido, tipo, sexo_1, sexo_2, idade_1, idade_2, cidade, uf, bio, procura, foto_perfil, verificado, ultimo_acesso, criado_em, detalhes, aniv_1, aniv_2')
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
  if (!online) $('txtStatus').style.color = 'var(--suave)';
  $('txtCidade').textContent = p.cidade + ' . ' + p.uf;

  const anos = Math.max(0, Math.floor((Date.now() - new Date(p.criado_em).getTime()) / (365.25 * 86400000)));
  const badge = (t, cls, alvo) => (alvo || $('badges')).appendChild(el('span', 'badge ' + (cls || ''), t));
  if (p.verificado) badge('✓ Maioridade Verificada', 'verde');
  badge('👑 ' + (anos >= 1 ? anos + (anos === 1 ? ' Ano' : ' Anos') : 'Novo') + ' na comunidade', 'ouro');
  const nomePessoa = (sx, n) => (p.tipo !== 'casal' ? '' : (sx === 'M' ? 'Ele' : 'Ela') + (p.sexo_1 === p.sexo_2 ? ' ' + n : '') + ': ');
  badge(nomePessoa(p.sexo_1, 1) + [signo(p.aniv_1), p.idade_1 + ' Anos'].filter(Boolean).join(' . '), p.sexo_1 === 'M' ? 'azul' : 'rosa', $('badgesIdade'));
  if (p.tipo === 'casal') badge(nomePessoa(p.sexo_2, 2) + [signo(p.aniv_2), p.idade_2 + ' Anos'].filter(Boolean).join(' . '), p.sexo_2 === 'M' ? 'azul' : 'rosa', $('badgesIdade'));
  if (p.tipo === 'casal') {
    const lib = [];
    if (d.sai_sozinho_1) lib.push((p.sexo_1 === 'M' ? 'Ele é liberado' : 'Ela é liberada') + ' para sair sozinh' + (p.sexo_1 === 'M' ? 'o' : 'a') + '.');
    if (d.sai_sozinho_2) lib.push((p.sexo_2 === 'M' ? 'Ele é liberado' : 'Ela é liberada') + ' para sair sozinh' + (p.sexo_2 === 'M' ? 'o' : 'a') + '.');
    $('txtLiberdade').textContent = lib.join(' ');
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
  }
  numeros();
  $('bSeguir').addEventListener('click', async () => {
    $('bSeguir').disabled = true;
    const { data, error } = await sb.rpc('alternar_seguir', { p_membro: id });
    $('bSeguir').disabled = false;
    if (error) { toast('Não foi possível.'); return; }
    toast(data ? 'Agora você segue ' + p.apelido : 'Você deixou de seguir ' + p.apelido);
    numeros();
  });
  $('bMaisAcoes').addEventListener('click', () => $('caixaMais').classList.toggle('oculto'));

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
    return tabela(p.tipo === 'casal' ? (sx === 'M' ? 'Ele' : 'Ela') : (sx === 'M' ? 'Ele' : 'Ela'), linhas);
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
  if (publicas && publicas.length) await gradeFotos($('gradePublica'), publicas);
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
      if (priv && priv.length) await gradeFotos($('gradePrivada'), priv);
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
