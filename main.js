/* ============================================================
   Кабинет восприятия — Атласы невидимого, т. IV
   Все стимулы рисуются кодом: Canvas 2D и SVG, без библиотек.
   ============================================================ */
'use strict';

/* ---------------- Утилиты ---------------- */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const SVGNS = 'http://www.w3.org/2000/svg';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function s(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

const store = {
  get(k, d) { try { const v = localStorage.getItem('kabinet.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('kabinet.' + k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
  del(k) { try { localStorage.removeItem('kabinet.' + k); } catch (e) { /* ничего */ } },
};

const live = msg => { const l = $('#live'); if (l) { l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); } };
const fmtPct = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1).replace('.', ',') + ' %';

/*
 * Канвас с логической системой координат: рисуем в единицах W×H,
 * а масштаб под ширину контейнера и плотность пикселей делаем тут.
 */
function stage(canvas, W, aspectFn, draw) {
  const ctx = canvas.getContext('2d');
  const st = { ctx, W, H: W * aspectFn(canvas.clientWidth || W), scale: 1, cssW: 0 };
  function fit() {
    const cssW = canvas.parentElement.clientWidth || W;
    const aspect = aspectFn(cssW);
    st.H = W * aspect;
    const cssH = Math.round(cssW * aspect);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    st.scale = (cssW * dpr) / W;
    st.cssW = cssW;
    ctx.setTransform(st.scale, 0, 0, st.scale, 0, 0);
    draw(st);
  }
  st.fit = fit;
  st.redraw = () => { ctx.setTransform(st.scale, 0, 0, st.scale, 0, 0); draw(st); };
  let last = -1;
  new ResizeObserver(() => {
    const w = canvas.parentElement.clientWidth;
    if (w !== last) { last = w; fit(); }
  }).observe(canvas.parentElement);
  fit();
  return st;
}

/* ---------------- Режим «без движения» ---------------- */

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const calmHooks = [];
let calm = reduceMQ.matches || store.get('calm', false) === true;

function setCalm(v, persist = true) {
  calm = !!v;
  document.body.classList.toggle('calm', calm);
  $$('#calmToggle, [data-calm-toggle]').forEach(b => b.setAttribute('aria-pressed', String(calm)));
  if (persist) store.set('calm', calm);
  calmHooks.forEach(fn => fn(calm));
}
$('#calmToggle').addEventListener('click', () => {
  setCalm(!calm);
  live(calm ? 'Режим без движения включён: движущиеся стимулы остановлены.' : 'Режим без движения выключен. Движущиеся стимулы запускаются только кнопкой.');
});
$$('[data-calm-toggle]').forEach(b => b.addEventListener('click', () => setCalm(!calm)));
$$('[data-calm-set]').forEach(b => b.addEventListener('click', () => { setCalm(true); live('Режим без движения включён.'); }));
reduceMQ.addEventListener?.('change', e => { if (e.matches) setCalm(true, false); });

/* ---------------- Протокол ---------------- */

const protocol = store.get('protocol', {});
const PROTO_ROWS = [
  ['adelson', '№ 1 · Доска Адельсона: какая клетка темнее', 'Почти все отвечают «A»; на самом деле клетки одинаковы'],
  ['kanizsa', '№ 3 · Треугольник Канижи', 'Почти все видят треугольник'],
  ['snakes', '№ 5 · Змеи: движение', 'Большинство видит вращение, часть людей — нет'],
  ['ml', '№ 7 · Мюллер-Лайер: ошибка подгонки', 'Обычно от +10 до +30 %'],
  ['eb', '№ 8 · Эббингауз: ошибка подгонки', 'Обычно правый круг делают меньше на 5–15 %'],
  ['amb', '№ 10–12 · Переключения за 30 с', 'Обычно 5–15'],
  ['blot', '№ 13 · Кляксы: записано ответов', 'Чаще всего видят животных, людей и лица'],
  ['gorilla', '№ 14 · Передачи и «необычное»', 'В оригинальном опыте около половины не замечают неожиданное'],
];

function renderProtocol() {
  const tb = $('#protocolBody');
  tb.textContent = '';
  for (const [key, label, norm] of PROTO_ROWS) {
    const tr = document.createElement('tr');
    const v = protocol[key];
    const td1 = document.createElement('td'); td1.textContent = label;
    const td2 = document.createElement('td');
    if (v == null || v === '') { td2.textContent = '— не проходили'; td2.className = 'empty'; } else td2.textContent = v;
    const td3 = document.createElement('td'); td3.textContent = norm;
    tr.append(td1, td2, td3);
    tb.appendChild(tr);
  }
}
function note(key, val) {
  protocol[key] = val;
  store.set('protocol', protocol);
  renderProtocol();
}
$('#protocolClear').addEventListener('click', () => {
  for (const k of Object.keys(protocol)) delete protocol[k];
  store.del('protocol');
  $$('.choices .btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
  renderProtocol();
  live('Протокол очищен.');
});

/* кнопки-варианты ответа */
const choiceHooks = {};
$$('.choices').forEach(group => {
  const key = group.dataset.key;
  const btns = $$('.btn', group);
  btns.forEach(b => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (choiceHooks[key]) choiceHooks[key](b.dataset.val);
    });
  });
});

/* бланк испытуемого */
(function blank() {
  let no = store.get('subj', null);
  if (!no) { no = String(Math.floor(1000 + Math.random() * 9000)); store.set('subj', no); }
  $('#subjNo').textContent = no;
  $$('[data-subj-no]').forEach(e => { e.textContent = no; });
  const d = new Date();
  $('#subjDate').textContent = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  const name = $('#subjName');
  name.value = store.get('name', '');
  name.addEventListener('input', () => store.set('name', name.value));
})();

/* ---------------- Оп-арт: титул и разделители ---------------- */

(function heroArt() {
  const svg = $('#heroArt');
  const N = 14, sub = 4;
  const warp = (x, y) => {
    const r = Math.hypot(x, y);
    if (r >= 1) return [x, y];
    const k = 1 + 0.45 * (1 - r * r);
    return [x * k, y * k];
  };
  const g = s('g', {}, svg);
  s('rect', { x: -1, y: -1, width: 2, height: 2, fill: '#e2d9c3' }, g);
  const step = 2 / N;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if ((i + j) % 2) continue;
      const x0 = -1 + i * step, y0 = -1 + j * step;
      const pts = [];
      for (let k = 0; k < sub; k++) pts.push(warp(x0 + step * k / sub, y0));
      for (let k = 0; k < sub; k++) pts.push(warp(x0 + step, y0 + step * k / sub));
      for (let k = 0; k < sub; k++) pts.push(warp(x0 + step - step * k / sub, y0 + step));
      for (let k = 0; k < sub; k++) pts.push(warp(x0, y0 + step - step * k / sub));
      s('polygon', { points: pts.map(p => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(' '), fill: '#121212' }, g);
    }
  }
  s('rect', { x: -1, y: -1, width: 2, height: 2, fill: 'none', stroke: '#121212', 'stroke-width': 0.02 }, svg);
})();

(function dividers() {
  $$('.divider').forEach((d, idx) => {
    const kind = d.dataset.kind;
    const svg = s('svg', { viewBox: '0 0 1600 64', preserveAspectRatio: 'xMidYMid slice', focusable: 'false' });
    if (kind === 'waves') {
      // полосы Бриджет Райли: амплитуда нарастает к центру
      for (let i = 0; i < 9; i++) {
        let dstr = '';
        for (let x = 0; x <= 1600; x += 8) {
          const a = 9 * Math.pow(Math.sin(Math.PI * x / 1600), 2);
          const y = 4 + i * 7 + a * Math.sin(x / 38 + i * 0.55 + idx);
          dstr += (x ? 'L' : 'M') + x + ' ' + y.toFixed(2);
        }
        s('path', { d: dstr, fill: 'none', stroke: '#121212', 'stroke-width': 2.4, 'stroke-opacity': 0.75 }, svg);
      }
    } else if (kind === 'rings') {
      // мишени Вазарели, чередование фазы
      for (let cx = 32, n = 0; cx < 1600; cx += 64, n++) {
        for (let r = 30; r > 0; r -= 6) {
          const on = ((30 - r) / 6 + n) % 2 === 0;
          s('circle', { cx, cy: 32, r, fill: on ? '#121212' : '#e2d9c3', 'fill-opacity': on ? 0.8 : 1 }, svg);
        }
      }
    } else {
      // шахматная полоса со сжатием к краям
      const cols = 64;
      let x = 0;
      const ws = [];
      for (let i = 0; i < cols; i++) ws.push(0.35 + Math.pow(Math.sin(Math.PI * (i + 0.5) / cols), 2));
      const sum = ws.reduce((a, b) => a + b, 0);
      ws.forEach((w, i) => {
        const ww = w / sum * 1600;
        for (let r = 0; r < 4; r++) {
          if ((i + r) % 2) s('rect', { x: x.toFixed(2), y: r * 16, width: (ww + 0.4).toFixed(2), height: 16, fill: '#121212', 'fill-opacity': 0.8 }, svg);
        }
        x += ww;
      });
    }
    d.appendChild(svg);
  });
})();

/* ============================================================
   Глава 1. Контраст и яркость
   ============================================================ */

(function adelson() {
  const cv = $('#adelson');
  const CELL = 64, N = 5;
  const LIGHT = 196, DARK = 112, SAME = 112;       // 196 × 0,571 = 112
  const A = [0, 1], B = [2, 2];                    // (u, v) клеток
  const P0 = [3.5, 1.5];                            // основание цилиндра
  const dir = (() => { const x = -1, y = 1.1, l = Math.hypot(x, y); return [x / l, y / l]; })();
  const LEN = 2.5;
  let revealed = false;

  // тень: «капсула» от основания цилиндра, мягкий край
  function shade(u, v) {
    const wx = u - P0[0], wy = v - P0[1];
    const t = clamp(wx * dir[0] + wy * dir[1], 0, LEN);
    const px = wx - t * dir[0], py = wy - t * dir[1];
    const d = Math.hypot(px, py);
    const core = 1 - smooth(0.62, 1.35, d);
    return 1 - (1 - DARK / LIGHT) * core;
  }

  // доску рисуем попиксельно один раз
  const board = document.createElement('canvas');
  board.width = board.height = CELL * N;
  (function paintBoard() {
    const bx = board.getContext('2d');
    const img = bx.createImageData(CELL * N, CELL * N);
    const d = img.data;
    for (let y = 0; y < CELL * N; y++) {
      for (let x = 0; x < CELL * N; x++) {
        const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
        let g;
        if ((i === A[0] && j === A[1]) || (i === B[0] && j === B[1])) g = SAME;
        else {
          const base = (i + j) % 2 ? DARK : LIGHT;
          g = base * shade((x + 0.5) / CELL, (y + 0.5) / CELL);
        }
        const o = (y * CELL * N + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = Math.round(g); d[o + 3] = 255;
      }
    }
    bx.putImageData(img, 0, 0);
  })();

  const K = 52, SQ = 0.55, OX = 300, OY = 70;
  const toScreen = (u, v) => [OX + (u - v) * K, OY + (u + v) * K * SQ];
  const cellPoly = (i, j) => [toScreen(i, j), toScreen(i + 1, j), toScreen(i + 1, j + 1), toScreen(i, j + 1)];

  function drawCylinder(ctx) {
    const [bx, by] = toScreen(P0[0], P0[1]);
    const r = 0.62, rx = r * K * Math.SQRT2, ry = r * K * SQ * Math.SQRT2, h = 160;
    const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0);
    g.addColorStop(0, '#3b3b3b'); g.addColorStop(0.55, '#8d8d8d'); g.addColorStop(0.85, '#c9c9c9'); g.addColorStop(1, '#9a9a9a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(bx - rx, by - h);
    ctx.ellipse(bx, by - h, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8b8b8';
    ctx.beginPath(); ctx.ellipse(bx, by - h, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(18,18,18,.5)'; ctx.lineWidth = 1; ctx.stroke();
  }

  function label(ctx, i, j, ch, color) {
    const [x, y] = toScreen(i + 0.5, j + 0.5);
    ctx.fillStyle = color;
    ctx.font = '700 26px "PT Serif", Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y + 1);
  }

  const st = stage(cv, 600, () => 0.7, ({ ctx, W, H }) => {
    ctx.fillStyle = '#e2d9c3'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(OX, OY);
    ctx.transform(K / CELL, K * SQ / CELL, -K / CELL, K * SQ / CELL, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(board, 0, 0);
    ctx.restore();
    // кромка доски
    const edge = [toScreen(0, N), toScreen(N, N)];
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.moveTo(toScreen(0, N)[0], toScreen(0, N)[1]); ctx.lineTo(toScreen(N, N)[0], toScreen(N, N)[1]);
    ctx.lineTo(toScreen(N, N)[0], toScreen(N, N)[1] + 12); ctx.lineTo(toScreen(0, N)[0], toScreen(0, N)[1] + 12); ctx.fill();
    ctx.fillStyle = '#7a7a7a';
    ctx.beginPath();
    ctx.moveTo(toScreen(N, 0)[0], toScreen(N, 0)[1]); ctx.lineTo(edge[1][0], edge[1][1]);
    ctx.lineTo(edge[1][0], edge[1][1] + 12); ctx.lineTo(toScreen(N, 0)[0], toScreen(N, 0)[1] + 12); ctx.fill();
    drawCylinder(ctx);
    label(ctx, A[0], A[1], 'A', '#e2d9c3');
    label(ctx, B[0], B[1], 'B', '#121212');

    if (revealed) {
      // убираем контекст: всё закрыто бумагой, кроме A и B
      ctx.fillStyle = 'rgba(226,217,195,.97)';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      for (const [i, j] of [A, B]) {
        const p = cellPoly(i, j);
        ctx.moveTo(p[0][0], p[0][1]);
        for (let k = p.length - 1; k >= 1; k--) ctx.lineTo(p[k][0], p[k][1]);
        ctx.closePath();
      }
      ctx.fill();
      // «мостик» того же серого
      const a = toScreen(A[0] + 0.5, A[1] + 0.5), b = toScreen(B[0] + 0.5, B[1] + 0.5);
      ctx.strokeStyle = `rgb(${SAME},${SAME},${SAME})`; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      label(ctx, A[0], A[1], 'A', '#e2d9c3');
      label(ctx, B[0], B[1], 'B', '#e2d9c3');
      ctx.fillStyle = '#121212';
      ctx.font = '15px "PT Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(`A = B = rgb(${SAME}, ${SAME}, ${SAME})`, W / 2, H - 28);
    }
  });

  const btn = $('#adelsonReveal');
  btn.addEventListener('click', () => {
    revealed = !revealed;
    btn.setAttribute('aria-pressed', String(revealed));
    btn.textContent = revealed ? 'вернуть контекст' : 'проявить';
    $('#adelsonOut').textContent = revealed
      ? 'Контекст убран. Клетки A и B закрашены одним цветом: rgb(112, 112, 112).'
      : '';
    st.redraw();
  });
  choiceHooks.adelson = v => {
    note('adelson', v === 'равны' ? 'одинаковые' : v + ' темнее');
    $('#adelsonOut').textContent = v === 'A'
      ? 'Так отвечают почти все. Теперь нажмите «проявить».'
      : v === 'равны' ? 'Вы знали фокус или проверили? Нажмите «проявить», чтобы увидеть.' : 'Необычный ответ. Нажмите «проявить».';
  };
})();

(function simContrast() {
  const cv = $('#simcontrast');
  const input = $('#scCtx'), out = $('#scCtxOut');
  const st = stage(cv, 600, w => (w < 480 ? 0.55 : 0.42), ({ ctx, W, H }) => {
    const k = input.value / 100;
    ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#161616'); g.addColorStop(1, '#f2ecdd');
    ctx.globalAlpha = k; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const sq = Math.min(90, H * 0.42);
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(W * 0.25 - sq / 2, H / 2 - sq / 2, sq, sq);
    ctx.fillRect(W * 0.75 - sq / 2, H / 2 - sq / 2, sq, sq);
  });
  const upd = () => { out.textContent = input.value + '%'; st.redraw(); };
  input.addEventListener('input', upd);
  $('#scReveal').addEventListener('click', () => { input.value = input.value > 0 ? 0 : 100; upd(); });
})();

/* ============================================================
   Глава 2. Форма и достраивание
   ============================================================ */

(function kanizsa() {
  const svg = $('#kanizsa');
  const rot = $('#kzRot'), close = $('#kzClose');
  const P = [[200, 70], [85, 270], [315, 270]];
  const G = [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3];
  const R = 44;
  const D = [[85, 133], [315, 133], [200, 333]];

  const defs = s('defs', {}, svg);
  const mask = s('mask', { id: 'kzMask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 400, height: 350 }, defs);
  s('rect', { x: 0, y: 0, width: 400, height: 350, fill: '#fff' }, mask);
  s('polygon', { points: P.map(p => p.join(',')).join(' '), fill: '#000' }, mask);

  s('rect', { x: 0, y: 0, width: 400, height: 350, fill: '#e2d9c3' }, svg);
  const tri = D.map(p => p.join(',')).join(' ');
  s('polygon', { points: tri, fill: 'none', stroke: '#121212', 'stroke-width': 3.2, mask: 'url(#kzMask)', 'stroke-linejoin': 'miter' }, svg);
  const hidden = s('polygon', { points: tri, fill: 'none', stroke: '#121212', 'stroke-width': 3.2, 'stroke-opacity': 0 }, svg);
  const pac = P.map(() => s('path', { fill: '#121212' }, svg));
  const rings = P.map(p => s('circle', { cx: p[0], cy: p[1], r: R, fill: 'none', stroke: '#121212', 'stroke-width': 3, 'stroke-opacity': 0 }, svg));

  function draw() {
    const th = rot.value * Math.PI / 180;
    const k = close.value / 100;
    P.forEach((p, i) => {
      const phi = Math.atan2(G[1] - p[1], G[0] - p[0]) + th;
      const a0 = phi + Math.PI / 6, a1 = phi - Math.PI / 6;
      const x0 = p[0] + R * Math.cos(a0), y0 = p[1] + R * Math.sin(a0);
      const x1 = p[0] + R * Math.cos(a1), y1 = p[1] + R * Math.sin(a1);
      pac[i].setAttribute('d', `M${p[0]} ${p[1]}L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`);
      rings[i].setAttribute('stroke-opacity', k.toFixed(2));
    });
    hidden.setAttribute('stroke-opacity', k.toFixed(2));
    $('#kzRotOut').textContent = rot.value + '°';
    $('#kzCloseOut').textContent = close.value + '%';
  }
  rot.addEventListener('input', draw);
  close.addEventListener('input', draw);
  draw();
  choiceHooks.kanizsa = v => note('kanizsa', v === 'да' ? 'видел(а) треугольник' : 'не видел(а)');
})();

(function gestalt() {
  const svg = $('#gestalt');
  const prox = $('#gsProx'), sim = $('#gsSim');
  s('rect', { x: 0, y: 0, width: 400, height: 260, fill: '#e2d9c3' }, svg);
  const COLS = 6, ROWS = 5, BASE = 42;
  const dots = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) dots.push({ r, c, el: s('circle', { r: 8, 'stroke-width': 2.5, stroke: '#121212' }, svg) });
  function draw() {
    const k = prox.value / 100 * 0.45;
    const sx = BASE * (1 + k), sy = BASE * (1 - k) * 0.95;
    const w = sx * (COLS - 1), h = sy * (ROWS - 1);
    dots.forEach(d => {
      d.el.setAttribute('cx', (200 - w / 2 + d.c * sx).toFixed(2));
      d.el.setAttribute('cy', (130 - h / 2 + d.r * sy).toFixed(2));
      const filled = !sim.checked || d.c % 2 === 0;
      d.el.setAttribute('fill', filled ? '#121212' : '#e2d9c3');
    });
    $('#gsProxOut').textContent = prox.value;
    let msg;
    if (sim.checked && k < -0.08) msg = 'Близость тянет в строки, сходство — в столбцы. Какое правило побеждает у вас?';
    else if (sim.checked || k > 0.08) msg = 'Скорее всего, вы видите столбцы.';
    else if (k < -0.08) msg = 'Скорее всего, вы видите строки.';
    else msg = 'Равные промежутки: решётка без группировки.';
    $('#gsOut').textContent = msg;
  }
  prox.addEventListener('input', draw);
  sim.addEventListener('change', draw);
  draw();
})();

/* ============================================================
   Глава 3. Движение, которого нет
   ============================================================ */

(function snakes() {
  const cv = $('#snakes'), view = $('#snakesView');
  let shown = false;
  view.classList.add('is-gated');

  const aspect = w => (w < 560 ? 1 : 2 / 3);
  const st = stage(cv, 600, aspect, ({ ctx, W, H }) => {
    ctx.fillStyle = '#e2d9c3'; ctx.fillRect(0, 0, W, H);
    if (!shown) return;
    const cols = H / W > 0.8 ? 2 : 3, rows = 2;
    const cell = W / cols;
    // «успокоенный» вариант: симметричный порядок яркостей → дрейфа нет
    const seq = calm
      ? [['#121212', 0.34], ['#8a857c', 0.16], ['#f7f3ea', 0.34], ['#8a857c', 0.16]]
      : [['#121212', 0.34], ['#c63a1c', 0.16], ['#f7f3ea', 0.34], ['#b3a88e', 0.16]];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = cell * (col + 0.5), cy = cell * (row + 0.5);
        const Rr = cell * 0.47;
        const dirn = (row + col) % 2 ? 1 : -1;
        const nR = 5;
        for (let i = 0; i < nR; i++) {
          const ri = Rr * (0.12 + 0.88 * i / nR), ro = Rr * (0.12 + 0.88 * (i + 1) / nR);
          const rm = (ri + ro) / 2;
          let m = Math.max(6, Math.round(TAU * rm / ((ro - ri) * 2.9)));
          const a = TAU / m;
          const off = (i % 2) * a / 2 + row * 0.3;
          for (let u = 0; u < m; u++) {
            let a0 = off + u * a;
            const order = dirn > 0 ? seq : seq.slice().reverse();
            for (const [col2, frac] of order) {
              const a1 = a0 + frac * a;
              ctx.fillStyle = col2;
              ctx.beginPath();
              ctx.arc(cx, cy, ro, a0, a1 + 0.003);
              ctx.arc(cx, cy, ri, a1 + 0.003, a0, true);
              ctx.closePath();
              ctx.fill();
              a0 = a1;
            }
          }
        }
        ctx.fillStyle = '#e2d9c3';
        ctx.beginPath(); ctx.arc(cx, cy, Rr * 0.12, 0, TAU); ctx.fill();
        ctx.fillStyle = '#121212';
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
      }
    }
  });

  function msg() {
    $('#snakesOut').textContent = !shown ? '' : calm
      ? 'Режим «успокоить»: порядок яркостей симметричен (чёрный → серый → белый → серый). Картинка та же по форме, но дрейфа нет.'
      : 'Смотрите в центр одного диска 5–10 секунд, потом переведите взгляд. Если станет неприятно — «успокоить».';
  }
  $('#snakesShow').addEventListener('click', () => {
    shown = true;
    view.classList.remove('is-gated');
    st.redraw(); msg();
  });
  calmHooks.push(() => { st.redraw(); msg(); });
  choiceHooks.snakes = v => note('snakes', v + (calm ? ' (в спокойном режиме)' : ''));
})();

(function moire() {
  const cv = $('#moire');
  const shiftIn = $('#moShift'), play = $('#moPlay');
  let running = false, raf = 0, t0 = 0, visible = true;
  let phase = 0;

  const st = stage(cv, 600, w => (w < 480 ? 0.8 : 0.5), ({ ctx, W, H }) => {
    ctx.fillStyle = '#e2d9c3'; ctx.fillRect(0, 0, W, H);
    const base = +shiftIn.value;
    const d = base + (running ? 14 * Math.sin(phase) : 0);
    const cx = W / 2, cy = H / 2, gap = 7, maxR = Math.hypot(W, H) * 0.62;
    ctx.strokeStyle = '#121212'; ctx.lineWidth = 2.6;
    for (const ox of [-d / 2, d / 2]) {
      ctx.beginPath();
      for (let r = gap; r < maxR; r += gap) {
        ctx.moveTo(cx + ox + r, cy);
        ctx.arc(cx + ox, cy, r, 0, TAU);
      }
      ctx.stroke();
    }
  });

  function loop(ts) {
    if (!t0) t0 = ts;
    phase = ((ts - t0) / 1000) * TAU / 9;          // медленно: период 9 с
    st.redraw();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false; cancelAnimationFrame(raf); raf = 0; t0 = 0;
    play.setAttribute('aria-pressed', 'false');
    play.textContent = 'запустить движение';
    st.redraw();
  }
  function start() {
    if (calm) return;
    running = true;
    play.setAttribute('aria-pressed', 'true');
    play.textContent = 'остановить';
    if (visible) raf = requestAnimationFrame(loop);
  }
  function sync() {
    play.disabled = calm;
    $('#moOut').textContent = calm ? 'Режим без движения: муар показан статично. Двигайте ползунок сами — полосы бегут намного быстрее, чем сама сетка.' : '';
    if (calm && running) stop();
  }
  play.addEventListener('click', () => (running ? stop() : start()));
  shiftIn.addEventListener('input', () => { $('#moShiftOut').textContent = shiftIn.value; st.redraw(); });
  new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (!running) return;
    if (!visible) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) raf = requestAnimationFrame(loop);
  }).observe(cv);
  calmHooks.push(sync);
  sync();
})();

/* ============================================================
   Глава 4. Длина и размер
   ============================================================ */

(function mullerLyer() {
  const svg = $('#ml');
  const len = $('#mlLen'), out = $('#mlOut');
  const REF = 200, FIN = 26, FY = 17;
  let jitter = 0, done = false;
  s('rect', { x: 0, y: 0, width: 400, height: 220, fill: '#e2d9c3' }, svg);
  const ref = s('path', { fill: 'none', stroke: '#121212', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, svg);
  const adj = s('path', { fill: 'none', stroke: '#121212', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, svg);
  const cmp = s('g', { visibility: 'hidden' }, svg);
  const cmpRef = s('line', { stroke: '#121212', 'stroke-width': 3, 'stroke-dasharray': '6 5' }, cmp);
  const cmpTxt = s('text', { 'font-family': 'PT Mono, monospace', 'font-size': 13, fill: '#121212', 'text-anchor': 'middle' }, cmp);

  function draw() {
    const x0 = 100, y0 = 62;
    ref.setAttribute('d', `M${x0} ${y0}H${x0 + REF}M${x0} ${y0}l${-FIN} ${-FY}M${x0} ${y0}l${-FIN} ${FY}M${x0 + REF} ${y0}l${FIN} ${-FY}M${x0 + REF} ${y0}l${FIN} ${FY}`);
    const L = +len.value, cx = 200 + jitter, y1 = 150;
    const a = cx - L / 2, b = cx + L / 2;
    adj.setAttribute('d', `M${a} ${y1}H${b}M${a} ${y1}l${FIN} ${-FY}M${a} ${y1}l${FIN} ${FY}M${b} ${y1}l${-FIN} ${-FY}M${b} ${y1}l${-FIN} ${FY}`);
    if (done) {
      cmpRef.setAttribute('x1', a); cmpRef.setAttribute('x2', a + REF);
      cmpRef.setAttribute('y1', y1 + 30); cmpRef.setAttribute('y2', y1 + 30);
      cmpTxt.setAttribute('x', 200); cmpTxt.setAttribute('y', y1 + 58);
      cmpTxt.textContent = 'пунктир — настоящая длина верхнего отрезка';
    }
    cmp.setAttribute('visibility', done ? 'visible' : 'hidden');
    $('#mlLenOut').textContent = L + ' у.е.';
  }
  function reset() {
    done = false;
    const r = Math.random();
    const L = r < 0.5 ? 125 + Math.round(Math.random() * 40) : 240 + Math.round(Math.random() * 60);
    len.value = L;
    jitter = Math.round((Math.random() - 0.5) * 50);
    out.textContent = '';
    draw();
  }
  len.addEventListener('input', () => { if (done) { done = false; out.textContent = ''; } draw(); });
  $('#mlCheck').addEventListener('click', () => {
    done = true;
    const err = (len.value - REF) / REF * 100;
    out.innerHTML = '';
    out.append('Ваша ошибка: ');
    const b = document.createElement('b'); b.textContent = fmtPct(err); out.append(b);
    out.append(Math.abs(err) < 3
      ? '\nПочти идеально. Возможно, вы сравнивали концы отрезков, а не «общее впечатление».'
      : err > 0 ? '\nВы сделали нижний отрезок длиннее — классическое направление иллюзии.'
        : '\nВы сделали нижний отрезок короче — это против обычного направления иллюзии.');
    note('ml', fmtPct(err));
    draw();
  });
  $('#mlAgain').addEventListener('click', reset);
  reset();
})();

(function ebbinghaus() {
  const svg = $('#eb');
  const rIn = $('#ebR'), out = $('#ebOut');
  const R0 = 20;
  let done = false;
  s('rect', { x: 0, y: 0, width: 420, height: 220, fill: '#e2d9c3' }, svg);
  const L = [105, 110], Rc = [315, 110];
  s('circle', { cx: L[0], cy: L[1], r: R0, fill: '#121212' }, svg);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    s('circle', { cx: L[0] + 66 * Math.cos(a), cy: L[1] + 66 * Math.sin(a), r: 30, fill: 'none', stroke: '#121212', 'stroke-width': 3 }, svg);
  }
  const center = s('circle', { cx: Rc[0], cy: Rc[1], fill: '#121212' }, svg);
  const smalls = [];
  for (let i = 0; i < 8; i++) smalls.push(s('circle', { r: 8, fill: 'none', stroke: '#121212', 'stroke-width': 2.5 }, svg));
  const ghost = s('circle', { cx: Rc[0], cy: Rc[1], r: R0, fill: 'none', stroke: '#121212', 'stroke-width': 1.6, 'stroke-dasharray': '4 4', visibility: 'hidden' }, svg);

  function draw() {
    const r = +rIn.value;
    center.setAttribute('r', r);
    smalls.forEach((c, i) => {
      const a = i * TAU / 8 + TAU / 16;
      c.setAttribute('cx', Rc[0] + (r + 17) * Math.cos(a));
      c.setAttribute('cy', Rc[1] + (r + 17) * Math.sin(a));
    });
    ghost.setAttribute('visibility', done ? 'visible' : 'hidden');
    $('#ebROut').textContent = 'Ø ' + (r * 2) + ' у.е.';
  }
  function reset() {
    done = false;
    rIn.value = Math.random() < 0.5 ? 11 + Math.round(Math.random() * 12) / 2 : 25 + Math.round(Math.random() * 16) / 2;
    out.textContent = '';
    draw();
  }
  rIn.addEventListener('input', () => { if (done) { done = false; out.textContent = ''; } draw(); });
  $('#ebCheck').addEventListener('click', () => {
    done = true;
    const err = (rIn.value - R0) / R0 * 100;
    out.innerHTML = '';
    out.append('Ошибка по диаметру: ');
    const b = document.createElement('b'); b.textContent = fmtPct(err); out.append(b);
    out.append(err < -2
      ? '\nВы сделали правый круг меньше: среди мелких соседей он кажется крупнее. Пунктир — настоящий размер.'
      : err > 2 ? '\nВы сделали правый круг больше — это против обычного направления иллюзии. Пунктир — настоящий размер.'
        : '\nПочти точно. Пунктир — настоящий размер.');
    note('eb', fmtPct(err));
    draw();
  });
  $('#ebAgain').addEventListener('click', reset);
  reset();
})();

(function ames() {
  const view = $('#amesView'), plan = $('#amesPlan'), pos = $('#amesPos'), wrap = $('.ames');
  const INK = '#121212';
  // вид в глазок: комната выглядит прямоугольной
  s('rect', { x: 0, y: 0, width: 400, height: 260, fill: '#d8cdb3' }, view);
  s('polygon', { points: '0,0 400,0 330,50 70,50', fill: '#cfc3a6', stroke: INK, 'stroke-width': 2 }, view);
  s('polygon', { points: '0,0 70,50 70,190 0,260', fill: '#c9bc9c', stroke: INK, 'stroke-width': 2 }, view);
  s('polygon', { points: '400,0 330,50 330,190 400,260', fill: '#c9bc9c', stroke: INK, 'stroke-width': 2 }, view);
  s('rect', { x: 70, y: 50, width: 260, height: 140, fill: '#efe8d6', stroke: INK, 'stroke-width': 2 }, view);
  // окна на задней стене — главный «обман»: нарисованы как прямоугольные
  for (const x of [108, 244]) {
    s('rect', { x, y: 70, width: 48, height: 58, fill: '#e2d9c3', stroke: INK, 'stroke-width': 2 }, view);
    s('path', { d: `M${x + 24} 70V128M${x} 99H${x + 48}`, stroke: INK, 'stroke-width': 1.5 }, view);
  }
  // пол: шахматка в перспективе
  const floor = s('g', {}, view);
  const VP = [200, 120];
  const rowsY = [190, 199, 211, 227, 260];
  const xAt = (xBack, y) => VP[0] + (xBack - VP[0]) * (y - VP[1]) / (190 - VP[1]);
  for (let r = 0; r < rowsY.length - 1; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2) continue;
      const xb0 = 70 + c * 32.5, xb1 = xb0 + 32.5;
      const y0 = rowsY[r], y1 = rowsY[r + 1];
      s('polygon', { points: [[xAt(xb0, y0), y0], [xAt(xb1, y0), y0], [xAt(xb1, y1), y1], [xAt(xb0, y1), y1]].map(p => p.map(v => v.toFixed(1)).join(',')).join(' '), fill: INK, 'fill-opacity': 0.75 }, floor);
    }
  }
  s('polygon', { points: '0,260 400,260 330,190 70,190', fill: 'none', stroke: INK, 'stroke-width': 2 }, view);
  const person = s('g', {}, view);
  const pBody = s('path', { fill: INK }, person);
  const pHead = s('circle', { fill: INK }, person);
  const vLabel = s('text', { x: 200, y: 32, 'text-anchor': 'middle', 'font-family': 'PT Mono, monospace', 'font-size': 12, fill: '#121212' }, view);
  vLabel.textContent = 'вид в глазок';

  // план сверху: на самом деле стена скошена
  s('rect', { x: 0, y: 0, width: 400, height: 260, fill: '#e2d9c3' }, plan);
  const E = [200, 238];
  const k = 105, ang = Math.PI / 6;
  const Lc = [E[0] - 2 * k * Math.sin(ang), E[1] - 2 * k * Math.cos(ang)];
  const Rc = [E[0] + 1 * k * Math.sin(ang), E[1] - 1 * k * Math.cos(ang)];
  const fy = 222;
  s('polygon', { points: [Lc, Rc, [352, fy], [48, fy]].map(p => p.map(v => v.toFixed(1)).join(',')).join(' '), fill: '#efe8d6', stroke: INK, 'stroke-width': 2 }, plan);
  s('line', { x1: Lc[0], y1: Lc[1], x2: Rc[0], y2: Rc[1], stroke: INK, 'stroke-width': 5 }, plan);
  // кажущаяся стена: на одной «глубине»
  const yA = 128;
  const onRay = (P, y) => [E[0] + (P[0] - E[0]) * (E[1] - y) / (E[1] - P[1]), y];
  const la = onRay(Lc, yA), ra = onRay(Rc, yA);
  s('line', { x1: E[0], y1: E[1], x2: Lc[0], y2: Lc[1], stroke: INK, 'stroke-width': 1, 'stroke-dasharray': '3 4' }, plan);
  s('line', { x1: E[0], y1: E[1], x2: Rc[0], y2: Rc[1], stroke: INK, 'stroke-width': 1, 'stroke-dasharray': '3 4' }, plan);
  s('line', { x1: la[0], y1: yA, x2: ra[0], y2: yA, stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '8 5' }, plan);
  const t = (x, y, str, anchor = 'start') => { const n = s('text', { x, y, 'font-family': 'PT Mono, monospace', 'font-size': 11.5, fill: INK, 'text-anchor': anchor }, plan); n.textContent = str; return n; };
  t(Lc[0] - 4, Lc[1] - 8, 'дальний угол ×2', 'start');
  t(Rc[0] + 8, Rc[1] - 6, 'ближний ×1');
  t(la[0] - 8, yA + 4, 'кажущаяся стена', 'end');
  t(200, 256, 'глазок', 'middle');
  s('circle', { cx: E[0], cy: E[1], r: 5, fill: INK }, plan);
  const ray = s('line', { stroke: INK, 'stroke-width': 1.5 }, plan);
  const dot = s('circle', { r: 7, fill: INK }, plan);
  t(16, 20, 'план сверху');

  function draw() {
    const p = pos.value / 100;
    const d = 2 - p;                 // во сколько раз дальше ближнего угла
    const sc = 1 / d;                // угловой размер
    const x = lerp(104, 296, p), feet = 196;
    const h = 136 * sc, w = h * 0.26;
    pBody.setAttribute('d', `M${x - w / 2} ${feet}L${x - w * 0.42} ${feet - h * 0.78}Q${x} ${feet - h * 0.86} ${x + w * 0.42} ${feet - h * 0.78}L${x + w / 2} ${feet}Z`);
    pHead.setAttribute('cx', x); pHead.setAttribute('cy', feet - h * 0.9); pHead.setAttribute('r', h * 0.1);
    const P = [lerp(Lc[0], Rc[0], p), lerp(Lc[1], Rc[1], p)];
    dot.setAttribute('cx', P[0]); dot.setAttribute('cy', P[1]);
    ray.setAttribute('x1', E[0]); ray.setAttribute('y1', E[1]); ray.setAttribute('x2', P[0]); ray.setAttribute('y2', P[1]);
    $('#amesOut').textContent = p < 0.05 ? 'левый угол' : p > 0.95 ? 'правый угол' : `дальше в ${d.toFixed(2).replace('.', ',')} раза`;
  }
  pos.addEventListener('input', draw);
  const cb = $('#amesShowPlan');
  const syncPlan = () => wrap.classList.toggle('plan-on', cb.checked);
  cb.addEventListener('change', syncPlan);
  syncPlan();
  draw();
})();

/* ============================================================
   Глава 5. Двойственные фигуры
   ============================================================ */

(function ambiguous() {
  const svg = $('#amb');
  const FIGS = {
    necker: { no: 'Стимул № 10', name: 'Куб Неккера', label: 'Каркасный куб: любая из двух квадратных граней может казаться передней.' },
    duck: { no: 'Стимул № 11', name: 'Утка-кролик', label: 'Голова с двумя вытянутыми выростами: утка с клювом влево или кролик с ушами влево.' },
    vase: { no: 'Стимул № 12', name: 'Ваза Рубина', label: 'Чёрная ваза или два светлых профиля, смотрящих друг на друга.' },
  };
  const counts = store.get('amb', {});
  let fig = 'necker', hint = 0;
  let running = false, tEnd = 0, timer = 0, count = 0;

  function vaseProfile() {
    const pts = [[0, .72], [.07, .66], [.18, .45], [.28, .42], [.34, .37], [.42, .17], [.47, .25], [.52, .31], [.56, .2], [.6, .28], [.64, .19], [.7, .23], [.77, .3], [.84, .37], [.91, .52], [1, .62]];
    // Катмулл-Ром по y
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let tt = 0; tt < 1; tt += 0.125) {
        const t2 = tt * tt, t3 = t2 * tt;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * tt + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function draw() {
    svg.textContent = '';
    const INK = '#121212', PAPER = '#e2d9c3';
    s('rect', { x: 0, y: 0, width: 400, height: 300, fill: PAPER }, svg);
    const txt = (x, y, str) => { const n = s('text', { x, y, 'font-family': 'PT Mono, monospace', 'font-size': 14, fill: INK, 'text-anchor': 'middle' }, svg); n.textContent = str; };
    if (fig === 'necker') {
      const F = [[110, 100], [250, 100], [250, 240], [110, 240]];
      const Bk = F.map(([x, y]) => [x + 62, y - 58]);
      if (hint === 1) s('polygon', { points: F.map(p => p.join(',')).join(' '), fill: INK, 'fill-opacity': 0.16 }, svg);
      if (hint === 2) s('polygon', { points: Bk.map(p => p.join(',')).join(' '), fill: INK, 'fill-opacity': 0.16 }, svg);
      const g = s('g', { fill: 'none', stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      s('polygon', { points: F.map(p => p.join(',')).join(' ') }, g);
      s('polygon', { points: Bk.map(p => p.join(',')).join(' ') }, g);
      F.forEach((p, i) => s('line', { x1: p[0], y1: p[1], x2: Bk[i][0], y2: Bk[i][1] }, g));
      if (hint) txt(200, 285, hint === 1 ? 'затенённая грань — передняя?' : 'а теперь — эта?');
    } else if (fig === 'duck') {
      const g = s('g', { fill: '#efe8d6', stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      s('path', { d: 'M172 112 C122 90 62 96 36 116 C66 130 122 134 164 140 C160 146 159 150 160 154 C120 150 72 150 46 164 C78 180 132 186 168 178 C188 216 262 232 298 204 C318 188 318 164 310 152 L298 147 L311 139 C318 110 288 88 242 90 C208 92 186 100 172 112 Z' }, g);
      s('circle', { cx: 206, cy: 124, r: 8, fill: INK, stroke: 'none' }, svg);
      if (hint === 1) { txt(96, 84, 'клюв'); txt(352, 150, '← затылок'); }
      if (hint === 2) { txt(96, 84, 'уши'); txt(340, 150, '← рот'); }
    } else {
      const prof = vaseProfile();
      const Y0 = 22, Y1 = 278, CX = 200, SC = 150;
      const inv = hint === 1;
      s('rect', { x: 20, y: Y0, width: 360, height: Y1 - Y0, fill: inv ? INK : PAPER }, svg);
      const left = prof.map(([y, w]) => [CX - w * SC, Y0 + y * (Y1 - Y0)]);
      const right = prof.slice().reverse().map(([y, w]) => [CX + w * SC, Y0 + y * (Y1 - Y0)]);
      s('polygon', { points: left.concat(right).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), fill: inv ? PAPER : INK }, svg);
      s('rect', { x: 20, y: Y0, width: 360, height: Y1 - Y0, fill: 'none', stroke: INK, 'stroke-width': 2 }, svg);
    }
    svg.setAttribute('aria-label', FIGS[fig].label);
    $('#ambNo').textContent = FIGS[fig].no;
    $('#ambName').textContent = FIGS[fig].name;
  }

  function summary() {
    const names = { necker: 'куб', duck: 'утка-кролик', vase: 'ваза' };
    return Object.keys(names).filter(k => counts[k] != null).map(k => `${names[k]}: ${counts[k]}`).join('; ');
  }

  function stop(finished) {
    running = false;
    clearInterval(timer);
    $('#ambFlip').disabled = true;
    $('#ambStart').textContent = 'старт';
    if (finished) {
      counts[fig] = count;
      store.set('amb', counts);
      note('amb', summary());
      const mean = (30 / (count + 1)).toFixed(1).replace('.', ',');
      $('#ambOut').textContent = `Переключений за 30 с: ${count}. Одно прочтение держалось в среднем ≈ ${mean} с.\n` +
        (count === 0 ? 'Вы удержали одну картинку всё время — так бывает, особенно если фигура видна впервые.'
          : count > 20 ? 'Очень быстрые переключения — возможно, вы переключали взгляд намеренно.'
            : 'Типичный диапазон — 5–15 переключений.');
      $('#ambTime').textContent = '0,0';
    }
  }
  function start() {
    if (running) { stop(false); $('#ambOut').textContent = 'Отсчёт прерван.'; return; }
    running = true; count = 0;
    $('#ambCount').textContent = '0';
    $('#ambOut').textContent = '';
    $('#ambFlip').disabled = false;
    $('#ambFlip').focus();
    $('#ambStart').textContent = 'прервать';
    tEnd = performance.now() + 30000;
    timer = setInterval(() => {
      const left = Math.max(0, tEnd - performance.now());
      $('#ambTime').textContent = (left / 1000).toFixed(1).replace('.', ',');
      if (left <= 0) stop(true);
    }, 100);
  }
  function flip() {
    if (!running) return;
    count++;
    $('#ambCount').textContent = String(count);
  }
  $('#ambStart').addEventListener('click', start);
  $('#ambFlip').addEventListener('click', flip);
  document.addEventListener('keydown', e => {
    if (!running || e.code !== 'Space') return;
    if (e.target.matches('input, textarea, #ambFlip')) return;
    e.preventDefault();
    flip();
  });
  $('#ambHint').addEventListener('click', () => {
    const max = fig === 'vase' ? 1 : 2;
    hint = (hint + 1) % (max + 1);
    $('#ambHint').setAttribute('aria-pressed', String(hint > 0));
    draw();
  });
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    if (running) stop(false);
    fig = tab.dataset.fig; hint = 0;
    $('#ambHint').setAttribute('aria-pressed', 'false');
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    $('#ambCount').textContent = counts[fig] != null ? String(counts[fig]) : '0';
    $('#ambTime').textContent = '30,0';
    $('#ambOut').textContent = '';
    draw();
  }));
  draw();
})();

/* ============================================================
   Глава 6. Проекция: генератор клякс
   ============================================================ */

(function blots() {
  const cv = $('#blot');
  const W = 720, H = 500, HW = W / 2;
  cv.width = W; cv.height = H;
  cv.style.aspectRatio = W + ' / ' + H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const field = new Float32Array(HW * H);
  const grain = new Float32Array(HW * H);
  const inkIn = $('#blotInk');
  let seed = 0, T = 0, anim = 0;
  const history = [];

  function hash(x, y, sd) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(sd, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, sd) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, sd), b = hash(xi + 1, yi, sd), c = hash(xi, yi + 1, sd), d = hash(xi + 1, yi + 1, sd);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, sd, oct) {
    let sum = 0, amp = 0.5, f = 1;
    for (let o = 0; o < oct; o++) { sum += amp * vnoise(x * f, y * f, sd + o * 31); amp *= 0.5; f *= 2.03; }
    return sum;
  }

  function build(sd) {
    const rnd = mulberry32(sd * 9973 + 17);
    const sc = 0.0105 + rnd() * 0.005;
    const ox = rnd() * 1000, oy = rnd() * 1000;
    const tall = 0.8 + rnd() * 0.25, wide = 0.82 + rnd() * 0.2;
    const spots = [];
    for (let i = 0; i < 5 + Math.floor(rnd() * 8); i++) {
      spots.push([rnd() * 0.95, (rnd() - 0.5) * 1.7, 0.01 + rnd() * 0.05, 0.25 + rnd() * 0.35]);
    }
    for (let y = 0; y < H; y++) {
      const yn = (y - H / 2) / (H / 2);
      for (let x = 0; x < HW; x++) {
        const xn = (HW - x) / HW;
        const wx = fbm(x * sc * 0.6 + 50, y * sc * 0.6, sd + 7, 3) - 0.5;
        const wy = fbm(x * sc * 0.6, y * sc * 0.6 + 80, sd + 11, 3) - 0.5;
        const n = fbm(x * sc + ox + wx * 3.2, y * sc + oy + wy * 3.2, sd, 5);
        const e = 1 - Math.hypot(xn / wide, yn / tall);
        let v = n * 1.05 + e * 0.95 + 0.14 * Math.exp(-(xn * xn) / 0.006) * (1 - yn * yn);
        for (const [sx, sy, r2, a] of spots) {
          const dx = xn - sx, dy = yn - sy;
          v += a * Math.exp(-(dx * dx + dy * dy) / r2);
        }
        field[y * HW + x] = v;
        grain[y * HW + x] = hash(x, y, sd + 5) - 0.5;
      }
    }
  }

  function threshold() {
    // порог по квантилю: «туши на листе» = доля закрашенной площади
    const cover = 0.16 + (inkIn.value / 100) * 0.3;
    const bins = 512, hist = new Uint32Array(bins);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < field.length; i += 3) { const v = field[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let i = 0; i < field.length; i += 3) hist[Math.min(bins - 1, Math.floor((field[i] - lo) / (hi - lo) * bins))]++;
    const total = Math.ceil(field.length / 3);
    let acc = 0;
    for (let b = bins - 1; b >= 0; b--) { acc += hist[b]; if (acc / total >= cover) return lo + (b / bins) * (hi - lo); }
    return lo;
  }

  function render(th) {
    const d = img.data;
    const PR = 241, PG = 235, PB = 220;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < HW; x++) {
        const i = y * HW + x;
        const dv = field[i] - th;
        let r = PR, g = PG, b = PB;
        if (dv > -0.02) {
          const a = smooth(-0.012, 0.01, dv);
          const rim = Math.exp(-Math.max(0, dv) / 0.035);        // тушь темнее по кромке
          const tone = 20 + 46 * (1 - rim) * smooth(0.02, 0.25, dv) + grain[i] * 14;
          r = lerp(PR, tone, a); g = lerp(PG, tone - 2, a); b = lerp(PB, tone - 4, a);
        }
        const o1 = (y * W + x) * 4, o2 = (y * W + (W - 1 - x)) * 4;
        d[o1] = d[o2] = r; d[o1 + 1] = d[o2 + 1] = g; d[o1 + 2] = d[o2 + 2] = b; d[o1 + 3] = d[o2 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // сгиб листа
    ctx.strokeStyle = 'rgba(18,18,18,.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(HW + 0.5, 0); ctx.lineTo(HW + 0.5, H); ctx.stroke();
  }

  function show(sd, spread) {
    cancelAnimationFrame(anim);
    seed = sd;
    $('#blotNo').textContent = '№ ' + String(sd).padStart(4, '0');
    build(sd);
    T = threshold();
    if (!spread || calm) { render(T); return; }
    // растекание туши: порог плавно опускается
    const t0 = performance.now(), dur = 1500, from = T + 0.3;
    const step = now => {
      const k = clamp((now - t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      render(lerp(from, T, e));
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function newBlot() {
    if (seed) history.push(seed);
    $('#blotBack').disabled = history.length === 0;
    show(1 + Math.floor(Math.random() * 9999), true);
    $('#blotText').value = '';
  }
  $('#blotNew').addEventListener('click', newBlot);
  $('#blotBack').addEventListener('click', () => {
    const p = history.pop();
    if (p) show(p, false);
    $('#blotBack').disabled = history.length === 0;
  });
  inkIn.addEventListener('input', () => {
    cancelAnimationFrame(anim);
    $('#blotInkOut').textContent = inkIn.value + '%';
    T = threshold(); render(T);
  });

  // ответы — только в localStorage
  const answers = store.get('blots', []);
  function renderLog() {
    const ol = $('#blotLog');
    ol.textContent = '';
    answers.slice().reverse().forEach(a => {
      const li = document.createElement('li');
      const tag = document.createElement('span'); tag.textContent = '№ ' + String(a.seed).padStart(4, '0');
      const q = document.createElement('q'); q.textContent = a.text;
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'показать';
      b.addEventListener('click', () => { if (seed !== a.seed) { history.push(seed); $('#blotBack').disabled = false; } show(a.seed, false); cv.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }); });
      li.append(tag, q, b);
      ol.appendChild(li);
    });
    note('blot', answers.length ? String(answers.length) : null);
  }
  $('#blotSave').addEventListener('click', () => {
    const text = $('#blotText').value.trim();
    if (!text) { $('#blotText').focus(); return; }
    answers.push({ seed, text, at: Date.now() });
    if (answers.length > 60) answers.shift();
    store.set('blots', answers);
    $('#blotText').value = '';
    renderLog();
    live('Ответ записан в протокол этого браузера.');
  });
  $('#blotClear').addEventListener('click', () => {
    answers.length = 0;
    store.del('blots');
    renderLog();
    live('Все ответы стёрты.');
  });
  renderLog();
  // первая карточка: без анимации, пока глава не видна
  show(1 + Math.floor(Math.random() * 9999), false);
})();

/* ============================================================
   Глава 7. Слепота невнимания
   ============================================================ */

(function gorilla() {
  const cv = $('#court');
  const DUR = 24, GOR_IN = 9.5, GOR_STOP = 12.5, GOR_GO = 15, GOR_OUT = 19;
  const DT = 1 / 60;
  let sim = null, state = 'idle', raf = 0, lastTs = 0, prelude = 0, highlight = false;

  function newSim(seed) {
    const rnd = mulberry32(seed);
    const players = [];
    for (let i = 0; i < 6; i++) {
      const team = i < 3 ? 'w' : 'b';
      const x = 110 + ((i * 97) % 420) + rnd() * 30, y = 140 + rnd() * 160;
      players.push({ team, x, y, tx: x, ty: y, retarget: rnd() * 1.5, speed: 45 + rnd() * 35, phase: rnd() * TAU });
    }
    const teams = {
      w: { idx: [0, 1, 2], holder: 0, pass: null, next: 1.0, count: 0 },
      b: { idx: [3, 4, 5], holder: 3, pass: null, next: 1.5, count: 0 },
    };
    return { t: 0, rnd, players, teams };
  }

  function hand(p) {
    const k = persp(p.y);
    return [p.x + 12 * k, p.y - 40 * k];
  }
  const persp = y => 0.8 + 0.45 * (y - 120) / 200;

  function step(S) {
    const { rnd, players, teams } = S;
    S.t += DT;
    for (const p of players) {
      p.retarget -= DT;
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (p.retarget <= 0 || d < 4) {
        p.tx = 70 + rnd() * 500; p.ty = 125 + rnd() * 190;
        p.retarget = 0.8 + rnd() * 1.6;
      }
      if (d > 1) { p.x += dx / d * p.speed * DT; p.y += dy / d * p.speed * DT; }
      p.phase += DT * 9;
    }
    for (const key of ['w', 'b']) {
      const tm = teams[key];
      if (tm.pass) {
        tm.pass.k += DT / tm.pass.dur;
        if (tm.pass.k >= 1) {
          tm.holder = tm.pass.to; tm.pass = null;
          if (key === 'w') tm.count++;
          tm.next = S.t + 0.7 + rnd() * 0.8;
        }
      } else if (S.t >= tm.next && S.t < DUR - 1.4) {
        const others = tm.idx.filter(i => i !== tm.holder);
        const to = others[Math.floor(rnd() * others.length)];
        tm.pass = { from: tm.holder, to, k: 0, dur: 0.55 + rnd() * 0.25, bounce: rnd() < 0.4 };
      }
    }
  }

  function gorillaPos(t) {
    if (t < GOR_IN || t > GOR_OUT) return null;
    let x;
    if (t < GOR_STOP) x = lerp(700, 330, (t - GOR_IN) / (GOR_STOP - GOR_IN));
    else if (t < GOR_GO) x = 330;
    else x = lerp(330, -70, (t - GOR_GO) / (GOR_OUT - GOR_GO));
    return { x, y: 232, beat: t >= GOR_STOP && t < GOR_GO, walk: t < GOR_STOP || t >= GOR_GO };
  }

  function drawPlayer(ctx, p) {
    const k = persp(p.y);
    const white = p.team === 'w';
    const fill = white ? '#f7f3ea' : '#121212';
    const sw = Math.sin(p.phase) * 6 * k;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#121212';
    // ноги
    ctx.lineWidth = 5 * k;
    ctx.beginPath();
    ctx.moveTo(p.x - 4 * k, p.y - 22 * k); ctx.lineTo(p.x - 5 * k + sw, p.y);
    ctx.moveTo(p.x + 4 * k, p.y - 22 * k); ctx.lineTo(p.x + 5 * k - sw, p.y);
    ctx.stroke();
    // корпус
    ctx.fillStyle = fill; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - 11 * k, p.y - 22 * k); ctx.lineTo(p.x - 9 * k, p.y - 50 * k);
    ctx.lineTo(p.x + 9 * k, p.y - 50 * k); ctx.lineTo(p.x + 11 * k, p.y - 22 * k); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // руки
    ctx.lineWidth = 4 * k;
    ctx.beginPath();
    ctx.moveTo(p.x - 9 * k, p.y - 47 * k); ctx.lineTo(p.x - 15 * k, p.y - 34 * k - sw * 0.3);
    ctx.moveTo(p.x + 9 * k, p.y - 47 * k); ctx.lineTo(p.x + 13 * k, p.y - 40 * k);
    ctx.stroke();
    // голова
    ctx.fillStyle = '#e8dcc0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y - 58 * k, 7.5 * k, 0, TAU); ctx.fill(); ctx.stroke();
  }

  function drawGorilla(ctx, g, t) {
    const k = persp(g.y) * 1.25;
    const x = g.x, y = g.y;
    const sw = g.walk ? Math.sin(t * 7) * 7 * k : 0;
    ctx.fillStyle = '#121212'; ctx.strokeStyle = '#121212'; ctx.lineCap = 'round';
    ctx.lineWidth = 9 * k;
    ctx.beginPath();
    ctx.moveTo(x - 7 * k, y - 26 * k); ctx.lineTo(x - 8 * k + sw, y);
    ctx.moveTo(x + 7 * k, y - 26 * k); ctx.lineTo(x + 8 * k - sw, y);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - 42 * k, 17 * k, 22 * k, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 2 * k, y - 70 * k, 10 * k, 0, TAU); ctx.fill();
    ctx.lineWidth = 7 * k;
    ctx.beginPath();
    if (g.beat) {
      const b = Math.sin(t * 16) * 4 * k;
      ctx.moveTo(x - 14 * k, y - 56 * k); ctx.lineTo(x - 22 * k, y - 46 * k); ctx.lineTo(x - 4 * k, y - 48 * k + b);
      ctx.moveTo(x + 14 * k, y - 56 * k); ctx.lineTo(x + 22 * k, y - 46 * k); ctx.lineTo(x + 4 * k, y - 48 * k - b);
    } else {
      ctx.moveTo(x - 14 * k, y - 56 * k); ctx.lineTo(x - 20 * k - sw * 0.6, y - 20 * k);
      ctx.moveTo(x + 14 * k, y - 56 * k); ctx.lineTo(x + 20 * k + sw * 0.6, y - 20 * k);
    }
    ctx.stroke();
    if (highlight) {
      ctx.save();
      ctx.setLineDash([6, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = '#121212';
      ctx.beginPath(); ctx.ellipse(x, y - 42 * k, 44 * k, 56 * k, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#121212'; ctx.font = '15px "PT Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('горилла', x, y - 110 * k);
    }
  }

  function drawBall(ctx, S, key) {
    const tm = S.teams[key];
    let bx, by;
    if (tm.pass) {
      const a = hand(S.players[tm.pass.from]), b = hand(S.players[tm.pass.to]);
      const k = tm.pass.k;
      bx = lerp(a[0], b[0], k);
      if (tm.pass.bounce) {
        const floor = Math.max(S.players[tm.pass.from].y, S.players[tm.pass.to].y) - 2;
        by = k < 0.5 ? lerp(a[1], floor, k * 2) : lerp(floor, b[1], (k - 0.5) * 2);
      } else by = lerp(a[1], b[1], k) - Math.sin(Math.PI * k) * 26;
    } else [bx, by] = hand(S.players[tm.holder]);
    ctx.fillStyle = key === 'w' ? '#9b958a' : '#6f6a62';
    ctx.strokeStyle = '#121212'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bx, by, 6.5, 0, TAU); ctx.fill(); ctx.stroke();
  }

  function drawScene(ctx, S) {
    ctx.fillStyle = '#e2d9c3'; ctx.fillRect(0, 0, 640, 360);
    // стена и пол
    ctx.fillStyle = '#d8cdb3'; ctx.fillRect(0, 0, 640, 110);
    ctx.strokeStyle = 'rgba(18,18,18,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(640, 110); ctx.stroke();
    for (let x = 40; x < 640; x += 80) { ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 100); ctx.stroke(); }
    const g = gorillaPos(S.t);
    const items = S.players.map(p => ({ y: p.y, draw: () => drawPlayer(ctx, p) }));
    if (g) items.push({ y: g.y, draw: () => drawGorilla(ctx, g, S.t) });
    items.sort((a, b) => a.y - b.y).forEach(it => it.draw());
    drawBall(ctx, S, 'b');
    drawBall(ctx, S, 'w');
  }

  function overlay(ctx, lines, big) {
    ctx.fillStyle = 'rgba(226,217,195,.88)'; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#121212'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (big) { ctx.font = '700 90px "Unbounded", sans-serif'; ctx.fillText(big, 320, 150); }
    ctx.font = '17px "PT Mono", monospace';
    lines.forEach((l, i) => ctx.fillText(l, 320, (big ? 250 : 160) + i * 28));
  }

  function storyboard(ctx) {
    ctx.fillStyle = '#e2d9c3'; ctx.fillRect(0, 0, 640, 360);
    const S = newSim(4242);
    const shots = [3, 11, 13.5, 17];
    let si = 0;
    while (si < shots.length) {
      step(S);
      if (S.t >= shots[si]) {
        const x = (si % 2) * 320, y = Math.floor(si / 2) * 180;
        ctx.save();
        ctx.beginPath(); ctx.rect(x + 4, y + 4, 312, 172); ctx.clip();
        ctx.translate(x + 4, y + 4); ctx.scale(312 / 640, 172 / 360);
        drawScene(ctx, S);
        ctx.restore();
        ctx.strokeStyle = '#121212'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, 312, 172);
        const cap = `кадр ${si + 1} · ${String(shots[si]).replace('.', ',')} с`;
        ctx.font = '13px "PT Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#121212'; ctx.fillRect(x + 4, y + 4, ctx.measureText(cap).width + 12, 22);
        ctx.fillStyle = '#e2d9c3';
        ctx.fillText(cap, x + 10, y + 15);
        si++;
      }
    }
  }

  const st = stage(cv, 640, () => 360 / 640, ({ ctx }) => {
    if (state === 'idle') {
      if (calm) { storyboard(ctx); return; }
      drawScene(ctx, newSim(4242));
      overlay(ctx, ['Считайте передачи команды в белом.', 'Нажмите «начать опыт».']);
    } else if (state === 'prelude') {
      drawScene(ctx, sim);
      overlay(ctx, ['Считайте передачи команды в белом'], String(Math.ceil(prelude)));
    } else if (state === 'run') {
      drawScene(ctx, sim);
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 356, 640 * (sim.t / DUR), 4);
    } else if (state === 'done') {
      drawScene(ctx, sim);
      overlay(ctx, ['Стоп.', 'Ответьте на вопросы под стимулом.']);
    }
  });

  function frame(ts) {
    const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
    lastTs = ts;
    if (state === 'prelude') {
      prelude -= dt;
      if (prelude <= 0) state = 'run';
    } else if (state === 'run') {
      let acc = dt;
      while (acc > 1e-6 && sim.t < DUR) { step(sim); acc -= DT; }
      if (sim.t >= DUR) { finish(); return; }
    }
    st.redraw();
    raf = requestAnimationFrame(frame);
  }

  function begin(withHint) {
    cancelAnimationFrame(raf);
    highlight = !!withHint;
    sim = newSim(4242 + (withHint ? 0 : Math.floor(Math.random() * 1000)));
    state = withHint ? 'run' : 'prelude';
    prelude = 3; lastTs = 0;
    $('#gForm').hidden = true;
    $('#gOut').textContent = '';
    $('#gReplay').hidden = true;
    $('#gStart').disabled = true;
    $('#gForce').hidden = true;
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    state = 'done';
    cancelAnimationFrame(raf);
    st.redraw();
    $('#gStart').disabled = false;
    $('#gStart').textContent = 'пройти ещё раз';
    if (highlight) { $('#gReplay').hidden = false; syncCalm(); return; }
    $('#gForm').hidden = false;
    $('#gCount').value = '';
    $$('#gForm .choices .btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
    $('#gCount').focus({ preventScroll: true });
    syncCalm();
  }

  let seen = null;
  choiceHooks.gorillaSeen = v => { seen = v; };
  $('#gSubmit').addEventListener('click', () => {
    const n = parseInt($('#gCount').value, 10);
    const real = sim.teams.w.count;
    const counted = Number.isFinite(n) ? n : null;
    const lines = [];
    lines.push(`Команда в белом сделала передач: ${real}. Ваш ответ: ${counted == null ? '—' : counted}` +
      (counted == null ? '.' : counted === real ? ' — точно.' : ` (ошибка ${counted - real > 0 ? '+' : ''}${counted - real}).`));
    lines.push('В середине ролика через площадку прошла чёрная горилла и остановилась в центре на 2,5 секунды.');
    lines.push(seen === 'да' ? 'Вы её заметили — это нормально, особенно если вы знали об опыте.'
      : seen === 'нет' ? 'Вы её не заметили — как примерно половина участников оригинального опыта.'
        : 'Если не уверены — посмотрите повтор с подсказкой.');
    $('#gOut').textContent = lines.join('\n');
    note('gorilla', `насчитано ${counted == null ? '—' : counted} из ${real}; необычное: ${seen || '—'}`);
    $('#gForm').hidden = true;
    $('#gReplay').hidden = false;
    $('#gExplain').hidden = false;
    $('#gSpoiler').hidden = true;
    syncCalm();
  });
  $('#gStart').addEventListener('click', () => begin(false));
  $('#gForce').addEventListener('click', () => begin(false));
  $('#gReplay').addEventListener('click', () => begin(true));
  $('#gSpoiler').addEventListener('click', () => { $('#gExplain').hidden = false; $('#gSpoiler').hidden = true; });

  function syncCalm() {
    const running = state === 'prelude' || state === 'run';
    if (calm && running) {
      cancelAnimationFrame(raf);
      state = 'idle';
      $('#gStart').disabled = false;
    }
    const idleCalm = calm && state === 'idle';
    $('#gStart').hidden = calm;
    $('#gForce').hidden = !calm || running;
    $('#gReplay').disabled = calm;
    if (idleCalm) {
      $('#gOut').textContent = 'Режим без движения: вместо ролика — раскадровка. В кадрах 2–3 через площадку проходит чёрная горилла. В движении, когда вы заняты подсчётом белых, её не замечает примерно половина зрителей.';
      $('#gExplain').hidden = false;
      $('#gSpoiler').hidden = true;
    } else if (!calm && state === 'idle') {
      $('#gOut').textContent = '';
    }
    st.redraw();
  }
  calmHooks.push(syncCalm);
  syncCalm();
})();

/* ---------------- Старт ---------------- */

setCalm(calm, false);
renderProtocol();
if (reduceMQ.matches) live('В системе включено уменьшение движения: движущиеся стимулы заменены статичными.');
