# Example: "Build with Claude", rebuilt 1:1

![Original by @yowerse (left) vs reelsmith rebuild (right)](../../../../../../assets/claude-1to1.gif)

<sub>Left: the original reel by [@yowerse](https://www.instagram.com/yowerse/) ([source](https://www.instagram.com/reel/DdJ2zCVPduR/)). Right: the reelsmith rebuild, measured and rendered in code. It scores 95.8% similarity on moving pixels. Shown for learning.</sub>

A 12.9 s, 16:9 product promo with eight shots: a spark morphing into the Claude mark, a chat UI with typing and camera moves, flying 3D dashboard cards, a MacBook whip-spin, a white dome title, and a planet-sunrise end card. Nothing here was keyed by eye. Every move was measured from the reference, and every fix was decided by a per-shot score.

## How it was made: the loop

```
analyse (motion/analyser) → rebuild (raw tracked motion) → render → score each shot → fix the worst shot → repeat
```

| Shot | Technique | Score |
|---|---|---|
| Spark | hand-built code layer, with timing matched to the cut | 94.5% |
| Chat (2 shots) | **camera tracker**; typed prompt and send button **un-zoomed from later frames into the chat's flat layout** and animated (type, pop, glow, press, dim, ↑ rising) | 96–98% |
| Dashboards | **3D tracks** per card; the purple card is cleaned of the arrow by a **per-frame masked median**; the fly-in uses real card images | 94% |
| MacBook | real MacBook Pro 14" model; **pose fitted to every frame by silhouette render-and-compare**, then smoothed (light during the whip, strong on the glide); background is a measured colour surface | 90–95% |
| White dome | dome edge and colour profile **measured per frame**; "Build with" types in from a measured 2.6× zoom | 96% |
| Planet | edge **height and curvature measured per frame** (planet below → straight → dark disc above), glow profile per phase, strobe frames, end flash | 97% |

Single white flash frames sit at 3.07 s, 3.63 s and 12.83 s. Spotting them took two of the shots from about 90% to about 96%.

## Run it

```bash
# inside this folder
cp ../../../../../../motion/{engine.js,motion.js,reel.mjs,package.json} . && npm install && npx playwright-core install chromium
# put a reference you have the right to study at ref/original.mp4, then:
./analyse.sh                      # tracks, fits, cut-outs, cleaned cards, chat assets, planet / dome / background models
# MacBook: download the free model below as assets/macbook14.glb, then fit its spin to the reference
node fitpose.mjs 9.23 10.83
node reel.mjs make && ./loop.sh   # render, then the per-shot score
```

The image pieces (cards, typed prompt, send button, plates) are cut from the reference by `analyse.sh`. They aren't shipped here, so the repo holds no frames of the original reel. The numbers it measured (`ref/*.json`) are included.

## Credits

- Original reel: **[@yowerse](https://www.instagram.com/yowerse/)**, [instagram.com/reel/DdJ2zCVPduR](https://www.instagram.com/reel/DdJ2zCVPduR/).
- MacBook Pro 14" 3D model: [akshatmittal on Sketchfab](https://sketchfab.com/3d-models/2021-macbook-pro-14-m1-pro-m1-max-f6b0b940fb6a4286b18a674ef32af2d3), CC BY 4.0. Download it yourself; it isn't redistributed here.
- Claude mark: Simple Icons. Fonts: Source Serif 4, DM Sans, Inter (OFL).
