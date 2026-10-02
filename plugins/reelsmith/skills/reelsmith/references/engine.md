# Engine API (template/engine.js)

Globals after boot: `W, H, FPS, DUR` (from project.json), `IMG` (loaded images), `LOGOS`/`LP` (marks).

## video.js contract

```js
const VIDEO = {
  fonts: ['500 30px Poppins', ...],            // preloaded before the first frame
  images: { key: 'assets/photo.png' },         // → IMG.key
  caption: { weight: 500, size: 50, y: 309,    // or fit: ['Sample text', widthPx] to match a measured width
             onLight: '#161616', onDark: '#FFFFFF', fadeIn: .08, fadeOut: .05, shadow: null },
  scenes: [{ s: 0, e: 2.05, f: scHook, light: 1 }, ...],   // light: caption colour for that scene
  captions: [[3.12, 4.3, 'Solana is fast'], ...],          // [start, end, text]
  prerender() {},                               // build cached canvases, compute font sizes
  overlay(ctx, t) {},                           // optional: drawn on top of everything
};
```

A scene `f(c, t)` draws the whole frame into canvas context `c` at global time `t` and may return a blur radius in px (motion blur).

## Helpers

| helper | what it does |
|---|---|
| `kf(t, [[t0,v0],[t1,v1],...])` | smooth monotone keyframes — camera moves, positions, sizes, alphas |
| `prog(t,a,b)` | 0→1 between a and b, clamped |
| `ease, easeIn, easeOut, back` | easing curves (back = overshoot pop) |
| `lerp, clamp, mix(hexA,hexB,t), rgba(hex,a), rnd(i)` | maths and colour; rnd is deterministic |
| `cam(c, s, fx, fy, dx, dy, r)` | camera transform: scale + rotate around (fx,fy), then shift |
| `logo(c, name, cx, cy, width, fill, {rot, alpha, glow, glowR, wash})` | draw a mark from logos.js; `fill` may be `c => gradient` in viewBox units |
| `txt(c, s, x, y, font, color, {align, base, alpha, ls, shadow})` | one line of text |
| `fitFont(text, width, weight, family)` | font size that makes text exactly `width` px |
| `pill(c, x, y, w, h, fill, text, textColor, {glow, stroke, size, alpha})` | rounded tag / button |
| `bgLight(c, inner, outer, cy, r)` | light studio background with radial falloff |
| `glow(c, x, y, r, hex, a)` | soft radial light |
| `reflect(c, floorY, l => draw(l), {alpha, floor, fade})` | object + mirrored reflection on a glossy floor |
| `boil(t, fps)` | step time for a stop-motion look (12 = on twos) |
| `torn(points, seed, amp, step)` | roughen polygon edges like torn paper |
| `paper(c, points, {fill, depth, grain, shadow, edge})` | one paper layer with drop shadow and grain |
| `mk(w,h)` | offscreen canvas for prerendered layers |

## project.json

`width, height, fps, duration, reference, audio, output`. `reference` enables compare/frames/sheet/color/side; `audio` is muxed and loudness-normalised to −14 LUFS by `encode`.
