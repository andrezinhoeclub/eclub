// convidar.js — v1.1 — enviar convites por e-mail e acompanhar
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, tempo, toast } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  moldura(eu, assinatura, '');
  if (assinatura.admin) $('txtLimite').textContent = 'Administração: sem limite de convites.';
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');

  const pastaSite = location.origin + location.pathname.replace(/[^/]*$/, '');

  // Admin vê os convites de todo mundo (para poder cancelar); membro vê só os seus
  async function carregar() {
    let q = sb.from('convites').select('id, email, status, criado_em, aceito_em, aceito_por, padrinho, perfis!convites_padrinho_fkey(apelido)')
      .neq('status', 'cancelado').order('criado_em', { ascending: false }).limit(100);
    if (!assinatura.admin) q = q.eq('padrinho', eu.id);
    const { data } = await q;
    const todos = data || [];
    const meus = todos.filter(c => c.padrinho === eu.id);
    $('nEnviados').textContent = meus.length;
    $('nAceitos').textContent = meus.filter(c => c.status === 'aceito').length;
    $('lista').innerHTML = '';
    $('vazio').classList.toggle('oculto', todos.length > 0);
    const rot = { enviado: '⏳ aguardando', aceito: '✅ entrou' };
    todos.forEach(c => {
      const d = document.createElement('div'); d.className = 'pessoa';
      const e = document.createElement('div');
      const b = document.createElement('b'); b.textContent = c.email;
      const s = document.createElement('div'); s.className = 'suave';
      s.textContent = 'enviado ' + tempo(c.criado_em) +
        (c.padrinho !== eu.id && c.perfis ? ' · por ' + c.perfis.apelido : '');
      e.append(b, s);
      const dir = document.createElement('div'); dir.style.cssText = 'margin-left:auto;text-align:right';
      const st = document.createElement('div'); st.className = 'suave'; st.textContent = rot[c.status] || c.status;
      dir.appendChild(st);
      if (c.status === 'enviado') {
        const x = document.createElement('button'); x.type = 'button'; x.className = 'lnk-excluir'; x.textContent = '🗑 Excluir';
        x.addEventListener('click', async () => {
          if (!x.dataset.ok) { x.dataset.ok = '1'; x.textContent = 'Tocar de novo p/ excluir'; setTimeout(() => { delete x.dataset.ok; x.textContent = '🗑 Excluir'; }, 4000); return; }
          x.disabled = true;
          const { data: r, error } = await sb.rpc('cancelar_convite', { p_id: c.id });
          if (error) { x.disabled = false; toast('Erro: ' + error.message); return; }
          toast(r === 'cancelado_sem_apagar_conta'
            ? 'Convite cancelado. (O link antigo pode ainda abrir a tela de cadastro.)'
            : 'Convite excluído ✓ O link antigo parou de funcionar e você pode convidar de novo.');
          carregar();
        });
        dir.appendChild(x);
      }
      d.append(e, dir); $('lista').appendChild(d);
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
