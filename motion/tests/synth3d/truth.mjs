// exact per-frame state of each top-level layer, plus where its anchor lands on screen and its apparent (on-screen) scale
import fs from 'node:fs'; import vm from 'node:vm';
const ctx = vm.createContext({ console, DOMMatrix: class {} }); const r = f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
r('engine.js'); r('logos.js'); r('motion.js'); r('comp.js');
const P = JSON.parse(fs.readFileSync('project.json', 'utf8'));
vm.runInContext(`W=${P.width};H=${P.height};FPS=${P.fps};`, ctx);
const out = vm.runInContext(`(() => { const o = {}, f = focal(COMP); for (const L of COMP.layers) { o[L.name] = []; for (let i = 0; i <= ${P.duration * P.fps}; i++) {
  const t = i / FPS, p = val(L.position, t, L) ?? [W/2, H/2, 0], s = v2(val(L.scale, t, L), [100, 100]), z = p[2] || 0, k = f / (f + z);
  o[L.name].push({ t, x: (p[0] - W/2) * k + W/2, y: (p[1] - H/2) * k + H/2, z, scale_x: s[0] * k, scale_y: s[1] * k, rotation: val(L.rotation, t, L) || 0,
    rotationX: val(L.rotationX, t, L) || 0, rotationY: val(L.rotationY, t, L) || 0, opacity: val(L.opacity, t, L) ?? 100 }); } } return o; })()`, ctx);
fs.writeFileSync('truth.json', JSON.stringify(out)); console.log('truth.json:', Object.keys(out).join(', '));
