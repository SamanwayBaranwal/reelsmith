# /// script
# dependencies = ["numpy"]
# ///
"""Turn tracked numbers into After Effects keyframes: which ease, how long, how much bounce, on which beat.

usage: uv run analyser/fit.py analysis/card.track.json [more.track.json ...] [--beats beats.json] [--out analysis/]

For every move of every property (position, scale, rotation, opacity) it fits three families of models and keeps the
one that reproduces the measured curve best (AIC, so extra parameters must earn their place):
  bezier          an After Effects temporal ease (cubic-bezier; overshoot allowed)
  spring          a damped spring that overshoots and settles inside the move
  bezier+bounce   an ease into the key, then After Effects' inertial-bounce expression after it
Writes <name>.fit.json (keyframes in comp.js format + a plain-English report) and prints the report.
"""
import argparse, json, math, os
import numpy as np

EASE = {'linear': [0, 0, 1, 1], 'smooth': [.333, 0, .667, 1], 'out': [.16, 1, .3, 1], 'in': [.7, 0, .84, 0], 'inOut': [.83, 0, .17, 1],
        'whip': [.9, 0, .1, 1], 'back': [.34, 1.56, .64, 1], 'anticipate': [.6, -.35, .7, 1]}
SPRING = {'pop': (7, 2.2), 'spring': (5, 1.6), 'wobble': (4, 3.2)}
REST = {'anchor': .35, 'position': .35, 'positionZ': 3, 'scale': .12, 'rotation': .08, 'rotationX': .15, 'rotationY': .15, 'opacity': .6}   # per-frame change below this = at rest

# ---------------------------------------------------------------- curves (same maths as motion.js)
def bezier(b, u):
    x1, y1, x2, y2 = b; u = np.clip(u, 0, 1); cx = 3 * x1; bx = 3 * (x2 - x1) - cx; ax = 1 - cx - bx; cy = 3 * y1; by = 3 * (y2 - y1) - cy; ay = 1 - cy - by
    lo, hi = np.zeros_like(u), np.ones_like(u)
    for _ in range(36):
        s = (lo + hi) / 2; x = ((ax * s + bx) * s + cx) * s; lo = np.where(x < u, s, lo); hi = np.where(x < u, hi, s)
    s = (lo + hi) / 2; return ((ay * s + by) * s + cy) * s
def spring(z, w, u): return np.where(u >= 1, 1.0, 1 - np.exp(-z * np.clip(u, 0, 1)) * np.cos(w * 2 * np.pi * np.clip(u, 0, 1)))

# a model is (family, preset): family 'bez' (temporal bezier), 'spr' (spring), 'bnc' (bezier into the key + inertial bounce);
# preset None = free shape parameters, otherwise the named After Effects-style preset with only its timing (and bounce) free
BOUNCE_EASES = ('in', 'linear', 'smooth')
def shape_of(model, th):
    fam, pre = model
    if fam == 'spr': return SPRING[pre] if pre else tuple(th[2:4])
    return EASE[pre] if pre else th[2:6]
def bounce_of(model, th): return th[2:5] if model[1] else th[6:9]

def progress(model, th, t):
    """normalised progress 0→1 of one move at times t"""
    fam = model[0]; t0, t1 = th[0], th[1]; d = max(t1 - t0, 1e-4); u = (t - t0) / d
    if fam == 'spr': z, w = shape_of(model, th); return np.where(u <= 0, 0.0, spring(z, w, u))
    b = shape_of(model, th); p = np.where(u <= 0, 0.0, bezier(b, u))
    if fam == 'bnc':  # engine: vel = (p(t1) - p(t1 - 1/240)) * 240, then vel * amp * sin(freq·2π·dt) / e^(decay·dt)
        amp, freq, decay = bounce_of(model, th); vel = (1 - bezier(b, np.array([1 - (1 / 240) / d]))[0]) * 240; dt = t - t1
        p = p + np.where(dt > 0, vel * amp * np.sin(freq * 2 * np.pi * dt) / np.exp(np.clip(decay * dt, -50, 50)), 0)
    return p

def penalty(model, th, lim):
    fam, pre = model; t0, t1 = th[0], th[1]; pen = 0.0
    pen += max(0, lim['t0'][0] - t0) + max(0, t0 - lim['t0'][1]) + max(0, lim['t1'][0] - t1) + max(0, t1 - lim['t1'][1]) + max(0, t0 + 1 / 120 - t1)
    if fam in ('bez', 'bnc') and not pre:
        x1, y1, x2, y2 = th[2:6]; pen += max(0, -x1) + max(0, x1 - 1) + max(0, -x2) + max(0, x2 - 1) + max(0, abs(y1) - 3) + max(0, abs(y2 - 1) - 3)
    if fam == 'spr' and not pre: pen += max(0, .5 - th[2]) + max(0, -th[3]) + max(0, th[3] - 8)
    if fam == 'bnc':
        amp, freq, decay = bounce_of(model, th); pen += max(0, -amp) + max(0, amp - .5) + max(0, 1 - freq) + max(0, freq - 8) + max(0, 2 - decay) + max(0, decay - 40)  # a real wobble, not a slow drift
    return pen * 1e3

# ---------------------------------------------------------------- Nelder-Mead (numpy only)
def nelder_mead(f, x0, step, iters=1500, tol=1e-12):
    n = len(x0); S = [np.array(x0, float)] + [np.array(x0, float) + np.eye(n)[i] * step[i] for i in range(n)]; F = [f(s) for s in S]
    for _ in range(iters):
        o = np.argsort(F); S = [S[i] for i in o]; F = [F[i] for i in o]
        if abs(F[-1] - F[0]) < tol: break
        c = np.mean(S[:-1], axis=0); xr = c + (c - S[-1]); fr = f(xr)
        if fr < F[0]: xe = c + 2 * (c - S[-1]); fe = f(xe); S[-1], F[-1] = (xe, fe) if fe < fr else (xr, fr)
        elif fr < F[-2]: S[-1], F[-1] = xr, fr
        else:
            xc = c + .5 * (S[-1] - c); fc = f(xc)
            if fc < F[-1]: S[-1], F[-1] = xc, fc
            else: S = [S[0]] + [S[0] + .5 * (s - S[0]) for s in S[1:]]; F = [F[0]] + [f(s) for s in S[1:]]
    i = int(np.argmin(F)); return S[i], F[i]

# ---------------------------------------------------------------- one move
def fit_move(t, V, wts, v0, v1, lim, fps, tol=.0015):
    """t: times, V: (n, d) values, wts: per-frame confidence; v0/v1: known start/end values or None (solved by least squares)."""
    scale = max(np.ptp(V, axis=0).max(), np.linalg.norm(np.subtract(v1, v0)) if v0 is not None and v1 is not None else 0, 1e-6); W2 = wts[:, None]
    def endpoints(p):
        if v0 is not None and v1 is not None: return np.array(v0, float), np.array(v1, float)
        A = np.stack([1 - p, p], 1) * np.sqrt(wts)[:, None]; Vw = V * np.sqrt(wts)[:, None]
        if v0 is None and v1 is None: sol, *_ = np.linalg.lstsq(A, Vw, rcond=None); return sol[0], sol[1]
        if v0 is None: a = np.array(v1, float); r = V - np.outer(p, a); q = (1 - p) * wts; return (q @ r) / max(q @ (1 - p), 1e-9), a
        a = np.array(v0, float); r = V - np.outer(1 - p, a); q = p * wts; return a, (q @ r) / max(q @ p, 1e-9)
    def cost(model):
        def f(th):
            p = progress(model, th, t); a, b = endpoints(p); M = a + np.outer(p, b - a); return float((W2 * (M - V) ** 2).sum() / scale ** 2) + penalty(model, th, lim)
        return f
    ta, tb = np.mean(lim['t0']), np.mean(lim['t1']); dt = 1 / fps; fits = []
    plans = [(('bez', None), [[ta, tb, *EASE[e]] for e in ('out', 'inOut', 'in', 'back')], [dt, dt, .1, .1, .1, .1]),
             (('spr', None), [[ta, tb, z, w] for z, w in SPRING.values()], [dt, dt * 2, 1, .3]),
             (('bnc', None), [[ta, ta + (tb - ta) * k, *EASE[e], .05, 2.5, 6] for e in BOUNCE_EASES for k in (.3, .5)], [dt, dt, .1, .1, .1, .1, .02, .4, 1])]
    plans += [(('bez', e), [[ta, tb]], [dt, dt]) for e in EASE] + [(('spr', e), [[ta, tb]], [dt, dt * 2]) for e in SPRING]
    plans += [(('bnc', e), [[ta, ta + (tb - ta) * k, a, fq, dc] for k in (.3, .5) for a, fq, dc in ((.05, 2.5, 6), (.03, 1.5, 4))], [dt, dt, .02, .4, 1]) for e in BOUNCE_EASES]
    n = float(wts.sum()) * V.shape[1]
    for model, S0, st in plans:
        f = cost(model); runs = sorted((nelder_mead(f, s0, st, iters=600) for s0 in S0), key=lambda r: r[1])
        th, c = nelder_mead(f, runs[0][0], st, iters=2000)
        k = len(th) + (0 if v0 is not None else V.shape[1]) + (0 if v1 is not None else V.shape[1])
        p = progress(model, th, t); a, b = endpoints(p)
        fits.append(dict(model=list(model), th=[float(x) for x in th], rmse=math.sqrt(max(c, 0) / n), aic=n * math.log(c / n + 1e-7) + 2 * k, v0=a.tolist(), v1=b.tolist()))
    fits.sort(key=lambda r: r['aic']); best = fits[0]
    # designers use presets: take the best-fitting preset when it is nearly as good as the best free curve
    ok = [f for f in fits if f['model'][1] and f['rmse'] <= best['rmse'] * 1.25 + tol]  # within measurement accuracy, the preset is the answer
    if ok: best = min(ok, key=lambda f: (len(f['th']), f['rmse']))  # simplest preset that explains it (no bounce unless needed)
    return best, fits

def name_ease(m):
    fam, pre = m['model']
    if pre: return pre
    th = m['th']
    if fam == 'spr':
        z, w = th[2], th[3]; nm = min(SPRING, key=lambda k: abs(SPRING[k][0] - z) / 7 + abs(SPRING[k][1] - w) / 2.2)
        return nm if abs(SPRING[nm][0] - z) < 1 and abs(SPRING[nm][1] - w) < .3 else None
    u = np.linspace(0, 1, 61); c = bezier(th[2:6], u); d = {k: float(np.sqrt(np.mean((bezier(b, u) - c) ** 2))) for k, b in EASE.items()}
    k = min(d, key=d.get); return k if d[k] < .025 else None

# ---------------------------------------------------------------- a property's whole timeline
SIG = {'anchor': 4, 'position': 4, 'positionZ': 40, 'scale': 3, 'rotation': 2, 'rotationX': 3, 'rotationY': 3, 'opacity': 6}   # smallest change worth calling a move
ACC = {'anchor': .5, 'position': .5, 'positionZ': 6, 'scale': .3, 'rotation': .15, 'rotationX': .6, 'rotationY': .6, 'opacity': 1.5}   # how accurately each is measured   # smallest change worth calling a move
def noise(V):
    d2 = np.linalg.norm(np.diff(V, 2, axis=0), axis=1) if len(V) > 3 else np.zeros(1); return 1.4826 * float(np.median(d2)) / math.sqrt(6)

def segments(t, V, rest, fps):
    sp = np.r_[0, np.linalg.norm(np.diff(V, axis=0), axis=1)]; gap = np.r_[1, np.diff(np.round(t * fps))]
    mv = sp > rest; mv[gap > 1.5] = sp[gap > 1.5] > rest * 3
    idx = np.nonzero(mv)[0]; segs = []
    for i in idx:
        if segs and i - segs[-1][1] <= 3:
            j = segs[-1][1]; d0 = V[j] - V[max(j - 1, 0)]; d1 = V[i] - V[i - 1]; cos = float(d0 @ d1) / max(np.linalg.norm(d0) * np.linalg.norm(d1), 1e-9)
            if cos < -.3 or i - j <= 1: segs[-1][1] = i; continue  # a reversal is the top of a bounce/overshoot: same move
        segs.append([i, i])  # a stop with motion carrying on is a new keyframe
    # inside a continuous move, a deep dip in speed with the motion carrying on is a keyframe between two eases (e.g. smooth → whip)
    out = []
    for a, b in segs:
        cuts = [a]
        for i in range(a + 1, b):
            if not (sp[i] <= sp[i - 1] and sp[i] <= sp[i + 1]): continue
            p0, p1 = sp[cuts[-1]:i].max(initial=0), sp[i + 1:b + 1].max(initial=0)
            d0 = V[i] - V[max(i - 3, cuts[-1])]; d1 = V[min(i + 3, b)] - V[i]; cos = float(d0 @ d1) / max(np.linalg.norm(d0) * np.linalg.norm(d1), 1e-9)  # direction over a few frames: a reversal is a bounce, not a new key
            big = 4 * rest  # both sides must be real motion, not the noisy tail of an ease
            if sp[i] < .2 * min(p0, p1) and min(p0, p1) > big and cos > -.3 and i - cuts[-1] >= 3 and b - i >= 3: cuts.append(i)
        cuts.append(b); out += [(max(cuts[0] - 1, 0) if k == 0 else cuts[k], min(cuts[k + 1], len(t) - 1)) for k in range(len(cuts) - 1)]  # first piece starts at the rest frame before it
    return out

def offscreen_point(p, d, half, frame):
    """first point along direction d from p where a box of half-size `half` is fully outside the frame"""
    d = d / max(np.linalg.norm(d), 1e-9); W, H = frame
    for s in np.arange(0, 6000, 2.0):
        q = p + d * s
        if q[0] + half[0] < 0 or q[0] - half[0] > W or q[1] + half[1] < 0 or q[1] - half[1] > H: return q
    return p

def fit_property(name, t, V, wts, fps, beats, first_full, last_full, anchors=(), frame=None, half=None):
    out = []; sig = noise(V); rest = max(REST[name], 4 * sig)
    def significant(a, b):
        seg = V[a:b + 1]; return max(np.linalg.norm(seg - seg[0], axis=1).max(), np.linalg.norm(seg[-1] - seg[0])) >= max(SIG[name], 6 * sig)
    segs = [ab for ab in segments(t, V, rest, fps) if significant(*ab)]  # jitter isn't a move (and mustn't cut a real move's window short)
    for a, b in segs:
        open_start = a == 0 and np.linalg.norm(V[1] - V[0]) > rest; open_end = b == len(t) - 1 and np.linalg.norm(V[-1] - V[-2]) > rest
        if (open_start or open_end) and b - a < 3: continue  # one or two frames at the edge of tracking: too little to call a move
        seg = V[a:b + 1]; span = max(np.linalg.norm(seg - seg[0], axis=1).max(), np.linalg.norm(seg[-1] - seg[0]))
        if span < max(SIG[name], 6 * sig): continue  # jitter, not a move
        nxt = [x for x, _ in segs if x >= b]; limit = nxt[0] if nxt else len(t) - 1; tail = min(b + int(.4 * fps), limit)  # never reach into the next move
        settle = min(b + 3, limit); sl = slice(a, tail + 1)  # look past the visible stop: an `out` ease's flat tail is still part of the move
        v0 = None if open_start else V[max(a - 2, 0):a + 1].mean(0); v1 = None if open_end else V[b:settle + 1].mean(0)
        # an element that is fully in frame when tracking picks it up was born a few frames earlier; one sliding in from the edge may have moved for longer
        fast0 = name == 'position' and np.linalg.norm(V[1] - V[0]) > 15; fast1 = name == 'position' and np.linalg.norm(V[-1] - V[-2]) > 15
        back = 4 / fps if first_full and not fast0 else .8; fwd = 4 / fps if last_full and not fast1 else .8
        lim = {'t0': (t[a] - (back if open_start else 1 / fps), t[min(a + 1, b)]), 't1': (t[a] + 1 / fps, max(t[b], t[tail]) + (fwd if open_end else 1 / fps))}
        if open_start:  # another property of this layer starts confidently near here: in After Effects they'd share the keyframe
            near = [x for x in anchors if lim['t0'][0] - .15 <= x <= lim['t0'][1] + 1e-6]
            if near: x = min(near, key=lambda x: abs(x - t[a])); lim['t0'] = (x - 1e-3, x + 1e-3)
        tol = max(.0015, ACC[name] / max(span, 1e-6)); cand = [fit_move(t[sl], V[sl], wts[sl], v0, v1, lim, fps, tol)]
        # sliding in/out across the edge with too little seen to place the far end: start/end just outside the frame (what designers key)
        if name == 'position' and frame and half is not None and (open_start and fast0 or open_end and fast1):
            far = lambda q: max(-q[0] - half[0], q[0] - half[0] - frame[0], -q[1] - half[1], q[1] - half[1] - frame[1]) > 3 * max(half)
            r0 = min(cand[0][1], key=lambda f: f['rmse']); f0 = open_start and fast0 and far(r0['v0']); f1 = open_end and fast1 and far(r0['v1'])  # judge by the best free fit
            if f0 or f1:
                cand = [fit_move(t[sl], V[sl], wts[sl], offscreen_point(V[a], V[a] - V[a + 1], half, frame) if f0 else v0,
                                 offscreen_point(V[b], V[b] - V[b - 1], half, frame) if f1 else v1, lim, fps, tol)]
        if name in ('scale', 'opacity') and open_start and np.abs(V[a]).max() < .8 * np.abs(V[min(b + 2, len(V) - 1)]).max(): cand.append(fit_move(t[sl], V[sl], wts[sl], np.zeros(V.shape[1]), v1, lim, fps, tol))  # popped/faded in from 0
        best, fits = cand[-1] if len(cand) > 1 and cand[-1][0]['rmse'] <= cand[0][0]['rmse'] * 1.5 + .002 else cand[0]
        best['ease_name'] = name_ease(best); best['open'] = dict(start=bool(open_start), end=bool(open_end))
        best['anchored'] = bool(open_start and lim['t0'][1] - lim['t0'][0] < .01)
        best['confident_start'] = (not open_start) or (name in ('scale', 'opacity') and abs(best['v0'][0]) < 1e-9)
        best['alternatives'] = sorted([dict(model=f['model'], rmse=round(f['rmse'], 5)) for f in fits], key=lambda f: f['rmse'])[:5]
        if beats: best['beats'] = {k: near_beat(best['th'][i], beats, fps) for k, i in (('start', 0), ('end', 1))}
        out.append(best)
    return out

def near_beat(x, beats, fps):
    if not beats: return None
    i = int(np.argmin([abs(b - x) for b in beats])); d = x - beats[i]
    return f'beat:{i + 1}{d:+.2f}' if abs(d) <= 2.5 / fps else None

# ---------------------------------------------------------------- comp.js keys + report
def r3(v): return [round(x, 2) for x in v] if isinstance(v, (list, tuple)) else round(v, 2)
def ease_spec(m):
    if m['model'][0] == 'spr': return m['ease_name'] or {'spring': [round(m['th'][2], 2), round(m['th'][3], 2)]}
    return m['ease_name'] or [round(x, 3) for x in m['th'][2:6]]
def to_keys(prop, moves, dim):
    keys, bounce = [], None
    for m in moves:
        v0 = m['v0'] if dim > 1 else m['v0'][0]; v1 = m['v1'] if dim > 1 else m['v1'][0]
        keys += [[round(m['th'][0], 3), r3(v0)], [round(m['th'][1], 3), r3(v1), ease_spec(m)]]
        if m['model'][0] == 'bnc' and bounce is None: amp, fq, dc = bounce_of(tuple(m['model']), m['th']); bounce = dict(amp=round(amp, 4), freq=round(fq, 3), decay=round(dc, 2))
    return dict(keys=keys, bounce=bounce) if bounce else keys
def describe(prop, m, dim):
    f = (lambda v: '(' + ', '.join(f'{x:.0f}' for x in v) + ')') if dim > 1 else (lambda v: f'{v[0]:.1f}')
    t0, t1 = m['th'][0], m['th'][1]; fam = m['model'][0]; e = m['ease_name'] or (f"cubic-bezier({', '.join(f'{x:.2f}' for x in m['th'][2:6])})" if fam != 'spr' else f"spring(damping {m['th'][2]:.1f}, {m['th'][3]:.2f} oscillations)")
    s = f"{prop}: {f(m['v0'])} → {f(m['v1'])}, {t0:.2f}–{t1:.2f} s ({t1 - t0:.2f} s), ease {e}"
    if fam == 'bnc': amp, fq, dc = bounce_of(tuple(m['model']), m['th']); s += f", then inertial bounce (amp {amp:.3f}, freq {fq:.2f}, decay {dc:.1f})"
    if fam == 'spr' and m['ease_name']: s += ' (spring)'
    b = m.get('beats') or {}
    if b.get('start') or b.get('end'): s += ' · ' + ', '.join(f"{k}s on {v}" for k, v in b.items() if v)
    if m['open']['start']: s += ' · starts before tracking (' + ('keyed with the other properties' if m.get('anchored') else 'start extrapolated') + ')'
    if m['open']['end']: s += ' · leaves while moving (end extrapolated)'
    return s + f"  [fit error {m['rmse'] * 100:.2f}%]"

def fit_track(path, beats):
    tr = json.load(open(path)); fps = tr['fps']; R = tr['frames']; res = dict(name=tr['name'], fps=fps, layer={}, report=[], moves={})
    conf = lambda r: float(np.clip((r['cc'] - .6) / .35, .1, 1))
    full = [r for r in R if r.get('visible', 1) >= .98]; pos = [r for r in R if r.get('visible', 1) >= .6]
    first_full = R[0].get('visible', 1) >= .98; last_full = R[-1].get('visible', 1) >= .98
    frame = (tr['width'], tr['height']) if 'width' in tr else None; half = np.array(tr['box'][2:4]) / 2
    sx = np.array([r['scale_x'] for r in full]); sy = np.array([r['scale_y'] for r in full]); uni = np.max(np.abs(sx - sy)) < 3
    op = [r for r in full if r['opacity'] is not None and r['opacity'] <= 108 and max(abs(r.get('rotationX', 0)), abs(r.get('rotationY', 0))) < 30]  # >100% = glow/background confusion; steep tilts resample too much to read fades
    props = {'position': (pos, np.array([[r['x'], r['y']] for r in pos]), [conf(r) * float(np.clip(r['scale_x'] / 50, .1, 1)) for r in pos]),
             'scale': (full, sx[:, None] if uni else np.stack([sx, sy], 1), [conf(r) for r in full]),
             'rotation': (full, np.array([[r['rotation']] for r in full]), [conf(r) * float(np.clip(r['scale_x'] / 50, .1, 1)) for r in full]),
             'opacity': (op, np.array([[r['opacity']] for r in op]), [conf(r) for r in op])}
    if tr.get('kind') == 'camera':  # a camera is read by what it looks at: the world point under the screen centre (After Effects' point of interest)
        c = np.array([tr['width'] / 2, tr['height'] / 2]); poi = []
        for r in pos:
            s_ = r['scale_x'] / 100; a_ = math.radians(r['rotation']); Ri = np.array([[math.cos(a_), math.sin(a_)], [-math.sin(a_), math.cos(a_)]]) / s_
            poi.append(c + Ri @ (c - np.array([r['x'], r['y']])))
        props['anchor'] = (pos, np.array(poi), props['position'][2]); del props['position']; del props['opacity']
    for k in ('rotationX', 'rotationY'):  # 3D layers (track --model 3d)
        if full and k in full[0]: props[k] = (full, np.array([[r[k]] for r in full]), [conf(r) for r in full])
    if tr.get('model') == '3d': res['threeD'] = True
    if tr.get('model') == '3d' and frame:  # moving away in depth and shrinking look alike: also read it as depth (positionZ) and keep the simpler story
        f = (frame[0] / 2) / math.tan(math.radians(39.6 / 2)); s_ = (sx + sy) / 2 / 100; z = f * (1 / np.clip(s_, 1e-3, None) - 1)
        P0 = np.array([[(r['x'] - frame[0] / 2) * (f + zz) / f + frame[0] / 2, (r['y'] - frame[1] / 2) * (f + zz) / f + frame[1] / 2] for r, zz in zip(full, z)])
        alt = {'position': (full, P0, props['position'][2][:0] + [conf(r) for r in full]), 'positionZ': (full, z[:, None], [conf(r) for r in full])}
        story = lambda ms: sum(len(v) for v in ms.values()) + sum(.5 for v in ms.values() for m in v if not m['model'][1])
        A_ = {k: fit_property(k, np.array([r['t'] for r in props[k][0]]), props[k][1], np.array(props[k][2]), fps, beats, first_full, last_full, frame=frame, half=half) for k in ('position', 'scale')}
        B_ = {k: fit_property(k, np.array([r['t'] for r in alt[k][0]]), alt[k][1], np.array(alt[k][2]), fps, beats, first_full, last_full, frame=frame, half=half) for k in ('position', 'positionZ')}
        if story(B_) < story(A_) and B_['positionZ']:
            props['position'] = alt['position']; props['positionZ'] = alt['positionZ']; del props['scale']; res['depth'] = True
    fitted = {}
    for prop, (rows, V, w) in props.items():
        if len(rows) >= 4: fitted[prop] = fit_property(prop, np.array([r['t'] for r in rows]), V, np.array(w), fps, beats, first_full, last_full, frame=frame, half=half)
    anchors = sorted({m['th'][0] for ms in fitted.values() for m in ms if m['confident_start']})
    for prop, (rows, V, w) in props.items():
        if len(rows) < 4: continue
        t = np.array([r['t'] for r in rows]); dim = V.shape[1]; moves = fitted[prop]
        if anchors and any(m['open']['start'] and not m['confident_start'] for m in moves): moves = fit_property(prop, t, V, np.array(w), fps, beats, first_full, last_full, anchors, frame=frame, half=half)
        if not moves: res['layer'][prop] = r3(np.median(V, axis=0).tolist() if dim > 1 else float(np.median(V))); continue
        k = to_keys(prop, moves, dim)
        if prop == 'scale' and uni: k = to_keys(prop, [dict(m, v0=[m['v0'][0]] * 2, v1=[m['v1'][0]] * 2) for m in moves], 2)
        res['layer'][prop] = k; res['moves'][prop] = moves; res['report'] += [describe(prop, m, dim) for m in moves]
    sh = [r['shutter'] for r in R if r.get('shutter')]
    if sh: res['motion_blur'] = dict(shutter=float(np.median(sh)), frames=len(sh)); res['report'].append(f"motion blur: yes, shutter ≈ {np.median(sh):.0f}° ({len(sh)} blurred frames)")
    res['in'], res['out'] = round(float(R[0]['t']), 3), round(float(R[-1]['t']), 3)
    return res

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('tracks', nargs='+'); ap.add_argument('--beats'); ap.add_argument('--out', default='analysis')
    a = ap.parse_args(); beats = json.load(open(a.beats))['hits'] if a.beats else None
    for p in a.tracks:
        res = fit_track(p, beats); os.makedirs(a.out, exist_ok=True); json.dump(res, open(os.path.join(a.out, f"{res['name']}.fit.json"), 'w'), indent=1)
        print(f"\n■ {res['name']}  (visible {res['in']}–{res['out']} s)"); [print('  ' + line) for line in res['report']]
