# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Real dashboard cards cut from the original: solid rounded-rectangle alpha (white card on a white background can't be keyed)."""
import subprocess, numpy as np, cv2
def grab(t):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', 'ref/original.mp4', '-frames:v', '1', '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'])
    return np.frombuffer(raw, np.uint8).reshape(1080, 1916, 3)
def card(img, x0, y0, x1, y1, r, name):
    crop = img[y0:y1, x0:x1].copy(); h, w = crop.shape[:2]; a = np.zeros((h, w), np.uint8)
    cv2.rectangle(a, (r, 0), (w - r, h), 255, -1); cv2.rectangle(a, (0, r), (w, h - r), 255, -1)
    for cx, cy in ((r, r), (w - r, r), (r, h - r), (w - r, h - r)): cv2.circle(a, (cx, cy), r, 255, -1, cv2.LINE_AA)
    cv2.imwrite(f'assets/{name}.png', np.dstack([crop, a])); print(name, w, h)
f = grab(8.95)
card(f, 556, 400, 1361, 1001, 22, 'card_white')   # the main "Saas Finance" dashboard, fully visible here
