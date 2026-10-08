# Analyser: After Effects in reverse

The analyser watches a video and writes down which animations were used, with After Effects numbers: ease, duration, bounce, spring, motion blur, and which beat each move lands on. `rebuild.py` turns that into a `comp.js` the engine renders, and `score.py` checks the result against the original.

```
video ──► track.py ──► fit.py ──► rebuild.py ──► node reel.mjs make ──► score.py
         (numbers per    (keyframes   (comp.js +      (render)            (similarity on
          frame)          + eases)     cutouts)                            moving pixels)
```

The work is split between the agent and the tools:

- **The agent decides *what* to track.** It looks at a frame and gives a still moment plus a box for each element.
- **The tools measure *how* it moves, to sub-pixel accuracy.**

## Run it

```bash
uv run tools/beats.py video.mp4 beats.json
uv run analyser/track.py video.mp4 --name card --at 2.5 --box x,y,w,h [--from 0.6 --to 5]   # one per element
uv run analyser/fit.py analysis/*.track.json --beats beats.json                              # prints the report
uv run analyser/rebuild.py video.mp4 analysis && (cd analysis/rebuild && node reel.mjs make)
uv run analyser/score.py video.mp4 analysis/rebuild/out/rebuild.mp4
```

### Example report line

```
mark  scale: 0.0 → 100.0, 1.20–1.70 s (0.50 s), ease pop (spring) · starts on beat:5
card  position: (700, 300) → (700, -291), 4.50–5.00 s, ease whip · leaves while moving
      motion blur: yes, shutter ≈ 180°
```

## How it decides

**`track.py`** follows the element with ECC image alignment (affine), which ignores fades.

| Situation | What it does |
|---|---|
| Fast whip | Matches against motion-blurred templates and keeps the best shutter angle, which measures the blur. Size and rotation are held; only position is solved, because blur can masquerade as a scale change |
| Element half off-screen | Keeps the last confident shape; marks the frame `visible < 1` |
| Lost track | Searches again with sharp and smeared templates. A smeared match is accepted only if the jump runs along the smear and matches its length. Otherwise it stops rather than guessing |

**`fit.py`** cuts each property into moves using a threshold that adapts to the measurement noise. It then fits each move with:

- After Effects bezier eases (free, or the named presets)
- springs
- an ease into the key followed by inertial bounce

It keeps the simplest model that explains the curve: presets win unless a free curve is clearly better. Further rules:

| Rule | Why |
|---|---|
| Properties of one layer that start before tracking share a start time | They'd share the keyframe in After Effects |
| Scale and opacity are assumed to pop or fade in from 0 | That's how elements usually appear |
| An element sliding in from the edge starts just off-screen | When its far end can't be seen, that's what designers key |
| Every start and end is checked against the beats | To report beat sync |

## Accuracy, measured

`tests/synth` holds a video rendered by the engine where every keyframe is known.

| What | Result |
|---|---|
| **Tracking** | Mean error 0.01–0.7 px; worst frame 2 px during a 500 px/frame whip; rotation, scale and opacity near-exact |
| **Fitting** | Recovers `pop`, `out`, `smooth`, `back`, `inOut` and `whip` with the right times (±0.01 s), inertial bounce frequency and decay exactly, and motion blur at 180° |
| **Rebuild** | 99.3% similarity on moving pixels; the gap is the card's off-screen entry, which no tool can see |

## Not handled yet

- **3D tilts and flips** need a perspective (homography) model with a 3D decomposition.
- **Camera moves** need a whole-frame camera tracker, not one element.
- **Text animators** need per-letter or per-word detection; today a word block is tracked as one piece.
- **Automatic element discovery** is not built; today the agent provides the boxes.
