# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Find what to analyse in a video: its shots, a settled moment in each, the objects that animate, which of them are text,
and whether the whole shot has a camera move. Prints the ready-to-run track / text / camera commands.

usage: uv run analyser/discover.py <video> [--out analysis/]
Writes <out>/discover.json and <out>/shot_<n>.jpg (the settled frame with numbered boxes) for a quick look.
It proposes; the agent checks the sheets, drops what doesn't matter and picks --model 3d for tilted cards.
"""
import argparse, json, math, os, sys
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from track import load, probe

def cuts(F):
    """a cut changes most of the picture at once, or replaces its structure (edges stop lining up between two frames) even when
    the brightness barely changes (light shot → light shot); a whip or pop changes only part of it"""
    D = np.abs(np.diff(F.astype(np.int16), axis=0)); frac = np.r_[0, (D > 25).mean(axis=(1, 2))]; d = np.r_[0, D.mean(axis=(1, 2))]
    def edges(f): g = cv2.GaussianBlur(cv2.resize(f, (160, 90), interpolation=cv2.INTER_AREA).astype(np.float32), (0, 0), 1); return cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)).ravel()
    small = [cv2.resize(f, (64, 36), interpolation=cv2.INTER_AREA).astype(np.float32).ravel() for f in F]; E = [edges(f) for f in F]
    corr = lambda a, b: float(np.corrcoef(a, b)[0, 1]) if a.std() > 1e-3 and b.std() > 1e-3 else 1.0
    ec = np.r_[1, [corr(E[i], E[i - 1]) for i in range(1, len(F))]]; ic = np.r_[1, [corr(small[i], small[i - 1]) for i in range(1, len(F))]]
    def explained(i):  # the new frame is just a zoom/pan of the last one (a camera move), or only the middle changed (an object spinning)
        a_, b_ = [cv2.GaussianBlur(cv2.resize(F[j], (160, 90), interpolation=cv2.INTER_AREA).astype(np.float32) / 255, (0, 0), 1.5) for j in (i - 1, i)]
        try: cc, _ = cv2.findTransformECC(a_, b_, np.eye(2, 3, dtype=np.float32), cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 60, 1e-5), None, 3)
        except cv2.error: cc = 0
        ring = np.ones((90, 160), bool); ring[12:-12, 20:-20] = False
        return cc > .85 or float(np.abs(a_ - b_)[ring].mean()) * 255 < 4
    strong = lambda i: frac[i] > .45 and frac[i] > 3 * np.median(frac[max(1, i - 10):i + 10])
    cand = [i for i in range(1, len(F)) if strong(i) or (ec[i] < .25 and ic[i] < .8 and not explained(i))]
    out = [0]
    for i in cand:  # one cut per transition: the first frame where it changes
        if i - out[-1] >= 6: out.append(i)
    return out + [len(F)], d

def camera_moves(F, a, b, rest):
    """does the whole picture zoom/pan relative to the settled frame? (global similarity explains most feature matches)"""
    orb = cv2.ORB_create(1500); bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True); kp0, d0 = orb.detectAndCompute(F[rest], None)
    if d0 is None or len(kp0) < 40: return False, 0
    hits = 0; probes = sorted(set(np.linspace(a, b - 1, 8).astype(int)) - {rest})
    for i in probes:
        kp, d = orb.detectAndCompute(F[i], None)
        if d is None or len(kp) < 40: continue
        m = bf.match(d0, d)
        if len(m) < 30: continue
        M, inl = cv2.estimateAffinePartial2D(np.float32([kp0[x.queryIdx].pt for x in m]), np.float32([kp[x.trainIdx].pt for x in m]), method=cv2.RANSAC, ransacReprojThreshold=2)
        if M is None or inl.mean() < .5: continue
        s = math.sqrt(abs(np.linalg.det(M[:, :2])))
        if abs(s - 1) > .03 or np.hypot(*M[:, 2]) > 3: hits += 1
    return hits >= 2, hits

def objects(img):
    """boxes of distinct things in a settled frame: anything that differs from its local background or has a clear edge,
    grouped, outer outlines only"""
    g = cv2.GaussianBlur(img, (0, 0), 1).astype(np.float32); mag = cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
    bg = cv2.medianBlur(img, 31).astype(np.float32); fg = (np.abs(img.astype(np.float32) - bg) > 18) | (mag > 60)
    e = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)); e = cv2.dilate(e, np.ones((3, 3), np.uint8))
    cs, _ = cv2.findContours(e, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); H, W = img.shape; out = []
    for c in cs:
        x, y, w, h = cv2.boundingRect(c)
        if w * h < .0015 * W * H or w * h > .7 * W * H or min(w, h) < 6: continue
        out.append([x, y, w, h])
    return out

def iou(a, b):
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    i = max(0, x1 - x0) * max(0, y1 - y0); return i / max(a[2] * a[3] + b[2] * b[3] - i, 1)

def textiness(img, box):
    """many small blobs of similar height sitting on a line = text"""
    x, y, w, h = box; c = img[y:y + h, x:x + w].astype(np.float32); bg = np.median(np.r_[c[0], c[-1], c[:, 0], c[:, -1]])
    m = (np.abs(c - bg) > 40).astype(np.uint8); n, _, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    bl = [s for s in st[1:] if s[4] >= 4 and s[3] < .9 * h]
    if len(bl) < 4: return False
    hs = np.array([s[3] for s in bl]); return np.std(hs) / max(np.mean(hs), 1) < .6 and len(bl) / max(w / max(np.median(hs), 1), 1) > .3

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--out', default='analysis'); a = ap.parse_args()
    F, fps, S = load(a.video, 480); C, d = cuts(F); os.makedirs(a.out, exist_ok=True); shots = []; cmds = []
    col = cv2.cvtColor  # noqa
    for k in range(len(C) - 1):
        s0, s1 = C[k], C[k + 1]
        if s1 - s0 < 6: continue
        en = np.r_[d[s0 + 1:s1], d[s1 - 1]] if s1 - s0 > 1 else np.zeros(1); sm = np.convolve(en, np.ones(5) / 5, mode='same')
        lo = s0 + int((s1 - s0) * .4); rest = lo + int(np.argmin(sm[lo - s0:]))  # settled moment, late in the shot
        cam, _ = camera_moves(F, s0, s1, rest); objs = []
        # elements come and go: look at every settled moment (quiet stretches), keep each object once, at the moment it is biggest and calmest
        quiet = [s0 + i for i in range(2, len(sm) - 2) if sm[i] <= sm[i - 2:i + 3].min() + 1e-6 and sm[i] < max(2.0, np.percentile(sm, 40))] or [rest]
        for q in sorted(set(quiet + [rest])):
            for b in objects(F[q]):
                x, y, w, h = b; act = max(float(np.abs(F[i, y:y + h, x:x + w].astype(np.int16) - F[q, y:y + h, x:x + w]).mean()) for i in range(s0, s1))
                if act < 6: continue  # never changes: background, not an element
                o = dict(box=[round(v * S) for v in b], box_a=b, at=round(q / fps, 3), activity=round(act, 1), text=bool(textiness(F[q], b)))
                j = next((j for j, p in enumerate(objs) if iou(p['box_a'], b) > .3), None)
                if j is None: objs.append(o)
                elif w * h > objs[j]['box_a'][2] * objs[j]['box_a'][3] * 1.1: objs[j] = o
        if cam: objs = []  # everything rides with the camera here: track the camera (moving elements on top can be added by hand)
        t0, t1, tr = s0 / fps, s1 / fps, rest / fps
        shot = dict(shot=len(shots) + 1, start=round(t0, 3), end=round(t1, 3), rest=round(tr, 3), camera=cam, objects=objs); shots.append(shot)
        sheet = cv2.cvtColor(F[rest], cv2.COLOR_GRAY2BGR)
        for j, o in enumerate(objs):
            x, y, w, h = o['box_a']; c_ = (0, 200, 255) if o['text'] else (80, 255, 80)
            cv2.rectangle(sheet, (x, y), (x + w, y + h), c_, 1); cv2.putText(sheet, str(j + 1), (x + 2, y + 12), cv2.FONT_HERSHEY_SIMPLEX, .4, c_, 1)
        cv2.imwrite(os.path.join(a.out, f'shot_{shot["shot"]}.jpg'), sheet)
        if cam: cmds.append(f'uv run analyser/camera.py {a.video} --at {tr:.2f} --from {t0:.2f} --to {t1:.2f} --name camera{shot["shot"]}')
        for j, o in enumerate(objs):
            bx = ','.join(map(str, o['box'])); nm = f's{shot["shot"]}_{"text" if o["text"] else "el"}{j + 1}'
            cmds.append(f'uv run analyser/{"text" if o["text"] else "track"}.py {a.video} --name {nm} --at {o["at"]:.2f} --box {bx} --from {t0:.2f} --to {t1:.2f}')
    for sh in shots:
        for o in sh['objects']: o.pop('box_a', None)
    json.dump(dict(video=a.video, fps=fps, shots=shots), open(os.path.join(a.out, 'discover.json'), 'w'), indent=1)
    for s in shots: print(f"shot {s['shot']}: {s['start']:.2f}–{s['end']:.2f} s, settled at {s['rest']:.2f} s{', camera moves' if s['camera'] else ''}, {len(s['objects'])} animated objects ({sum(o['text'] for o in s['objects'])} text)")
    print('\n'.join(['', 'next:'] + cmds))
