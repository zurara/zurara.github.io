/* 有手就行 · 外壳
 * 工作桌（首页）↔ 每个小玩意。路由用 hash：#/ 是桌子，#/embroidery、#/knitting 是两样东西。
 * 这里管：画布尺寸、每帧循环、键盘/手势分发、上面的面包屑和大数字、下面的按键提示、声音和语言。
 */
(() => {
'use strict';
const { store, sound, audio, paper, angDiff } = HO;

const ORDER = ['embroidery', 'knitting'];

const STR = {
  zh: {
    series: '有手就行',
    stitch_next: (n, s) => `再绣 ${n} 排 · 解锁${s}`,
    knit_next: (n, s) => `再织 ${n} 排 · 解锁${s}`,
    row: n => `第 ${n} 排`,
    tip_keys: '照顺序按，循环下去就是一排',
    tip_touch: '照箭头方向划，循环下去就是一排',
    tip_pullNeedle: '抓住针眼那头往外拖，就能拆掉',
    tip_pullYarn: '抓住右边垂下去的毛线往外拖，就能拆掉',
    newStitch: '新针法',
    fresh: '拆光了，换一块重新来',
    more: '更多小玩意，陆续上桌',
    notYet: '还没动手',
    sound: '声音',
    lang: 'English',
    desc: '把打发时间的手作，变成屏幕上的小游戏。',
  },
  en: {
    series: 'Hands-on',
    stitch_next: (n, s) => `${n} more row${n > 1 ? 's' : ''} · unlocks ${s}`,
    knit_next: (n, s) => `${n} more row${n > 1 ? 's' : ''} · unlocks ${s}`,
    row: n => `Row ${n}`,
    tip_keys: 'Press in order, loop it, and that’s a row',
    tip_touch: 'Swipe along the arrows, loop it, and that’s a row',
    tip_pullNeedle: 'Grab the needle by its eye and pull to unpick',
    tip_pullYarn: 'Grab the hanging yarn on the right and pull to unravel',
    newStitch: 'New stitch',
    fresh: 'All undone, starting fresh',
    more: 'More small things coming to the table',
    notYet: 'Not started',
    sound: 'Sound',
    lang: '中文',
    desc: 'Idle-time handcrafts, turned into small screen games.',
  },
};

let lang = store.get('hands-on.lang', 'zh');
if (!STR[lang]) lang = 'zh';
const T = o => o == null ? '' : typeof o === 'string' ? o : (o[lang] || o.zh);
const t = k => STR[lang][k];

// ───────────────────────── DOM ─────────────────────────

const $ = id => document.getElementById(id);
const cv = $('c'), g = cv.getContext('2d');
const elHome = $('crumb-home'), elSep = $('crumb-sep'), elPiece = $('crumb-piece');
const elLen = $('len'), elNext = $('next'), elScore = $('score');
const elDock = $('dock'), elName = $('stname'), elCaps = $('caps'), elTip = $('tip');
const elToast = $('toast'), elSnd = $('snd'), elLang = $('lang'), elTable = $('table'), elMore = $('more');

const ARROW = deg => `<svg viewBox="0 0 24 24" style="transform:rotate(${deg}deg)" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter"/></svg>`;
const ICON_SND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
const ICON_SND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M3 3l18 18" class="cut"/></svg>';
elLang.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9M12 3C9.4 5.6 8.2 8.6 8.2 12s1.2 6.4 3.8 9"/></svg>';

// ───────────────────────── 画布与循环 ─────────────────────────

let game = null;
let V = null;

function measure() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const top = elNext.getBoundingClientRect().bottom + 6;
  const bottom = elDock.getBoundingClientRect().top - 6;
  V = { W, H, dpr, top, bottom: Math.max(bottom, top + 200) };
}

function layout() {
  if (!game) return;
  measure();
  game.layout(V);
  kick();
}

let running = false, lastT = 0;
function kick() {
  if (running || !game || !V) return;
  running = true;
  lastT = performance.now();
  requestAnimationFrame(frame);
}
function frame(now) {
  if (!game) { running = false; return; }
  const dt = Math.min(.05, (now - lastT) / 1000);
  lastT = now;
  const active = game.update(dt, now);
  g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  g.clearRect(0, 0, V.W, V.H);
  game.draw(g, now);
  if (active) requestAnimationFrame(frame);
  else running = false;   // 没东西在动就停，省电
}

// ───────────────────────── 路由 ─────────────────────────

function route() {
  const id = location.hash.replace(/^#\/?/, '');
  const next = HO.games[id] || null;
  game = next;
  document.body.classList.toggle('home', !game);
  ptr = null;
  if (game) {
    game.enter();
    renderHud();
    layout();
  } else {
    running = false;
    paintHome();
  }
  renderChrome();
}

// ───────────────────────── 上面和下面 ─────────────────────────

function renderChrome() {
  elHome.textContent = t('series');
  elSep.hidden = elPiece.hidden = !game;
  elPiece.textContent = game ? T(game.name) : '';
  document.title = game ? `${t('series')} / ${T(game.name)}` : `${t('series')} · hands-on`;
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
  elSnd.innerHTML = HO.muted ? ICON_SND_OFF : ICON_SND_ON;
  elSnd.setAttribute('aria-label', t('sound'));
  elSnd.setAttribute('aria-pressed', String(!HO.muted));
  elLang.setAttribute('aria-label', t('lang'));
  elLang.title = t('lang');
  elMore.textContent = t('more');
}

function renderHud() {
  if (!game) return;
  const h = game.hud(HO.mode);
  elLen.textContent = h.len;
  elNext.textContent = h.next
    ? t(game.verb === 'knit' ? 'knit_next' : 'stitch_next')(h.next.n, T(h.next.name))
    : t('row')(h.row);
  elName.textContent = h.name.map(T).join(' · ');
  elCaps.innerHTML = h.steps.map(s => {
    const face = s.arrow == null ? s.face : ARROW(s.arrow);
    const label = s.label ? `<small>${s.label.map(T).join(' · ')}</small>` : '';
    return `<span class="cap ${s.state}"><b>${face}</b>${label}</span>`;
  }).join('');
  elDock.classList.toggle('red', h.red);
  elDock.classList.toggle('labels', h.steps.some(s => s.label));
  if (h.tip) elTip.textContent = t('tip_' + h.tip);
  elTip.classList.toggle('off', !h.tip);
}

let toastT = 0;
function toast(kind, name) {
  elToast.innerHTML = `<em>${t(kind)}</em>${name ? `<strong>${T(name)}</strong>` : ''}`;
  elToast.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => elToast.classList.remove('on'), 2600);
}

HO.app = { toast };

// ───────────────────────── 工作桌（首页） ─────────────────────────

const items = ORDER.map((id, i) => {
  const gm = HO.games[id];
  const a = document.createElement('a');
  a.className = 'item';
  a.href = `#/${id}`;
  a.style.setProperty('--rot', `${i % 2 ? 2.2 : -2.6}deg`);
  a.innerHTML = '<canvas aria-hidden="true"></canvas><span class="no"></span><span class="nm"></span><span class="sub"></span>';
  elTable.appendChild(a);
  return { gm, a, cv: a.querySelector('canvas'), no: a.querySelector('.no'), nm: a.querySelector('.nm'), sub: a.querySelector('.sub') };
});

function paintHome() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const it of items) {
    it.no.textContent = `N°${it.gm.no}`;
    it.nm.textContent = T(it.gm.name);
    const len = it.gm.savedLen();
    it.sub.textContent = len > 0 ? `${len.toFixed(1)} cm` : t('notYet');
    const r = it.cv.getBoundingClientRect();
    if (!r.width) continue;
    it.cv.width = Math.round(r.width * dpr);
    it.cv.height = Math.round(r.height * dpr);
    const c = it.cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, r.width, r.height);
    const f = it.gm.floats;
    if (!f) { it.gm.preview(c, r.width, r.height); continue; }
    // 悬空的东西：先画到离屏，再垫一层错开的软影子
    off.width = it.cv.width;
    off.height = it.cv.height;
    const o = off.getContext('2d');
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    it.gm.preview(o, r.width, r.height);
    const u = r.width * .066;
    HO.floatShadow(c, off, r.width, r.height, u * f.dx, u * f.dy, f.alpha, dpr);
    c.drawImage(off, 0, 0, r.width, r.height);
  }
}
const off = document.createElement('canvas');

// ───────────────────────── 输入 ─────────────────────────

function setMode(m) {
  if (HO.mode === m) return;
  HO.mode = m;
  renderHud();
}

window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape' && game) { location.hash = '#/'; return; }
  if (!game || e.repeat) return;
  const K = e.key.length === 1 ? e.key.toUpperCase() : '';
  if (!K || !game.keys.includes(K)) return;
  e.preventDefault();
  audio();
  setMode('keys');
  game.key(K);
  renderHud();
  kick();
});

let ptr = null;
const SWIPE = 22;
cv.addEventListener('pointerdown', e => {
  if (!game) return;
  audio();
  if (e.pointerType === 'touch') setMode('touch');
  const grab = game.grab(e.clientX, e.clientY);
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false, last: 0, pull: grab };
  if (grab) {
    game.pullStart(e.clientX, e.clientY);
    cv.style.cursor = 'grabbing';
    kick();
  }
  if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
});
cv.addEventListener('pointermove', e => {
  if (!game) return;
  if (!ptr) {
    if (e.pointerType === 'mouse') cv.style.cursor = game.grab(e.clientX, e.clientY) ? 'grab' : '';
    return;
  }
  if (e.pointerId !== ptr.id) return;
  if (ptr.pull) {
    if (game.pullMove(e.clientX, e.clientY)) renderHud();
    kick();
    return;
  }
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  if (Math.hypot(dx, dy) < SWIPE) return;
  const ang = Math.atan2(dy, dx);
  // 一划只算一步；手不抬、拐了弯才算下一步（可以连着画折线）
  if (ptr.fired && angDiff(ang, ptr.last) < 1.0) { ptr.x = e.clientX; ptr.y = e.clientY; return; }
  setMode('touch');
  if (game.swipe(ang, ptr.fired) && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(6);
  ptr.fired = true;
  ptr.last = ang;
  ptr.x = e.clientX;
  ptr.y = e.clientY;
  renderHud();
  kick();
});
const endPtr = e => {
  if (!ptr || e.pointerId !== ptr.id) return;
  if (ptr.pull) { game && game.pullEnd(); cv.style.cursor = ''; renderHud(); kick(); }
  ptr = null;
};
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);

elSnd.addEventListener('click', () => {
  HO.muted = !HO.muted;
  if (!HO.muted) { audio(); sound.tick(0); }
  renderChrome();
});

elLang.addEventListener('click', () => {
  lang = lang === 'zh' ? 'en' : 'zh';
  HO.lang = lang;
  store.set('hands-on.lang', lang);
  renderChrome();
  if (game) { renderHud(); layout(); } else paintHome();
});

let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => (game ? layout() : paintHome()), 60);
});
window.addEventListener('hashchange', route);

// ───────────────────────── 开始 ─────────────────────────

HO.lang = lang;
paper();
route();

})();
