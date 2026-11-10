/* 有手就行 · 棒针围巾
 * 两根木棒针横在上面，围巾挂在针下往下垂、越织越长。只有针在动，不出现手。
 * 一针四个动作：入针、绕线、带出、脱圈。线圈从左针一个个移到右针（从右往左织）；
 * 一排织完把活翻面，满的那根针换到左手——这就是打字机的换行。
 * 正面看：下针是 V，上针是一道横向的小凸起。针法 = 每一格从正面看是 V 还是凸起。
 */
(() => {
'use strict';
const { clamp, lerp, ease, hash, rng, bez, slice, polyDist, angDiff, spring, PAL, yarn, fray, floatShadow, store, sound } = HO;

// 围巾是悬空挂着的：线和线之间只留一点点贴身的影子（看得出谁压着谁），
// 真正的影子是整件东西落在纸上的那一层——离得远、很软、很淡（见 draw）。
const CONTACT = .06;
const yn = (g, pts, w, pal, seed) => yarn(g, pts, w, pal, seed, CONTACT);
const FLOAT = { dx: .35, dy: 1.4, alpha: .12 };   // 影子错开多少（按针宽算）、多深
const MARGIN = 80;   // 离屏画布四边多画一圈，画面外的针和线也有影子，屏幕边上不会切出一条硬边

// ───────────────────────── 配置 ─────────────────────────

const COLS = 10;
const CM_PER_ROW = 0.9;
const SAVE_KEY = 'hands-on.knitting';
const KN = 0, PU = 1;                 // 下针 / 上针
const inv = x => 1 - x;
const SLOPE = Math.tan(3.5 * Math.PI / 180);   // 两根针都是针尖略低

// front(r, c)：第 r 排第 c 列（c 按正面从左往右数）从正面看是 V（KN）还是凸起（PU）
// 不翻面：永远从正面、从右往左织（像环形针织圈），所以看到什么就是织什么。
const PATTERNS = [
  { name: { zh: '平针', en: 'Stockinette' }, unlock: 0, front: () => KN },
  { name: { zh: '起伏针', en: 'Garter stitch' }, unlock: 4, front: r => r % 2 ? PU : KN },
  { name: { zh: '罗纹针', en: 'Rib' }, unlock: 10, front: (r, c) => c % 2 ? PU : KN },
  { name: { zh: '桂花针', en: 'Seed stitch' }, unlock: 18, front: (r, c) => (r + c) % 2 ? PU : KN },
];

// 一针的四个动作。键盘一键一个；手机一划两个。上针是下针的镜像：先右手。
const MOVES = [
  { name: { zh: '下针', en: 'Knit' },
    keys: [['F', [0]], ['J', [1]], ['D', [2]], ['K', [3]]],
    swipes: [['S', [0, 1]], ['N', [2, 3]]],
    notes: [0, 4, 7, 12] },
  { name: { zh: '上针', en: 'Purl' },
    keys: [['J', [0]], ['F', [1]], ['K', [2]], ['D', [3]]],
    swipes: [['W', [0, 1]], ['E', [2, 3]]],
    notes: [12, 7, 4, 0] },
];
const ACTS = [{ zh: '入针', en: 'in' }, { zh: '绕线', en: 'around' }, { zh: '带出', en: 'through' }, { zh: '脱圈', en: 'off' }];
const DIR_DEG = { E: 0, S: 90, N: -90, W: 180 };

// ───────────────────────── 状态 ─────────────────────────

// row：正在织第几排（-1 是起针那排）；col：这一排织了几针；phase：这一针做到第几个动作
let S = { seed: 1, row: 0, col: 0, phase: 0 };

function fresh() {
  return { seed: (Math.random() * 0xFFFFFFFF) >>> 0 || 1, row: 0, col: 0, phase: 0 };
}

function load() {
  const d = store.get(SAVE_KEY);
  if (d && Number.isFinite(d.row) && d.row >= 0) {
    return { seed: d.seed >>> 0 || 1, row: d.row | 0, col: clamp(d.col | 0, 0, COLS - 1), phase: clamp(d.phase | 0, 0, 3) };
  }
  return fresh();
}

function save() {
  store.set(SAVE_KEY, { seed: S.seed, row: S.row, col: S.col, phase: S.phase });
}

// 每排的针法、颜色都由 seed 决定：拆了重织还是一样
let memo = null;
function sync() {
  if (!memo || memo.seed !== S.seed) memo = { seed: S.seed, pat: [0], band: 0, col: [], stripe: 0, cur: 1 };
}

function patOf(r) {
  sync();
  r = Math.max(0, r);
  while (memo.pat.length <= r) {
    const row = memo.pat.length, prev = memo.pat[row - 1];
    const nu = PATTERNS.findIndex(p => p.unlock === row);
    let v;
    if (nu > 0) { memo.band = 5; v = nu; }
    else if (memo.band > 0) { memo.band--; v = prev; }
    else {
      const opts = PATTERNS.map((p, i) => i).filter(i => PATTERNS[i].unlock <= row && i !== prev);
      if (!opts.length) v = prev;
      else {
        memo.band = 3 + 2 * Math.floor(hash(row, 5, S.seed) * 3);
        v = opts[Math.floor(hash(row, 9, S.seed) * opts.length)];
      }
    }
    memo.pat.push(v);
  }
  return memo.pat[r];
}

// 颜色按排换：蓝色宽条，红色窄条，像真的换线织条纹
function colOf(r) {
  sync();
  r = Math.max(0, r);
  while (memo.col.length <= r) {
    const row = memo.col.length;
    if (memo.stripe <= 0) {
      memo.cur = row === 0 ? 0 : 1 - memo.cur;
      memo.stripe = memo.cur ? 1 + Math.floor(hash(row, 13, S.seed) * 3) : 3 + Math.floor(hash(row, 13, S.seed) * 6);
    }
    memo.stripe--;
    memo.col.push(memo.cur);
  }
  return memo.col[r];
}

const front = (r, c) => PATTERNS[patOf(r)].front(r, c);
const view = () => 0;                                   // 不翻面：永远看正面
const cIdx = (r, i) => COLS - 1 - i;                    // 第 i 针在第几列：从右往左
const screenCol = (c, v) => v ? COLS - 1 - c : c;
const moveOf = (r, i) => front(r, cIdx(r, i));
const curMove = () => moveOf(S.row, S.col);

// ───────────────────────── 布局与缓存 ─────────────────────────

let L = null;
const cache = document.createElement('canvas'), cctx = cache.getContext('2d');
const scn = document.createElement('canvas'), nctx = scn.getContext('2d');   // 每帧先画到这里，好垫影子
let cRow = 0;   // 缓存画的时候 S.row 是多少

function seedOf(r, c, k) {
  return (Math.imul(r + 2, 73856093) ^ Math.imul(c + 1, 19349663) ^ Math.imul(k + 1, 83492791) ^ S.seed) >>> 0;
}

/* 一针的身子。ox,oy：这一排格子的左上角（屏幕列已经算进 x 里）。
 * V：两条腿从上面两角往下收到底部中间；凸起：一道横跨整格的拱，下面一小段弧是下一圈的底。 */
function paintStitch(ctx, x, y, r, c, lk, t = 1) {
  const cw = L.cw, rh = L.rowH, pal = PAL[colOf(r)], sd = seedOf(r, c, 0);
  const j = n => (hash(r * 131 + c, n, S.seed) - .5) * cw * .06;
  if (lk === KN) {
    const bx = x + cw * .5 + j(1), by = y + rh * .98;
    const l = bez([x + cw * .2 + j(2), y - rh * .26], [x + cw * .02, y + rh * .3], [x + cw * .3, y + rh * .82], [bx, by], 9);
    const rr = bez([x + cw * .8 + j(3), y - rh * .26], [x + cw * .98, y + rh * .3], [x + cw * .7, y + rh * .82], [bx, by], 9);
    yn(ctx, slice(l, t), L.w, pal, sd);
    yn(ctx, slice(rr, t), L.w, pal, sd + 1);
  } else {
    const p = bez([x - cw * .04, y + rh * .7], [x + cw * .18, y - rh * .02 + j(4)], [x + cw * .82, y - rh * .02 + j(5)], [x + cw * 1.04, y + rh * .7], 11);
    const q = bez([x + cw * .14, y + rh * .66], [x + cw * .3, y + rh * 1.08], [x + cw * .7, y + rh * 1.08], [x + cw * .86, y + rh * .66], 8);
    yn(ctx, slice(q, t), L.w * .8, pal, sd + 2);
    yn(ctx, slice(p, t), L.w * 1.05, pal, sd);
  }
}

/* 起针那排：不是一针针缝上去的短线，而是围巾自己的布边——
 * 两股线拧成一条连续的绳，从头到尾不断；上面每一圈都挂在这条绳上。左端留一根起针线尾。 */
function paintCastOn(ctx, ox, oy, v) {
  const cw = L.cw, rh = L.rowH, pal = PAL[colOf(0)];
  const cy = oy + rh * .1, amp = rh * .13, per = 8, n = COLS * per;
  const strand = k => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = ox - cw * .08 + (L.fw + cw * .16) * i / n;
      pts.push([x, cy + Math.sin(i / per * Math.PI * 2 + k * Math.PI) * amp]);
    }
    return pts;
  };
  const sa = strand(0), b = strand(1);
  yn(ctx, b, L.w * .84, pal, seedOf(-1, 1, 1));
  yn(ctx, sa, L.w * .9, pal, seedOf(-1, 0, 1));
  // 两股互相压：每一列里有半段让 b 盖回 a 上面，看起来是拧在一起的
  for (let c = 0; c < COLS; c++) yn(ctx, b.slice(c * per + per / 2, c * per + per + 1), L.w * .84, pal, seedOf(-1, c, 3));
  const side = v ? 1 : -1, rr = rng(seedOf(-1, 0, 5));
  const x = ox + (v ? L.fw : 0) + side * cw * .08, y = cy;
  const ex = x + side * cw * .5, ey = y + cw * 2.6;
  const pts = bez([x, y], [x + side * cw * .5, y + cw * .4], [ex - side * cw * .2, ey - cw * 1.2], [ex, ey], 14);
  yn(ctx, pts, L.w * .8, pal, seedOf(-1, 9, 9));
  const a = pts[pts.length - 2];
  fray(ctx, ex, ey, Math.atan2(ey - a[1], ex - a[0]), L.w * .8, pal, rr);
}

// 换颜色的那一排，起头那边留一根旧线的线尾
function paintTail(ctx, ox, oy, r, v) {
  const c = cIdx(r, 0), s = screenCol(c, v), side = s === 0 ? -1 : 1;
  const pal = PAL[colOf(r - 1)], rr = rng(seedOf(r, 77, 1)), cw = L.cw;
  const x = ox + (side < 0 ? 0 : L.fw) - side * cw * .08, y = oy + L.rowH * .4;
  const ex = x + side * cw * (.8 + rr() * .6), ey = y + cw * (.5 + rr() * .7);
  const pts = bez([x, y], [x + side * cw * .4, y - cw * .1], [ex - side * cw * .3, ey - cw * .4], [ex, ey], 10);
  yn(ctx, pts, L.w * .75, pal, seedOf(r, 78, 2));
  const a = pts[pts.length - 2];
  fray(ctx, ex, ey, Math.atan2(ey - a[1], ex - a[0]), L.w * .75, pal, rr);
}

function paintRowAt(ctx, ox, oy, r, v) {
  if (r < 0) { paintCastOn(ctx, ox, oy, v); return; }
  const n = r < S.row ? COLS : S.col;
  if (n > 0 && r > 0 && colOf(r) !== colOf(r - 1)) paintTail(ctx, ox, oy, r, v);
  for (let i = 0; i < n; i++) {
    const c = cIdx(r, i), s = screenCol(c, v);
    paintStitch(ctx, ox + s * L.cw, oy, r, c, v ? inv(front(r, c)) : front(r, c));
  }
}

const cacheY = r => L.padTop + (cRow - r) * L.rowH;

function rebuild() {
  cRow = S.row;
  cache.width = Math.round((L.fw + 2 * L.padX) * L.dpr);
  cache.height = Math.round((L.padTop + (L.vis + 1) * L.rowH) * L.dpr);
  cctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  const v = view();
  for (let r = Math.max(-1, S.row - L.vis); r <= S.row; r++) paintRowAt(cctx, L.padX, cacheY(r), r, v);
  anims = [];
}

// 拆掉这一排最后一针：只重画最上面那条
function repaintTop() {
  const y = cacheY(S.row) + L.rowH, w = cache.width / L.dpr, v = view();
  cctx.save();
  cctx.beginPath();
  cctx.rect(0, 0, w, y);
  cctx.clip();
  cctx.clearRect(0, 0, w, y);
  for (let r = Math.max(-1, S.row - 1); r <= S.row; r++) paintRowAt(cctx, L.padX, cacheY(r), r, v);
  cctx.restore();
}

function layout(V) {
  const fwMax = Math.min(V.W * .72, 400, (V.bottom - V.top) * 1.1);
  const cw = Math.floor(fwMax / COLS * V.dpr) / V.dpr;
  const rowHpx = Math.round(cw * .8 * V.dpr);
  L = {
    W: V.W, H: V.H, dpr: V.dpr, cw, rowHpx, rowH: rowHpx / V.dpr,
    fw: cw * COLS,
    x0: Math.round((V.W - cw * COLS) / 2),
    needleY: Math.round(V.top + Math.max(26, cw * 1.05)),
    nr: Math.max(3.2, cw * .14),
    w: cw * .27,
    padX: Math.ceil(cw * 2),
    padTop: Math.ceil(cw * .7),
  };
  L.cx = L.x0 + L.fw / 2;
  L.bodyY = L.needleY + cw * .62;
  L.vis = Math.ceil((L.H - L.bodyY) / L.rowH) + 2;
  scn.width = Math.round((V.W + 2 * MARGIN) * V.dpr);
  scn.height = Math.round((V.H + 2 * MARGIN) * V.dpr);
  rebuild();
  jumpTips();
}

// ───────────────────────── 针 ─────────────────────────

const tipL = { x: 0, y: 0, vx: 0, vy: 0 }, tipR = { x: 0, y: 0, vx: 0, vy: 0 };
const yAtL = x => tipL.y - (tipL.x - x) * SLOPE;
const yAtR = x => tipR.y - (x - tipR.x) * SLOPE;

// 两根针尖该在哪：跟着「下一针」走，每个动作一个姿势
function targets() {
  const s = COLS - 1 - S.col, cw = L.cw, xs = L.x0 + s * cw, y = L.needleY;
  const purl = S.col < COLS && curMove() === PU;
  const l = { x: xs + cw * 1.28, y };
  let r;
  if (pull) r = { x: xs + cw * .66, y: y + cw * .08 };
  else switch (S.phase) {
    case 1: r = { x: xs + cw * .1, y: y + (purl ? -cw * .05 : cw * .16) }; break;    // 入针：穿进左针上那个线圈
    case 2: r = { x: xs + cw * .16, y: y + (purl ? -cw * .02 : cw * .13) }; break;   // 绕线
    case 3: r = { x: xs + cw * .8, y: y - cw * .07 }; break;                          // 带出
    default: r = { x: xs + cw * .66, y: y + cw * .08 };
  }
  return [l, r];
}

function jumpTips() {
  const [l, r] = targets();
  Object.assign(tipL, { x: l.x, y: l.y, vx: 0, vy: 0 });
  Object.assign(tipR, { x: r.x, y: r.y, vx: 0, vy: 0 });
}

// 木棒针：一头尖，一头圆珠。dir = -1 针身往左伸，+1 往右伸
function drawNeedle(g, t, dir) {
  const r = L.nr, len = L.fw + L.cw * 3.2;
  const ux = dir * Math.cos(Math.atan(SLOPE)), uy = -Math.sin(Math.atan(SLOPE));
  let nx = -uy, ny = ux;
  if (ny > 0) { nx = -nx; ny = -ny; }          // n 指向上方（受光面）
  const tl = r * 5.5;
  const ax = t.x + ux * tl, ay = t.y + uy * tl, ex = t.x + ux * len, ey = t.y + uy * len;
  const shape = (ox, oy) => {
    g.beginPath();
    g.moveTo(t.x + ox, t.y + oy);
    g.quadraticCurveTo(t.x + ux * tl * .45 + nx * r * .7 + ox, t.y + uy * tl * .45 + ny * r * .7 + oy, ax + nx * r + ox, ay + ny * r + oy);
    g.lineTo(ex + nx * r + ox, ey + ny * r + oy);
    g.lineTo(ex - nx * r + ox, ey - ny * r + oy);
    g.lineTo(ax - nx * r + ox, ay - ny * r + oy);
    g.quadraticCurveTo(t.x + ux * tl * .45 - nx * r * .7 + ox, t.y + uy * tl * .45 - ny * r * .7 + oy, t.x + ox, t.y + oy);
    g.closePath();
  };
  // 木头（影子不在这里画：整件东西一起落一个悬空的影子）
  const gr = g.createLinearGradient(ax + nx * r, ay + ny * r, ax - nx * r, ay - ny * r);
  gr.addColorStop(0, '#F0D7AE');
  gr.addColorStop(.35, '#D6A86E');
  gr.addColorStop(1, '#9A6A3A');
  shape(0, 0);
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(110,72,36,.55)';
  g.lineWidth = .8;
  g.stroke();
  // 木纹
  const rr = rng(dir > 0 ? 31 : 32);
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const off = (rr() - .5) * r * 1.2, f0 = .08 + rr() * .5, f1 = f0 + .15 + rr() * .3;
    g.strokeStyle = `rgba(120,80,40,${.18 + rr() * .2})`;
    g.lineWidth = .6 + rr() * .5;
    g.beginPath();
    g.moveTo(t.x + ux * len * f0 + nx * off, t.y + uy * len * f0 + ny * off);
    g.lineTo(t.x + ux * len * f1 + nx * off * .9, t.y + uy * len * f1 + ny * off * .9);
    g.stroke();
  }
  // 高光
  g.strokeStyle = 'rgba(255,248,232,.7)';
  g.lineWidth = r * .32;
  g.beginPath();
  g.moveTo(ax + nx * r * .45, ay + ny * r * .45);
  g.lineTo(ex + nx * r * .45, ey + ny * r * .45);
  g.stroke();
  // 针尾圆珠
  const kx = ex + ux * r * 1.4, ky = ey + uy * r * 1.4;
  const kg = g.createRadialGradient(kx + nx * r * .7, ky + ny * r * .7, r * .2, kx, ky, r * 2);
  kg.addColorStop(0, '#F2DDB8');
  kg.addColorStop(1, '#94632F');
  g.fillStyle = kg;
  g.beginPath(); g.arc(kx, ky, r * 1.9, 0, Math.PI * 2); g.fill();
}

// 挂在针上的一个线圈：两只脚往下接到这一针的身子，顶上翻过针
function drawLoop(g, xc, footY, yN, pal, sd, spread = 1) {
  const cw = L.cw, hw = cw * .3 * spread;
  const top = yN - L.nr - L.w * .32;
  const cy = (top - .25 * footY) / .75;
  const pts = bez([xc - hw, footY], [xc - hw * 1.22, cy], [xc + hw * 1.22, cy], [xc + hw, footY], 14);
  yn(g, pts, L.w, pal, sd);
}

// ───────────────────────── 动画 ─────────────────────────

let anims = [];        // 刚织好、正在落下的针 {r, i, t0, dur}
let lift = 0;          // 换排时整片往下落一排的余量（px）：先画在原来的位置，再慢慢落下去
let pull = null;      // 正在扯线 {x, y, px, py, acc, done}
let yarnPath = [];     // 这一帧工作线的路径（抓线判定用）

function bakeAll() {
  const v = view();
  for (const a of anims) {
    if (a.r !== cRow) continue;
    const c = cIdx(a.r, a.i);
    paintStitch(cctx, L.padX + screenCol(c, v) * L.cw, cacheY(a.r), a.r, c, v ? inv(front(a.r, c)) : front(a.r, c));
  }
  anims = [];
}

function update(dt, now) {
  while (anims.length && now >= anims[0].t0 + anims[0].dur) {
    const a = anims.shift(), v = view(), c = cIdx(a.r, a.i);
    if (a.r === cRow) paintStitch(cctx, L.padX + screenCol(c, v) * L.cw, cacheY(a.r), a.r, c, v ? inv(front(a.r, c)) : front(a.r, c));
  }
  const [l, r] = targets();
  const m1 = spring(tipL, l.x, l.y, 520, 38, dt);
  const m2 = spring(tipR, r.x, r.y, 900, 50, dt);
  lift *= Math.exp(-dt * 11);
  if (Math.abs(lift) < .25) lift = 0;
  return m1 || m2 || anims.length > 0 || lift !== 0 || !!pull;
}

// ───────────────────────── 每帧绘制 ─────────────────────────

function drawScene(g, now) {
  const cw = L.cw, rh = L.rowH, v = view();
  const s = COLS - 1 - S.col;
  const palPrev = PAL[colOf(S.row - 1)], palCur = PAL[colOf(S.row)];
  const by = L.bodyY - lift;
  const footPrev = by + rh * .82, footCur = by - rh * .2;

  // 工作线：从最近织的那一针出来，在织物后面垂到右边画面外的线团。
  // 被扯着的时候、绕在针尖上的那一圈、新带出来的线圈在前面。
  const ac = S.col > 0 ? s + 1 : s;
  const ax = L.x0 + (ac + .78) * cw, ay = (S.col > 0 ? yAtR(ax) : yAtL(ax)) + L.nr * 1.2;
  const endX = L.W + 40, endY = L.needleY + cw * 5.5;
  let path, wrap = null, newLoop = null;
  if (pull) {
    const px = pull.x, py = pull.y;
    path = bez([ax, ay], [lerp(ax, px, .4), lerp(ay, py, .4)], [lerp(ax, px, .7), lerp(ay, py, .7)], [px, py], 10)
      .concat(bez([px, py], [px + cw * 1.2, py + cw * 2], [endX - cw * 3, endY], [endX, endY], 14).slice(1));
  } else if (S.phase === 2) {
    const wx = tipR.x + cw * .3, wy = yAtR(wx);
    const a = bez([ax, ay], [ax + cw * .1, ay + cw * .8], [wx - cw * .3, wy + cw * .7], [wx - cw * .16, wy + L.nr * 1.4], 10);
    wrap = bez([wx - cw * .16, wy + L.nr * 1.4], [wx - cw * .22, wy - L.nr * 2.6], [wx + cw * .22, wy - L.nr * 2.6], [wx + cw * .16, wy + L.nr * 1.4], 10);
    const b = bez([wx + cw * .16, wy + L.nr * 1.4], [wx + cw * .7, wy + cw * 1.2], [endX - cw * 3, endY], [endX, endY], 14);
    path = a.concat(wrap.slice(1), b.slice(1));
  } else if (S.phase === 3) {
    const nx = tipR.x + cw * .36, fy = footCur + rh * .25;
    newLoop = nx;
    path = bez([nx + cw * .3, fy], [nx + cw * .9, fy + cw * .8], [endX - cw * 3, endY], [endX, endY], 14);
  } else {
    path = bez([ax, ay], [ax + cw * .9, ay + cw * 1.1], [endX - cw * 3.5, endY + cw * .4], [endX, endY], 18);
  }
  yarnPath = path;
  if (!pull) yn(g, path, L.w * .85, palCur, 7);

  g.drawImage(cache, L.x0 - L.padX, by - L.padTop, cache.width / L.dpr, cache.height / L.dpr);

  for (const a of anims) {
    const c = cIdx(a.r, a.i), lk = v ? inv(front(a.r, c)) : front(a.r, c);
    const t = ease((now - a.t0) / a.dur);
    paintStitch(g, L.x0 + screenCol(c, v) * cw, by - rh * .25 * (1 - t), a.r, c, lk, .35 + .65 * t);
  }

  const knitIn = S.col < COLS && curMove() === KN && (S.phase === 1 || S.phase === 2);
  if (knitIn) { drawNeedle(g, tipR, 1); drawNeedle(g, tipL, -1); }
  else { drawNeedle(g, tipL, -1); drawNeedle(g, tipR, 1); }

  // 左针上的线圈：上一排的，还没织，脚垂得长一点（下面空着的那一排就是要织出来的）
  for (let k = 0; k <= s; k++) {
    const xc = L.x0 + (k + .5) * cw;
    const stretch = S.phase >= 3 && k === s ? 1.18 : 1;
    drawLoop(g, xc, footPrev, yAtL(xc), palPrev, seedOf(S.row - 1, k, 5), stretch);
  }
  // 右针上的线圈：这一排刚织好的
  for (let k = s + 1; k < COLS; k++) {
    const xc = L.x0 + (k + .5) * cw;
    drawLoop(g, xc, footCur, yAtR(xc), palCur, seedOf(S.row, k, 5));
  }

  // 绕线：线在右针尖上绕一圈；带出：新线圈已经挂在右针上
  if (wrap) yn(g, wrap, L.w * .85, palCur, 8);
  if (newLoop != null) drawLoop(g, newLoop, footCur + rh * .25, yAtR(newLoop), palCur, seedOf(S.row, s, 6));
  if (pull) yn(g, path, L.w * .85, palCur, 7);
}

// 先画到离屏，再把整张的软影子错开垫在下面，最后贴上本体：看起来是挂在纸面上方
function draw(g, now) {
  nctx.setTransform(1, 0, 0, 1, 0, 0);
  nctx.clearRect(0, 0, scn.width, scn.height);
  nctx.setTransform(L.dpr, 0, 0, L.dpr, MARGIN * L.dpr, MARGIN * L.dpr);
  drawScene(nctx, now);
  const w = L.W + 2 * MARGIN, h = L.H + 2 * MARGIN;
  floatShadow(g, scn, w, h, L.cw * FLOAT.dx - MARGIN, L.cw * FLOAT.dy - MARGIN, FLOAT.alpha, L.dpr);
  g.drawImage(scn, -MARGIN, -MARGIN, w, h);
}

/* 换行（不翻面）：像打字机回车——两根针滑回右边、叮一声，整片往下落一排。
 * dir = 1 往下织了一排，-1 拆回上一排。 */
function carriage(apply, dir) {
  bakeAll();
  apply();
  rebuild();
  lift = dir * L.rowH;
  sound.turn();
}

// ───────────────────────── 游戏逻辑 ─────────────────────────

function expected(m) {
  const mv = MOVES[curMove()];
  return (m === 'keys' ? mv.keys : mv.swipes).find(([, as]) => as.some(a => a >= S.phase));
}

function doStep(acts) {
  const mv = MOVES[curMove()];
  for (const a of acts) {
    if (a < S.phase) continue;
    sound.tick(mv.notes[a] + (colOf(S.row) ? 5 : 0));
    S.phase = a + 1;
    if (S.phase === 4) { stitchDone(); break; }
  }
  save();
}

function stitchDone() {
  anims.push({ r: S.row, i: S.col, t0: performance.now(), dur: 150 });
  S.col++;
  S.phase = 0;
  sound.clack(.02);
  if (S.col === COLS) rowDone();
}

function rowDone() {
  carriage(() => { S.row++; S.col = 0; S.phase = 0; }, 1);
  sound.ding();
  const p = PATTERNS[patOf(S.row)];
  if (p.unlock === S.row) {
    sound.fanfare();
    HO.app.toast('newStitch', p.name);
  }
}

function miss() {
  sound.thud();
  tipR.vx += (Math.random() - .5) * 240;
  tipR.vy += 150;
}

// 拆一针：做了一半的先退回去；整针拆掉；拆到排头就退回上一排
function unstep() {
  bakeAll();
  if (S.phase > 0) { S.phase = 0; return true; }
  if (S.col > 0) { S.col--; repaintTop(); return true; }
  if (S.row > 0) { carriage(() => { S.row--; S.col = COLS - 1; S.phase = 0; }, -1); return true; }
  return false;
}

// ───────────────────────── 对外 ─────────────────────────

HO.games.knitting = {
  id: 'knitting',
  no: '02',
  name: { zh: '棒针围巾', en: 'Knitted scarf' },
  verb: 'knit',
  keys: 'FJDK',
  floats: FLOAT,

  enter() { S = load(); anims = []; pull = null; lift = 0; },
  layout,
  update,
  draw,

  key(K) {
    const e = expected('keys');
    if (e && e[0] === K) { doStep(e[1]); return true; }
    miss();
    return false;
  },

  swipe(ang, quiet) {
    const e = expected('touch');
    if (e && angDiff(ang, DIR_DEG[e[0]] * Math.PI / 180) <= .92) { doStep(e[1]); return true; }
    if (!quiet) miss();
    return false;
  },

  // 只有抓在围巾右边那段垂下去的毛线上才算拆；织物和针附近的滑动都算织
  grab(x, y) {
    if (!L || x < L.x0 + L.fw + L.cw * .3) return false;
    return polyDist(x, y, yarnPath) < Math.max(18, L.cw * .55);
  },
  pullStart(x, y) {
    bakeAll();
    S.phase = 0;
    pull = { x, y, px: x, py: y, acc: -L.cw * .8, done: false };
  },
  pullMove(x, y) {
    if (!pull) return false;
    pull.acc += Math.hypot(x - pull.px, y - pull.py);
    pull.px = pull.x = x;
    pull.py = pull.y = y;
    const step = L.cw * .6;
    let changed = false;
    while (!pull.done && pull.acc >= step) {
      pull.acc -= step;
      if (!unstep()) {
        S = fresh();
        rebuild();
        jumpTips();
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
  hoverGrab(x, y) { return this.grab(x, y); },

  hud(mode) {
    const mv = MOVES[curMove()], pat = PATTERNS[patOf(S.row)];
    const steps = mode === 'keys' ? mv.keys : mv.swipes, e = expected(mode);
    const nx = PATTERNS.find(p => p.unlock > S.row);
    let seen = false;
    return {
      len: ((S.row + S.col / COLS) * CM_PER_ROW).toFixed(1),
      next: nx ? { n: nx.unlock - S.row, name: nx.name } : null,
      row: S.row + 1,
      name: [pat.name, mv.name],
      steps: steps.map(st => {
        const isNext = st === e;
        if (isNext) seen = true;
        return {
          face: st[0], arrow: mode === 'keys' ? null : DIR_DEG[st[0]],
          label: st[1].map(a => ACTS[a]),
          state: isNext ? 'next' : seen ? '' : 'done',
        };
      }),
      red: colOf(S.row) === 1,
      tip: S.row < 2 ? mode : S.row < 6 ? 'pullYarn' : null,
    };
  },

  savedLen() {
    const keep = S;
    S = load();
    const v = (S.row + S.col / COLS) * CM_PER_ROW;
    S = keep;
    return v;
  },

  // 首页工作桌上的小样：挂在一根针上的一段，起伏针接平针
  preview(ctx, w, h) {
    const keepS = S, keepL = L, keepMemo = memo, kL = { ...tipL };
    const cw = Math.floor(w * .66 / COLS), rowH = Math.round(cw * .8);
    const needleY = Math.round(h * .14);
    const R = Math.max(4, Math.floor((h * .9 - needleY - cw * .62) / rowH) - 1);
    S = { seed: 4242, row: R, col: 0, phase: 0 };
    memo = { seed: S.seed, pat: [], col: [], band: 0, stripe: 0, cur: 0 };
    for (let r = 0; r <= R; r++) {
      memo.pat.push(r < 4 ? 1 : r < R - 3 ? 0 : 1);
      memo.col.push(r === 5 || r === 6 || r === R - 2 ? 1 : 0);
    }
    L = { cw, rowH, w: cw * .27, nr: Math.max(2.2, cw * .14), fw: cw * COLS, dpr: 1 };
    L.x0 = Math.round((w - L.fw) / 2);
    L.bodyY = needleY + cw * .62 - rowH;
    const v = 0;
    for (let r = -1; r < R; r++) paintRowAt(ctx, L.x0, L.bodyY + (R - r) * rowH, r, v);
    Object.assign(tipL, { x: L.x0 + L.fw + cw * .9, y: needleY });
    drawNeedle(ctx, tipL, -1);
    for (let k = 0; k < COLS; k++) {
      const xc = L.x0 + (k + .5) * cw;
      drawLoop(ctx, xc, L.bodyY + rowH * .82, yAtL(xc), PAL[colOf(R - 1)], seedOf(R - 1, k, 5));
    }
    const ax = L.x0 + (COLS - .22) * cw, ay = yAtL(ax) + L.nr * 1.2;
    yn(ctx, bez([ax, ay], [ax + cw * .4, ay + cw * 1.6], [w - cw * 1.4, h * .5], [w + 4, h * .56], 14), L.w * .85, PAL[colOf(R - 1)], 7);
    S = keepS; L = keepL; memo = keepMemo; Object.assign(tipL, kL);
  },
};

})();
