// Example: "Solana vs Robinhood Chain" — a 23.8 s crypto explainer reel rebuilt scene by scene from the original.
// Runs on the reelsmith engine (engine.js). Every number below was measured from the reference frames.

// ---------- tokens (sampled from the reference) ----------
const C = {
  lime: '#CAFB06', limeHi: '#DBFF3C', ink: '#1C1C1C', white: '#FFFFFF',
  solG: [[0.08, '#9945FF'], [0.3, '#8752F3'], [0.5, '#5497D5'], [0.6, '#43B4CA'], [0.72, '#28E0B9'], [0.97, '#19FB9B']], // official solanaLogoMark.svg
  nvidia: '#76B900', green: '#2FBF7F', purple: '#5A3FCF',
};

function solGrad(c) { const g = c.createLinearGradient(8.52558, 90.0973, 88.9933, -3.01622); C.solG.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function rhTile(c, cx, cy, s, o = {}) { // lime app tile with black feather
  c.save(); c.globalAlpha *= (o.alpha ?? 1);
  if (o.glow) { c.shadowColor = 'rgba(202,251,6,0.45)'; c.shadowBlur = o.glow; }
  const g = c.createLinearGradient(0, cy - s / 2, 0, cy + s / 2); g.addColorStop(0, C.limeHi); g.addColorStop(1, C.lime);
  c.fillStyle = g; c.beginPath(); c.roundRect(cx - s / 2, cy - s / 2, s, s, s * 0.17); c.fill(); c.restore();
  logo(c, 'robinhood', cx + s * 0.02, cy, s * 0.62, '#0B0B0B', { alpha: o.alpha ?? 1 });
}
function solTile(c, cx, cy, s, o = {}) { // light glossy app tile with Solana mark
  c.save(); c.globalAlpha *= (o.alpha ?? 1);
  c.shadowColor = o.shadow || 'rgba(0,0,0,0.12)'; c.shadowBlur = s * 0.25; c.shadowOffsetY = s * 0.05;
  const g = c.createLinearGradient(0, cy - s / 2, 0, cy + s / 2); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, o.bottom || '#E4E4E6');
  c.fillStyle = g; c.beginPath(); c.roundRect(cx - s / 2, cy - s / 2, s, s, s * 0.22); c.fill(); c.restore();
  logo(c, 'solana', cx, cy, s * 0.62, solGrad, { alpha: o.alpha ?? 1 });
}
let BLOB;
function prerenderBlob() {
  BLOB = mk(270, 480); const b = BLOB.getContext('2d');
  b.fillStyle = '#B9B9B9'; b.fillRect(0, 0, 270, 480); b.filter = 'blur(28px)';
  for (const [x, y, r, col] of [[140, 20, 150, '#6E6E6E'], [10, 220, 120, '#F4F4F4'], [265, 235, 115, '#707070'], [140, 330, 90, '#F0F0F0'],
    [40, 450, 120, '#8A8A8A'], [250, 470, 110, '#606060'], [225, 90, 80, '#E8E8E8'], [40, 70, 70, '#D0D0D0'], [150, 470, 70, '#E2E2E2']]) {
    const g = b.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, rgba(col, 0)); b.fillStyle = g; b.fillRect(0, 0, 270, 480);
  }
}

// =====================================================================
// SCENE 1 (0–2.05): two brand discs kiss, spin 90° and stack
// =====================================================================
function disc(c, d, r, gap, off, fill) { c.beginPath(); c.arc(d * (r + gap), off, r, 0, TAU); c.fillStyle = fill; c.fill(); }
function axisGrad(c, d, x0, x1, stops) { const g = c.createLinearGradient(d * x0, 0, d * x1, 0); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function scHook(c, t) {
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#DCDDE0'); bg.addColorStop(1, '#AEB6C0'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const ang = kf(t, [[0, 0], [0.25, 0.2], [1.0, 0.8], [1.3, 1.22], [1.6, 1.5], [2.05, Math.PI / 2]]);
  const z = kf(t, [[0, 1.32], [0.3, 1.95], [0.7, 1.9], [1.0, 1.55], [1.3, 1.12], [1.6, 1.0], [2.05, 0.93]]);
  const inner = kf(t, [[0, 0.82], [1.1, 1.0]]), R = 560, gr = kf(t, [[0, 0], [0.4, 0.72], [1.0, 1]]);
  c.save(); c.translate(540, 968); c.rotate(ang); c.scale(z, z);
  // Solana side (local -x → ends up on top)
  const ri = R * .52 * inner, sx = -(ri + R * .02);
  disc(c, -1, lerp(R, R * .97, gr), 0, -R * .008 * gr, axisGrad(c, -1, 2 * R, 0, [[0, '#0B2552'], [1, '#00356F']]));
  disc(c, -1, lerp(ri, R * .95, gr), R * .02, R * .05 * gr, axisGrad(c, -1, 2 * R, 0, [[0, '#D59DE6'], [.6, '#E4B6F0'], [1, '#F3DAF9']]));
  disc(c, -1, lerp(ri, R * .9, gr), R * .03, -R * .005 * gr, axisGrad(c, -1, 1.9 * R, 0, [[0, '#3F71BA'], [.45, '#7FA3D6'], [.8, '#C9D3EC'], [1, '#EEE6F7']]));
  { const g = c.createRadialGradient(sx, 0, ri * .1, sx, 0, ri); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.6, '#F6E6FC'); g.addColorStop(1, '#E6BFF4'); c.fillStyle = g; c.beginPath(); c.arc(sx, 0, ri, 0, TAU); c.fill(); }
  const sph = 1 - prog(t, 0.08, 0.3);
  if (sph > 0) { c.save(); c.globalAlpha = sph; const rs = R * .1, x = -(rs + R * .015); const g = c.createRadialGradient(x - rs * .3, -rs * .3, 2, x, 0, rs); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#7096CF'); c.fillStyle = g; c.beginPath(); c.arc(x, 0, rs, 0, TAU); c.fill(); c.restore(); }
  // Robinhood side (local +x → ends up at the bottom)
  disc(c, 1, R, 0, 0, axisGrad(c, 1, 2 * R, 0, [[0, '#121107'], [1, '#22200F']]));
  const rl = R * .64 * inner, lx = rl + R * .02;
  disc(c, 1, lerp(rl, R * .965, gr), R * .012, -R * .045 * gr, axisGrad(c, 1, 2 * R, 0, [[0, '#CFEE45'], [.5, '#E0F77F'], [1, '#F1FBC8']]));
  disc(c, 1, lerp(rl, R * .92, gr), R * .025, R * .012 * gr, axisGrad(c, 1, 1.9 * R, 0, [[0, '#949CA4'], [.55, '#C3C9CF'], [1, '#F7F8F9']]));
  { const g = c.createLinearGradient(lx + rl, 0, lx - rl, 0); g.addColorStop(0, '#D3F23E'); g.addColorStop(.55, '#EAF8A6'); g.addColorStop(1, '#FBFBF7'); c.fillStyle = g; c.beginPath(); c.arc(lx, 0, rl, 0, TAU); c.fill(); }
  if (sph > 0) { c.save(); c.globalAlpha = sph; const rs = R * .1, x = rs + R * .015; const g = c.createRadialGradient(x + rs * .3, -rs * .3, 2, x, 0, rs); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#8C8C8C'); c.fillStyle = g; c.beginPath(); c.arc(x, 0, rs, 0, TAU); c.fill(); c.restore(); }
  // marks ride with the discs and end upright
  const la = kf(t, [[0.3, 0], [0.55, 0.45], [1.0, 0.85], [1.25, 1]]);
  c.save(); c.translate(sx, 0); c.rotate(-Math.PI / 2); logo(c, 'solana', 0, 0, ri * 1.34, solGrad, { alpha: la, wash: kf(t, [[0.5, 0.7], [1.0, 0.3], [1.3, 0]]) }); c.restore();
  c.save(); c.translate(lx, 0); c.rotate(-Math.PI / 2); logo(c, 'robinhood', 0, 0, rl * .95, mix('#8A8A8A', '#0E0E0E', prog(t, 0.9, 1.35)), { alpha: la }); c.restore();
  c.restore();
  return kf(t, [[0, 0], [0.12, 9], [0.75, 8], [1.1, 3], [1.35, 0]]);
}

// =====================================================================
// SCENE 2 (2.05–3.1): grey blur card, "What's the difference?"
// =====================================================================
let QSIZE = 60; // set in prerender: the question fits 692 px like the reference
function scQuestion(c, t) {
  const z = 1 + (t - 2.05) * 0.05; c.save(); cam(c, z); c.imageSmoothingQuality = 'high'; c.drawImage(BLOB, 0, 0, W, H); c.restore();
  const words = ["What's", 'the', 'difference?'], T = [2.17, 2.33, 2.46];
  c.save(); c.font = `500 ${QSIZE}px Poppins`; const full = words.join(' '), fw = c.measureText(full).width;
  const ox = kf(t, [[2.15, -250], [2.75, 0]]), out = prog(t, 2.92, 3.1);
  let x = 540 - fw / 2 + ox;
  words.forEach((w, i) => {
    const a = prog(t, T[i], T[i] + 0.26), ww = c.measureText(w + ' ').width;
    if (a > 0) {
      c.save(); c.globalAlpha = a * (1 - out * .3); c.filter = `blur(${((1 - a) * 9 + out * 6).toFixed(1)}px)`;
      c.translate(x + (1 - easeOut(a)) * 30, 885 + (1 - easeOut(a)) * 16); c.scale(1 + out * .08, 1);
      c.fillStyle = C.ink; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(w, 0, 0); c.restore();
    }
    x += ww;
  });
  c.restore();
}

// =====================================================================
// SCENE 3 (3.1–4.9): Solana ring over a glowing horizon, Seller ↔ You
// =====================================================================
function solRing(c, x, y, t) {
  c.save(); c.translate(x, y);
  const gl = c.createRadialGradient(0, 0, 170, 0, 0, 300); gl.addColorStop(0, 'rgba(50,225,170,0)'); gl.addColorStop(.25, 'rgba(50,225,170,0.16)'); gl.addColorStop(1, 'rgba(50,225,170,0)');
  c.fillStyle = gl; c.beginPath(); c.arc(0, 0, 300, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(70,220,175,0.22)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 258, 0, TAU); c.stroke();
  c.save(); c.shadowColor = 'rgba(60,240,180,0.7)'; c.shadowBlur = 22; c.lineWidth = 16;
  const tg = c.createConicGradient(2.2 + t * .4, 0, 0); tg.addColorStop(0, '#6BFFD2'); tg.addColorStop(.3, '#2ED3A2'); tg.addColorStop(.55, '#1A8F70'); tg.addColorStop(.8, '#39E3B1'); tg.addColorStop(1, '#6BFFD2');
  c.strokeStyle = tg; c.beginPath(); c.arc(0, 0, 212, 0, TAU); c.stroke(); c.restore();
  c.lineWidth = 16; const sb = c.createLinearGradient(-200, -200, 200, 200); sb.addColorStop(0, '#FFFFFF'); sb.addColorStop(.45, '#9A9A9A'); sb.addColorStop(.7, '#5A5A5A'); sb.addColorStop(1, '#D6D6D6');
  c.strokeStyle = sb; c.beginPath(); c.arc(0, 0, 194, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(80,235,185,0.9)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 182, 0, TAU); c.stroke();
  const cg = c.createRadialGradient(0, -30, 10, 0, 0, 180); cg.addColorStop(0, '#1B1631'); cg.addColorStop(.7, '#0A0913'); cg.addColorStop(1, '#040406');
  c.fillStyle = cg; c.beginPath(); c.arc(0, 0, 180, 0, TAU); c.fill();
  c.restore();
  logo(c, 'solana', x, y, 216, solGrad, { glow: 'rgba(130,90,255,0.35)', glowR: 24 });
}
function avatar(c, x, y, s, tint = '#FFFFFF') { // y = head centre
  c.save(); c.translate(x, y); c.scale(s, s);
  c.beginPath(); c.ellipse(0, 135, 125, 75, 0, Math.PI, 0); c.closePath();
  const g = c.createLinearGradient(0, 60, 0, 135); g.addColorStop(0, tint); g.addColorStop(.07, mix(tint, '#2A2A2A', .6)); g.addColorStop(.35, '#141414'); g.addColorStop(1, '#030303');
  c.fillStyle = g; c.fill();
  c.beginPath(); c.arc(0, 0, 40, 0, TAU); const hg = c.createRadialGradient(-10, -12, 4, 0, 0, 40); hg.addColorStop(0, '#3C3C3C'); hg.addColorStop(1, '#0C0C0C'); c.fillStyle = hg; c.fill();
  c.lineWidth = 5; const sg = c.createLinearGradient(-40, -40, 40, 40); sg.addColorStop(0, '#FFFFFF'); sg.addColorStop(1, mix(tint, '#505050', .5)); c.strokeStyle = sg; c.stroke();
  c.restore();
}
function scFast(c, t) {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const u = t - 3.1;
  const p = kf(t, [[3.1, 1.12], [3.2, 1], [3.33, 0.58], [3.5, 0.37], [3.67, 0.22], [3.83, 0.11], [4.0, 0.04], [4.25, 0]]);
  const rot = kf(u, [[1.3, 0], [1.55, 0.1], [1.8, 0.48]]), z2 = kf(u, [[1.4, 1], [1.8, 1.5]]);
  c.save(); cam(c, z2, 700, 900, kf(u, [[1.4, 0], [1.8, 120]]), 0, rot);
  // horizon
  const hy = 936 + 334 * p;
  { const g = c.createLinearGradient(0, hy, 0, hy + 420); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(.12, 'rgba(255,255,255,0.2)'); g.addColorStop(.5, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(-600, hy, W + 1200, 420);
    const a = c.createLinearGradient(0, hy - 90, 0, hy); a.addColorStop(0, 'rgba(255,255,255,0)'); a.addColorStop(1, 'rgba(255,255,255,0.12)'); c.fillStyle = a; c.fillRect(-600, hy - 90, W + 1200, 90);
    c.save(); c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = 24; const l = c.createLinearGradient(-600, 0, W + 600, 0);
    l.addColorStop(0, 'rgba(150,150,150,0.6)'); l.addColorStop(.5, '#FFFFFF'); l.addColorStop(1, 'rgba(150,150,150,0.6)'); c.fillStyle = l; c.fillRect(-600, hy - 4, W + 1200, 8); c.restore(); }
  c.save(); c.translate(540, 600 - 456 * p); c.scale(1.12, 1.12); solRing(c, 0, 0, u); c.restore();
  c.save(); cam(c, 1 + .45 * p, 540, 1125, 0, 600 * p);
  avatar(c, 258, 1125, 1); avatar(c, 822, 1125, 1, '#B8A6FF');
  txt(c, 'Seller', 258, 1366, '600 38px Poppins', '#FFFFFF'); txt(c, 'You', 822, 1366, '600 38px Poppins', '#FFFFFF');
  c.strokeStyle = 'rgba(200,200,200,0.7)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(372, 1254); c.lineTo(712, 1254); c.stroke();
  c.fillStyle = '#E6E6E6'; c.beginPath(); c.arc(372, 1254, 5, 0, TAU); c.fill(); c.fillStyle = '#2CE59B'; c.beginPath(); c.arc(712, 1254, 5, 0, TAU); c.fill();
  const pp = (u * 0.85) % 1, q = easeOut(clamp(pp * 1.4));
  pill(c, lerp(430, 660, q), 1232, 100, 26, '#22E596', '↔ 2.74 USDC', '#06351F', { glow: 'rgba(34,229,150,0.6)', size: 11 });
  pill(c, lerp(650, 430, q), 1278, 96, 26, '#F2F2F2', 'NVDAx →', '#111', { size: 11 });
  c.restore(); c.restore();
  return kf(u, [[0, 6], [0.3, 3], [0.55, 0], [1.45, 0], [1.8, 9]]);
}

// =====================================================================
// SCENE 4 (4.9–6.42): light swap card, cursor clicks Swap, order filled
// =====================================================================
function card(c, w, h, r = 36) {
  c.save(); c.shadowColor = 'rgba(0,0,0,0.10)'; c.shadowBlur = 50; c.shadowOffsetY = 18;
  const g = c.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#FAFAFB'); g.addColorStop(1, '#F1F1F3');
  c.fillStyle = g; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, r); c.fill(); c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, r); c.stroke();
}
function cursorDot(c, x, y, press = 0) {
  c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 10; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x, y, 15 - press * 3, 0, TAU); c.fill(); c.restore();
  c.strokeStyle = '#8C8C8C'; c.lineWidth = 5; c.beginPath(); c.arc(x, y, 15 - press * 3, 0, TAU); c.stroke();
}
function scSwap(c, t) {
  bgLight(c, '#F3F3F3', '#BDBDC0', 940);
  const u = t - 4.9, exit = prog(t, 6.2, 6.42);
  c.save(); c.translate(540 + easeIn(exit) * 260, kf(u, [[0, 978], [1.0, 978], [1.1, 975]]));
  if (u < 1.0) {
    const s = kf(u, [[0, 0.64], [0.5, 0.86], [0.95, 1.0]]); c.save(); c.scale(s, s); card(c, 435, 636);
    const A = 1 - prog(u, 0.62, 0.7), B = prog(u, 0.66, 0.74);
    if (A > 0) { c.save(); c.globalAlpha = A;
      const ty = prog(u, 0.05, 0.25);
      txt(c, 'You pay', -170, -250, '400 17px Poppins', '#ABABAB', { align: 'left' });
      txt(c, '500', -170, -212, '600 32px Poppins', mix('#D0D0D0', '#3A3A3A', ty), { align: 'left' });
      pill(c, 150, -222, 70, 28, '#FFFFFF', 'USDC', '#333', { size: 13, stroke: 'rgba(0,0,0,0.08)' });
      c.fillStyle = '#EDEDEF'; c.beginPath(); c.arc(0, -130, 26, 0, TAU); c.fill(); txt(c, '↓', 0, -128, '500 26px Poppins', '#6A6A6A');
      txt(c, 'You get', -170, -72, '400 17px Poppins', '#ABABAB', { align: 'left' });
      txt(c, '2.74', -170, -34, '600 32px Poppins', '#9C9C9C', { align: 'left' });
      txt(c, 'NVDAx', 150, -44, '700 15px Poppins', '#333', {});
      const pr = prog(u, 0.48, 0.55) * (1 - prog(u, 0.55, 0.66));
      c.save(); c.translate(0, 62); c.scale(1 - pr * .04, 1 - pr * .04);
      c.fillStyle = mix('#262626', '#3A4A41', prog(u, 0.5, 0.6)); c.beginPath(); c.roundRect(-165, -27, 330, 54, 27); c.fill();
      txt(c, 'Swap', 0, 1, '600 19px Poppins', '#FFFFFF'); c.restore();
      txt(c, '1 NVDAx = 182.48 USDC', 0, 132, '400 14px Poppins', '#B5B5B5');
      c.restore(); }
    if (B > 0) { c.save(); c.globalAlpha = B;
      c.save(); c.shadowColor = 'rgba(0,0,0,0.08)'; c.shadowBlur = 20; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, -120, 46, 0, TAU); c.fill(); c.restore();
      c.strokeStyle = '#E2E2E2'; c.lineWidth = 6; c.beginPath(); c.arc(0, -120, 26, 0, TAU); c.stroke();
      c.strokeStyle = '#2FBF7F'; c.beginPath(); c.arc(0, -120, 26, u * 12, u * 12 + 1.8); c.stroke();
      pill(c, 0, 52, 196, 42, '#5D8E72', 'order filled', '#FFFFFF', { size: 15 }); c.restore(); }
    const cx = kf(u, [[0.05, 30], [0.45, 18], [1.0, 22]]), cy = kf(u, [[0.05, 250], [0.45, 70], [1.0, 58]]);
    cursorDot(c, cx, cy, prog(u, 0.48, 0.54) * (1 - prog(u, 0.56, 0.64)));
    c.restore();
  } else {
    const s = kf(u, [[1.0, 0.98], [1.12, 1.04], [1.5, 1.06]]); c.save(); c.scale(s, s); card(c, 472, 688);
    const a = prog(u, 1.0, 1.1);
    c.save(); c.globalAlpha = a;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.08)'; c.shadowBlur = 24; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, -150, 62, 0, TAU); c.fill(); c.restore();
    const ck = easeOut(prog(u, 1.02, 1.22));
    c.save(); c.lineWidth = 13; c.lineCap = 'round'; c.lineJoin = 'round'; c.translate(0, 20); const g = c.createLinearGradient(-30, -150, 34, -195);
    g.addColorStop(0, '#9945FF'); g.addColorStop(.55, '#5497D5'); g.addColorStop(1, '#19FB9B'); c.strokeStyle = g;
    c.beginPath(); c.moveTo(-30, -172); c.lineTo(-30 + 22 * Math.min(1, ck * 2), -172 + 22 * Math.min(1, ck * 2)); if (ck > .5) c.lineTo(-8 + 44 * (ck - .5) * 2, -150 - 46 * (ck - .5) * 2); c.stroke(); c.restore();
    txt(c, '+2.74 NVDAx', 0, -22, '700 37px Poppins', '#1E1E1E');
    txt(c, 'for 500 USDC', 0, 18, '400 16px Poppins', '#B0B0B0');
    { c.save(); c.shadowColor = 'rgba(80,215,150,0.45)'; c.shadowBlur = 24; const pg = c.createLinearGradient(-150, 0, 150, 0); pg.addColorStop(0, '#9FEFC5'); pg.addColorStop(1, '#58D696');
      c.fillStyle = pg; c.beginPath(); c.roundRect(-160, 90, 320, 56, 28); c.fill(); c.restore(); txt(c, 'order filled', 0, 119, '600 17px Poppins', '#FFFFFF'); }
    txt(c, '0.4 s', 0, 196, '600 22px Poppins', '#3CC889');
    c.restore();
    cursorDot(c, 30, 124, 0);
    c.restore();
  }
  c.restore();
  return exit * 12;
}

// =====================================================================
// SCENE 5 (6.42–9.0): chrome clock, Robinhood box, slow lime dots
// =====================================================================
function clock(c, x, y, r, a1, a2) {
  c.beginPath(); c.arc(x + 22, y + 4, r + 8, 0, TAU);
  const bz = c.createLinearGradient(x - r, y - r, x + r + 30, y + r); bz.addColorStop(0, '#1A1A1A'); bz.addColorStop(.6, '#2E2E2E'); bz.addColorStop(.85, '#A8A8A8'); bz.addColorStop(1, '#3A3A3A');
  c.fillStyle = bz; c.fill();
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  const fg = c.createLinearGradient(x - r * .85, y + r * .85, x + r * .85, y - r * .85);
  fg.addColorStop(0, '#2F2F2F'); fg.addColorStop(.3, '#7C7C7C'); fg.addColorStop(.52, '#DCDCDC'); fg.addColorStop(.66, '#D2D2D2'); fg.addColorStop(.85, '#9C9C9C'); fg.addColorStop(1, '#6E6E6E');
  c.fillStyle = fg; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 4; c.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(x + Math.sin(a) * r * .86, y - Math.cos(a) * r * .86); c.lineTo(x + Math.sin(a) * r * .93, y - Math.cos(a) * r * .93); c.stroke(); }
  c.lineWidth = 5; for (const [a, L] of [[a1, r * .82], [a2, r * .62]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * L, y - Math.cos(a) * L); c.stroke(); }
  c.fillStyle = '#0E0E0E'; c.beginPath(); c.arc(x, y, 13, 0, TAU); c.fill();
}
function rhBox(c, u) {
  // chrome side face, then white front face
  c.beginPath(); c.moveTo(628, 893); c.lineTo(735, 905); c.lineTo(735, 1158); c.lineTo(628, 1176); c.closePath();
  const sg = c.createLinearGradient(628, 0, 735, 0); sg.addColorStop(0, '#E8E8E8'); sg.addColorStop(.35, '#7A7A7A'); sg.addColorStop(.7, '#2A2A2A'); sg.addColorStop(1, '#9A9A9A'); c.fillStyle = sg; c.fill();
  const fg = c.createLinearGradient(345, 885, 630, 1176); fg.addColorStop(0, '#FFFFFF'); fg.addColorStop(1, '#ECECEC');
  c.fillStyle = fg; c.beginPath(); c.roundRect(345, 885, 285, 291, 10); c.fill();
  rhTile(c, 383, 922, 40);
  c.strokeStyle = '#E9E9E9'; c.lineWidth = 9; c.beginPath(); c.arc(487, 1012, 52, 0, TAU); c.stroke();
  c.strokeStyle = '#B9E40A'; c.lineCap = 'round'; c.beginPath(); c.arc(487, 1012, 52, u * 5, u * 5 + 1.5); c.stroke(); c.lineCap = 'butt';
  const fa = prog(u, 1.15, 1.35); if (fa > 0) pill(c, 487, 1108, 152, 36, '#111111', 'fee - $0.20', '#FFFFFF', { size: 14, alpha: fa });
  // frosted pedestal
  const pg = c.createLinearGradient(0, 1206, 0, 1284); pg.addColorStop(0, '#9A9A9A'); pg.addColorStop(.35, '#EDEDED'); pg.addColorStop(.6, '#BDBDBD'); pg.addColorStop(1, '#5A5A5A');
  c.fillStyle = pg; c.beginPath(); c.roundRect(435, 1206, 205, 78, 24); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(455, 1214, 165, 3);
}
function scSlow(c, t) {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const u = t - 6.42;
  c.save(); cam(c, kf(u, [[0, 1.42], [0.4, 1.14], [1.0, 1.0], [2.58, 0.98]]), 540, 800, kf(u, [[0, -140], [0.4, -40], [1.0, 0]]), 0);
  reflect(c, 1290, l => { clock(l, 540, 729, 354, kf(u, [[0, -0.6], [2.6, 0.2]]), kf(u, [[0, 3.5], [1.2, 4.45], [2.3, 6.6], [2.58, 7.4]])); rhBox(l, u); }, { alpha: .16, fade: 300 });
  // trade line
  const sl = kf(u, [[0.25, -1150], [1.0, 0]]);
  c.save(); c.translate(sl, 0);
  avatar(c, 66, 1318, .45); avatar(c, 1014, 1318, .45, '#B8A6FF');
  txt(c, 'Seller', 66, 1404, '600 22px Poppins', '#FFFFFF'); txt(c, 'You', 1014, 1404, '600 22px Poppins', '#FFFFFF');
  c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 2; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(110, 1353); c.lineTo(970, 1353); c.stroke(); c.setLineDash([]);
  const lead = kf(u, [[0.6, 150], [1.1, 483], [1.65, 600], [2.15, 700], [2.6, 760]]);
  for (let k = 0; k < 8; k++) { const x = lead - k * 108; if (x < 150) break;
    c.save(); c.shadowColor = 'rgba(202,251,6,0.8)'; c.shadowBlur = 18; c.fillStyle = C.lime; c.beginPath(); c.arc(x, 1353, 14, 0, TAU); c.fill(); c.restore();
    c.strokeStyle = 'rgba(40,50,0,0.8)'; c.lineWidth = 3; c.beginPath(); c.arc(x, 1353, 8, 0, TAU); c.stroke(); }
  c.restore();
  c.restore();
  return kf(u, [[0, 6], [0.3, 0], [2.35, 0], [2.58, 7]]);
}

// =====================================================================
// SCENE 6 (9.0–11.2): "Robinhood exchange" on lit steps, rising blocks, orbiting light
// =====================================================================
const BLOCKS = [ // cx, final top, width, rise, delay
  [70, 1012, 210, 520, 0], [265, 1000, 270, 430, .08], [540, 994, 310, 560, .04], [815, 1000, 270, 400, .12], [1015, 1012, 210, 470, .06],
  [150, 1062, 250, 640, .18], [420, 1052, 290, 720, .24], [690, 1054, 270, 560, .16], [935, 1064, 250, 680, .28], [540, 1112, 330, 820, .34]];
function slab(c, cx, top, w, h, o = {}) {
  const x = cx - w / 2, g = c.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, o.top || '#E2E2E2'); g.addColorStop(.22, o.mid || '#8E8E8E'); g.addColorStop(1, 'rgba(18,18,16,0)');
  c.fillStyle = g; c.beginPath(); c.roundRect(x, top, w, h, [12, 12, 0, 0]); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.roundRect(x + 3, top, w - 6, 7, 4); c.fill();
}
function scBacked(c, t) {
  const u = t - 9.0;
  c.fillStyle = '#121210'; c.fillRect(0, 0, W, H);
  const dy = kf(u, [[0, 300], [0.25, 150], [0.5, 60], [0.75, 28], [1.3, 8], [2.2, 0]]);
  c.save(); c.translate(0, dy);
  const gl = c.createRadialGradient(540, 760, 50, 540, 760, 900); gl.addColorStop(0, '#2E3226'); gl.addColorStop(.5, '#1A1C16'); gl.addColorStop(1, 'rgba(18,18,16,0)'); c.fillStyle = gl; c.fillRect(0, -400, W, H + 400);
  // dome + arc
  const ar = 820, acx = 540, acy = 1190;
  c.save(); c.beginPath(); c.arc(acx, acy, ar, 0, TAU); c.clip();
  const dg = c.createLinearGradient(0, acy - ar, 0, acy - ar + 620); dg.addColorStop(0, '#34382C'); dg.addColorStop(.35, '#1C1E18'); dg.addColorStop(1, '#0C0C0B'); c.fillStyle = dg; c.fillRect(0, acy - ar, W, 2 * ar); c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2.5; c.beginPath(); c.arc(acx, acy, ar, Math.PI, TAU); c.stroke();
  const phi = kf(u, [[0, -2.5], [0.6, -2.05], [1.2, -1.5], [1.9, -0.94], [2.2, -0.75]]), ox = acx + Math.cos(phi) * ar, oy = acy + Math.sin(phi) * ar;
  { const g = c.createRadialGradient(ox, oy, 0, ox, oy, 90); g.addColorStop(0, 'rgba(240,255,170,1)'); g.addColorStop(.12, 'rgba(215,255,80,0.85)'); g.addColorStop(.4, 'rgba(202,251,6,0.18)'); g.addColorStop(1, 'rgba(202,251,6,0)');
    c.fillStyle = g; c.beginPath(); c.arc(ox, oy, 90, 0, TAU); c.fill(); }
  // headline
  c.save(); c.font = '400 100px "League Gothic"'; const fs = 100 * 860 / c.measureText('Robinhood exchange').width; c.font = `400 ${fs}px "League Gothic"`;
  const hg = c.createLinearGradient(0, 752 - fs * .78, 0, 752 + 6); hg.addColorStop(0, '#FFFFFF'); hg.addColorStop(.55, '#E4E4E4'); hg.addColorStop(1, '#6A6A6A');
  c.fillStyle = hg; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('Robinhood exchange', 540, 752); c.restore();
  rhTile(c, 540, 822, 129, { glow: 40 });
  slab(c, 540, 894, 390, 120); slab(c, 540, 936, 495, 120); slab(c, 540, 978, 600, 160, { mid: '#6E6E6E' });
  c.restore();
  // rising blocks (foreground, more parallax)
  const bd = dy * 1.6;
  [...BLOCKS].sort((a, b) => a[1] - b[1]).forEach(([cx, top, w, rise, d]) => {
    const y = top + bd + rise * (1 - easeOut(prog(u, d, d + 1.7)));
    slab(c, cx, y, w, 230, { top: '#EDEDED', mid: '#9A9A9A' });
  });
  return 0;
}

// =====================================================================
// SCENE 7 (11.2–14.42): Solana decentralised (nodes) → empty lectern
// =====================================================================
const NODES = [[141, 156, 90, 'P'], [441, 261, 42, 'G'], [720, 216, 48, 'G'], [906, 216, 42, 'P'], [669, 393, 66, 'P'], [366, 450, 96, 'G'], [237, 483, 60, 'G'],
  [135, 711, 102, 'G'], [864, 699, 54, 'G'], [927, 939, 102, 'G'], [126, 951, 54, 'P'], [864, 1140, 54, 'G'], [171, 1377, 90, 'P'], [399, 1365, 48, 'G'],
  [684, 1389, 66, 'G'], [876, 1428, 66, 'P'], [165, 1593, 48, 'G'], [420, 1593, 60, 'G'], [678, 1689, 102, 'P'], [1010, 1780, 60, 'G'], [50, 1250, 44, 'G'],
  [1020, 520, 50, 'P'], [560, 120, 36, 'G'], [960, 1600, 40, 'P'], [300, 1820, 56, 'G'], [600, 1500, 34, 'G']];
function node(c, x, y, s, col, k = 1) {
  if (k <= 0) return; c.save(); c.translate(x, y); c.scale(k, k);
  c.save(); c.shadowColor = 'rgba(0,0,0,0.16)'; c.shadowBlur = s * .5; c.shadowOffsetY = s * .12;
  const g = c.createLinearGradient(0, -s / 2, 0, s / 2); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#F6F6F8');
  c.fillStyle = g; c.beginPath(); c.roundRect(-s / 2, -s / 2, s, s, s * .22); c.fill(); c.restore();
  const bw = s * .52, bh = s * .12, gap = s * .055, cc = col === 'G' ? C.green : C.purple;
  for (let i = -1; i <= 1; i++) { const by = i * (bh + gap) - bh / 2; c.fillStyle = cc; c.beginPath(); c.roundRect(-bw / 2, by, bw, bh, bh * .3); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(-bw / 2 + bh * .7, by + bh / 2, bh * .22, 0, TAU); c.fill(); }
  c.restore();
}
function lectern(c) {
  // body
  const bg = c.createLinearGradient(0, 979, 0, 1620); bg.addColorStop(0, '#CFCFCF'); bg.addColorStop(.45, 'rgba(226,232,224,0.85)'); bg.addColorStop(1, 'rgba(238,247,236,0)');
  c.fillStyle = bg; c.fillRect(215, 979, 430, 640);
  c.beginPath(); c.moveTo(645, 979); c.lineTo(725, 1024); c.lineTo(725, 1620); c.lineTo(645, 1620); c.closePath();
  const sg = c.createLinearGradient(0, 979, 0, 1620); sg.addColorStop(0, '#B4B4B4'); sg.addColorStop(.5, 'rgba(205,212,203,0.7)'); sg.addColorStop(1, 'rgba(225,235,222,0)'); c.fillStyle = sg; c.fill();
  // mic
  c.strokeStyle = '#6E6E6E'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(452, 915); c.bezierCurveTo(445, 790, 490, 680, 560, 600); c.stroke();
  c.save(); c.translate(590, 568); c.rotate(-0.85);
  const mg = c.createLinearGradient(0, -22, 0, 22); mg.addColorStop(0, '#FAFAFA'); mg.addColorStop(.5, '#BDBDBD'); mg.addColorStop(1, '#7E7E7E');
  c.fillStyle = mg; c.beginPath(); c.roundRect(-55, -21, 110, 42, 21); c.fill(); c.fillStyle = 'rgba(255,255,255,0.92)'; c.beginPath(); c.roundRect(14, -19, 40, 38, 19); c.fill(); c.restore();
  // top slab
  c.beginPath(); c.moveTo(830, 915); c.lineTo(920, 965); c.lineTo(920, 1030); c.lineTo(830, 979); c.closePath();
  const tg = c.createLinearGradient(830, 0, 920, 0); tg.addColorStop(0, '#CFCFCF'); tg.addColorStop(1, '#8E8E8E'); c.fillStyle = tg; c.fill();
  const fg = c.createLinearGradient(170, 0, 830, 0); fg.addColorStop(0, '#858585'); fg.addColorStop(.6, '#ADADAD'); fg.addColorStop(1, '#CBCBCB'); c.fillStyle = fg; c.fillRect(170, 915, 660, 64);
  c.fillStyle = 'rgba(255,255,255,0.65)'; c.fillRect(170, 915, 660, 3);
}
function scDecent(c, t) {
  const u = t - 11.2;
  if (t < 13.15) {
    bgLight(c, '#F3F3F5', '#D5D5D8', 900);
    const z = kf(u, [[0.1, 1.7], [0.5, 1.35], [0.9, 1.25], [1.7, 0.91], [1.95, 0.88]]);
    c.save(); cam(c, z, 540, 900);
    NODES.forEach(([x, y, s, col], i) => { const d = 0.1 + rnd(i) * 0.5; node(c, x + (x - 540) * u * .03, y + (y - 900) * u * .03, s, col, back(prog(u, d, d + 0.35))); });
    const ca = prog(u, 0.35, 0.6);
    c.save(); c.globalAlpha = ca; c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.roundRect(350, 715, 380, 370, 30); c.fill();
    c.setLineDash([7, 7]); c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
    txt(c, 'Decentralised', 540, 955, '600 44px Poppins', '#1E1E1E'); txt(c, '800+ validators  ·  37 countries', 540, 1000, '400 15px Poppins', '#9C9C9C'); c.restore();
    const iy = kf(u, [[0.05, 300], [0.5, 832]]), is = kf(u, [[0.05, 2.8], [0.5, 1]]), ib = kf(u, [[0.05, 22], [0.35, 10], [0.5, 0]]);
    c.save(); if (ib > 0.3) c.filter = `blur(${ib.toFixed(1)}px)`; solTile(c, 540, iy, 150 * is); c.restore();
    c.restore();
  } else {
    bgLight(c, '#F1FCEF', '#DCE8D9', 1050);
    const top = c.createLinearGradient(0, 0, 0, 500); top.addColorStop(0, 'rgba(195,210,193,0.8)'); top.addColorStop(1, 'rgba(195,210,193,0)'); c.fillStyle = top; c.fillRect(0, 0, W, 500);
    const v = t - 13.15;
    c.save(); cam(c, kf(v, [[0, 0.9], [0.4, 1.0], [1.27, 1.04]]), 540, 1000, kf(v, [[0, -70], [0.4, 0]]), kf(v, [[0, 210], [0.4, 0]])); lectern(c); c.restore();
  }
  const fadeIn = 1 - prog(t, 11.2, 11.32);
  if (fadeIn > 0) { c.fillStyle = `rgba(240,240,242,${fadeIn})`; c.fillRect(0, 0, W, H); }
  return t < 13.15 ? 0 : kf(t, [[13.15, 5], [13.35, 0]]);
}

// =====================================================================
// SCENE 8 (14.42–17.8): orders poured through a light funnel → one company (trophy)
// =====================================================================
const CHIPS = [['BUY NVDAx', 300, 700, -.08], ['BUY AAPLx', 540, 630, -.03], ['SELL AAPLx', 770, 680, .05], ['BUY TSLAx', 330, 810, .06], ['SWAP', 560, 770, -.1], ['SELL NVDAx', 790, 810, .03]];
function chip(c, s, x, y, k, r, a) {
  if (a <= 0 || k <= 0) return; c.save(); c.globalAlpha = a; c.translate(x, y); c.rotate(r); c.scale(k, k);
  c.font = '600 22px Poppins'; const w = c.measureText(s).width + 64;
  c.fillStyle = 'rgba(34,34,34,0.95)'; c.beginPath(); c.roundRect(-w / 2, -24, w, 48, 24); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = C.lime; c.beginPath(); c.arc(-w / 2 + 24, 0, 6, 0, TAU); c.fill();
  c.fillStyle = '#E8E8E8'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(s, -w / 2 + 40, 1); c.restore();
}
function funnel(c, u) {
  const ry = 44, rimY = 840, neckY = 1320;
  c.save(); c.beginPath(); c.moveTo(60, rimY); c.lineTo(1020, rimY); c.lineTo(630, neckY); c.lineTo(450, neckY); c.closePath(); c.clip();
  const ig = c.createLinearGradient(0, rimY, 0, neckY); ig.addColorStop(0, '#1C1D1A'); ig.addColorStop(1, '#0E0E0D'); c.fillStyle = ig; c.fillRect(0, rimY, W, neckY - rimY);
  c.filter = 'blur(18px)'; c.lineCap = 'round';
  for (const [x0, x1] of [[60, 450], [1020, 630]]) { const g = c.createLinearGradient(0, rimY, 0, neckY); g.addColorStop(0, 'rgba(255,255,250,0)'); g.addColorStop(.55, 'rgba(255,255,250,0.35)'); g.addColorStop(1, 'rgba(255,255,250,1)');
    c.strokeStyle = g; c.lineWidth = 60; c.beginPath(); c.moveTo(x0, rimY); c.lineTo(x1, neckY); c.stroke(); }
  const ng = c.createRadialGradient(540, neckY, 0, 540, neckY, 260); ng.addColorStop(0, 'rgba(255,255,248,0.9)'); ng.addColorStop(1, 'rgba(255,255,248,0)'); c.fillStyle = ng; c.fillRect(0, rimY, W, neckY - rimY);
  c.restore();
  // tube
  const tg = c.createLinearGradient(0, neckY, 0, H); tg.addColorStop(0, 'rgba(232,236,222,0.95)'); tg.addColorStop(.25, 'rgba(150,152,140,0.55)'); tg.addColorStop(1, 'rgba(30,30,28,0.3)');
  c.fillStyle = tg; c.fillRect(450, neckY, 180, H - neckY);
  const sh = c.createLinearGradient(450, 0, 630, 0); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)'); c.fillStyle = sh; c.fillRect(450, neckY, 180, H - neckY);
  // rim
  c.save(); c.beginPath(); c.ellipse(540, rimY, 480, ry, 0, 0, TAU); const rg = c.createLinearGradient(0, rimY - ry, 0, rimY + ry); rg.addColorStop(0, 'rgba(150,152,140,0.35)'); rg.addColorStop(1, 'rgba(225,230,215,0.65)'); c.fillStyle = rg; c.fill();
  c.shadowColor = 'rgba(255,255,245,0.9)'; c.shadowBlur = 22; c.strokeStyle = 'rgba(255,255,248,0.95)'; c.lineWidth = 4; c.beginPath(); c.ellipse(540, rimY, 480, ry, 0, 0.05, Math.PI - 0.05); c.stroke(); c.restore();
  logo(c, 'robinhood', 548, kf(u, [[0, 1900], [0.6, 1650], [1.2, 1590], [1.95, 1570]]), 118, C.lime, { rot: 0.35, glow: 'rgba(202,251,6,0.7)', glowR: 26 });
}
function trophy(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  // handles
  c.lineWidth = 30; for (const d of [-1, 1]) { const g = c.createLinearGradient(d * 170, 0, d * 290, 0); g.addColorStop(0, '#3A3A3A'); g.addColorStop(.5, '#F2F2F2'); g.addColorStop(1, '#6A6A6A');
    c.strokeStyle = g; c.beginPath(); c.ellipse(d * 205, -75, 62, 78, 0, 0, TAU); c.stroke(); }
  // stem + base
  const st = c.createLinearGradient(-24, 0, 24, 0); st.addColorStop(0, '#5A5A5A'); st.addColorStop(.5, '#E6E6E6'); st.addColorStop(1, '#4A4A4A'); c.fillStyle = st; c.fillRect(-22, 120, 44, 120);
  c.beginPath(); c.ellipse(0, 300, 88, 72, 0, Math.PI, 0); c.closePath(); const bg = c.createRadialGradient(-30, 240, 6, 0, 290, 110); bg.addColorStop(0, '#F4F4F4'); bg.addColorStop(.45, '#7A7A7A'); bg.addColorStop(1, '#232323'); c.fillStyle = bg; c.fill();
  // bowl
  c.beginPath(); c.moveTo(-195, -170); c.bezierCurveTo(-195, 40, -110, 140, 0, 140); c.bezierCurveTo(110, 140, 195, 40, 195, -170); c.closePath();
  const bw = c.createLinearGradient(-195, 0, 195, 0); bw.addColorStop(0, '#F0F0F0'); bw.addColorStop(.1, '#6A6A6A'); bw.addColorStop(.35, '#262626'); bw.addColorStop(.65, '#1E1E1E'); bw.addColorStop(.88, '#6A6A6A'); bw.addColorStop(1, '#E2E2E2');
  c.fillStyle = bw; c.fill();
  const hl = c.createLinearGradient(0, -170, 0, 140); hl.addColorStop(0, 'rgba(255,255,255,0.18)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = hl; c.fill();
  c.beginPath(); c.ellipse(0, -170, 195, 42, 0, 0, TAU); c.fillStyle = '#D8D8D8'; c.fill();
  c.beginPath(); c.ellipse(0, -166, 180, 34, 0, 0, TAU); const ig = c.createLinearGradient(0, -200, 0, -130); ig.addColorStop(0, '#FFFFFF'); ig.addColorStop(1, '#E2E2E2'); c.fillStyle = ig; c.fill();
  rhTile(c, 0, -15, 129, { glow: 30 });
  c.restore();
}
function scCentral(c, t) {
  const u = t - 14.42;
  if (u < 1.95) {
    c.fillStyle = '#090909'; c.fillRect(0, 0, W, H);
    const tg = c.createRadialGradient(540, 200, 0, 540, 200, 900); tg.addColorStop(0, '#161616'); tg.addColorStop(1, 'rgba(9,9,9,0)'); c.fillStyle = tg; c.fillRect(0, 0, W, H);
    c.save(); cam(c, kf(u, [[0, 1.7], [0.3, 1.25], [0.6, 1.08], [1.2, 1.0]]), 540, 700, kf(u, [[1.45, 0], [1.95, 300]]), kf(u, [[0, 260], [0.6, 40], [1.2, 0]]));
    funnel(c, u);
    c.save(); c.beginPath(); c.rect(0, 0, W, 846); c.ellipse(540, 840, 470, 38, 0, 0, Math.PI); c.clip();
    CHIPS.forEach(([s, x, y, r], k) => { const p = easeIn(prog(u, 0.15 + k * 0.07, 1.05 + k * 0.07)); chip(c, s, lerp(x, 540 + (x - 540) * .25, p), lerp(y, 900, p), lerp(1, .55, p), r * (1 - p), 1 - prog(p, .85, 1)); });
    c.restore();
    c.restore();
    return kf(u, [[0, 6], [0.3, 0], [1.6, 0], [1.95, 10]]);
  }
  c.fillStyle = '#0D0D0B'; c.fillRect(0, 0, W, H);
  const gl = c.createRadialGradient(500, 960, 30, 500, 960, 760); gl.addColorStop(0, '#30332B'); gl.addColorStop(.6, '#181A15'); gl.addColorStop(1, 'rgba(13,13,11,0)'); c.fillStyle = gl; c.fillRect(0, 0, W, H);
  const x = kf(u, [[1.95, -320], [2.28, 313], [2.6, 470], [2.98, 518], [3.38, 522]]), s = kf(u, [[2.2, 1.0], [3.38, 0.92]]);
  reflect(c, 960 + 335 * s, l => trophy(l, x, 960, s), { alpha: .14, floor: '#0D0D0B', fade: 360 });
  return kf(u, [[1.95, 14], [2.3, 3], [2.5, 0]]);
}

// =====================================================================
// SCENE 9 (17.8–21.65): both apps → tokenised stocks list, NVIDIA + Apple light up
// =====================================================================
function scBoth(c, t) {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const rx = kf(t, [[18.13, 160], [18.47, 228], [18.8, 252], [19.13, 272], [19.8, 296], [20.4, 308], [21.65, 312]]);
  const ry = kf(t, [[18.13, 220], [18.47, 340], [18.8, 392], [19.13, 432], [19.8, 472], [20.4, 498], [21.65, 508]]);
  const ts = kf(t, [[18.13, 190], [18.8, 160], [20.4, 142]]), ta = kf(t, [[17.95, 0], [18.3, 0.55], [18.6, 1]]), tb = kf(t, [[18.1, 7], [18.6, 0]]);
  c.save(); if (tb > .3) c.filter = `blur(${tb.toFixed(1)}px)`;
  for (const [x, f] of [[rx, 'rh'], [1057 - rx, solGrad]]) {
    c.save(); c.globalAlpha = ta * .9; c.fillStyle = '#0E0E0E'; c.beginPath(); c.roundRect(x - ts * .62, ry - ts * .62, ts * 1.24, ts * 1.24, ts * .26); c.fill(); c.restore();
    if (f === 'rh') rhTile(c, x, ry, ts, { alpha: ta * kf(t, [[18.1, .45], [18.5, 1]]) }); else solTile(c, x, ry, ts * 1.06, { alpha: ta, bottom: '#C9C9CC', shadow: 'rgba(0,0,0,0)' });
  }
  c.restore();
  const tia = prog(t, 18.6, 18.9), tib = (1 - tia) * 8;
  c.save(); if (tib > .3) c.filter = `blur(${tib.toFixed(1)}px)`; txt(c, 'Tokenised stocks', 540, kf(t, [[18.6, 818], [21.65, 836]]), '700 50px Poppins', '#FFFFFF', { alpha: tia }); c.restore();
  // list
  const la = kf(t, [[17.95, 0], [18.3, 0.5], [18.8, 1]]), lb = kf(t, [[18.0, 8], [18.8, 0]]);
  const Y9 = kf(t, [[18.0, 1820], [19.8, 1660], [20.1, 1450], [20.6, 1282], [21.0, 1190], [21.3, 1158], [21.65, 1150]]);
  c.save(); if (lb > .3) c.filter = `blur(${lb.toFixed(1)}px)`;
  for (let i = 0; i < 16; i++) {
    const y = Y9 + (i - 9) * 90, m = prog(y, 870, 960) * (1 - prog(y, 1560, 1800)); if (m <= 0) continue;
    const nv = i === 9, ap = i === 10, hn = nv ? prog(t, 20.0, 20.15) : 0, ha = ap ? prog(t, 20.75, 20.9) : 0;
    c.save(); c.globalAlpha = la * m;
    c.fillStyle = 'rgba(255,255,255,0.02)'; c.beginPath(); c.roundRect(195, y - 27, 690, 54, 27); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = nv && hn > 0 ? mix('#2A2A2A', '#8FD13F', hn) : ap && ha > 0 ? mix('#2A2A2A', '#E8E8E8', ha) : 'rgba(255,255,255,0.17)'; c.stroke();
    c.fillStyle = nv && hn > 0 ? mix('#4A4A4A', '#7ED321', hn) : ap && ha > 0 ? mix('#4A4A4A', '#F2F2F2', ha) : '#454545'; c.beginPath(); c.arc(228, y, 9, 0, TAU); c.fill();
    if (nv) { const a = .55 + .45 * hn; logo(c, 'nvidia', 474, y, 36, C.nvidia, { alpha: a }); txt(c, 'NVIDIA', 500, y + 1, '700 25px Poppins', '#FFFFFF', { align: 'left', alpha: a, ls: 1.5 }); }
    if (ap) { const a = .45 + .55 * ha; logo(c, 'apple', 508, y - 2, 24, '#FFFFFF', { alpha: a }); txt(c, 'Apple', 524, y + 1, '500 23px Poppins', '#FFFFFF', { align: 'left', alpha: a }); }
    c.restore();
  }
  c.restore();
  return 0;
}

// =====================================================================
// SCENE 10 (21.65–23.8): glass follow card, cursor clicks Follow
// =====================================================================
const END = { name: 'Hano Crypto', subs: '152K subscribers' };
function hanoMark(c, x, y, s, col) { // HA / NO / CRYPTO wordmark
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col; c.textBaseline = 'alphabetic';
  c.font = '700 30px Poppins'; c.textAlign = 'right'; c.fillText('HA', -1, -4); c.textAlign = 'left'; c.fillText('NO', 1, 8);
  c.fillRect(-40, 2, 38, 3.5); c.fillRect(2, -26, 40, 3.5);
  c.font = '600 13px Poppins'; c.letterSpacing = '3px'; c.textAlign = 'center'; c.fillText('CRYPTO', 2, 28); c.restore();
}
function arrowCursor(c, x, y, press) {
  c.save(); c.translate(x, y); c.scale(1.6 - press * .15, 1.6 - press * .15);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 22); c.lineTo(6, 17); c.lineTo(10, 26); c.lineTo(14, 24); c.lineTo(10, 15); c.lineTo(17, 15); c.closePath();
  c.fillStyle = '#FFFFFF'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 1.6; c.stroke(); c.restore();
}
function scEnd(c, t) {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const a = prog(t, 21.68, 21.82); if (a <= 0) return 0;
  const w = 654, h = kf(t, [[21.75, 150], [22.0, 360], [22.25, 464], [22.45, 512], [22.7, 522]]), top = 960 - h / 2;
  c.save(); c.globalAlpha = a;
  c.save(); c.shadowColor = 'rgba(255,255,255,0.35)'; c.shadowBlur = 40;
  const cg = c.createLinearGradient(540 - w / 2, top, 540 + w / 2, top + h); cg.addColorStop(0, '#4E4E4E'); cg.addColorStop(.45, '#1E1E1E'); cg.addColorStop(1, '#141414');
  c.fillStyle = cg; c.beginPath(); c.roundRect(540 - w / 2, top, w, h, 48); c.fill(); c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2.5; c.beginPath(); c.roundRect(540 - w / 2, top, w, h, 48); c.stroke();
  const pt = top + h * .31, pb = top + h - 24;
  c.fillStyle = '#FFFFFF'; c.beginPath(); c.roundRect(540 - w / 2 + 24, pt, w - 48, pb - pt, 36); c.fill();
  const ia = prog(t, 21.95, 22.15); if (ia > 0) logo(c, 'instagram', 807, top + 56, 44, '#E1306C', { alpha: ia });
  const av = back(prog(t, 21.95, 22.3)); if (av > 0) { const ay = top + h * .3, r = 99 * av;
    c.save(); c.shadowColor = 'rgba(170,140,255,0.7)'; c.shadowBlur = 40; const g = c.createLinearGradient(0, ay - r, 0, ay + r); g.addColorStop(0, '#C7B6FB'); g.addColorStop(1, '#A08AF2');
    c.fillStyle = g; c.beginPath(); c.arc(540, ay, r, 0, TAU); c.fill(); c.restore(); hanoMark(c, 540, ay, 1.15 * av, '#1F1B33'); }
  const n = Math.floor(END.name.length * prog(t, 22.3, 22.6)); txt(c, END.name.slice(0, n), 540, top + h * .577, '700 37px Poppins', '#111111');
  txt(c, END.subs, 540, top + h * .66, '400 20px Poppins', '#333333', { alpha: prog(t, 22.45, 22.6) });
  const bw = 348 * easeOut(prog(t, 22.35, 22.6)), by = top + h * .81, press = prog(t, 23.45, 23.5) * (1 - prog(t, 23.55, 23.63));
  if (bw > 4) { c.save(); c.translate(540, by); c.scale(1 - press * .05, 1 - press * .05); c.fillStyle = mix('#111111', '#2E2E2E', press); c.beginPath(); c.roundRect(-bw / 2, -37, bw, 74, 37); c.fill();
    const label = t >= 23.56 ? 'Following' : 'Follow'.slice(0, Math.floor(6 * prog(t, 22.5, 22.7))); txt(c, label, 0, 1, '500 26px Poppins', '#FFFFFF'); c.restore(); }
  if (t > 22.55) arrowCursor(c, kf(t, [[22.55, 455], [23.1, 548], [23.8, 556]]), kf(t, [[22.55, top + h + 50], [23.1, by + 8], [23.8, by + 14]]), press);
  c.restore();
  return 0;
}


const SCENES = [
  { s: 0, e: 2.05, f: scHook, light: 1 },
  { s: 2.05, e: 3.1, f: scQuestion, light: 1 },
  { s: 3.1, e: 4.9, f: scFast, light: 0 },
  { s: 4.9, e: 6.42, f: scSwap, light: 1 },
  { s: 6.42, e: 9.0, f: scSlow, light: 0 },
  { s: 9.0, e: 11.2, f: scBacked, light: 0 },
  { s: 11.2, e: 14.42, f: scDecent, light: 1 },
  { s: 14.42, e: 17.8, f: scCentral, light: 0 },
  { s: 17.8, e: 21.65, f: scBoth, light: 0 },
  { s: 21.65, e: 99, f: scEnd, light: 0 },
];
const CAPS = [
  [3.12, 4.37, 'Solana is fast'], [4.37, 4.91, 'and cheap'], [4.91, 5.35, 'and lets'], [5.35, 5.83, 'you trade'], [5.83, 6.57, 'instantly.'],
  [6.57, 7.15, 'Robinhood'], [7.15, 7.95, 'chain is slower'], [7.95, 9.17, 'with higher fees,'], [9.17, 9.73, "it's backed"], [9.73, 10.09, 'by the'], [10.09, 11.37, 'RobinHood Exchange.'],
  [11.41, 11.99, 'Solana'], [11.99, 13.27, 'is decentralized.'], [13.27, 13.95, 'Nobody is in'], [13.95, 14.59, 'charge.'],
  [14.59, 15.13, 'Robinhood'], [15.13, 15.59, 'chain is'], [15.59, 16.49, 'centralized.'], [16.49, 17.03, 'One company'], [17.03, 17.97, 'controls it'],
  [17.97, 18.59, 'with both.'], [18.59, 18.93, 'You can buy'], [18.93, 19.85, 'tokenized stocks'], [19.85, 20.59, 'like Nvidia'], [20.59, 21.07, 'and Apple'], [21.07, 21.63, 'on chain.'],
];

const VIDEO = {
  fonts: ['400 30px Poppins', '500 30px Poppins', '600 30px Poppins', '700 30px Poppins', '400 100px "League Gothic"'],
  caption: { weight: 500, fit: ['Solana is fast', 318], y: 309, onLight: '#161616', onDark: '#FFFFFF' },
  scenes: SCENES,
  captions: CAPS,
  prerender() { prerenderBlob(); QSIZE = fitFont("What's the difference?", 692); },
};
