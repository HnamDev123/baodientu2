(() => {
'use strict';
const { $, reduce, wait, rnd } = window.BM;
const sec = $('#keo'), ov = $('#finale');
if (!sec || !ov) return;

const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const TAU = Math.PI * 2;
const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const wrapPI = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;       // đưa góc về (−π, π]

/* ====== CHỈNH NHANH: nhịp độ & âm lượng ====== */
const CFG = {
  volume: .85,            // âm lượng nhạc (0–1)
  musicFadeIn: 5000,      // ms nhạc to dần
  blackWait: 1500,        // ms chờ màn đen "đặc" trước khi hiện chữ đầu tiên
  swirlMs: 5800,          // thời gian lá/cánh hoa cuộn vào
  budHold: 900,           // ms nụ hoa giữ nguyên trước khi nở
  wordStep: 95,           // ms giữa hai từ khi chữ hiện ra
  wishHoldBase: 2800,     // ms một lời chúc nằm yên (cộng thêm theo độ dài)
  wishHoldPerChar: 18,
  photoGap: 2300          // ms giữa hai bức ảnh hiện ra
};

const bgm = $('#bgm');
const fiBox = $('#finIntro'), wishBox = $('#finWish'), fwText = $('#fwText'), fwSign = $('#fwSign');
const btnSkip = $('#finSkip'), btnAgain = $('#finReplay'), btnBack = $('#finBack'), btnSnd = $('#finSound');
const photos = [...ov.querySelectorAll('.fp')];
const readList = sel => [...$(sel).children].map(li => ({ t: li.textContent.trim(), hold: +li.dataset.hold || 1500 }));

/* =====================================================
   NHẠC
   ===================================================== */
let fadeRaf = 0;
function fadeTo(v, ms, done) {
  cancelAnimationFrame(fadeRaf);
  if (!bgm) return;
  const v0 = bgm.volume, t0 = performance.now();
  const step = now => {
    const k = clamp01((now - t0) / ms);
    bgm.volume = clamp01(lerp(v0, v, k));
    if (k < 1) fadeRaf = requestAnimationFrame(step); else if (done) done();
  };
  fadeRaf = requestAnimationFrame(step);
}
// gọi ngay trong cú chạm/nhả dây (để trình duyệt cho phép phát nhạc), nhạc thật sự chỉ vang lên khi màn đen hiện
function primeAudio() {
  if (!bgm) return;
  try {
    bgm.volume = 0;
    const p = bgm.play();
    if (p && p.then) p.then(() => { if (!on) { bgm.pause(); bgm.currentTime = 0; } }).catch(() => {});
  } catch (e) { /* bỏ qua */ }
}
function startMusic() {
  if (!bgm) return;
  try {
    bgm.currentTime = 0; bgm.volume = 0;
    const p = bgm.play();
    if (p && p.catch) p.catch(() => {
      // bị chặn: thử lại ở lần chạm đầu tiên trong màn hình tri ân
      ov.addEventListener('pointerdown', () => { if (on) bgm.play().then(() => fadeTo(CFG.volume, 2500)).catch(() => {}); }, { once: true });
    });
    fadeTo(CFG.volume, CFG.musicFadeIn);
  } catch (e) { /* bỏ qua */ }
}
function stopMusic() { fadeTo(0, 1300, () => { try { bgm.pause(); } catch (e) { /* bỏ qua */ } }); }
btnSnd.addEventListener('click', () => {
  const m = !(bgm && bgm.muted);
  if (bgm) bgm.muted = m;
  btnSnd.setAttribute('aria-pressed', String(m));
});


/* =====================================================
   1. DÂY ĐÈN — treo lơ lửng, người xem kéo dây xuống
   ===================================================== */
const lc = $('#keoCv'), lx = lc.getContext('2d'), grab = $('#keoGrab'), hintEl = $('#keoHint');
const LCOL = ['#ffd27a', '#ff9ec0', '#ffb066', '#9ad8ff', '#fff1c9', '#c4b5ff'].map(hexRGB);
let LW = 0, LH = 0, LD = 1, strands = [], lstars = [];
let seen = false, vis = false, lraf = 0, dropT0 = 0, lastT = 0;
let lit = false, tTrig = 0;
let pull = 0, pv = 0, dragging = false, moved = false, dragY0 = 0, auto = null, crossed = false;
const THR = 80, MAXP = 150;

function buildLights() {
  const r = sec.getBoundingClientRect();
  LD = Math.min(2, devicePixelRatio || 1);
  LW = Math.max(1, Math.round(r.width)); LH = Math.max(1, Math.round(r.height));
  lc.width = LW * LD; lc.height = LH * LD;
  const small = LW < 560, per = small ? 42 : 56, rb = small ? 6.2 : 8;
  const nA = 2 * Math.max(4, Math.round(LW / per / 2));
  const sagA = Math.min(LH * .24, 190);
  const mk = (o, n, sc) => Object.assign(o, { sc, r: rb * sc, bulbs: Array.from({ length: n }, (_, i) => ({
    u: (i + .5) / n, col: LCOL[(i * 5 + (o.seed | 0)) % LCOL.length], ph: rnd(0, 6.28), len: (10 + rnd(0, 6)) * sc, d: 0 })) });
  strands = [
    mk({ y0: 6, sag: sagA * .56, sw: 1, back: true, seed: 2 }, nA - 2, .74),
    mk({ y0: 6, sag: sagA * .42, sw: 2, back: true, seed: 4 }, nA, .8),
    mk({ y0: 10, sag: sagA, sw: 1, main: true, seed: 0 }, nA, 1)
  ];
  strands.forEach(s => s.bulbs.forEach(b => { b.d = Math.abs(b.u - .5) * 1500 + rnd(0, 160); }));
  lstars = Array.from({ length: small ? 34 : 60 }, () => ({ x: rnd(0, LW), y: rnd(0, LH), s: rnd(.6, 1.7), ph: rnd(0, 6.3), tw: rnd(.8, 2.4) }));
}
function pt(s, u, dip) {
  const uu = s.sw === 2 ? (u * 2) % 1 : u;
  const x = -6 + u * (LW + 12);
  let y = s.y0 + s.sag * 4 * uu * (1 - uu);
  if (s.main && dip) y += dip * Math.pow(Math.sin(Math.PI * u), 3);
  return [x, y];
}
function drawBulb(x, y, ang, r, len, rgb, L, t, ph) {
  lx.save(); lx.translate(x, y); lx.rotate(ang);
  lx.strokeStyle = '#2a2a4e'; lx.lineWidth = 1.2;
  lx.beginPath(); lx.moveTo(0, 0); lx.lineTo(0, len); lx.stroke();
  lx.fillStyle = '#3a3a63'; lx.fillRect(-r * .42, len, r * .84, r * .8);
  const by = len + r * .8 + r * 1.05;
  if (L > .02) {
    lx.globalCompositeOperation = 'lighter';
    const g = lx.createRadialGradient(0, by, 0, 0, by, r * 6);
    g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${.6 * L})`);
    g.addColorStop(.35, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${.2 * L})`);
    g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    lx.fillStyle = g; lx.beginPath(); lx.arc(0, by, r * 6, 0, TAU); lx.fill();
    lx.globalCompositeOperation = 'source-over';
  }
  const mix = (a, b) => Math.round(lerp(a, b, L));
  const gl = lx.createRadialGradient(-r * .3, by - r * .35, r * .1, 0, by, r * 1.15);
  gl.addColorStop(0, `rgb(${mix(110, 255)},${mix(110, 250)},${mix(150, 235)})`);
  gl.addColorStop(1, `rgb(${mix(62, rgb[0])},${mix(62, rgb[1])},${mix(98, rgb[2])})`);
  lx.fillStyle = gl; lx.beginPath(); lx.ellipse(0, by, r * .92, r * 1.12, 0, 0, TAU); lx.fill();
  lx.restore();
}
function lightsFrame(now) {
  lraf = 0;
  if (!vis) return;
  const t = now / 1000, dt = Math.min(.033, (now - lastT) / 1000 || .016); lastT = now;
  lx.setTransform(LD, 0, 0, LD, 0, 0); lx.clearRect(0, 0, LW, LH);

  // sao nền
  lx.fillStyle = '#fff';
  for (const s of lstars) { lx.globalAlpha = (.12 + .3 * Math.max(0, Math.sin(t * s.tw + s.ph))) * (lit ? 1.4 : 1); lx.fillRect(s.x, s.y, s.s, s.s); }
  lx.globalAlpha = 1;

  // thả đèn xuống (nảy lò xo) + đung đưa
  const dts = (now - dropT0) / 1000;
  const sp = (!seen || reduce) ? (seen ? 1 : 0) : 1 - Math.exp(-4.2 * dts) * Math.cos(8.5 * dts);
  const off = -(1 - sp) * LH * .95;
  const exc = reduce ? 0 : Math.exp(-1.1 * dts);

  // dây cầm: kéo / tự kéo / lò xo nảy về
  if (auto) {
    const k = clamp01((now - auto.t0) / auto.dur), e = 1 - Math.pow(1 - k, 3);
    pull = lerp(auto.from, auto.to, e);
    if (k >= 1) { auto = null; ignite(); }
  } else if (!dragging) {
    pv += (-220 * pull - 14 * pv) * dt; pull += pv * dt;
    if (Math.abs(pull) < .05 && Math.abs(pv) < .5) { pull = 0; pv = 0; }
  }

  const A = strands[2], dip = pull * .22;
  const [axx, ayy] = pt(A, .5, dip);
  const cordLen = Math.max(100, Math.min(150, LH * .2));
  const sway = reduce ? 0 : Math.sin(t * 1.3) * 3 + exc * Math.sin(t * 5) * 14;
  const hx = LW / 2 + sway, hy = ayy + off + cordLen + pull;
  const litAmt = lit ? clamp01((now - tTrig) / 800) : 0;

  for (const s of strands) {
    lx.strokeStyle = litAmt > .3 ? (s.back ? '#4a4a86' : '#6b6bb0') : (s.back ? '#2d2d58' : '#43437a');
    lx.lineWidth = s.back ? 1.3 : 1.8;
    lx.beginPath();
    for (let i = 0; i <= 56; i++) { const [x, y] = pt(s, i / 56, dip); i ? lx.lineTo(x, y + off) : lx.moveTo(x, y + off); }
    lx.stroke();
    for (const b of s.bulbs) {
      const [bx, by] = pt(s, b.u, dip);
      const L = lit ? clamp01((now - tTrig - b.d) / 280) : .05 + .04 * Math.sin(t * 2 + b.ph);
      const ang = reduce ? 0 : Math.sin(t * 1.6 + b.ph) * .035 + exc * Math.sin(t * 5 + b.ph) * .3;
      drawBulb(bx, by + off, ang, s.r, b.len, b.col, L, t, b.ph);
    }
  }

  // sợi dây + chuỗi hạt + tay cầm
  lx.strokeStyle = 'rgba(210,210,245,.75)'; lx.lineWidth = 1.4;
  lx.beginPath(); lx.moveTo(axx, ayy + off); lx.lineTo(hx, hy); lx.stroke();
  lx.fillStyle = '#d9d9f5';
  const dist = Math.hypot(hx - axx, hy - (ayy + off)), nb = Math.floor(dist / 9);
  for (let i = 1; i < nb; i++) { const k = i / nb; lx.beginPath(); lx.arc(lerp(axx, hx, k), lerp(ayy + off, hy, k), 1.5, 0, TAU); lx.fill(); }
  lx.fillStyle = '#8e8ec8'; lx.beginPath(); lx.arc(axx, ayy + off, 4, 0, TAU); lx.fill();
  if (!lit && !dragging && !auto) {                          // vòng gợi ý
    const k = (t % 1.7) / 1.7;
    lx.strokeStyle = `rgba(255,178,125,${.6 * (1 - k)})`; lx.lineWidth = 2;
    lx.beginPath(); lx.arc(hx, hy + 6, 12 + k * 26, 0, TAU); lx.stroke();
  }
  const ready = pull >= THR && dragging;
  lx.globalCompositeOperation = 'lighter';
  const hg = lx.createRadialGradient(hx, hy + 6, 0, hx, hy + 6, 34);
  hg.addColorStop(0, `rgba(255,150,80,${ready || lit ? .55 : .28})`); hg.addColorStop(1, 'rgba(255,150,80,0)');
  lx.fillStyle = hg; lx.beginPath(); lx.arc(hx, hy + 6, 34, 0, TAU); lx.fill();
  lx.globalCompositeOperation = 'source-over';
  lx.strokeStyle = '#ff9a5c'; lx.lineWidth = 3.2; lx.beginPath(); lx.arc(hx, hy + 6, 9.5, 0, TAU); lx.stroke();
  lx.fillStyle = '#f26a21'; lx.beginPath(); lx.moveTo(hx, hy + 16); lx.lineTo(hx - 5, hy + 34); lx.lineTo(hx + 5, hy + 34); lx.closePath(); lx.fill();
  lx.fillStyle = '#ffb27d'; lx.beginPath(); lx.ellipse(hx, hy + 36, 5, 4, 0, 0, TAU); lx.fill();
  grab.style.transform = `translate(${hx.toFixed(1)}px,${(hy + 16).toFixed(1)}px)`;

  lraf = requestAnimationFrame(lightsFrame);
}
function wakeLights() { if (!lraf && vis) { lastT = performance.now(); lraf = requestAnimationFrame(lightsFrame); } }

new IntersectionObserver(es => es.forEach(e => {
  vis = e.isIntersecting;
  if (vis && e.intersectionRatio >= .25 && !seen) { seen = true; dropT0 = performance.now(); if (bgm) { try { bgm.preload = 'auto'; bgm.load(); } catch (er) { /* bỏ qua */ } } }
  if (vis) wakeLights();
}), { threshold: [0, .25, .5] }).observe(sec);
addEventListener('resize', () => { buildLights(); });
buildLights();

function ignite() {
  if (lit) return;
  lit = true; tTrig = performance.now();
  sec.classList.add('lit'); hintEl.classList.add('off');
  grab.disabled = true;
  if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (e) { /* bỏ qua */ } }
  setTimeout(openFinale, reduce ? 500 : 1700);
}
function autoPull() {
  if (lit || auto) return;
  primeAudio();
  auto = { t0: performance.now(), from: pull, to: 130, dur: reduce ? 1 : 420 };
  dragging = false; wakeLights();
}
grab.addEventListener('pointerdown', e => {
  if (lit || auto) return;
  dragging = true; moved = false; crossed = false; dragY0 = e.clientY; pv = 0;
  try { grab.setPointerCapture(e.pointerId); } catch (er) { /* bỏ qua */ }
  grab.classList.add('drag'); e.preventDefault();
});
grab.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dy = e.clientY - dragY0;
  if (Math.abs(dy) > 6) moved = true;
  let p = Math.max(0, dy) * .8;
  if (p > 100) p = 100 + (p - 100) * .25;
  pull = Math.min(p, MAXP);
  if (pull >= THR && !crossed) { crossed = true; if (navigator.vibrate) { try { navigator.vibrate(12); } catch (er) { /* bỏ qua */ } } }
  if (pull < THR) crossed = false;
});
const release = () => {
  if (!dragging) return;
  dragging = false; grab.classList.remove('drag');
  if (!moved) { autoPull(); return; }                        // chỉ chạm nhẹ → tự kéo giúp
  if (pull >= THR) { primeAudio(); ignite(); }
};
grab.addEventListener('pointerup', release);
grab.addEventListener('pointercancel', () => { if (dragging) { dragging = false; grab.classList.remove('drag'); } });
grab.addEventListener('click', e => { if (e.detail === 0) autoPull(); });      // bàn phím / trình đọc màn hình
grab.addEventListener('contextmenu', e => e.preventDefault());

function resetLights() {
  lit = false; pull = 0; pv = 0; auto = null; dragging = false;
  sec.classList.remove('lit'); hintEl.classList.remove('off'); grab.disabled = false;
  dropT0 = performance.now(); wakeLights();
}


/* =====================================================
   2. MÀN ĐEN — chữ dẫn → lá & cánh hoa cuộn → nụ → nở → lời chúc + ảnh thầy cô
   ===================================================== */
const cvs = $('#fx'), c = cvs.getContext('2d');
let on = false, run = 0, raf = 0, phase = 'idle';
let W = 0, H = 0, D = 1, cx = 0, cy = 0, R = 100, mode = 'port';
let P = [], stars = [], amb = [];
let starA = 0, starT = 0, glowA = 0, glowT = 0;
const T = { swirl0: 0, bloom0: 0 };
const GA = 2.399963;                                          // góc vàng

const PETAL = new Path2D(), LEAF = new Path2D();
PETAL.moveTo(-1, 0); PETAL.bezierCurveTo(-.9, -.72, .45, -.78, 1, 0); PETAL.bezierCurveTo(.45, .78, -.9, .72, -1, 0);
LEAF.moveTo(-1, 0); LEAF.quadraticCurveTo(0, -.72, 1, 0); LEAF.quadraticCurveTo(0, .72, -1, 0);

const STOPS = [[0, [255, 214, 102]], [.14, [255, 190, 100]], [.38, [255, 143, 120]], [.62, [255, 128, 170]], [.85, [255, 190, 215]], [1, [255, 240, 245]]];
function petalRGB(f) {
  let i = 1; while (i < STOPS.length - 1 && f > STOPS[i][0]) i++;
  const [f0, c0] = STOPS[i - 1], [f1, c1] = STOPS[i], k = clamp01((f - f0) / (f1 - f0)), j = rnd(-10, 10);
  return `rgb(${Math.max(0, Math.min(255, Math.round(lerp(c0[0], c1[0], k) + j)))},${Math.max(0, Math.min(255, Math.round(lerp(c0[1], c1[1], k) + j)))},${Math.max(0, Math.min(255, Math.round(lerp(c0[2], c1[2], k) + j)))})`;
}
const GREENS = ['#4fa66d', '#3f8f5b', '#7bd08f', '#2e7d4f', '#62b97f'];

function layout() {
  W = innerWidth; H = innerHeight; D = Math.min(2, devicePixelRatio || 1);
  cvs.width = Math.round(W * D); cvs.height = Math.round(H * D);
  if (H < 520 && W > H) { mode = 'land'; cx = W * .28; cy = H * .5; R = Math.min(H * .3, W * .18); }
  else if (W >= 900) { mode = 'desk'; cx = W * .5; cy = H * .38; R = Math.min(H * .2, W * .18, 200); }
  else { mode = 'port'; cx = W / 2; cy = H * .36; R = Math.min(W * .28, H * .15, 150); }
  wishBox.style.setProperty('--wt', Math.round(cy + R * 1.4) + 'px');
  stars = Array.from({ length: W < 700 ? 60 : 110 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: rnd(.8, 2), a: rnd(.25, .8), ph: rnd(0, 6.3), tw: rnd(.8, 2.4) }));
}
function build() {
  const np = W < 700 ? 230 : 380, nl = W < 700 ? 46 : 70;
  P = [];
  for (let i = 0; i < np; i++) { const f = (i + .5) / np; P.push({ k: 0, i, f, col: petalRGB(f), ph: rnd(0, 6.3) }); }
  for (let j = 0; j < nl; j++) P.push({ k: 1, i: j, f: j / nl, col: GREENS[(Math.random() * GREENS.length) | 0], ph: rnd(0, 6.3), nl });
  P.sort((a, b) => b.k - a.k || b.f - a.f);                    // lá vẽ trước, cánh ngoài trước cánh trong
  retarget(); randomizeSwirl();
}
function retarget() {
  for (const p of P) {
    if (!p.k) {
      const th = p.i * GA, edge = .8 + .2 * Math.cos(8 * th);
      p.ta = wrapPI(th); p.tr = R * Math.pow(p.f, .6) * edge; p.tsz = R * (.09 + .13 * Math.pow(p.f, .9)); p.bd = p.f * 900 + rnd(0, 200);
    } else {
      const odd = p.i % 2;
      p.ta = wrapPI((p.i / p.nl) * TAU + (odd ? Math.PI / p.nl : 0) + rnd(-.05, .05));
      p.tr = R * (odd ? rnd(1.02, 1.14) : rnd(1.16, 1.3)); p.tsz = R * (odd ? .27 : .22) * rnd(.85, 1.15); p.bd = 700 + rnd(0, 500);
    }
    p.bdu = rnd(1900, 2600);
  }
}
function randomizeSwirl() {
  const far = Math.max(W, H);
  for (const p of P) {
    p.a0 = rnd(0, TAU); p.r0 = far * rnd(.6, 1.1); p.spin = rnd(2.4, 3.8) * Math.PI;
    p.dl = rnd(0, 1900); p.du = rnd(3200, 4200); p.rb = R * rnd(.04, .2) * (p.k ? 1.15 : 1);
  }
}
const tmp = { x: 0, y: 0, ang: 0, rad: 0, a: 0 };
function swirlState(p, now, o) {
  const ts = now - T.swirl0 - p.dl, k = clamp01(ts / p.du), e = 1 - Math.pow(1 - k, 3);
  const extra = ts > p.du ? (ts - p.du) / 1000 * 2.4 : 0;     // khi đã vào nụ vẫn xoay tròn
  o.ang = p.a0 + p.spin * e + extra; o.rad = lerp(p.r0, p.rb, e);
  o.x = cx + Math.cos(o.ang) * o.rad; o.y = cy + Math.sin(o.ang) * o.rad * .92;
  o.a = clamp01(ts / 500);
}
function startBloom(now) {
  T.bloom0 = now;
  for (const p of P) { swirlState(p, now, tmp); p.bx = tmp.ang; p.br = tmp.rad; }
  phase = 'bloom'; glowT = .55;
}
function drawP(p, x, y, rot, s, a) {
  const cs = Math.cos(rot), sn = Math.sin(rot), sy = s * (p.k ? .5 : .62);
  c.setTransform(D * cs * s, D * sn * s, -D * sn * sy, D * cs * sy, D * x, D * y);
  c.globalAlpha = a; c.fillStyle = p.col; c.fill(p.k ? LEAF : PETAL);
}
const easeOutBack = k => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

function frame(now) {
  raf = 0; if (!on) return;
  c.setTransform(D, 0, 0, D, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);

  // sao
  starA += (starT - starA) * .02;
  if (starA > .01) {
    c.fillStyle = '#fff';
    for (const s of stars) { c.globalAlpha = starA * s.a * (.5 + .5 * Math.sin(now / 1000 * s.tw + s.ph)); c.fillRect(s.x, s.y, s.s, s.s); }
    c.globalAlpha = 1;
  }

  // vầng sáng sau hoa
  glowA += (glowT - glowA) * .03;
  if (glowA > .01) {
    c.globalCompositeOperation = 'lighter';
    const pul = 1 + (phase === 'bloom' ? .04 * Math.sin(now / 900) : .1 * Math.sin(now / 260));
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 2.5 * pul);
    g.addColorStop(0, `rgba(255,160,120,${.38 * glowA})`); g.addColorStop(.45, `rgba(255,100,150,${.14 * glowA})`); g.addColorStop(1, 'rgba(255,100,150,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 2.5 * pul, 0, TAU); c.fill();
    if (phase === 'bloom') {                                   // loé sáng lúc hoa bung nở
      const kf = clamp01((now - T.bloom0 - 250) / 1200), fa = kf > 0 && kf < 1 ? Math.pow(1 - kf, 2) * .8 : 0;
      if (fa > .01) {
        const g2 = c.createRadialGradient(cx, cy, 0, cx, cy, R * (1 + kf * 1.2));
        g2.addColorStop(0, `rgba(255,236,210,${fa})`); g2.addColorStop(1, 'rgba(255,236,210,0)');
        c.fillStyle = g2; c.beginPath(); c.arc(cx, cy, R * 2.3, 0, TAU); c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over';
  }

  // lá & cánh hoa
  if (phase === 'swirl') {
    for (const p of P) {
      swirlState(p, now, tmp);
      if (tmp.a <= 0) continue;
      drawP(p, tmp.x, tmp.y, tmp.ang + Math.PI / 2 + (p.k ? .35 : 0), p.tsz * .7, tmp.a * (p.k ? .95 : .9));
    }
  } else if (phase === 'bloom') {
    const idle = (now - T.bloom0) * .00005;
    for (const p of P) {
      const kb = clamp01((now - T.bloom0 - p.bd) / p.bdu), e = easeOutBack(kb), eo = 1 - Math.pow(1 - kb, 3);
      const breath = kb >= 1 ? 1 + .018 * Math.sin(now / 900 + p.f * 8) : 1;
      const ang = p.bx + wrapPI(p.ta - p.bx) * eo + idle;
      const rad = p.br + (p.tr * breath - p.br) * e;
      const rb0 = p.bx + Math.PI / 2;
      let rot = rb0 + wrapPI(p.ta - rb0) * eo + idle;
      if (p.k && kb >= 1) rot += Math.sin(now / 1100 + p.ph) * .06;
      drawP(p, cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * (.92 + .08 * eo), rot, p.tsz * (.6 + .4 * e), .94);
    }
    // cánh hoa rơi nhẹ quanh màn hình
    if (now - T.bloom0 > 2500) {
      if (!amb.length) amb = Array.from({ length: W < 700 ? 16 : 28 }, () => ambNew(true));
      for (const q of amb) {
        q.ph += .012; q.y += q.vy; q.x += Math.sin(q.ph) * .5; q.rot += q.vr;
        if (q.y > H + 20) Object.assign(q, ambNew(false));
        drawP(q, q.x, q.y, q.rot, q.s, q.a);
      }
    }
  }
  c.setTransform(D, 0, 0, D, 0, 0); c.globalAlpha = 1;
  raf = requestAnimationFrame(frame);
}
function ambNew(any) {
  return { k: 0, x: rnd(0, W), y: any ? rnd(0, H) : -20, vy: rnd(.35, .9), ph: rnd(0, 6.3), s: rnd(5, 10), rot: rnd(0, TAU), vr: rnd(-.02, .02),
    col: ['#ffd1e0', '#ffffff', '#ff8fb3', '#ffe27a'][(Math.random() * 4) | 0], a: rnd(.35, .7) };
}

/* ---- chữ hiện từng từ ---- */
function words(el, txt, step) {
  el.textContent = '';
  const ws = txt.split(/\s+/);
  ws.forEach((w, i) => {
    const s = document.createElement('span'); s.className = 'wd'; s.textContent = w; s.style.setProperty('--d', (i * step) + 'ms');
    el.appendChild(s); if (i < ws.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return ws.length * step + 900;
}

/* ---- kịch bản ---- */
function resetStage(from) {
  fiBox.innerHTML = '';
  wishBox.classList.remove('show'); fwText.textContent = ''; fwText.classList.remove('out'); fwSign.classList.remove('show');
  btnAgain.hidden = btnBack.hidden = true; btnSkip.hidden = false;
  photos.forEach(f => f.classList.remove('on'));
  amb = []; phase = 'idle'; glowA = glowT = 0;
  if (from === 'intro') { starA = 0; starT = 0; }
  build();
}
async function sequence(from) {
  const id = ++run, live = () => on && id === run;
  const t = async ms => { await wait(ms); return live(); };
  resetStage(from);

  if (from === 'intro') {
    if (!await t(CFG.blackWait)) return;
    for (const ln of readList('#introSrc')) {
      const el = document.createElement('p'); el.className = 'fi-line'; fiBox.appendChild(el);
      const d = words(el, ln.t, reduce ? 0 : 130);
      if (!await t(d + ln.hold)) return;
      el.classList.add('out');
      if (!await t(1000)) return;
      el.remove();
    }
  }

  // lá & cánh hoa bay tới, cuộn tròn
  starT = 1; glowT = .25; phase = 'swirl';
  if (from === 'bloom') T.swirl0 = performance.now() - 9000;
  else T.swirl0 = performance.now();
  if (reduce) T.swirl0 -= 9000;
  if (from !== 'bloom' && !reduce && !await t(CFG.swirlMs)) return;
  glowT = .5;
  if (!await t(reduce ? 100 : CFG.budHold)) return;

  // nở thành hoa
  startBloom(performance.now());
  btnSkip.hidden = true;
  if (!await t(reduce ? 200 : 1500)) return;
  wishBox.classList.add('show');
  (async () => {                                              // ảnh thầy cô lần lượt hiện ra rồi lơ lửng
    for (const f of photos) { if (!live()) return; f.classList.add('on'); await wait(reduce ? 150 : CFG.photoGap); }
  })();
  if (!await t(reduce ? 200 : 1400)) return;

  // các lời chúc hiện từ từ
  const wishes = readList('#wishSrc').map(w => w.t);
  for (let i = 0; i < wishes.length; i++) {
    fwText.classList.remove('out');
    const d = words(fwText, wishes[i], reduce ? 0 : CFG.wordStep);
    if (!await t(d + CFG.wishHoldBase + wishes[i].length * CFG.wishHoldPerChar)) return;
    if (i < wishes.length - 1) { fwText.classList.add('out'); if (!await t(950)) return; }
  }
  fwSign.textContent = $('#wishSign').textContent.trim();
  fwSign.classList.add('show');
  if (!await t(1400)) return;
  btnAgain.hidden = btnBack.hidden = false;
  try { btnBack.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ }
}

function openFinale() {
  if (on) return;
  on = true; layout();
  document.body.classList.add('fin-on');
  ov.classList.add('on');
  startMusic();
  raf = requestAnimationFrame(frame);
  sequence('intro');
}
async function closeFinale() {
  if (!on) return;
  run++;                                                      // dừng kịch bản đang chạy
  ov.classList.remove('on'); document.body.classList.remove('fin-on');
  stopMusic();
  await wait(1500);
  on = false; cancelAnimationFrame(raf); raf = 0; phase = 'idle';
  photos.forEach(f => f.classList.remove('on'));
  fiBox.innerHTML = ''; wishBox.classList.remove('show');
  resetLights();
}
btnBack.addEventListener('click', closeFinale);
btnAgain.addEventListener('click', () => sequence('swirl'));
btnSkip.addEventListener('click', () => sequence('bloom'));
addEventListener('keydown', e => { if (e.key === 'Escape') closeFinale(); });

let rt = 0;
addEventListener('resize', () => {
  if (!on) return;
  clearTimeout(rt);
  rt = setTimeout(() => {
    layout(); retarget();
    if (phase === 'swirl' || phase === 'bloom') { for (const p of P) { p.rb = R * rnd(.04, .2) * (p.k ? 1.15 : 1); } if (phase === 'bloom') startBloom(performance.now() - 6000); }
  }, 200);
});

// cho phép kiểm thử nhanh trong console: BM.finale.open()
window.BM.finale = { open: openFinale, close: closeFinale };
})();
