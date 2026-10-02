# Playbook: measuring a reel and matching it

## Measuring positions

- `node reel.mjs frames <name> <t...>` gives exact frames 360 px wide. On a 1080-wide project every coordinate you read is ×3 (or ×width/360). Read centres, edges and sizes off these, not off the dense sheets.
- `sheet` tiles come from ffmpeg's fps filter, which picks frames up to ~1/(2·fps) s away from the label you'd assume. Use sheets to understand motion, `frames`/`compare` (exact seeks) to time things.
- For a moving object, sample its position at 4–6 moments across the move and put those straight into `kf()`. Ease shapes come out right automatically because kf is a smooth monotone curve with soft ends.
- Things that move together but at different speeds (parallax) usually share one normalised progress curve `p(t)` with a different offset per layer — measure one layer, derive `p`, apply to the others.
- "It looks like a zoom" is often a pan with perspective: if the top object moves down while the bottom moves up and both keep their size, it's two translations, not a scale. Check sizes before choosing.

## Colours

- `node reel.mjs color <t> x,y ...` averages a 5×5 patch. Sample backgrounds at centre and edges (most reels have a radial vignette), and each brand colour on a flat part of the object, not on an edge or glow.
- Compressed video shifts saturated colours slightly. For brand marks use the official value (brand press kit, or the SVG's gradient stops printed by `logo`), for everything else use the sampled value.
- Analysis palettes are per-shot dominant colours — good for backgrounds, not for small details.

## Timing

- Scene changes: analysis cut list ± your eyes. Word timings: `ref/transcript.json` (start, end, word).
- Captions in the reference usually change slightly after the word starts (0.05–0.2 s). Start from word start + 0.08 and confirm with compare at the exact switch moments.
- Typing or per-word reveals: reveal each word over ~0.2–0.26 s starting near its spoken time, with a little blur and offset for the "settle".

## Compare loop

1. One compare per scene at 4–8 moments: entry, mid-move, settled, exit.
2. Write down every difference (position, size, colour, timing, missing detail) before touching code; fix them all; compare again.
3. Full-video pass at ~1 s spacing after all scenes are built. Repeat once more after fixes.
4. Report what still differs. Exact is the goal; honest is the requirement.

## Traps that cost time

- Variable name clashes in one big `video.js` (e.g. two `const p`) break the page — `node reel.mjs preview` prints PAGE ERROR lines; read them.
- Canvas `filter: blur()` on huge layers is slow; blur whole frames only during short whips.
- `shadowBlur` is in device pixels and ignores the transform scale — divide by your scale when drawing scaled marks (the engine's `logo()` does this).
- Keep every scene a pure function of `t`; frames render in parallel and out of order.
- zsh treats `$var[...]` as array indexing — the Node tools avoid shell quoting problems; prefer them over hand-written ffmpeg one-liners.
