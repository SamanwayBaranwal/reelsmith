# camera truth: where the reference centre lands, zoom, rotation — evaluated with the engine's own keyframes via node
import json, subprocess
js = r"""
import fs from 'node:fs'; import vm from 'node:vm';
const ctx = vm.createContext({ console, DOMMatrix: class {} }); const r = f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx);
r('engine.js'); r('logos.js'); r('motion.js'); r('comp.js'); vm.runInContext('W=1920;H=1080;FPS=30;', ctx);
console.log(JSON.stringify(vm.runInContext(`(() => { const o = []; const C = COMP.camera; for (let i = 0; i <= 120; i++) { const t = i / 30;
  const s = val(C.scale, t) / 100, a = val(C.anchor, t), rot = val(C.rotation, t) * Math.PI / 180, dx = 960 - a[0], dy = 540 - a[1];
  o.push({ t, x: 960 + s * (Math.cos(rot) * dx - Math.sin(rot) * dy), y: 540 + s * (Math.sin(rot) * dx + Math.cos(rot) * dy), scale_x: s * 100, rotation: val(C.rotation, t) }); } return o; })()`, ctx)));
"""
open('_truth.mjs', 'w').write(js); out = subprocess.check_output(['node', '_truth.mjs']).decode(); json.dump({'camera': json.loads(out)}, open('truth.json', 'w')); print('truth.json')
