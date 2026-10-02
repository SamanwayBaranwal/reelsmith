# Example: Solana vs Robinhood Chain

A 23.8 s crypto explainer reel (10 scenes: logo collision, glowing ring + horizon, swap-card UI, chrome clock, podium with orbiting light, node network, lectern, light funnel + trophy, tokenised-stocks list, follow card) rebuilt from the original by measuring frames and comparing side by side.

Run it:

```bash
cp -r ../../template ./sol-demo && cp video.js logos.js project.json ./sol-demo/
cd sol-demo && npm install && npx playwright-core install chromium
node reel.mjs make        # → out/video.mp4 (silent; add your own voiceover in project.json → "audio")
```
