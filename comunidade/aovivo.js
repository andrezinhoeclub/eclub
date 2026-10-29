// aovivo.js — v1.0 — Ao Vivo / Radar / Busca: grade de membros com filtros
(async function () {
  'use strict';
  const { sb, $, formacao, idades, links, fotoProtegida, moldura, exigirMembro, UFS } = window.BASE;

  const { perfil: eu, assinatura } = await exigirMembro();
  const params = new URLSearchParams(location.search);
  moldura(eu, assinatura, params.get('busca') ? 'busca' : 'radar');

  UFS.forEach(u => { const o = document.createElement('option'); o.value = u; o.textContent = u; $('fUf').appendChild(o); });
  let uf = params.get('uf');
  if (!uf) { try { uf = localStorage.getItem('filtroUf'); } catch (e) {} }
  if (uf && UFS.includes(uf)) $('fUf').value = uf;
  let online = params.get('online') === '1';
  $('fOnline').classList.toggle('sel', online);
  if (online) $('titulo').textContent = 'Ao Vivo · online agora';
  if (params.get('busca')) { $('titulo').textContent = 'Buscar membros'; setTimeout(() => $('fBusca').focus(), 50); }

  $('carregando').classList.add('oculto');
  $('tela').classList.remove('oculto');

  const POR_PAGINA = 40;
  let pagina = 0, timer;

  async function carregar(reiniciar) {
    if (reiniciar) { pagina = 0; $('lista').innerHTML = ''; }
    $('bMais').classList.add('oculto');
    let q = sb.from('perfis_publicos')
      .select('id, apelido, tipo, sexo_1, sexo_2, idade_1, idade_2, cidade, uf, foto_perfil, ultimo_acesso')
      .neq('id', eu.id)
      .order('ultimo_acesso', { ascending: false, nullsFirst: false })
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    if ($('fTipo').value) q = q.eq('tipo', $('fTipo').value);
    if ($('fUf').value) q = q.eq('uf', $('fUf').value);
    if (online) q = q.gt('ultimo_acesso', new Date(Date.now() - 15 * 60000).toISOString());
    const busca = $('fBusca').value.trim().replace(/[%_\\,()]/g, '');
    if (busca) q = q.ilike('apelido', '%' + busca + '%');

    const { data, error } = await q;
    if (error) { $('vazio').classList.remove('oculto'); return; }
    $('vazio').classList.toggle('oculto', !(reiniciar && data.length === 0));
    const urls = await links(data.map(p => p.foto_perfil).filter(Boolean));
    const limiteOnline = Date.now() - 15 * 60000;

    data.forEach(p => {
      const a = document.createElement('a'); a.className = 'membro';
      a.href = 'perfil.html?id=' + encodeURIComponent(p.id);
      const capa = document.createElement('div'); capa.className = 'capa';
      if (p.foto_perfil && urls[p.foto_perfil]) capa.appendChild(fotoProtegida(urls[p.foto_perfil], { cortar: true, largura: 400, alt: p.apelido }));
      else capa.textContent = p.tipo === 'casal' ? '💑' : (p.tipo === 'solteira' ? '👩' : '👨');
      if (p.ultimo_acesso && new Date(p.ultimo_acesso).getTime() > limiteOnline) {
        const o = document.createElement('span'); o.className = 'online'; o.title = 'online agora'; capa.appendChild(o);
      }
      const info = document.createElement('div'); info.className = 'info';
      const b = document.createElement('b'); b.textContent = p.apelido;
      const s1 = document.createElement('span'); s1.textContent = formacao(p) + ' · ' + idades(p);
      const s2 = document.createElement('span'); s2.textContent = p.cidade + ' . ' + p.uf;
      info.append(b, s1, s2);
      a.append(capa, info);
      $('lista').appendChild(a);
    });
    if (data.length === POR_PAGINA) $('bMais').classList.remove('oculto');
  }

  $('fTipo').addEventListener('change', () => carregar(true));
  $('fUf').addEventListener('change', () => { try { localStorage.setItem('filtroUf', $('fUf').value); } catch (e) {} carregar(true); });
  $('fOnline').addEventListener('click', () => { online = !online; $('fOnline').classList.toggle('sel', online); carregar(true); });
  $('fBusca').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => carregar(true), 400); });
  $('bMais').addEventListener('click', () => { pagina++; carregar(false); });
  carregar(true);
})();
