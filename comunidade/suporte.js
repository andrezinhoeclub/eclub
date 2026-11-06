// suporte.js — v1.0 — "Falar com a Administração": perguntas frequentes + recado direto + atendimentos
(async function () {
  'use strict';
  const { sb, $, msg, exigirLogin, exigirMembro, moldura, toast } = window.BASE;

  // Quem ainda está na verificação também pode falar com a administração
  const { perfil: p0 } = await exigirLogin();
  if (p0.status === 'aprovado') {
    const { perfil, assinatura } = await exigirMembro({ semAssinatura: true });
    moldura(perfil, assinatura, '');
  } else {
    $('voltarVerif').classList.remove('oculto');
  }
  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');

  // ---------- Perguntas frequentes ----------
  const FAQ = [
    ['Quero denunciar um perfil',
     'Entre no perfil da pessoa e toque em <b>⚠️ Denunciar</b>, logo abaixo da foto. Escolha o motivo e, se quiser, explique o que aconteceu. A denúncia é anônima: a pessoa nunca sabe quem denunciou. Se também não quiser mais contato, toque em <b>🚫 Bloquear</b>. Caso seja algo urgente (golpe, ameaça, menor de idade), mande também um recado aqui embaixo com o <b>nº</b> do perfil.'],
    ['Esqueci minha senha',
     'Na tela de entrada, digite seu e-mail e toque em <b>Esqueci minha senha</b>. Chega um e-mail com o botão para criar uma senha nova (veja também a caixa de spam ou lixo eletrônico). Se você já está dentro, use <b>Menu → Trocar Senha</b>.'],
    ['Como edito meu perfil, fotos e apresentação?',
     'Toque no <b>ícone de perfil</b> no topo ou vá em <b>Menu → Editar Meu Perfil</b>. Lá você muda apelido, cidade, apresentação, o que procuram e as fotos.'],
    ['Como funciona a verificação?',
     'Todo perfil passa por verificação para garantir que são pessoas reais e maiores de 18 anos. Você envia as fotos pedidas na tela de <a href="verificacao.html">verificação</a>; elas ficam numa pasta privada que só a administração vê, e o documento é apagado depois da análise. Quando aprovado, você recebe acesso à comunidade e o selo de verificado.'],
    ['Assinatura, 7 dias grátis e os 5 minutos por dia',
     'Ao ser aprovado, você ganha <b>7 dias de acesso completo grátis</b>. Depois disso, sem assinatura, dá para usar a comunidade por <b>5 minutos por dia</b> (o relógio aparece no topo). Com a assinatura o uso é sem limite. Veja os valores em <a href="planos.html">Menu → Pagamento</a>. Se você pagou e o acesso não liberou, mande um recado aqui com o assunto <b>Assinatura e pagamento</b>.'],
    ['Quem pode ver meu álbum privado?',
     'Só quem você aceitar. O membro pede para ver, o pedido aparece no seu perfil (ícone com o número vermelho) e você aceita ou recusa. Você pode tirar o acesso de alguém quando quiser.'],
    ['Como crio um evento ou festa?',
     'Em <a href="eventos.html">Eventos</a>, toque em <b>Criar evento</b>. Para criar eventos é preciso ter <b>mais de 10 seguidores</b>, para evitar perfis falsos divulgando festas. O evento aparece para todos os membros, que podem tocar em <b>Eu vou</b> ou pedir para ir.'],
    ['Como avalio uma casa ou lugar?',
     'Em <a href="lugares.html">Lugares</a> aparecem as casas dos eventos em que você esteve. Toque em <b>Avaliar</b>, dê as estrelas e comente estrutura, atendimento, música, frequentadores e custo. Só avalia quem esteve lá. Dono de casa que quiser cuidar da página do lugar pode pedir aqui para ser o <b>responsável</b>.'],
    ['Como instalo o app no celular?',
     'Veja o passo a passo em <a href="instalar.html">Menu → Instalar o App no celular</a>. O app fica na tela inicial como qualquer outro, sem ocupar espaço.'],
    ['O que é a Navegação Discreta?',
     'Em <b>Menu → Navegação Discreta</b>, as fotos aparecem desfocadas e só revelam quando você toca. Bom para usar o celular perto de outras pessoas. O <b>Modo Escuro</b> e o tamanho das <b>Letras</b> também ficam no menu.'],
    ['Quero excluir minha conta',
     'Mande um recado aqui com o assunto <b>Outro assunto</b> pedindo a exclusão. A administração apaga seu perfil, fotos e mensagens, como manda a LGPD. Veja mais em <a href="regras.html#privacidade">Privacidade</a>.']
  ];
  const faq = $('faq');
  FAQ.forEach(([perg, resp]) => {
    const d = document.createElement('details');
    const s = document.createElement('summary'); s.textContent = perg;
    const r = document.createElement('div'); r.className = 'resp'; r.innerHTML = resp; // texto fixo do próprio site
    d.append(s, r); faq.appendChild(d);
  });
  faq.addEventListener('toggle', (e) => {  // abre uma por vez
    if (e.target.open) faq.querySelectorAll('details[open]').forEach(x => { if (x !== e.target) x.open = false; });
  }, true);

  // ---------- Atendimentos ----------
  const quando = (d) => { const x = new Date(d); return x.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const ROT = { aberto: 'Aguardando resposta', respondido: 'Respondido', fechado: 'Encerrado' };
  let aberto = null;

  async function carregarMeus() {
    const { data, error } = await sb.rpc('meus_chamados');
    const box = $('meus'); box.innerHTML = '';
    if (error || !data || !data.length) { $('secMeus').classList.add('oculto'); return; }
    $('secMeus').classList.remove('oculto');
    data.forEach(c => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sup-item';
      const t = document.createElement('div'); t.className = 'sup-topo';
      const a = document.createElement('b'); a.textContent = c.assunto;
      if (!c.lido) { const n = document.createElement('span'); n.className = 'novo-r'; n.textContent = 'RESPOSTA NOVA'; a.appendChild(n); }
      const st = document.createElement('span'); st.className = 'selo sup-' + c.status; st.textContent = ROT[c.status] || c.status;
      t.append(a, st);
      const u = document.createElement('div'); u.className = 'suave'; u.style.fontSize = '.86rem';
      u.textContent = quando(c.atualizado_em) + ' · ' + (c.ultima || '');
      b.append(t, u);
      b.addEventListener('click', () => abrir(c));
      box.appendChild(b);
    });
    return data;
  }

  async function abrir(c) {
    aberto = c;
    const { data, error } = await sb.rpc('mensagens_chamado', { p_chamado: c.id });
    if (error) { toast('Erro: ' + error.message); return; }
    $('cAssunto').textContent = c.assunto;
    $('cStatus').className = 'selo sup-' + c.status; $('cStatus').textContent = ROT[c.status] || c.status;
    $('cMsgs').innerHTML = '';
    window.SUPORTE_conversa($('cMsgs'), data, quando);
    const fechado = c.status === 'fechado';
    $('cResponder').classList.toggle('oculto', fechado);
    $('cFechado').classList.toggle('oculto', !fechado);
    $('mConversa').className = 'msg'; $('mConversa').textContent = '';
    $('caixaConversa').classList.remove('oculto');
    $('caixaConversa').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!c.lido) { c.lido = true; carregarMeus(); if (window.BASE.avisos) window.BASE.avisos(); }
  }
  $('cFechar').addEventListener('click', (e) => { e.preventDefault(); $('caixaConversa').classList.add('oculto'); aberto = null; });

  $('cEnviar').addEventListener('click', async () => {
    if (!aberto) return;
    const t = $('cTexto').value.trim();
    if (!t) { msg('mConversa', 'erro', 'Escreva a mensagem.'); return; }
    $('cEnviar').disabled = true;
    const { error } = await sb.rpc('responder_chamado', { p_chamado: aberto.id, p_texto: t });
    $('cEnviar').disabled = false;
    if (error) { msg('mConversa', 'erro', error.message); return; }
    $('cTexto').value = '';
    const lista = await carregarMeus();
    const c = (lista || []).find(x => x.id === aberto.id) || aberto;
    abrir(c);
  });

  $('nEnviar').addEventListener('click', async () => {
    const assunto = $('nAssunto').value, texto = $('nTexto').value.trim();
    if (!assunto) { msg('mNovo', 'erro', 'Escolha o assunto.'); return; }
    if (texto.length < 5) { msg('mNovo', 'erro', 'Escreva a sua mensagem.'); return; }
    $('nEnviar').disabled = true;
    const { data: id, error } = await sb.rpc('abrir_chamado', { p_assunto: assunto, p_texto: texto });
    $('nEnviar').disabled = false;
    if (error) { msg('mNovo', 'erro', error.message); return; }
    $('nTexto').value = ''; $('nAssunto').value = '';
    msg('mNovo', 'ok', 'Recado enviado ✓ A administração responde por aqui. Quando chegar a resposta, aparece um aviso no menu.');
    const lista = await carregarMeus();
    const c = (lista || []).find(x => x.id === id);
    if (c) abrir(c);
  });

  // Abrir direto um atendimento: suporte.html?id=123  |  assunto pronto: suporte.html?assunto=...
  const qs = new URLSearchParams(location.search);
  const lista = await carregarMeus();
  const pedido = parseInt(qs.get('id') || '', 10);
  if (pedido && lista) { const c = lista.find(x => x.id === pedido); if (c) abrir(c); }
  else if (lista) { const novo = lista.find(x => !x.lido); if (novo) abrir(novo); }
  if (qs.get('assunto')) { const o = [...$('nAssunto').options].find(x => x.text === qs.get('assunto')); if (o) $('nAssunto').value = o.value; }
})();
