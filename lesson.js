(() => {
'use strict';
const { $, reduce, wait, rnd, petalBurst, petalCanvas } = window.BM;
const paper = $('#paper'), curtain = $('#curtain'), root = document.documentElement;
const nowD = new Date();
$('#today').textContent = `Số đặc biệt 20/11 · ${nowD.getDate()}/${nowD.getMonth() + 1}/${nowD.getFullYear()}`;

/* hiện dần các khối nội dung khi cuộn tới */
function setupReveal() {
  const els = [...document.querySelectorAll('.m-head, .m-grid > .card, .demo-end')];
  const show = el => { el.classList.add('in'); setTimeout(() => el.classList.remove('rv'), 1800); };
  const circ = $('#circ');
  if (!('IntersectionObserver' in window)) { circ.classList.add('on'); return; }
  els.forEach((el, i) => { el.classList.add('rv'); el.style.setProperty('--rd', ((i % 2) * .12) + 's'); });
  const io = new IntersectionObserver(list => list.forEach(en => {
    if (!en.isIntersecting) return;
    if (en.target === circ) circ.classList.add('on'); else show(en.target);
    io.unobserve(en.target);
  }), { threshold: .12 });
  els.forEach(el => io.observe(el));
  io.observe(circ);
}


/* =====================================================
   4. TOÁN — nửa đường tròn đơn vị tương tác
   ===================================================== */
let playing = false, raf = 0;
const svg = $('#circ'), slider = $('#ang'), angOut = $('#angOut');
const O = { x: 320, y: 312 }, R = 270;
const P = (x, y) => [O.x + x * R, O.y - y * R];
const exact = {
  0:   ['0', '1', '0', '∄'],
  30:  ['1/2', '√3/2', '√3/3', '√3'],
  45:  ['√2/2', '√2/2', '1', '1'],
  60:  ['√3/2', '1/2', '√3', '√3/3'],
  90:  ['1', '0', '∄', '0'],
  120: ['√3/2', '−1/2', '−√3', '−√3/3'],
  135: ['√2/2', '−√2/2', '−1', '−1'],
  150: ['1/2', '−√3/2', '−√3/3', '−√3'],
  180: ['0', '−1', '0', '∄']
};
const f3 = v => { v = Math.abs(v) < 5e-4 ? 0 : v; return (+v.toFixed(3)).toString().replace('.', ',').replace('-', '−'); };

function drawBase() {
  const [ax, ay] = P(-1, 0), [bx, by] = P(1, 0), [tx, ty] = P(0, 1);
  svg.innerHTML = `
    <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#8b8bb5"/></marker></defs>
    <line x1="22" y1="${O.y}" x2="618" y2="${O.y}" stroke="#8b8bb5" stroke-width="1.5" marker-end="url(#ar)"/>
    <line x1="${O.x}" y1="${O.y}" x2="${O.x}" y2="24" stroke="#8b8bb5" stroke-width="1.5" marker-end="url(#ar)"/>
    <path class="arc" d="M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by}" fill="rgba(47,47,133,.05)" stroke="#2f2f85" stroke-width="3"/>
    <g font-family="JetBrains Mono,monospace" font-size="15" fill="#2f2f85">
      <text x="${ax - 6}" y="${ay + 24}" text-anchor="middle">−1</text>
      <text x="${bx + 6}" y="${by + 24}" text-anchor="middle">1</text>
      <text x="${O.x - 12}" y="${ty + 5}" text-anchor="end">1</text>
      <text x="${O.x - 10}" y="${O.y + 22}" text-anchor="end">O</text>
      <text x="612" y="${O.y + 22}" text-anchor="end" fill="#8b8bb5">x</text>
      <text x="${O.x + 12}" y="30" fill="#8b8bb5">y</text>
    </g>
    <g id="dyn"></g>
    <circle id="mring" class="mring" r="9" cx="320" cy="42"/>`;
}
function draw(a) {
  const rad = a * Math.PI / 180, x = Math.cos(rad), y = Math.sin(rad);
  const [mx, my] = P(x, y), [hx, hy] = P(x, 0), [vx, vy] = P(0, y);
  const ar = 52, [sx, sy] = [O.x + ar, O.y], [ex, ey] = [O.x + ar * x, O.y - ar * y];
  const large = 0;
  $('#dyn').innerHTML = `
    <path d="M${sx} ${sy} A${ar} ${ar} 0 ${large} 0 ${ex} ${ey}" fill="none" stroke="#f26a21" stroke-width="3"/>
    <line x1="${O.x}" y1="${O.y}" x2="${mx}" y2="${my}" stroke="#2f2f85" stroke-width="2.5"/>
    <line x1="${mx}" y1="${my}" x2="${hx}" y2="${hy}" stroke="#f26a21" stroke-width="2" stroke-dasharray="6 5"/>
    <line x1="${mx}" y1="${my}" x2="${vx}" y2="${vy}" stroke="#2fa36b" stroke-width="2" stroke-dasharray="6 5"/>
    <circle cx="${hx}" cy="${hy}" r="4.5" fill="#f26a21"/><circle cx="${vx}" cy="${vy}" r="4.5" fill="#2fa36b"/>
    <circle cx="${mx}" cy="${my}" r="9" fill="#f26a21" stroke="#fff" stroke-width="3"/>
    <g font-family="Be Vietnam Pro,sans-serif" font-size="15" font-weight="600">
      <text x="${mx + (x >= 0 ? -14 : 14)}" y="${my - 12}" text-anchor="${x >= 0 ? 'end' : 'start'}" fill="#2f2f85">M(${f3(x)}; ${f3(y)})</text>
      <text x="${(O.x + hx) / 2}" y="${O.y + 40}" text-anchor="middle" fill="#f26a21">cos α = ${f3(x)}</text>
      <text x="${vx + 12}" y="${(vy + O.y) / 2 - (y > .5 ? 0 : 16)}" fill="#2fa36b" ${a === 0 || a === 180 ? 'opacity="0"' : ''}>sin α</text>
      <text x="${O.x + ar + 10}" y="${O.y - 12}" fill="#f26a21" font-size="16" ${a === 0 ? 'opacity="0"' : ''}>α</text>
    </g>`;
  const mr = $('#mring'); mr.setAttribute('cx', mx); mr.setAttribute('cy', my);
  // giá trị
  const tan = Math.abs(x) < 1e-9 ? null : y / x, cot = Math.abs(y) < 1e-9 ? null : x / y;
  const ex_ = exact[a];
  const out = (v, i) => v === null ? '∄' : (ex_ ? `${ex_[i]}` : f3(v));
  const setV = (id, v) => { const e = $(id); if (e.textContent === v) return; e.textContent = v;
    if (!playing) { e.classList.remove('tick'); void e.offsetWidth; e.classList.add('tick'); } };
  setV('#vSin', out(y, 0)); setV('#vCos', out(x, 1)); setV('#vTan', out(tan, 2)); setV('#vCot', out(cot, 3));
  const idx = [0, 30, 45, 60, 90, 120, 135, 150, 180].indexOf(a);
  document.querySelectorAll('.table-card tr').forEach(tr => [...tr.children].forEach((c, j) => c.classList.toggle('hl', idx >= 0 && j === idx + 1)));
  angOut.textContent = a + '°';
  document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('on', +b.dataset.a === a));
}
const presets = $('#presets');
[0, 30, 45, 60, 90, 120, 135, 150, 180].forEach(a => {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.a = a; b.textContent = a + '°';
  b.addEventListener('click', () => { stopPlay(); slider.value = a; draw(a); });
  presets.appendChild(b);
});
slider.addEventListener('input', () => { stopPlay(); draw(+slider.value); });
const playBtn = $('#playBtn');
function stopPlay() { playing = false; cancelAnimationFrame(raf); playBtn.classList.remove('on'); playBtn.textContent = '▶ Tự chạy'; }
function startPlay() {
  playing = true; playBtn.classList.add('on'); playBtn.textContent = '❚❚ Dừng';
  const ph = Math.asin(Math.max(-1, Math.min(1, (+slider.value - 90) / 90))), t0 = performance.now();
  const step = t => {
    if (!playing) return;
    const a = Math.round(90 + 90 * Math.sin(ph + (t - t0) / 9000 * 2 * Math.PI));
    if (a !== +slider.value) { slider.value = a; draw(a); }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
playBtn.addEventListener('click', () => playing ? stopPlay() : startPlay());
drawBase(); draw(+slider.value);


/* ---------- vào trang: mở màn chắn nếu đi từ trang giới thiệu ---------- */
(async function arrive() {
  petalCanvas.classList.add('soft'); petalBurst(12);
  if (!root.classList.contains('arrive')) { paper.classList.add('in'); setupReveal(); return; }
  try { sessionStorage.removeItem('bm-in'); } catch (e) { /* bỏ qua */ }
  await wait(650);
  paper.classList.add('in'); setupReveal();
  curtain.className = 'open';
  root.classList.remove('arrive');
  await wait(950);
  curtain.className = '';
})();

})();
