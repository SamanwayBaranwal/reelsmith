# /// script
# dependencies = ["numpy"]
# ///
"""Measure the planet in the original, frame by frame: its rim (fitted circle) and the glow colour profile above the rim."""
import json, subprocess, numpy as np
W, H, fps = 1916, 1080, 30
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', '11.39', '-i', 'ref/original.mp4', '-t', '1.6', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32); out = []
D = [-400, -300, -220, -160, -110, -70, -40, -20, -8, 0, 8, 20, 40, 70, 110, 160, 220, 300, 400, 520, 660]  # signed distance from the rim (+ = above, into the glow)
for k, f in enumerate(F):
    t = round(11.39 + k / fps, 4); L = f.mean(2); pts = []
    for x in range(40, W - 40, 30):  # rim = the brightest point of each column (the cream band right on the edge)
        col = np.convolve(L[:, x], np.ones(7) / 7, 'same'); y = int(np.argmax(col[:H - 8]))
        if col[y] > 200 and 8 < y < H - 12: pts.append((x, y))
    if len(pts) < 10: out.append(dict(t=t)); continue
    P = np.array(pts, float)
    for _ in range(2):  # circle fit, dropping the worst outliers (text, spark) once
        A = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]; b = (P ** 2).sum(1); sol, *_ = np.linalg.lstsq(A, b, rcond=None)
        cx, cy = sol[0], sol[1]; R = float(np.sqrt(sol[2] + cx ** 2 + cy ** 2)); e = np.abs(np.hypot(P[:, 0] - cx, P[:, 1] - cy) - R); P = P[e <= np.percentile(e, 80) + 2]
    prof = []
    for d in D:
        cols = [f[int(round(cy - (R + d) * np.cos(a))), int(round(cx + (R + d) * np.sin(a)))] for a in np.radians(np.arange(-40, 41, 4))
                if 0 <= cy - (R + d) * np.cos(a) < H and 0 <= cx + (R + d) * np.sin(a) < W]
        prof.append([round(float(v), 1) for v in np.median(cols, 0)] if len(cols) >= 3 else None)
    out.append(dict(t=t, cx=round(float(cx), 1), cy=round(float(cy), 1), R=round(R, 1), top=round(float(cy - R), 1), profile=prof))
json.dump(dict(distances=D, frames=out), open('ref/planet.json', 'w'))
for o in out[::4]: print(o['t'], o.get('cx'), o.get('top'), o.get('R'), (o.get('profile') or [None])[:4])
