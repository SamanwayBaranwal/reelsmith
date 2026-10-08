# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Un-zoom original frames of the chat shot back into the chat's flat layout (the camera's reference frame at 4.3 s),
using the measured camera, so later states (typed prompt, send button) become assets in the same coordinates as the plate."""
import json, math, subprocess, sys, numpy as np, cv2
cam = json.load(open('../../motion-engine/tests/claude/analysis_full/camera3.track.json'))['frames']
def world(t):
    r = min(cam, key=lambda r: abs(r['t'] - t)); s = r['scale_x'] / 100; a = math.radians(r['rotation']); c = np.array([958, 540])
    A = s * np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]); M = np.hstack([A, (np.array([r['x'], r['y']]) - A @ c)[:, None]]).astype(np.float32)
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', f"{r['t']:.4f}", '-i', 'ref/original.mp4', '-frames:v', '1', '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'])
    fr = np.frombuffer(raw, np.uint8).reshape(1080, 1916, 3)
    w = cv2.warpAffine(fr, M, (1916, 1080), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=(0, 0, 0))
    valid = cv2.warpAffine(np.full((1080, 1916), 255, np.uint8), M, (1916, 1080), flags=cv2.INTER_NEAREST | cv2.WARP_INVERSE_MAP); return r['t'], s, w, valid
for t in map(float, sys.argv[1:]):
    tt, s, w, v = world(t); cv2.imwrite(f'ref/world_{t:.2f}.png', np.dstack([w, v])); print(f'world at {tt} (zoom {s * 100:.0f}%) → ref/world_{t:.2f}.png')
    hsv = cv2.cvtColor(w, cv2.COLOR_BGR2HSV); m = ((hsv[..., 0] < 20) & (hsv[..., 1] > 120) & (hsv[..., 2] > 150) & (v > 0)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    big = [list(st[i][:4]) for i in range(1, n) if st[i][4] > 150 and abs(st[i][2] - st[i][3]) < .4 * max(st[i][2], st[i][3])]
    print('  orange squares (send button candidates, world px):', big)
