// convidar.js — v1.0 — enviar convites por e-mail e acompanhar
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, tempo } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, '');
  if (assinatura.admin) $('txtLimite').textContent = 'Administração: sem limite de convites.';
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');

  const pastaSite = location.origin + location.pathname.replace(/[^/]*$/, '');

  async function carregar() {
    const { data } = await sb.from('convites').select('email, status, criado_em, aceito_em, aceito_por')
      .eq('padrinho', eu.id).order('criado_em', { ascending: false }).limit(100);
    const lista = data || [];
    $('nEnviados').textContent = lista.filter(c => c.status !== 'cancelado').length;
    $('nAceitos').textContent = lista.filter(c => c.status === 'aceito').length;
    $('lista').innerHTML = '';
    $('vazio').classList.toggle('oculto', lista.length > 0);
    const rot = { enviado: '⏳ aguardando', aceito: '✅ entrou', cancelado: '— substituído' };
    lista.forEach(c => {
      const d = document.createElement('div'); d.className = 'pessoa';
      const e = document.createElement('div');
      const b = document.createElement('b'); b.textContent = c.email;
      const s = document.createElement('div'); s.className = 'suave'; s.textContent = 'enviado ' + tempo(c.criado_em);
      e.append(b, s);
      const st = document.createElement('span'); st.className = 'suave'; st.textContent = rot[c.status] || c.status;
      d.append(e, st); $('lista').appendChild(d);
    });
    const { data: n } = await sb.rpc('numeros_perfil', { p_id: eu.id });
    $('nAfilhados').textContent = (n && n[0] && n[0].convidados) || 0;
  }

  $('fConvite').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('cEmail').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { msg('mConvite', 'erro', 'Digite um e-mail válido.'); return; }
    $('bConvidar').disabled = true; msg('mConvite', 'info', 'Enviando convite…');
    const { data, error } = await sb.functions.invoke('convidar', { body: { email, site: pastaSite } });
    $('bConvidar').disabled = false;
    if (error) {
      let texto = 'Não foi possível enviar o convite.';
      try { const j = await error.context.json(); if (j && j.erro) texto = j.erro; } catch (e) {}
      msg('mConvite', 'erro', texto); return;
    }
    $('cEmail').value = '';
    msg('mConvite', data && data.aviso ? 'info' : 'ok', (data && data.aviso) || 'Convite enviado para ' + email + ' ✓');
    carregar();
  });

  carregar();
})();
