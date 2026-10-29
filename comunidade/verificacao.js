// verificacao.js — v1.1 — selfie com código + documento
(async function () {
  'use strict';
  const { sb, $, msg, prepararFoto, exigirLogin } = window.BASE;

  const { user, perfil } = await exigirLogin();
  $('carregando').classList.add('oculto');

  if (perfil.status === 'aprovado') { location.replace('inicio.html'); return; }

  if (perfil.status === 'suspenso' || perfil.status === 'banido') {
    $('txtBloqueada').textContent = perfil.status === 'banido'
      ? 'Esta conta foi encerrada por violar as regras da comunidade.'
      : 'Sua conta está suspensa enquanto a administração analisa uma denúncia.';
    $('telaBloqueada').classList.remove('oculto');
    return;
  }

  if (perfil.status === 'em_analise') { $('telaAnalise').classList.remove('oculto'); return; }

  // ---------- pendente ----------
  const casal = perfil.tipo === 'casal';
  $('txtApelido').textContent = perfil.apelido;
  $('telaVerificar').classList.remove('oculto');

  // Última verificação recusada? Mostra o motivo
  const { data: ultima } = await sb.from('verificacoes')
    .select('status, motivo_recusa').eq('perfil', user.id)
    .order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (ultima && ultima.status === 'recusada') {
    msg('mRecusa', 'erro', 'Sua verificação anterior não foi aprovada' +
      (ultima.motivo_recusa ? ': ' + ultima.motivo_recusa : '.') + ' Faça de novo com um código novo.');
  }

  // Textos para casal ou individual
  const inst = casal ? [
    'Escreva o código acima num papel, à mão.',
    'Tirem uma selfie <b>os dois juntos</b>, com o rosto aparecendo e segurando o papel.',
    'Fotografe o documento com foto <b>de cada um</b>, com os dados legíveis.'
  ] : [
    'Escreva o código acima num papel, à mão.',
    'Tire uma selfie com o rosto aparecendo, segurando o papel.',
    'Fotografe seu documento com foto, com os dados legíveis.'
  ];
  inst.forEach(t => { const li = document.createElement('li'); li.innerHTML = t; $('instrucoes').appendChild(li); });
  if (casal) {
    $('lSelfie').textContent = 'Selfie dos DOIS juntos segurando o papel com o código';
    $('lDoc1').textContent = 'Documento com foto da 1ª pessoa';
    $('slotDoc2').classList.remove('oculto');
  }

  function mostrarCodigo(codigo) {
    $('txtCodigo').textContent = codigo;
    $('passoCodigo').classList.add('oculto');
    $('passoFotos').classList.remove('oculto');
  }

  // Se já existe um código aberto, mostra direto
  const { data: aberta } = await sb.from('verificacoes')
    .select('codigo').eq('perfil', user.id).eq('status', 'aguardando_fotos')
    .order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (aberta) mostrarCodigo(aberta.codigo);

  $('bCodigo').addEventListener('click', async () => {
    $('bCodigo').disabled = true;
    const { data, error } = await sb.rpc('iniciar_verificacao');
    $('bCodigo').disabled = false;
    if (error) { msg('mCodigo', 'erro', error.message || 'Não foi possível gerar o código.'); return; }
    mostrarCodigo(data);
  });

  // Pré-visualização das fotos
  const fotos = {};
  [['fSelfie', 'pSelfie'], ['fDoc1', 'pDoc1'], ['fDoc2', 'pDoc2']].forEach(([inp, prev]) => {
    $(inp).addEventListener('change', async () => {
      msg('mEnviar');
      const arq = $(inp).files[0];
      if (!arq) { delete fotos[inp]; $(prev).classList.add('oculto'); return; }
      try {
        const blob = await prepararFoto(arq);
        fotos[inp] = blob;
        if ($(prev).src) URL.revokeObjectURL($(prev).src);
        $(prev).src = URL.createObjectURL(blob);
        $(prev).classList.remove('oculto');
      } catch (e) {
        delete fotos[inp];
        $(inp).value = '';
        $(prev).classList.add('oculto');
        msg('mEnviar', 'erro', e.message);
      }
    });
  });

  $('bEnviar').addEventListener('click', async () => {
    const precisa = casal ? ['fSelfie', 'fDoc1', 'fDoc2'] : ['fSelfie', 'fDoc1'];
    if (precisa.some(k => !fotos[k])) {
      msg('mEnviar', 'erro', casal ? 'Envie a selfie e os documentos dos dois.' : 'Envie a selfie e o documento.');
      return;
    }
    $('bEnviar').disabled = true;
    msg('mEnviar', 'info', 'Enviando com segurança… não feche a página.');

    const nomes = { fSelfie: 'selfie', fDoc1: 'documento1', fDoc2: 'documento2' };
    const caminhos = [];
    const marca = Date.now();
    for (const k of precisa) {
      const caminho = user.id + '/' + marca + '-' + nomes[k] + '.jpg';
      const { error } = await sb.storage.from('verificacoes')
        .upload(caminho, fotos[k], { contentType: 'image/jpeg', upsert: false });
      if (error) {
        $('bEnviar').disabled = false;
        msg('mEnviar', 'erro', 'Falha ao enviar a foto. Verifique a internet e tente de novo.');
        return;
      }
      caminhos.push(caminho);
    }

    const { error } = await sb.rpc('enviar_verificacao', { p_fotos: caminhos });
    $('bEnviar').disabled = false;
    if (error) { msg('mEnviar', 'erro', error.message || 'Não foi possível concluir. Tente de novo.'); return; }

    $('telaVerificar').classList.add('oculto');
    $('telaAnalise').classList.remove('oculto');
    window.scrollTo(0, 0);
  });
})();
