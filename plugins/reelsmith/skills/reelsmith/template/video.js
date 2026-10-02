// video.js — the reel itself. Each scene is a function of time; replace these with the scenes of the reel you're rebuilding.
// Coordinates are in project.json pixels (1080×1920 by default). Helpers come from engine.js.

const C = { ink: '#1C1C1C', accent: '#6CF2C2', paper: ['#F4E9D8', '#E9B872', '#D9653B', '#2E4A62'] };

// Scene 1 — dark stage, glowing ring drops in, horizon line
function scRing(c, t) {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const y = kf(t, [[0, 260], [0.6, 760], [1.2, 800]]), s = kf(t, [[0, 1.6], [0.6, 1.05], [2, 1]]);
  const hy = kf(t, [[0, 1500], [0.6, 1110], [1.2, 1090]]);
  const g = c.createLinearGradient(0, hy, 0, hy + 420); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(.15, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, hy, W, 420); c.fillStyle = '#FFF'; c.fillRect(0, hy - 3, W, 6);
  c.save(); c.translate(W / 2, y); c.scale(s, s);
  glow(c, 0, 0, 320, C.accent, .25);
  c.lineWidth = 18; c.strokeStyle = C.accent; c.shadowColor = C.accent; c.shadowBlur = 30; c.beginPath(); c.arc(0, 0, 210, 0, TAU); c.stroke(); c.shadowBlur = 0;
  c.lineWidth = 14; const sb = c.createLinearGradient(-200, -200, 200, 200); sb.addColorStop(0, '#FFF'); sb.addColorStop(.6, '#666'); sb.addColorStop(1, '#DDD'); c.strokeStyle = sb; c.beginPath(); c.arc(0, 0, 190, 0, TAU); c.stroke();
  c.fillStyle = '#08080C'; c.beginPath(); c.arc(0, 0, 178, 0, TAU); c.fill();
  txt(c, '24/7', 0, 6, '700 110px Poppins', '#FFFFFF');
  c.restore();
  return kf(t, [[0, 8], [0.5, 0]]); // motion blur while it drops in
}

// Scene 2 — light stage, a card pops in and a pill confirms
function scCard(c, t) {
  bgLight(c, '#F3F3F3', '#C4C4C7');
  const k = back(prog(t, 2.05, 2.45));
  c.save(); c.translate(W / 2, 980); c.scale(k, k);
  c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 50; c.shadowOffsetY = 18; c.fillStyle = '#FAFAFB'; c.beginPath(); c.roundRect(-240, -320, 480, 640, 40); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  txt(c, 'Markets never sleep', 0, -120, '700 38px Poppins', C.ink);
  txt(c, 'and neither does this reel', 0, -70, '400 22px Poppins', '#9A9A9A');
  pill(c, 0, 80, 300 * easeOut(prog(t, 2.6, 2.9)), 60, '#58D696', prog(t, 2.8, 2.9) > .5 ? 'built in code' : '', '#FFF', { glow: 'rgba(88,214,150,0.5)', size: 20 });
  c.restore();
  return 0;
}

// Scene 3 — paper cut: torn layers on twos (stop-motion boil)
function scPaper(c, t) {
  const tb = boil(t, 12), f = Math.floor(t * 12);
  c.fillStyle = C.paper[0]; c.fillRect(0, 0, W, H);
  const sun = kf(tb, [[4, 1500], [5, 700]]);
  paper(c, torn(Array.from({ length: 24 }, (_, i) => [540 + Math.cos(i / 24 * TAU) * 170, sun + Math.sin(i / 24 * TAU) * 170]), f, 5), { fill: C.paper[1], depth: 14 });
  [[1180, C.paper[2], 0], [1380, C.paper[3], 1]].forEach(([base, col, i]) => {
    const rise = kf(tb, [[4 + i * .15, 600], [4.6 + i * .15, 0]]), pts = [[-40, H + 40]];
    for (let x = -40; x <= W + 40; x += 90) pts.push([x, base + rise + Math.sin(x / 160 + i * 2) * 70]);
    pts.push([W + 40, H + 40]); paper(c, torn(pts, f + i * 7, 7), { fill: col, depth: 22 });
  });
  txt(c, 'paper cut too', W / 2, 520, '700 64px Poppins', C.ink, { alpha: prog(t, 4.6, 4.8) });
  return 0;
}

const VIDEO = {
  fonts: ['400 30px Poppins', '500 30px Poppins', '600 30px Poppins', '700 30px Poppins', '400 100px "League Gothic"'],
  images: {},
  caption: { weight: 500, size: 50, y: 309, onLight: '#161616', onDark: '#FFFFFF' },
  scenes: [
    { s: 0, e: 2.0, f: scRing, light: 0 },
    { s: 2.0, e: 4.0, f: scCard, light: 1 },
    { s: 4.0, e: 99, f: scPaper, light: 1 },
  ],
  captions: [[0.3, 2.0, 'This is reelsmith'], [2.1, 3.9, 'Every frame is code']],
  prerender() {},
};
