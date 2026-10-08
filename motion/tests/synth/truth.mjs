// dump the exact per-frame state of every top-level layer, straight from the comp's keyframes
import fs from 'node:fs'; import vm from 'node:vm';
const ctx = vm.createContext({ console, DOMMatrix: class {} }); const r = f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
r('engine.js'); r('logos.js'); r('motion.js'); r('comp.js');
const P = JSON.parse(fs.readFileSync('project.json', 'utf8'));
vm.runInContext(`W=${P.width};H=${P.height};FPS=${P.fps};`, ctx);
const out = vm.runInContext(`(() => { const o = {}; for (const L of COMP.layers) { o[L.name] = []; for (let i = 0; i <= ${P.duration * P.fps}; i++) { const t = i / FPS, p = v2(val(L.position, t, L), [W/2, H/2]), s = v2(val(L.scale, t, L), [100, 100]);
  o[L.name].push({ t, x: p[0], y: p[1], scale_x: s[0], scale_y: s[1], rotation: val(L.rotation, t, L) || 0, opacity: val(L.opacity, t, L) ?? 100 }); } } return o; })()`, ctx);
fs.writeFileSync('truth.json', JSON.stringify(out)); console.log('truth.json:', Object.keys(out).join(', '));
