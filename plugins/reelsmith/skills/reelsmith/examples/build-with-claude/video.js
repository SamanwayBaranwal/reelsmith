// "Build with Claude" v2 — 12.9 s, 16:9. Motion is driven by curves measured frame-by-frame from ref/original.mp4
// (spark size, camera, arrow path, laptop spin, planet drop) so every move snaps on the same musical hits.
// Real Claude mark (Simple Icons, official path) · three.js laptop with studio lighting · Source Serif 4 + DM Sans.
const SERIF = "'Source Serif 4'", SANS = 'Inter', DISP = "'DM Sans'";
const smooth = x => x * x * (3 - 2 * x);
const expoOut = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const CL = { coral: '#D97757', peach: '#F2A07F', cream: '#FFF3DE', ui: '#232220', uiText: '#E8E4DE', uiMuted: '#8A8580' };
// piecewise keys with per-segment easing: [[t, v, ease?], ...] ease ∈ 'o' (expo out, snappy), 'b' (back overshoot), 's' (smooth), 'l' (linear)
function seg(t, K) {
  if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t <= K[i][0]) {
    const p = (t - K[i - 1][0]) / (K[i][0] - K[i - 1][0]), e = K[i][2] || 's', f = e === 'o' ? expoOut(p) : e === 'b' ? back(p) : e === 'l' ? p : smooth(p);
    return lerp(K[i - 1][1], K[i][1], f); }
  return K[K.length - 1][1];
}

// ---------------------------------------------------------------- the real Claude mark (24×24 official path)
function spark(c, x, y, r, o = {}) {
  c.save(); c.globalAlpha *= (o.alpha ?? 1); c.translate(x, y); c.rotate(o.rot || 0);
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = r * (o.glowK || .6); }
  const s = (r * 2) / 24; c.scale(s, s); c.translate(-12, -12); c.fillStyle = o.color || CL.coral; c.fill(LP.claude); c.restore();
}
function star(c, x, y, r, n, inner, rot, fill) {
  c.beginPath(); for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r * inner : r, a = rot + i * Math.PI / n - Math.PI / 2; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fillStyle = fill; c.fill();
}
let SWOOSH;
function prerenderSwoosh() {
  SWOOSH = mk(1400, 1400); const g = SWOOSH.getContext('2d'); g.filter = 'blur(60px)';
  const gr = g.createLinearGradient(200, 200, 1200, 1200); gr.addColorStop(0, 'rgba(240,140,90,0)'); gr.addColorStop(.45, 'rgba(240,140,90,0.7)'); gr.addColorStop(1, 'rgba(240,140,90,0)');
  g.strokeStyle = gr; g.lineWidth = 150; g.lineCap = 'round'; g.beginPath(); g.arc(700, 700, 440, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
}
// spark diameter measured from the reference every 0.1 s (warm-pixel bounding box)
const SPK_D = [[0.15, 0], [0.2, 28], [0.3, 104], [0.4, 150], [0.5, 240], [0.6, 334], [0.7, 392], [0.8, 428], [0.9, 464], [1.0, 492], [1.1, 520], [1.2, 536], [1.3, 544], [1.4, 553], [1.5, 544], [1.6, 476], [1.7, 364], [1.8, 404], [1.9, 532], [2.0, 632], [2.1, 640], [2.2, 648], [2.3, 664], [2.4, 664], [2.5, 616], [2.6, 484], [2.7, 448], [2.8, 430], [2.9, 410], [3.0, 340], [3.07, 70]];
function scSpark(c, t) {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const D = kf(t, SPK_D), cx = kf(t, [[0.2, 942], [0.7, 984], [1.4, 984], [2.0, 960], [2.6, 962], [3.07, 975]]), cy = kf(t, [[0.2, 484], [0.7, 542], [1.0, 548], [1.4, 520], [2.0, 522], [2.6, 522], [3.07, 600]]);
  const out = smooth(prog(t, 2.95, 3.07));
  glow(c, cx, cy, Math.max(60, D * .95), '#E8835A', .3 * prog(t, .15, .7));
  c.save(); c.globalAlpha = .5 * prog(t, .3, 1.0) * (1 - out); c.translate(cx, cy); c.rotate(-0.6 + t * .55); const sw = D / 560; c.scale(sw, sw); c.drawImage(SWOOSH, -700, -700); c.restore();
  const R = D / 2;
  c.save(); c.shadowColor = 'rgba(255,190,140,0.75)'; c.shadowBlur = 70;
  if (t < 0.95) { // pie petals sweeping in, faceted cream/peach
    const n = Math.min(6, Math.floor(prog(t, .15, .9) * 6.99));
    for (let i = 0; i <= n; i++) { const a0 = -Math.PI / 2 + i * TAU / 6 + t * .5, k = i === n ? prog(t, .15 + i * .125, .15 + (i + 1) * .125) : 1; if (k <= 0) continue;
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R * (i % 2 ? .84 : 1), a0, a0 + TAU / 6 * k); c.closePath(); c.fillStyle = [CL.cream, '#F7C9A6', '#E9A07E'][i % 3]; c.fill(); }
  } else if (t < 1.55) star(c, cx, cy, R, 5, .47, (t - .95) * .7, mix('#FFFFFF', CL.cream, prog(t, .95, 1.55)));
  else if (t < 1.88) { const p = smooth(prog(t, 1.55, 1.88)), n = Math.round(lerp(5, 11, p)); star(c, cx, cy, R, n, lerp(.5, .72, p), (t - 1) * 2.2, mix('#FFF6E4', '#F6B28E', p)); }
  c.restore();
  if (t >= 1.82) { const p = smooth(prog(t, 1.82, 1.98));
    spark(c, cx, cy, R * 1.04, { rot: (t - 2) * .32, color: mix('#F9C2A0', CL.coral, prog(t, 2.0, 2.7)), alpha: p, glow: 'rgba(240,150,110,0.6)' }); }
  const ca = smooth(prog(t, 2.55, 2.72)) * (1 - out); if (ca > 0) txt(c, 'Claude', cx, cy + 315, `400 66px ${SERIF}`, '#F4EDE6', { alpha: ca });
  return 0;
}

// ---------------------------------------------------------------- chat UI (world = the 4.2 s full view)
function uiBackground(c) {
  c.fillStyle = '#0A0909'; c.fillRect(0, 0, W, H);
  for (const [x0, x1] of [[0, 240], [W, W - 240]]) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(190,85,40,0.2)'); g.addColorStop(1, 'rgba(190,85,40,0)'); c.fillStyle = g; c.fillRect(Math.min(x0, x1), 0, 240, H); }
  c.save(); c.strokeStyle = 'rgba(160,70,35,0.14)'; c.lineWidth = 1.5;
  for (let i = -16; i <= 16; i++) { c.beginPath(); c.moveTo(960 + i * 40, 640); c.lineTo(960 + i * 220, H + 40); c.stroke(); }
  for (let k = 0; k < 9; k++) { const y = 640 + Math.pow(k / 8, 1.8) * 460; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  const fade = c.createLinearGradient(0, 600, 0, 760); fade.addColorStop(0, '#0A0909'); fade.addColorStop(1, 'rgba(10,9,9,0)'); c.fillStyle = fade; c.fillRect(0, 600, W, 160); c.restore();
}
const PROMPT = 'Build a finance SaaS';
function chatWorld(c, t, dim = 0) {
  // heading
  const head = "Welcome, yowerse", hn = Math.floor(prog(t, 3.09, 3.46) * head.length + .001);
  c.save(); c.font = `400 64px ${SERIF}`; const hw = c.measureText(head).width, hx = 960 - (hw + 70) / 2;
  spark(c, hx + 22, 373, 30, { rot: t * .3, w: .15 }); c.fillStyle = mix('#E8E4DE', '#3A3836', dim); c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(head.slice(0, hn), hx + 70, 376); c.restore();
  // input box
  const bx = 283, by = 490, bw = 1348, bh = 240;
  c.save(); c.shadowColor = `rgba(230,110,60,${.35 * (1 - dim)})`; c.shadowBlur = 50; c.shadowOffsetY = 18; c.fillStyle = mix(CL.ui, '#121110', dim); c.beginPath(); c.roundRect(bx, by, bw, bh, 40); c.fill(); c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2; c.beginPath(); c.roundRect(bx, by, bw, bh, 40); c.stroke();
  c.save(); c.beginPath(); c.roundRect(bx, by, bw, bh, 40); c.clip(); const tg = c.createLinearGradient(bx, 0, bx + bw, 0); tg.addColorStop(0, 'rgba(230,120,70,0)'); tg.addColorStop(.5, `rgba(240,130,80,${.75 * (1 - dim)})`); tg.addColorStop(1, 'rgba(230,120,70,0)');
  c.fillStyle = tg; c.fillRect(bx, by, bw, 3); c.restore();
  const n = Math.floor(prog(t, 4.55, 5.36) * PROMPT.length + .001);
  c.save(); c.font = `400 30px ${SANS}`; c.textBaseline = 'middle'; c.textAlign = 'left';
  if (n === 0) { c.fillStyle = CL.uiMuted; c.fillText('How can I help you today?', bx + 38, by + 59); }
  else { const s = PROMPT.slice(0, n), fresh = Math.max(0, n - 2); c.fillStyle = mix(CL.uiText, '#5A5754', dim); c.fillText(s.slice(0, fresh), bx + 38, by + 59); c.fillStyle = CL.peach; c.fillText(s.slice(fresh), bx + 38 + c.measureText(s.slice(0, fresh)).width, by + 59); }
  c.restore();
  txt(c, '+', bx + 64, by + 187, `300 44px ${SANS}`, mix('#CFCAC4', '#3A3836', dim));
  // model chip
  c.save(); c.globalAlpha = 1 - dim * .7; c.fillStyle = '#2F2E2C'; c.beginPath(); c.roundRect(1173, 160 + by, 267, 54, 14); c.fill();
  txt(c, 'Fable 5', 1198, 187 + by, `500 25px ${SANS}`, CL.uiText, { align: 'left' }); txt(c, 'High', 1300, 187 + by, `400 25px ${SANS}`, CL.uiMuted, { align: 'left' });
  c.strokeStyle = CL.uiMuted; c.lineWidth = 2.5; c.beginPath(); c.moveTo(1405, 183 + by); c.lineTo(1413, 191 + by); c.lineTo(1421, 183 + by); c.stroke(); c.restore();
  // mic + voice / send
  c.save(); c.globalAlpha = 1 - dim * .8; c.strokeStyle = '#CFCAC4'; c.lineWidth = 3; c.beginPath(); c.roundRect(1476, 170 + by, 14, 24, 7); c.stroke(); c.beginPath(); c.arc(1483, 188 + by, 13, 0, Math.PI); c.stroke(); c.restore();
  const sendOn = smooth(prog(t, 5.8, 5.92)), press = prog(t, 6.3, 6.38) * (1 - prog(t, 6.42, 6.55));
  if (sendOn < 1) { c.save(); c.globalAlpha = 1 - sendOn; c.fillStyle = '#CFCAC4'; [10, 20, 14, 24, 12].forEach((h, i) => c.fillRect(1553 + i * 7, 187 + by - h / 2, 4, h)); c.restore(); }
  if (sendOn > 0) { const k = 1 - press * .08, glowA = .35 + .65 * prog(t, 6.3, 6.45);
    c.save(); c.globalAlpha = sendOn; c.translate(1572, 187 + by); c.scale(k, k); c.shadowColor = `rgba(245,140,70,${glowA})`; c.shadowBlur = 40 + 60 * prog(t, 6.3, 6.5);
    const g = c.createLinearGradient(0, -32, 0, 32); g.addColorStop(0, t > 6.3 ? '#F9B27C' : '#E07A55'); g.addColorStop(1, t > 6.3 ? '#F08A4C' : CL.coral); c.fillStyle = g; c.beginPath(); c.roundRect(-32, -32, 64, 64, 14); c.fill(); c.shadowBlur = 0;
    if (t < 6.55) { c.strokeStyle = '#FFF'; c.lineWidth = 4.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 14); c.lineTo(0, -14); c.moveTo(-11, -3); c.lineTo(0, -14); c.lineTo(11, -3); c.stroke(); }
    c.restore(); }
  if (t > 6.55) { const p = smooth(prog(t, 6.55, 6.95)); c.save(); c.globalAlpha = Math.min(1, p * 3) * (1 - prog(t, 6.85, 6.97)); c.translate(1572, 187 + by - p * 150); c.strokeStyle = '#FFF'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 16); c.lineTo(0, -16); c.moveTo(-13, -3); c.lineTo(0, -16); c.lineTo(13, -3); c.stroke(); c.restore(); }
}

// ---------------------------------------------------------------- textured 3D quads
function triTex(c, img, s0, s1, s2, t0, t1, t2) {
  c.save(); c.beginPath(); const cxm = (s0[0] + s1[0] + s2[0]) / 3, cym = (s0[1] + s1[1] + s2[1]) / 3, ex = p => [p[0] + (p[0] - cxm) * .02, p[1] + (p[1] - cym) * .02];
  const a = ex(s0), b = ex(s1), d = ex(s2); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.clip();
  const den = t0[0] * (t1[1] - t2[1]) + t1[0] * (t2[1] - t0[1]) + t2[0] * (t0[1] - t1[1]); if (Math.abs(den) < 1e-6) { c.restore(); return; }
  const m11 = (s0[0] * (t1[1] - t2[1]) + s1[0] * (t2[1] - t0[1]) + s2[0] * (t0[1] - t1[1])) / den, m12 = (s0[0] * (t2[0] - t1[0]) + s1[0] * (t0[0] - t2[0]) + s2[0] * (t1[0] - t0[0])) / den;
  const m13 = (s0[0] * (t1[0] * t2[1] - t2[0] * t1[1]) + s1[0] * (t2[0] * t0[1] - t0[0] * t2[1]) + s2[0] * (t0[0] * t1[1] - t1[0] * t0[1])) / den;
  const m21 = (s0[1] * (t1[1] - t2[1]) + s1[1] * (t2[1] - t0[1]) + s2[1] * (t0[1] - t1[1])) / den, m22 = (s0[1] * (t2[0] - t1[0]) + s1[1] * (t0[0] - t2[0]) + s2[1] * (t1[0] - t0[0])) / den;
  const m23 = (s0[1] * (t1[0] * t2[1] - t2[0] * t1[1]) + s1[1] * (t2[0] * t0[1] - t0[0] * t2[1]) + s2[1] * (t0[0] * t1[1] - t1[0] * t0[1])) / den;
  c.transform(m11, m21, m12, m22, m13, m23); c.drawImage(img, 0, 0); c.restore();
}
// P = 4 projected corners (tl, tr, br, bl) → image mapped with an n×n grid (perspective-correct enough)
function texQuad(c, img, P, n = 8, uvP) {
  const bil = (u, v) => { const top = [lerp(P[0][0], P[1][0], u), lerp(P[0][1], P[1][1], u)], bot = [lerp(P[3][0], P[2][0], u), lerp(P[3][1], P[2][1], u)]; return [lerp(top[0], bot[0], v), lerp(top[1], bot[1], v)]; };
  const at = uvP || bil, iw = img.width, ih = img.height;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n, a = at(u0, v0), b = at(u1, v0), d = at(u1, v1), e = at(u0, v1);
    triTex(c, img, a, b, d, [u0 * iw, v0 * ih], [u1 * iw, v0 * ih], [u1 * iw, v1 * ih]); triTex(c, img, a, d, e, [u0 * iw, v0 * ih], [u1 * iw, v1 * ih], [u0 * iw, v1 * ih]);
  }
}
function rot3(p, rx, ry, rz) { let [x, y, z] = p;
  let c1 = Math.cos(rz), s1 = Math.sin(rz); [x, y] = [x * c1 - y * s1, x * s1 + y * c1];
  c1 = Math.cos(ry); s1 = Math.sin(ry); [x, z] = [x * c1 + z * s1, -x * s1 + z * c1];
  c1 = Math.cos(rx); s1 = Math.sin(rx); [y, z] = [y * c1 - z * s1, y * s1 + z * c1]; return [x, y, z]; }
const P3 = (p, cx, cy, f = 1800) => { const s = f / (f + p[2]); return [cx + p[0] * s, cy + p[1] * s, p[2]]; };
// a flat card in 3D (perspective-correct texture via per-point projection)
function card3D(c, img, cx, cy, w, h, rx, ry, rz, o = {}) {
  const at = (u, v) => P3(rot3([(u - .5) * w, (v - .5) * h, 0], rx, ry, rz), cx, cy, o.f || 1800);
  c.save(); c.globalAlpha *= (o.alpha ?? 1);
  const P = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
  c.shadowColor = 'rgba(0,0,0,0.18)'; c.shadowBlur = 50; c.shadowOffsetY = 24; c.fillStyle = '#FFF'; c.beginPath(); P.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); c.shadowBlur = 0;
  texQuad(c, img, P, 7, at); c.restore();
}

// ---------------------------------------------------------------- dashboards (prerendered)
const DASH = {};
function dashboard(kind) {
  const cv2 = mk(1200, 760), g = cv2.getContext('2d'), dark = kind !== 'white' && kind !== 'blue';
  const T = { white: ['#FFFFFF', '#F6F6F7', '#1C1C1C', '#F07A2E'], green: ['#0E1D14', '#13281B', '#EAF5EC', '#3DDC84'], purple: ['#1B1030', '#271743', '#F1E9FF', '#FF8A3D'], blue: ['#FFFFFF', '#F1F5FF', '#16213A', '#2F6BFF'] }[kind];
  g.fillStyle = T[0]; g.fillRect(0, 0, 1200, 760); g.fillStyle = T[1]; g.fillRect(0, 0, 210, 760);
  if (kind === 'purple') { const r = g.createRadialGradient(900, 650, 50, 900, 650, 600); r.addColorStop(0, 'rgba(255,120,60,0.55)'); r.addColorStop(1, 'rgba(255,120,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 1200, 760); }
  const tx = (s, x, y, sz, col, w = 500) => { g.font = `${w} ${sz}px Inter`; g.fillStyle = col; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  tx('Opal Finance', 28, 44, 22, T[2], 700);
  ['Dashboard', 'Portfolio', 'Markets', 'Transfers', 'Settings'].forEach((s, i) => { g.fillStyle = i === 0 ? rgba(T[3], .18) : 'rgba(0,0,0,0)'; g.beginPath(); g.roundRect(18, 92 + i * 52, 175, 40, 10); g.fill(); tx(s, 54, 112 + i * 52, 17, dark ? 'rgba(255,255,255,0.7)' : '#555', 500); g.fillStyle = T[3]; g.beginPath(); g.arc(36, 112 + i * 52, 6, 0, TAU); g.fill(); });
  tx('Welcome Yowerse', 240, 48, 30, T[2], 700); tx('Here is your portfolio today', 240, 82, 15, dark ? 'rgba(255,255,255,0.55)' : '#8A8A8A', 400);
  for (let i = 0; i < 2; i++) { g.fillStyle = T[3]; g.beginPath(); g.arc(1110 + i * 42, 48, 15, 0, TAU); g.fill(); }
  g.fillStyle = dark ? 'rgba(255,255,255,0.05)' : '#FAFAFA'; g.beginPath(); g.roundRect(240, 110, 420, 260, 16); g.fill(); g.beginPath(); g.roundRect(680, 110, 480, 260, 16); g.fill();
  tx('Total Holding', 262, 140, 15, dark ? 'rgba(255,255,255,0.6)' : '#888', 500); tx('$12,304.11', 262, 186, 40, T[2], 700);
  g.fillStyle = T[3]; g.beginPath(); g.roundRect(262, 230, 150, 38, 19); g.fill(); tx('Deposit', 302, 249, 16, '#FFF', 600);
  for (let i = 0; i < 4; i++) { g.fillStyle = dark ? 'rgba(255,255,255,0.08)' : '#EEE'; g.fillRect(262, 296 + i * 18, 320 - i * 50, 8); }
  ['BTC', 'ETH', 'SOL', 'USDC'].forEach((s, i) => { const y = 145 + i * 54; g.fillStyle = rgba(T[3], .85 - i * .15); g.beginPath(); g.arc(712, y, 13, 0, TAU); g.fill(); tx(s, 736, y, 16, T[2], 600); tx(['+4.2%', '+1.8%', '-0.6%', '+0.1%'][i], 1080, y, 15, i === 2 ? '#E5484D' : T[3], 600); g.fillStyle = dark ? 'rgba(255,255,255,0.08)' : '#F0F0F0'; g.fillRect(830, y - 4, 200, 8); g.fillStyle = rgba(T[3], .7); g.fillRect(830, y - 4, 60 + i * 30, 8); });
  g.fillStyle = dark ? 'rgba(255,255,255,0.05)' : '#FAFAFA'; g.beginPath(); g.roundRect(240, 390, 920, 340, 16); g.fill(); tx(kind === 'green' ? 'Market overview' : 'Portfolio performance', 262, 422, 17, T[2], 600);
  const pts = Array.from({ length: 24 }, (_, i) => [270 + i * 37, 640 - 120 * Math.sin(i * .45) * .6 - i * 3.2 + (rnd(i * 3 + (kind.length)) - .5) * 60]);
  if (kind === 'green') pts.forEach(([x, y], i) => { const up = rnd(i + 9) > .4; g.fillStyle = up ? '#3DDC84' : '#E5484D'; g.fillRect(x - 6, y - 30, 12, 50 + rnd(i) * 30); g.fillRect(x - 1, y - 50, 2, 100); });
  else { const ar = g.createLinearGradient(0, 470, 0, 710); ar.addColorStop(0, rgba(T[3], .35)); ar.addColorStop(1, rgba(T[3], 0)); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineTo(1121, 710); g.lineTo(270, 710); g.closePath(); g.fillStyle = ar; g.fill();
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = T[3]; g.lineWidth = 3; g.stroke(); g.fillStyle = T[3]; g.beginPath(); g.roundRect(640, 560, 120, 34, 8); g.fill(); tx('$8,240', 662, 577, 15, '#FFF', 700); }
  if (kind === 'purple') { g.lineWidth = 18; g.strokeStyle = '#7A4CFF'; g.beginPath(); g.arc(1080, 250, 60, 0, TAU * .7); g.stroke(); g.strokeStyle = '#FF8A3D'; g.beginPath(); g.arc(1080, 250, 60, TAU * .7, TAU); g.stroke(); }
  return cv2;
}

// ---------------------------------------------------------------- chat scene camera (measured: close-up → flash 3.64 → snap out → hold → snap in 4.6 → pan 5.6 → push → dim 6.45)
let ICON = { x: 712, y: 373 };
function scChat(c, t) {
  const at = (zz, sx, sy, wx, wy) => [sx - zz * wx, sy - zz * wy];
  let z, Tx, Ty;
  if (t < 3.64) { z = seg(t, [[3.06, 2.05], [3.64, 1.75, 's']]); const sx = seg(t, [[3.06, 975], [3.64, 864, 's']]), sy = seg(t, [[3.06, 600], [3.64, 560, 's']]); [Tx, Ty] = at(z, sx, sy, ICON.x, ICON.y); }
  else if (t < 4.6) { z = seg(t, [[3.64, 1.6], [3.95, 1.0, 'o'], [4.6, .985, 's']]); const q = clamp((1.6 - z) / .6), a = at(z, 880, 560, ICON.x, ICON.y), b = [960 - z * 960, 540 - z * 560]; Tx = lerp(a[0], b[0], q); Ty = lerp(a[1], b[1], q); }
  else { z = seg(t, [[4.68, .985], [4.95, 1.9, 'o'], [5.66, 2.0, 's'], [5.94, 1.8, 'o'], [6.45, 2.25, 's'], [6.94, 2.35, 's']]);
    Tx = seg(t, [[4.68, 960 - .985 * 960], [4.95, -288, 'o'], [5.66, -340, 's'], [5.94, -1391, 'o'], [6.45, -2120, 's'], [6.94, -2230, 's']]);
    Ty = seg(t, [[4.68, 540 - .985 * 560], [4.95, -467, 'o'], [5.66, -500, 's'], [5.94, -376, 'o'], [6.45, -650, 's'], [6.94, -690, 's']]); }
  uiBackground(c);
  const dim = smooth(prog(t, 6.42, 6.66));
  c.save(); c.setTransform(z, 0, 0, z, Tx, Ty); chatWorld(c, t, dim); c.restore();
  const fl = 1 - prog(t, 3.64, 3.72); if (t >= 3.6 && fl > 0) { c.fillStyle = `rgba(255,255,255,${t < 3.64 ? prog(t, 3.6, 3.64) : fl})`; c.fillRect(0, 0, W, H); }
  return 0;
}

// ---------------------------------------------------------------- dashboards scene (arrow path measured every 0.1 s)
function arrow3D(c, x, y, s, rot, a = 1) {
  c.save(); c.globalAlpha *= a; c.translate(x, y); c.rotate(rot); c.scale(s / 100, s / 100);
  c.shadowColor = 'rgba(245,130,70,0.45)'; c.shadowBlur = 40;
  c.fillStyle = '#F07A3A'; c.beginPath(); c.moveTo(0, -55); c.lineTo(42, 45); c.lineTo(0, 22); c.closePath(); c.fill();
  c.fillStyle = '#FFA463'; c.beginPath(); c.moveTo(0, -55); c.lineTo(-42, 45); c.lineTo(0, 22); c.closePath(); c.fill(); c.restore();
}
// arrow path measured from the reference every ~0.06–0.1 s: rise, flip, dive through the card, exit left, ride in on the green card, sweep to the purple one
const ARROW = [[6.94, 1320, 990], [7.0, 1320, 868], [7.1, 1312, 594], [7.2, 1302, 412], [7.3, 1288, 270], [7.4, 1264, 164], [7.5, 1194, 180], [7.6, 1120, 358], [7.7, 1052, 570], [7.78, 890, 800],
  [7.84, 700, 940], [7.9, 475, 1000], [7.96, 250, 957], [8.02, 147, 870], [8.1, 95, 783], [8.2, 87, 650], [8.3, 87, 565], [8.45, 285, 435], [8.55, 683, 522], [8.65, 1280, 650],
  [8.75, 1435, 650], [8.85, 1513, 610], [9.0, 1670, 565], [9.12, 1705, 435], [9.2, 1712, 370]];
const AX = ARROW.map(a => [a[0], a[1]]), AY = ARROW.map(a => [a[0], a[2]]);
function scDash(c, t) {
  c.fillStyle = '#FCFCFC'; c.fillRect(0, 0, W, H);
  glow(c, 960, 540, 760, '#FBCDB8', .55 * prog(t, 6.94, 7.3));
  const st = seg(t, [[7.45, 0], [7.6, 1, 'o']]);
  if (st > 0) for (let i = 0; i < 11; i++) { const x = 120 + i * 170 + Math.sin(t * 2 + i) * 10, a = st * (.18 + .22 * rnd(i)); const g = c.createLinearGradient(x - 50, 0, x + 50, 0); g.addColorStop(0, 'rgba(250,180,150,0)'); g.addColorStop(.5, `rgba(250,180,150,${a})`); g.addColorStop(1, 'rgba(250,180,150,0)'); c.fillStyle = g; c.fillRect(x - 50, 0, 100, H); }
  const fadeW = c.createLinearGradient(0, 0, 0, H); fadeW.addColorStop(0, 'rgba(252,252,252,0.9)'); fadeW.addColorStop(.35, 'rgba(252,252,252,0)'); fadeW.addColorStop(.75, 'rgba(252,252,252,0)'); fadeW.addColorStop(1, 'rgba(252,252,252,0.95)'); c.fillStyle = fadeW; c.fillRect(0, 0, W, H);
  const z = seg(t, [[8.9, 1.0], [9.19, 1.07, 's']]); c.save(); cam(c, z, 960, 560);
  // side cards whip in with overshoot and settle where the reference has them (blue top-left behind, green left, purple top-right)
  const side = [['blue', 330, 150, 620, .2, 8.25, -1], ['green', 400, 540, 600, .15, 8.37, -1], ['purple', 1460, 410, 960, -.2, 8.47, 1]];
  side.forEach(([k, x, y, w, ry, t0, sgn]) => { const p = seg(t, [[t0, 0], [t0 + .2, 1.04, 'o'], [t0 + .34, 1, 's']]); if (p <= 0) return;
    card3D(c, DASH[k], x + sgn * (1 - p) * 1100, y + (1 - p) * 120, w, w * .632, (1 - p) * .4, ry + sgn * (1 - p) * 1.1, (1 - p) * .3 * sgn); });
  if (t >= 7.62) { // the card pops out where the arrow dives in (expo snap), then keeps a slow push-in on the beat
    const x = seg(t, [[7.62, 1010], [7.72, 843, 'o'], [7.96, 917, 's'], [8.3, 965, 's'], [9.0, 940, 's']]), y = seg(t, [[7.62, 640], [7.96, 650, 's'], [8.3, 692, 's']]);
    const w = seg(t, [[7.62, 40], [7.72, 470, 'o'], [7.84, 540, 's'], [7.96, 605, 's'], [8.3, 800, 's'], [9.0, 790, 's']]), sp = seg(t, [[7.62, 1], [7.92, 0, 'o']]), res = seg(t, [[7.62, -.2], [8.3, -.06, 's']]);
    card3D(c, DASH.white, x, y, w, w * .632, .9 * sp, -1.5 * sp + res, -.5 * sp + .02); }
  c.restore();
  // arrow: smooth monotone path through the measured points, nose follows its velocity, grows as it flies at camera
  const ax = kf(t, AX), ay = kf(t, AY), vx = kf(t + .025, AX) - kf(t - .025, AX), vy = kf(t + .025, AY) - kf(t - .025, AY);
  const rot = Math.hypot(vx, vy) < 2 ? 0 : Math.atan2(vx, -vy);
  arrow3D(c, ax, ay, kf(t, [[6.94, 110], [7.4, 80], [7.78, 64], [7.96, 110], [8.3, 120], [8.65, 150], [9.2, 150]]), rot);
  if (t < 7.45) glow(c, ax, ay, 220, '#FBB896', .35);
  return 0;
}

// ---------------------------------------------------------------- three.js laptop: rounded aluminium, studio reflections, soft contact shadow
let L3, SCREEN, KEYS, APPLE;
function prerenderLaptopTextures() {
  SCREEN = mk(1500, 1000); { const g = SCREEN.getContext('2d'); g.fillStyle = '#050505'; g.fillRect(0, 0, 1500, 1000); g.drawImage(DASH.white, 34, 34, 1432, 932); g.fillStyle = '#050505'; g.beginPath(); g.roundRect(690, 26, 120, 26, 13); g.fill(); }
  KEYS = mk(1100, 460); { const g = KEYS.getContext('2d'); g.fillStyle = '#1D1D20'; g.beginPath(); g.roundRect(0, 0, 1100, 460, 18); g.fill(); g.fillStyle = '#2E2E33'; for (let r = 0; r < 6; r++) for (let k = 0; k < 14; k++) { g.beginPath(); g.roundRect(14 + k * 77.5, 14 + r * 74, 68, r === 0 ? 40 : 64, 7); g.fill(); } }
  APPLE = mk(512, 512); { const g = APPLE.getContext('2d'); g.translate(256, 256); g.scale(13, 13); g.translate(-12, -12); g.fillStyle = '#FFFFFF'; g.fill(LP.apple); }
}
async function initLaptop() {
  await window.threeP; const T = window.THREE;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(new window.RoomEnvironment(), 0.04).texture;
  const camera = new T.PerspectiveCamera(24, W / H, 1, 1000); camera.position.set(0, 26, 118); camera.lookAt(0, 7, 0);
  const tex = cv2 => { const x = new T.CanvasTexture(cv2); x.colorSpace = T.SRGBColorSpace; x.anisotropy = 8; return x; };
  const alu = new T.MeshPhysicalMaterial({ color: 0xD8D8DC, metalness: .85, roughness: .32, clearcoat: .25, clearcoatRoughness: .35, envMapIntensity: 1.1 });
  const root = new T.Group(); scene.add(root); const lap = new T.Group(); root.add(lap);
  const base = new T.Mesh(new window.RoundedBoxGeometry(31.26, 1.55, 22.12, 6, .6), alu); base.position.y = .775; base.castShadow = true; lap.add(base);
  const kb = new T.Mesh(new T.PlaneGeometry(27.6, 11.5), new T.MeshStandardMaterial({ map: tex(KEYS), roughness: .55, metalness: .1 })); kb.rotation.x = -Math.PI / 2; kb.position.set(0, 1.56, -3.6); lap.add(kb);
  const tp = new T.Mesh(new T.PlaneGeometry(12.6, 7.9), new T.MeshPhysicalMaterial({ color: 0xC4C4C8, metalness: .9, roughness: .18 })); tp.rotation.x = -Math.PI / 2; tp.position.set(0, 1.561, 6.2); lap.add(tp);
  const pivot = new T.Group(); pivot.position.set(0, 1.55, -10.75); pivot.rotation.x = -.24; lap.add(pivot);
  const lid = new T.Mesh(new window.RoundedBoxGeometry(31.26, 21.6, .55, 6, .26), alu); lid.position.set(0, 10.8, 0); lid.castShadow = true; pivot.add(lid);
  const bez = new T.Mesh(new T.PlaneGeometry(30.6, 20.9), new T.MeshPhysicalMaterial({ color: 0x050505, roughness: .08, metalness: 0, clearcoat: 1 })); bez.position.set(0, 10.8, .281); pivot.add(bez);
  const scr = new T.Mesh(new T.PlaneGeometry(29.6, 19.75), new T.MeshBasicMaterial({ map: tex(SCREEN), toneMapped: false })); scr.position.set(0, 10.8, .285); pivot.add(scr);
  const logo = new T.Mesh(new T.PlaneGeometry(4.8, 4.8), new T.MeshPhysicalMaterial({ alphaMap: tex(APPLE), transparent: true, color: 0xF4F4F6, metalness: .55, roughness: .16 })); logo.rotation.y = Math.PI; logo.position.set(0, 11.2, -.281); pivot.add(logo);
  const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(-30, 60, 40); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 8; Object.assign(key.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 }); scene.add(key); scene.add(new T.AmbientLight(0xffffff, .35));
  const rim = new T.DirectionalLight(0xffffff, .55); rim.position.set(10, 15, 90); scene.add(rim); // frontal fill: keeps whichever face turns to camera bright silver, like the studio reference
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.ShadowMaterial({ opacity: .18 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  L3 = { renderer, scene, camera, root, lap, canvas };
}
function scLaptop(c, t) {
  const bg = c.createRadialGradient(900, 420, 100, 960, 540, 1300); bg.addColorStop(0, '#F4F4F5'); bg.addColorStop(1, '#C3C3C7'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  // measured: whip spin 9.16→9.7 (back side 9.4–9.6), then a long ease into the final ¾ pose by 10.45
  const yaw = seg(t, [[9.19, .15], [9.28, -.75, 'l'], [9.34, -1.7, 'l'], [9.4, -2.85, 'l'], [9.5, -3.75, 'l'], [9.6, -4.55, 'l'], [9.7, -4.95, 'l'], [10.45, -5.55, 'o'], [10.75, -5.57, 's']]);
  const d = seg(t, [[9.19, 74], [9.42, 77, 's'], [9.6, 88, 's'], [10.45, 104, 'o'], [10.75, 105]]), camX = seg(t, [[9.19, -6], [9.36, -3, 'o'], [9.7, 1], [10.45, -2.6, 'o'], [10.75, -2.6]]);
  L3.root.position.set(0, 0, 0); L3.root.scale.setScalar(1); L3.lap.rotation.y = yaw;
  // during the whip the camera sits level with the lid (as in the reference), then rises into the ¾ hero view
  const q = seg(t, [[9.42, 0], [9.7, 1, 's']]);
  L3.camera.position.set(camX, lerp(14, 4 + 19 * d / 96, q), d); L3.camera.lookAt(camX, lerp(9.5, 5.2, q), 0);
  L3.renderer.render(L3.scene, L3.camera); c.drawImage(L3.canvas, 0, 0);
  dispWords(c, t, [['Unlock', 9.84, 700], ['Your', 9.95, 600, '#5A5A5E']], 160, 533, 64, '#2A2A2C');
  dispWords(c, t, [['Full', 10.14, 700], ['Potential.', 10.26, 600, '#5A5A5E']], 1317, 520, 64, '#2A2A2C');
  return 0;
}
function dispWords(c, t, list, x, y, size, col) {
  c.save(); let xx = x;
  list.forEach(w => { c.font = `${w[2]} ${size}px ${DISP}`; const ww = c.measureText(w[0] + ' ').width, a = seg(t, [[w[1], 0], [w[1] + .2, 1, 'o']]);
    if (a > 0) { c.save(); c.globalAlpha = a; if (a < .97) c.filter = `blur(${((1 - a) * 8).toFixed(1)}px)`; c.fillStyle = w[3] || col; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(w[0], xx + (1 - a) * 18, y); c.restore(); } xx += ww; });
  c.restore();
}

// ---------------------------------------------------------------- "Build with" → planet + "Build with Claude ✳"
function typeLetters(c, t, str, t0, t1, x, y, font, col) {
  const n = prog(t, t0, t1) * str.length; c.save(); c.font = font; c.textBaseline = 'middle'; c.textAlign = 'left'; let xx = x;
  for (let i = 0; i < str.length; i++) { const a = clamp(n - i), w = c.measureText(str[i]).width; if (a > 0) { c.save(); c.globalAlpha = a; if (a < .97) c.filter = `blur(${((1 - a) * 10).toFixed(1)}px)`; c.fillStyle = col; c.fillText(str[i], xx, y); c.restore(); } xx += w; }
  c.restore(); return xx;
}
function scBuildWhite(c, t) {
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
  const top = seg(t, [[10.82, 700], [10.94, 640, 'o'], [11.2, 596, 'o']]), R = 1650, cy = top + R;
  const g = c.createRadialGradient(960, cy, R - 260, 960, cy, R + 420); g.addColorStop(0, '#F6B5A0'); g.addColorStop(.38, '#F3A08A'); g.addColorStop(.62, 'rgba(246,170,145,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = '#F6BCAE'; c.beginPath(); c.arc(960, cy, R, 0, TAU); c.fill();
  c.font = `700 128px ${DISP}`; typeLetters(c, t, 'Build with', 10.81, 11.08, 960 - c.measureText('Build with').width / 2, 545, `700 128px ${DISP}`, '#262626');
  return 0;
}
function scPlanet(c, t) {
  const inv = t < 11.335; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const top = seg(t, [[11.28, 700], [11.5, 690, 's'], [11.88, 770, 's'], [12.06, 1070, 'o'], [12.9, 1180, 'o']]), R = 2300, cy = top + R;
  if (!inv) { const g = c.createRadialGradient(960, cy, R - 10, 960, cy, R + 520); g.addColorStop(0, '#FFE2BF'); g.addColorStop(.05, '#F9B37C'); g.addColorStop(.28, '#E8763E'); g.addColorStop(.6, 'rgba(160,60,25,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  else { c.fillStyle = '#2A1009'; c.fillRect(0, 0, W, H); }
  c.fillStyle = inv ? '#1A0A06' : '#050302'; c.beginPath(); c.arc(960, cy, R, 0, TAU); c.fill();
  const k = seg(t, [[11.68, 1.0], [12.0, .77, 's']]); // measured: line shrinks ~23% right after "Claude" lands
  c.save(); cam(c, k, 960, 538);
  // line re-centres as "Claude" types in, like the reference
  c.font = `700 128px ${DISP}`; const bw = c.measureText('Build with').width; c.font = `400 140px ${SERIF}`; const cw = c.measureText('Claude').width;
  const x0 = seg(t, [[11.42, 960 - bw / 2], [11.6, 527, 'o'], [12.0, 390, 's']]); // measured left edge of the line in the reference
  const end = typeLetters(c, t, 'Build with', 10.0, 10.01, x0, 545, `700 128px ${DISP}`, inv ? '#E07A4F' : '#FFFFFF');
  if (!inv) { const e2 = typeLetters(c, t, 'Claude', 11.45, 11.85, end + 26, 552, `400 140px ${SERIF}`, '#FFFFFF'); const sa = seg(t, [[11.95, 0], [12.15, 1, 'b']]);
    if (sa > 0) spark(c, e2 + 85, 455, 52 * sa, { rot: t * .5, color: '#F7C9AE', glow: 'rgba(255,200,170,0.85)', glowK: 1.2 }); }
  c.restore();
  return 0;
}

// ---------------------------------------------------------------- timeline (cuts on the measured hits) + motion blur
const SC = [[0, 3.06, scSpark], [3.06, 6.94, scChat], [6.94, 9.19, scDash], [9.19, 10.82, scLaptop], [10.82, 11.28, scBuildWhite], [11.28, 99, scPlanet]];
let SUB, ACC;
function master(c, t) {
  if (!SUB) { SUB = mk(); ACC = mk(); }
  const N = t > 9.17 && t < 9.8 ? 36 : 16, shutter = .55 / FPS, // dense sub-frames on the laptop whip so the blur is a smooth smear, never ghost copies
    a = ACC.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.globalAlpha = 1;
  for (let k = 0; k < N; k++) { const tk = Math.max(0, t + (k / (N - 1) - .5) * shutter), i = Math.max(0, SC.findIndex(([s, e]) => tk >= s && tk < e)), s2 = SUB.getContext('2d');
    s2.setTransform(1, 0, 0, 1, 0, 0); s2.globalAlpha = 1; s2.filter = 'none'; SC[i][2](s2, tk); a.globalAlpha = 1 / (k + 1); a.drawImage(SUB, 0, 0); }
  c.drawImage(ACC, 0, 0); return 0;
}

const VIDEO = {
  fonts: [`400 30px ${SERIF}`, `500 30px ${SERIF}`, `400 30px ${SANS}`, `500 30px ${SANS}`, `600 30px ${SANS}`, `700 30px ${SANS}`, `600 30px ${DISP}`, `700 30px ${DISP}`],
  scenes: [{ s: 0, e: 99, f: master, light: 0 }],
  captions: [],
  async prerender() {
    prerenderSwoosh(); for (const k of ['white', 'green', 'purple', 'blue']) DASH[k] = dashboard(k); prerenderLaptopTextures(); await initLaptop();
    ctx.font = `400 64px ${SERIF}`; const hw = ctx.measureText('Welcome, yowerse').width; ICON = { x: 960 - (hw + 70) / 2 + 22, y: 373 };
  },
};
