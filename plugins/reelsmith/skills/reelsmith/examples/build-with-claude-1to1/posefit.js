// 3D pose fitting: render the three.js laptop at a pose, compare its outlines with a frame of the original, search the pose.
// p = [yaw, lid, camX, camY, camZ, lookX, lookY, fov]
const PF = { w: 240, h: 135 };
function lapPose(p) {
  L3.root.position.set(0, 0, 0); L3.root.scale.setScalar(1); L3.lap.rotation.set(0, p[0], 0); L3.pivot.rotation.x = p[1];
  L3.camera.fov = p[7]; L3.camera.updateProjectionMatrix(); L3.camera.position.set(p[2], p[3], p[4]); L3.camera.lookAt(p[5], p[6], 0);
}
function v2Pose(t) { // the hand-tuned pose, as a starting point
  const yaw = seg(t, [[9.19, .15], [9.28, -.75, 'l'], [9.34, -1.7, 'l'], [9.4, -2.85, 'l'], [9.5, -3.75, 'l'], [9.6, -4.55, 'l'], [9.7, -4.95, 'l'], [10.45, -5.55, 'o'], [10.75, -5.57, 's']]);
  const d = seg(t, [[9.19, 74], [9.42, 77, 's'], [9.6, 88, 's'], [10.45, 104, 'o'], [10.75, 105]]), camX = seg(t, [[9.19, -6], [9.36, -3, 'o'], [9.7, 1], [10.45, -2.6, 'o'], [10.75, -2.6]]), q = seg(t, [[9.42, 0], [9.7, 1, 's']]);
  return [yaw, -.24, camX, lerp(14, 4 + 19 * d / 96, q), d, camX, lerp(9.5, 5.2, q), 24];
}
function edgeMap(gray, w, h, mask) { // blurred gradient magnitude, unit-normalised
  const g = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, gx = gray[i + 1 - w] + 2 * gray[i + 1] + gray[i + 1 + w] - gray[i - 1 - w] - 2 * gray[i - 1] - gray[i - 1 + w], gy = gray[i - 1 + w] + 2 * gray[i + w] + gray[i + 1 + w] - gray[i - 1 - w] - 2 * gray[i - w] - gray[i + 1 - w];
    g[i] = mask && mask[i] ? 0 : Math.hypot(gx, gy);
  }
  const b = new Float32Array(w * h); // 3x3 box blur, twice
  for (let k = 0; k < 2; k++) { const s = k ? b.slice() : g; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { let a = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a += s[(y + dy) * w + x + dx]; b[y * w + x] = a / 9; } }
  let n = 0; for (const v of b) n += v * v; n = Math.sqrt(n) || 1; for (let i = 0; i < b.length; i++) b[i] /= n; return b;
}
let PFC;
function renderGray() {
  if (!PFC) PFC = mk(PF.w, PF.h); const g = PFC.getContext('2d'); g.fillStyle = '#d8d8da'; g.fillRect(0, 0, PF.w, PF.h);
  L3.renderer.render(L3.scene, L3.camera); g.drawImage(L3.canvas, 0, 0, PF.w, PF.h);
  const d = g.getImageData(0, 0, PF.w, PF.h).data, out = new Float32Array(PF.w * PF.h); for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3; return out;
}
function nm(f, x0, step, iters) {
  const n = x0.length; let S = [x0.slice()]; for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += step[i]; S.push(x); } let F = S.map(f);
  for (let it = 0; it < iters; it++) {
    const o = F.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); S = o.map(a => S[a[1]]); F = o.map(a => a[0]);
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j] / n;
    const at = k => c.map((v, j) => v + k * (S[n][j] - v)), xr = at(-1), fr = f(xr);
    if (fr < F[0]) { const xe = at(-2), fe = f(xe); [S[n], F[n]] = fe < fr ? [xe, fe] : [xr, fr]; }
    else if (fr < F[n - 1]) { S[n] = xr; F[n] = fr; }
    else { const xc = at(.5), fc = f(xc); if (fc < F[n]) { S[n] = xc; F[n] = fc; } else { for (let i = 1; i <= n; i++) { S[i] = S[i].map((v, j) => S[0][j] + .5 * (v - S[0][j])); F[i] = f(S[i]); } } }
  }
  const i = F.indexOf(Math.min(...F)); return [S[i], F[i]];
}
// fit one frame: target = grey pixels of the original at PF size; starts = candidate poses
window.fitPose = (target, t, starts, iters = 140) => {
  if (L3.renderer.getSize(new THREE.Vector2()).x !== 480) L3.renderer.setSize(480, 270, false);
  const mask = new Uint8Array(PF.w * PF.h);
  if (t > 9.8) for (let y = 0; y < PF.h; y++) for (let x = 0; x < PF.w; x++) { const X = x / PF.w * W, Y = y / PF.h * H; if (Y > 440 && Y < 580 && (X < 540 || X > 1270)) mask[y * PF.w + x] = 1; } // the words, not the laptop
  const T = edgeMap(Float32Array.from(target), PF.w, PF.h, mask);
  const cost = p => { lapPose(p); const R = edgeMap(renderGray(), PF.w, PF.h, mask); let s = 0; for (let i = 0; i < R.length; i++) s += R[i] * T[i]; return 1 - s; };
  let best = null;
  for (const s0 of [...starts, v2Pose(t)]) { const c = cost(s0); if (!best || c < best[1]) best = [s0, c]; }
  const [p, c] = nm(cost, best[0], [.08, .05, 1, 1, 3, 1, 1, 1.5], iters);
  return { pose: p, cost: c, start: best[1] };
};
window.restoreSize = () => L3.renderer.setSize(W, H, false);

// silhouette fitting (robust): the original's laptop = pixels that differ from the measured background; ours = the render's alpha
function renderAlpha() {
  if (!PFC) PFC = mk(PF.w, PF.h); const g = PFC.getContext('2d'); g.clearRect(0, 0, PF.w, PF.h);
  L3.renderer.render(L3.scene, L3.camera); g.drawImage(L3.canvas, 0, 0, PF.w, PF.h);
  const d = g.getImageData(0, 0, PF.w, PF.h).data, out = new Float32Array(PF.w * PF.h); for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255; return out;
}
window.fitSil = (sil, t, starts, iters = 160) => {
  if (L3.renderer.getSize(new THREE.Vector2()).x !== 480) L3.renderer.setSize(480, 270, false);
  const S = Float32Array.from(sil), prior = v2Pose(t), sc = [.6, .3, 6, 6, 15, 6, 6, 1];
  const cost = p => { const q = p.slice(); q[7] = 24; lapPose(q); const A = renderAlpha(); let mn = 0, mx = 0;
    for (let i = 0; i < A.length; i++) { if (S[i] < 0) continue; mn += Math.min(A[i], S[i]); mx += Math.max(A[i], S[i]); }
    let reg = 0; for (let j = 0; j < 7; j++) reg += ((p[j] - prior[j]) / sc[j]) ** 2;
    // front vs back look the same in outline: stay within ±0.6 rad of the hand-tuned turn, which has the right side facing us
    const dy = Math.atan2(Math.sin(p[0] - prior[0]), Math.cos(p[0] - prior[0])), over = Math.max(0, Math.abs(dy) - .6);
    return 1 - mn / Math.max(mx, 1) + .002 * reg + 10 * over * over; };
  let best = null; for (const s0 of [...starts, prior]) { const c = cost(s0); if (!best || c < best[1]) best = [s0, c]; }
  const [p, c] = nm(cost, best[0], [.1, .05, 1.5, 1.5, 4, 1.5, 1.5, 0], iters); p[7] = 24; lapPose(p); const A = renderAlpha();
  let mn = 0, mx = 0; for (let i = 0; i < A.length; i++) { if (S[i] < 0) continue; mn += Math.min(A[i], S[i]); mx += Math.max(A[i], S[i]); }
  return { pose: p, cost: c, start: best[1], iou: mn / Math.max(mx, 1) };
};
window.silOverlay = (sil, pose) => { // red = original laptop, green = ours, yellow = both
  pose = pose.slice(); pose[7] = 24; lapPose(pose); const A = renderAlpha(), c = mk(PF.w, PF.h), g = c.getContext('2d'), im = g.createImageData(PF.w, PF.h);
  for (let i = 0; i < A.length; i++) { im.data[i * 4] = sil[i] > .5 ? 255 : 30; im.data[i * 4 + 1] = A[i] > .5 ? 255 : 30; im.data[i * 4 + 2] = 30; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return c.toDataURL('image/png');
};
