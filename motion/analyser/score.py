# /// script
# dependencies = ["numpy"]
# ///
"""Score a rebuild against the original, frame by frame.

usage: uv run analyser/score.py <original.mp4> <rebuild.mp4> [--beats beats.json]
Prints overall similarity, the worst moments (with timestamps) and writes worst.json, so an agent knows exactly where to look.
Similarity = 100 - mean absolute pixel difference as % (after a slight blur, so sub-pixel jitter doesn't dominate).
"""
import argparse, json, subprocess
import numpy as np

def frames(path, w=480):
    s = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path]))['streams'][0]
    h = round(s['height'] * w / s['width'] / 2) * 2
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}:flags=area,gblur=sigma=1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float32)

ap = argparse.ArgumentParser(); ap.add_argument('original'); ap.add_argument('rebuild'); ap.add_argument('--fps', type=float, default=30); ap.add_argument('--shots', help='discover.json: also score each shot'); a = ap.parse_args()
A, B = frames(a.original), frames(a.rebuild); n = min(len(A), len(B))
err = np.abs(A[:n] - B[:n]).mean(axis=(1, 2, 3)) / 255 * 100; sim = 100 - err
# strict: only pixels where something is happening in either video (differs from that video's median frame)
mA, mB = np.median(A[:n], axis=0), np.median(B[:n], axis=0); fg = (np.abs(A[:n] - mA).max(-1) > 10) | (np.abs(B[:n] - mB).max(-1) > 10)
d = np.abs(A[:n] - B[:n]).mean(-1); strict = np.array([100 - d[i][fg[i]].mean() / 255 * 100 if fg[i].sum() > 50 else 100.0 for i in range(n)])
print(f'similarity {sim.mean():.2f}% overall · {strict.mean():.2f}% on moving elements only  (worst frame {strict.min():.2f}%, {n} frames)')
sim = strict
worst = np.argsort(sim)[:8]
for i in sorted(worst): print(f'  {i / a.fps:6.2f}s  {sim[i]:.2f}%')
json.dump(dict(mean=float(sim.mean()), per_frame=[round(float(x), 3) for x in sim], worst=[dict(t=round(i / a.fps, 3), similarity=round(float(sim[i]), 3)) for i in sorted(worst)]), open('worst.json', 'w'))
if a.shots:
    for sh in json.load(open(a.shots))['shots']:
        i0, i1 = int(round(sh['start'] * a.fps)), min(n, int(round(sh['end'] * a.fps)))
        if i1 > i0: print(f"  shot {sh['shot']} {sh['start']:5.2f}–{sh['end']:5.2f}s  {sim[i0:i1].mean():6.2f}%  (worst {sim[i0:i1].min():.1f}% at {(i0 + int(np.argmin(sim[i0:i1]))) / a.fps:.2f}s)")
