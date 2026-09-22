/**
 * One continuous pen stroke ringed round something — the gesture the site uses
 * to mark a word on paper (see `components/Tags.astro`).
 *
 * The stroke overshoots where it closes and tightens slightly as it comes
 * round, the way a hand actually rings a word. Its wobble is derived from a
 * seed string, so a given label is always ringed the same way at build time,
 * but no two labels are ringed alike.
 *
 * Draw the path into a box of `w` x `h` and let the SVG stretch it
 * (`preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke`), so the
 * ring takes the shape of whatever it circles while the line stays even.
 */
export function ringPath(seedText: string, w = 100, h = 44): string {
  let hash = 2166136261;
  for (const ch of seedText)
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  const rnd = seeded(hash);

  const cx = w / 2 + (rnd() * 2 - 1) * 1.5;
  const cy = h / 2 + (rnd() * 2 - 1) * 1;
  const rx = w / 2 - 2;
  const ry = h / 2 - 2;
  // where the pen lands, and how far past that point it runs before lifting
  const start = -1.9 + rnd() * 0.6;
  const over = 0.3 + rnd() * 0.45;
  // enough wobble to read as a hand, little enough to still read as a circle
  const wob1 = 0.03 + rnd() * 0.02;
  const wob2 = 0.016 + rnd() * 0.012;
  const ph1 = rnd() * Math.PI * 2;
  const ph2 = rnd() * Math.PI * 2;
  // the hand tightens as it comes round — the ring closes slightly inside
  const close = 0.04 + rnd() * 0.03;

  const steps = 40;
  const end = start + Math.PI * 2 + over;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const a = start + (end - start) * p;
    const k =
      1 +
      wob1 * Math.sin(3 * a + ph1) +
      wob2 * Math.sin(5 * a + ph2) -
      close * p;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }

  return through(pts);
}

/**
 * A line ruled under a word by hand — one pass, slightly off level, its wave
 * loosening and tightening as it goes. Drawn as ONE path (not a repeating
 * tile) so it can carry round caps at both ends and be drawn on with
 * stroke-dashoffset, the way the ring is.
 *
 * `pad` keeps the ends inside the box so the round caps are not clipped.
 */
export function rulePath(seedText: string, w = 200, h = 12, pad = 2.5): string {
  let hash = 2166136261;
  for (const ch of seedText) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  const rnd = seeded(hash);

  const mid = h / 2;
  const amp = h * 0.13 + rnd() * h * 0.05;
  const waves = 2.4 + rnd() * 1.1; // how many times it crosses on the way
  const phase = rnd() * Math.PI * 2;
  const drift = rnd() * Math.PI * 2;
  // a hand never rules level — the line falls or rises a little end to end
  const tilt = (rnd() * 2 - 1) * h * 0.07;

  const steps = 56;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = pad + (w - pad * 2) * t;
    const a = t * waves * Math.PI * 2 + phase;
    // the wave breathes instead of ticking along like a sine
    const breathe = 0.75 + 0.45 * Math.sin(t * 3.1 + drift);
    const y = mid + tilt * (t - 0.5) * 2 + Math.sin(a) * amp * breathe;
    pts.push([x, y]);
  }
  return through(pts);
}

/**
 * Catmull-Rom through the samples, emitted as cubics — the line curves
 * through each point instead of cornering at it.
 */
function through(pts: [number, number][]): string {
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    d +=
      `C${(x1 + (x2 - x0) / 6).toFixed(2)} ${(y1 + (y2 - y0) / 6).toFixed(2)} ` +
      `${(x2 - (x3 - x1) / 6).toFixed(2)} ${(y2 - (y3 - y1) / 6).toFixed(2)} ` +
      `${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return d;
}

/**
 * Hand-set one word: every letter leans and sits a little differently.
 * Deterministic from the text, so it is baked at build time — the page needs
 * no script to look written by hand.
 */
export function scrawl(text: string, tilt = 4, drop = 1.6) {
  let hash = 2166136261;
  for (const ch of text) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  const rnd = seeded(hash);
  return [...text].map((ch) => ({
    ch,
    rot: +(rnd() * tilt * 2 - tilt).toFixed(1),
    dy: +(rnd() * drop * 2 - drop).toFixed(1),
  }));
}

const seeded = (s: number) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
