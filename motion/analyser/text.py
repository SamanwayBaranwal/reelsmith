# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Read a text animator: letters or words that animate in one after another (After Effects' range selector).

usage: uv run analyser/text.py <video> --name title --at 3.0 --box x,y,w,h --from 0.3 --to 3.0 [--by auto|char|word] [--beats beats.json]

--at: the text fully shown and still; --box: around the whole text; --from/--to: the window holding its entrance.
1. finds each glyph in the rest frame and groups them into letters and words
2. tracks every unit on its own (full resolution) and fits its moves
3. reads the pattern across units: who starts first (order), the gap between starts (stagger), how far / faded / scaled /
   rotated / blurred each unit starts (from), how long each takes (dur) and the ease
Writes <name>.text.json with an `animator` block ready for comp.js, and prints a one-line description.
"""
import argparse, json, math, os, sys
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from track import load, track, element_mask
from fit import fit_data, near_beat

def units(gray, box, by):
    """letter and word boxes (video px) inside box in reading order, each unit's own glyph mask, and its character index
    (spaces counted, as After Effects' range selector counts them)"""
    x, y, w, h = [int(round(v)) for v in box]; crop = gray[y:y + h, x:x + w].astype(np.float32) / 255
    m, _ = element_mask(crop, ring=2, thr=.12); m = cv2.erode(m.astype(np.uint8), np.ones((2, 2), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    comps = sorted([(list(st[i][:4]), [i]) for i in range(1, n) if st[i][4] >= 6], key=lambda c: c[0][0])
    if not comps: return [], [], [], by
    chars = []
    for c, ids in comps:  # merge pieces that share a column (i/j dots, accents, broken strokes)
        if chars:
            p, pid = chars[-1]; ov = min(p[0] + p[2], c[0] + c[2]) - max(p[0], c[0])
            if ov > .5 * min(p[2], c[2]):
                x0, y0 = min(p[0], c[0]), min(p[1], c[1]); chars[-1] = ([x0, y0, max(p[0] + p[2], c[0] + c[2]) - x0, max(p[1] + p[3], c[1] + c[3]) - y0], pid + ids); continue
        chars.append((c, ids))
    hgt = np.median([c[3] for c, _ in chars]); words = [[chars[0]]]; idx = [0]
    for (a, _), (b, ids) in zip(chars, chars[1:]):
        gap = b[0] - (a[0] + a[2])
        if gap > .3 * hgt: words.append([(b, ids)]); idx.append(idx[-1] + 2)  # a space sits between words
        else: words[-1].append((b, ids)); idx.append(idx[-1] + 1)
    merge = lambda g: ([min(c[0] for c, _ in g), min(c[1] for c, _ in g), max(c[0] + c[2] for c, _ in g) - min(c[0] for c, _ in g), max(c[1] + c[3] for c, _ in g) - min(c[1] for c, _ in g)], sum((i for _, i in g), []))
    if by == 'auto': by = 'char' if len(chars) <= 40 else 'word'
    U = chars if by == 'char' else [merge(g) for g in words]; ix = idx if by == 'char' else list(range(len(words)))
    pad = int(hgt * .35) + 3; boxes, masks = [], []
    for (u, ids) in U:
        bx = [u[0] - pad, u[1] - pad, u[2] + 2 * pad, u[3] + 2 * pad]; mm = np.zeros((bx[3], bx[2]), bool)
        sub = lab[max(bx[1], 0):bx[1] + bx[3], max(bx[0], 0):bx[0] + bx[2]]; own = np.isin(sub, ids)
        mm[max(-bx[1], 0):max(-bx[1], 0) + own.shape[0], max(-bx[0], 0):max(-bx[0], 0) + own.shape[1]] = own
        boxes.append([x + bx[0], y + bx[1], bx[2], bx[3]]); masks.append(mm)
    return boxes, masks, ix, by

def first_start(fit):
    ts = [m['th'][0] for v in fit['moves'].values() for m in v]; return min(ts) if ts else None

def from_values(fit, rest):
    f = {}
    for prop, moves in fit['moves'].items():
        m = moves[0]; v0, v1 = np.array(m['v0']), np.array(m['v1'])
        if prop == 'position': d = v0 - v1; f['x'], f['y'] = float(d[0]), float(d[1])
        elif prop == 'scale': f['scale'] = float(v0[0] / max(v1[0], 1e-6) * 100)
        elif prop == 'rotation': f['rotation'] = float(v0[0] - v1[0])
        elif prop == 'opacity': f['opacity'] = float(v0[0])
    return f

def blur_from(Fw, fps, rows, box, own, rest_crop):
    """blur (px) the unit starts with: measured on its first clearly visible frame, aligned to the rest pose, then scaled back
    to the start of its animation (blur and fade share the animator's progress)"""
    r = next((r for r in rows if (r['opacity'] or 0) >= 40), None)
    if r is None: return 0.0
    i = int(round(r['t'] * fps)); x, y, w, h = [int(round(v)) for v in box]; s = r['scale_x'] / 100; a = math.radians(r['rotation'])
    A = s * np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]); c = np.array([w / 2, h / 2])
    M = np.hstack([A, (np.array([r['x'] - x, r['y'] - y]) + np.array([x, y]) - A @ c)[:, None]]).astype(np.float32)
    f = cv2.warpAffine(Fw[i].astype(np.float32) / 255, M, (w, h), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    region = cv2.dilate(own.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0; best = (1e9, 0.0)
    for sg in (0, .5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16):
        b = cv2.GaussianBlur(rest_crop, (0, 0), sg) if sg else rest_crop; bg = np.median(b[~region]) if (~region).any() else 0; fb = np.median(f[~region]) if (~region).any() else 0
        d = (b - bg)[region]; e_ = (f - fb)[region]; k = float((e_ * d).sum() / max((d * d).sum(), 1e-9)); err = float(((e_ - k * d) ** 2).mean())
        if err < best[0]: best = (err, sg)
    return float(best[1] / max(1 - r['opacity'] / 100, .2))

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--name', required=True); ap.add_argument('--at', type=float, required=True); ap.add_argument('--box', required=True)
    ap.add_argument('--from', dest='t_from', type=float, required=True); ap.add_argument('--to', dest='t_to', type=float, required=True); ap.add_argument('--by', default='auto', choices=('auto', 'char', 'word'))
    ap.add_argument('--beats'); ap.add_argument('--out', default='analysis'); a = ap.parse_args()
    beats = json.load(open(a.beats))['hits'] if a.beats else None; box = [float(v) for v in a.box.split(',')]
    t0 = max(0, a.t_from - .1); F, fps, S = load(a.video, 4096, t0, a.t_to + .1)  # full resolution, only the entrance window
    rest = F[int(round((a.at - t0) * fps))]; U, MASKS, IX, by = units(rest, box, a.by)
    if not U: sys.exit('no glyphs found in the box (check --box / --at)')
    res = []; tracked = {}
    for k, ub in enumerate(U):
        rows = track(F, fps, S, a.at - t0, ub, 0, a.t_to - t0, own=MASKS[k])
        for r in rows: r['t'] = round(r['t'] + t0, 4)
        if len(rows) >= 3: tracked[k] = rows
    # the block can move as a whole too (a camera push, a drift): measure that shared motion and take it out of every letter,
    # so each letter's fit sees only its own entrance
    shared = {}
    for k, rows in tracked.items():  # only letters that have finished their own entrance (seen for 0.6 s+) show the block's motion
        cx, cy = U[k][0] + U[k][2] / 2, U[k][1] + U[k][3] / 2
        for r in rows:
            if r['t'] - rows[0]['t'] >= .6: shared.setdefault(r['t'], []).append((r['x'] - cx, r['y'] - cy, r['scale_x']))
    bx, by_ = box[0] + box[2] / 2, box[1] + box[3] / 2
    med = {t: (float(np.median([v[0] for v in vs])), float(np.median([v[1] for v in vs])), float(np.median([v[2] for v in vs]))) for t, vs in shared.items() if len(vs) >= 2}
    if not med or max(max(abs(m[0]), abs(m[1])) for m in med.values()) < 3 and max(abs(m[2] - 100) for m in med.values()) < 1.5: med = {}  # no real block motion
    block = []
    for t in sorted(med): block.append(dict(t=t, x=bx + med[t][0], y=by_ + med[t][1], scale_x=med[t][2], scale_y=med[t][2], rotation=0.0, opacity=None, visible=1.0, cc=1.0, shutter=0.0, sharpness=1.0))
    for k in list(tracked):
        cx, cy = U[k][0] + U[k][2] / 2, U[k][1] + U[k][3] / 2
        for r in tracked[k]:
            m = med.get(r['t'])
            if m: r['x'] -= m[0] - (cx - bx) * (m[2] / 100 - 1); r['y'] -= m[1] - (cy - by_) * (m[2] / 100 - 1); r['scale_x'] *= 100 / m[2]; r['scale_y'] *= 100 / m[2]
    for k, ub in enumerate(U):
        rows = tracked.get(k)
        if not rows: continue
        fit = fit_data(dict(name=f'{a.name}_{k}', fps=fps, width=F.shape[2], height=F.shape[1], box=ub, at=a.at, frames=rows), None, quick=True)
        st = first_start(fit)
        if st is None: continue
        st = min(max(st, a.t_from, rows[0]['t'] - .35), rows[0]['t'])  # an extrapolated start can't precede the window or the letter's first sighting by much
        x, y, w, h = [int(round(v)) for v in ub]; rc = rest[y:y + h, x:x + w].astype(np.float32) / 255
        fv = from_values(fit, rows); fv['blur'] = blur_from(F, fps, [dict(r, t=r['t'] - t0) for r in rows], ub, MASKS[k], rc)
        lead = next((fit['moves'][p_] for p_ in ('position', 'scale', 'rotation', 'opacity') if fit['moves'].get(p_)), None)  # the animator's ease shows best in motion, not in a clipped fade
        mv = max(lead, key=lambda m: m['th'][1] - m['th'][0])
        res.append(dict(box=[int(v) for v in ub], k=k, i=IX[k], start=st, dur=mv['th'][1] - mv['th'][0], ease=mv['ease_name'], from_=fv, cx=ub[0] + ub[2] / 2))
    spread = (max(r['start'] for r in res) - min(r['start'] for r in res)) if res else 0
    if len(res) < 2 or spread < 1.5 / fps:  # the units move together: it's one layer, not a text animator
        from track import track as track1; from fit import fit_data as fit1
        Fh, fps2, S2 = load(a.video, 960); rows = track1(Fh, fps2, S2, a.at, box, a.t_from, a.t_to); os.makedirs(a.out, exist_ok=True)
        tr = dict(name=a.name, video=a.video, fps=fps2, model='affine', width=int(Fh.shape[2] * S2), height=int(Fh.shape[1] * S2), at=a.at, box=box, frames=rows)
        json.dump(tr, open(os.path.join(a.out, f'{a.name}.track.json'), 'w')); fr = fit1(tr, beats); json.dump(fr, open(os.path.join(a.out, f'{a.name}.fit.json'), 'w'), indent=1)
        print(f'■ {a.name}: the text moves as one block (not letter by letter) — tracked as a layer'); [print('  ' + l) for l in fr['report']]; sys.exit(0)
    I = np.array([r['i'] for r in res], float); Ts = np.array([r['start'] for r in res]); n = IX[-1] + 1
    fits = {'forward': I, 'reverse': n - 1 - I, 'center': np.abs(I - (n - 1) / 2)}
    def line(x):  # Theil–Sen: median of pairwise slopes, so a few badly-timed letters can't tilt the pattern
        sl = [(Ts[j] - Ts[i]) / (x[j] - x[i]) for i in range(len(x)) for j in range(i + 1, len(x)) if x[j] != x[i]]
        k_ = float(np.median(sl)) if sl else 0.0; b_ = float(np.median(Ts - k_ * x)); return k_, b_, float(np.median(np.abs(Ts - (k_ * x + b_))))
    sc = {o: line(x) for o, x in fits.items()}; order = min(sc, key=lambda o: sc[o][2] if sc[o][0] > 0 else 1e9); stagger, start, err = sc[order]
    if err > max(.4 * stagger, .5 / fps): order = 'random'  # err is now the median miss, in seconds
    med = lambda k: float(np.median([r['from_'].get(k, 0 if k not in ('opacity', 'scale') else 100) for r in res]))
    hgt = float(np.median([u[3] for u in U]))
    frm = {k: round(med(k), 1) for k in ('opacity', 'x', 'y', 'scale', 'rotation', 'blur')}
    for k in ('x', 'y'):
        if abs(frm[k]) > 3 * hgt: frm[k] = 0.0  # implausible: an extrapolation, not a measurement
    frm = {k: v for k, v in frm.items() if not ((k in ('opacity', 'scale') and abs(v - 100) < 4) or (k in ('x', 'y') and abs(v) < 3) or (k == 'rotation' and abs(v) < 1.5) or (k == 'blur' and v < 1.5))}
    eases = [r['ease'] for r in res if r['ease']]; ease = max(set(eases), key=eases.count) if eases else 'out'
    anim = dict(by=by, start=round(float(start), 3), stagger=round(float(stagger), 4), dur=round(float(np.median([r['dur'] for r in res])), 3), ease=ease, order=order, **({'from': frm} if frm else {}))
    if beats: b = near_beat(anim['start'], beats, fps); anim_beat = b
    if len(block) >= 4:
        bt = dict(name=a.name + '_block', video=a.video, fps=fps, model='affine', width=F.shape[2], height=F.shape[1], at=a.at, box=box, frames=block)
        bf = fit_data(bt, beats); anim['block'] = bf['layer']; blines = bf['report']
    else: blines = []
    os.makedirs(a.out, exist_ok=True); json.dump(dict(name=a.name, video=a.video, fps=fps, at=a.at, box=box, units=len(U), animated=len(res), animator=anim, per_unit=res), open(os.path.join(a.out, f'{a.name}.text.json'), 'w'), indent=1)
    desc = ', '.join(f"{k} {v:+g}" if k in ('x', 'y', 'rotation') else f"{k} {v:g}" for k, v in frm.items())
    print(f"■ {a.name}: {len(res)}/{len(U)} {by}s animate {order}, {anim['stagger'] * 1000:.0f} ms apart, from {anim['start']:.2f} s, each {anim['dur']:.2f} s, ease {ease}" + (f" · from {desc}" if desc else '') + (f" · starts on {anim_beat}" if beats and anim_beat else ''))
    [print('  whole block: ' + l) for l in blines]
    print('  animator:', json.dumps({k: v for k, v in anim.items() if k != 'block'}))
