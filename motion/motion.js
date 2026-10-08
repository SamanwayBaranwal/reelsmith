// motion.js — After Effects, driven by agents.
// A comp is plain data: layers with keyframed properties, After Effects-style easing, inertial bounce, wiggle,
// parenting, precomps, effects, track mattes, per-layer motion blur and beat-synced timing.
// renderComp(c, comp, t) draws one frame; the same t always gives the same picture.
// Units follow After Effects so values can be copied across: position px, scale %, rotation degrees, opacity %.

// ---------------------------------------------------------------- time
// 1.2 | '1.2s' | '36f' | 'beat:4' (4th strong hit, 1-based) | 'onset:9' | 'kick:2' | 'mark:drop' | any of those + or - seconds ('beat:4-0.05')
const MOTION = { hits: [], onsets: [], kicks: [], markers: {}, period: 0 };
function T(x) {
  if (typeof x === 'number') return x;
  const s = String(x).trim(), m = s.match(/^(beat|onset|kick|mark):([\w.-]+?)([+-][\d.]+)?$/);
  if (m) {
    const off = parseFloat(m[3] || 0);
    if (m[1] === 'mark') { if (!(m[2] in MOTION.markers)) throw new Error(`marker "${m[2]}" not found`); return T(MOTION.markers[m[2]]) + off; }
    const list = { beat: MOTION.hits, onset: MOTION.onsets, kick: MOTION.kicks }[m[1]], i = parseInt(m[2]) - 1;
    if (list[i] === undefined) throw new Error(`${m[1]}:${m[2]} not found (${list.length} detected; run tools/beats.py on the audio)`);
    return list[i] + off;
  }
  if (s.endsWith('f')) return parseFloat(s) / FPS;
  return parseFloat(s);
}

// ---------------------------------------------------------------- easing
// Named eases are cubic-bezier curves in After Effects terms (influence = how far the handle reaches, speed = its slope).
const EASE = {
  linear: [0, 0, 1, 1],
  smooth: [.333, 0, .667, 1],        // After Effects "Easy Ease" (33% influence, speed 0)
  out: [.16, 1, .3, 1],              // leave fast, glide in: the snappy motion-design default
  in: [.7, 0, .84, 0],               // start slow, hit hard (pair with bounce)
  inOut: [.83, 0, .17, 1],           // 83% influence both sides: the pro "S" curve
  whip: [.9, 0, .1, 1],              // hang, whip, hang: for camera moves and transitions
  back: [.34, 1.56, .64, 1],         // overshoot once and settle
  anticipate: [.6, -.35, .7, 1],     // dip back first, then go
};
// spring eases: overshoot and settle inside the segment (zeta = damping, w = oscillations)
const SPRING = { pop: [7, 2.2], spring: [5, 1.6], wobble: [4, 3.2] };
const springFn = (z, w) => u => u >= 1 ? 1 : 1 - Math.exp(-z * u) * Math.cos(w * TAU * u);
function bezierFn(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  return u => {
    if (u <= 0) return 0; if (u >= 1) return 1;
    let s = u; for (let i = 0; i < 8; i++) { const e = X(s) - u, d = dX(s); if (Math.abs(e) < 1e-6) return Y(s); if (Math.abs(d) < 1e-6) break; s -= e / d; }
    let lo = 0, hi = 1; s = u; for (let i = 0; i < 30; i++) { const x = X(s); if (Math.abs(x - u) < 1e-6) break; if (x < u) lo = s; else hi = s; s = (lo + hi) / 2; }
    return Y(s);
  };
}
const EASE_CACHE = new Map();
// ease spec: a name above, [x1,y1,x2,y2], 'hold', or After Effects numbers {out:[speed, influence%], in:[speed, influence%]}
// (speed in units per second, as shown in the After Effects keyframe velocity dialog; needs the segment's change and duration)
function easeFn(e, change = 1, dur = 1) {
  if (e === undefined) e = 'smooth';
  if (typeof e === 'function') return e;
  if (e === 'hold') return u => u >= 1 ? 1 : 0;
  if (typeof e === 'string' && SPRING[e]) return springFn(...SPRING[e]);
  if (e && e.spring) return springFn(...e.spring); // { spring: [damping, oscillations] } over the segment, as the analyser writes it
  if (e && e.out !== undefined || e && e.in !== undefined) {
    const avg = Math.abs(change) / dur || 1, o = e.out || [0, 33.33], i = e.in || [0, 33.33];
    return bezierFn(o[1] / 100, o[1] / 100 * o[0] / avg, 1 - i[1] / 100, 1 - i[1] / 100 * i[0] / avg);
  }
  const key = Array.isArray(e) ? e.join() : e; if (!EASE_CACHE.has(key)) {
    const b = Array.isArray(e) ? e : EASE[e]; if (!b) throw new Error(`unknown ease "${e}" (try ${[...Object.keys(EASE), ...Object.keys(SPRING)].join(', ')})`);
    EASE_CACHE.set(key, bezierFn(...b));
  }
  return EASE_CACHE.get(key);
}

// ---------------------------------------------------------------- values
const isColor = v => typeof v === 'string' && /^#([0-9a-f]{3}){1,2}$/i.test(v);
const hex6 = v => v.length === 4 ? '#' + [...v.slice(1)].map(c => c + c).join('') : v;
function lerpV(a, b, p) {
  if (typeof a === 'number') return a + (b - a) * p;
  if (Array.isArray(a)) return a.map((x, i) => lerpV(x, b[i], p));
  if (isColor(a) && isColor(b)) { const A = hex(hex6(a)), B = hex(hex6(b)); return '#' + A.map((x, i) => Math.round(clamp(x + (B[i] - x) * p, 0, 255)).toString(16).padStart(2, '0')).join(''); }
  return p < 1 ? a : b; // strings and anything else step
}
const addV = (a, b) => typeof a === 'number' ? a + b : Array.isArray(a) ? a.map((x, i) => addV(x, Array.isArray(b) ? b[i] : b)) : a;
const subV = (a, b) => typeof a === 'number' ? a - b : Array.isArray(a) ? a.map((x, i) => subV(x, b[i])) : 0;
const mulV = (a, k) => typeof a === 'number' ? a * k : Array.isArray(a) ? a.map(x => mulV(x, k)) : a;
const mag = v => typeof v === 'number' ? Math.abs(v) : Array.isArray(v) ? Math.hypot(...v.map(mag)) : 1;
// keyframes: [[t, v, ease?], ...] or [{t, v, ease}, ...]; a key's ease shapes the move INTO that key
const isKeys = p => Array.isArray(p) && p.length > 0 && (Array.isArray(p[0]) ? p[0].length >= 2 && (typeof p[0][0] === 'number' || typeof p[0][0] === 'string') : !!p[0] && typeof p[0] === 'object' && 't' in p[0]);
const KEYS = new WeakMap();
function norm(p) {
  if (!KEYS.has(p)) KEYS.set(p, p.map(k => Array.isArray(k) ? { t: T(k[0]), v: k[1], ease: k[2] } : { ...k, t: T(k.t) }).sort((a, b) => a.t - b.t));
  return KEYS.get(p);
}
function interp(K, t) {
  if (t <= K[0].t) return K[0].v; const n = K.length; if (t >= K[n - 1].t) return K[n - 1].v;
  let i = 0; while (t >= K[i + 1].t) i++;
  const A = K[i], B = K[i + 1], d = B.t - A.t;
  return lerpV(A.v, B.v, easeFn(B.ease, mag(subV(B.v, A.v)), d)((t - A.t) / d));
}
// deterministic wiggle: two incommensurate sines per dimension
function wiggleV(base, w, t) {
  const f = w.freq ?? 2, a = w.amp ?? 10, seed = w.seed ?? 1;
  const one = k => a * (Math.sin(t * f * TAU + rnd(seed * 7 + k) * TAU) * .62 + Math.sin(t * f * 1.73 * TAU + rnd(seed * 13 + k) * TAU) * .38);
  return typeof base === 'number' ? base + one(0) : Array.isArray(base) ? base.map((x, k) => x + one(k)) : base;
}
// After Effects inertial bounce: after each key, keep the arrival velocity going as a decaying sine
function bounceV(K, t, b, v) {
  let i = -1; for (let k = 1; k < K.length; k++) if (t >= K[k].t) i = k; if (i < 1) return v;
  const h = 1 / 240, vel = mulV(subV(interp(K, K[i].t), interp(K, K[i].t - h)), 1 / h), dt = t - K[i].t;
  const amp = b.amp ?? .05, freq = b.freq ?? 2.5, decay = b.decay ?? 6, k = amp * Math.sin(freq * dt * TAU) / Math.exp(decay * dt);
  return addV(v, mulV(vel, k));
}
// a property is: a constant | keyframes | (t, layer) => value | { keys, bounce, wiggle, loop }
function val(p, t, L) {
  if (p === undefined || p === null) return p;
  if (typeof p === 'function') return p(t, L);
  if (isKeys(p)) return interp(norm(p), t);
  if (typeof p === 'object' && !Array.isArray(p) && (p.keys || p.wiggle || p.value !== undefined)) {
    let tt = t;
    if (p.keys && p.loop) { const K = norm(p.keys), a = K[0].t, d = K[K.length - 1].t - a; if (tt > a + d) tt = a + ((tt - a) % d); }
    let v = p.keys ? interp(norm(p.keys), tt) : p.value;
    if (p.keys && p.bounce) v = bounceV(norm(p.keys), tt, p.bounce, v);
    if (p.wiggle) v = wiggleV(v, p.wiggle, t);
    return v;
  }
  return p;
}
const v2 = (v, d) => v === undefined || v === null ? d : typeof v === 'number' ? [v, v] : v;

// ---------------------------------------------------------------- paint: colour string or gradient spec
// { linear: [x0,y0,x1,y1], stops: [[0,'#fff'],[1,'#000']] } | { radial: [x,y,r0,r1], stops }  (layer space, centre = 0,0)
function paint(g, p, t, L) {
  p = val(p, t, L); if (!p || typeof p === 'string') return p;
  const s = p.linear ? g.createLinearGradient(...p.linear.map(x => val(x, t, L))) : g.createRadialGradient(p.radial[0], p.radial[1], p.radial[2], p.radial[0], p.radial[1], p.radial[3]);
  for (const [o, c] of p.stops) s.addColorStop(o, val(c, t, L)); return s;
}

// ---------------------------------------------------------------- canvas pool
const POOL = [];
const takeBuf = () => POOL.pop() || mk();
const freeBuf = b => POOL.push(b);
function clean(b) { const g = b.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.clearRect(0, 0, W, H); return g; }
const BLEND = { normal: 'source-over', add: 'lighter', screen: 'screen', multiply: 'multiply', overlay: 'overlay', softLight: 'soft-light', lighten: 'lighten', darken: 'darken', colorDodge: 'color-dodge', difference: 'difference' };

// ---------------------------------------------------------------- transforms (anchor, position, scale %, rotation °, parenting)
function localMatrix(L, t) {
  const p = v2(val(L.position, t, L), L._child ? [0, 0] : [W / 2, H / 2]), // top level: comp centre; inside a group: the group's origin
    a = v2(val(L.anchor, t, L), [0, 0]), s = v2(val(L.scale, t, L), [100, 100]);
  const m = new DOMMatrix().translateSelf(p[0], p[1]).rotateSelf(val(L.rotation, t, L) || 0);
  const sk = val(L.skew, t, L); if (sk) m.skewXSelf(sk);
  return m.scaleSelf(s[0] / 100, s[1] / 100).translateSelf(-a[0], -a[1]);
}
function worldMatrix(L, t, base, sibs) {
  let m = localMatrix(L, t);
  if (L.parent) { const P = sibs.find(x => x.name === L.parent); if (!P) throw new Error(`parent "${L.parent}" not found next to "${L.name}"`); m = worldMatrix(P, t, base, sibs).multiply(m); }
  else m = base.multiply(m);
  return m;
}

// ---------------------------------------------------------------- layers
// common: name, type, in, out, parent, position, anchor, scale, rotation, skew, opacity, blend, effects, motionBlur, matte, visible
function renderLayers(g, layers, t, base, comp) {
  const mattes = new Set(layers.filter(L => L.matte).map(L => L.matte.layer));
  for (let i = layers.length - 1; i >= 0; i--) { const L = layers[i]; if (!mattes.has(L.name)) renderLayer(g, L, t, base, layers, comp); }
}
function active(L, t) { return L.visible !== false && L.type !== 'null' && t >= (L.in === undefined ? -1e9 : T(L.in)) && t < (L.out === undefined ? 1e9 : T(L.out)); }
function renderLayer(g, L, t, base, sibs, comp) {
  if (!active(L, t)) return;
  const op = val(L.opacity, t, L) ?? 100; if (op <= 0) return;
  const fx = (L.effects || []).filter(e => e.enabled !== false), mb = L.motionBlur && comp.motionBlur !== false;
  g.save(); g.globalAlpha *= op / 100; g.globalCompositeOperation = BLEND[L.blend || 'normal'];
  if (!fx.length && !mb && !L.matte) { drawContent(g, L, t, base, sibs, comp); g.restore(); return; }
  // isolated layer buffer: motion blur → effects → matte → composite
  let b = takeBuf(); const bg = clean(b);
  if (mb) {
    const N = (L.motionBlur.samples ?? comp.motionBlurSamples) || 16, sh = ((L.motionBlur.shutter ?? comp.shutterAngle) ?? 180) / 360 / FPS;
    for (let k = 0; k < N; k++) { const s = takeBuf(), sg = clean(s); drawContent(sg, L, t + (N > 1 ? k / (N - 1) - .5 : 0) * sh, base, sibs, comp); bg.globalCompositeOperation = 'lighter'; bg.globalAlpha = 1 / N; bg.drawImage(s, 0, 0); freeBuf(s); }
  } else drawContent(bg, L, t, base, sibs, comp);
  let glows = [], shadow = null;
  for (const e of fx) {
    const P = k => val(e[k], t, L);
    if (e.type === 'blur' || e.type === 'tint' || e.type === 'fill' || e.type === 'brightness') {
      const o = takeBuf(), og = clean(o);
      if (e.type === 'blur') { og.filter = `blur(${P('radius') ?? 10}px)`; og.drawImage(b, 0, 0); }
      else if (e.type === 'brightness') { og.filter = `brightness(${P('amount') ?? 1.2}) contrast(${P('contrast') ?? 1}) saturate(${P('saturation') ?? 1})`; og.drawImage(b, 0, 0); }
      else { og.drawImage(b, 0, 0); og.globalCompositeOperation = 'source-in'; og.globalAlpha = e.type === 'tint' ? (P('amount') ?? 1) : 1; og.fillStyle = P('color') || '#fff'; og.fillRect(0, 0, W, H); if (e.type === 'tint') { og.globalCompositeOperation = 'destination-over'; og.globalAlpha = 1; og.drawImage(b, 0, 0); } }
      freeBuf(b); b = o;
    } else if (e.type === 'glow') glows.push({ r: P('radius') ?? 30, k: P('intensity') ?? 1, color: P('color'), layers: e.layers ?? 2 });
    else if (e.type === 'shadow') shadow = { color: P('color') || 'rgba(0,0,0,0.35)', blur: P('blur') ?? 30, x: P('x') ?? 0, y: P('y') ?? 12 };
    else throw new Error(`unknown effect "${e.type}" on "${L.name}" (blur, glow, shadow, tint, fill, brightness)`);
  }
  if (L.matte) { // track matte: keep this layer only where the matte layer is (alpha) or isn't (alphaInverted)
    const M = sibs.find(x => x.name === L.matte.layer); if (!M) throw new Error(`matte "${L.matte.layer}" not found`);
    const m = takeBuf(), mg = clean(m); renderLayer(mg, { ...M, matte: undefined, visible: true }, t, base, sibs, comp);
    const og = b.getContext('2d'); og.setTransform(1, 0, 0, 1, 0, 0); og.globalAlpha = 1; og.globalCompositeOperation = L.matte.mode === 'alphaInverted' ? 'destination-out' : 'destination-in'; og.drawImage(m, 0, 0); og.globalCompositeOperation = 'source-over'; freeBuf(m);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (shadow) { g.save(); g.shadowColor = shadow.color; g.shadowBlur = shadow.blur; g.shadowOffsetX = shadow.x; g.shadowOffsetY = shadow.y; g.drawImage(b, 0, 0); g.restore(); } else g.drawImage(b, 0, 0);
  for (const gl of glows) { // glow: blurred copies added on top (two radii read like Deep Glow's falloff)
    let src = b; if (gl.color) { src = takeBuf(); const cg = clean(src); cg.drawImage(b, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = gl.color; cg.fillRect(0, 0, W, H); }
    g.save(); g.globalCompositeOperation = 'lighter'; const a0 = g.globalAlpha;
    for (let j = 0; j < gl.layers; j++) { g.filter = `blur(${(gl.r * Math.pow(2.6, j)).toFixed(1)}px)`; g.globalAlpha = Math.min(1, a0 * gl.k / (j + 1)); g.drawImage(src, 0, 0); }
    g.restore(); if (src !== b) freeBuf(src);
  }
  freeBuf(b); g.restore();
}
function drawContent(g, L, t, base, sibs, comp) {
  const M = worldMatrix(L, t, base, sibs); g.setTransform(M);
  const P = k => val(L[k], t, L), type = L.type;
  if (type === 'group' || type === 'precomp') { // children live in this layer's space and on its own clock
    const lt = (t - T(L.start ?? 0)) * (L.speed ?? 1); renderLayers(g, L.layers, lt, M, comp); return;
  }
  // pivot: where the layer's origin sits inside its box, [0,0] top-left … [.5,.5] centre (default) … [1,1] bottom-right
  const pv = v2(P('pivot'), [.5, .5]);
  if (type === 'solid') { const s = v2(P('size'), [W, H]); g.fillStyle = paint(g, L.color, t, L) || '#000'; g.fillRect(-s[0] * pv[0], -s[1] * pv[1], s[0], s[1]); return; }
  if (type === 'rect' || type === 'ellipse') {
    const s = v2(P('size'), [100, 100]); g.beginPath();
    if (type === 'rect') g.roundRect(-s[0] * pv[0], -s[1] * pv[1], s[0], s[1], Math.min(P('radius') || 0, s[0] / 2, s[1] / 2)); else g.ellipse(s[0] * (.5 - pv[0]), s[1] * (.5 - pv[1]), s[0] / 2, s[1] / 2, 0, 0, TAU);
    if (L.fill !== undefined) { g.fillStyle = paint(g, L.fill, t, L); g.fill(); }
    if (L.stroke) { g.strokeStyle = paint(g, L.stroke, t, L); g.lineWidth = P('strokeWidth') ?? 2; g.stroke(); }
    return;
  }
  if (type === 'path') { // SVG path data or a logo name from logos.js, drawn centred at `size` px wide
    const d = P('d') || P('logo'), lg = LOGOS[d], path = lg ? (LP[d] || (LP[d] = new Path2D(lg.d))) : (L._p || (L._p = new Path2D(d)));
    const vb = lg ? [lg.w, lg.h] : v2(L.viewBox, [24, 24]), k = (P('size') ?? vb[0]) / vb[0];
    g.scale(k, k); g.translate(-vb[0] / 2, -vb[1] / 2);
    const tp = P('trim'); // stroke trim 0..1 (After Effects Trim Paths end)
    if (L.fill !== undefined && tp === undefined) { g.fillStyle = paint(g, L.fill, t, L); g.fill(path); }
    if (L.stroke) { g.strokeStyle = paint(g, L.stroke, t, L); g.lineWidth = (P('strokeWidth') ?? 2) / k; g.lineCap = 'round'; if (tp !== undefined) { const len = L.pathLength || 1000; g.setLineDash([len * tp, len]); } g.stroke(path); }
    return;
  }
  if (type === 'image') {
    const img = IMG[L.src]; if (!img) throw new Error(`image "${L.src}" not loaded`);
    const s = v2(P('size'), [img.width, img.height]), r = P('radius');
    if (r) { g.beginPath(); g.roundRect(-s[0] * pv[0], -s[1] * pv[1], s[0], s[1], r); g.clip(); }
    g.drawImage(img, -s[0] * pv[0], -s[1] * pv[1], s[0], s[1]); return;
  }
  if (type === 'text') return drawText(g, L, t);
  if (type === 'custom') return L.draw(g, t, L); // escape hatch: any canvas code, already in layer space
  throw new Error(`unknown layer type "${type}" ("${L.name}")`);
}

// ---------------------------------------------------------------- text with After Effects-style animators
// text, font, weight, size, fill, stroke, align, tracking, lineHeight, reveal (typewriter 0..1)
// animator: { by: 'char'|'word'|'line', start, stagger, dur, ease, order: 'forward'|'reverse'|'center'|'random',
//             from: { opacity, x, y, scale, rotation, blur } }  — each unit animates from `from` to rest
function drawText(g, L, t) {
  const P = k => val(L[k], t, L), str = String(P('text') ?? ''), size = P('size') ?? 64, tr = P('tracking') ?? 0, lh = (P('lineHeight') ?? 1.2) * size;
  g.font = `${P('weight') ?? 600} ${size}px ${fam(P('font') || 'Inter')}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  const lines = str.split('\n'), align = P('align') || 'center', A = L.animator, by = A?.by || 'char';
  // lay out units (char / word / line) with their resting x, y
  const units = []; lines.forEach((ln, li) => {
    const chars = [...ln], ws = chars.map(c => g.measureText(c).width + tr), w = ws.reduce((a, b) => a + b, 0) - (chars.length ? tr : 0);
    let x = align === 'center' ? -w / 2 : align === 'right' ? -w : 0; const y = (li - (lines.length - 1) / 2) * lh;
    let word = null; chars.forEach((c, ci) => {
      if (by === 'char') units.push({ s: c, x, y, w: ws[ci] });
      else if (by === 'word') { if (c === ' ') word = null; else { if (!word) units.push(word = { s: '', x, y, w: 0 }); word.s += c; word.w = x + ws[ci] - word.x; } }
      x += ws[ci];
    });
    if (by === 'line') units.push({ s: ln, x: align === 'center' ? -w / 2 : align === 'right' ? -w : 0, y, w });
  });
  const fill = paint(g, L.fill ?? '#fff', t, L), stroke = L.stroke && paint(g, L.stroke, t, L), rev = P('reveal'), shown = rev === undefined ? 1e9 : Math.floor(rev * units.length + 1e-6);
  const n = units.length, base = g.globalAlpha, order = A?.order || 'forward';
  units.forEach((u, i) => {
    if (i >= shown) return; if (u.s === ' ') return;
    let a = 1, dx = 0, dy = 0, sc = 1, rot = 0, bl = 0;
    if (A) {
      const rank = order === 'reverse' ? n - 1 - i : order === 'center' ? Math.abs(i - (n - 1) / 2) : order === 'random' ? Math.floor(rnd(i + 3) * n) : i;
      const st = T(A.start ?? 0) + rank * (A.stagger ?? .03), p = easeFn(A.ease || 'out')(clamp((t - st) / (A.dur ?? .5))), f = A.from || {}, q = 1 - p;
      a = lerp(f.opacity ?? 100, 100, p) / 100; dx = (f.x ?? 0) * q; dy = (f.y ?? 0) * q; sc = lerp((f.scale ?? 100) / 100, 1, p); rot = (f.rotation ?? 0) * q; bl = (f.blur ?? 0) * q;
      if (a <= 0) return;
    }
    g.save(); g.globalAlpha = base * clamp(a); g.translate(u.x + u.w / 2 + dx, u.y + dy); g.rotate(rot * Math.PI / 180); g.scale(sc, sc);
    if (bl > .3) g.filter = `blur(${bl.toFixed(1)}px)`;
    const draw = (s, x) => { if (fill) { g.fillStyle = fill; g.fillText(s, x, 0); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = P('strokeWidth') ?? 2; g.strokeText(s, x, 0); } };
    if (tr && u.s.length > 1) { let x = -u.w / 2; for (const c of u.s) { draw(c, x); x += g.measureText(c).width + tr; } } else draw(u.s, -u.w / 2);
    g.restore();
  });
}

// font families with spaces or digits must be quoted in a CSS font string; agents shouldn't have to know that
const fam = f => /^['"]/.test(f) || !/[\s\d]/.test(f) ? f : `"${f}"`;
const fontSpec = s => s.replace(/^(.*?\d+px )(.+)$/, (_, a, f) => a + fam(f));

// ---------------------------------------------------------------- comp → frame
function renderComp(g, comp, t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.fillStyle = comp.background || '#000'; g.fillRect(0, 0, W, H);
  const cam = comp.camera ? localMatrix({ ...comp.camera, position: comp.camera.position ?? [W / 2, H / 2], anchor: comp.camera.anchor ?? [W / 2, H / 2] }, t) : new DOMMatrix();
  renderLayers(g, comp.layers, t, cam, comp);
}
// wire a comp into the reelsmith harness (engine.js + reel.mjs): fonts, images, beats, then one full-length scene
function motionVideo(comp) {
  const imgs = {}; const walk = (Ls, child) => Ls.forEach(L => { L._child = child; if (L.type === 'image') imgs[L.src] = L.src; if (L.layers) walk(L.layers, true); }); walk(comp.layers, false);
  return {
    fonts: (comp.fonts || ['600 30px Inter']).map(fontSpec), images: imgs, captions: [],
    scenes: [{ s: 0, e: 1e9, f: (c, t) => { renderComp(c, comp, t); return 0; }, light: comp.light || 0 }],
    async prerender() {
      if (comp.beats) { const b = typeof comp.beats === 'string' ? await (await fetch(comp.beats)).json() : comp.beats; Object.assign(MOTION, { hits: b.hits || b, onsets: (b.onsets || []).map(o => o[0] ?? o), kicks: (b.kicks || []).map(o => o[0] ?? o), period: b.period || 0 }); }
      Object.assign(MOTION.markers, comp.markers || {});
    },
  };
}
