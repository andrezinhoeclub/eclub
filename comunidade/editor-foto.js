// editor-foto.js — v1.0 — esconder rostos antes de publicar (borrar / tarja), girar, detecção automática de rosto
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
      const mx = b.width * 0.35, my = b.height * 0.45;
      const r = { x: b.x - mx, y: b.y - my * 0.9, w: b.width + 2 * mx, h: b.height + my * 1.6, auto: true };
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
  function aplicar(base, estado) {
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const x = c.getContext('2d'); x.drawImage(base, 0, 0);
    estado.rects.forEach(r0 => {
      const r = limitar(r0, c.width, c.height);
      if (estado.modo === 'tarja') { x.fillStyle = '#000'; x.fillRect(r.x, r.y, r.w, r.h); }
      else borrar(x, r);
    });
    return c;
  }

  // ---------- Editor ----------
  async function editar(blob, anterior) {
    estilo();
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url;
    try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); throw new Error('Não consegui abrir esta foto.'); }

    const estado = anterior ? JSON.parse(JSON.stringify(anterior)) : { rot: 0, rects: [], modo: 'borrar', procurou: false };
    let base = girarCanvas(img, estado.rot);

    const fundo = document.createElement('div'); fundo.className = 'ef-fundo';
    fundo.innerHTML = `<div class="ef-caixa" role="dialog" aria-label="Esconder rostos">
      <div class="ef-topo"><b>Esconder rostos</b><button type="button" class="ef-x" aria-label="Fechar">×</button></div>
      <div class="ef-proibido"><b>🚫 PROIBIDO ROSTO À MOSTRA</b>Nem olho, nem nariz, nem boca, de frente ou de lado, nem parcialmente. Fotos com rosto são apagadas pela administração.</div>
      <div class="ef-palco"><canvas></canvas></div>
      <div class="ef-status"></div>
      <div class="ef-ferr">
        <button type="button" data-m="borrar">Borrado</button>
        <button type="button" data-m="tarja">Tarja preta</button>
        <button type="button" class="ef-girar">↻ Girar</button>
        <button type="button" class="ef-desfazer">↶ Desfazer</button>
        <button type="button" class="ef-achar">🔎 Achar rostos</button>
      </div>
      <div class="ef-dica">Passe o dedo sobre cada rosto (arraste formando um quadrado) para escondê-lo. Toque num quadrado para tirar.</div>
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
      estado.rects.forEach(r => { ctx.strokeStyle = r.auto ? '#51b36a' : '#f1d999'; ctx.strokeRect(r.x, r.y, r.w, r.h); });
      if (temp) { ctx.strokeStyle = '#fff'; ctx.strokeRect(temp.x, temp.y, temp.w, temp.h); }
      ctx.setLineDash([]);
      fundo.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('sel', b.dataset.m === estado.modo));
    }

    // Arrastar para marcar / tocar para tirar
    const ponto = (e) => { const b = tela.getBoundingClientRect(); return { x: (e.clientX - b.left) * tela.width / b.width, y: (e.clientY - b.top) * tela.height / b.height, k: tela.width / b.width }; };
    let ini = null;
    tela.addEventListener('pointerdown', (e) => { e.preventDefault(); tela.setPointerCapture(e.pointerId); ini = ponto(e); temp = null; });
    tela.addEventListener('pointermove', (e) => {
      if (!ini) return; const p = ponto(e);
      temp = { x: Math.min(ini.x, p.x), y: Math.min(ini.y, p.y), w: Math.abs(p.x - ini.x), h: Math.abs(p.y - ini.y) };
      desenhar();
    });
    const soltar = (e) => {
      if (!ini) return; const p = ponto(e), k = ini.k;
      const w = Math.abs(p.x - ini.x), h = Math.abs(p.y - ini.y);
      if (w < 14 * k && h < 14 * k) {      // foi um toque: tira o quadrado tocado
        for (let i = estado.rects.length - 1; i >= 0; i--) {
          const r = estado.rects[i];
          if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { estado.rects.splice(i, 1); break; }
        }
      } else {
        const min = 30 * k;
        const r = { x: Math.min(ini.x, p.x), y: Math.min(ini.y, p.y), w: Math.max(w, min), h: Math.max(h, min), auto: false };
        estado.rects.push(r);
      }
      ini = null; temp = null; q('.ef-conf input').checked = false; desenhar();
    };
    tela.addEventListener('pointerup', soltar);
    tela.addEventListener('pointercancel', () => { ini = null; temp = null; desenhar(); });

    fundo.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { estado.modo = b.dataset.m; desenhar(); }));
    q('.ef-desfazer').addEventListener('click', () => { estado.rects.pop(); desenhar(); });
    q('.ef-girar').addEventListener('click', () => {
      const H = base.height;   // gira os quadrados junto (90° no sentido do relógio)
      estado.rects = estado.rects.map(r => ({ x: H - r.y - r.h, y: r.x, w: r.h, h: r.w, auto: r.auto }));
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
        if (achados.length) status('✓ ' + achados.length + (achados.length > 1 ? ' rostos escondidos' : ' rosto escondido') + ' automaticamente (quadrado verde). Confira se não ficou nada à mostra: olho, boca, rosto de lado ou no espelho.', 'ok');
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
