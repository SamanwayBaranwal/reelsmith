# Style recipes

## 3D-render look (chrome, glass, glow) — the crypto/finance explainer style

- **Stage:** dark `#000`–`#0F0F0F` with a soft top spotlight (radial gradient, white 0.1–0.3 alpha) or light `#E2E2E4`–`#F4F4F6` with a radial vignette to `#C4C4C8`. Alternate light/dark scenes to separate ideas.
- **Chrome:** linear gradient across the object with stops like `#262626 → #D9D9D9 → #F4F4F4 → #8A8A8A → #1C1C1C`; add a thin white rim line on the lit side. Reflections via `reflect()` at alpha 0.12–0.2.
- **Glass:** fill `rgba(255,255,255,0.06–0.3)`, 1.5–2.5 px white border at 0.4–0.8 alpha, a top-half highlight gradient, and a soft outer glow (`shadowBlur` 30–50 white 0.3).
- **Neon / brand glow:** stroke or fill in the brand colour with `shadowColor` = brand at 0.6–0.9 and `shadowBlur` 20–40, plus a big `glow()` at 0.15–0.3 behind.
- **Horizon line:** a 6–8 px white bar with a short white→transparent gradient below it (0.5 → 0 over ~400 px).
- **Camera:** something always moves — slow push-ins (2–6 % per scene), orbits, tilts; whips with 6–12 px motion blur between scenes.
- **Captions:** Poppins Medium, sentence case, 1–3 words, centred in the top 15 %, white on dark / near-black on light.

## Kinetic typography

- Lay the line out once (measure each word's x with `measureText`), then reveal per word: alpha 0→1, blur 10→0, y offset 16→0 over 0.2–0.26 s from the spoken time.
- Emphasis words: switch weight or colour on the beat, or scale with `back()` for a pop.
- Big display words: League Gothic (or another condensed face) with a vertical gradient fill (white → grey) for a lit look.

## UI / app mockups

- Cards: `#FAFAFB` → `#F1F1F3`, radius 28–40, shadow `rgba(0,0,0,0.10)` blur 50 offsetY 18.
- Cursor: white circle with a grey ring that shrinks on click, or an arrow; move it with `kf` to the button, press = scale 0.96 for ~0.1 s, then swap the UI state.
- Numbers and states change on the voiceover's beat, not on a timer.

## Paper cut / collage

- Hold poses on twos: compute everything from `tb = boil(t, 12)`, and pass `Math.floor(t * 12)` as the `torn()` seed so edges shimmer slightly per pose like real stop-motion.
- Each layer: `paper(c, torn(points, seed, 5–8), { fill, depth })` — deeper layers get bigger `depth` (shadow) and darker or more muted colours.
- Palettes that read as paper: cream `#F4E9D8`, kraft `#C9A27A`, mustard `#E9B872`, terracotta `#D9653B`, navy `#2E4A62`, sage `#9CB59A`.
- Movement is in steps: slide layers in, pop-scale cut-outs with `back()`, rotate characters' limbs around pivot points; avoid smooth blur — paper cut has none.
- Add `paper(..., { grain: 0.2 })` for fibre texture, and a very subtle overall vignette.

## Flat vector explainer

- No gradients or only 2-stop ones, thick rounded strokes (`lineCap = 'round'`), 3–5 colour palette, shapes enter with `back()` pops staggered by 60–100 ms.
