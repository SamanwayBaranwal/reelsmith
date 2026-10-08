# /// script
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Rebuild a video from its analysis, then score the rebuild against the original.

usage: uv run analyser/rebuild.py <video> analysis/ [--out analysis/rebuild]

1. clean plate: per-pixel median of the frames where no tracked element covers that pixel (inpainted where never seen)
2. cutouts: each element cut out of its rest frame (RGBA) at full resolution
3. comp.js: plate + one image layer per element, animated with the fitted keyframes (and motion blur if measured)
The folder is a ready motion-engine project: `node reel.mjs make` renders it; score.py compares it with the original.
"""
import argparse, glob, json, math, os, subprocess
import numpy as np, cv2

ENGINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def frames_rgb(path, w):
    s = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', path]))['streams'][0]
    W, H = s['width'], s['height']; h = round(H * w / W / 2) * 2
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}:flags=area', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
    n, d = s['r_frame_rate'].split('/'); return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3), W, H, float(n) / float(d)

def grab(path, t):
    s = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path]))['streams'][0]
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', f'{t:.4f}', '-i', path, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
    return np.frombuffer(raw, np.uint8).reshape(s['height'], s['width'], 3)

def poly(r, box, k=1.0):
    """element box corners in video px at a tracked frame"""
    w, h = box[2] / 2 * k, box[3] / 2 * k; a = math.radians(r['rotation']); sx, sy = r['scale_x'] / 100, r['scale_y'] / 100
    pts = [(-w, -h), (w, -h), (w, h), (-w, h)]
    return np.array([[r['x'] + math.cos(a) * x * sx - math.sin(a) * y * sy, r['y'] + math.sin(a) * x * sx + math.cos(a) * y * sy] for x, y in pts])

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('analysis'); ap.add_argument('--out'); a = ap.parse_args()
    out = a.out or os.path.join(a.analysis, 'rebuild'); os.makedirs(os.path.join(out, 'cutouts'), exist_ok=True)
    tracks = {json.load(open(f))['name']: json.load(open(f)) for f in glob.glob(os.path.join(a.analysis, '*.track.json'))}
    fits = {json.load(open(f))['name']: json.load(open(f)) for f in glob.glob(os.path.join(a.analysis, '*.fit.json'))}
    PW = 960; F, W, H, fps = frames_rgb(a.video, PW); k = PW / W
    # 1. clean plate (half resolution is plenty for a background; upscaled)
    acc = []; cov = np.zeros((len(F),) + F.shape[1:3], bool)
    for name, tr in tracks.items():
        for r in tr['frames']:
            i = int(round(r['t'] * fps))
            if i < len(F): cv2.fillPoly(cov[i].view(np.uint8), [np.round(poly(r, tr['box'], 1.15) * k).astype(np.int32)], 1)
    for name, tr in tracks.items():  # frames where the fit says it exists but tracking couldn't see it (tiny / faint / off-screen): cover its rest box
        t0, t1 = tr['frames'][0]['t'], tr['frames'][-1]['t']; ms = fits.get(name, {}).get('moves', {})
        e0 = min([t0] + [m['th'][0] for v in ms.values() for m in v]); e1 = max([t1] + [m['th'][1] for v in ms.values() for m in v if m['open']['end']])
        r = min(tr['frames'], key=lambda r: abs(r['t'] - tr['at']))
        for i in range(len(F)):
            if e0 - 2 / fps <= i / fps < t0 or t1 < i / fps <= e1 + 2 / fps: cv2.fillPoly(cov[i].view(np.uint8), [np.round(poly(r, tr['box'], 1.3) * k).astype(np.int32)], 1)
    Fm = np.where(cov[..., None], np.nan, F.astype(np.float32)); plate = np.nanmedian(Fm, axis=0)
    hole = np.isnan(plate[..., 0]); plate = np.nan_to_num(plate).astype(np.uint8)
    if hole.any(): plate = cv2.inpaint(plate, hole.astype(np.uint8), 9, cv2.INPAINT_TELEA)
    plate = cv2.resize(plate, (W, H), interpolation=cv2.INTER_CUBIC); cv2.imwrite(os.path.join(out, 'plate.png'), cv2.cvtColor(plate, cv2.COLOR_RGB2BGR))
    # 2. cutouts from each element's rest frame, alpha from its difference to the plate
    layers = []
    for name, tr in tracks.items():
        x, y, w, h = [int(round(v)) for v in tr['box']]; rest = grab(a.video, tr['at']).astype(np.float32)
        crop = rest[y:y + h, x:x + w]; bg = plate[y:y + h, x:x + w].astype(np.float32)
        d = np.linalg.norm(crop - bg, axis=2); alpha = np.clip(d / 40.0, 0, 1)
        solid = cv2.morphologyEx((alpha > .5).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)); alpha = np.maximum(alpha, cv2.erode(solid, np.ones((3, 3), np.uint8)).astype(np.float32))
        rgba = np.dstack([crop, alpha * 255]).clip(0, 255).astype(np.uint8); cv2.imwrite(os.path.join(out, 'cutouts', f'{name}.png'), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
        f = fits.get(name, {}); L = dict(name=name, type='image', src=f'cutouts/{name}.png', size=[w, h], **f.get('layer', {}))
        L.setdefault('position', [round(tr['frames'][0]['x'], 1), round(tr['frames'][0]['y'], 1)])
        moves = f.get('moves', {}); starts = [m['th'][0] for ms in moves.values() for m in ms]; ends = [m['th'][1] for ms in moves.values() for m in ms if m['open']['end']]
        L['in'] = round(min([tr['frames'][0]['t']] + starts), 3); L['out'] = round(max([tr['frames'][-1]['t'] + 1 / fps] + ends), 3)
        if f.get('motion_blur'): L['motionBlur'] = {'shutter': round(f['motion_blur']['shutter'])}
        layers.append(L)
    comp = dict(background='#000', layers=[dict(name='plate', type='image', src='plate.png', size=[W, H])] + [], motionBlurSamples=16)
    comp['layers'] = layers + comp['layers']  # elements above the plate (top first)
    open(os.path.join(out, 'comp.js'), 'w').write('// written by analyser/rebuild.py from the fitted keyframes\nconst COMP = ' + json.dumps(comp, indent=1) + ';\n')
    dur = len(F) / fps
    json.dump(dict(title='rebuild', width=W, height=H, fps=fps, duration=round(dur, 3), reference=os.path.relpath(os.path.abspath(a.video), os.path.abspath(out)), audio=None, output='out/rebuild.mp4'), open(os.path.join(out, 'project.json'), 'w'))
    for f in ('reel.html', 'engine.js', 'motion.js', 'logos.js', 'node_modules'):
        dst = os.path.join(out, f)
        if not os.path.lexists(dst): os.symlink(os.path.relpath(os.path.join(ENGINE, f), out), dst)
    import shutil; shutil.copy(os.path.join(ENGINE, 'reel.mjs'), out)
    print(f'{out}: plate + {len(layers)} cutout layers → node reel.mjs make, then analyser/score.py')
