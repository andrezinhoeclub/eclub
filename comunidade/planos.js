// planos.js — v1.0 — situação da assinatura e planos (pagamento por Pix entra na próxima fase)
(async function () {
  'use strict';
  const { sb, $, msg, moldura, exigirMembro, emBreve } = window.BASE;

  const { perfil: eu, assinatura: a } = await exigirMembro({ semAssinatura: true });
  moldura(eu, a, '');
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const real = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Situação
  const s = $('situacao');
  if (a.admin) { s.append(el('h2', null, '👑 Administração'), el('p', 'suave', 'Sua conta tem acesso total, sem mensalidade.')); }
  else if (a.isento) { s.append(el('h2', null, '👑 Conta isenta'), el('p', 'suave', 'A administração liberou seu acesso sem mensalidade.')); }
  else if (a.ativa) {
    s.append(el('h2', null, '✅ Assinatura ativa'),
      el('p', null, 'Restam ' + a.dias_restantes + ' dia(s) — até ' + new Date(a.acesso_ate).toLocaleDateString('pt-BR') + '.'),
      el('p', 'suave', 'Se assinar de novo agora, os dias são somados ao que ainda resta.'));
  } else {
    s.append(el('h2', null, a.acesso_ate ? '⏰ Sua assinatura venceu' : '👋 Falta só a assinatura'),
      el('p', null, 'Seu perfil está verificado. Escolha um plano para entrar na comunidade.'));
  }

  // Planos
  const { data: planos } = await sb.from('planos').select('id, nome, dias, valor').eq('ativo', true).order('ordem');
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
    b.addEventListener('click', () => msg('mPlanos', 'info', 'O pagamento por Pix será liberado na próxima atualização. Enquanto isso, fale com a administração para liberar seu acesso.'));
    c.appendChild(b);
    $('planos').appendChild(c);
  });
  $('bPresente').addEventListener('click', emBreve);

  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');
})();
