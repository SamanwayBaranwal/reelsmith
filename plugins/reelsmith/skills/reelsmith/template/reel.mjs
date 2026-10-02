#!/usr/bin/env node
// reelsmith project tool. Run `node reel.mjs help`.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.json'), 'utf8'));
const FPS = P.fps || 30, DUR = P.duration || 10, REF = P.reference ? path.join(ROOT, P.reference) : null;
const OUT = path.join(ROOT, P.output || 'out/video.mp4');
const TMP = path.join(ROOT, '.tmp');
const rel = f => path.relative(ROOT, f);
const mkdir = d => fs.mkdirSync(d, { recursive: true });

function ff(args, opts = {}) {
  const r = spawnSync(opts.bin || 'ffmpeg', opts.bin ? args : ['-loglevel', 'error', '-y', ...args], { encoding: opts.binary ? 'buffer' : 'utf8', maxBuffer: 1 << 28 });
  if (r.error) die(`${opts.bin || 'ffmpeg'} not found. Install ffmpeg (macOS: brew install ffmpeg · Windows: winget install Gyan.FFmpeg · Linux: sudo apt install ffmpeg).`);
  if (r.status !== 0 && !opts.ok) die(`${opts.bin || 'ffmpeg'} failed:\n${r.stderr}`);
  return r;
}
function die(m) { console.error(m); process.exit(1); }
function needRef() { if (!REF || !fs.existsSync(REF)) die('project.json "reference" must point at the reference video (e.g. ref/original.mp4).'); }
const tf = t => Number(t).toFixed(2);

// ---------- browser rendering ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
async function withPages(n, fn) {
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const args = process.platform === 'darwin' ? ['--use-angle=metal'] : [];
  let browser;
  try { browser = await chromium.launch({ args }); }
  catch { try { browser = await chromium.launch({ channel: 'chrome', args }); } catch { die('No browser for rendering. Run: npx playwright-core install chromium'); } }
  const pages = await Promise.all(Array.from({ length: n }, async () => {
    const p = await browser.newPage({ viewport: { width: 540, height: 960 } });
    p.on('pageerror', e => console.error('PAGE ERROR', e.message));
    p.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
    await p.goto(`http://127.0.0.1:${server.address().port}/reel.html`); await p.evaluate(() => window.ready); return p;
  }));
  try { await fn(pages); } finally { await browser.close(); server.close(); }
}
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
async function preview(times) {
  mkdir(path.join(ROOT, 'preview'));
  await withPages(1, async ([p]) => { for (const t of times) save(path.join(ROOT, 'preview', `t_${tf(t)}.jpg`), await p.evaluate(t => window.grab(t), t)); });
  return times.map(t => path.join(ROOT, 'preview', `t_${tf(t)}.jpg`));
}

// ---------- image helpers (ffmpeg) ----------
function grabRef(t, w, out) { ff(['-ss', String(t), '-i', REF, '-frames:v', '1', '-vf', `scale=${w}:-2`, out]); return out; }
function grid(inputs, cols, out, w = 300) {
  const rows = Math.ceil(inputs.length / cols), args = [], f = [];
  inputs.forEach((p, i) => { args.push('-i', p); f.push(`[${i}:v]scale=${w}:${Math.round(w * 16 / 9 / 2) * 2},setsar=1[v${i}]`); });
  const pad = rows * cols - inputs.length; for (let k = 0; k < pad; k++) { args.push('-f', 'lavfi', '-i', `color=black:s=${w}x${Math.round(w * 16 / 9 / 2) * 2}`); f.push(`[${inputs.length + k}:v]null[v${inputs.length + k}]`); }
  const n = rows * cols; let fc = f.join(';') + ';';
  if (n === 1) fc += '[v0]null[o]'; else fc += Array.from({ length: n }, (_, i) => `[v${i}]`).join('') + `xstack=inputs=${n}:layout=${Array.from({ length: n }, (_, i) => `${(i % cols) ? Array.from({ length: i % cols }, () => 'w0').join('+') : '0'}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, () => 'h0').join('+') : '0'}`).join('|')}[o]`;
  ff([...args, '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', out]); return out;
}

// ---------- commands ----------
const cmds = {
  async preview(...ts) { if (!ts.length) die('usage: node reel.mjs preview 1.0 2.5 ...'); (await preview(ts.map(Number))).forEach(f => console.log(rel(f))); },

  async render(workers = '4') {
    const N = Math.round(DUR * FPS), dir = path.join(ROOT, 'frames'); fs.rmSync(dir, { recursive: true, force: true }); mkdir(dir);
    let next = 0, done = 0; const t0 = Date.now();
    await withPages(Number(workers), pages => Promise.all(pages.map(async p => {
      while (next < N) { const f = next++; save(path.join(dir, `${String(f).padStart(5, '0')}.jpg`), await p.evaluate(t => window.grab(t), f / FPS));
        if (++done % 60 === 0 || done === N) console.log(`${done}/${N} frames · ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
    })));
  },

  async encode() {
    mkdir(path.dirname(OUT)); const audio = P.audio ? path.join(ROOT, P.audio) : null, args = ['-framerate', String(FPS), '-i', path.join(ROOT, 'frames', '%05d.jpg')];
    if (audio && fs.existsSync(audio)) args.push('-i', audio, '-filter_complex', '[1:a]aresample=48000,loudnorm=I=-14:TP=-1.5:LRA=11,aformat=channel_layouts=stereo[a]', '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '256k');
    else console.log('(no audio in project.json → silent video)');
    ff([...args, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', String(DUR), OUT]); console.log(rel(OUT));
  },

  async make(workers) { await cmds.render(workers); await cmds.encode(); },

  // reference (top) vs our render (bottom) at the same times
  async compare(name, ...ts) {
    needRef(); if (!name || !ts.length) die('usage: node reel.mjs compare <name> 1.0 2.5 ...'); mkdir(TMP); mkdir(path.join(ROOT, 'ref'));
    const ours = await preview(ts.map(Number)), refs = ts.map(t => grabRef(t, 300, path.join(TMP, `r_${tf(t)}.png`)));
    console.log(rel(grid([...refs, ...ours], ts.length, path.join(ROOT, 'ref', `cmp_${name}.jpg`))));
  },

  // dense strip of the reference: start, duration, fps, columns
  async sheet(start, dur, fps = '4', cols = '6', name) {
    needRef(); mkdir(path.join(ROOT, 'ref')); const out = path.join(ROOT, 'ref', `sheet_${name || tf(start)}.jpg`);
    ff(['-ss', String(start), '-i', REF, '-t', String(dur), '-vf', `fps=${fps},scale=270:-2,tile=${cols}x${Math.ceil(Number(dur) * Number(fps) / Number(cols))}`, '-frames:v', '1', out]); console.log(rel(out));
    console.log('note: tiles are ~1/(2·fps) s late vs the start time; use `frames` for exact moments');
  },

  // exact reference frames side by side, big enough to measure positions (coords × width/360)
  async frames(name, ...ts) {
    needRef(); mkdir(TMP); mkdir(path.join(ROOT, 'ref'));
    const fs_ = ts.map(t => grabRef(t, 360, path.join(TMP, `f_${tf(t)}.png`)));
    console.log(rel(grid(fs_, Math.min(ts.length, 4), path.join(ROOT, 'ref', `frames_${name}.jpg`), 360)));
  },

  // sample exact colours: node reel.mjs color 4.2 0.5,0.31 0.1,0.9   (x,y as 0-1 fractions or pixels)
  async color(t, ...pts) {
    needRef(); const probe = JSON.parse(ff(['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', REF], { bin: 'ffprobe' }).stdout).streams[0];
    for (const p of pts) {
      let [x, y] = p.split(',').map(Number); if (x <= 1 && y <= 1) { x = Math.round(x * (probe.width - 1)); y = Math.round(y * (probe.height - 1)); }
      const r = ff(['-v', 'error', '-ss', String(t), '-i', REF, '-frames:v', '1', '-vf', `crop=5:5:${Math.max(0, x - 2)}:${Math.max(0, y - 2)}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { bin: 'ffmpeg', binary: true }).stdout;
      const avg = [0, 1, 2].map(c => { let s = 0; for (let i = c; i < r.length; i += 3) s += r[i]; return Math.round(s / (r.length / 3)); });
      console.log(`${p} → #${avg.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`);
    }
  },

  // add a brand mark to logos.js: simple-icons slug (e.g. solana), a local .svg, or an https .svg url
  async logo(src, key) {
    if (!src) die('usage: node reel.mjs logo <simple-icons-slug | file.svg | https://...svg> [key]');
    let svg;
    if (fs.existsSync(src)) svg = fs.readFileSync(src, 'utf8');
    else { const url = /^https?:/.test(src) ? src : `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${src.toLowerCase()}.svg`; const r = await fetch(url); if (!r.ok) die(`could not fetch ${url} (${r.status})`); svg = await r.text(); }
    const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1]?.split(/[\s,]+/).map(Number) || [0, 0, 24, 24];
    const ds = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]); if (!ds.length) die('no <path d="..."> found (convert shapes/text to paths first)');
    const name = key || path.basename(src).replace(/\.svg$/, '').replace(/\W+/g, '_');
    const grads = [...svg.matchAll(/<stop[^>]*offset="([^"]+)"[^>]*stop-color="([^"]+)"/g)].map(m => `${m[1]} ${m[2]}`);
    const file = path.join(ROOT, 'logos.js'); let js = fs.readFileSync(file, 'utf8');
    const m = js.match(/const LOGOS = (\{[\s\S]*\});/); const L = m ? JSON.parse(m[1]) : {};
    L[name] = { d: ds.join(' '), w: vb[2], h: vb[3] }; if (vb[0] || vb[1]) L[name].offset = [vb[0], vb[1]];
    fs.writeFileSync(file, `// brand marks used by video.js — { name: { d: SVG path, w, h } } (viewBox size)\nconst LOGOS = ${JSON.stringify(L, null, 1)};\n`);
    console.log(`added "${name}" (${vb[2]}×${vb[3]})` + (grads.length ? `\ngradient stops in the source: ${grads.join(' · ')}` : ''));
  },

  // reference and our video side by side, with our audio
  async side() {
    needRef(); if (!fs.existsSync(OUT)) die('render + encode first'); const out = path.join(path.dirname(OUT), 'side_by_side.mp4');
    ff(['-i', REF, '-i', OUT, '-filter_complex', `[0:v]scale=540:960,fps=${FPS},setsar=1[a];[1:v]scale=540:960,setsar=1[b];[a][b]hstack[v]`, '-map', '[v]', '-map', '1:a?', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-shortest', out]);
    console.log(rel(out));
  },

  help() {
    console.log(`reelsmith — node reel.mjs <command>
  preview <t...>            render stills to preview/
  compare <name> <t...>     reference (top) vs ours (bottom) → ref/cmp_<name>.jpg
  frames <name> <t...>      exact reference frames, 360 px wide → ref/frames_<name>.jpg
  sheet <start> <dur> [fps] [cols] [name]   dense reference strip → ref/sheet_*.jpg
  color <t> <x,y...>        exact reference colours (x,y as 0–1 or pixels)
  logo <slug|file|url> [key]   add an SVG mark to logos.js (Simple Icons slug works)
  render [workers]          all frames → frames/
  encode                    frames + project audio → ${rel(OUT)}
  make [workers]            render + encode
  side                      reference | ours side-by-side video`);
  },
};

const [cmd = 'help', ...rest] = process.argv.slice(2);
if (!cmds[cmd]) die(`unknown command "${cmd}". Try: node reel.mjs help`);
await cmds[cmd](...rest);
