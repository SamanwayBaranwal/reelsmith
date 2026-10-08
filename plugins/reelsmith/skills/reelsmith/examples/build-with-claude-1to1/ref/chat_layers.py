# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
import json, numpy as np, cv2
A = json.load(open('ref/chat_assets.json')); b0, c0, b1, c1 = A['send']
img = cv2.imread('assets/sendbtn.png', cv2.IMREAD_UNCHANGED); h, w = img.shape[:2]; m = np.zeros((h, w), np.uint8)
bx0, by0, bx1, by1, r = 1511 - b0, 641 - c0, 1576 - b0, 704 - c0, 14  # the button itself, rounded
cv2.rectangle(m, (bx0 + r, by0), (bx1 - r, by1), 255, -1); cv2.rectangle(m, (bx0, by0 + r), (bx1, by1 - r), 255, -1)
for cx, cy in ((bx0 + r, by0 + r), (bx1 - r, by0 + r), (bx0 + r, by1 - r), (bx1 - r, by1 - r)): cv2.circle(m, (cx, cy), r, 255, -1, cv2.LINE_AA)
img[..., 3] = m; cv2.imwrite('assets/sendbtn.png', img)
box = 'rgb(%d,%d,%d)' % tuple(A['box_bgr'][::-1]); btn = 'rgb(%d,%d,%d)' % tuple(A['btn_bgr'][::-1]); x0, y0, x1, y1 = A['typed']
cxs, cys = (1511 + 1576) / 2, (641 + 704) / 2; n = len('Build a finance SaaS'); t0, t1 = 4.55, 5.36
matte = [[t0 - .001, [0, 60]]] + [[round(t0 + i * (t1 - t0) / n, 3), [10 + (i + 1) / n * 300, 60], 'hold'] for i in range(n)]
L = [
 {"name": "arrowGlyph", "type": "custom", "in": 6.68, "draw": "@@glyph@@"},
 {"name": "btnPlain", "type": "rect", "in": 6.68, "position": [cxs, cys], "size": [65, 63], "radius": 14, "fill": btn},
 {"name": "sendBtn", "type": "image", "src": "assets/sendbtn.png", "size": [b1 - b0, c1 - c0], "position": [(b0 + b1) / 2, (c0 + c1) / 2], "in": 5.8,
  "scale": [[5.8, [0, 0]], [5.95, [100, 100], "back"], [6.5, [100, 100]], [6.6, [90, 90], "out"], [6.72, [100, 100], "out"]],
  "effects": [{"type": "glow", "radius": 18, "intensity": [[6.25, 0], [6.45, 1.2, "smooth"], [6.62, .3, "out"]], "color": "#FF9A66"},
              {"type": "tint", "color": "#F6C2A6", "amount": [[6.5, 0], [6.6, .75, "out"], [6.72, 0, "out"]]}]},
 {"name": "dim", "type": "solid", "color": "#000000", "position": [958, 540], "size": [4000, 3000], "opacity": [[6.42, 0], [6.66, 55, "smooth"]]},
 {"name": "sendBg", "type": "rect", "in": 5.8, "position": [cxs + 4, cys], "size": [78, 66], "fill": box},
 {"name": "typedMatte", "type": "rect", "pivot": [0, .5], "position": [x0, (y0 + y1) / 2], "size": matte, "fill": "#fff"},
 {"name": "typed", "type": "image", "src": "assets/typed.png", "size": [x1 - x0, y1 - y0], "position": [(x0 + x1) / 2, (y0 + y1) / 2], "in": t0, "matte": {"layer": "typedMatte"}},
 {"name": "blankBox", "type": "rect", "in": t0, "position": [(x0 + x1) / 2, (y0 + y1) / 2], "size": [x1 - x0, y1 - y0], "fill": box},
]
glyph = "(c, t) => { const y = seg(t, [[6.68, 0], [6.97, -150, 'in']]); c.save(); c.translate(%.1f, %.1f + y); c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(0, 16); c.lineTo(0, -16); c.moveTo(-13, -3); c.lineTo(0, -16); c.lineTo(13, -3); c.stroke(); c.restore(); }" % (cxs, cys)
s = open('comp.js').read(); i = s.index('"name": "shot3",'); k = s.index('"name": "flash"', i); a = s.rindex('{', 0, k); d = 0
for e in range(a, len(s)):
    d += s[e] == '{'; d -= s[e] == '}'
    if d == 0: break
ins = ',\n  ' + ',\n  '.join(json.dumps(l) for l in L)
s = s[:e + 1] + ins.replace('"@@glyph@@"', glyph) + s[e + 1:]
open('comp.js', 'w').write(s); print('chat layers added')
