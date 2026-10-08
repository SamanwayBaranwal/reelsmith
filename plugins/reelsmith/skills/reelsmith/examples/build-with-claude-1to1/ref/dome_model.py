# /// script
# dependencies = ["numpy"]
# ///
"""White-dome shot (10.83–11.28): per frame the dome's edge (darkest coral just above the flat pink disc) fitted as a circle,
and the colour vs signed distance from that edge (median over frames)."""
import json, subprocess, numpy as np
W, H, fps, T0 = 1916, 1080, 30, 10.83
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(T0), '-i', 'ref/original.mp4', '-t', '0.46', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32); fits = []
for k, f in enumerate(F):
    L = f.mean(2); pts = []
    for x in range(40, W - 40, 24):
        col = np.convolve(L[:, x], np.ones(7) / 7, 'same'); col[:300] = 1e9; col[400:680] = np.where(col[400:680] < 120, 1e9, col[400:680])  # skip the dark text
        y = int(np.argmin(col[:H - 4]))
        if col[y] < 215 and 300 < y < H - 6: pts.append((x, y))
    if len(pts) < 20: fits.append(None); continue
    P = np.array(pts, float)
    for _ in range(3):
        A = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]; b = (P ** 2).sum(1); s, *_ = np.linalg.lstsq(A, b, rcond=None)
        cx, cy = s[0], s[1]; R = float(np.sqrt(s[2] + cx ** 2 + cy ** 2)); e = np.abs(np.hypot(P[:, 0] - cx, P[:, 1] - cy) - R); P = P[e <= np.percentile(e, 85) + 1]
    fits.append((round(T0 + k / fps, 4), cx, cy, R))
good = [f for f in fits if f]; D = [-400, -250, -150, -90, -50, -25, -10, 0, 10, 25, 50, 90, 150, 220, 300, 400, 520, 660]; prof = []
for (t, cx, cy, R), f in zip(good, [F[i] for i, f in enumerate(fits) if f]):
    row = []
    for d in D:
        cols = [f[int(round(cy - (R + d) * np.cos(a))), int(round(cx + (R + d) * np.sin(a)))] for a in np.radians(np.arange(-30, 31, 3))
                if 0 <= cy - (R + d) * np.cos(a) < H and 0 <= cx + (R + d) * np.sin(a) < W and not 400 < cy - (R + d) * np.cos(a) < 680]
        row.append(np.median(cols, 0) if len(cols) >= 3 else [np.nan] * 3)
    prof.append(row)
P = np.nanmedian(np.array(prof, float), 0); stops = [[d, [round(float(v), 1) for v in c]] for d, c in zip(D, P) if not np.isnan(c[0])]
json.dump(dict(frames=[[t, round(cx, 1), round(cy - R, 1), round(R, 1)] for t, cx, cy, R in good], stops=stops), open('ref/dome_model.json', 'w'))
print('frames', [(t, round(cy - R), round(R)) for t, cx, cy, R in good]); print('stops', [(d, [int(v) for v in c]) for d, c in stops])
