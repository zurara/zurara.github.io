/* 有手就行 · 共用
 * 小工具、毛线画法、声音（WebAudio 合成，无音频文件）、纸纹。
 * 刺绣和棒针都从这里拿毛线和声音；每个小玩意自己管自己的画布缓存和状态。
 */
(() => {
'use strict';

// ───────────────────────── 小工具 ─────────────────────────

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA77) ^ Math.imul(c | 0, 0xC2B2AE3D);
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D);
  h = Math.imul(h ^ (h >>> 12), 0x297A2D39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = t => t * t * (3 - 2 * t);
  return lerp(
    lerp(hash(xi, yi, seed), hash(xi + 1, yi, seed), s(xf)),
    lerp(hash(xi, yi + 1, seed), hash(xi + 1, yi + 1, seed), s(xf)),
    s(yf));
}

function bez(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

function slice(pts, t) {
  if (t >= 1) return pts;
  const f = Math.max(0, t) * (pts.length - 1), i = Math.floor(f), q = f - i;
  const out = pts.slice(0, i + 1), a = pts[i], b = pts[i + 1] || a;
  out.push([a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]);
  return out;
}

// 点到线段的距离（抓线、抓针用）
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

function polyDist(px, py, pts) {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(px, py, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return d;
}

// ───────────────────────── 毛线画法 ─────────────────────────

const PAL = [
  { base: '#1E6BC6', dark: '#123F85', light: '#8CBDF2' },
  { base: '#F2441F', dark: '#A8260B', light: '#FFA88D' },
];

function trace(g, pts, ox, oy) {
  g.beginPath();
  g.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + ox, pts[i][1] + oy);
}

/* 一段毛线 = 投影 + 底色 + 背光侧暗边 + 斜向捻纹（暗）+ 受光侧捻纹（亮）+ 几根浮毛。
 * 每段 6 次 stroke；织好的进缓存不再重画。 */
function yarn(g, pts, w, pal, seed, shadow = true) {
  if (pts.length < 2) return;
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  if (shadow) {
    g.strokeStyle = `rgba(70,52,30,${shadow === true ? .17 : shadow})`;
    g.lineWidth = w;
    trace(g, pts, w * .1, w * .26);
    g.stroke();
  }
  g.strokeStyle = pal.base;
  g.lineWidth = w;
  trace(g, pts, 0, 0);
  g.stroke();

  const hw = w * .47, sl = w * .36, step = Math.max(1.6, w * .5);
  const shade = new Path2D(), dark = new Path2D(), light = new Path2D(), hair = new Path2D();
  let acc = step * r(), first = true;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0], ay = pts[i - 1][1];
    const dx = pts[i][0] - ax, dy = pts[i][1] - ay, len = Math.hypot(dx, dy);
    if (len < 1e-4) continue;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const s = (nx * -.6 + ny * -.8) > 0 ? 1 : -1;   // 光从左上来，s 指向受光侧
    const sx = -s * nx * w * .3, sy = -s * ny * w * .3;
    if (first) { shade.moveTo(ax + sx, ay + sy); first = false; }
    shade.lineTo(ax + dx + sx, ay + dy + sy);
    while (acc <= len) {
      const px = ax + ux * acc, py = ay + uy * acc;
      dark.moveTo(px - nx * hw - ux * sl, py - ny * hw - uy * sl);
      dark.lineTo(px + nx * hw + ux * sl, py + ny * hw + uy * sl);
      const qx = px + ux * step * .5, qy = py + uy * step * .5;
      light.moveTo(qx + s * (nx * hw + ux * sl) * .62, qy + s * (ny * hw + uy * sl) * .62);
      light.lineTo(qx + s * (nx * hw + ux * sl) * .05, qy + s * (ny * hw + uy * sl) * .05);
      if (r() < .2) {
        const side = r() < .5 ? -1 : 1, lean = (r() - .5) * 1.8, hl = w * (.22 + r() * .22);
        const hx = px + nx * hw * side, hy = py + ny * hw * side;
        hair.moveTo(hx, hy);
        hair.lineTo(hx + (nx * side + ux * lean) * hl, hy + (ny * side + uy * lean) * hl);
      }
      acc += step;
    }
    acc -= len;
  }

  g.globalAlpha = .26;
  g.strokeStyle = pal.dark;
  g.lineWidth = w * .3;
  g.stroke(shade);

  g.lineCap = 'butt';
  g.globalAlpha = .5;
  g.lineWidth = Math.max(.7, w * .1);
  g.stroke(dark);

  g.lineCap = 'round';
  g.globalAlpha = .6;
  g.strokeStyle = pal.light;
  g.lineWidth = Math.max(.7, w * .13);
  g.stroke(light);

  g.globalAlpha = .6;
  g.strokeStyle = pal.base;
  g.lineWidth = .6;
  g.stroke(hair);
  g.globalAlpha = 1;
}

// 线头散开的几根细丝
function fray(g, x, y, ang, w, pal, r) {
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = ang + (r() - .5) * 1.2, l = w * (1.1 + r() * 1.5);
    g.strokeStyle = i === 2 ? pal.dark : pal.base;
    g.lineWidth = w * (.24 + r() * .12);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang) * l * .5, y + Math.sin(ang) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
}

// ───────────────────────── 存档 ─────────────────────────

const store = {
  get(k, d = null) {
    try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式等：不存也能玩 */ }
  },
};

// ───────────────────────── 声音 ─────────────────────────

let ac = null, noiseBuf = null;
let muted = store.get('hands-on.mute', null);
if (muted == null) {
  try { muted = localStorage.getItem('weave.mute') === '1'; } catch (e) { muted = false; }
}

function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch (e) { return null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function pluck(freq, when = 0, dur = .16, gain = .07, type = 'triangle') {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + when, o = a.createOscillator(), v = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  v.gain.setValueAtTime(0.0001, t);
  v.gain.linearRampToValueAtTime(gain, t + .005);
  v.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(v).connect(a.destination);
  o.start(t);
  o.stop(t + dur + .03);
}

// 一小段带通噪声：扯线的「嘶」、木针相碰的「嗒」、翻面的「呼」
function hiss(when, dur, gain, f0, f1, q) {
  if (muted) return;
  const a = audio();
  if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * .5), a.sampleRate);
    const d = noiseBuf.getChannelData(0), r = rng(7);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  }
  const t = a.currentTime + when, src = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
  src.buffer = noiseBuf;
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  v.gain.setValueAtTime(.0001, t);
  v.gain.linearRampToValueAtTime(gain, t + Math.min(.01, dur * .3));
  v.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f).connect(v).connect(a.destination);
  src.start(t, Math.random() * .3);
  src.stop(t + dur + .02);
}

const sound = {
  tick: (semi, when = 0) => pluck(293.66 * Math.pow(2, semi / 12), when, .17, .06),
  ding: () => { pluck(1567.98, 0, .9, .05, 'sine'); pluck(2349.32, 0, .5, .022, 'sine'); },
  thud: () => pluck(115, 0, .09, .07, 'sine'),
  fanfare: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => pluck(f, .12 + i * .09, .32, .05)),
  rip: () => hiss(0, .08, .1, 2600, 900, 1.1),
  clack: (when = 0) => { hiss(when, .035, .07, 3400, 2600, 5); pluck(1320, when, .05, .018, 'square'); },
  turn: () => hiss(0, .26, .05, 420, 1700, .7),
};

// ───────────────────────── 纸纹 ─────────────────────────

function paper() {
  const n = 180, c = document.createElement('canvas');
  c.width = c.height = n;
  const p = c.getContext('2d'), r = rng(20261110);
  p.fillStyle = '#F6F4EF';
  p.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) {
    p.fillStyle = r() < .5 ? `rgba(120,100,70,${.02 + r() * .05})` : `rgba(255,255,255,${.2 + r() * .4})`;
    p.fillRect(r() * n, r() * n, 1, 1);
  }
  p.lineWidth = .5;
  for (let i = 0; i < 26; i++) {
    const x = r() * n, y = r() * n, a = r() * Math.PI, l = 3 + r() * 7;
    p.strokeStyle = `rgba(120,100,70,${.04 + r() * .05})`;
    p.beginPath();
    p.moveTo(x, y);
    p.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    p.stroke();
  }
  document.body.style.backgroundImage = `url(${c.toDataURL()})`;
  document.body.style.backgroundSize = `${n}px ${n}px`;
}

/* 悬空的影子：把整张画（src，设备像素）一半一半地缩小当模糊（每次缩一半才会真的平均，
 * 一步缩太多会漏掉细线、变成一格一格的），染成暖灰，错开 (dx, dy) 淡淡地垫在下面。
 * 比 ctx.filter 稳（iOS Safari 也能用），每帧只多几次小图 drawImage。 */
const chain = [];
function floatShadow(g, src, w, h, dx, dy, alpha, dpr = 1) {
  const steps = Math.max(2, Math.round(Math.log2(10 * dpr)));   // 大约糊到 10 个 CSS 像素
  let cur = src, cw = src.width, ch = src.height;
  for (let i = 0; i < steps; i++) {
    cw = Math.max(1, Math.ceil(cw / 2));
    ch = Math.max(1, Math.ceil(ch / 2));
    const c = chain[i] || (chain[i] = document.createElement('canvas'));
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const x = c.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, cw, ch);
    x.imageSmoothingEnabled = true;
    x.drawImage(cur, 0, 0, cw, ch);
    cur = c;
  }
  const x = cur.getContext('2d');
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#3A2C1C';
  x.fillRect(0, 0, cw, ch);
  x.globalCompositeOperation = 'source-over';
  g.save();
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, dx, dy, w, h);
  g.restore();
}

// 弹簧：针尖、针头都用它追目标
function spring(p, tx, ty, k, d, dt) {
  const sub = 4, h = dt / sub;
  for (let i = 0; i < sub; i++) {
    p.vx += (k * (tx - p.x) - d * p.vx) * h;
    p.vy += (k * (ty - p.y) - d * p.vy) * h;
    p.x += p.vx * h;
    p.y += p.vy * h;
  }
  return Math.hypot(p.vx, p.vy) > 3 || Math.hypot(tx - p.x, ty - p.y) > .4;
}

const angDiff = (a, b) => {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};

window.HO = {
  clamp, lerp, ease, hash, rng, vnoise, bez, slice, segDist, polyDist, angDiff, spring,
  PAL, yarn, fray, floatShadow, store, sound, audio, paper,
  get muted() { return muted; },
  set muted(v) { muted = !!v; store.set('hands-on.mute', muted); },
  games: {},
  mode: window.matchMedia && matchMedia('(pointer: coarse)').matches ? 'touch' : 'keys',
};

})();
