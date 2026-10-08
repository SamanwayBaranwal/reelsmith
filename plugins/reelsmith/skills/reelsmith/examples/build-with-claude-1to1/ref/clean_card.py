# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Clean card image: align every tracked frame back onto the card (its measured warp), then take the per-pixel median,
so anything passing over it (the arrow) disappears. usage: clean_card.py <track.json> <out.png> [radius]"""
import json, sys, subprocess, numpy as np, cv2
tr = json.load(open(sys.argv[1])); out = sys.argv[2]; rad = int(sys.argv[3]) if len(sys.argv) > 3 else 20
import re as _re
_h = open('helpers.js').read(); _m = _re.search(r'const ARROW = (\[\[.*?\]\]);', _h, _re.S); ARROW = json.loads(_m.group(1)) if _m else []
def arrow_at(t):  # the arrow's measured path (linear between samples is close enough for a mask)
    if not ARROW: return None
    for a_, b_ in zip(ARROW, ARROW[1:]):
        if a_[0] <= t <= b_[0]: p = (t - a_[0]) / (b_[0] - a_[0]); return a_[1] + (b_[1] - a_[1]) * p, a_[2] + (b_[2] - a_[2]) * p
    return None
x, y, w, h = [int(round(v)) for v in tr['box']]; stack = []
f = 2666.67 * 1916 / 1920; K = np.array([[f, 0, 958], [0, f, 540], [0, 0, 1.0]])
for r in tr['frames']:
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', f"{r['t']:.4f}", '-i', 'ref/original.mp4', '-frames:v', '1', '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'])
    fr = np.frombuffer(raw, np.uint8).reshape(1080, 1916, 3)
    # layer (u, v) around the box centre → screen, from the 3D decomposition (z = 0, through the 50mm camera)
    a, b, c = np.radians([r.get('rotationX', 0), r.get('rotationY', 0), r['rotation']]); s1, s2 = r['scale_x'] / 100, r['scale_y'] / 100
    Rx = np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]]); Ry = np.array([[np.cos(b), 0, np.sin(b)], [0, 1, 0], [-np.sin(b), 0, np.cos(b)]]); Rz = np.array([[np.cos(c), -np.sin(c), 0], [np.sin(c), np.cos(c), 0], [0, 0, 1]])
    R = Rz @ Ry @ Rx; Hl = K @ np.c_[R[:, 0] * s1, R[:, 1] * s2, [r['x'] - 958, r['y'] - 540, f]]  # (u, v, 1) → screen
    Hc = Hl @ np.array([[1, 0, -w / 2], [0, 1, -h / 2], [0, 0, 1.0]])  # crop px → screen
    img = cv2.warpPerspective(fr, Hc, (w, h), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP).astype(np.float32)
    ap = arrow_at(r['t'])
    if ap:  # hide the arrow in this frame: its footprint (in screen space) mapped into the card's crop
        m = np.zeros((1080, 1916), np.uint8); cv2.circle(m, (int(ap[0]), int(ap[1])), 115, 1, -1); mm = cv2.warpPerspective(m, Hc, (w, h), flags=cv2.INTER_NEAREST | cv2.WARP_INVERSE_MAP) > 0
        img[mm] = np.nan
    stack.append(img)
S_ = np.array(stack); med = np.nanmedian(S_, axis=0); hole = np.isnan(med[..., 0]); med = np.nan_to_num(med).astype(np.uint8)
if hole.any(): med = cv2.inpaint(med, hole.astype(np.uint8), 7, cv2.INPAINT_TELEA)
a_ = np.zeros((h, w), np.uint8)
cv2.rectangle(a_, (0, 0), (w - rad, h), 255, -1); cv2.rectangle(a_, (0, rad), (w, h - rad), 255, -1)
for cx, cy in ((w - rad, rad), (w - rad, h - rad)): cv2.circle(a_, (cx, cy), rad, 255, -1, cv2.LINE_AA)
cv2.imwrite(out, np.dstack([med, a_])); print(out, w, h, len(stack), 'frames')
