// meu-perfil.js — v3.0 — editar perfil (com detalhes Ele/Ela), capa, e-mail privado, últimas visitas, fotos, álbum privado e bloqueios
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

  // ---------- E-mail de cadastro (só a pessoa vê, mascarado como no CRS) ----------
  sb.auth.getUser().then(({ data }) => {
    const em = (data && data.user && data.user.email) || '';
    const [u, dom] = em.split('@');
    if (u && dom) {
      const mascara = (s) => s.length <= 2 ? s[0] + '_' : s.slice(0, Math.min(3, s.length - 1)) + '____';
      const [d1, ...resto] = dom.split('.');
      $('txtEmail').textContent = mascara(u) + '@' + (d1.length > 2 ? d1[0] + '____' + d1.slice(-1) : d1) + '.' + resto.join('.');
    }
  });

  // ---------- Capa (poster) ----------
  async function pintarCapa(caminho) {
    $('capa').querySelectorAll('canvas').forEach(c => c.remove());
    if (!caminho) return;
    const u = await links([caminho]);
    if (u[caminho]) $('capa').prepend(fotoProtegida(u[caminho], { largura: 1200, dono: eu.id, alt: 'Capa do perfil' }));
  }
  sb.from('perfis').select('capa').eq('id', eu.id).maybeSingle().then(({ data }) => { eu.capa = data && data.capa; pintarCapa(eu.capa); });
  $('bCapa').addEventListener('click', () => {
    if (window.EDITOR_FOTO) window.EDITOR_FOTO.carregarDetector().catch(() => {});
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.addEventListener('change', async () => {
      const arq = i.files[0]; if (!arq) return;
      msg('mCapa', 'info', 'Preparando a capa… confira se nenhum rosto ficou à mostra.');
      let caminho = null;
      try {
        const orig = await prepararFoto(arq);
        const r = await window.EDITOR_FOTO.editar(orig);
        if (!r) { msg('mCapa'); return; }
        msg('mCapa', 'info', 'Enviando a capa…');
        caminho = eu.id + '/capa-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
        const up = await sb.storage.from('fotos').upload(caminho, r.blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) { caminho = null; throw new Error('Falha ao enviar a foto.'); }
        const ins = await sb.from('fotos').insert({ dono: eu.id, caminho, album: 'capa' });
        if (ins.error) throw new Error('Falha ao salvar a foto.');
        const { data: velha, error } = await sb.rpc('definir_capa', { p_caminho: caminho });
        if (error) throw error;
        if (velha) sb.storage.from('fotos').remove([velha]);
        eu.capa = caminho; await pintarCapa(caminho);
        msg('mCapa', 'ok', 'Capa atualizada ✓');
      } catch (e) {
        if (caminho) { await sb.from('fotos').delete().eq('caminho', caminho); await sb.storage.from('fotos').remove([caminho]); }
        msg('mCapa', 'erro', e.message || 'Não foi possível trocar a capa.');
      }
    });
    i.click();
  });

  // ---------- Últimas visitas ao meu perfil (só eu vejo) ----------
  sb.rpc('minhas_visitas', { p_limite: 20 }).then(async ({ data }) => {
    if (!data || !data.length) return;
    const novoEl = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
    $('cartaoVisitas').classList.remove('oculto');
    const fmt = (iso) => {
      const d = new Date(iso), hoje = new Date(), ontem = new Date(Date.now() - 86400000);
      const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + 'h';
      if (d.toDateString() === hoje.toDateString()) return 'Visitou hoje às ' + h;
      if (d.toDateString() === ontem.toDateString()) return 'Visitou ontem às ' + h;
      return 'Visitou em ' + d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) + ', às ' + h;
    };
    data.forEach(v => {
      const linha = novoEl('div', 'v'); const av = novoEl('div', 'av');
      av.textContent = v.tipo === 'casal' ? '💑' : v.tipo === 'solteira' ? '👩' : '👨';
      if (v.foto_perfil) links([v.foto_perfil]).then(u => { if (u[v.foto_perfil]) { av.textContent = ''; av.appendChild(fotoProtegida(u[v.foto_perfil], { cortar: true, largura: 90, dono: v.membro })); } });
      const tx = novoEl('div'); const a = novoEl('a', null, v.apelido + (v.uf ? ' . ' + v.uf : '')); a.href = 'perfil.html?id=' + encodeURIComponent(v.membro);
      tx.append(a, novoEl('small', null, fmt(v.visto_em)));
      linha.append(av, tx); $('listaVisitas').appendChild(linha);
    });
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
    if (eu.tipo === 'casal') {   // nome de cada um no perfil (como o "Sra Equalize" do CRS)
      box.appendChild(novoEl('label', 'campo', 'Como chamar ' + (sx === 'M' ? 'o Ele' : 'a Ela') + ' no perfil'));
      const i = document.createElement('input'); i.type = 'text'; i.maxLength = 24;
      i.placeholder = sx === 'M' ? 'Ex.: Sr. Safado, Marido, Léo…' : 'Ex.: Sra. Equalize, Esposa, Mari…';
      i.value = info.nome || '';
      i.addEventListener('input', () => { const v = i.value.replace(/[<>]/g, '').trim(); info.nome = v || undefined; });
      box.appendChild(i);
      box.appendChild(novoEl('div', 'suave', 'Aparece no perfil no lugar de "' + (sx === 'M' ? 'Ele' : 'Ela') + '". Não use nome verdadeiro.'));
      box.lastChild.style.cssText = 'font-size:.78rem;margin-top:4px';
    }
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

  // ---------- Miniatura borrada (24 px) que fica no banco para quem ainda não tem acesso ----------
  async function miniatura24(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const lado = 24, c = document.createElement('canvas'); c.width = lado; c.height = lado;
      const m = Math.min(img.naturalWidth, img.naturalHeight);
      c.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, lado, lado);
      return c.toDataURL('image/jpeg', 0.5);
    } finally { URL.revokeObjectURL(url); }
  }
  let gerandoMini = false;
  async function gerarMiniaturasPendentes(lista) {   // fotos antigas ainda sem miniatura
    if (gerandoMini || !lista.length) return;
    gerandoMini = true;
    try {
      const urls = await links(lista.slice(0, 40).map(f => f.caminho));
      for (const f of lista.slice(0, 40)) {
        try {
          if (!urls[f.caminho]) continue;
          const blob = await (await fetch(urls[f.caminho])).blob();
          await sb.rpc('salvar_miniatura', { p_foto: f.id, p_mini: await miniatura24(blob) });
        } catch (e) { /* tenta de novo na próxima vez */ }
      }
    } finally { gerandoMini = false; }
  }

  let albuns = [];
  function preencherDestinos() {
    const up = $('upAlbum'), antes = up.value;
    up.innerHTML = '<option value="publico">Enviar para: Fotolog (todos os membros veem)</option>';
    if (!albuns.length) up.insertAdjacentHTML('beforeend', '<option value="novo">Enviar para: 🔒 Álbum privado (só quem eu liberar)</option>');
    albuns.forEach(a => { const o = document.createElement('option'); o.value = 'a' + a.id; o.textContent = 'Enviar para: 🔒 ' + a.nome; up.appendChild(o); });
    if ([...up.options].some(o => o.value === antes)) up.value = antes;
    const de = $('fDestino'); de.innerHTML = '<option value="publico">Fotolog</option>';
    albuns.forEach(a => { const o = document.createElement('option'); o.value = 'a' + a.id; o.textContent = '🔒 ' + a.nome; de.appendChild(o); });
    const cv = $('cvAlbum'); cv.innerHTML = '';
    albuns.forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.nome; cv.appendChild(o); });
  }

  function blocoAlbum(a) {
    const caixa = document.createElement('div'); caixa.className = 'cartao'; caixa.style.cssText = 'margin:8px 0;background:var(--cartao2)';
    const topo = document.createElement('div'); topo.className = 'linha-acoes'; topo.style.cssText = 'margin-top:0;align-items:center;justify-content:space-between';
    const nome = document.createElement('b'); nome.textContent = '🔒 ' + a.nome;
    const info = document.createElement('span'); info.className = 'suave'; info.style.fontSize = '.8rem';
    info.textContent = ' ' + a.fotos + ' foto(s) · ' + a.convidados + ' convidado(s)' + (a.pendentes ? ' · ' + a.pendentes + ' pedido(s)' : '');
    const esq = document.createElement('div'); esq.append(nome, info);
    const dir = document.createElement('div'); dir.className = 'botoes';
    const bRen = document.createElement('button'); bRen.type = 'button'; bRen.className = 'btn secundario'; bRen.style.padding = '6px 10px'; bRen.textContent = 'Renomear';
    bRen.addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 40; inp.value = a.nome;
      const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn'; ok.style.padding = '6px 10px'; ok.textContent = 'Salvar';
      ok.addEventListener('click', async () => {
        const { error } = await sb.rpc('renomear_album', { p_album: a.id, p_nome: inp.value });
        if (error) { msg('mAlbumNovo', 'erro', error.message); return; }
        carregarFotos(); carregarAlbum();
      });
      esq.replaceChildren(inp); dir.replaceChildren(ok);
    });
    let conf = false;
    const bApagar = document.createElement('button'); bApagar.type = 'button'; bApagar.className = 'btn vermelho'; bApagar.style.padding = '6px 10px'; bApagar.textContent = 'Apagar álbum';
    bApagar.addEventListener('click', async () => {
      if (!conf) { conf = true; bApagar.textContent = 'Toque de novo'; setTimeout(() => { conf = false; bApagar.textContent = 'Apagar álbum'; }, 4000); return; }
      const { error } = await sb.rpc('apagar_album', { p_album: a.id });
      if (error) { msg('mAlbumNovo', 'erro', error.message); conf = false; bApagar.textContent = 'Apagar álbum'; return; }
      msg('mAlbumNovo', 'ok', 'Álbum apagado.'); carregarFotos(); carregarAlbum();
    });
    dir.append(bRen, bApagar);
    topo.append(esq, dir);
    const grade = document.createElement('div'); grade.className = 'fotos-grade'; grade.style.marginTop = '8px';
    caixa.append(topo, grade);
    return { caixa, grade };
  }

  async function carregarFotos() {
    const [r1, r2] = await Promise.all([
      sb.from('fotos').select('id, caminho, album, album_id, miniatura').eq('dono', eu.id).order('criado_em', { ascending: false }),
      sb.rpc('meus_albuns')]);
    const fotos = r1.data || [];
    albuns = r2.data || [];
    const pub = fotos.filter(f => f.album === 'publico'), priv = fotos.filter(f => f.album === 'privado');
    $('qPub').textContent = '(' + pub.length + '/40)';
    $('nFotos').textContent = pub.length;
    $('qPriv').textContent = '(' + priv.length + '/100 fotos · ' + albuns.length + '/10 álbuns)';
    preencherDestinos();
    const opc = {
      etiqueta: f => (f.caminho === fotoPerfil ? '⭐ perfil' : ''),
      aoClicar: (f, url) => {
        selecionada = f;
        $('fPerfil').classList.toggle('oculto', f.album !== 'publico');
        $('fDestino').value = f.album === 'publico' ? 'publico' : 'a' + f.album_id;
        $('painelFoto').classList.remove('oculto');
        $('painelFoto').scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('painelFoto').dataset.url = url;
      }
    };
    opc.dono = eu.id;
    await gradeFotos($('gradePub'), pub, opc);
    const cont = $('blocosAlbuns'); cont.innerHTML = '';
    for (const a of albuns) {
      const b = blocoAlbum(a); cont.appendChild(b.caixa);
      await gradeFotos(b.grade, priv.filter(f => f.album_id === a.id), opc);
    }
    if (!albuns.length) cont.innerHTML = '<p class="suave">Você ainda não tem álbum privado. Crie um abaixo ou envie uma foto para "Álbum privado".</p>';
    mostrarAvatar();
    gerarMiniaturasPendentes(priv.filter(f => !f.miniatura));
  }

  $('bNovoAlbum').addEventListener('click', async () => {
    const nome = $('novoAlbumNome').value.trim();
    if (!nome) { msg('mAlbumNovo', 'erro', 'Escreva o nome do álbum.'); return; }
    $('bNovoAlbum').disabled = true;
    const { error } = await sb.rpc('criar_album', { p_nome: nome });
    $('bNovoAlbum').disabled = false;
    if (error) { msg('mAlbumNovo', 'erro', error.message); return; }
    $('novoAlbumNome').value = ''; msg('mAlbumNovo', 'ok', 'Álbum criado ✓');
    carregarFotos(); carregarAlbum();
  });

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
    const v = $('fDestino').value;
    const atual = selecionada.album === 'publico' ? 'publico' : 'a' + selecionada.album_id;
    if (v === atual) { fecharPainel(); return; }
    if (v === 'publico' && !$('fMover').dataset.ok) {
      $('fMover').dataset.ok = '1';
      msg('mFotos', 'erro', '🚫 No Fotolog é proibido rosto à mostra. Se esta foto mostra rosto, não mova: envie de novo pela Galeria com o Fotolog escolhido, para esconder o rosto. Se não tem rosto, toque em Mover de novo.');
      setTimeout(() => delete $('fMover').dataset.ok, 8000); return;
    }
    delete $('fMover').dataset.ok;
    let error;
    if (v === 'publico') ({ error } = await sb.from('fotos').update({ album: 'publico' }).eq('id', selecionada.id));
    else ({ error } = await sb.rpc('mover_foto_album', { p_foto: selecionada.id, p_album: Number(v.slice(1)) }));
    if (error) { msg('mFotos', 'erro', error.message); return; }
    if (v !== 'publico' && fotoPerfil === selecionada.caminho) fotoPerfil = null;
    fecharPainel(); msg('mFotos'); carregarFotos(); carregarAlbum();
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

  async function enviarFotos(input) {
    const arquivos = [...input.files];
    input.value = '';
    if (!arquivos.length) return;
    const destino = $('upAlbum').value;
    const album = destino === 'publico' ? 'publico' : 'privado';
    const albumId = destino[0] === 'a' ? Number(destino.slice(1)) : null;
    let ok = 0, falhas = [];
    for (let i = 0; i < arquivos.length; i++) {
      msg('mFotos', 'info', 'Enviando ' + (i + 1) + ' de ' + arquivos.length + '…');
      try {
        let blob = await prepararFoto(arquivos[i]);
        if (album === 'publico') {   // Fotolog é visto por todos: esconder rostos antes
          const r = await window.EDITOR_FOTO.editar(blob);
          if (!r) continue;
          blob = r.blob;
        }
        const caminho = eu.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        const up = await sb.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw new Error('Falha no envio.');
        const linha = { dono: eu.id, caminho, album };
        if (albumId) linha.album_id = albumId;
        const ins = await sb.from('fotos').insert(linha).select('id').single();
        if (ins.error) { await sb.storage.from('fotos').remove([caminho]); throw new Error(ins.error.message); }
        if (album === 'privado') { try { await sb.rpc('salvar_miniatura', { p_foto: ins.data.id, p_mini: await miniatura24(blob) }); } catch (e) { /* gerada depois */ } }
        ok++;
        if (!fotoPerfil && album === 'publico') {     // primeira foto pública vira a de perfil
          const r = await sb.from('perfis').update({ foto_perfil: caminho }).eq('id', eu.id);
          if (!r.error) fotoPerfil = caminho;
        }
      } catch (e) { falhas.push(e.message); }
    }
    msg('mFotos', falhas.length ? 'erro' : 'ok',
      ok + ' foto(s) enviada(s).' + (falhas.length ? ' Problemas: ' + [...new Set(falhas)].join(' ') : ''));
    carregarFotos(); carregarAlbum();
  }
  $('upArquivos').addEventListener('change', () => enviarFotos($('upArquivos')));
  $('upCamera').addEventListener('change', () => enviarFotos($('upCamera')));
  $('upAlbum').addEventListener('change', () => { if ($('upAlbum').value === 'publico' && window.EDITOR_FOTO) window.EDITOR_FOTO.carregarDetector().catch(() => {}); });

  carregarFotos();

  // ---------- Pedidos e acessos do álbum ----------
  function pessoa(id, apelido, botoes, opcoes) {
    opcoes = opcoes || {};
    const d = document.createElement('div'); d.className = 'pessoa';
    const nomeBox = document.createElement('div');
    const a = document.createElement('a'); a.href = 'perfil.html?id=' + encodeURIComponent(id); a.textContent = apelido;
    nomeBox.appendChild(a);
    if (opcoes.sub) {
      const s = document.createElement('div'); s.className = 'suave'; s.style.fontSize = '.75rem'; s.textContent = opcoes.sub;
      nomeBox.appendChild(s);
    }
    const b = document.createElement('div'); b.className = 'botoes';
    if (opcoes.extra) b.appendChild(opcoes.extra);
    botoes.forEach(([texto, classe, acao]) => {
      const x = document.createElement('button'); x.type = 'button'; x.textContent = texto; if (classe) x.className = classe;
      x.addEventListener('click', async () => { x.disabled = true; await acao(); });
      b.appendChild(x);
    });
    d.append(nomeBox, b); return d;
  }

  function selPrazoAlbum() {
    const s = document.createElement('select');
    [['', 'Sem limite'], ['24', '24 horas'], ['72', '3 dias'], ['168', '7 dias']].forEach(([v, t]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o);
    });
    return s;
  }

  function textoPrazo(expira) {
    if (!expira) return 'sem limite de tempo';
    const d = new Date(expira);
    return 'até ' + d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  async function carregarAlbum() {
    const { data } = await sb.rpc('meus_albuns_acessos');
    const lista = data || [];
    $('listaPedidos').innerHTML = ''; $('listaAcessos').innerHTML = '';
    lista.forEach(p => {
      if (p.status === 'pendente') {
        const sel = selPrazoAlbum();
        $('listaPedidos').appendChild(pessoa(p.membro, p.apelido, [
          ['Liberar', 'sim', async () => {
            const horas = sel.value ? Number(sel.value) : null;
            await sb.rpc('responder_pedido_album', { p_album: p.album_id, p_solicitante: p.membro, p_aceitar: true, p_horas: horas });
            carregarAlbum();
          }],
          ['Recusar', '', async () => { await sb.rpc('responder_pedido_album', { p_album: p.album_id, p_solicitante: p.membro, p_aceitar: false }); carregarAlbum(); }]
        ], { extra: sel, sub: 'quer ver o álbum "' + p.album + '"' }));
      } else {
        $('listaAcessos').appendChild(pessoa(p.membro, p.apelido, [
          ['Tirar acesso', '', async () => { await sb.rpc('tirar_acesso_album', { p_album: p.album_id, p_membro: p.membro }); carregarAlbum(); }]
        ], { sub: 'álbum "' + p.album + '" · acesso ' + textoPrazo(p.expira_em) }));
      }
    });
    $('cartaoPedidos').classList.toggle('oculto', !$('listaPedidos').children.length);
    $('semAcessos').classList.toggle('oculto', !!$('listaAcessos').children.length);
  }
  carregarAlbum();

  // Convidar um membro direto (sem ele pedir)
  [['', 'Sem limite'], ['24', '24 horas'], ['72', '3 dias'], ['168', '7 dias']].forEach(([v, t]) => {
    const o = document.createElement('option'); o.value = v; o.textContent = t; $('cvPrazo').appendChild(o);
  });
  $('cvBtn').addEventListener('click', async () => {
    const apelido = $('cvApelido').value.trim();
    if (!$('cvAlbum').value) { msg('mConvite', 'erro', 'Crie um álbum primeiro.'); return; }
    if (!apelido) { msg('mConvite', 'erro', 'Escreva o apelido do membro.'); return; }
    $('cvBtn').disabled = true;
    const { data: ps } = await sb.from('perfis_publicos').select('id, apelido').ilike('apelido', apelido.replace(/[%_]/g, '')).limit(5);
    const alvo = (ps || []).find(x => x.apelido.toLowerCase() === apelido.toLowerCase());
    if (!alvo) { $('cvBtn').disabled = false; msg('mConvite', 'erro', 'Não achei esse apelido. Confira como está escrito no perfil.'); return; }
    const horas = $('cvPrazo').value ? Number($('cvPrazo').value) : null;
    const { error } = await sb.rpc('liberar_album', { p_album: Number($('cvAlbum').value), p_membro: alvo.id, p_horas: horas });
    $('cvBtn').disabled = false;
    if (error) { msg('mConvite', 'erro', error.message); return; }
    $('cvApelido').value = ''; msg('mConvite', 'ok', alvo.apelido + ' agora pode ver o álbum ✓');
    carregarAlbum(); carregarFotos();
  });

  // ---------- Quem pode me mandar mensagem ----------
  function pintarPriv(v) { document.querySelectorAll('#privMsg .chip').forEach(c => c.classList.toggle('sel', (c.dataset.v === 'true') === v)); }
  pintarPriv(!!eu.msg_so_quem_sigo);
  document.querySelectorAll('#privMsg .chip').forEach(c => c.addEventListener('click', async () => {
    const v = c.dataset.v === 'true';
    const { error } = await sb.from('perfis').update({ msg_so_quem_sigo: v }).eq('id', eu.id);
    if (!error) { eu.msg_so_quem_sigo = v; pintarPriv(v); window.BASE.toast('Salvo ✓'); }
  }));

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
  await carregarBloqueados();


  if (new URLSearchParams(location.search).get('album') === 'privado') { const o = [...$('upAlbum').options].find(x => x.value !== 'publico'); if (o) $('upAlbum').value = o.value; }
  const irBloq = () => { const h = location.hash.slice(1); if (h === 'bloqueados' || h === 'aparelhos' || h === 'fotos') setTimeout(() => $(h).scrollIntoView({ block: 'start' }), 400); };
  irBloq(); window.addEventListener('hashchange', irBloq);
})();
