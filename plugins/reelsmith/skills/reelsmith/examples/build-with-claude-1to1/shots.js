// Shot 4 (dashboards) pieces taken apart from the hand-built scene, so each can sit at its right depth among the tracked cards.
function bgDash(c, t) { // white base, early pink glow, peach stripes fading in on the hit
  c.fillStyle = '#FCFCFC'; c.fillRect(0, 0, W, H);
  glow(c, 960, 540, 760, '#FBCDB8', .55 * prog(t, 6.94, 7.3));
  const st = seg(t, [[7.45, 0], [7.6, 1, 'o']]);
  if (st > 0) for (let i = 0; i < 11; i++) { const x = 120 + i * 170 + Math.sin(t * 2 + i) * 10, a = st * (.18 + .22 * rnd(i)); const g = c.createLinearGradient(x - 50, 0, x + 50, 0); g.addColorStop(0, 'rgba(250,180,150,0)'); g.addColorStop(.5, `rgba(250,180,150,${a})`); g.addColorStop(1, 'rgba(250,180,150,0)'); c.fillStyle = g; c.fillRect(x - 50, 0, 100, H); }
  const fadeW = c.createLinearGradient(0, 0, 0, H); fadeW.addColorStop(0, 'rgba(252,252,252,0.9)'); fadeW.addColorStop(.35, 'rgba(252,252,252,0)'); fadeW.addColorStop(.75, 'rgba(252,252,252,0)'); fadeW.addColorStop(1, 'rgba(252,252,252,0.95)'); c.fillStyle = fadeW; c.fillRect(0, 0, W, H);
}
function dashFly(c, t) { // the real card popping out of the arrow's dive, until tracking picks it up at 8.13 s
  if (t < 7.62) return;
  const x = seg(t, [[7.62, 1010], [7.72, 843, 'o'], [7.96, 917, 's'], [8.3, 965, 's']]), y = seg(t, [[7.62, 640], [7.96, 650, 's'], [8.3, 692, 's']]);
  const w = seg(t, [[7.62, 40], [7.72, 470, 'o'], [7.84, 540, 's'], [7.96, 605, 's'], [8.3, 800, 's']]), sp = seg(t, [[7.62, 1], [7.92, 0, 'o']]), res = seg(t, [[7.62, -.2], [8.3, -.06, 's']]);
  card3D(c, DASH.white, x, y, w, w * .7466, .9 * sp, -1.5 * sp + res, -.5 * sp + .02);
}
function arrowOnly(c, t) { // measured path, nose along its velocity
  const ax = kf(t, AX), ay = kf(t, AY), vx = kf(t + .025, AX) - kf(t - .025, AX), vy = kf(t + .025, AY) - kf(t - .025, AY);
  arrow3D(c, ax, ay, kf(t, [[6.94, 110], [7.4, 80], [7.78, 64], [7.96, 110], [8.3, 120], [8.65, 150], [9.2, 150]]), Math.hypot(vx, vy) < 2 ? 0 : Math.atan2(vx, -vy));
  if (t < 7.45) glow(c, ax, ay, 220, '#FBB896', .35);
}

// Shots 5–6 (MacBook): the 3D laptop driven frame by frame by poses fitted to the original (fitpose.mjs), on the measured background
let LPOSE, LBGC;
async function loadLaptopFit() {
  try { LPOSE = await (await fetch('ref/laptop_pose.json')).json(); } catch (e) { LPOSE = null; }
  if (LPOSE) { // fitted per frame → smooth over time: light during the whip (keep the snap), strong once it glides (no wobble)
    for (let i = 1; i < LPOSE.length; i++) { let d = LPOSE[i][1] - LPOSE[i - 1][1]; while (d > Math.PI) { LPOSE[i][1] -= 2 * Math.PI; d -= 2 * Math.PI; } while (d < -Math.PI) { LPOSE[i][1] += 2 * Math.PI; d += 2 * Math.PI; } }
    const raw = LPOSE.map(r => r.slice());
    LPOSE = raw.map((r, i) => { const sg = r[0] < 9.62 ? 1.2 : 4, out = [r[0]];
      for (let j = 1; j < r.length; j++) { let a = 0, w = 0; for (let k = -12; k <= 12; k++) { const q = raw[i + k]; if (!q) continue; const ww = Math.exp(-k * k / (2 * sg * sg)); a += q[j] * ww; w += ww; } out.push(a / w); }
      return out; });
  }
  const B = await (await fetch('ref/laptop_bg.json')).json(), C = B.find(r => Math.abs(r[0] - 10.3) < 1e-6)[1];
  LBGC = mk(192, 108); const g = LBGC.getContext('2d'), im = g.createImageData(192, 108);
  for (let y = 0; y < 108; y++) for (let x = 0; x < 192; x++) { const a = x / 191, b = y / 107, v = [1, a, b, a * a, b * b, a * b], i = (y * 192 + x) * 4;
    for (let ch = 0; ch < 3; ch++) im.data[i + ch] = Math.max(0, Math.min(255, C[ch].reduce((s, k, j) => s + k * v[j], 0))); im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
}
function lapPoseAt(t) {
  if (!LPOSE || t < LPOSE[0][0] - 1e-6) return LPOSE ? LPOSE[0].slice(1) : v2Pose(t);
  for (let i = 1; i < LPOSE.length; i++) if (t <= LPOSE[i][0] + 1e-6) { const a = LPOSE[i - 1], b = LPOSE[i], p = (t - a[0]) / (b[0] - a[0]); return a.slice(1).map((v, j) => v + (b[j + 1] - v) * p); }
  return LPOSE[LPOSE.length - 1].slice(1);
}
function scLaptopFit(c, t) {
  c.save(); c.imageSmoothingQuality = 'high'; c.drawImage(LBGC, 0, 0, W, H); c.restore();
  if (L3.renderer.getSize(new THREE.Vector2()).x !== W) L3.renderer.setSize(W, H, false);
  lapPose(lapPoseAt(t)); L3.renderer.render(L3.scene, L3.camera); c.drawImage(L3.canvas, 0, 0);
  dispWords(c, t, [['Unlock', 9.84, 700], ['Your', 9.95, 600, '#5A5A5E']], 160, 533, 64, '#2A2A2C');
  dispWords(c, t, [['Full', 10.14, 700], ['Potential.', 10.26, 600, '#5A5A5E']], 1317, 520, 64, '#2A2A2C');
  return 0;
}

// The real MacBook Pro 14" model (CC-BY 4.0, akshatmittal on Sketchfab) in place of the hand-built box laptop.
// Same size as before, so the fitted poses carry over; the lid gets a hinge so its angle stays a parameter.
async function loadMacbook() {
  const T = THREE, gltf = await new Promise((ok, no) => new GLTFLoader().load('assets/macbook14.glb', ok, undefined, no)), m = gltf.scene;
  for (const o of [...L3.lap.children]) o.visible = false;                 // retire the box laptop
  m.scale.setScalar(100); const holder = new T.Group(); holder.position.set(0, 1.2, .6); holder.add(m); L3.lap.add(holder);
  const lid = m.getObjectByName('BLWpxSqmmLNyfOl'), hinge = new T.Group(); hinge.position.set(0, -.4, -11.7);
  lid.parent.add(hinge); hinge.add(lid); lid.position.set(0, .4, 11.7);
  const base = -Math.atan2(19.023 - 12.349, 19.445 - 1.016);                // the model's own lid tilt
  L3.pivot = { rotation: {} }; Object.defineProperty(L3.pivot.rotation, 'x', { set: v => { hinge.rotation.x = v - base; }, get: () => hinge.rotation.x + base });
  // the display: the real dashboard, filling the panel
  const scr = mk(1550, 1000), g = scr.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 1550, 1000);
  const im = DASH.white, k = Math.max(1550 / im.width, 1000 / im.height); g.drawImage(im, (1550 - im.width * k) / 2, (1000 - im.height * k) / 2, im.width * k, im.height * k);
  const tex = new T.CanvasTexture(scr); tex.colorSpace = T.SRGBColorSpace; tex.flipY = true; tex.anisotropy = 8;
  const disp = m.getObjectByName('abgVijaHVNRUvcc'); disp.traverse(o => { if (o.isMesh) o.material = new T.MeshBasicMaterial({ map: tex, toneMapped: false }); });
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const logo = m.getObjectByName('FnbkdmFKVeCCxTX'); logo.traverse(o => { if (o.isMesh) o.material = new T.MeshPhysicalMaterial({ color: 0xE9E9EC, metalness: 1, roughness: .12 }); }); // mirror-polished logo, like the reference
  window.MACBOOK = { m, hinge, disp, tex };
}
