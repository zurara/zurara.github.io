/* 有手就行 · 刺绣
 * 线刺在布上：斜针、十字针、人字针、方格针，由下往上长。一根缝针带着线走。
 * 织好的线只画一次进离屏缓存；每帧只重画：缓存贴图 + 正在走的那一针 + 线 + 针。
 * 拆：抓住针往外拖，拖多远拆多少，一段一段拆回去；整块拆光就换一块新布重来。
 */
(() => {
'use strict';
const { clamp, lerp, ease, hash, rng, vnoise, bez, slice, segDist, angDiff, spring, PAL, yarn, fray, store, sound } = HO;

// ───────────────────────── 配置 ─────────────────────────

const COLS = 10;          // 一排多少格
const CM_PER_ROW = 0.8;   // 一排算多长
const SAVE_KEY = 'hands-on.embroidery';

// strokes：一格里的几段线（格内 0..1 坐标，x0,y0 → x1,y1）。
// keys：键盘一键走一段；swipes：手机一划走两段，划的方向就是线的方向。
const STITCHES = [
  { name: { zh: '斜针', en: 'Slant stitch' }, unlock: 0,
    strokes: [[.03, .94, .47, .06], [.53, .94, .97, .06]],
    keys: [['F', [0]], ['J', [1]]],
    swipes: [['NE', [0, 1]]],
    notes: [0, 7] },
  { name: { zh: '十字针', en: 'Cross stitch' }, unlock: 3,
    strokes: [[0, .94, .5, .06], [.5, .94, 1, .06], [.5, .94, 0, .06], [1, .94, .5, .06]],
    keys: [['F', [0]], ['D', [1]], ['J', [2]], ['K', [3]]],
    swipes: [['NE', [0, 1]], ['NW', [2, 3]]],
    notes: [0, 4, 7, 12] },
  { name: { zh: '人字针', en: 'Herringbone' }, unlock: 8,
    strokes: [[0, .5, .5, .07], [.5, .07, 1, .5], [0, .95, .5, .52], [.5, .52, 1, .95]],
    keys: [['F', [0]], ['J', [1]], ['D', [2]], ['K', [3]]],
    swipes: [['NE', [0, 2]], ['SE', [1, 3]]],
    notes: [7, 12, 4, 9] },
  { name: { zh: '方格针', en: 'Lattice' }, unlock: 14,
    strokes: [[0, .3, 1, .3], [0, .72, 1, .72], [.27, .96, .27, .04], [.75, .96, .75, .04]],
    keys: [['D', [0]], ['F', [1]], ['J', [2]], ['K', [3]]],
    swipes: [['E', [0, 1]], ['N', [2, 3]]],
    notes: [0, 2, 9, 7] },
];

const DIR_DEG = { E: 0, SE: 45, NE: -45, N: -90, NW: -135 };
const order = si => STITCHES[si].keys.flatMap(([, ks]) => ks);   // 一格里各段线的先后

// ───────────────────────── 状态 ─────────────────────────

// row/col：正在绣的格；mask：这一格已经走了哪几段。每排用哪种针法由 seed 决定（拆了重绣还是同一种）。
let S = { seed: 1, row: 0, col: 0, mask: 0 };

function fresh() {
  return { seed: (Math.random() * 0xFFFFFFFF) >>> 0 || 1, row: 0, col: 0, mask: 0 };
}

function load() {
  let d = store.get(SAVE_KEY);
  if (!d) {
    // 旧版「钩针围巾」的存档：同一个 seed 重放出来的针法顺序完全一样，直接接着绣
    const old = store.get('weave.v1');
    if (old && typeof old.st === 'string') d = old;
  }
  if (d && Number.isFinite(d.row) && d.row >= 0) {
    const s = { seed: d.seed >>> 0 || 1, row: d.row | 0, col: clamp(d.col | 0, 0, COLS - 1), mask: d.mask | 0 };
    return s;
  }
  return fresh();
}

function save() {
  store.set(SAVE_KEY, { seed: S.seed, row: S.row, col: S.col, mask: S.mask });
}

let memo = { seed: null, st: [0], band: 0 };
function stOf(r) {
  if (memo.seed !== S.seed) memo = { seed: S.seed, st: [0], band: 0 };
  while (memo.st.length <= r) {
    const row = memo.st.length, prev = memo.st[row - 1];
    const nu = STITCHES.findIndex(s => s.unlock === row);
    let v;
    if (nu > 0) { memo.band = 2; v = nu; }
    else if (memo.band > 0) { memo.band--; v = prev; }
    else {
      const opts = STITCHES.map((s, i) => i).filter(i => STITCHES[i].unlock <= row && i !== prev);
      if (!opts.length) v = prev;
      else {
        memo.band = 1 + Math.floor(hash(row, 5, S.seed) * 3);
        v = opts[Math.floor(hash(row, 9, S.seed) * opts.length)];
      }
    }
    memo.st.push(v);
  }
  return memo.st[r];
}

const full = si => (1 << STITCHES[si].strokes.length) - 1;

// 两色由低频噪声决定，会自然长出一块一块的色斑
function colorAt(r, c) {
  return vnoise(c / 3.2 + 11.3, r / 2.4 + 5.7, S.seed) > 0.56 ? 1 : 0;
}

// ───────────────────────── 布局与缓存 ─────────────────────────

let L = null;
let cache = document.createElement('canvas'), cctx = cache.getContext('2d');
let back = document.createElement('canvas'), bctx = back.getContext('2d');
let topRow = 0;   // 缓存第一行对应的排号

function seedOf(r, c, k) {
  return (Math.imul(r + 1, 73856093) ^ Math.imul(c + 1, 19349663) ^ Math.imul(k + 1, 83492791) ^ S.seed) >>> 0;
}

// 某一段线的路径：相对于（织物左边，这一排的上沿）
function geom(r, c, k) {
  const s = STITCHES[stOf(r)].strokes[k];
  const cell = L.cell, j = cell * .035, gy = (L.rowH - cell) / 2;
  const jit = n => (hash(r * 131 + c, k * 7 + n, S.seed) - .5) * 2 * j;
  const x0 = (c + s[0]) * cell + jit(1), y0 = gy + s[1] * cell + jit(2);
  const x1 = (c + s[2]) * cell + jit(3), y1 = gy + s[3] * cell + jit(4);
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const bow = jit(5) * 1.3;
  const mx = (x0 + x1) / 2 - dy / len * bow, my = (y0 + y1) / 2 + dx / len * bow;
  const n = 6, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * x0 + 2 * u * t * mx + t * t * x1, u * u * y0 + 2 * u * t * my + t * t * y1]);
  }
  return pts;
}

function paintStroke(ctx, ox, oy, r, c, k, t = 1) {
  ctx.save();
  ctx.translate(ox, oy);
  yarn(ctx, slice(geom(r, c, k), t), L.w, PAL[colorAt(r, c)], seedOf(r, c, k));
  ctx.restore();
}

const hasTail = (r, side) => hash(r, 40 + side, S.seed) < (side ? .42 : .3);

// 排两头偶尔留出来的线头
function paintTail(ctx, ox, oy, r, side) {
  const cell = L.cell, d = side ? 1 : -1, c = side ? COLS - 1 : 0;
  const pal = PAL[colorAt(r, c)], rr = rng(seedOf(r, 90 + side, 3));
  const x = ox + (side ? L.fw : 0) - d * cell * .12, y = oy + L.rowH * (.3 + rr() * .4);
  const ex = x + d * cell * (.75 + rr() * .7), ey = y + (rr() - .5) * cell * 1.1;
  const pts = bez([x, y], [x + d * cell * .4, y + (rr() - .5) * cell * .6],
    [ex - d * cell * .3, ey + (rr() - .5) * cell * .7], [ex, ey], 10);
  yarn(ctx, pts, L.w * .9, pal, seedOf(r, 95 + side, 4));
  const a = pts[pts.length - 2];
  fray(ctx, ex, ey, Math.atan2(ey - a[1], ex - a[0]), L.w, pal, rr);
}

// 第一排上沿的流苏：每格一个结、三根须
function paintFringe(ctx, ox, oy) {
  const cell = L.cell;
  for (let c = 0; c < COLS; c++) {
    const pal = PAL[colorAt(0, c)], rr = rng(seedOf(-1, c, 9));
    const cx = ox + (c + .5) * cell, ky = oy + cell * .02;
    for (let j = -1; j <= 1; j++) {
      const ex = cx + j * cell * .27 + (rr() - .5) * cell * .16, ey = oy - cell * (1.0 + rr() * .5);
      const pts = bez([cx + j * cell * .05, ky], [cx + j * cell * .14, oy - cell * .45],
        [ex + (rr() - .5) * cell * .24, ey + cell * .35], [ex, ey], 9);
      yarn(ctx, pts, L.w * .85, pal, seedOf(-1, c, 20 + j));
      const a = pts[pts.length - 2];
      fray(ctx, ex, ey, Math.atan2(ey - a[1], ex - a[0]), L.w * .8, pal, rr);
    }
    yarn(ctx, [[cx - cell * .2, ky + cell * .03], [cx + cell * .2, ky - cell * .03]], L.w, pal, seedOf(-1, c, 30));
  }
}

const cacheY = r => (r - topRow) * L.rowH;

function paintRowAt(ctx, ox, oy, r) {
  if (r === 0) paintFringe(ctx, ox, oy);
  if (hasTail(r, 0)) paintTail(ctx, ox, oy, r, 0);
  const si = stOf(r), n = STITCHES[si].strokes.length;
  for (let c = 0; c < COLS; c++) {
    const done = r < S.row || c < S.col;
    if (!done && c > S.col) break;
    for (let k = 0; k < n; k++) if (done || (S.mask >> k & 1)) paintStroke(ctx, ox, oy, r, c, k);
  }
  if (r < S.row && hasTail(r, 1)) paintTail(ctx, ox, oy, r, 1);
}

const paintRow = r => paintRowAt(cctx, L.padX, cacheY(r), r);

function rebuild() {
  for (const cvs of [cache, back]) {
    cvs.width = Math.round((L.fw + 2 * L.padX) * L.dpr);
    cvs.height = L.vis * L.rowHpx;
  }
  cctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  bctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  topRow = S.row - (L.vis - 2);
  for (let r = Math.max(0, topRow - 2); r <= S.row; r++) paintRow(r);
}

// 只重画某一排那一条：拆线时用，比整张重画便宜得多
function repaintBand(r) {
  const y = cacheY(r), w = cache.width / L.dpr;
  cctx.save();
  cctx.beginPath();
  cctx.rect(0, y, w, L.rowH);
  cctx.clip();
  cctx.clearRect(0, y, w, L.rowH);
  for (let rr = Math.max(0, r - 1); rr <= Math.min(S.row, r + 1); rr++) paintRow(rr);
  cctx.restore();
}

// 换排：缓存整体上移一排（整数像素，不会越移越糊）
function feed() {
  topRow++;
  bctx.save();
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, back.width, back.height);
  bctx.drawImage(cache, 0, -L.rowHpx);
  bctx.restore();
  [cache, back] = [back, cache];
  [cctx, bctx] = [bctx, cctx];
}

function layout(V) {
  const avail = V.bottom - V.top;
  const fwMax = Math.min(V.W * .78, 440, avail * .95);
  const cell = Math.floor(fwMax / COLS * V.dpr) / V.dpr;
  const rowHpx = Math.round(cell * 1.05 * V.dpr);
  L = {
    W: V.W, H: V.H, dpr: V.dpr, cell, rowHpx, rowH: rowHpx / V.dpr,
    fw: cell * COLS,
    x0: Math.round((V.W - cell * COLS) / 2),
    baseY: Math.round(V.top + avail * .6),
    padX: Math.ceil(cell * 1.9),
    w: cell * .16,
  };
  L.vis = Math.ceil(L.baseY / L.rowH) + 3;
  rebuild();
  const p = rest();
  Object.assign(tip, { x: p.x, y: p.y, vx: 0, vy: 0 });
}

// ───────────────────────── 动画 ─────────────────────────

let anims = [];        // 正在走的线段 {r,c,k,t0,dur} 或排尾线头 {tail:true,r,t0,dur:0}
let lastQ = 0;         // 上一段排到的开始时间
let scroll = 0;        // 换排时织物上移的余量（px）
let pull = null;       // 正在拽针拆线 {x,y,ox,oy,px,py,acc,done}
const tip = { x: 0, y: 0, vx: 0, vy: 0 };

const rowTop = r => L.baseY - (S.row - r) * L.rowH + scroll;

function expected(m) {
  const st = STITCHES[stOf(S.row)];
  return (m === 'keys' ? st.keys : st.swipes).find(([, ks]) => ks.some(k => !(S.mask >> k & 1)));
}

// 针不动的时候停在下一段线的起点
function rest() {
  const e = expected('keys');
  const p = geom(S.row, S.col, e ? e[1][0] : 0)[0];
  return { x: L.x0 + p[0] + L.cell * .04, y: rowTop(S.row) + p[1] + L.cell * .04 };
}

function queueStroke(r, c, k) {
  const now = performance.now();
  // 手快的时候排队的线段会变多：缩短间隔和时长，让针追上手
  const busy = anims.length > 3;
  const t0 = Math.max(now, lastQ + (busy ? 26 : 60));
  lastQ = t0;
  anims.push({ r, c, k, t0, dur: busy ? 90 : 140 });
  const st = STITCHES[stOf(r)];
  sound.tick(st.notes[k] + (colorAt(r, c) ? 5 : 0), (t0 - now) / 1000);
}

function bake(a) {
  if (a.r < topRow - 2) return;
  if (a.tail) paintTail(cctx, L.padX, cacheY(a.r), a.r, 1);
  else paintStroke(cctx, L.padX, cacheY(a.r), a.r, a.c, a.k);
}

function update(dt, now) {
  // 走完的线段按顺序落进缓存
  while (anims.length && now >= anims[0].t0 + (anims[0].dur || 0)) bake(anims.shift());

  let tgt = null, follow = false;
  if (pull) {
    tgt = { x: pull.x - pull.ox, y: pull.y - pull.oy };
    follow = true;
  } else {
    const cur = anims.find(a => !a.tail);
    if (cur && now >= cur.t0) {
      const p = slice(geom(cur.r, cur.c, cur.k), ease((now - cur.t0) / cur.dur)).pop();
      tgt = { x: L.x0 + p[0], y: rowTop(cur.r) + p[1] };
      follow = true;
    }
  }
  if (!tgt) tgt = rest();

  scroll *= Math.exp(-dt * 13);
  if (Math.abs(scroll) < .25) scroll = 0;

  const moving = spring(tip, tgt.x, tgt.y, follow ? 2400 : 320, follow ? 84 : 27, dt);
  return moving || anims.length > 0 || scroll !== 0 || !!pull;
}

// ───────────────────────── 每帧绘制 ─────────────────────────

// 缝针：针尖在 tip，针身朝右上，针尾有针眼
function needle() {
  const len = L.cell * 4.4;
  let dx = .6 + clamp(-tip.vx * .00028, -.18, .18), dy = -.8 + clamp(-tip.vy * .00018, -.12, .12);
  const dl = Math.hypot(dx, dy);
  dx /= dl; dy /= dl;
  return { x: tip.x, y: tip.y, dx, dy, len, ex: tip.x + dx * len, ey: tip.y + dy * len };
}

function drawNeedle(g, n) {
  const sw = Math.max(2.4, L.cell * .085), nx = -n.dy, ny = n.dx;
  const P = f => [n.x + n.dx * n.len * f, n.y + n.dy * n.len * f];
  const shape = (ox, oy) => {
    const [ax, ay] = P(.24), [bx, by] = P(1);
    g.beginPath();
    g.moveTo(n.x + ox, n.y + oy);
    g.lineTo(ax + nx * sw / 2 + ox, ay + ny * sw / 2 + oy);
    g.lineTo(bx + nx * sw / 2 + ox, by + ny * sw / 2 + oy);
    g.arc(bx + ox, by + oy, sw / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
    g.lineTo(ax - nx * sw / 2 + ox, ay - ny * sw / 2 + oy);
    g.closePath();
  };
  // 投影
  shape(sw * .9, sw * 1.7);
  g.fillStyle = 'rgba(60,45,30,.15)';
  g.fill();
  // 本体
  shape(0, 0);
  g.fillStyle = '#CDD2D8';
  g.fill();
  g.strokeStyle = '#6C737D';
  g.lineWidth = 1;
  g.stroke();
  // 高光
  const [h0x, h0y] = P(.2), [h1x, h1y] = P(.8);
  g.strokeStyle = 'rgba(255,255,255,.85)';
  g.lineWidth = sw * .24;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(h0x + nx * sw * .18, h0y + ny * sw * .18);
  g.lineTo(h1x + nx * sw * .18, h1y + ny * sw * .18);
  g.stroke();
  // 针眼
  const [e0x, e0y] = P(.84), [e1x, e1y] = P(.95);
  g.strokeStyle = '#6C737D';
  g.lineWidth = sw * .5;
  g.beginPath(); g.moveTo(e0x, e0y); g.lineTo(e1x, e1y); g.stroke();
  g.strokeStyle = '#F6F4EF';
  g.lineWidth = sw * .26;
  g.beginPath(); g.moveTo(e0x, e0y); g.lineTo(e1x, e1y); g.stroke();
  return P(.9);
}

// 最后一段走完的线的末端（线从这里出布、穿进针眼）
function anchor() {
  if (anims.length) return null;
  let r = S.row, c = S.col, k = -1;
  const ord = order(stOf(r));
  if (S.mask) {
    for (let j = ord.length - 1; j >= 0; j--) if (S.mask >> ord[j] & 1) { k = ord[j]; break; }
  } else if (c > 0) {
    c--; k = ord[ord.length - 1];
  } else if (r > 0) {
    r--; c = COLS - 1;
    const o2 = order(stOf(r));
    k = o2[o2.length - 1];
  } else return null;
  const p = geom(r, c, k).pop();
  return { x: L.x0 + p[0], y: rowTop(r) + p[1] };
}

function drawThread(g, eye) {
  const pal = PAL[colorAt(S.row, Math.min(S.col, COLS - 1))], cell = L.cell;
  const a = anchor();
  if (a) {
    const sag = pull ? .12 : 1;
    const my = Math.max(a.y, eye[1]) + cell * .9 * sag;
    const pts = bez([a.x, a.y], [lerp(a.x, eye[0], .25), lerp(a.y, my, .9)],
      [lerp(eye[0], a.x, .25), lerp(eye[1], my, .9)], eye, 16);
    yarn(g, pts, L.w * .8, pal, 7);
  }
  // 穿过针眼后垂下来的一小段线尾
  const [x, y] = eye;
  const tl = bez([x, y], [x + cell * .45, y - cell * .1], [x + cell * .95, y + cell * .7], [x + cell * .8, y + cell * 1.5], 12);
  yarn(g, tl, L.w * .8, pal, 8);
  const b = tl[tl.length - 2];
  fray(g, x + cell * .8, y + cell * 1.5, Math.atan2(y + cell * 1.5 - b[1], x + cell * .8 - b[0]), L.w * .8, pal, rng(11));
}

function draw(g, now) {
  g.drawImage(cache, L.x0 - L.padX, L.baseY - (L.vis - 2) * L.rowH + scroll,
    cache.width / L.dpr, cache.height / L.dpr);

  for (const a of anims) {
    if (a.tail || now < a.t0) continue;
    paintStroke(g, L.x0, rowTop(a.r), a.r, a.c, a.k, ease((now - a.t0) / a.dur));
  }

  const n = needle();
  const eye = drawNeedle(g, n);
  drawThread(g, eye);
}

// ───────────────────────── 游戏逻辑 ─────────────────────────

function doStep(ks) {
  const si = stOf(S.row);
  for (const k of ks) {
    if (S.mask >> k & 1) continue;
    S.mask |= 1 << k;
    queueStroke(S.row, S.col, k);
  }
  if (S.mask === full(si)) {
    S.mask = 0;
    S.col++;
    if (S.col === COLS) rowDone();
  }
  save();
}

function rowDone() {
  const r = S.row;
  if (hasTail(r, 1)) anims.push({ tail: true, r, t0: lastQ + 140, dur: 0 });
  S.row++;
  S.col = 0;
  scroll += L.rowH;
  feed();
  if (hasTail(S.row, 0)) paintTail(cctx, L.padX, cacheY(S.row), S.row, 0);
  sound.ding();
  const st = STITCHES[stOf(S.row)];
  if (st.unlock === S.row && S.row > 0) {
    sound.fanfare();
    HO.app.toast('newStitch', st.name);
  }
}

function miss() {
  sound.thud();
  tip.vx += (Math.random() - .5) * 260;
  tip.vy += 120;
}

// 拆一段：倒着走回去。返回 false 表示已经拆光
function unstep() {
  const si = stOf(S.row), ord = order(si);
  if (S.mask) {
    for (let j = ord.length - 1; j >= 0; j--) {
      if (S.mask >> ord[j] & 1) { S.mask &= ~(1 << ord[j]); break; }
    }
    repaintBand(S.row);
  } else if (S.col > 0) {
    S.col--;
    S.mask = full(si) & ~(1 << ord[ord.length - 1]);
    repaintBand(S.row);
  } else if (S.row > 0) {
    S.row--;
    S.col = COLS - 1;
    const s2 = stOf(S.row), o2 = order(s2);
    S.mask = full(s2) & ~(1 << o2[o2.length - 1]);
    scroll -= L.rowH;
    rebuild();
  } else return false;
  return true;
}

// ───────────────────────── 对外 ─────────────────────────

HO.games.embroidery = {
  id: 'embroidery',
  no: '01',
  name: { zh: '刺绣', en: 'Embroidery' },
  verb: 'stitch',
  keys: 'FJDK',

  enter() { S = load(); anims = []; pull = null; scroll = 0; },
  layout,
  update,
  draw,

  key(K) {
    const e = expected('keys');
    if (e && e[0] === K) { doStep(e[1]); return true; }
    miss();
    return false;
  },

  // 返回是否走了一步；quiet：同一划里的回程方向不算错
  swipe(ang, quiet) {
    const e = expected('touch');
    if (e && angDiff(ang, DIR_DEG[e[0]] * Math.PI / 180) <= .92) { doStep(e[1]); return true; }
    if (!quiet) miss();
    return false;
  },

  // 抓针：只有按在针（或针眼那段线）上才算拆线，别处的滑动照常是绣
  grab(x, y) {
    // 只认针眼那半截：针尖压在正在绣的格子上，从那里起手的滑动还是算绣
    const n = needle(), f = n.len * .45;
    return segDist(x, y, n.x + n.dx * f, n.y + n.dy * f, n.ex + n.dx * L.cell * .5, n.ey + n.dy * L.cell * .5) < Math.max(22, L.cell * .7);
  },
  pullStart(x, y) {
    while (anims.length) bake(anims.shift());
    pull = { x, y, ox: x - tip.x, oy: y - tip.y, px: x, py: y, acc: 0, done: false };
  },
  pullMove(x, y) {
    if (!pull) return false;
    pull.acc += Math.hypot(x - pull.px, y - pull.py);
    pull.px = pull.x = x;
    pull.py = pull.y = y;
    const step = L.cell * .5;
    let changed = false;
    while (!pull.done && pull.acc >= step) {
      pull.acc -= step;
      if (!unstep()) {
        // 整块拆光：换一块新布，重新来过
        S = fresh();
        rebuild();
        pull.done = true;
        HO.app.toast('fresh');
        sound.ding();
      } else sound.rip();
      changed = true;
    }
    if (changed) save();
    return changed;
  },
  pullEnd() { pull = null; },
  hoverGrab(x, y) { return L && this.grab(x, y); },

  hud(mode) {
    const st = STITCHES[stOf(S.row)];
    const steps = mode === 'keys' ? st.keys : st.swipes, e = expected(mode);
    const nx = STITCHES.find(s => s.unlock > S.row);
    let seen = false;
    return {
      len: ((S.row + S.col / COLS) * CM_PER_ROW).toFixed(1),
      next: nx ? { n: nx.unlock - S.row, name: nx.name } : null,
      row: S.row + 1,
      name: [st.name],
      steps: steps.map(s => {
        const isNext = s === e;
        if (isNext) seen = true;
        return { face: s[0], arrow: mode === 'keys' ? null : DIR_DEG[s[0]], state: isNext ? 'next' : seen ? '' : 'done' };
      }),
      red: colorAt(S.row, Math.min(S.col, COLS - 1)) === 1,
      tip: S.row < 2 ? mode : S.row < 6 ? 'pullNeedle' : null,
    };
  },

  savedLen() {
    const keep = S;
    S = load();
    const v = (S.row + S.col / COLS) * CM_PER_ROW;
    S = keep;
    return v;
  },

  // 首页工作桌上的小布样：固定一块好看的样子，四种针法各两排
  preview(ctx, w, h) {
    const keepS = S, keepL = L, keepMemo = memo;
    S = { seed: 1234, row: 8, col: 0, mask: 0 };
    memo = { seed: S.seed, st: [0, 0, 1, 1, 2, 2, 3, 3], band: 0 };
    const cell = Math.floor(w * .7 / COLS);
    L = { cell, rowH: cell * 1.05, w: cell * .16, fw: cell * COLS, dpr: 1 };
    const ox = Math.round((w - L.fw) / 2), oy = Math.round((h - 8 * L.rowH) / 2 + cell * .5);
    for (let r = 0; r < 8; r++) paintRowAt(ctx, ox, oy + r * L.rowH, r);
    // 一根针斜插在右上角
    Object.assign(tip, { x: ox + L.fw - cell * .6, y: oy + cell * 1.4, vx: 0, vy: 0 });
    const n = needle();
    const eye = drawNeedle(ctx, n);
    const pal = PAL[0], [x, y] = eye;
    const tl = bez([x, y], [x + cell * .4, y - cell * .2], [x + cell * .9, y + cell * .6], [x + cell * .7, y + cell * 1.4], 10);
    yarn(ctx, tl, L.w * .8, pal, 8);
    S = keepS; L = keepL; memo = keepMemo;
  },
};

})();
