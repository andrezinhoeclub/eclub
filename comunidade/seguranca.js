// seguranca.js — v1.0 — Acesso Rápido (código), Ele/Ela, aparelhos conectados e relação de acessos
(async function () {
  'use strict';
  const { sb, $, msg, exigirLogin, exigirMembro, moldura, toast } = window.BASE;

  const { perfil: p0 } = await exigirLogin();
  let eu = p0;
  if (p0.status === 'aprovado') {
    const r = await exigirMembro({ semAssinatura: true });
    eu = r.perfil; moldura(r.perfil, r.assinatura, '');
  }
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
  const est = window.BASE.estadoSessao() || {};
  $('minInativo').textContent = est.inatividade_min || 30;

  // ---------- Acesso Rápido ----------
  let temCodigo = !!est.tem_codigo;
  function pintarCodigo() {
    $('codStatus').textContent = temCodigo ? '✓ Você tem um código cadastrado.' : 'Você ainda não tem código. Crie um abaixo.';
    $('codStatus').style.color = temCodigo ? 'var(--ok)' : 'var(--aviso)';
    $('codSalvar').textContent = temCodigo ? 'Trocar código' : 'Criar código';
    $('codRemover').classList.toggle('oculto', !temCodigo);
    $('codAparelhoBox').classList.toggle('oculto', !temCodigo);
    $('codAparelho').checked = window.BASE.codigoNesteAparelho();
  }
  pintarCodigo();
  ['codNovo', 'codRepete'].forEach(id => $(id).addEventListener('input', () => { $(id).value = $(id).value.replace(/\D/g, '').slice(0, 4); }));
  $('codSalvar').addEventListener('click', async () => {
    const a = $('codNovo').value, b = $('codRepete').value;
    if (!/^\d{4}$/.test(a)) { msg('mCodigo', 'erro', 'Digite 4 números.'); return; }
    if (a !== b) { msg('mCodigo', 'erro', 'Os dois códigos estão diferentes.'); return; }
    $('codSalvar').disabled = true;
    const { error } = await sb.rpc('definir_codigo', { p_codigo: a });
    $('codSalvar').disabled = false;
    if (error) { msg('mCodigo', 'erro', error.message); return; }
    $('codNovo').value = $('codRepete').value = '';
    temCodigo = true; window.BASE.codigoNesteAparelho(true); pintarCodigo();
    msg('mCodigo', 'ok', 'Código salvo ✓ Neste aparelho, quando o app se trancar, é só digitar o código.');
  });
  $('codAparelho').addEventListener('change', () => {
    window.BASE.codigoNesteAparelho($('codAparelho').checked);
    toast($('codAparelho').checked ? 'Este aparelho vai usar o código ✓' : 'Este aparelho vai pedir e-mail e senha');
  });
  $('codRemover').addEventListener('click', async () => {
    if (!$('codRemover').dataset.ok) { $('codRemover').dataset.ok = '1'; $('codRemover').textContent = 'Toque de novo para remover'; setTimeout(() => { delete $('codRemover').dataset.ok; $('codRemover').textContent = 'Remover meu código'; }, 4000); return; }
    const { error } = await sb.rpc('remover_codigo');
    if (error) { msg('mCodigo', 'erro', error.message); return; }
    temCodigo = false; window.BASE.codigoNesteAparelho(false); pintarCodigo();
    msg('mCodigo', 'ok', 'Código removido. O app vai pedir e-mail e senha depois do tempo sem uso.');
  });

  // ---------- Casal: quem está usando ----------
  const NOME_Q = { ele: '👨 Ele', ela: '👩 Ela' };
  if (eu.tipo === 'casal') {
    $('secQuem').classList.remove('oculto');
    $('quemAgora').textContent = NOME_Q[est.quem] || '—';
    $('trocarQuem').addEventListener('click', async () => {
      const r = await window.BASE.perguntarQuem(true);
      if (r) { est.quem = r; $('quemAgora').textContent = NOME_Q[r]; carregarAparelhos(); }
    });
  }

  // ---------- Aparelhos conectados ----------
  const lim = est.limite || 1;
  $('apRegra').textContent = eu.tipo === 'casal'
    ? 'Casal: 1 aparelho do Ele e 1 da Ela ao mesmo tempo. Ao entrar num aparelho novo, o antigo da mesma pessoa é desconectado.'
    : 'Seu perfil pode ficar conectado em ' + lim + (lim > 1 ? ' aparelhos' : ' aparelho') + ' por vez. Ao entrar num aparelho novo, o mais antigo é desconectado.';
  function nomeAparelho(ua) {
    ua = ua || '';
    const tipo = /iPhone|Android.*Mobile|Mobile/.test(ua) ? 'Celular' : /iPad|Tablet|Android/.test(ua) ? 'Tablet' : 'Computador';
    const so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    const nav = /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : '';
    return [tipo, nav, so].filter(Boolean).join(' · ');
  }
  const dataHora = (d) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  async function carregarAparelhos() {
    const { data, error } = await sb.rpc('meus_aparelhos');
    const box = $('listaAparelhos'); box.innerHTML = '';
    if (error) { box.textContent = 'Não foi possível carregar.'; return; }
    (data || []).forEach(a => {
      const linha = document.createElement('div'); linha.className = 'pessoa';
      const info = document.createElement('div'); info.style.flex = '1';
      const b = document.createElement('b'); b.textContent = (a.este ? '📍 Este aparelho · ' : '') + nomeAparelho(a.aparelho);
      const s = document.createElement('div'); s.className = 'suave'; s.style.fontSize = '.82rem';
      s.textContent = (a.quem ? NOME_Q[a.quem] + ' · ' : '') + 'usado ' + dataHora(a.ultimo_uso) + (a.ip ? ' · IP ' + a.ip : '');
      info.append(b, s); linha.appendChild(info);
      if (!a.este) {
        const x = document.createElement('button'); x.type = 'button'; x.textContent = 'Desconectar';
        x.addEventListener('click', async () => { await sb.rpc('desconectar_aparelho', { p_id: a.id }); toast('Aparelho desconectado ✓'); carregarAparelhos(); });
        linha.appendChild(x);
      }
      box.appendChild(linha);
    });
    $('apSairOutros').classList.toggle('oculto', !(data || []).some(a => !a.este));
  }
  $('apSairOutros').addEventListener('click', async () => {
    const { data } = await sb.rpc('desconectar_aparelho', { p_id: null });
    toast((data || 0) + ' aparelho(s) desconectado(s) ✓'); carregarAparelhos();
  });
  carregarAparelhos();

  // ---------- Relação de acessos (como no CRS: agrupado por dia) ----------
  const COMO = { senha: '🔑 com senha', codigo: '🔢 com o código', link: '✉️ pelo link do e-mail' };
  async function carregarAcessos() {
    const { data, error } = await sb.rpc('relacao_acessos');
    const box = $('listaAcessos'); box.innerHTML = '';
    if (error) { box.textContent = 'Não foi possível carregar.'; return; }
    if (!data || !data.length) { box.innerHTML = '<p class="suave">Nenhum acesso registrado ainda.</p>'; return; }
    const hoje = new Date().toDateString(), ontem = new Date(Date.now() - 864e5).toDateString();
    let dia = '';
    data.forEach(a => {
      const d = new Date(a.criado_em);
      const k = d.toDateString();
      if (k !== dia) {
        dia = k;
        const h = document.createElement('div'); h.className = 'titulo-secao'; h.style.cssText = 'margin:14px 0 6px;font-size:.72rem';
        const nome = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        h.textContent = (k === hoje ? 'Hoje, ' : k === ontem ? 'Ontem, ' : '') + nome;
        box.appendChild(h);
      }
      const r = document.createElement('div'); r.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--linha);font-size:.88rem';
      const t = document.createElement('b'); t.textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + 'h ';
      const c = document.createElement('span'); c.textContent = (COMO[a.como] || a.como) + (a.quem ? ' · ' + NOME_Q[a.quem] : '');
      const s = document.createElement('div'); s.className = 'suave'; s.style.fontSize = '.8rem';
      s.textContent = nomeAparelho(a.aparelho) + (a.ip ? ' · IP ' + a.ip : '');
      r.append(t, c, s); box.appendChild(r);
    });
  }
  carregarAcessos();

  $('trocarSenha').addEventListener('click', async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user || !user.email) return;
    await sb.auth.resetPasswordForEmail(user.email, { redirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') + 'entrar.html' });
    toast('Enviamos um e-mail para você criar uma senha nova ✓');
  });

  const ir = () => { const h = location.hash.slice(1); if (h && $(h)) setTimeout(() => $(h).scrollIntoView({ block: 'start' }), 300); };
  ir(); window.addEventListener('hashchange', ir);
})();
