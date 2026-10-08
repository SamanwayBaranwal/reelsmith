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
import argparse, glob, json, math, os, subprocess, sys
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

def plate_for(F, fps, i0, i1, k, covers):
    """per-pixel median of this shot's frames wherever no element covers the pixel (inpainted where never seen)"""
    cov = np.zeros((i1 - i0,) + F.shape[1:3], np.uint8)
    for i, poly_ in covers:
        if i0 <= i < i1: cv2.fillPoly(cov[i - i0], [np.round(poly_ * k).astype(np.int32)], 1)
    Fm = np.where(cov[..., None] > 0, np.nan, F[i0:i1].astype(np.float32)); plate = np.nanmedian(Fm, axis=0)
    hole = np.isnan(plate[..., 0]); plate = np.nan_to_num(plate).astype(np.uint8)
    return cv2.inpaint(plate, hole.astype(np.uint8), 9, cv2.INPAINT_TELEA) if hole.any() else plate

def cutout(out, name, rest, plate_full, box, own=None):
    x, y, w, h = [int(round(v)) for v in box]; H, W = rest.shape[:2]
    crop = np.zeros((h, w, 3), np.float32); bg = np.zeros_like(crop); sx0, sy0, sx1, sy1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    crop[sy0 - y:sy1 - y, sx0 - x:sx1 - x] = rest[sy0:sy1, sx0:sx1]; bg[sy0 - y:sy1 - y, sx0 - x:sx1 - x] = plate_full[sy0:sy1, sx0:sx1]
    alpha = np.clip(np.linalg.norm(crop - bg, axis=2) / 40.0, 0, 1)
    solid = cv2.morphologyEx((alpha > .5).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)); alpha = np.maximum(alpha, cv2.erode(solid, np.ones((3, 3), np.uint8)).astype(np.float32))
    if own is not None: alpha *= cv2.dilate(own.astype(np.uint8), np.ones((5, 5), np.uint8))[:h, :w]  # only this letter, not its neighbours
    cv2.imwrite(os.path.join(out, 'cutouts', f'{name}.png'), cv2.cvtColor(np.dstack([crop, alpha * 255]).clip(0, 255).astype(np.uint8), cv2.COLOR_RGBA2BGRA))
    return f'cutouts/{name}.png', [w, h]

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('analysis'); ap.add_argument('--out'); a = ap.parse_args()
    out = a.out or os.path.join(a.analysis, 'rebuild'); os.makedirs(os.path.join(out, 'cutouts'), exist_ok=True)
    tracks = {json.load(open(f))['name']: json.load(open(f)) for f in glob.glob(os.path.join(a.analysis, '*.track.json'))}
    fits = {json.load(open(f))['name']: json.load(open(f)) for f in glob.glob(os.path.join(a.analysis, '*.fit.json'))}
    texts = {json.load(open(f))['name']: json.load(open(f)) for f in glob.glob(os.path.join(a.analysis, '*.text.json'))}
    PW = 960; F, W, H, fps = frames_rgb(a.video, PW); k = PW / W; dur = len(F) / fps
    disc = next((p for p in (os.path.join(a.analysis, 'discover.json'), os.path.join(a.analysis, 'discover', 'discover.json')) if os.path.exists(p)), None)
    shots = [(s['start'], s['end']) for s in json.load(open(disc))['shots']] if disc else [(0, dur)]
    where = lambda t: next((j for j, (s0, s1) in enumerate(shots) if s0 <= t < s1), len(shots) - 1)
    groups = []; n_layers = 0
    for j, (s0, s1) in enumerate(shots):
        i0, i1 = int(round(s0 * fps)), min(len(F), int(round(s1 * fps)))
        T_ = {n: tr for n, tr in tracks.items() if where(tr['at']) == j}; X_ = {n: tx for n, tx in texts.items() if where(tx['at']) == j}
        cam = next((n for n, tr in T_.items() if tr.get('kind') == 'camera'), None)
        h_ = .5 / fps  # shot edges sit between frames, never on one
        G = dict(name=f'shot{j + 1}', type='group', **({'in': round(s0 - h_, 4)} if j else {}), **({'out': round(s1 - h_, 4)} if j < len(shots) - 1 else {}), position=[0, 0], layers=[])
        if cam:  # the reference frame is the world; the group is the camera flying over it (looking at the fitted point of interest)
            tr = T_[cam]; f = fits.get(cam, {}).get('layer', {}); ref = grab(a.video, tr['at'])
            cv2.imwrite(os.path.join(out, f'plate{j + 1}.png'), cv2.cvtColor(ref, cv2.COLOR_RGB2BGR))
            G.update(anchor=f.get('anchor', [W / 2, H / 2]), position=[W / 2, H / 2], scale=f.get('scale', 100), rotation=f.get('rotation', 0))
            G['layers'].append(dict(name=f'plate{j + 1}', type='image', src=f'plate{j + 1}.png', size=[W, H], position=[W / 2, H / 2])); groups.append(G); continue
        covers = []
        for name, tr in T_.items():
            for r in tr['frames']: covers.append((int(round(r['t'] * fps)), poly(r, tr['box'], 1.15)))
            t0, t1 = tr['frames'][0]['t'], tr['frames'][-1]['t']; ms = fits.get(name, {}).get('moves', {}); r = min(tr['frames'], key=lambda r: abs(r['t'] - tr['at']))
            e0 = min([t0] + [m['th'][0] for v in ms.values() for m in v]); e1 = max([t1] + [m['th'][1] for v in ms.values() for m in v if m['open']['end']])
            covers += [(i, poly(r, tr['box'], 1.3)) for i in range(i0, i1) if e0 - 2 / fps <= i / fps < t0 or t1 < i / fps <= e1 + 2 / fps]
        for name, tx in X_.items():  # text: cover its whole box (grown by how far letters travel) from the first letter on
            fr = tx['animator'].get('from', {}); m_ = max(abs(fr.get('x', 0)), abs(fr.get('y', 0))) + 10; x, y, w, h = tx['box']
            pl = np.array([[x - m_, y - m_], [x + w + m_, y - m_], [x + w + m_, y + h + m_], [x - m_, y + h + m_]], float)
            covers += [(i, pl) for i in range(max(i0, int(tx['animator']['start'] * fps) - 2), i1)]
        plate = plate_for(F, fps, i0, i1, k, covers); plate_full = cv2.resize(plate, (W, H), interpolation=cv2.INTER_CUBIC)
        cv2.imwrite(os.path.join(out, f'plate{j + 1}.png'), cv2.cvtColor(plate_full, cv2.COLOR_RGB2BGR)); plate_full = plate_full.astype(np.float32)
        for name, tr in T_.items():
            src, size = cutout(out, name, grab(a.video, tr['at']).astype(np.float32), plate_full, tr['box'])
            f = fits.get(name, {}); L = dict(name=name, type='image', src=src, size=size, **f.get('layer', {}))
            L.setdefault('position', [round(tr['frames'][0]['x'], 1), round(tr['frames'][0]['y'], 1)])
            moves = f.get('moves', {}); starts = [m['th'][0] for ms in moves.values() for m in ms]; ends = [m['th'][1] for ms in moves.values() for m in ms if m['open']['end']]
            L['in'] = round(max(s0, min([tr['frames'][0]['t']] + starts)), 3); L['out'] = round(min(s1, max([tr['frames'][-1]['t'] + 1 / fps] + ends)), 3)
            if f.get('motion_blur'): L['motionBlur'] = {'shutter': round(f['motion_blur']['shutter'])}
            if f.get('threeD'): L['threeD'] = True
            G['layers'].append(L)
        for name, tx in X_.items():  # one cutout per letter/word, animated with the measured animator pattern
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from text import units
            restg = cv2.cvtColor(grab(a.video, tx['at']), cv2.COLOR_RGB2GRAY); U, MS, IX, _ = units(restg, tx['box'], tx['animator']['by'])
            A = tx['animator']; fr = A.get('from', {}); n = IX[-1] + 1 if IX else 1; meas = {u['k']: u['start'] for u in tx['per_unit']}; rest = grab(a.video, tx['at']).astype(np.float32)
            for q, (ub, own, ci) in enumerate(zip(U, MS, IX)):
                rank = {'forward': ci, 'reverse': n - 1 - ci, 'center': abs(ci - (n - 1) / 2)}.get(A['order'])
                st = A['start'] + rank * A['stagger'] if rank is not None else meas.get(q, A['start']); en = st + A['dur']; e = A['ease']
                src, size = cutout(out, f'{name}_{q}', rest, plate_full, ub, own); cx, cy = ub[0] + ub[2] / 2, ub[1] + ub[3] / 2
                L = dict(name=f'{name}_{q}', type='image', src=src, size=size, position=[[st, [cx + fr.get('x', 0), cy + fr.get('y', 0)]], [en, [cx, cy], e]])
                if 'opacity' in fr: L['opacity'] = [[st, fr['opacity']], [en, 100, e]]
                if 'scale' in fr: L['scale'] = [[st, [fr['scale']] * 2], [en, [100, 100], e]]
                if 'rotation' in fr: L['rotation'] = [[st, fr['rotation']], [en, 0, e]]
                if 'blur' in fr: L['effects'] = [dict(type='blur', radius=[[st, fr['blur']], [en, 0, e]])]
                if fr.get('opacity', 100) < 5 or fr.get('scale', 100) < 5: L['in'] = round(st, 3)
                G['layers'].append(L)
        G['layers'].append(dict(name=f'plate{j + 1}', type='image', src=f'plate{j + 1}.png', size=[W, H], position=[W / 2, H / 2]))
        n_layers += len(G['layers']) - 1; groups.append(G)
    comp = dict(background='#000', motionBlurSamples=16, layers=groups)
    open(os.path.join(out, 'comp.js'), 'w').write('// written by analyser/rebuild.py from the fitted keyframes\nconst COMP = ' + json.dumps(comp, indent=1) + ';\n')
    json.dump(dict(title='rebuild', width=W, height=H, fps=fps, duration=round(dur, 3), reference=os.path.relpath(os.path.abspath(a.video), os.path.abspath(out)), audio=None, output='out/rebuild.mp4'), open(os.path.join(out, 'project.json'), 'w'))
    for f in ('reel.html', 'engine.js', 'motion.js', 'logos.js', 'node_modules'):
        dst = os.path.join(out, f)
        if not os.path.lexists(dst): os.symlink(os.path.relpath(os.path.join(ENGINE, f), out), dst)
    import shutil; shutil.copy(os.path.join(ENGINE, 'reel.mjs'), out)
    print(f'{out}: {len(shots)} shot(s), {n_layers} animated layers → node reel.mjs make, then analyser/score.py')
