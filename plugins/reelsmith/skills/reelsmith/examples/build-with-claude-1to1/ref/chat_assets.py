# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
import json, numpy as np, cv2
W545 = cv2.imread('ref/world_5.45.png', cv2.IMREAD_UNCHANGED); W62 = cv2.imread('ref/world_6.20.png', cv2.IMREAD_UNCHANGED)
x0, y0, x1, y1 = 318, 522, 725, 582; t = W545[y0:y1, x0:x1].copy(); t[..., 3] = 255; cv2.imwrite('assets/typed.png', t)
box = [int(v) for v in np.median(W545[592:610, 340:700, :3].reshape(-1, 3), 0)]
b0, c0, b1, c1 = 1498, 628, 1592, 718; b = W62[c0:c1, b0:b1].copy(); b[..., 3] = 255; cv2.imwrite('assets/sendbtn.png', b)
btn = [int(v) for v in np.median(W62[648:660, 1518:1530, :3].reshape(-1, 3), 0)]
json.dump(dict(box_bgr=box, btn_bgr=btn, typed=[x0, y0, x1, y1], send=[b0, c0, b1, c1]), open('ref/chat_assets.json', 'w')); print('box', box[::-1], 'button', btn[::-1])
