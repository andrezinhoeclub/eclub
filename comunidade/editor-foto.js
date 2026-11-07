// editor-foto.js — v1.2 — esconder rostos antes de publicar (borrar / tarja), girar, detecção automática de rosto
// Uso: const r = await window.EDITOR_FOTO.editar(blob, estadoAnterior)  →  { blob, estado } ou null (cancelou)
(function () {
  'use strict';

  const FACEAPI = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js';
  const MODELOS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model/';

  const CSS = `
.ef-fundo{position:fixed;inset:0;z-index:9000;background:#000d;display:flex;flex-direction:column;align-items:center;overflow:auto;-webkit-overflow-scrolling:touch}
.ef-caixa{width:100%;max-width:560px;background:var(--cartao,#15120e);color:var(--texto,#f3ece0);min-height:100%;display:flex;flex-direction:column}
.ef-topo{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--linha,#2b251c)}
.ef-topo b{font-size:1.02rem}
.ef-topo button{background:none;border:0;color:inherit;font-size:1.5rem;line-height:1;cursor:pointer;padding:0 4px}
.ef-proibido{background:#e5484d;color:#fff;font-size:.82rem;line-height:1.35;padding:9px 14px}
.ef-proibido b{display:block;font-size:.9rem;letter-spacing:.02em}
.ef-palco{position:relative;background:#000;display:flex;justify-content:center;align-items:center;padding:6px}
.ef-palco canvas{max-width:100%;max-height:58vh;touch-action:none;cursor:crosshair;display:block}
.ef-status{font-size:.85rem;padding:9px 14px;color:var(--suave,#a8998a);min-height:20px}
.ef-status.ok{color:var(--ok,#51b36a)} .ef-status.alerta{color:var(--aviso,#f0a020)}
.ef-ferr{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 10px}
.ef-ferr button{border:1px solid var(--linha,#2b251c);background:var(--cartao2,#1e1a14);color:inherit;border-radius:999px;padding:8px 13px;font:500 .86rem Inter,sans-serif;cursor:pointer}
.ef-ferr button.sel{background:var(--marca,#c9a45c);border-color:var(--marca,#c9a45c);color:var(--marca-txt,#1a1408)}
.ef-tam{display:flex;align-items:center;gap:10px;padding:0 14px 10px;font-size:.86rem}
.ef-tam input{flex:1;accent-color:var(--marca,#c9a45c)}
.ef-tam b{min-width:42px;text-align:right;font-weight:600}
.ef-tam button{border:1px solid var(--linha,#2b251c);background:var(--cartao2,#1e1a14);color:inherit;border-radius:999px;padding:6px 11px;font:500 .82rem Inter,sans-serif;cursor:pointer}
.ef-tam button:disabled{opacity:.35}
.ef-dica{font-size:.8rem;color:var(--suave,#a8998a);padding:0 14px 10px;line-height:1.4}
.ef-conf{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;margin:0 14px 10px;border:1px solid var(--linha,#2b251c);border-radius:10px;font-size:.88rem;cursor:pointer}
.ef-conf input{width:20px;height:20px;flex:0 0 20px;margin:1px 0 0;accent-color:var(--marca,#c9a45c)}
.ef-erro{color:#e5484d;font-size:.85rem;padding:0 14px 8px;min-height:1px}
.ef-botoes{display:grid;grid-template-columns:1fr 1.4fr;gap:10px;padding:4px 14px 18px;margin-top:auto}
.ef-botoes button{padding:13px;border-radius:10px;font:700 .95rem Inter,sans-serif;cursor:pointer;border:1px solid var(--linha,#2b251c);background:var(--cartao2,#1e1a14);color:inherit}
.ef-botoes .usar{background:linear-gradient(135deg,#f1d999,#c9a45c 45%,#f6e3ae 70%,#b8913f);color:#1a1408;border:0}
`;

  function estilo() {
    if (document.getElementById('ef-css')) return;
    const s = document.createElement('style'); s.id = 'ef-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  // ---------- Detecção de rosto (carrega só quando precisa, uma vez) ----------
  let carregando = null;
  function carregarDetector() {
    if (carregando) return carregando;
    carregando = new Promise((ok, falha) => {
      if (window.faceapi) return ok(window.faceapi);
      const s = document.createElement('script'); s.src = FACEAPI; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => window.faceapi ? ok(window.faceapi) : falha(new Error('sem faceapi'));
      s.onerror = () => falha(new Error('não carregou'));
      document.head.appendChild(s);
    }).then(async (fa) => {
      await fa.nets.tinyFaceDetector.loadFromUri(MODELOS);
      return fa;
    }).catch((e) => { carregando = null; throw e; });
    return carregando;
  }
  async function acharRostos(canvas) {
    const fa = await carregarDetector();
    const caixas = [];
    // duas passadas (rostos pequenos e grandes)
    for (const tam of [416, 608]) {
      const r = await fa.detectAllFaces(canvas, new fa.TinyFaceDetectorOptions({ inputSize: tam, scoreThreshold: 0.3 }));
      r.forEach(d => caixas.push(d.box));
    }
    // aumenta a caixa (testa, queixo, cabelo) e junta as repetidas
    const out = [];
    caixas.forEach(b => {
      const mx = b.width * 0.12, my = b.height * 0.2;
      const r = { x: b.x - mx, y: b.y - my * 1.2, w: b.width + 2 * mx, h: b.height + my * 1.9, auto: true, s: 1 };
      if (!out.some(o => sobrepoe(o, r) > 0.4)) out.push(r);
    });
    return out;
  }
  function sobrepoe(a, b) {
    const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return (x * y) / Math.min(a.w * a.h, b.w * b.h);
  }

  // ---------- Desenho ----------
  function girarCanvas(img, rot) {
    const c = document.createElement('canvas');
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const deitado = rot % 2 === 1;
    c.width = deitado ? H : W; c.height = deitado ? W : H;
    const x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 2);
    x.drawImage(img, -W / 2, -H / 2);
    return c;
  }
  function limitar(r, W, H) {
    const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
    return { x, y, w: Math.min(W, Math.round(r.x + r.w)) - x, h: Math.min(H, Math.round(r.y + r.h)) - y };
  }
  // Borrão forte: reduz a área a poucos pixels e amplia de novo (funciona em todos os celulares)
  function borrar(ctx, r) {
    if (r.w < 2 || r.h < 2) return;
    const passos = [Math.max(r.w, r.h) / 4, Math.max(r.w, r.h) / 10];
    for (const div of passos) {
      const pw = Math.max(1, Math.round(r.w / div)), ph = Math.max(1, Math.round(r.h / div));
      const p = document.createElement('canvas'); p.width = pw; p.height = ph;
      const px = p.getContext('2d'); px.imageSmoothingEnabled = true; px.imageSmoothingQuality = 'high';
      px.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, pw, ph);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(p, 0, 0, pw, ph, r.x, r.y, r.w, r.h);
    }
  }
  // Tamanho escolhido no controle (s = 0.4 a 1.5), mantendo o centro
  function efetivo(r) {
    const s = r.s || 1, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    return { x: cx - r.w * s / 2, y: cy - r.h * s / 2, w: r.w * s, h: r.h * s };
  }
  function forma(ctx, r, oval) {
    ctx.beginPath();
    if (oval) ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    else ctx.rect(r.x, r.y, r.w, r.h);
  }
  function aplicar(base, estado) {
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const x = c.getContext('2d'); x.drawImage(base, 0, 0);
    const oval = estado.forma !== 'quadrado';
    estado.rects.forEach(r0 => {
      const r = limitar(efetivo(r0), c.width, c.height);
      if (r.w < 2 || r.h < 2) return;
      if (estado.modo === 'tarja') { x.fillStyle = '#000'; forma(x, r, oval); x.fill(); return; }
      // borra numa cópia e cola só dentro do formato
      const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
      const tx = t.getContext('2d'); tx.drawImage(c, 0, 0); borrar(tx, r);
      x.save(); forma(x, r, oval); x.clip(); x.drawImage(t, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h); x.restore();
    });
    return c;
  }

  // ---------- Editor ----------
  async function editar(blob, anterior) {
    estilo();
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url;
    try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); throw new Error('Não consegui abrir esta foto.'); }

    const estado = anterior ? JSON.parse(JSON.stringify(anterior)) : { rot: 0, rects: [], modo: 'borrar', forma: 'oval', procurou: false };
    if (!estado.forma) estado.forma = 'oval';
    let sel = -1;   // borrão escolhido
    let base = girarCanvas(img, estado.rot);

    const fundo = document.createElement('div'); fundo.className = 'ef-fundo';
    fundo.innerHTML = `<div class="ef-caixa" role="dialog" aria-label="Esconder rostos">
      <div class="ef-topo"><b>Esconder rostos</b><button type="button" class="ef-x" aria-label="Fechar">×</button></div>
      <div class="ef-proibido"><b>🚫 PROIBIDO ROSTO À MOSTRA</b>Nem olho, nem nariz, nem boca, de frente ou de lado, nem parcialmente. Fotos com rosto são apagadas pela administração.</div>
      <div class="ef-palco"><canvas></canvas></div>
      <div class="ef-status"></div>
      <div class="ef-tam">
        <span>Tamanho</span><input type="range" min="40" max="150" step="5" value="100" aria-label="Tamanho do borrão"><b>100%</b>
        <button type="button" class="ef-tirar">🗑 Tirar</button>
      </div>
      <div class="ef-ferr">
        <button type="button" data-m="borrar">Borrado</button>
        <button type="button" data-m="tarja">Tarja preta</button>
        <button type="button" data-f="oval">◯ Oval</button>
        <button type="button" data-f="quadrado">▢ Quadrado</button>
        <button type="button" class="ef-girar">↻ Girar</button>
        <button type="button" class="ef-desfazer">↶ Desfazer</button>
        <button type="button" class="ef-achar">🔎 Achar rostos</button>
      </div>
      <div class="ef-dica">Arraste o dedo sobre um rosto para escondê-lo. Para ajustar: <b>arraste o borrão</b> para mover e <b>puxe a bolinha dourada ⤡</b> do canto para aumentar ou diminuir. Também dá para usar o controle de Tamanho ou tocar em Tirar.</div>
      <label class="ef-conf"><input type="checkbox"><span>Conferi a foto e <b>nenhum rosto aparece</b> (nem parte dele).</span></label>
      <div class="ef-erro"></div>
      <div class="ef-botoes"><button type="button" class="cancelar">Cancelar</button><button type="button" class="usar">Usar esta foto</button></div>
    </div>`;
    document.body.appendChild(fundo);
    const rolagem = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const q = (s) => fundo.querySelector(s);
    const tela = q('canvas'), ctx = tela.getContext('2d');
    const status = (t, cls) => { q('.ef-status').textContent = t; q('.ef-status').className = 'ef-status ' + (cls || ''); };

    let temp = null;
    function desenhar() {
      const pronta = aplicar(base, estado);
      tela.width = pronta.width; tela.height = pronta.height;
      ctx.drawImage(pronta, 0, 0);
      const esp = Math.max(2, Math.round(Math.max(tela.width, tela.height) / 300));
      ctx.lineWidth = esp; ctx.setLineDash([esp * 4, esp * 3]);
      const oval = estado.forma !== 'quadrado';
      estado.rects.forEach((r, i) => {
        ctx.strokeStyle = i === sel ? '#ffffff' : (r.auto ? '#51b36a' : '#f1d999');
        ctx.lineWidth = i === sel ? esp * 2 : esp;
        forma(ctx, efetivo(r), oval); ctx.stroke();
      });
      ctx.lineWidth = esp;
      if (temp) { ctx.strokeStyle = '#fff'; forma(ctx, temp, oval); ctx.stroke(); }
      ctx.setLineDash([]);
      // alça para aumentar/diminuir o borrão escolhido
      if (sel >= 0 && estado.rects[sel]) {
        const r = efetivo(estado.rects[sel]), k = tela.width / (tela.getBoundingClientRect().width || tela.width);
        const rr = Math.max(9 * k, esp * 4);
        ctx.beginPath(); ctx.arc(r.x + r.w, r.y + r.h, rr, 0, Math.PI * 2);
        ctx.fillStyle = '#f1d999'; ctx.fill(); ctx.lineWidth = esp; ctx.strokeStyle = '#1a1408'; ctx.stroke();
        ctx.fillStyle = '#1a1408'; ctx.font = 'bold ' + Math.round(rr * 1.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⤡', r.x + r.w, r.y + r.h + rr * 0.05);
      }
      fundo.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('sel', b.dataset.m === estado.modo));
      fundo.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('sel', b.dataset.f === estado.forma));
      // controle de tamanho: do escolhido, ou de todos
      const alvo = sel >= 0 ? estado.rects[sel] : estado.rects[0];
      const v = Math.round(((alvo && alvo.s) || 1) * 100);
      q('.ef-tam input').value = v; q('.ef-tam b').textContent = v + '%';
      q('.ef-tam input').disabled = !estado.rects.length; q('.ef-tirar').disabled = sel < 0;
    }

    // Gestos: arrastar fora de um borrão = cria um novo · arrastar DENTRO = move · arrastar a bolinha do canto = aumenta/diminui
    const ponto = (e) => { const b = tela.getBoundingClientRect(); return { x: (e.clientX - b.left) * tela.width / b.width, y: (e.clientY - b.top) * tela.height / b.height, k: tela.width / b.width }; };
    const alcaRaio = (k) => 26 * k;
    function achar(p) {
      for (let i = estado.rects.length - 1; i >= 0; i--) {
        const r = efetivo(estado.rects[i]);
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
      }
      return -1;
    }
    let ini = null, modoGesto = null, orig = null, pedido = 0;
    const redesenhar = () => { if (pedido) return; pedido = requestAnimationFrame(() => { pedido = 0; desenhar(); }); };
    tela.addEventListener('pointerdown', (e) => {
      e.preventDefault(); tela.setPointerCapture(e.pointerId); ini = ponto(e); temp = null;
      // alça de tamanho do borrão escolhido
      if (sel >= 0) {
        const r = efetivo(estado.rects[sel]);
        if (Math.hypot(ini.x - (r.x + r.w), ini.y - (r.y + r.h)) <= alcaRaio(ini.k)) { modoGesto = 'tamanho'; orig = Object.assign({}, estado.rects[sel], { ef: r }); return; }
      }
      const i = achar(ini);
      if (i >= 0) { sel = i; modoGesto = 'mover'; orig = Object.assign({}, estado.rects[i]); desenhar(); return; }
      modoGesto = 'novo';
    });
    tela.addEventListener('pointermove', (e) => {
      if (!ini) return; const p = ponto(e);
      if (modoGesto === 'mover') {
        const r = estado.rects[sel]; r.x = orig.x + (p.x - ini.x); r.y = orig.y + (p.y - ini.y);
      } else if (modoGesto === 'tamanho') {
        const r = estado.rects[sel], ef = orig.ef, min = 30 * ini.k;
        // mantém o canto de cima/esquerda e leva o de baixo/direita até o dedo
        const w = Math.max(min, p.x - ef.x), h = Math.max(min, p.y - ef.y);
        r.s = 1; r.x = ef.x; r.y = ef.y; r.w = w; r.h = h;
      } else {
        temp = { x: Math.min(ini.x, p.x), y: Math.min(ini.y, p.y), w: Math.abs(p.x - ini.x), h: Math.abs(p.y - ini.y) };
      }
      redesenhar();
    });
    const soltar = (e) => {
      if (!ini) return; const p = ponto(e), k = ini.k;
      const w = Math.abs(p.x - ini.x), h = Math.abs(p.y - ini.y);
      const toque = w < 10 * k && h < 10 * k;
      if (modoGesto === 'novo') {
        if (toque) sel = -1;                       // tocou fora: desmarca
        else {
          const min = 30 * k;
          estado.rects.push({ x: Math.min(ini.x, p.x), y: Math.min(ini.y, p.y), w: Math.max(w, min), h: Math.max(h, min), auto: false, s: 1 });
          sel = estado.rects.length - 1;
        }
      }
      if (!toque) q('.ef-conf input').checked = false;
      ini = null; temp = null; modoGesto = null; desenhar();
    };
    tela.addEventListener('pointerup', soltar);
    tela.addEventListener('pointercancel', () => { ini = null; temp = null; desenhar(); });

    fundo.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { estado.modo = b.dataset.m; desenhar(); }));
    fundo.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { estado.forma = b.dataset.f; desenhar(); }));
    q('.ef-desfazer').addEventListener('click', () => { estado.rects.pop(); sel = -1; desenhar(); });
    q('.ef-tirar').addEventListener('click', () => { if (sel >= 0) { estado.rects.splice(sel, 1); sel = -1; q('.ef-conf input').checked = false; desenhar(); } });
    q('.ef-tam input').addEventListener('input', (e) => {
      const s = e.target.value / 100;
      if (sel >= 0) estado.rects[sel].s = s; else estado.rects.forEach(r => { r.s = s; });
      q('.ef-conf input').checked = false; desenhar();
    });
    q('.ef-girar').addEventListener('click', () => {
      const H = base.height;   // gira os quadrados junto (90° no sentido do relógio)
      estado.rects = estado.rects.map(r => ({ x: H - r.y - r.h, y: r.x, w: r.h, h: r.w, auto: r.auto, s: r.s }));
      estado.rot = (estado.rot + 1) % 4; base = girarCanvas(img, estado.rot); desenhar();
    });

    async function procurar(manual) {
      status('🔎 Procurando rostos na foto…');
      try {
        const achados = await Promise.race([acharRostos(base), new Promise((_, f) => setTimeout(() => f(new Error('demorou')), 25000))]);
        estado.procurou = true;
        const novos = achados.filter(a => !estado.rects.some(r => sobrepoe(r, a) > 0.5));
        estado.rects.push(...novos);
        desenhar();
        if (achados.length) status('✓ ' + achados.length + (achados.length > 1 ? ' rostos escondidos' : ' rosto escondido') + ' automaticamente (contorno verde). Ajuste o tamanho se quiser e confira se não ficou nada à mostra: olho, boca, rosto de lado ou no espelho.', 'ok');
        else status(manual ? 'Nenhum rosto encontrado. Se aparecer algum rosto, passe o dedo sobre ele.' : 'Não achei rosto nesta foto. Se aparecer algum rosto (mesmo de lado ou no espelho), passe o dedo sobre ele.', 'alerta');
      } catch (e) {
        status('Não consegui procurar rostos automaticamente agora. Passe o dedo sobre cada rosto para esconder.', 'alerta');
      }
    }
    q('.ef-achar').addEventListener('click', () => procurar(true));

    desenhar();
    if (!estado.procurou) procurar(false); else status('Confira os quadrados e toque em "Usar esta foto".');

    return new Promise((resolve) => {
      const fim = (r) => { document.body.style.overflow = rolagem; fundo.remove(); URL.revokeObjectURL(url); resolve(r); };
      q('.ef-x').addEventListener('click', () => fim(null));
      q('.cancelar').addEventListener('click', () => fim(null));
      q('.usar').addEventListener('click', () => {
        if (!q('.ef-conf input').checked) { q('.ef-erro').textContent = 'Confira a foto e marque que nenhum rosto aparece.'; q('.ef-conf').scrollIntoView({ block: 'center' }); return; }
        const pronta = aplicar(base, estado);
        pronta.toBlob((b) => b ? fim({ blob: b, estado }) : (q('.ef-erro').textContent = 'Não consegui salvar a foto. Tente de novo.'), 'image/jpeg', 0.88);
      });
    });
  }

  window.EDITOR_FOTO = { editar, carregarDetector };
})();
