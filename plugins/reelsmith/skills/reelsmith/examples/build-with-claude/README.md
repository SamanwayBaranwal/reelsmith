# Example: Build with Claude

A 12.9 s, 16:9 product promo with six scenes:

1. A glowing spark morphs into the Claude mark.
2. A chat UI types a prompt, with a camera that zooms and pans.
3. An arrow dives through a stack of 3D dashboard cards.
4. A 3D laptop whips round and settles.
5. "Build with" types onto a white dome.
6. A planet sunrise reveals "Build with Claude ✳".

![Original (top) vs reelsmith rebuild (bottom)](../../../../../../assets/claude-demo.gif)

## How the motion was matched

All the motion timing was measured from the original, not eyeballed:

- **Beat-synced cuts.** An onset detector found the song's hits, and every scene change and pop lands on one (3.06, 6.94, 9.19, 10.82, 11.28 s).
- **Motion curves.** Per-frame bounding boxes of the reference give the spark's size, the arrow's flight path, the laptop's spin phase and the planet's drop. These numbers are typed straight into `video.js` as keyframes.
- **Snappy easing.** `seg(t, keys)` gives each segment its own ease: `'o'` fast-out (expo), `'b'` overshoot bounce, `'s'` smooth, `'l'` linear.
- **3D laptop.** three.js renders the laptop with rounded aluminium, studio reflections, a soft contact shadow and the dashboard on its screen. Each frame goes to an offscreen WebGL canvas that is drawn into the 2D frame.
- **Motion blur.** It averages 16 sub-frames per frame, and 36 during the fast laptop spin, so fast moves smear instead of strobing.

The Claude mark is the official path from Simple Icons. The fonts are open substitutes: Source Serif 4, DM Sans and Inter. The dashboards are drawn in code.

## Run it

```bash
cp -r ../../template ./claude-demo && cp video.js logos.js reel.html package.json project.json ./claude-demo/
cd claude-demo && npm install && npx playwright-core install chromium
node reel.mjs make        # → out/build_with_claude.mp4 (silent; set "audio" in project.json to add your track)
```

This example uses two extra dependencies compared with the base template: `three` and three font packages. Its `reel.html` adds the matching `@font-face` rules and the three.js import map.
