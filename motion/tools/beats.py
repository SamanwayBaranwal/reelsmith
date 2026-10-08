# /// script
# dependencies = ["numpy"]
# ///
"""Find the hits in a song so a comp can say 'beat:4' instead of '1.66'.
usage: uv run tools/beats.py <audio> [out.json]   → {tempo, period, hits, onsets, kicks}
hits = strong onsets (the moments motion designers cut and pop on), onsets = every onset [t, strength], kicks = low-end hits."""
import json, subprocess, sys
import numpy as np
src, out = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else 'beats.json')
sr = 22050
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
hop, n = 256, 1024
frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (n // 2, n // 2)), n)[::hop] * np.hanning(n)
L = np.log1p(np.abs(np.fft.rfft(frames, axis=1)) * 100)
flux = np.concatenate([[0], np.maximum(0, np.diff(L, axis=0)).sum(1)])
low = np.concatenate([[0], np.maximum(0, np.diff(L[:, :6], axis=0)).sum(1)])   # < ~130 Hz
t = np.arange(len(flux)) * hop / sr
def peaks(env, k=1.4, gap=0.09):
    med = np.convolve(env, np.ones(31) / 31, mode='same'); out = []
    for i in range(1, len(env) - 1):
        if env[i] > env[i - 1] and env[i] >= env[i + 1] and env[i] > med[i] * k + 1e-3 and (not out or t[i] - out[-1][0] > gap): out.append((t[i], env[i]))
    if not out: return []
    m = max(v for _, v in out); return [[round(float(a), 3), round(float(v / m), 2)] for a, v in out]
onsets, kicks = peaks(flux), peaks(low, 1.8, 0.15)
f = flux - flux.mean(); ac = np.correlate(f, f, 'full')[len(f) - 1:]; lags = np.arange(len(ac)) * hop / sr
sel = (lags > 0.25) & (lags < 1.0); per = float(lags[sel][np.argmax(ac[sel])])
hits = [a for a, v in onsets if v >= 0.45]
json.dump({'tempo': round(60 / per, 1), 'period': round(per, 4), 'hits': hits, 'onsets': onsets, 'kicks': kicks}, open(out, 'w'))
print(f'{out}: ~{60 / per:.1f} BPM, {len(hits)} hits, {len(onsets)} onsets, {len(kicks)} kicks')
print('hits:', ' '.join(f'{i + 1}:{a:.2f}' for i, a in enumerate(hits)))
