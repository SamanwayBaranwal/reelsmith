# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Track one element through a shot, frame by frame, with sub-pixel accuracy.

usage: uv run analyser/track.py <video> --name card --at 2.5 --box x,y,w,h [--out analysis/] [--from 0 --to 6]

--at/--box: a moment where the element is at rest and fully visible, and its box in video pixels.
Tracks forwards and backwards from there with ECC image alignment (affine), which is unaffected by fades
(it is invariant to brightness/contrast), and falls back to template search on whip-fast moves.
Writes <out>/<name>.track.json: per frame t, x, y (box centre, video px), scale_x/scale_y (% of the rest pose),
rotation (degrees), skew, opacity (% of the rest pose), sharpness (1 = as sharp as rest, <1 = motion-blurred), shutter (best-matching
motion-blur shutter angle, 0 when still), visible (fraction of the element inside the frame; below ~0.6 the position is unreliable), cc (match quality).
"""
import argparse, json, math, os, subprocess
import numpy as np, cv2

def probe(path):
    s = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', path]))['streams'][0]
    n, d = s['r_frame_rate'].split('/'); return s['width'], s['height'], float(n) / float(d)

def load(path, aw):
    W, H, fps = probe(path); aw = min(aw, W); ah = round(H * aw / W / 2) * 2
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={aw}:{ah}:flags=area,format=gray', '-f', 'rawvideo', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, ah, aw), fps, W / aw

CRIT = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 80, 1e-5)

def roi_of(frame, Wp, tw, th, pad):
    """crop of the frame around where the warped template lands, padded with zeros (masked out) past the frame edge"""
    c = Wp @ np.array([[0, tw, tw, 0], [0, 0, th, th], [1, 1, 1, 1]], np.float32)
    x0, y0 = int(math.floor(c[0].min())) - pad, int(math.floor(c[1].min())) - pad
    x1, y1 = int(math.ceil(c[0].max())) + pad, int(math.ceil(c[1].max())) + pad
    H, W = frame.shape; roi = np.zeros((y1 - y0, x1 - x0), np.float32); m = np.zeros_like(roi, np.uint8)
    sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if sx1 <= sx0 or sy1 <= sy0: return None
    roi[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = frame[sy0:sy1, sx0:sx1]; m[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = 1
    return roi, m, x0, y0

def ecc(tmpl, frame, Wp, tmask=None, pad=24):
    th, tw = tmpl.shape; r = roi_of(frame, Wp, tw, th, pad)
    if r is None: return -1, Wp
    roi, m, x0, y0 = r; Wr = Wp.copy(); Wr[0, 2] -= x0; Wr[1, 2] -= y0
    try: cc, Wr = cv2.findTransformECCWithMask(tmpl, roi, tmask, m, Wr, cv2.MOTION_AFFINE, CRIT, 3) if tmask is not None else cv2.findTransformECC(tmpl, roi, Wr, cv2.MOTION_AFFINE, CRIT, m, 3)
    except cv2.error: return -1, Wp
    Wr[0, 2] += x0; Wr[1, 2] += y0; return float(cc), Wr

def ecc_translate(tmpl, tmask, frame, Wp, pad=24):
    """position-only alignment with the shape fixed to Wp's (used during whips, where blur can impersonate a scale change)"""
    th, tw = tmpl.shape; A = Wp[:, :2]; c = np.array([tw / 2, th / 2], np.float32); M = np.hstack([A, (c - A @ c)[:, None]]).astype(np.float32)
    t2 = cv2.warpAffine(tmpl, M, (tw, th), borderMode=cv2.BORDER_REPLICATE); m2 = (cv2.warpAffine(tmask.astype(np.float32), M, (tw, th)) > .5).astype(np.uint8)
    W0 = np.array([[1, 0, 0], [0, 1, 0]], np.float32)
    W0[:, 2] = (Wp[:, :2] @ c + Wp[:, 2]) - c  # put the pre-warped template's centre where Wp puts it
    r = roi_of(frame, W0, tw, th, pad)
    if r is None: return -1, Wp
    roi, m, x0, y0 = r; Wr = W0.copy(); Wr[0, 2] -= x0; Wr[1, 2] -= y0
    try: cc, Wr = cv2.findTransformECCWithMask(t2, roi, m2, m, Wr, cv2.MOTION_TRANSLATION, CRIT, 3)
    except cv2.error: return -1, Wp
    out = Wp.copy(); out[:, 2] += (Wr[:, 2] + (x0, y0) - W0[:, 2]).astype(np.float32); return float(cc), out

def search(tmpl, frame, Wp, radius):
    """coarse re-acquire: warp the template by the current scale/rotation, find it by normalised cross-correlation near the prediction"""
    th, tw = tmpl.shape; A = Wp[:, :2]; c = A @ np.array([tw / 2, th / 2], np.float32)
    corners = A @ np.array([[0, tw, tw, 0], [0, 0, th, th]], np.float32); w2, h2 = int(np.ptp(corners[0])) + 2, int(np.ptp(corners[1])) + 2
    if w2 < 6 or h2 < 6: return -1, Wp
    M = np.hstack([A, (np.array([w2 / 2, h2 / 2]) - c)[:, None]]).astype(np.float32); wt = cv2.warpAffine(tmpl, M, (w2, h2))
    px, py = (Wp @ np.array([tw / 2, th / 2, 1], np.float32)); H, W = frame.shape
    x0, y0 = int(max(0, px - w2 / 2 - radius)), int(max(0, py - h2 / 2 - radius)); x1, y1 = int(min(W, px + w2 / 2 + radius)), int(min(H, py + h2 / 2 + radius))
    area = frame[y0:y1, x0:x1]
    if area.shape[0] <= h2 or area.shape[1] <= w2: return -1, Wp
    res = cv2.matchTemplate(area, wt, cv2.TM_CCOEFF_NORMED); _, best, _, loc = cv2.minMaxLoc(res)
    W2 = Wp.copy(); nc = np.array([x0 + loc[0] + w2 / 2, y0 + loc[1] + h2 / 2]); W2[:, 2] += (nc - np.array([px, py])).astype(np.float32)
    return float(best), W2

def element_mask(crop, ring=3, thr=0.05):
    border = np.concatenate([crop[:ring].ravel(), crop[-ring:].ravel(), crop[:, :ring].ravel(), crop[:, -ring:].ravel()])
    bg = float(np.median(border)); m = (np.abs(crop - bg) > thr).astype(np.uint8)
    return cv2.dilate(m, np.ones((3, 3), np.uint8)) > 0, bg

def measure(frame, tmpl, mask, bgT, Wp):
    th, tw = tmpl.shape; f = cv2.warpAffine(frame, Wp, (tw, th), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    out = ~mask; bgF = float(np.median(f[out])) if out.sum() > 20 else bgT
    d = tmpl[mask] - bgT; den = float((d * d).sum()); a = float(((f[mask] - bgF) * d).sum() / den) if den > 1e-6 else 1.0
    g = lambda im: (cv2.Sobel(im, cv2.CV_32F, 1, 0) ** 2 + cv2.Sobel(im, cv2.CV_32F, 0, 1) ** 2)[mask].sum()
    gt = g(tmpl); sharp = float(g(f) / gt / max(a * a, 1e-3)) if gt > 1e-6 else 1.0
    return a, sharp

def decompose(Wp, tw, th, S):
    A = Wp[:, :2].astype(float); c = A @ [tw / 2, th / 2] + Wp[:, 2]
    sx = math.hypot(A[0, 0], A[1, 0]); det = A[0, 0] * A[1, 1] - A[0, 1] * A[1, 0]
    return dict(x=c[0] * S, y=c[1] * S, scale_x=sx * 100, scale_y=det / sx * 100 if sx else 0, rotation=math.degrees(math.atan2(A[1, 0], A[0, 0])),
                skew=math.degrees(math.atan2(A[0, 0] * A[0, 1] + A[1, 0] * A[1, 1], det)) if det else 0)

def line_kernel(L, ang):
    """motion-blur kernel: a line L px long at angle ang (radians), centred (the shutter straddles the frame time)"""
    n = int(math.ceil(L)) | 1; n = max(n, 3); k = np.zeros((n, n), np.float32); c = n // 2
    for s_ in np.linspace(-L / 2, L / 2, max(3, int(L * 3))): k[int(round(c + s_ * math.sin(ang))), int(round(c + s_ * math.cos(ang)))] += 1
    return k / k.sum()

def centre(Wp, tw, th): return Wp @ np.array([tw / 2, th / 2, 1], np.float32)
def scale_of(Wp): return math.hypot(float(Wp[0, 0]), float(Wp[1, 0]))
SHUTTERS = (.25, .5, .75, 1.0)  # fractions of a frame (90°, 180°, 270°, 360°)

def track(F, fps, S, at, box, t_from=None, t_to=None, min_cc=0.55, accept=0.75):
    n = len(F); i0 = int(round(at * fps)); x, y, w, h = [v / S for v in box]
    xi, yi, wi, hi = int(round(x)), int(round(y)), int(round(w)), int(round(h))
    rest = F[i0].astype(np.float32) / 255; crop = rest[yi:yi + hi, xi:xi + wi].copy(); m0, bgT = element_mask(crop)
    # pad the template with its own background so blurred versions and off-screen entries have room
    P = int(max(wi, hi) * .35) + 8; tmpl = cv2.copyMakeBorder(crop, P, P, P, P, cv2.BORDER_CONSTANT, value=bgT); mask = cv2.copyMakeBorder(m0.astype(np.uint8), P, P, P, P, cv2.BORDER_CONSTANT, value=0) > 0
    tmask = np.zeros(tmpl.shape, np.uint8); tmask[P:P + hi, P:P + wi] = 1  # only the real crop counts, never the padding
    th, tw = tmpl.shape; ys, xs = np.nonzero(mask); bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()  # the element's own extent
    lo = max(0, int(math.ceil((t_from if t_from is not None else 0) * fps))); hi_ = min(n - 1, int((t_to if t_to is not None else 1e9) * fps))
    W0 = np.array([[1, 0, xi - P], [0, 1, yi - P]], np.float32); rows = {}
    for step in (1, -1):
        hist = [W0.copy(), W0.copy()]; misses = 0; i = i0
        while lo <= i <= hi_:
            frame = F[i].astype(np.float32) / 255
            pred = hist[-1] + (hist[-1] - hist[-2]) if i != i0 else W0  # constant-velocity prediction (whips)
            pe = pred @ np.array([[bx0, bx1, bx1, bx0], [by0, by0, by1, by1], [1, 1, 1, 1]], np.float32); Hf, Wf = F.shape[1:]
            if i != i0 and max(0., min(Wf, pe[0].max()) - max(0, pe[0].min())) * max(0., min(Hf, pe[1].max()) - max(0, pe[1].min())) < .3 * np.ptp(pe[0]) * np.ptp(pe[1]): break  # heading out of frame
            cc, Wp = ecc(tmpl, frame, pred, tmask); used, shutter = tmpl, 0.0
            if cc < min_cc:  # lost (often a sudden whip): search near the prediction with sharp and smeared templates, then refine
                best = (-1, None, None, None)
                for L, ang in [(0, 0)] + [(L, a_) for L in (12, 30, 60, 100, 150) for a_ in (0, math.pi / 4, math.pi / 2, 3 * math.pi / 4)]:
                    if L: K = line_kernel(L, ang); bt = cv2.filter2D(tmpl, -1, K, borderType=cv2.BORDER_REPLICATE); bm = (cv2.filter2D(tmask.astype(np.float32), -1, K) > .01).astype(np.uint8)
                    else: bt, bm = tmpl, tmask
                    sc, Ws = search(bt, frame, hist[-1], radius=int(max(wi, hi) * 1.5) + 20)
                    if L:  # a smear is only believable if the jump runs along it and its length fits the jump (shutter 70°–430°)
                        d = centre(Ws, tw, th) - centre(hist[-1], tw, th); dl = float(np.hypot(*d)); da = abs((math.atan2(d[1], d[0]) - ang + math.pi / 2) % math.pi - math.pi / 2)
                        if not (.2 * dl <= L <= 1.2 * dl) or da > math.radians(25): continue
                    if sc > best[0]: best = (sc, Ws, bt, bm)
                if best[0] > .3:
                    cc2, Wp2 = ecc_translate(best[2], best[3], frame, best[1])
                    cc, Wp = (cc2, Wp2) if cc2 > cc else (best[0] * .9, best[1])
            # motion blur: if it moved more than ~2 px this frame, match against blurred templates and keep the best shutter.
            # during a whip (fast) the shape is held and only position is solved; shape may change only a little and only if it clearly helps
            v = centre(Wp if cc > min_cc * .7 else pred, tw, th) - centre(hist[-1], tw, th); speed = float(np.hypot(*v)); fast = i != i0 and speed > 6
            if fast: cc, Wp = ecc_translate(tmpl, tmask, frame, hist[-1] if cc < min_cc * .7 else np.hstack([hist[-1][:, :2], Wp[:, 2:]]))
            if i != i0 and speed > 2:
                Ai = np.linalg.inv(Wp[:, :2].astype(np.float64)); vt = Ai @ v; L = float(np.hypot(*vt)); ang = math.atan2(vt[1], vt[0])
                for k in SHUTTERS:
                    K = line_kernel(L * k, ang); bt = cv2.filter2D(tmpl, -1, K, borderType=cv2.BORDER_REPLICATE); bm = (cv2.filter2D(tmask.astype(np.float32), -1, K) > .01).astype(np.uint8)
                    if fast:
                        c2, W2 = ecc_translate(bt, bm, frame, Wp)
                        c3, W3 = ecc(bt, frame, W2, bm)  # optional small shape refinement
                        if c3 > c2 + .01 and abs(math.log(scale_of(W3) / scale_of(W2))) < .05: c2, W2 = c3, W3
                    else: c2, W2 = ecc(bt, frame, Wp if cc > min_cc * .7 else pred, bm)
                    if c2 > cc + .003: cc, Wp, used, shutter = c2, W2, bt, k * 360  # blur must clearly explain the image better
            # shape is only trustworthy when the whole element is in frame and the shape change is plausible;
            # otherwise keep the last confident shape (scale/rotation) and take only the position from the match
            ex = Wp @ np.array([[bx0, bx1, bx1, bx0], [by0, by0, by1, by1], [1, 1, 1, 1]], np.float32)
            off = ex[0].min() < 0 or ex[1].min() < 0 or ex[0].max() > frame.shape[1] or ex[1].max() > frame.shape[0]
            Hf, Wf = frame.shape; vis = max(0., min(Wf, ex[0].max()) - max(0, ex[0].min())) * max(0., min(Hf, ex[1].max()) - max(0, ex[1].min())) / max(1e-6, np.ptp(ex[0]) * np.ptp(ex[1]))
            jump = abs(math.log(max(scale_of(Wp), 1e-3) / max(scale_of(hist[-1]), 1e-3))) > .3 or abs(math.log(abs(np.linalg.det(Wp[:, :2])) / max(scale_of(Wp) ** 2, 1e-6))) > .15
            if (off or (jump and cc < .97)) and i != i0:
                Wt = hist[-1].copy(); Wt[:, 2] += (centre(Wp, tw, th) - centre(Wt, tw, th)).astype(np.float32); Wp = Wt
            if os.environ.get('TRACK_DEBUG'): print(i, round(i / fps, 3), 'cc', round(cc, 4), 'shutter', shutter, 'scale', round(scale_of(Wp), 3), 'off', bool(off), 'jump', bool(jump))
            if vis < .3: break  # it has left the frame
            if cc < accept: misses += 1
            else: misses = 0
            if misses >= 3: break
            if cc >= accept:
                a, sharp = measure(frame, used, mask, bgT, Wp)
                if fast or vis < .98: a = float('nan')  # smeared or cut off: opacity can't be read reliably
                rows[i] = dict(t=round(i / fps, 4), **{k: round(v_, 3) for k, v_ in decompose(Wp, tw, th, S).items()}, opacity=None if math.isnan(a) else round(a * 100, 2), sharpness=round(sharp, 3), shutter=shutter, visible=round(float(vis), 3), cc=round(cc, 4))
                hist = [hist[-1], Wp]
            i += step
    out = [rows[k] for k in sorted(rows)]
    if out:  # unwrap rotation so a 0→180→270 spin reads as continuous degrees
        r = np.degrees(np.unwrap(np.radians([o['rotation'] for o in out]))); r -= 360 * round(r[[o['t'] for o in out].index(min(out, key=lambda o: abs(o['t'] - at))['t'])] / 360)
        for o, v_ in zip(out, r): o['rotation'] = round(float(v_), 3)
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--name', required=True); ap.add_argument('--at', type=float, required=True)
    ap.add_argument('--box', required=True); ap.add_argument('--out', default='analysis'); ap.add_argument('--from', dest='t_from', type=float); ap.add_argument('--to', dest='t_to', type=float)
    ap.add_argument('--width', type=int, default=960)
    a = ap.parse_args(); F, fps, S = load(a.video, a.width); box = [float(v) for v in a.box.split(',')]
    rows = track(F, fps, S, a.at, box, a.t_from, a.t_to); os.makedirs(a.out, exist_ok=True)
    json.dump(dict(name=a.name, video=a.video, fps=fps, width=int(F.shape[2] * S), height=int(F.shape[1] * S), at=a.at, box=box, frames=rows), open(os.path.join(a.out, f'{a.name}.track.json'), 'w'))
    print(f'{a.name}: {len(rows)} frames tracked ({rows[0]["t"] if rows else "-"}–{rows[-1]["t"] if rows else "-"} s)')
