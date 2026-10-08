# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
import json, subprocess, numpy as np, cv2
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', '8.95', '-i', 'ref/original.mp4', '-frames:v', '1', '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'])
fr = np.frombuffer(raw, np.uint8).reshape(1080, 1916, 3); x, y, w, h = 0, 140, 690, 140
cv2.imwrite('assets/card_blue.png', np.dstack([fr[y:y + h, x:x + w], np.full((h, w), 255, np.uint8)]))
def arrival(tr, t0, sgn, size):
    """the side-card swoop (fast out, glide in) ending on the first tracked pose, then the raw track"""
    r0 = tr['frames'][0]; keys = {k: [] for k in ('position', 'scale', 'rotation', 'rotationX', 'rotationY')}; t = t0
    while t < r0['t'] - 1e-6:
        u = min(1, (t - t0) / max(r0['t'] - t0, 1e-3)); q = (1 - u) ** 3
        keys['position'].append([round(t, 4), [round(r0['x'] + sgn * q * 1100, 1), round(r0['y'] + q * 120, 1)], 'linear'])
        keys['scale'].append([round(t, 4), [r0['scale_x'], r0['scale_y']], 'linear'])
        keys['rotation'].append([round(t, 4), round(r0['rotation'] + q * 17 * sgn, 2), 'linear'])
        keys['rotationX'].append([round(t, 4), round(r0.get('rotationX', 0) + q * 23, 2), 'linear'])
        keys['rotationY'].append([round(t, 4), round(r0.get('rotationY', 0) + sgn * q * 63, 2), 'linear']); t += 1 / 30
    for r in tr['frames']:
        keys['position'].append([r['t'], [round(r['x'], 1), round(r['y'], 1)], 'linear']); keys['scale'].append([r['t'], [round(r['scale_x'], 2), round(r['scale_y'], 2)], 'linear'])
        keys['rotation'].append([r['t'], round(r['rotation'], 2), 'linear']); keys['rotationX'].append([r['t'], round(r.get('rotationX', 0), 2), 'linear']); keys['rotationY'].append([r['t'], round(r.get('rotationY', 0), 2), 'linear'])
    return dict(type='image', size=size, threeD=True, motionBlur={'shutter': 180}, **keys, **{'in': round(t0, 3)})
P = json.load(open('ref/an/purple.track.json')); B = json.load(open('ref/an/blue.track.json'))
purple = dict(name='purple', src='assets/card_purple.png', **arrival(P, 8.47, 1, [440, 755])); blue = dict(name='blue', src='assets/card_blue.png', **arrival(B, 8.25, -1, [690, 140]))
s = open('comp.js').read()
def span(s, name, frm):
    k = s.index(f'"name": "{name}"', frm); a = s.rindex('{', 0, k); d = 0
    for e in range(a, len(s)):
        d += s[e] == '{'; d -= s[e] == '}'
        if d == 0: return a, e + 1
i = s.index('"name": "shot4",'); ga, gb = span(s, 'green', i)
s = s[:ga] + json.dumps(purple) + ',\n  ' + s[ga:gb] + ',\n  ' + json.dumps(blue) + s[gb:]
open('comp.js', 'w').write(s); print('added purple + blue')
