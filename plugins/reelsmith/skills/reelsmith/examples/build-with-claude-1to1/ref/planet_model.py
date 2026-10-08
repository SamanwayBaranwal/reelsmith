# /// script
# dependencies = ["numpy"]
# ///
"""Planet model from the original: the planet edge (sharp drop from the cream band into the dark body) fitted as a circle,
glow / body colour vs signed distance from that edge, and the edge height on every frame (from the glow brightness down the
centre column, so it keeps working after the edge sinks out of frame)."""
import json, subprocess, numpy as np
W, H, fps, T0 = 1916, 1080, 30, 11.39
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(T0), '-i', 'ref/original.mp4', '-t', '1.6', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
fits = []
for k, f in enumerate(F[:16]):  # 11.39–11.89: the edge is in frame
    L = f.mean(2); pts = []
    for x in range(60, W - 60, 24):
        col = np.convolve(L[:, x], np.ones(5) / 5, 'same'); ys = [y for y in range(300, H - 14) if col[y] > 190 and col[y + 12] < 130 and not 420 < y < 680]
        if ys: pts.append((x, ys[-1] + 6))
    if len(pts) < 20: continue
    P = np.array(pts, float)
    for _ in range(3):
        A = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]; b = (P ** 2).sum(1); s, *_ = np.linalg.lstsq(A, b, rcond=None)
        cx, cy = s[0], s[1]; R = float(np.sqrt(s[2] + cx ** 2 + cy ** 2)); e = np.abs(np.hypot(P[:, 0] - cx, P[:, 1] - cy) - R); P = P[e <= np.percentile(e, 85) + 1]
    fits.append((k, cx, cy, R))
R = float(np.median([f[3] for f in fits])); cx = float(np.median([f[1] for f in fits]))
D = [-700, -500, -350, -250, -180, -120, -70, -35, -15, 0, 10, 25, 45, 70, 100, 140, 190, 250, 320, 400, 500, 620, 760]
prof = []
for k, fcx, fcy, fR in fits:
    f = F[k]; row = []
    for d in D:  # + = outside the planet (glow), − = inside (body)
        cols = [f[int(round(fcy - (fR + d) * np.cos(a))), int(round(fcx + (fR + d) * np.sin(a)))] for a in np.radians(np.arange(-35, 36, 3))
                if 0 <= fcy - (fR + d) * np.cos(a) < H and 0 <= fcx + (fR + d) * np.sin(a) < W and not 420 < fcy - (fR + d) * np.cos(a) < 680]
        row.append(np.median(cols, 0) if len(cols) >= 3 else [np.nan] * 3)
    prof.append(row)
P = np.nanmedian(np.array(prof, float), axis=0); stops = [[d, [round(float(v), 1) for v in c]] for d, c in zip(D, P) if not np.isnan(c[0])]
Ld = np.array([[d, np.mean(c)] for d, c in stops if d >= 0])
top = []
for k, f in enumerate(F):
    t = round(T0 + k / fps, 4); col = np.convolve(f[:, int(cx) - 30:int(cx) + 30].mean((1, 2)), np.ones(9) / 9, 'same'); col[400:680] = np.nan
    peak = int(np.nanargmax(col[:H - 6])); ests = []
    for y in range(40, min(peak, H - 6), 6):
        L = col[y]
        if not np.isnan(L) and Ld[-1, 1] + 8 < L < Ld[0, 1] - 8: ests.append(y + float(np.interp(-L, -Ld[:, 1], Ld[:, 0])))
    top.append([t, round(float(np.median(ests)), 1) if len(ests) >= 4 else None])
json.dump(dict(R=round(R, 1), cx=round(cx, 1), stops=stops, top=top), open('ref/planet_model.json', 'w'))
print('edge fits', [(round(f[3]), round(f[2] - f[3])) for f in fits]); print('R', round(R), 'cx', round(cx)); print('stops', [(d, [int(v) for v in c]) for d, c in stops]); print('top', top[::3])
