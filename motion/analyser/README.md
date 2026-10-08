# Analyser: After Effects in reverse

The analyser watches a video and writes down which animations were used, with After Effects numbers: ease, duration, bounce, spring, motion blur, and which beat each move lands on. `rebuild.py` turns that into a `comp.js` the engine renders, and `score.py` checks the result against the original.

```
video ──► discover.py ──► track.py / text.py / camera.py ──► fit.py ──► rebuild.py ──► node reel.mjs make ──► score.py
         (shots, settled    (numbers per frame: 2D, 3D,         (keyframes   (comp.js:       (render)            (similarity on
          moments, objects)  text animators, camera)             + eases)     shots, cutouts)                     moving pixels)
```

The work is split between the agent and the tools:

- **The agent decides *what* each element is** (`--model 3d` for tilted cards, text or layer). It checks `discover.py`'s numbered contact sheets for this.
- **The tools measure *how* it moves**, to sub-pixel accuracy.

## Run it

```bash
uv run tools/beats.py video.mp4 beats.json
uv run analyser/discover.py video.mp4 --out analysis            # shots + the commands to run next (and shot_N.jpg sheets)
uv run analyser/track.py  video.mp4 --name card --at 2.5 --box x,y,w,h [--model 3d] --from 0.6 --to 5 --out analysis
uv run analyser/text.py   video.mp4 --name title --at 3.0 --box x,y,w,h --from 0.3 --to 3 --out analysis   # letters/words
uv run analyser/camera.py video.mp4 --name cam --at 4.3 --from 3.06 --to 6.94 --out analysis               # whole-frame zoom/pan
uv run analyser/fit.py analysis/*.track.json --beats beats.json --out analysis                             # prints the report
uv run analyser/rebuild.py video.mp4 analysis && (cd analysis/rebuild && node reel.mjs make)
uv run analyser/score.py video.mp4 analysis/rebuild/out/rebuild.mp4
```

### Example report lines

```
mark    scale: 0.0 → 100.0, 1.20–1.70 s (0.50 s), ease pop (spring) · starts on beat:5
card    position: (700, 300) → (700, -291), 4.50–5.00 s, ease whip · leaves while moving
flipper rotationX: 0.0 → 50.3, 1.50–2.11 s, ease back
camera  anchor: (759, 420) → (820, 470), 2.00–2.51 s, ease smooth
■ title: 21/21 chars animate forward, 29 ms apart, from 0.53 s, each 0.47 s, ease out · from opacity 0, y +54, blur 7.5
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

- **`text.py`** finds every glyph and tracks each letter on its own shape, so neighbours that move differently don't interfere. It fits each letter and then reads the pattern across them:
  - the stagger, using a robust median-of-slopes line, with spaces counted
  - the order: forward, reverse, centre or random
  - the from values and the ease
- **`camera.py`** registers every frame to a reference with feature matching, ignoring anything that moves on its own, then refines it. The camera is reported as what it looks at (its point of interest), plus zoom and roll.
- **`discover.py`** works in three steps:
  1. It finds cuts: most pixels change at once, or the edges stop lining up and the change isn't explained by a zoom or pan.
  2. It finds the settled moments in each shot.
  3. It finds the objects that differ from their local background and actually animate, and flags text and camera shots.

## Accuracy, measured

Every test in `tests/` is a video rendered by the engine with known keyframes.

| Test | What the analyser recovers | Rebuild |
|---|---|---|
| `synth` (2D) | `pop`, `out`, `smooth`, `back`, `inOut`, `whip` with times ±0.01 s; inertial bounce frequency and decay exact; 180° motion blur; tracking error 0.01–0.7 px | 98.9% |
| `synth3d` | `back` flip (rotation X), `out` / `inOut` turns (rotation Y), a push back in depth read as Z; angles within 0.1–0.2° | 97.8% |
| `synthcam` | `out` zoom, `smooth` drift, then `whip` back, all as point of interest, zoom and roll | 99.3% |
| `synthtext` | per-letter: forward, 29 ms (truth 30), `out`, from opacity 0 · per-word: forward, 122 ms (120), `back`, from scale 60% | 98.8% |

Rebuild scores are similarity on moving pixels.

## Known limits

- **Off-screen and edge-on moments.** When a move starts off-screen, or a card is nearly edge-on (more than 60°), it can't be seen, so it is extrapolated. Both possible eases are reported when that is ambiguous.
- **Text from-values.** The start offset and blur of a text animator are underestimated by about 25%, because the first faint frames of each letter can't be tracked.
- **Cut detection.** Very fast whips and spins can look like cuts. An extra split is harmless; each part gets its own plate.
- **Rigid objects only.** Shapes that morph (a spark turning into a logo), particles and liquids aren't rigid, so a cutout only approximates them.
