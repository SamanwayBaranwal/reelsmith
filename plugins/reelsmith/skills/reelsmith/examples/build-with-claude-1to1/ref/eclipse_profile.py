# /// script
# dependencies = ["numpy"]
# ///
"""Colour vs signed vertical distance from the measured edge in the eclipse phase (dark disc above, glow below): + = below (glow)."""
import json, subprocess, numpy as np
W, H, fps, T0 = 1916, 1080, 30, 12.05
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(T0), '-i', 'ref/original.mp4', '-t', '0.5', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32); M = json.load(open('ref/planet_model.json')); cx = M['cx']
curve = {round(r[0], 2): r for r in M['curve']}; D = [-400, -300, -220, -160, -110, -70, -40, -20, -8, 0, 8, 20, 40, 70, 110, 160]; rows = []
for k, f in enumerate(F):
    t = round(T0 + k / fps, 2); r = min(M['curve'], key=lambda r: abs(r[0] - t)); yc, kk = r[1], r[2]; row = []
    for d in D:
        cols = []
        for x in range(int(cx) - 600, int(cx) + 601, 30):
            y = int(round(yc - kk / 2 * (x - cx) ** 2 + d))
            if 0 <= y < H and not 400 < y < 680: cols.append(f[y, x])
        row.append(np.median(cols, 0) if len(cols) >= 5 else [np.nan] * 3)
    rows.append(row)
P = np.nanmedian(np.array(rows, float), 0); st = [[d, [round(float(v), 1) for v in c]] for d, c in zip(D, P) if not np.isnan(c[0])]
M['eclipse'] = st; json.dump(M, open('ref/planet_model.json', 'w')); print([(d, [int(v) for v in c]) for d, c in st])
