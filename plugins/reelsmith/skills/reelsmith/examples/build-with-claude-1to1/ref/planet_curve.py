# /// script
# dependencies = ["numpy"]
# ///
"""Per frame: the dark/bright edge as a parabola y = yc + k/2·(x−cx)² (k > 0: dark planet below the glow; k < 0: dark disc above,
glow below), plus the glow profile on the bright side for the late phase."""
import json, subprocess, numpy as np
W, H, fps, T0 = 1916, 1080, 30, 11.39
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(T0), '-i', 'ref/original.mp4', '-t', '1.6', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32); M = json.load(open('ref/planet_model.json')); cx = M['cx']; out = []
for k, f in enumerate(F):
    t = round(T0 + k / fps, 4); L = f.mean(2); below_dark = L[H - 20:H - 4, int(cx) - 40:int(cx) + 40].mean() < 150  # planet phase: bottom of frame is the dark body
    pts = []
    for x in range(60, W - 60, 24):
        col = np.convolve(L[:, x], np.ones(5) / 5, 'same'); col[400:680] = np.nan
        ys = [y for y in range(300, H - 2) if not np.isnan(col[y]) and not np.isnan(col[y - 1]) and ((col[y - 1] >= 150 > col[y]) if below_dark else (col[y - 1] < 150 <= col[y]))]
        if ys: pts.append((x, ys[-1] if below_dark else ys[0]))
    if len(pts) >= 15:
        P = np.array(pts, float); X = P[:, 0] - cx
        for _ in range(3):
            A = np.c_[np.ones(len(X)), X, X ** 2]; s, *_ = np.linalg.lstsq(A, P[:, 1], rcond=None); e = np.abs(A @ s - P[:, 1]); keep = e <= np.percentile(e, 85) + 1; P, X = P[keep], X[keep]
        out.append(dict(t=t, yc=round(float(s[0]), 1), k=float(-2 * s[2]), n=len(P), phase='planet' if below_dark else 'eclipse'))
    else: out.append(dict(t=t, phase='planet' if below_dark else 'eclipse'))
json.dump(out, open('ref/planet_curve.json', 'w'))
for o in out[::2]: print(o['t'], o['phase'], o.get('yc'), round(o['k'] * 1e5, 2) if 'k' in o else None, o.get('n'))
