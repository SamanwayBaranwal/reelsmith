# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Track the 2D camera of a shot: zoom, pan and rotation of the whole picture.

usage: uv run analyser/camera.py <video> --at 4.3 --from 3.06 --to 6.94 [--name camera] [--out analysis/]

--at: the reference moment, where the camera is "home" (the comp at 100%); --from/--to: the shot (between two cuts).
Every frame is registered to the reference with ORB features + RANSAC (things that move on their own are outliers),
then refined with ECC on the whole frame. Fast zooms that smear the features fall back to the predicted transform refined
on blurred images. Writes <name>.track.json in the same format as track.py (x, y = where the reference frame's centre lands,
scale %, rotation °), so fit.py turns it into camera keyframes; "kind": "camera" tells rebuild.py it moves the whole comp.
"""
import argparse, json, math, os
import numpy as np, cv2
from track import load, Tm, apply, jac

CRIT = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 60, 1e-5)
ORB = cv2.ORB_create(4000, scaleFactor=1.2, nlevels=10, fastThreshold=7)
BF = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

def features(img8): return ORB.detectAndCompute(img8, None)

def by_features(ref_kp, ref_des, img8):
    kp, des = features(img8)
    if des is None or ref_des is None or len(kp) < 12: return None, 0
    m = BF.match(ref_des, des)
    if len(m) < 12: return None, 0
    src = np.float32([ref_kp[x.queryIdx].pt for x in m]); dst = np.float32([kp[x.trainIdx].pt for x in m])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0, maxIters=4000, confidence=.999)
    if M is None: return None, 0
    return np.vstack([M, [0, 0, 1]]).astype(np.float64), int(inl.sum())

def refine(ref, img, M, blur=0):
    a, b = (cv2.GaussianBlur(ref, (0, 0), blur), cv2.GaussianBlur(img, (0, 0), blur)) if blur else (ref, img)
    try: cc, W = cv2.findTransformECC(a, b, M[:2].astype(np.float32), cv2.MOTION_AFFINE, CRIT, None, 5)
    except cv2.error: return -1, M
    return float(cc), np.vstack([W, [0, 0, 1]]).astype(np.float64)

def similarity(M):
    """nearest zoom + rotation + pan (cameras don't shear)"""
    A = M[:2, :2]; s = math.sqrt(abs(np.linalg.det(A))); th = math.atan2(A[1, 0] - A[0, 1], A[0, 0] + A[1, 1])
    out = np.eye(3); out[:2, :2] = s * np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]]); out[:2, 2] = M[:2, 2]; return out

def camera(F, fps, S, at, t_from, t_to):
    n = len(F); lo, hi = max(0, int(math.ceil(t_from * fps))), min(n - 1, int(round(t_to * fps)) - 1); i0 = min(max(int(round(at * fps)), lo), hi)  # reference inside the shot
    ref8 = F[i0]; ref = ref8.astype(np.float32) / 255; kp0, des0 = features(ref8); H, W = ref.shape; c = np.array([[W / 2], [H / 2]])
    rows = {}
    for step in (1, -1):
        hist = [np.eye(3), np.eye(3)]; i = i0
        while lo <= i <= hi:
            img = F[i].astype(np.float32) / 255; pred = hist[-1] @ np.linalg.inv(hist[-2]) @ hist[-1] if i != i0 else np.eye(3)
            M, inl = by_features(kp0, des0, F[i]) if i != i0 else (np.eye(3), 999)
            cands = [(M, 'features')] if M is not None and inl >= 25 else []
            cands.append((pred, 'predicted'))
            best = (-2, None, None)
            for M0, src in cands:
                for blur in (0, 3):  # blurred pass widens the basin on smeared zoom frames
                    cc, Mr = refine(ref, img, similarity(M0), blur)
                    if blur: cc2, Mr2 = refine(ref, img, similarity(Mr)); cc, Mr = (cc2, Mr2) if cc2 > 0 else (cc, Mr)
                    if cc > best[0]: best = (cc, similarity(Mr), src)
            cc, Mb, src = best
            if cc < .5: break  # lost the shot (cut, or the picture changed completely)
            p = apply(Mb, c)[:, 0]; J = jac(Mb, (W / 2, H / 2)); s = math.hypot(J[0, 0], J[1, 0])
            rows[i] = dict(t=round(i / fps, 4), x=round(p[0] * S, 3), y=round(p[1] * S, 3), scale_x=round(s * 100, 3), scale_y=round(s * 100, 3),
                           rotation=round(math.degrees(math.atan2(J[1, 0], J[0, 0])), 3), skew=0.0, opacity=None, sharpness=1.0, shutter=0.0, visible=1.0, cc=round(cc, 4), source=src)
            hist = [hist[-1], Mb]; i += step
    return [rows[k] for k in sorted(rows)]

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--at', type=float, required=True); ap.add_argument('--from', dest='t_from', type=float, required=True)
    ap.add_argument('--to', dest='t_to', type=float, required=True); ap.add_argument('--name', default='camera'); ap.add_argument('--out', default='analysis'); ap.add_argument('--width', type=int, default=960)
    a = ap.parse_args(); F, fps, S = load(a.video, a.width); rows = camera(F, fps, S, a.at, a.t_from, a.t_to); os.makedirs(a.out, exist_ok=True)
    W, H = F.shape[2] * S, F.shape[1] * S
    json.dump(dict(name=a.name, kind='camera', video=a.video, fps=fps, model='affine', width=int(W), height=int(H), at=a.at, box=[0, 0, W, H], frames=rows), open(os.path.join(a.out, f'{a.name}.track.json'), 'w'))
    print(f'{a.name}: {len(rows)} frames ({rows[0]["t"]}–{rows[-1]["t"]} s), zoom {min(r["scale_x"] for r in rows):.0f}–{max(r["scale_x"] for r in rows):.0f}%' if rows else f'{a.name}: could not lock onto the shot')
