---
name: reelsmith
description: Rebuild a motion-graphics reel in code from a link. Paste an Instagram Reel, TikTok, YouTube Short or X video (or a local file) of a motion design, 3D-render-style explainer, kinetic typography, UI-mockup or paper-cut reel, and reelsmith measures it (cuts, word timings, colours, positions), recreates every scene as editable canvas code, compares it frame by frame with the original until it matches, and renders a 1080×1920 MP4. Then you can change the text, brands, colours, voiceover or style and render new versions. Use it whenever someone wants to recreate, remake, rebuild, clone or copy the style of a motion-graphics video, says "make this reel in code", "make a video exactly like this", or wants an editable template from a reel.
license: MIT
compatibility: Needs ffmpeg, Node 18+, uv (for the analyzer's Python packages) and internet. yt-dlp is fetched on demand if missing. scripts/check.py checks everything.
metadata:
  version: "0.1.0"
---

# reelsmith

Turn a reference reel into code that renders the same video, then make it yours. The loop is **measure → build → compare → fix**, repeated until the render is hard to tell apart from the reference. The compare step is what makes it exact: never trust a scene you haven't put side by side with the original.

## What it can and can't rebuild

- **Yes:** motion graphics, 2D/3D-render-style product scenes (chrome, glass, glow, reflective floors), kinetic typography, app/UI mockups, infographic and chart animations, logo reveals, paper cut / stop-motion collage, flat vector explainers.
- **No:** live-action footage, real people's faces or voices, photoreal 3D. If the reel mixes them, rebuild the graphic parts and say which shots need the user's own footage or images.

## 0. Setup (once per machine)

Run `python3 <skill>/scripts/check.py`. It checks ffmpeg, Node, uv and yt-dlp and prints install commands for the OS. Ask before installing anything.

## 1. New project

```bash
cp -r <skill>/template ./reels/<slug>          # Windows: Copy-Item -Recurse <skill>\template .\reels\<slug>
cd ./reels/<slug> && npm install && npx playwright-core install chromium
```

`<slug>` is a short name for the reel. The template already renders a 6 s demo (`node reel.mjs make`) — a quick way to prove the setup works.

## 2. Measure

```bash
uv run <skill>/scripts/analyze.py "<link or file>" --out ref
```

This writes `ref/original.mp4`, `ref/audio.wav`, `ref/analysis.md`, `ref/transcript.json` and labelled sheets in `ref/sheets/`. First run installs Python packages and a ~480 MB speech model (one-time wait — tell the user).

- **Exit 3 / login needed** (common on Instagram): ask first — "This reel only downloads when you're logged in. May I let yt-dlp read your Chrome cookies for this one download?" Only after a yes, rerun with `--cookies-from-browser chrome`.
- **Other download failures:** ask the user to download the file and pass its path.

Then set `project.json`: `duration` (from analysis.md), `width/height` (keep 1080×1920 for vertical even if the reference is 720p), `reference: "ref/original.mp4"`, and `audio` (see step 7).

## 3. Watch (understand every scene before writing code)

Read `ref/analysis.md` fully, then look at `ref/sheets/hook.jpg`, `shots.jpg` and `timeline.jpg`. Cut detection misses soft cuts and fires on flashes; trust your eyes.

For each scene, make dense strips and exact frames:

```bash
node reel.mjs sheet 3.0 2.0 6 6 s3       # 2 s from 3.0 at 6 fps → ref/sheet_s3.jpg
node reel.mjs frames a 1.0 1.9 4.2 5.6   # exact frames, 360 px wide → ref/frames_a.jpg
node reel.mjs color 4.2 0.5,0.31 0.1,0.9 # exact colours (x,y as 0–1 fractions or pixels)
```

Write a scene spec before coding — for every scene: start/end time, background (exact hex), each object with position and size **in project pixels** (frames are 360 px wide, so multiply by 3 for 1080), how each thing moves (sample its position at 3–6 times), caption text and timing, transitions, and what the voice says. Read `references/playbook.md` for how to measure well and the traps that cost time.

**Assets:**
- Brand marks: `node reel.mjs logo solana` pulls the mark from Simple Icons (CC0) into `logos.js`; for official gradients/colours, fetch the brand's own press-kit SVG (`node reel.mjs logo <file.svg|https://…svg> name` prints its gradient stops). Never redraw a logo by hand.
- Generic objects (coins, clocks, trophies, funnels, devices, charts, paper shapes) are drawn in code — that's what keeps the output editable.
- Fonts: Poppins and League Gothic are installed; for others add `@fontsource/<font>` with npm and an `@font-face` in `reel.html`. Pick the closest free match and say which.

## 4. Build

Write the scenes in `video.js` (engine API: `references/engine.md`; style recipes for chrome/glass/glow, kinetic type and paper cut: `references/styles.md`). Rules that keep it exact:

- One function per scene, drawing purely from `t` — no state, no randomness except `rnd(i)`.
- Put objects at the measured coordinates; drive camera moves and object paths with `kf(t, [[time, value], ...])` through the sampled positions.
- Time captions and scene changes to the word timings in `transcript.json`; the reference's captions usually trail the words by 0.05–0.2 s, so confirm with compare.
- Return a blur radius from a scene during whips, fast zooms and spins (motion blur).
- Use `<skill>/examples/build-with-claude/video.js` as the reference for quality and structure: a full 8-shot reel built this way. `<skill>/examples/build-with-claude-1to1` shows the measured 1:1 version (analyser, per-shot score loop).

## 5. Compare and fix (the important part)

```bash
node reel.mjs compare s3 3.2 3.5 4.2 4.7     # top: reference, bottom: ours → ref/cmp_s3.jpg
```

Look at every comparison and list the differences: position, size, colour, timing, motion, missing details. Fix them, then compare again. Do this per scene, then a full pass across the whole video at ~1 s spacing. Two full passes is normal; stop when the remaining differences are small details you'd only see when paused. Tell the user honestly what still differs.

## 6. Render

```bash
node reel.mjs make 4       # render with 4 browser workers + encode → out/video.mp4
node reel.mjs side         # reference | ours side-by-side → out/side_by_side.mp4
```

Open both for the user (`open` on macOS, `start` on Windows).

## 7. Audio and making it yours

- **Audio:** use the user's own voiceover or music (`project.json` → `audio`). Use `ref/audio.wav` only when the user owns the reference (their own channel) — ask if unclear. With a new voiceover, transcribe it (`uv run <skill>/scripts/analyze.py voice.mp3 --out vo`) and retime scenes and captions to its word timings.
- **Customise:** the scene code is the template. Swap text, brands, numbers, colours, captions, end card; duplicate scenes for a longer script; change the palette for a new brand. Offer this at the end: "Want me to make a version for your topic/brand?"

## Ground rules

- Rebuilding a style is for learning and for the user's own content. Don't help pass off someone else's video as the user's, re-upload their footage, or strip another creator's watermark or branding from their work — rebuild with the user's own branding instead.
- Brand logos are for identification/commentary; keep them accurate and don't imply endorsement.
- Never recreate real people's faces or clone their voices.
- Read browser cookies only after the user says yes, and only for that download.
