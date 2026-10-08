# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Track one element through a shot, frame by frame, with sub-pixel accuracy.

usage: uv run analyser/track.py <video> --name card --at 2.5 --box x,y,w,h [--model affine|3d] [--out analysis/] [--from 0 --to 6]

--at/--box: a moment where the element is at rest, fully visible (and, for --model 3d, facing the camera), and its box in video px.
Tracks forwards and backwards from there with ECC image alignment, which is unaffected by fades (invariant to brightness/contrast),
and falls back to template search on whip-fast moves.
  --model affine  2D layers: position, scale, rotation, skew
  --model 3d      perspective (homography) for 3D layers: also rotationX / rotationY, decomposed through After Effects' default
                  50mm comp camera with the layer kept at z = 0 (depth shows up as scale, as it looks on screen)
Writes <out>/<name>.track.json: per frame t, x, y (box centre, video px), scale_x/scale_y (% of the rest pose), rotation (degrees),
[rotationX, rotationY], skew, opacity (% of the rest pose), sharpness (1 = as sharp as rest, <1 = motion-blurred), shutter (best-matching
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
MODEL = {'affine': cv2.MOTION_AFFINE, '3d': cv2.MOTION_HOMOGRAPHY}

# ---------------------------------------------------------------- warps are 3x3 (affine ones keep [0, 0, 1] as the last row)
def Tm(dx, dy): return np.array([[1, 0, dx], [0, 1, dy], [0, 0, 1]], np.float64)
def apply(Wp, pts):
    """project 2xN template points through warp Wp"""
    q = Wp @ np.vstack([pts, np.ones(pts.shape[1])]); return q[:2] / q[2]
def centre(Wp, tw, th): return apply(Wp, np.array([[tw / 2], [th / 2]]))[:, 0]
def jac(Wp, p):
    """local 2x2 linear map of the warp at template point p (scale/rotation/shear there)"""
    x, y = p; q = Wp @ [x, y, 1]; w = q[2]
    return np.array([[Wp[0, 0] / w - q[0] * Wp[2, 0] / w ** 2, Wp[0, 1] / w - q[0] * Wp[2, 1] / w ** 2],
                     [Wp[1, 0] / w - q[1] * Wp[2, 0] / w ** 2, Wp[1, 1] / w - q[1] * Wp[2, 1] / w ** 2]])
def scale_of(Wp, tw, th): J = jac(Wp, (tw / 2, th / 2)); return math.hypot(J[0, 0], J[1, 0])
def shift(Wp, d): return Tm(d[0], d[1]) @ Wp
def norm(Wp): return Wp / Wp[2, 2]

def roi_of(frame, Wp, tw, th, pad):
    """crop of the frame around where the warped template lands, padded with zeros (masked out) past the frame edge"""
    c = apply(Wp, np.array([[0, tw, tw, 0], [0, 0, th, th]], np.float64))
    x0, y0 = int(math.floor(c[0].min())) - pad, int(math.floor(c[1].min())) - pad
    x1, y1 = int(math.ceil(c[0].max())) + pad, int(math.ceil(c[1].max())) + pad
    H, W = frame.shape
    if x1 - x0 > 4 * W or y1 - y0 > 4 * H: return None
    roi = np.zeros((y1 - y0, x1 - x0), np.float32); m = np.zeros_like(roi, np.uint8)
    sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if sx1 <= sx0 or sy1 <= sy0: return None
    roi[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = frame[sy0:sy1, sx0:sx1]; m[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = 1
    return roi, m, x0, y0

def ecc(tmpl, frame, Wp, tmask, model, pad=24):
    th, tw = tmpl.shape; r = roi_of(frame, Wp, tw, th, pad)
    if r is None: return -1, Wp
    roi, m, x0, y0 = r; Wr = (Tm(-x0, -y0) @ Wp).astype(np.float32)
    if model != '3d': Wr = Wr[:2].copy()
    try: cc, Wr = cv2.findTransformECCWithMask(tmpl, roi, tmask, m, Wr, MODEL[model], CRIT, 3)
    except cv2.error: return -1, Wp
    Wr = np.vstack([Wr, [0, 0, 1]]) if Wr.shape[0] == 2 else Wr
    return float(cc), norm(Tm(x0, y0) @ Wr.astype(np.float64))

def ecc_translate(tmpl, tmask, frame, Wp, pad=24):
    """position-only alignment with the shape fixed to Wp's (used during whips, where blur can impersonate a scale change)"""
    th, tw = tmpl.shape; c = np.array([tw / 2, th / 2]); pc = centre(Wp, tw, th)
    K = (Tm(*c) @ Tm(*-pc) @ Wp).astype(np.float32)  # Wp's shape about the template centre
    t2 = cv2.warpPerspective(tmpl, K, (tw, th), borderMode=cv2.BORDER_REPLICATE); m2 = (cv2.warpPerspective(tmask.astype(np.float32), K, (tw, th)) > .5).astype(np.uint8)
    W0 = Tm(*(pc - c)); r = roi_of(frame, W0, tw, th, pad)
    if r is None: return -1, Wp
    roi, m, x0, y0 = r; Wr = (Tm(-x0, -y0) @ W0)[:2].astype(np.float32)
    try: cc, Wr = cv2.findTransformECCWithMask(t2, roi, m2, m, Wr, cv2.MOTION_TRANSLATION, CRIT, 3)
    except cv2.error: return -1, Wp
    return float(cc), shift(Wp, Wr[:, 2] + (x0, y0) - W0[:2, 2])

def search(tmpl, frame, Wp, radius):
    """coarse re-acquire: warp the template by the current local shape, find it by normalised cross-correlation near the prediction"""
    th, tw = tmpl.shape; A = jac(Wp, (tw / 2, th / 2)); c = A @ np.array([tw / 2, th / 2])
    corners = A @ np.array([[0, tw, tw, 0], [0, 0, th, th]], np.float64); w2, h2 = int(np.ptp(corners[0])) + 2, int(np.ptp(corners[1])) + 2
    if w2 < 6 or h2 < 6 or w2 > 4 * frame.shape[1]: return -1, Wp
    M = np.hstack([A, (np.array([w2 / 2, h2 / 2]) - c)[:, None]]).astype(np.float32); wt = cv2.warpAffine(tmpl, M, (w2, h2))
    px, py = centre(Wp, tw, th); H, W = frame.shape
    x0, y0 = int(max(0, px - w2 / 2 - radius)), int(max(0, py - h2 / 2 - radius)); x1, y1 = int(min(W, px + w2 / 2 + radius)), int(min(H, py + h2 / 2 + radius))
    area = frame[y0:y1, x0:x1]
    if area.shape[0] <= h2 or area.shape[1] <= w2: return -1, Wp
    res = cv2.matchTemplate(area, wt, cv2.TM_CCOEFF_NORMED); _, best, _, loc = cv2.minMaxLoc(res)
    return float(best), shift(Wp, np.array([x0 + loc[0] + w2 / 2 - px, y0 + loc[1] + h2 / 2 - py]))

def element_mask(crop, ring=3, thr=0.05):
    border = np.concatenate([crop[:ring].ravel(), crop[-ring:].ravel(), crop[:, :ring].ravel(), crop[:, -ring:].ravel()])
    bg = float(np.median(border)); m = (np.abs(crop - bg) > thr).astype(np.uint8)
    return cv2.dilate(m, np.ones((3, 3), np.uint8)) > 0, bg

def measure(frame, tmpl, mask, bgT, Wp):
    th, tw = tmpl.shape; f = cv2.warpPerspective(frame, Wp.astype(np.float32), (tw, th), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    out = ~mask; bgF = float(np.median(f[out])) if out.sum() > 20 else bgT
    d = tmpl[mask] - bgT; den = float((d * d).sum()); a = float(((f[mask] - bgF) * d).sum() / den) if den > 1e-6 else 1.0
    g = lambda im: (cv2.Sobel(im, cv2.CV_32F, 1, 0) ** 2 + cv2.Sobel(im, cv2.CV_32F, 0, 1) ** 2)[mask].sum()
    gt = g(tmpl); sharp = float(g(f) / gt / max(a * a, 1e-3)) if gt > 1e-6 else 1.0
    return a, sharp

def decompose(Wp, tw, th, S, video_wh, model):
    c = (tw / 2, th / 2); x, y = centre(Wp, tw, th); J = jac(Wp, c)
    sx = math.hypot(J[0, 0], J[1, 0]); det = J[0, 0] * J[1, 1] - J[0, 1] * J[1, 0]
    out = dict(x=x * S, y=y * S, scale_x=sx * 100, scale_y=det / sx * 100 if sx else 0, rotation=math.degrees(math.atan2(J[1, 0], J[0, 0])),
               skew=math.degrees(math.atan2(J[0, 0] * J[0, 1] + J[1, 0] * J[1, 1], det)) if det else 0)
    if model == '3d':  # layer (u, v) px around its centre → screen, through After Effects' 50mm camera; layer kept at z = 0
        Wv, Hv = video_wh; f = (Wv / 2) / math.tan(math.radians(39.6 / 2)); K = np.array([[f, 0, Wv / 2], [0, f, Hv / 2], [0, 0, 1]])
        Hl = np.diag([S, S, 1.0]) @ Wp @ Tm(*c) @ np.diag([1 / S, 1 / S, 1.0]); G = np.linalg.inv(K) @ Hl
        mu = G[2, 2] / f
        if abs(mu) > 1e-12:
            g1, g2 = G[:, 0] / mu, G[:, 1] / mu; s1, s2 = np.linalg.norm(g1), np.linalg.norm(g2)
            r1, r2 = g1 / s1, g2 / s2; U, _, Vt = np.linalg.svd(np.stack([r1, r2, np.cross(r1, r2)], 1)); R = U @ Vt  # nearest rotation
            out.update(scale_x=s1 * 100, scale_y=s2 * 100, rotationX=math.degrees(math.atan2(R[2, 1], R[2, 2])),
                       rotationY=math.degrees(math.asin(max(-1, min(1, -R[2, 0])))), rotation=math.degrees(math.atan2(R[1, 0], R[0, 0])), skew=0.0)
    return out

def line_kernel(L, ang):
    """motion-blur kernel: a line L px long at angle ang (radians), centred (the shutter straddles the frame time)"""
    n = int(math.ceil(L)) | 1; n = max(n, 3); k = np.zeros((n, n), np.float32); c = n // 2
    for s_ in np.linspace(-L / 2, L / 2, max(3, int(L * 3))): k[int(round(c + s_ * math.sin(ang))), int(round(c + s_ * math.cos(ang)))] += 1
    return k / k.sum()

SHUTTERS = (.25, .5, .75, 1.0)  # fractions of a frame (90°, 180°, 270°, 360°)

def track(F, fps, S, at, box, t_from=None, t_to=None, model='affine', min_cc=0.55, accept=0.75):
    n = len(F); i0 = int(round(at * fps)); x, y, w, h = [v / S for v in box]; video_wh = (F.shape[2] * S, F.shape[1] * S)
    xi, yi, wi, hi = int(round(x)), int(round(y)), int(round(w)), int(round(h))
    rest = F[i0].astype(np.float32) / 255; crop = rest[yi:yi + hi, xi:xi + wi].copy(); m0, bgT = element_mask(crop)
    # pad the template with its own background so blurred versions and off-screen entries have room
    P = int(max(wi, hi) * .35) + 8; tmpl = cv2.copyMakeBorder(crop, P, P, P, P, cv2.BORDER_CONSTANT, value=bgT); mask = cv2.copyMakeBorder(m0.astype(np.uint8), P, P, P, P, cv2.BORDER_CONSTANT, value=0) > 0
    tmask = np.zeros(tmpl.shape, np.uint8); tmask[P:P + hi, P:P + wi] = 1  # only the real crop counts, never the padding
    th, tw = tmpl.shape; ys, xs = np.nonzero(mask); EX = np.array([[xs.min(), xs.max(), xs.max(), xs.min()], [ys.min(), ys.min(), ys.max(), ys.max()]], np.float64)  # the element's own extent
    lo = max(0, int(math.ceil((t_from if t_from is not None else 0) * fps))); hi_ = min(n - 1, int((t_to if t_to is not None else 1e9) * fps))
    W0 = Tm(xi - P, yi - P); rows = {}; Hf, Wf = F.shape[1:]
    def visible(Wp):
        e = apply(Wp, EX); return max(0., min(Wf, e[0].max()) - max(0, e[0].min())) * max(0., min(Hf, e[1].max()) - max(0, e[1].min())) / max(1e-6, np.ptp(e[0]) * np.ptp(e[1])), e
    for step in (1, -1):
        hist = [W0.copy(), W0.copy()]; misses = 0; i = i0
        while lo <= i <= hi_:
            frame = F[i].astype(np.float32) / 255
            pred = norm(hist[-1] + (hist[-1] - hist[-2])) if i != i0 else W0  # constant-velocity prediction (whips)
            if i != i0 and visible(pred)[0] < .3: break  # heading out of frame
            cc, Wp = ecc(tmpl, frame, pred, tmask, model); used, shutter = tmpl, 0.0
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
            if fast:
                Wh = shift(hist[-1], centre(Wp, tw, th) - centre(hist[-1], tw, th)) if cc >= min_cc * .7 else hist[-1]
                cc, Wp = ecc_translate(tmpl, tmask, frame, Wh)
            if i != i0 and speed > 2:
                vt = np.linalg.inv(jac(Wp, (tw / 2, th / 2))) @ v; L = float(np.hypot(*vt)); ang = math.atan2(vt[1], vt[0])
                for k in SHUTTERS:
                    K = line_kernel(L * k, ang); bt = cv2.filter2D(tmpl, -1, K, borderType=cv2.BORDER_REPLICATE); bm = (cv2.filter2D(tmask.astype(np.float32), -1, K) > .01).astype(np.uint8)
                    if fast:
                        c2, W2 = ecc_translate(bt, bm, frame, Wp)
                        c3, W3 = ecc(bt, frame, W2, bm, model)  # optional small shape refinement
                        if c3 > c2 + .01 and abs(math.log(scale_of(W3, tw, th) / scale_of(W2, tw, th))) < .05: c2, W2 = c3, W3
                    else: c2, W2 = ecc(bt, frame, Wp if cc > min_cc * .7 else pred, bm, model)
                    if c2 > cc + .003: cc, Wp, used, shutter = c2, W2, bt, k * 360  # blur must clearly explain the image better
            # shape is only trustworthy when the whole element is in frame and the shape change is plausible;
            # otherwise keep the last confident shape (scale/rotation/tilt) and take only the position from the match
            vis, ex = visible(Wp); off = ex[0].min() < 0 or ex[1].min() < 0 or ex[0].max() > Wf or ex[1].max() > Hf
            J = jac(Wp, (tw / 2, th / 2)); s_now = scale_of(Wp, tw, th)
            jump = abs(math.log(max(s_now, 1e-3) / max(scale_of(hist[-1], tw, th), 1e-3))) > .3 or (model != '3d' and abs(math.log(abs(np.linalg.det(J)) / max(s_now ** 2, 1e-6))) > .15)
            if (off or (jump and cc < .97)) and i != i0: Wp = shift(hist[-1], centre(Wp, tw, th) - centre(hist[-1], tw, th))
            if os.environ.get('TRACK_DEBUG'): print(i, round(i / fps, 3), 'cc', round(cc, 4), 'shutter', shutter, 'scale', round(s_now, 3), 'off', bool(off), 'jump', bool(jump))
            if vis < .3: break  # it has left the frame
            if cc < accept: misses += 1
            else: misses = 0
            if misses >= 3: break
            if cc >= accept:
                a, sharp = measure(frame, used, mask, bgT, Wp)
                if fast or vis < .98: a = float('nan')  # smeared or cut off: opacity can't be read reliably
                rows[i] = dict(t=round(i / fps, 4), **{k: round(v_, 3) for k, v_ in decompose(Wp, tw, th, S, video_wh, model).items()}, opacity=None if math.isnan(a) else round(a * 100, 2), sharpness=round(sharp, 3), shutter=shutter, visible=round(float(vis), 3), cc=round(cc, 4))
                hist = [hist[-1], Wp]
            i += step
    out = [rows[k] for k in sorted(rows)]
    for key in ('rotation', 'rotationX', 'rotationY'):  # unwrap so a 0→180→270 spin reads as continuous degrees
        if out and key in out[0]:
            r = np.degrees(np.unwrap(np.radians([o[key] for o in out]))); r -= 360 * round(r[[o['t'] for o in out].index(min(out, key=lambda o: abs(o['t'] - at))['t'])] / 360)
            for o, v_ in zip(out, r): o[key] = round(float(v_), 3)
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--name', required=True); ap.add_argument('--at', type=float, required=True)
    ap.add_argument('--box', required=True); ap.add_argument('--out', default='analysis'); ap.add_argument('--from', dest='t_from', type=float); ap.add_argument('--to', dest='t_to', type=float)
    ap.add_argument('--width', type=int, default=960); ap.add_argument('--model', choices=('affine', '3d'), default='affine')
    a = ap.parse_args(); F, fps, S = load(a.video, a.width); box = [float(v) for v in a.box.split(',')]
    rows = track(F, fps, S, a.at, box, a.t_from, a.t_to, a.model); os.makedirs(a.out, exist_ok=True)
    json.dump(dict(name=a.name, video=a.video, fps=fps, model=a.model, width=int(F.shape[2] * S), height=int(F.shape[1] * S), at=a.at, box=box, frames=rows), open(os.path.join(a.out, f'{a.name}.track.json'), 'w'))
    print(f'{a.name}: {len(rows)} frames tracked ({rows[0]["t"] if rows else "-"}–{rows[-1]["t"] if rows else "-"} s)')
