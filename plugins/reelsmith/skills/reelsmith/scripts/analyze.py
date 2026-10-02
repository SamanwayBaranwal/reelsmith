#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["numpy", "pillow", "faster-whisper>=1.0"]
# ///
"""reelsmith analyze — measure a reference reel so it can be rebuilt in code.

  uv run analyze.py <link-or-file> --out <project>/ref [--cookies-from-browser chrome] [--lang en] [--model small]

Writes into --out:
  original.mp4        the reference video (kept: every later step compares against it)
  audio.wav           its soundtrack (48 kHz) — only reuse it if you own it
  analysis.md         format, every cut, shot-by-shot words, word timings, colour palettes, loudness
  analysis.json       the same, machine-readable
  transcript.json     [[start, end, word], ...]
  sheets/hook.jpg     first 3 s at 4 fps · sheets/shots.jpg middle of every shot · sheets/timeline.jpg every 0.5 s

Exit codes: 0 ok · 2 download failed · 3 login needed (ask before using browser cookies) · 5 ffmpeg missing
"""
import argparse, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def log(*a):
    print('[reelsmith]', *a, file=sys.stderr, flush=True)


def run(cmd, check=True, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if check and r.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {r.stderr[-1500:]}")
    return r


# ---------------------------------------------------------------- download
def download(src, out, cookies_browser=None, cookies_file=None):
    dst = out / 'original.mp4'
    if Path(src).exists():
        shutil.copy(src, dst) if Path(src).suffix.lower() == '.mp4' else run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-crf', '14', '-c:a', 'aac', str(dst)])
        return dst, {}
    runners = []
    if shutil.which('yt-dlp'):
        runners.append(['yt-dlp'])
    if shutil.which('uvx'):
        runners.append(['uvx', '--from', 'yt-dlp[default,curl-cffi]@latest', 'yt-dlp'])
    if not runners:
        sys.exit(json.dumps({'ok': False, 'status': 'no yt-dlp', 'fix': 'install yt-dlp (brew install yt-dlp / winget install yt-dlp.yt-dlp) or uv'}))
    extra = []
    if cookies_browser:
        extra += ['--cookies-from-browser', cookies_browser]
    if cookies_file:
        extra += ['--cookies', cookies_file]
    last = ''
    for r in runners:
        for imp in ([], ['--impersonate', 'chrome']):
            cmd = r + ['-f', 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b', '--merge-output-format', 'mp4', '--no-playlist', '-o', str(out / 'original.%(ext)s'),
                       '--write-info-json', '--no-progress'] + imp + extra + [src]
            log('downloading:', ' '.join(r[:1]), '(impersonating)' if imp else '')
            p = run(cmd, check=False)
            if p.returncode == 0 and dst.exists():
                info = {}
                for f in out.glob('original*.info.json'):
                    try:
                        j = json.loads(f.read_text())
                        info = {k: j.get(k) for k in ('title', 'uploader', 'channel', 'upload_date', 'view_count', 'like_count', 'comment_count', 'description', 'webpage_url')}
                    except Exception:
                        pass
                    f.unlink()
                return dst, info
            last = p.stderr
    if re.search(r'login|log in|cookies|private|rate-limit|sign in', last, re.I):
        print(json.dumps({'ok': False, 'status': 'login needed', 'fix': 'ask the user, then rerun with --cookies-from-browser chrome (or their browser)', 'detail': last[-400:]}))
        sys.exit(3)
    print(json.dumps({'ok': False, 'status': 'download failed', 'fix': 'ask the user to download the video and pass the file path', 'detail': last[-400:]}))
    sys.exit(2)


# ---------------------------------------------------------------- measure
def probe(v):
    j = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(v)]).stdout)
    vs = next(s for s in j['streams'] if s['codec_type'] == 'video')
    num, den = (vs.get('avg_frame_rate') or '30/1').split('/')
    return {'width': int(vs['width']), 'height': int(vs['height']), 'fps': round(float(num) / float(den or 1), 3),
            'duration': round(float(j['format']['duration']), 3), 'has_audio': any(s['codec_type'] == 'audio' for s in j['streams'])}


def cuts(v, thr):
    r = run(['ffmpeg', '-hide_banner', '-i', str(v), '-filter:v', f"select='gt(scene,{thr})',showinfo", '-an', '-f', 'null', '-'], check=False)
    ts = [float(m) for m in re.findall(r'pts_time:([\d.]+)', r.stderr)]
    out = []
    for t in ts:
        if not out or t - out[-1] > 0.25:
            out.append(round(t, 3))
    return out


def loudness(v):
    r = run(['ffmpeg', '-hide_banner', '-i', str(v), '-af', 'ebur128=peak=true', '-f', 'null', '-'], check=False)
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)
    P = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r.stderr)
    return {'lufs': float(I[-1]) if I else None, 'true_peak': float(P[-1]) if P else None}


def transcribe(wav16, model, lang):
    from faster_whisper import WhisperModel
    log(f'transcribing with whisper "{model}" (first run downloads the model) ...')
    m = WhisperModel(model, device='cpu', compute_type='int8')
    segs, info = m.transcribe(str(wav16), word_timestamps=True, language=lang, vad_filter=False)
    words = [[round(w.start, 2), round(w.end, 2), w.word.strip()] for s in segs for w in (s.words or [])]
    return words, info.language


def palette(img, k=6):
    q = img.convert('RGB').resize((160, int(160 * img.height / img.width))).quantize(colors=k, method=Image.Quantize.MEDIANCUT)
    pal, counts = q.getpalette(), sorted(q.getcolors(), reverse=True)
    tot = sum(c for c, _ in counts)
    return [('#%02X%02X%02X' % tuple(pal[i * 3:i * 3 + 3]), round(100 * c / tot)) for c, i in counts]


# ---------------------------------------------------------------- sheets
def font(size):
    for f in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf', 'C:/Windows/Fonts/arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def frame_at(v, t, w=270):
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', f'{max(0, t):.3f}', '-i', str(v), '-frames:v', '1', '-vf', f'scale={w}:-2', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True)
    from io import BytesIO
    return Image.open(BytesIO(r.stdout)).convert('RGB') if r.stdout else None


def sheet(v, items, path, cols, w=270):
    """items: [(time, label)] → labelled grid"""
    tiles = [(frame_at(v, t, w), lab) for t, lab in items]
    tiles = [(im, lab) for im, lab in tiles if im]
    if not tiles:
        return None
    th = tiles[0][0].height
    rows = (len(tiles) + cols - 1) // cols
    g = Image.new('RGB', (cols * w + (cols - 1) * 4, rows * th + (rows - 1) * 4), (20, 20, 20))
    d, f = ImageDraw.Draw(g), font(16)
    for i, (im, lab) in enumerate(tiles):
        x, y = (i % cols) * (w + 4), (i // cols) * (th + 4)
        g.paste(im, (x, y))
        tw = d.textlength(lab, font=f)
        d.rectangle([x, y, x + tw + 10, y + 24], fill=(0, 0, 0))
        d.text((x + 5, y + 3), lab, fill=(255, 220, 0), font=f)
    g.save(path, quality=88)
    return path


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description='Measure a reference reel for reelsmith.')
    ap.add_argument('source', help='video link or local file')
    ap.add_argument('--out', default='ref', help='output folder (default ./ref)')
    ap.add_argument('--lang', help='spoken language, e.g. en (default: detect)')
    ap.add_argument('--model', default='small', help='whisper model: base, small, medium, large-v3, turbo (default small)')
    ap.add_argument('--cut-threshold', type=float, default=0.22)
    ap.add_argument('--cookies-from-browser', metavar='BROWSER')
    ap.add_argument('--cookies', metavar='FILE')
    ap.add_argument('--no-transcript', action='store_true')
    a = ap.parse_args()

    if not (shutil.which('ffmpeg') and shutil.which('ffprobe')):
        print(json.dumps({'ok': False, 'status': 'ffmpeg missing', 'fix': 'brew install ffmpeg · winget install Gyan.FFmpeg · sudo apt install ffmpeg'}))
        sys.exit(5)
    out = Path(a.out).resolve()
    (out / 'sheets').mkdir(parents=True, exist_ok=True)
    v, info = download(a.source, out, a.cookies_from_browser, a.cookies)
    meta = probe(v)
    log(f"{meta['width']}x{meta['height']} · {meta['fps']} fps · {meta['duration']} s")

    log('finding cuts ...')
    cs = cuts(v, a.cut_threshold)
    bounds = [0.0] + cs + [meta['duration']]
    shots = [{'n': i + 1, 'in': round(bounds[i], 3), 'out': round(bounds[i + 1], 3), 'dur': round(bounds[i + 1] - bounds[i], 3)} for i in range(len(bounds) - 1)]

    words, lang = [], None
    if meta['has_audio']:
        run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(v), '-vn', '-ar', '48000', '-ac', '2', str(out / 'audio.wav')])
        if not a.no_transcript:
            with tempfile.TemporaryDirectory() as td:
                w16 = Path(td) / 'a16.wav'
                run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(v), '-vn', '-ar', '16000', '-ac', '1', str(w16)])
                words, lang = transcribe(w16, a.model, a.lang)
    (out / 'transcript.json').write_text(json.dumps(words))
    loud = loudness(v) if meta['has_audio'] else {}

    log('palettes + sheets ...')
    for s in shots:
        mid = (s['in'] + s['out']) / 2
        im = frame_at(v, mid, 320)
        s['palette'] = palette(im) if im else []
        s['words'] = ' '.join(w for st, en, w in words if s['in'] <= (st + en) / 2 < s['out'])
    sheet(v, [(t / 4, f'{t / 4:.2f}s') for t in range(int(min(3, meta['duration']) * 4))], out / 'sheets' / 'hook.jpg', 6)
    sheet(v, [((s['in'] + s['out']) / 2, f"S{s['n']} {(s['in'] + s['out']) / 2:.1f}s") for s in shots], out / 'sheets' / 'shots.jpg', 6)
    sheet(v, [(t / 2, f'{t / 2:.1f}s') for t in range(int(meta['duration'] * 2))], out / 'sheets' / 'timeline.jpg', 8, 200)

    wpm = round(len(words) / (meta['duration'] / 60)) if words else 0
    res = {'source': a.source, 'info': info, 'format': meta, 'cuts': cs, 'shots': shots, 'language': lang, 'words': len(words), 'wpm': wpm, 'loudness': loud}
    (out / 'analysis.json').write_text(json.dumps(res, indent=1))

    L = [f"# Reference analysis", '', f"- Source: {a.source}"]
    if info.get('title'):
        L.append(f"- Title: {info.get('title')} · by {info.get('uploader') or info.get('channel')} · views {info.get('view_count')} · likes {info.get('like_count')}")
    L += [f"- Format: {meta['width']}×{meta['height']} · {meta['fps']} fps · {meta['duration']} s",
          f"- Pace: {len(shots)} shots · {len(cs)} cuts ({round(len(cs) / meta['duration'] * 60, 1)}/min) · median shot {np.median([s['dur'] for s in shots]):.2f} s",
          f"- Speech: {len(words)} words · {wpm} wpm · language {lang}",
          f"- Loudness: {loud.get('lufs')} LUFS · true peak {loud.get('true_peak')} dBFS", '',
          '## Shots (cut detection can miss dissolves and fire on flashes — confirm on the sheets)', '',
          '| # | in | dur | words spoken | palette (share %) |', '|---|---|---|---|---|']
    for s in shots:
        L.append(f"| {s['n']} | {s['in']:.2f} | {s['dur']:.2f} | {s['words']} | {' '.join(f'{h} {p}' for h, p in s['palette'])} |")
    L += ['', '## Word timings (start–end word) — time captions and scene changes to these', '']
    L.append(' · '.join(f'`{st:.2f}` {w}' for st, en, w in words) or '(no speech)')
    L += ['', '## Sheets', '', '- sheets/hook.jpg — first 3 s at 4 fps', '- sheets/shots.jpg — middle of each shot', '- sheets/timeline.jpg — every 0.5 s', '',
          'Next: look at every sheet, then `node reel.mjs frames|sheet|color` for exact positions and colours.']
    (out / 'analysis.md').write_text('\n'.join(L) + '\n')
    print(json.dumps({'ok': True, 'folder': str(out), 'video': str(v), 'audio': str(out / 'audio.wav') if meta['has_audio'] else None,
                      'analysis': str(out / 'analysis.md'), 'duration': meta['duration'], 'shots': len(shots), 'words': len(words)}, indent=1))


if __name__ == '__main__':
    main()
