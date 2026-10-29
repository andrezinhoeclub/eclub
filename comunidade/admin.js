// admin.js — v2.2 — verificações, membros (privilégios), planos e destaques
(async function () {
  'use strict';
  const { sb, $, msg, idade, dataBR, formacao, exigirLogin, exigirMembro, moldura, toast, prepararFoto, flyer, UFS } = window.BASE;

  await exigirLogin();
  const { data: souAdmin } = await sb.rpc('e_admin');
  $('carregando').classList.add('oculto');
  if (souAdmin !== true) { $('negado').classList.remove('oculto'); return; }
  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, '');
  $('painel').classList.remove('oculto');

  // ---------- Abas ----------
  const ABAS = { verif: 'abaVerif', eventos: 'abaEventos', membros: 'abaMembros', planos: 'abaPlanos', destaques: 'abaDestaques' };
  document.querySelectorAll('#abasAdmin button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#abasAdmin button').forEach(x => x.classList.toggle('sel', x === b));
    Object.entries(ABAS).forEach(([k, id]) => $(id).classList.toggle('oculto', k !== b.dataset.aba));
    if (b.dataset.aba === 'membros') carregarMembros();
    if (b.dataset.aba === 'planos') carregarPlanos();
    if (b.dataset.aba === 'destaques') carregarDestaques();
    if (b.dataset.aba === 'eventos') carregarEventos();
  }));
  const novoEl = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };

  // ---------- Membros ----------
  let filtroM = '', timerM;
  document.querySelectorAll('#mFiltro .chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll('#mFiltro .chip').forEach(x => x.classList.toggle('sel', x === c));
    filtroM = c.dataset.f; carregarMembros();
  }));
  $('mBusca').addEventListener('input', () => { clearTimeout(timerM); timerM = setTimeout(carregarMembros, 400); });

  // Cadastro aberto / só por convite
  async function carregarCadastro() {
    const { data } = await sb.from('config').select('valor').eq('chave', 'cadastro_aberto').maybeSingle();
    const aberto = !data || data.valor === true;
    document.querySelectorAll('#cadAberto .chip').forEach(c => c.classList.toggle('sel', (c.dataset.v === 'true') === aberto));
  }
  document.querySelectorAll('#cadAberto .chip').forEach(c => c.addEventListener('click', async () => {
    const { error } = await sb.from('config').upsert({ chave: 'cadastro_aberto', valor: c.dataset.v === 'true' });
    toast(error ? 'Erro: ' + error.message : (c.dataset.v === 'true' ? 'Cadastro ABERTO ✓' : 'Entrada só por convite ✓'));
    carregarCadastro();
  }));

  async function carregarMembros() {
    carregarCadastro();
    let q = sb.from('perfis').select('id, numero, apelido, tipo, sexo_1, sexo_2, cidade, uf, status, isento, acesso_ate, criado_em')
      .order('criado_em', { ascending: false }).limit(50);
    const busca = $('mBusca').value.trim().replace(/[%_\\,()]/g, '');
    if (busca) q = q.ilike('apelido', '%' + busca + '%');
    if (filtroM === 'isento') q = q.eq('isento', true); else if (filtroM) q = q.eq('status', filtroM);
    const { data, error } = await q;
    $('mLista').innerHTML = '';
    if (error) { $('mLista').textContent = 'Erro: ' + error.message; return; }
    if (!data.length) { $('mLista').appendChild(novoEl('p', 'suave', 'Ninguém encontrado.')); return; }
    data.forEach(m => {
      const linha = novoEl('div', 'pessoa');
      const info = novoEl('div');
      const a = novoEl('a', null, m.apelido + ' · nº ' + m.numero); a.href = 'perfil.html?id=' + encodeURIComponent(m.id);
      const ativo = m.isento || (m.acesso_ate && new Date(m.acesso_ate) > new Date());
      const situ = m.isento ? '👑 isento' : (m.acesso_ate ? (ativo ? 'acesso até ' : 'venceu em ') + new Date(m.acesso_ate).toLocaleDateString('pt-BR') : 'sem assinatura');
      info.append(a, novoEl('div', 'suave', formacao(m) + ' · ' + m.cidade + '/' + m.uf + ' · ' + m.status + ' · ' + situ));
      const bt = novoEl('div', 'botoes');
      const botao = (t, cls, acao) => { const b = novoEl('button', cls, t); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; await acao(); carregarMembros(); }); bt.appendChild(b); };
      const rpc = async (isento, dias) => { const { error: e } = await sb.rpc('admin_definir_acesso', { p_id: m.id, p_isento: isento, p_somar_dias: dias }); toast(e ? 'Erro: ' + e.message : 'Feito ✓'); };
      const status = async (st) => { const { error: e } = await sb.from('perfis').update({ status: st }).eq('id', m.id); toast(e ? 'Erro: ' + e.message : 'Feito ✓'); };
      botao(m.isento ? 'Tirar privilégio' : '👑 Isentar', m.isento ? '' : 'sim', () => rpc(!m.isento, 0));
      botao('+30 dias', '', () => rpc(null, 30));
      botao('−30 dias', '', () => rpc(null, -30));
      if (m.status === 'aprovado') botao('Suspender', '', () => status('suspenso'));
      if (m.status === 'suspenso') botao('Reativar', 'sim', () => status('aprovado'));
      if (m.status !== 'banido') botao('Banir', 'nao', async () => {
        if (!linha.dataset.confirma) { linha.dataset.confirma = '1'; toast('Toque em Banir de novo para confirmar.'); setTimeout(() => delete linha.dataset.confirma, 4000); return; }
        await status('banido');
      });
      linha.append(info, bt); $('mLista').appendChild(linha);
    });
  }

  // ---------- Planos ----------
  async function carregarPlanos() {
    const { data } = await sb.from('planos').select('*').order('ordem');
    $('pLista').innerHTML = '';
    (data || []).forEach(p => {
      const l = novoEl('div', 'pessoa');
      const nome = novoEl('input'); nome.type = 'text'; nome.value = p.nome; nome.style.maxWidth = '150px';
      const dias = novoEl('input'); dias.type = 'number'; dias.value = p.dias; dias.style.maxWidth = '90px'; dias.title = 'dias';
      const valor = novoEl('input'); valor.type = 'number'; valor.step = '0.01'; valor.value = p.valor; valor.style.maxWidth = '110px'; valor.title = 'valor R$';
      const at = novoEl('label', 'suave'); const cb = novoEl('input'); cb.type = 'checkbox'; cb.checked = p.ativo; at.append(cb, ' ativo');
      const salvar = novoEl('button', 'sim', 'Salvar'); salvar.type = 'button';
      salvar.addEventListener('click', async () => {
        const { error } = await sb.from('planos').update({ nome: nome.value.trim(), dias: parseInt(dias.value, 10), valor: Number(valor.value), ativo: cb.checked }).eq('id', p.id);
        msg('pMsg', error ? 'erro' : 'ok', error ? 'Erro: ' + error.message : 'Plano salvo ✓');
      });
      l.append(nome, dias, novoEl('span', 'suave', 'dias · R$'), valor, at, salvar); $('pLista').appendChild(l);
    });
  }


  // ---------- Eventos ----------
  UFS.forEach(u => { const o = document.createElement('option'); o.value = u; o.textContent = u; $('evUf').appendChild(o); });
  $('evUf').value = 'PR';
  let flyerNovo = null, flyerAtual = null;
  const paraLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  $('evFlyer').addEventListener('change', async () => {
    const a = $('evFlyer').files[0]; if (!a) return;
    try { flyerNovo = await prepararFoto(a); $('evPrevia').src = URL.createObjectURL(flyerNovo); $('evPrevia').classList.remove('oculto'); }
    catch (e) { msg('evMsg', 'erro', e.message); $('evFlyer').value = ''; }
  });
  function limparForm() {
    ['evId', 'evTitulo', 'evInicio', 'evFim', 'evLocal', 'evEndereco', 'evDescricao', 'evLink', 'evLinkTxt'].forEach(i => { $(i).value = ''; });
    $('evOrg').value = 'E-Club'; $('evCidade').value = 'Curitiba'; $('evUf').value = 'PR'; $('evAtivo').checked = true;
    $('evFlyer').value = ''; flyerNovo = null; flyerAtual = null; $('evPrevia').classList.add('oculto');
    $('evTituloForm').textContent = 'Novo evento'; $('evCancelar').classList.add('oculto');
  }
  $('evCancelar').addEventListener('click', limparForm);
  $('evSalvar').addEventListener('click', async () => {
    const titulo = $('evTitulo').value.trim();
    if (titulo.length < 3) { msg('evMsg', 'erro', 'Escreva o nome do evento.'); return; }
    if (!$('evInicio').value) { msg('evMsg', 'erro', 'Informe quando começa.'); return; }
    const link = $('evLink').value.trim();
    if (link && !/^https:\/\//.test(link)) { msg('evMsg', 'erro', 'O link precisa começar com https://'); return; }
    const inicio = new Date($('evInicio').value).toISOString();
    const fim = $('evFim').value ? new Date($('evFim').value).toISOString() : null;
    if (fim && fim <= inicio) { msg('evMsg', 'erro', 'O término precisa ser depois do início.'); return; }
    $('evSalvar').disabled = true; msg('evMsg', 'info', 'Salvando…');
    let capa = flyerAtual;
    if (flyerNovo) {
      const caminho = 'flyer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
      const up = await sb.storage.from('eventos').upload(caminho, flyerNovo, { contentType: 'image/jpeg', upsert: false });
      if (up.error) { $('evSalvar').disabled = false; msg('evMsg', 'erro', 'Falha ao enviar o flyer.'); return; }
      if (flyerAtual) await sb.storage.from('eventos').remove([flyerAtual]);
      capa = caminho;
    }
    const dados = { titulo, organizador: $('evOrg').value.trim() || null, inicio, fim, local: $('evLocal').value.trim() || null,
      endereco: $('evEndereco').value.trim() || null, cidade: $('evCidade').value.trim() || null, uf: $('evUf').value || null,
      descricao: $('evDescricao').value.trim() || null, link: link || null, link_texto: $('evLinkTxt').value.trim() || null,
      capa, ativo: $('evAtivo').checked };
    const id = $('evId').value;
    const r = id ? await sb.from('eventos').update(dados).eq('id', id) : await sb.from('eventos').insert(Object.assign({ criado_por: eu.id }, dados));
    $('evSalvar').disabled = false;
    if (r.error) { msg('evMsg', 'erro', 'Erro: ' + r.error.message); return; }
    msg('evMsg', 'ok', id ? 'Evento atualizado ✓' : 'Evento criado ✓ Ele já aparece para os membros.');
    limparForm(); carregarEventos();
  });
  async function carregarEventos() {
    const { data } = await sb.from('eventos').select('*').order('inicio', { ascending: false }).limit(100);
    $('evLista').innerHTML = '';
    (data || []).forEach(e => {
      const l = novoEl('div', 'pessoa');
      const t = novoEl('div');
      const a = novoEl('a', null, e.titulo); a.href = 'eventos.html?id=' + e.id;
      t.append(a, novoEl('div', 'suave', new Date(e.inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + (e.ativo ? '' : ' · OCULTO')));
      const bt = novoEl('div', 'botoes');
      const botao = (txt, cls, fn) => { const b = novoEl('button', cls, txt); b.type = 'button'; b.addEventListener('click', fn); bt.appendChild(b); };
      botao('Editar', '', () => {
        $('evId').value = e.id; $('evTitulo').value = e.titulo; $('evOrg').value = e.organizador || '';
        $('evInicio').value = paraLocal(e.inicio); $('evFim').value = paraLocal(e.fim);
        $('evLocal').value = e.local || ''; $('evEndereco').value = e.endereco || ''; $('evCidade').value = e.cidade || ''; $('evUf').value = e.uf || 'PR';
        $('evDescricao').value = e.descricao || ''; $('evLink').value = e.link || ''; $('evLinkTxt').value = e.link_texto || '';
        $('evAtivo').checked = e.ativo; flyerAtual = e.capa; flyerNovo = null; $('evFlyer').value = '';
        $('evPrevia').classList.toggle('oculto', !e.capa); if (e.capa) $('evPrevia').src = flyer(e.capa);
        $('evTituloForm').textContent = 'Editando: ' + e.titulo; $('evCancelar').classList.remove('oculto');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      botao(e.ativo ? 'Ocultar' : 'Mostrar', e.ativo ? '' : 'sim', async () => { await sb.from('eventos').update({ ativo: !e.ativo }).eq('id', e.id); carregarEventos(); });
      botao('Apagar', 'nao', async () => {
        if (!l.dataset.ok) { l.dataset.ok = '1'; toast('Toque em Apagar de novo para confirmar (as confirmações de presença também somem).'); setTimeout(() => delete l.dataset.ok, 4000); return; }
        await sb.from('eventos').delete().eq('id', e.id);
        if (e.capa) await sb.storage.from('eventos').remove([e.capa]);
        carregarEventos();
      });
      l.append(t, bt); $('evLista').appendChild(l);
    });
  }

  // ---------- Destaques ----------
  async function carregarDestaques() {
    const { data } = await sb.from('destaques').select('*').order('ordem');
    $('dLista').innerHTML = '';
    (data || []).forEach(d => {
      const l = novoEl('div', 'pessoa');
      const t = novoEl('div'); t.append(novoEl('b', null, d.titulo), novoEl('div', 'suave', (d.subtitulo || '') + (d.link ? ' → ' + d.link : '')));
      const bt = novoEl('div', 'botoes');
      const tog = novoEl('button', d.ativo ? '' : 'sim', d.ativo ? 'Esconder' : 'Mostrar'); tog.type = 'button';
      tog.addEventListener('click', async () => { await sb.from('destaques').update({ ativo: !d.ativo }).eq('id', d.id); carregarDestaques(); });
      const del = novoEl('button', 'nao', 'Apagar'); del.type = 'button';
      del.addEventListener('click', async () => { await sb.from('destaques').delete().eq('id', d.id); carregarDestaques(); });
      bt.append(tog, del); l.append(t, bt); $('dLista').appendChild(l);
    });
  }
  $('dAdd').addEventListener('click', async () => {
    const titulo = $('dTitulo').value.trim(); if (!titulo) { msg('dMsg', 'erro', 'Escreva o título.'); return; }
    const link = $('dLink').value.trim() || null;
    if (link && !/^(https:\/\/|[a-z0-9-]+\.html)/.test(link)) { msg('dMsg', 'erro', 'O link precisa começar com https://'); return; }
    const { error } = await sb.from('destaques').insert({ titulo, subtitulo: $('dSub').value.trim() || null, link, ordem: Date.now() % 100000 });
    if (error) { msg('dMsg', 'erro', 'Erro: ' + error.message); return; }
    $('dTitulo').value = $('dSub').value = $('dLink').value = ''; msg('dMsg', 'ok', 'Faixa adicionada ✓'); carregarDestaques();
  });

  function resultado(card, tipo, texto) {
    const r = card.querySelector('.resultado');
    r.className = 'msg resultado ' + tipo; r.textContent = texto;
  }

  async function apagarFotos(fotos) {
    if (fotos && fotos.length) await sb.storage.from('verificacoes').remove(fotos);
  }

  async function carregar() {
    $('lista').innerHTML = '';
    $('vazio').classList.add('oculto');
    const { data, error } = await sb.from('verificacoes')
      .select('id, codigo, fotos, criado_em, perfil, perfis(apelido, tipo, sexo_1, sexo_2, nascimento_1, nascimento_2, cidade, uf)')
      .eq('status', 'enviada')
      .order('criado_em', { ascending: true });
    if (error) { $('lista').textContent = 'Erro ao carregar: ' + error.message; return; }

    $('qtd').textContent = data.length;
    if (!data.length) { $('vazio').classList.remove('oculto'); return; }

    for (const v of data) {
      const p = v.perfis || {};
      const card = $('modelo').content.firstElementChild.cloneNode(true);
      card.querySelector('.apelido').textContent = p.apelido || '(sem perfil)';
      card.querySelector('.tipo').textContent = formacao(p);
      card.querySelector('.codigoTxt').textContent = v.codigo;
      card.querySelector('.nasc1').textContent = dataBR(p.nascimento_1) + ' (' + idade(p.nascimento_1) + ' anos)';
      if (p.tipo === 'casal') {
        card.querySelector('.nasc2').textContent = dataBR(p.nascimento_2) + ' (' + idade(p.nascimento_2) + ' anos)';
      } else {
        card.querySelectorAll('.r2').forEach(e => e.remove());
      }
      card.querySelector('.cidade').textContent = (p.cidade || '') + ' / ' + (p.uf || '');
      card.querySelector('.enviado').textContent = new Date(v.criado_em).toLocaleString('pt-BR');

      // Fotos com link temporário (pasta privada)
      const grade = card.querySelector('.fotos');
      if (v.fotos && v.fotos.length) {
        const { data: links } = await sb.storage.from('verificacoes').createSignedUrls(v.fotos, 600);
        (links || []).forEach(l => {
          if (!l.signedUrl) return;
          const a = document.createElement('a');
          a.href = l.signedUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
          const img = document.createElement('img');
          img.src = l.signedUrl; img.alt = l.path.split('-').pop();
          a.appendChild(img); grade.appendChild(a);
        });
      }

      const botoes = card.querySelectorAll('button');
      const travar = (sim) => botoes.forEach(b => { b.disabled = sim; });

      card.querySelector('.aprovar').addEventListener('click', async () => {
        travar(true);
        const { error } = await sb.rpc('analisar_verificacao', { p_id: v.id, p_aprovar: true, p_motivo: null });
        if (error) { travar(false); resultado(card, 'erro', error.message); return; }
        await apagarFotos(v.fotos);
        resultado(card, 'ok', 'Aprovado ✓ — fotos de verificação apagadas.');
        card.querySelector('.acoes').remove(); card.querySelector('.caixaRecusa').remove();
        $('qtd').textContent = Math.max(0, Number($('qtd').textContent) - 1);
      });

      card.querySelector('.recusar').addEventListener('click', () => {
        card.querySelector('.caixaRecusa').classList.toggle('oculto');
      });

      card.querySelector('.confirmar').addEventListener('click', async () => {
        const valor = card.querySelector('.motivo').value;
        if (!valor) { resultado(card, 'erro', 'Escolha o motivo.'); return; }
        const banir = valor.startsWith('BANIR:');
        const motivo = banir ? valor.slice(6) : valor;
        travar(true);
        const { error } = await sb.rpc('analisar_verificacao', { p_id: v.id, p_aprovar: false, p_motivo: motivo });
        if (error) { travar(false); resultado(card, 'erro', error.message); return; }
        if (banir) {
          // Guarda as fotos como prova e encerra a conta
          const { error: e2 } = await sb.from('perfis').update({ status: 'banido' }).eq('id', v.perfil);
          resultado(card, e2 ? 'erro' : 'ok', e2 ? 'Recusado, mas não consegui banir: ' + e2.message
            : 'Recusado e BANIDO. As fotos foram guardadas como prova.');
        } else {
          await apagarFotos(v.fotos);
          resultado(card, 'ok', 'Recusado. O membro vai ver o motivo e pode tentar de novo.');
        }
        card.querySelector('.acoes').remove(); card.querySelector('.caixaRecusa').remove();
        $('qtd').textContent = Math.max(0, Number($('qtd').textContent) - 1);
      });

      $('lista').appendChild(card);
    }
  }

  $('bAtualizar').addEventListener('click', carregar);
  carregar();
})();
