// entrar.js — v1.0 — login, cadastro (casal / solteira / solteiro) e recuperação de senha
(function () {
  'use strict';

  const A = window.APP || {};
  const $ = (id) => document.getElementById(id);
  document.title = 'Entrar · ' + A.NOME;
  $('nomeApp').textContent = A.NOME;

  if (!window.supabase || !A.SUPABASE_URL || A.SUPABASE_URL.includes('SEU-PROJETO')) {
    msg('mEntrar', 'erro', 'Site ainda não configurado (arquivo config.js).');
    return;
  }
  const sb = window.supabase.createClient(A.SUPABASE_URL, A.SUPABASE_CHAVE_PUBLICA, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // ---------- utilidades ----------
  function msg(id, tipo, texto) {
    const el = $(id);
    el.className = 'msg ' + (tipo || '');
    el.textContent = texto || '';
  }
  const pasta = location.pathname.replace(/[^/]*$/, '');
  const urlDe = (pagina) => location.origin + pasta + pagina;

  function idade(dataISO) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO || '')) return -1;
    const n = new Date(dataISO + 'T12:00:00'), h = new Date();
    let i = h.getFullYear() - n.getFullYear();
    const m = h.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < n.getDate())) i--;
    return i;
  }
  const senhaBoa = (s) => typeof s === 'string' && s.length >= 10 && /[A-Za-z]/.test(s) && /\d/.test(s);
  const emailBom = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

  // ---------- abas ----------
  function mostrar(aba) {
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
    $('fEntrar').classList.toggle('oculto', aba !== 'entrar');
    $('fCadastro').classList.toggle('oculto', aba !== 'cadastro');
    $('fNovaSenha').classList.toggle('oculto', aba !== 'novasenha');
    $('abas').classList.toggle('oculto', aba === 'novasenha');
  }
  document.querySelectorAll('#abas button').forEach(b => b.addEventListener('click', () => mostrar(b.dataset.aba)));

  // ---------- para onde vai depois de entrar ----------
  async function encaminhar() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: p, error } = await sb.from('perfis').select('status').eq('id', user.id).maybeSingle();
    if (error || !p) { msg('mEntrar', 'erro', 'Não foi possível carregar seu perfil. Tente de novo.'); return; }
    if (p.status === 'suspenso' || p.status === 'banido') {
      await sb.auth.signOut();
      msg('mEntrar', 'erro', p.status === 'banido'
        ? 'Esta conta foi encerrada por violar as regras.'
        : 'Sua conta está suspensa enquanto a administração analisa uma denúncia.');
      return;
    }
    location.replace(p.status === 'aprovado' ? 'inicio.html' : 'verificacao.html');
  }

  // ---------- ENTRAR ----------
  let falhas = 0, travadoAte = 0;
  $('fEntrar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (Date.now() < travadoAte) {
      msg('mEntrar', 'erro', 'Muitas tentativas. Aguarde um minuto e tente de novo.'); return;
    }
    const email = $('eEmail').value.trim().toLowerCase(), senha = $('eSenha').value;
    if (!emailBom(email) || !senha) { msg('mEntrar', 'erro', 'Preencha e-mail e senha.'); return; }
    $('bEntrar').disabled = true; msg('mEntrar');
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    $('bEntrar').disabled = false;
    if (error) {
      falhas++;
      if (falhas >= 5) { travadoAte = Date.now() + 60000; falhas = 0; }
      const naoConfirmado = /confirm/i.test(error.message);
      msg('mEntrar', 'erro', naoConfirmado
        ? 'Confirme seu e-mail primeiro (veja a caixa de entrada e o spam).'
        : 'E-mail ou senha incorretos.');
      return;
    }
    $('eSenha').value = '';
    encaminhar();
  });

  // ---------- ESQUECI A SENHA ----------
  $('bEsqueci').addEventListener('click', async () => {
    const email = $('eEmail').value.trim().toLowerCase();
    if (!emailBom(email)) { msg('mEntrar', 'erro', 'Digite seu e-mail no campo acima e toque de novo em "Esqueci minha senha".'); return; }
    await sb.auth.resetPasswordForEmail(email, { redirectTo: urlDe('entrar.html') });
    // Mensagem igual existindo ou não a conta (não revela quem é membro)
    msg('mEntrar', 'ok', 'Se este e-mail tiver conta, você vai receber um link para criar uma nova senha.');
  });

  sb.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') mostrar('novasenha');
  });

  $('fNovaSenha').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const s1 = $('nSenha').value, s2 = $('nSenha2').value;
    if (!senhaBoa(s1)) { msg('mNovaSenha', 'erro', 'A senha precisa ter 10 caracteres ou mais, com letras e números.'); return; }
    if (s1 !== s2) { msg('mNovaSenha', 'erro', 'As senhas não são iguais.'); return; }
    $('bNovaSenha').disabled = true;
    const { error } = await sb.auth.updateUser({ password: s1 });
    $('bNovaSenha').disabled = false;
    if (error) { msg('mNovaSenha', 'erro', 'Não foi possível salvar. Peça um novo link.'); return; }
    msg('mNovaSenha', 'ok', 'Senha alterada! Entrando…');
    setTimeout(encaminhar, 900);
  });

  // ---------- CADASTRO ----------
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  $('cUf').innerHTML = '<option value="">UF</option>';
  UFS.forEach(u => { const o = document.createElement('option'); o.value = u; o.textContent = u; $('cUf').appendChild(o); });

  let tipo = null;
  const procura = new Set();

  function rotulos() {
    if (tipo !== 'casal') { $('lNasc1').textContent = 'Data de nascimento'; return; }
    const [s1, s2] = $('cComp').value.split('-');
    const pron = (s) => s === 'M' ? 'dele' : 'dela';
    const igual = s1 === s2;
    $('lNasc1').textContent = 'Nascimento ' + pron(s1) + (igual ? ' (1)' : '');
    $('lNasc2').textContent = 'Nascimento ' + pron(s2) + (igual ? ' (2)' : '');
  }

  document.querySelectorAll('#tipos .tipo').forEach(t => t.addEventListener('click', () => {
    tipo = t.dataset.tipo;
    document.querySelectorAll('#tipos .tipo').forEach(x => x.classList.toggle('sel', x === t));
    $('blocoCasal').classList.toggle('oculto', tipo !== 'casal');
    $('blocoNasc2').classList.toggle('oculto', tipo !== 'casal');
    $('blocoDados').classList.remove('oculto');
    $('t18').textContent = tipo === 'casal'
      ? 'Declaramos que os DOIS têm 18 anos ou mais, que os dois concordam com este perfil, e vamos comprovar com documento na verificação.'
      : 'Declaro que tenho 18 anos ou mais e vou comprovar com documento na verificação.';
    rotulos();
  }));
  $('cComp').addEventListener('change', rotulos);

  document.querySelectorAll('#procura .chip').forEach(c => c.addEventListener('click', () => {
    if (procura.has(c.dataset.v)) procura.delete(c.dataset.v); else procura.add(c.dataset.v);
    c.classList.toggle('sel', procura.has(c.dataset.v));
  }));

  // apelido disponível?
  let apelidoOk = false, apelidoTimer;
  $('cApelido').addEventListener('input', () => {
    clearTimeout(apelidoTimer);
    const v = $('cApelido').value.trim(), d = $('dApelido');
    apelidoOk = false;
    if (!/^[A-Za-z0-9_.]{3,24}$/.test(v)) {
      d.className = 'dica ruim'; d.textContent = '3 a 24 caracteres: letras, números, ponto ou _.'; return;
    }
    d.className = 'dica'; d.textContent = 'Verificando…';
    apelidoTimer = setTimeout(async () => {
      const { data, error } = await sb.rpc('apelido_disponivel', { p_apelido: v });
      if ($('cApelido').value.trim() !== v) return;
      apelidoOk = !error && data === true;
      d.className = 'dica ' + (apelidoOk ? 'ok' : 'ruim');
      d.textContent = apelidoOk ? 'Disponível ✓' : 'Este apelido já está em uso.';
    }, 450);
  });

  $('cSenha').addEventListener('input', () => {
    const ok = senhaBoa($('cSenha').value);
    $('dSenha').className = 'dica ' + (ok ? 'ok' : 'ruim');
  });

  $('fCadastro').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = (t) => msg('mCadastro', 'erro', t);
    if (!tipo) return erro('Escolha: Casal, Solteira ou Solteiro.');

    let sexo1, sexo2 = '';
    if (tipo === 'casal') [sexo1, sexo2] = $('cComp').value.split('-');
    else sexo1 = tipo === 'solteira' ? 'F' : 'M';

    const n1 = $('cNasc1').value, n2 = tipo === 'casal' ? $('cNasc2').value : '';
    const i1 = idade(n1), i2 = tipo === 'casal' ? idade(n2) : 99;
    if (i1 < 0 || (tipo === 'casal' && i2 < 0)) return erro('Preencha a data de nascimento' + (tipo === 'casal' ? ' dos dois.' : '.'));
    if (i1 < 18 || i2 < 18) return erro('Cadastro permitido somente para maiores de 18 anos' + (tipo === 'casal' ? ' (os dois).' : '.'));
    if (i1 > 105 || i2 > 105) return erro('Data de nascimento inválida.');

    const apelido = $('cApelido').value.trim();
    if (!apelidoOk) return erro('Escolha um apelido válido e disponível.');
    const cidade = $('cCidade').value.trim(), uf = $('cUf').value;
    if (cidade.length < 2 || !uf) return erro('Informe cidade e UF.');
    if (procura.size === 0) return erro('Marque quem vocês procuram.');

    const email = $('cEmail').value.trim().toLowerCase();
    if (!emailBom(email)) return erro('E-mail inválido.');
    const s1 = $('cSenha').value, s2 = $('cSenha2').value;
    if (!senhaBoa(s1)) return erro('A senha precisa ter 10 caracteres ou mais, com letras e números.');
    if (s1 !== s2) return erro('As senhas não são iguais.');
    if (s1.toLowerCase().includes(apelido.toLowerCase())) return erro('A senha não pode conter o apelido.');
    if (!$('a18').checked || !$('aRegras').checked || !$('aDados').checked)
      return erro('É preciso marcar as três confirmações para criar a conta.');

    $('bCadastrar').disabled = true; msg('mCadastro');
    const { error } = await sb.auth.signUp({
      email, password: s1,
      options: {
        emailRedirectTo: urlDe('entrar.html'),
        data: {
          apelido, tipo, sexo_1: sexo1, nascimento_1: n1, sexo_2: sexo2, nascimento_2: n2,
          cidade, uf, procura: [...procura],
          aceite_termos: 'sim', aceite_maioridade: 'sim', aceite_dados_sensiveis: 'sim',
          termos_versao: A.TERMOS_VERSAO
        }
      }
    });
    $('bCadastrar').disabled = false;

    if (error) {
      if (/registered|already/i.test(error.message)) return erro('Já existe uma conta com este e-mail. Use "Entrar" ou "Esqueci minha senha".');
      if (/database error/i.test(error.message)) return erro('Não foi possível criar a conta. Confira a idade e se o apelido ainda está livre.');
      if (/rate|too many/i.test(error.message)) return erro('Muitas tentativas. Aguarde alguns minutos.');
      return erro('Não foi possível criar a conta agora. Tente de novo em instantes.');
    }
    $('cSenha').value = $('cSenha2').value = '';
    $('blocoDados').classList.add('oculto');
    msg('mCadastro', 'ok', 'Conta criada! Enviamos um link para ' + email +
      '. Abra o e-mail (veja também o spam), confirme e depois entre para fazer a verificação do perfil.');
  });

  // Já está logado? (ou voltou pelo link de confirmação) → segue direto
  sb.auth.getSession().then(({ data }) => {
    if (data.session && !location.hash.includes('type=recovery')) encaminhar();
  });
})();
