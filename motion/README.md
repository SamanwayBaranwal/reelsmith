# reelsmith motion: After Effects for agents

An agent writes **`comp.js`**, which is plain data: layers, keyframes, eases, effects. The engine renders it frame by frame and outputs an MP4 with your audio. You never touch drawing code or a timeline.

Units match After Effects, so values copy straight across:

| Property | Unit |
|---|---|
| position | px |
| scale | % |
| rotation | degrees |
| opacity | % |

## Commands

```bash
uv run tools/beats.py song.mp3 beats.json   # find the hits → use 'beat:N' anywhere a time goes
node reel.mjs preview 1.2 3.4               # stills → preview/
node reel.mjs make                          # render + encode → out/*.mp4 (audio from project.json)
node reel.mjs compare name 1.0 2.0          # reference (top) vs ours (bottom), if project.json has a reference
```

`project.json` sets the size, fps, duration, audio and output.

## Time

Anywhere a time goes, you can write:

| Form | Meaning |
|---|---|
| `1.2` or `'1.2s'` | seconds |
| `'36f'` | frames |
| `'beat:4'` | the 4th strong hit of the song (1-based) |
| `'onset:9'`, `'kick:2'` | the 9th onset, the 2nd kick |
| `'mark:drop'` | a named marker from `COMP.markers` |
| `'beat:4-0.35'` | any of the above, plus or minus seconds |

**Land impacts on the hit.** The move should *arrive* on the beat (`['beat:9-0.4', from], ['beat:9', to, 'in']`), not start on it.

## Properties

Every property can be written four ways:

```js
opacity: 80                                              // constant
scale: [['beat:2', 0], ['beat:2+0.5', 100, 'pop']]       // keyframes [time, value, ease-into-this-key]
rotation: { keys: [...], bounce: { amp: .05, freq: 2.5, decay: 6 }, wiggle: { freq: 2, amp: 5 }, loop: true }
scale: (t, layer) => 100 + 10 * Math.sin(t * 4)          // expression
```

Values can be numbers, arrays (`[x, y]`) or hex colours, and all of them interpolate.

### Eases

A key's ease shapes the move *into* that key.

| Ease | Feel |
|---|---|
| `smooth` | After Effects Easy Ease, 33% (default) |
| `out` | leaves fast, glides in. The snappy default for UI and text |
| `in` | slow start, hard hit. Pair it with `bounce` |
| `inOut` | 83% S-curve |
| `whip` | camera whips and transitions |
| `back` | overshoots once |
| `anticipate` | dips back first |
| `pop`, `spring`, `wobble` | springs that overshoot and settle |
| `linear`, `hold` | constant speed; jump to the next value |
| `[x1, y1, x2, y2]` | any cubic-bezier |
| `{ out: [speed, influence%], in: [speed, influence%] }` | After Effects keyframe velocity numbers, as-is |

### Bounce and wiggle

`bounce` is After Effects' inertial-bounce expression. It keeps the arrival velocity going as a decaying wobble after each key, so it needs a key that arrives moving (`in` or `linear`).

`wiggle` adds a deterministic shake.

## Layers

`COMP.layers` is listed **top first**, like the After Effects timeline.

**Properties every layer has:** `name, type, in, out, parent, position, anchor, scale, rotation, skew, opacity, blend, effects, motionBlur, matte, visible`.

`pivot` sets where the origin sits in the box: `[.5, .5]` is the centre (default), `[0, .5]` the left edge. It applies to `solid`, `rect`, `ellipse` and `image`.

| type | Extra properties |
|---|---|
| `solid` | `color`, `size` (default: comp size) |
| `rect` / `ellipse` | `size`, `radius`, `fill`, `stroke`, `strokeWidth` |
| `text` | `text`, `font`, `weight`, `size`, `fill`, `stroke`, `align`, `tracking`, `lineHeight`, `reveal` (0–1 typewriter), `animator` |
| `path` | `logo` (from logos.js) or `d` (SVG path) + `viewBox`, `size` (px wide), `fill`, `stroke`, `trim` (0–1) |
| `image` | `src`, `size`, `radius` |
| `group` | `layers`, `start`, `speed` (a precomp: children sit in its space, on its own clock) |
| `null` | transforms only, used as a `parent` |
| `custom` | `draw: (ctx, t, layer) => {}` (an escape hatch for any canvas code) |

Positioning:

- A top-level layer sits at the comp centre by default.
- A child of a group sits at the group's origin by default.
- `fill` takes a colour or a gradient: `{ linear: [x0,y0,x1,y1], stops: [[0,'#fff'],[1,'#000']] }` or `{ radial: [x,y,r0,r1], stops }`.

### Text animator

This is the After Effects range selector:

```js
animator: { by: 'char' | 'word' | 'line', start: 'beat:4', stagger: .025, dur: .5, ease: 'out',
            order: 'forward' | 'reverse' | 'center' | 'random',
            from: { opacity: 0, x: 0, y: 60, scale: 70, rotation: 8, blur: 12 } }
```

### Effects

Effects run top to bottom and every value is animatable:

```js
effects: [
  { type: 'glow', radius: 30, intensity: 1, color: '#FFB08A' },   // layered blur added on top, like Deep Glow
  { type: 'shadow', blur: 60, x: 0, y: 30, color: 'rgba(0,0,0,.45)' },
  { type: 'blur', radius: 8 },
  { type: 'tint', color: '#D97757', amount: .5 }, { type: 'fill', color: '#fff' },
  { type: 'brightness', amount: 1.2, contrast: 1.1, saturation: 1.2 },
]
```

### Other layer features

| Feature | How |
|---|---|
| **Blend** | `normal, add, screen, multiply, overlay, softLight, lighten, darken, colorDodge, difference` |
| **Motion blur** | `motionBlur: true` on a layer. `COMP.shutterAngle` (180) and `COMP.motionBlurSamples` (16). Raise `samples` on very fast spins |
| **Track matte** | `matte: { layer: 'name', mode: 'alpha' \| 'alphaInverted' }`. The matte layer is hidden automatically |
| **Parenting** | `parent: 'name'` (a sibling in the same list) |

## Comp

```js
const COMP = {
  background: '#0B0A09', beats: 'beats.json', markers: { drop: 'beat:12' },
  fonts: ['700 30px DM Sans'],                      // weights to load before rendering
  shutterAngle: 180, motionBlurSamples: 16,
  camera: { anchor: [[...]], position: [960, 540], scale: [[...]], rotation: 0 },   // 2D camera: look at anchor, zoom with scale
  layers: [ ... ],
};
```

## Where this is going

- 3D layers and camera (three.js)
- Card bend and warp
- Laptop and phone mockups
- `node reel.mjs check`: renders, compares against the reference and reports which moves are off and by how much, so the agent can fix itself
