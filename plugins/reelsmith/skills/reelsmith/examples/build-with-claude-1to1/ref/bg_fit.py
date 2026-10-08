# /// script
# dependencies = ["numpy"]
# ///
"""Fit the laptop shot's background as a smooth quadratic colour surface per frame (laptop + words masked out by a robust fit)."""
import json, subprocess, numpy as np
W, H = 1916, 1080; out = []
for t in (9.3, 9.45, 9.6, 9.8, 10.0, 10.3, 10.6, 10.8):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', 'ref/original.mp4', '-frames:v', '1', '-vf', 'scale=192:108', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
    f = np.frombuffer(raw, np.uint8).reshape(108, 192, 3).astype(float); yy, xx = np.mgrid[0:108, 0:192]; x = xx.ravel() / 191; y = yy.ravel() / 107
    A = np.c_[np.ones_like(x), x, y, x * x, y * y, x * y]; keep = np.ones(len(x), bool); C = []
    for ch in range(3):
        v = f[..., ch].ravel(); k = keep.copy()
        for _ in range(4): c, *_ = np.linalg.lstsq(A[k], v[k], rcond=None); r = np.abs(A @ c - v); k = r < max(3, np.percentile(r[k], 70))
        C.append(c.round(2).tolist())
    out.append([t, C]); print(t, [round(float(np.array([1, .5, .5, .25, .25, .25]) @ np.array(c)), 1) for c in C], 'corners', [[round(float(np.array([1, a, b, a * a, b * b, a * b]) @ np.array(C[0])), 0) for a, b in ((0, 0), (1, 0), (0, 1), (1, 1))]])
json.dump(out, open('ref/laptop_bg.json', 'w'))
