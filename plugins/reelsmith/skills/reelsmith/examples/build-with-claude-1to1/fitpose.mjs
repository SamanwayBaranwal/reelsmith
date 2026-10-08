// drive the in-page pose fitter over the laptop shots, frame by frame; writes ref/laptop_pose.json
import { chromium } from 'playwright-core'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const ROOT = path.dirname(new URL(import.meta.url).pathname), T0 = +process.argv[2] || 9.2, T1 = +process.argv[3] || 10.83, FPS = 30;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ args: ['--use-angle=metal'] }); const page = await browser.newPage();
page.on('pageerror', e => console.error('PAGE', e.message)); await page.goto(`http://127.0.0.1:${server.address().port}/reel.html`); await page.evaluate(() => window.ready);
const BG = JSON.parse(fs.readFileSync(path.join(ROOT, 'ref/laptop_bg.json'))).find(r => Math.abs(r[0] - 10.3) < 1e-6)[1];
const sil = t => { // laptop silhouette in the original: differs from the measured background (words masked out once they appear)
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', t.toFixed(4), '-i', path.join(ROOT, 'ref/original.mp4'), '-frames:v', '1', '-vf', 'scale=240:135', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 }); const f = r.stdout, out = [];
  for (let y = 0; y < 135; y++) for (let x = 0; x < 240; x++) {
    const a = x / 239, b = y / 134, v = [1, a, b, a * a, b * b, a * b], i = (y * 240 + x) * 3; let d = 0;
    for (let ch = 0; ch < 3; ch++) d = Math.max(d, Math.abs(f[i + ch] - BG[ch].reduce((s, k, j) => s + k * v[j], 0)));
    const X = a * 1916, Y = b * 1080; out.push(t > 9.8 && Y > 440 && Y < 580 && (X < 540 || X > 1270) ? -1 : Math.min(1, Math.max(0, (d - 10) / 14)));
  }
  // fill enclosed holes (the white screen inside its dark bezel looks like background): flood the background in from the frame edge
  const w = 240, h = 135, solid = out.map(v => v > .5 ? 1 : 0), seen = new Uint8Array(w * h), st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) { const i = st.pop(); if (seen[i] || solid[i]) continue; seen[i] = 1; const x = i % w, y = (i / w) | 0;
    if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w); }
  for (let i = 0; i < out.length; i++) if (!seen[i] && out[i] >= 0) out[i] = Math.max(out[i], 1);
  // keep only the biggest blob (the laptop): stray background mismatches (vignette corners) aren't laptop
  const lab = new Int32Array(w * h), sizes = [0]; let n = 0;
  for (let i = 0; i < out.length; i++) { if (out[i] <= .5 || lab[i]) continue; n++; let c = 0; const q = [i]; lab[i] = n;
    while (q.length) { const j = q.pop(); c++; const x = j % w, y = (j / w) | 0; for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (k >= 0 && !lab[k] && out[k] > .5) { lab[k] = n; q.push(k); } }
    sizes.push(c); }
  const big = sizes.indexOf(Math.max(...sizes)); for (let i = 0; i < out.length; i++) if (out[i] > 0 && lab[i] !== big && out[i] >= 0) out[i] = 0;
  return out; };
const gray = t => { const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', t.toFixed(4), '-i', path.join(ROOT, 'ref/original.mp4'), '-frames:v', '1', '-vf', 'scale=240:135,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 }); return Array.from(r.stdout); };
if (process.env.OVERLAY) { const t = +process.env.OVERLAY, P = JSON.parse(fs.readFileSync(path.join(ROOT, 'ref/laptop_pose.json'))), p = P.reduce((a, b) => Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a).slice(1);
  const url = await page.evaluate(([s, p]) => window.silOverlay(s, p), [sil(t), p]); fs.writeFileSync(path.join(ROOT, 'ref/overlay.png'), Buffer.from(url.split(',')[1], 'base64')); await browser.close(); server.close(); process.exit(0); }
const out = []; let prev = null;
for (let i = Math.round(T0 * FPS); i <= Math.round(T1 * FPS); i++) {
  const t = i / FPS, starts = prev ? [prev] : [];
  const r = await page.evaluate(([g, t, s]) => window.fitSil(g, t, s), [sil(t), t, starts]);
  out.push([+t.toFixed(4), ...r.pose.map(v => +v.toFixed(4))]); prev = r.pose;
  console.log(t.toFixed(3), 'cost', r.start.toFixed(3), '→', r.cost.toFixed(3), 'overlap', (r.iou * 100).toFixed(1) + '%', r.pose.map(v => v.toFixed(2)).join(' '));
}
fs.writeFileSync(path.join(ROOT, 'ref/laptop_pose.json'), JSON.stringify(out)); await browser.close(); server.close();
