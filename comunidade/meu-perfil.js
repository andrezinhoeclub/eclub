// meu-perfil.js — v2.0 — editar perfil (com detalhes Ele/Ela), fotos, álbum privado e bloqueios
(async function () {
  'use strict';
  const { sb, $, msg, formacao, links, fotoProtegida, gradeFotos, sexos,
          prepararFoto, moldura, exigirMembro, UFS, CAMPOS } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, 'perfil');

  $('txtApelido').append(sexos(eu), ' ' + eu.apelido);
  $('txtTipo').textContent = formacao(eu) + ' · ' + eu.cidade + ' . ' + eu.uf;
  $('txtNumero').textContent = '👑 Nº ' + eu.numero;
  $('linkPrevia').href = 'perfil.html?id=' + encodeURIComponent(eu.id) + '&previa=1';
  sb.rpc('numeros_perfil', { p_id: eu.id }).then(({ data }) => {
    const n = (data && data[0]) || {};
    $('nSeguidores').textContent = n.seguidores || 0; $('nSeguindo').textContent = n.seguindo || 0; $('nPosts').textContent = n.publicacoes || 0;
  });

  // ---------- Detalhes (Ele / Ela, preferências) ----------
  const det = JSON.parse(JSON.stringify(eu.detalhes || {}));
  const novoEl = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  function seletor(valor, opcoes, aoMudar) {
    const s = novoEl('select'); s.appendChild(new Option('—', ''));
    opcoes.forEach(o => s.appendChild(new Option(o, o)));
    s.value = valor || ''; s.addEventListener('change', () => aoMudar(s.value)); return s;
  }
  // Interesse
  const interesse = new Set(Array.isArray(det.interesse) ? det.interesse : []);
  CAMPOS.interesse.forEach(v => {
    const c = novoEl('div', 'chip', v); c.classList.toggle('sel', interesse.has(v));
    c.addEventListener('click', () => { interesse.has(v) ? interesse.delete(v) : interesse.add(v); c.classList.toggle('sel', interesse.has(v)); });
    $('eInteresse').appendChild(c);
  });
  // Estado civil / filhos
  CAMPOS.geral.forEach(([k, rot, ops]) => {
    const w = novoEl('div'); w.appendChild(novoEl('label', 'campo', rot));
    w.appendChild(seletor(det[k], ops, v => { det[k] = v || undefined; })); $('eGeral').appendChild(w);
  });
  // Casal: liberado para sair sozinho
  if (eu.tipo === 'casal') {
    $('eLiberdade').classList.remove('oculto');
    [[1, eu.sexo_1], [2, eu.sexo_2]].forEach(([n, sx]) => {
      const l = novoEl('label', 'chip'); l.style.display = 'inline-flex'; l.style.gap = '6px'; l.style.marginRight = '6px';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!det['sai_sozinho_' + n];
      cb.addEventListener('change', () => { det['sai_sozinho_' + n] = cb.checked || undefined; });
      l.append(cb, (sx === 'M' ? 'Ele é liberado' : 'Ela é liberada') + ' para sair sozinh' + (sx === 'M' ? 'o' : 'a'));
      $('eLiberdade').appendChild(l);
    });
  }
  // Ele / Ela
  function blocoPessoa(n, sx) {
    det['p' + n] = det['p' + n] || {};
    const info = det['p' + n];
    const box = novoEl('div', 'cartao'); box.style.margin = '0'; box.style.background = 'var(--cartao2)';
    box.appendChild(novoEl('h2', null, eu.tipo === 'casal' ? (sx === 'M' ? 'Ele' : 'Ela') + (eu.sexo_1 === eu.sexo_2 ? ' ' + n : '') : 'Sobre mim'));
    CAMPOS.pessoa.forEach(([k, rot, ops]) => {
      box.appendChild(novoEl('label', 'campo', rot));
      if (ops === 'numero') {
        const i = document.createElement('input'); i.type = 'number'; i.min = k === 'altura' ? 120 : 35; i.max = k === 'altura' ? 230 : 250;
        i.value = info[k] || ''; i.addEventListener('input', () => { const v = parseInt(i.value, 10); info[k] = (v >= +i.min && v <= +i.max) ? v : undefined; });
        box.appendChild(i);
      } else box.appendChild(seletor(info[k], ops, v => { info[k] = v || undefined; }));
    });
    $('ePessoas').appendChild(box);
  }
  blocoPessoa(1, eu.sexo_1);
  if (eu.tipo === 'casal') blocoPessoa(2, eu.sexo_2); else $('ePessoas').classList.add('um');
  // Práticas
  det.praticas = det.praticas || {};
  CAMPOS.praticas.forEach(pr => {
    const linha = novoEl('div', 'editor-pratica'); linha.appendChild(novoEl('span', null, pr));
    const s = novoEl('select'); s.style.width = 'auto';
    [['', '—'], ['sempre', 'Curte sempre'], ['vezes', 'Às vezes'], ['nao', 'Não curte']].forEach(([v, t]) => s.appendChild(new Option(t, v)));
    s.value = det.praticas[pr] || '';
    s.addEventListener('change', () => { if (s.value) det.praticas[pr] = s.value; else delete det.praticas[pr]; });
    linha.appendChild(s); $('ePraticas').appendChild(linha);
  });

  // ---------- Dados ----------
  UFS.forEach(u => { const o = document.createElement('option'); o.value = u; o.textContent = u; $('eUf').appendChild(o); });
  $('eBio').value = eu.bio || '';
  $('eCidade').value = eu.cidade || '';
  $('eUf').value = eu.uf || '';
  const procura = new Set(eu.procura || []);
  document.querySelectorAll('#eProcura .chip').forEach(c => {
    c.classList.toggle('sel', procura.has(c.dataset.v));
    c.addEventListener('click', () => {
      if (procura.has(c.dataset.v)) procura.delete(c.dataset.v); else procura.add(c.dataset.v);
      c.classList.toggle('sel', procura.has(c.dataset.v));
    });
  });

  $('bSalvar').addEventListener('click', async () => {
    const cidade = $('eCidade').value.trim();
    if (cidade.length < 2 || !$('eUf').value) { msg('mDados', 'erro', 'Informe cidade e UF.'); return; }
    if (!procura.size) { msg('mDados', 'erro', 'Marque quem vocês procuram.'); return; }
    $('bSalvar').disabled = true;
    det.interesse = [...interesse];
    const limpo = JSON.parse(JSON.stringify(det));   // tira campos vazios
    const { error } = await sb.from('perfis').update({
      bio: $('eBio').value.trim() || null, cidade, uf: $('eUf').value, procura: [...procura], detalhes: limpo
    }).eq('id', eu.id);
    $('bSalvar').disabled = false;
    msg('mDados', error ? 'erro' : 'ok', error ? 'Não foi possível salvar.' : 'Salvo ✓');
  });

  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');

  // ---------- Fotos ----------
  let fotoPerfil = eu.foto_perfil, selecionada = null;

  async function mostrarAvatar() {
    $('avatar').textContent = '👤';
    if (!fotoPerfil) return;
    const u = await links([fotoPerfil]);
    if (u[fotoPerfil]) { $('avatar').textContent = ''; $('avatar').appendChild(fotoProtegida(u[fotoPerfil], { cortar: true, largura: 300 })); }
  }

  async function carregarFotos() {
    const { data } = await sb.from('fotos').select('id, caminho, album')
      .eq('dono', eu.id).order('criado_em', { ascending: false });
    const fotos = data || [];
    const pub = fotos.filter(f => f.album === 'publico'), priv = fotos.filter(f => f.album === 'privado');
    $('qPub').textContent = '(' + pub.length + '/40)';
    $('nFotos').textContent = pub.length;
    $('qPriv').textContent = '(' + priv.length + '/100)';
    const opc = {
      etiqueta: f => (f.caminho === fotoPerfil ? '⭐ perfil' : ''),
      aoClicar: (f, url) => {
        selecionada = f;
        $('fPerfil').classList.toggle('oculto', f.album !== 'publico');
        $('fMover').textContent = f.album === 'publico' ? 'Mover p/ álbum privado' : 'Mover p/ fotos públicas';
        $('painelFoto').classList.remove('oculto');
        $('painelFoto').scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('painelFoto').dataset.url = url;
      }
    };
    await gradeFotos($('gradePub'), pub, opc);
    await gradeFotos($('gradePriv'), priv, opc);
    mostrarAvatar();
  }

  function fecharPainel() { selecionada = null; $('painelFoto').classList.add('oculto'); }
  $('fFechar').addEventListener('click', fecharPainel);

  $('fPerfil').addEventListener('click', async () => {
    if (!selecionada) return;
    const { error } = await sb.from('perfis').update({ foto_perfil: selecionada.caminho }).eq('id', eu.id);
    if (error) { msg('mFotos', 'erro', error.message); return; }
    fotoPerfil = selecionada.caminho; fecharPainel(); msg('mFotos', 'ok', 'Foto de perfil atualizada ✓');
    carregarFotos();
  });

  $('fMover').addEventListener('click', async () => {
    if (!selecionada) return;
    const destino = selecionada.album === 'publico' ? 'privado' : 'publico';
    const { error } = await sb.from('fotos').update({ album: destino }).eq('id', selecionada.id);
    if (error) { msg('mFotos', 'erro', error.message); return; }
    if (destino === 'privado' && fotoPerfil === selecionada.caminho) fotoPerfil = null;
    fecharPainel(); msg('mFotos'); carregarFotos();
  });

  let confirmarApagar = false;
  $('fApagar').addEventListener('click', async () => {
    if (!selecionada) return;
    if (!confirmarApagar) { confirmarApagar = true; $('fApagar').textContent = 'Toque de novo para apagar'; setTimeout(() => { confirmarApagar = false; $('fApagar').textContent = 'Apagar'; }, 4000); return; }
    confirmarApagar = false; $('fApagar').textContent = 'Apagar';
    const f = selecionada;
    const { error } = await sb.from('fotos').delete().eq('id', f.id);
    if (error) { msg('mFotos', 'erro', 'Não foi possível apagar.'); return; }
    await sb.storage.from('fotos').remove([f.caminho]);
    if (fotoPerfil === f.caminho) fotoPerfil = null;
    fecharPainel(); msg('mFotos', 'ok', 'Foto apagada.'); carregarFotos();
  });

  $('upArquivos').addEventListener('change', async () => {
    const arquivos = [...$('upArquivos').files];
    $('upArquivos').value = '';
    if (!arquivos.length) return;
    const album = $('upAlbum').value;
    let ok = 0, falhas = [];
    for (let i = 0; i < arquivos.length; i++) {
      msg('mFotos', 'info', 'Enviando ' + (i + 1) + ' de ' + arquivos.length + '…');
      try {
        const blob = await prepararFoto(arquivos[i]);
        const caminho = eu.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        const up = await sb.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw new Error('Falha no envio.');
        const ins = await sb.from('fotos').insert({ dono: eu.id, caminho, album });
        if (ins.error) { await sb.storage.from('fotos').remove([caminho]); throw new Error(ins.error.message); }
        ok++;
        if (!fotoPerfil && album === 'publico') {     // primeira foto pública vira a de perfil
          const r = await sb.from('perfis').update({ foto_perfil: caminho }).eq('id', eu.id);
          if (!r.error) fotoPerfil = caminho;
        }
      } catch (e) { falhas.push(e.message); }
    }
    msg('mFotos', falhas.length ? 'erro' : 'ok',
      ok + ' foto(s) enviada(s).' + (falhas.length ? ' Problemas: ' + [...new Set(falhas)].join(' ') : ''));
    carregarFotos();
  });

  carregarFotos();

  // ---------- Pedidos e acessos do álbum ----------
  function pessoa(id, apelido, botoes) {
    const d = document.createElement('div'); d.className = 'pessoa';
    const a = document.createElement('a'); a.href = 'perfil.html?id=' + encodeURIComponent(id); a.textContent = apelido;
    const b = document.createElement('div'); b.className = 'botoes';
    botoes.forEach(([texto, classe, acao]) => {
      const x = document.createElement('button'); x.type = 'button'; x.textContent = texto; if (classe) x.className = classe;
      x.addEventListener('click', async () => { x.disabled = true; await acao(); });
      b.appendChild(x);
    });
    d.append(a, b); return d;
  }

  async function carregarAlbum() {
    const { data: peds } = await sb.from('album_pedidos').select('solicitante, status')
      .eq('dono', eu.id).in('status', ['pendente', 'aceito']).order('criado_em', { ascending: false });
    const lista = peds || [];
    const ids = lista.map(p => p.solicitante);
    const nomes = {};
    if (ids.length) {
      const { data: ps } = await sb.from('perfis_publicos').select('id, apelido').in('id', ids);
      (ps || []).forEach(p => { nomes[p.id] = p.apelido; });
    }
    $('listaPedidos').innerHTML = ''; $('listaAcessos').innerHTML = '';
    lista.forEach(p => {
      const nome = nomes[p.solicitante]; if (!nome) return;
      if (p.status === 'pendente') {
        $('listaPedidos').appendChild(pessoa(p.solicitante, nome, [
          ['Liberar', 'sim', async () => { await sb.rpc('responder_pedido_album', { p_solicitante: p.solicitante, p_aceitar: true }); carregarAlbum(); }],
          ['Recusar', '', async () => { await sb.rpc('responder_pedido_album', { p_solicitante: p.solicitante, p_aceitar: false }); carregarAlbum(); }]
        ]));
      } else {
        $('listaAcessos').appendChild(pessoa(p.solicitante, nome, [
          ['Tirar acesso', '', async () => { await sb.from('album_pedidos').delete().eq('dono', eu.id).eq('solicitante', p.solicitante); carregarAlbum(); }]
        ]));
      }
    });
    $('cartaoPedidos').classList.toggle('oculto', !$('listaPedidos').children.length);
    $('semAcessos').classList.toggle('oculto', !!$('listaAcessos').children.length);
  }
  carregarAlbum();

  // ---------- Bloqueados ----------
  async function carregarBloqueados() {
    const { data } = await sb.rpc('meus_bloqueados');
    $('listaBloq').innerHTML = '';
    (data || []).forEach(b => {
      const d = pessoa(b.id, b.apelido, [
        ['Desbloquear', '', async () => { await sb.from('bloqueios').delete().eq('quem', eu.id).eq('bloqueado', b.id); carregarBloqueados(); }]
      ]);
      d.querySelector('a').removeAttribute('href');
      $('listaBloq').appendChild(d);
    });
    $('semBloq').classList.toggle('oculto', !!(data && data.length));
  }
  carregarBloqueados();
})();
