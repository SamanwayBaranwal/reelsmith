# /// script
# dependencies = ["numpy"]
# ///
import json, numpy as np, glob, os
truth = json.load(open('truth.json'))
for f in sorted(glob.glob('analysis/*.track.json')):
    tr = json.load(open(f)); name = tr['name']; T = {round(r['t'] * 30): r for r in truth[name]}; rows = tr['frames']
    err = {k: [] for k in ('x', 'y', 'scale_x', 'rotation', 'rotationX', 'rotationY', 'opacity') if k in rows[0]}
    for r in [r for r in rows if r.get('visible', 1) >= .6]:
        g = T[round(r['t'] * 30)]
        for k in err:
            if r[k] is not None: err[k].append(r[k] - g[k])
    fmt = lambda k: f"{k} mean|err| {np.mean(np.abs(err[k])):.2f} max {np.max(np.abs(err[k])):.2f}"
    print(f"{name:6s} {len(rows)} frames {rows[0]['t']:.2f}-{rows[-1]['t']:.2f}s | " + ' | '.join(fmt(k) for k in err))
