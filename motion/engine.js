// reelsmith engine: a deterministic canvas renderer for motion-graphics reels.
// project.json sets size / fps / duration; video.js defines VIDEO (scenes, captions, assets).
// renderFrame(t) always draws the same picture for the same t, so frames can be rendered in parallel.

let W = 1080, H = 1920, FPS = 30, DUR = 10, PROJECT = {};
let cv, ctx, buf, layer;
const IMG = {};
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---------- math ----------
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const back = t => { const c1 = 1.6, c3 = c1 + 1; return t <= 0 ? 0 : t >= 1 ? 1 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const rnd = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
// Smooth keyframes through measured [[time, value], ...] (monotone cubic: no overshoot, eases at both ends).
// This is how camera moves are matched to a reference: sample positions from frames, feed them here.
function kf(t, K) {
  const n = K.length; if (t <= K[0][0]) return K[0][1]; if (t >= K[n - 1][0]) return K[n - 1][1];
  let i = 0; while (t > K[i + 1][0]) i++;
  const sl = j => (K[j + 1][1] - K[j][1]) / (K[j + 1][0] - K[j][0]);
  const tan = j => { if (j === 0 || j === n - 1) return 0; const a = sl(j - 1), b = sl(j); return a * b <= 0 ? 0 : 2 / (1 / a + 1 / b); };
  const h = K[i + 1][0] - K[i][0], s = (t - K[i][0]) / h, m0 = tan(i) * h, m1 = tan(i + 1) * h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * K[i][1] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * K[i + 1][1] + (s3 - s2) * m1;
}
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; }
function rgba(h, a) { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; }
// camera: scale s and rotate r around focus (fx, fy), then shift by (dx, dy)
function cam(c, s = 1, fx = W / 2, fy = H / 2, dx = 0, dy = 0, r = 0) { c.translate(fx + dx, fy + dy); c.rotate(r); c.scale(s, s); c.translate(-fx, -fy); }

// ---------- brand marks (logos.js: { name: { d, w, h } }) ----------
const LP = {};
// size = drawn width of the mark's viewBox. fill: colour string, or fn(c) returning a gradient in viewBox units.
function logo(c, name, cx, cy, size, fill, o = {}) {
  const L = LOGOS[name]; if (!L) throw new Error(`logo "${name}" missing from logos.js`);
  const s = size / L.w; c.save(); c.globalAlpha *= (o.alpha ?? 1);
  c.translate(cx, cy); if (o.rot) c.rotate(o.rot); c.scale(s, s); c.translate(-L.w / 2 - (L.offset?.[0] || 0), -L.h / 2 - (L.offset?.[1] || 0));
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = (o.glowR || 30) / s; }
  c.fillStyle = typeof fill === 'function' ? fill(c) : fill; c.fill(LP[name]);
  if (o.wash) { c.shadowBlur = 0; c.fillStyle = `rgba(255,255,255,${o.wash})`; c.fill(LP[name]); }
  c.restore();
}

// ---------- text & UI ----------
function txt(c, s, x, y, font, color, o = {}) {
  c.save(); c.globalAlpha *= (o.alpha ?? 1); c.font = font; c.fillStyle = color; c.textAlign = o.align || 'center'; c.textBaseline = o.base || 'middle';
  if (o.ls) c.letterSpacing = o.ls + 'px'; if (o.shadow) { c.shadowColor = o.shadow; c.shadowBlur = o.shadowBlur ?? 16; }
  c.fillText(s, x, y); c.restore();
}
// font size that makes `text` exactly `width` px wide (match a reference caption by its measured width)
function fitFont(text, width, weight = 500, family = 'Poppins') { ctx.save(); ctx.font = `${weight} 100px ${family}`; const w = ctx.measureText(text).width; ctx.restore(); return 100 * width / w; }
function pill(c, x, y, w, h, fill, text, tcol, o = {}) {
  c.save(); c.globalAlpha *= (o.alpha ?? 1); if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = o.glowR ?? 14; }
  c.fillStyle = fill; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, h / 2); c.fill(); c.shadowBlur = 0;
  if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.lineWidth ?? 1.5; c.stroke(); }
  if (text) { c.font = `${o.weight || 600} ${o.size || h * .45}px ${o.family || 'Poppins'}`; c.fillStyle = tcol; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 1); }
  c.restore();
}

// ---------- backgrounds & lighting ----------
function bgLight(c, inner = '#F1F1F2', outer = '#CDCDD0', cy = H * .47, r = 1250) {
  c.fillStyle = outer; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, cy, 80, W / 2, cy, r); g.addColorStop(0, inner); g.addColorStop(.55, mix(inner, outer, .35)); g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function glow(c, x, y, r, color, a = 1) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
// draw fn into a layer, mirror it under the floor line fy, fade it into the floor colour, then draw the object
function reflect(c, fy, fn, o = {}) {
  const l = layer.getContext('2d'); l.setTransform(1, 0, 0, 1, 0, 0); l.globalAlpha = 1; l.filter = 'none'; l.clearRect(0, 0, W, H); fn(l);
  c.save(); c.beginPath(); c.rect(0, fy, W, H - fy); c.clip(); c.globalAlpha = o.alpha ?? .2; c.translate(0, 2 * fy); c.scale(1, -1); c.drawImage(layer, 0, 0); c.restore();
  const fc = o.floor || '#000000', fade = o.fade ?? 320;
  const g = c.createLinearGradient(0, fy, 0, fy + fade); g.addColorStop(0, rgba(fc, 0.2)); g.addColorStop(1, rgba(fc, 1));
  c.fillStyle = g; c.fillRect(0, fy, W, fade); c.fillStyle = fc; c.fillRect(0, fy + fade - 1, W, H);
  c.drawImage(layer, 0, 0);
}

// ---------- paper-cut kit ----------
// stop-motion feel: hold each pose for 1/fps s (12 = classic "on twos")
const boil = (t, fps = 12) => Math.floor(t * fps) / fps;
// roughen a polygon's edges like torn/cut paper; seed changes per boil frame for a hand-made jitter
function torn(pts, seed = 1, amp = 6, step = 18) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
    const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
    for (let k = 0; k < n; k++) { const f = k / n, j = (rnd(seed * 97 + i * 31 + k) - .5) * 2 * amp; out.push([lerp(x0, x1, f) + nx * j, lerp(y0, y1, f) + ny * j]); }
  }
  return out;
}
let GRAIN;
// one paper layer: soft drop shadow (depth), flat fill, fibre grain, light top edge
function paper(c, pts, o = {}) {
  const path = new Path2D(); pts.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y)); path.closePath();
  c.save(); c.shadowColor = o.shadow || 'rgba(0,0,0,0.28)'; c.shadowBlur = o.depth ?? 18; c.shadowOffsetY = (o.depth ?? 18) * .45; c.shadowOffsetX = (o.depth ?? 18) * .15;
  c.fillStyle = o.fill || '#F2E8D5'; c.fill(path); c.restore();
  if (o.grain !== 0) { c.save(); c.clip(path); c.globalAlpha = o.grain ?? .18; c.globalCompositeOperation = 'multiply'; c.drawImage(GRAIN, 0, 0, W, H); c.restore(); }
  if (o.edge !== false) { c.save(); c.strokeStyle = o.edgeColor || 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.stroke(path); c.restore(); }
  return path;
}

// ---------- frame ----------
let CAPSIZE = 50;
function renderFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const S = VIDEO.scenes, sc = S.find(s => t >= s.s && t < s.e) || S[S.length - 1];
  const b = buf.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over'; b.filter = 'none'; b.shadowBlur = 0;
  const blur = sc.f(b, t) || 0; // a scene may return a blur radius (motion blur on whips and zooms)
  if (blur > 0.3) { ctx.filter = `blur(${blur.toFixed(1)}px)`; ctx.drawImage(buf, -40, -40, W + 80, H + 80); ctx.filter = 'none'; } else ctx.drawImage(buf, 0, 0);
  const K = VIDEO.caption || {}, cap = (VIDEO.captions || []).find(k => t >= k[0] && t < k[1]);
  if (cap) {
    const a = clamp((t - cap[0]) / (K.fadeIn ?? .08)) * clamp((cap[1] - t) / (K.fadeOut ?? .05));
    ctx.save(); ctx.globalAlpha = a; ctx.font = `${K.weight ?? 500} ${CAPSIZE}px ${K.family || 'Poppins'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lt = typeof sc.light === 'function' ? sc.light(t) : sc.light; ctx.fillStyle = lt ? (K.onLight || '#161616') : (K.onDark || '#FFFFFF'); if (K.shadow && !lt) { ctx.shadowColor = K.shadow; ctx.shadowBlur = 16; }
    ctx.fillText(cap[2], W / 2, K.y ?? H * .16); ctx.restore();
  }
  if (VIDEO.overlay) { ctx.save(); VIDEO.overlay(ctx, t); ctx.restore(); }
}

async function boot() {
  PROJECT = await (await fetch('project.json')).json();
  W = PROJECT.width || 1080; H = PROJECT.height || 1920; FPS = PROJECT.fps || 30; DUR = PROJECT.duration || 10;
  cv = document.getElementById('c'); cv.width = W; cv.height = H; ctx = cv.getContext('2d'); buf = mk(); layer = mk();
  for (const k in LOGOS) LP[k] = new Path2D(LOGOS[k].d);
  await Promise.all(Object.entries(VIDEO.images || {}).map(([k, src]) => new Promise((ok, no) => { const i = new Image(); i.onload = () => { IMG[k] = i; ok(); }; i.onerror = () => no(new Error('image ' + src)); i.src = src; })));
  await Promise.all((VIDEO.fonts || ['500 30px Poppins']).map(f => document.fonts.load(f)));
  GRAIN = mk(540, 960); { const g = GRAIN.getContext('2d'), d = g.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = 200 + rnd(i) * 55; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }
  const K = VIDEO.caption || {}; CAPSIZE = typeof K.size === 'number' ? K.size : K.fit ? fitFont(K.fit[0], K.fit[1], K.weight ?? 500, K.family || 'Poppins') : 50;
  if (VIDEO.prerender) await VIDEO.prerender();
  renderFrame(parseFloat(new URLSearchParams(location.search).get('t') || '0'));
  window.grab = t => { renderFrame(t); return cv.toDataURL('image/jpeg', 0.94); };
  return { W, H, FPS, DUR };
}
