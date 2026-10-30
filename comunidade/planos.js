// planos.js — v1.3 — situação da assinatura e planos (pagamento por Pix entra na próxima fase)
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, emBreve } = window.BASE;

  const { user, perfil: eu, assinatura: a } = await exigirMembro({ semAssinatura: true });
  moldura(eu, a, '');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const real = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Situação
  const s = $('situacao');
  if (a.admin) { s.append(el('h2', null, '👑 Administração'), el('p', 'suave', 'Sua conta tem acesso total, sem mensalidade.')); }
  else if (a.isento) { s.append(el('h2', null, '👑 Conta isenta'), el('p', 'suave', 'A administração liberou seu acesso sem mensalidade.')); }
  else if (a.ativa && a.em_teste) {
    s.append(el('h2', null, '🎁 Período de teste grátis'),
      el('p', null, 'Você está com acesso completo por mais ' + a.dias_restantes + ' dia(s), até ' + new Date(a.acesso_ate).toLocaleDateString('pt-BR') + '.'),
      el('p', 'suave', 'Depois disso, sem assinatura, a comunidade fica liberada só 5 minutos por dia. Se assinar agora, os dias de teste são somados.'));
  }
  else if (a.ativa) {
    s.append(el('h2', null, '✅ Assinatura ativa'),
      el('p', null, 'Restam ' + a.dias_restantes + ' dia(s) — até ' + new Date(a.acesso_ate).toLocaleDateString('pt-BR') + '.'),
      el('p', 'suave', 'Se assinar de novo agora, os dias são somados ao que ainda resta.'));
  } else {
    const acabou = new URLSearchParams(location.search).get('tempo') === 'acabou';
    s.append(el('h2', null, acabou ? '⏰ Seu tempo grátis de hoje acabou' : (a.acesso_ate ? '⏰ Sua assinatura venceu' : '👋 Falta só a assinatura')),
      el('p', null, 'Sem assinatura, você pode usar a comunidade por 5 minutos por dia. Assine para usar à vontade.'));
    if (!acabou) { const v = el('a', 'btn secundario', 'Usar meus 5 minutos grátis de hoje'); v.href = 'inicio.html'; v.style.marginTop = '8px'; s.appendChild(v); }
    else s.appendChild(el('p', 'suave', 'Amanhã você ganha mais 5 minutos.'));
  }

  // Planos
  const { data: planos } = await sb.from('planos').select('id, nome, dias, valor, link_pagamento').eq('ativo', true).order('ordem');
  const mensal = (planos || []).find(p => p.dias === 30);
  (planos || []).forEach(p => {
    const c = el('div', 'plano');
    const esq = el('div'); esq.append(el('b', null, p.nome), el('div', 'suave', p.dias + ' dias de uso'));
    const [inteiro, cent] = real(p.valor).split(',');
    const preco = el('div', 'preco'); preco.append(inteiro + ','); preco.appendChild(el('small', null, cent));
    c.append(esq, preco);
    if (mensal && p.dias > 30) {
      const economia = Math.round((mensal.valor * p.dias / 30 - p.valor) * 100) / 100;
      if (economia > 0) {
        const meses = Math.floor(economia / mensal.valor + 0.001);
        c.appendChild(el('div', 'economia', 'Economize ' + real(economia) + (meses >= 1 ? ' (' + meses + (meses === 1 ? ' mensalidade)' : ' mensalidades)') : '')));
      }
    }
    const b = el('button', 'btn', 'Assinar'); b.type = 'button';
    b.addEventListener('click', () => {
      if (!p.link_pagamento) { msg('mPlanos', 'info', 'Este plano ainda não está disponível para pagamento. Fale com a administração.'); return; }
      const u = new URL(p.link_pagamento);
      if (user && user.email) u.searchParams.set('email', user.email);
      msg('mPlanos', 'info', 'Abrindo o pagamento… Use o e-mail ' + (user && user.email || 'da sua conta') +
        ' no pagamento: assim seus dias são liberados sozinhos em instantes.');
      setTimeout(() => { location.href = u.toString(); }, 1200);
    });
    c.appendChild(b);
    $('planos').appendChild(c);
  });
  $('bPresente').addEventListener('click', emBreve);

  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
})();
