// End sequence, matched to the original frame by frame:
// white dome typing → strobe (dark 11.30 · white 11.33 · dark+blur 11.37) → planet glow drawn from the measured model + title.
let PM, TMP;
async function loadPlanet() { PM = await (await fetch('ref/planet_model.json')).json(); PM.tops = PM.top.filter(x => x[1] !== null); }
function planetGlow(c, t) {
  // measured edge: y = yc + k/2·(x − cx)² flipped to screen terms; k < 0 → dark planet below the glow, k > 0 → dark disc above, glow below
  const yc = kf(t, PM.curve.map(r => [r[0], r[1]])), k = kf(t, PM.curve.map(r => [r[0], r[2]]));
  // colour vs distance from the edge: the planet's profile, blended into the eclipse's softer one as the edge flips
  const E = [[-700, [0, 0, 0]], [-420, [0, 0, 1]], ...PM.eclipse, [300, [254, 222, 154]], [760, [254, 222, 154]]], w = smooth(clamp((k + 15e-5) / 30e-5));  // deep inside the disc is pure black
  const at = (L, d) => { if (d <= L[0][0]) return L[0][1]; for (let i = 1; i < L.length; i++) if (d <= L[i][0]) { const p = (d - L[i - 1][0]) / (L[i][0] - L[i - 1][0]); return L[i - 1][1].map((v, j) => v + (L[i][1][j] - v) * p); } return L[L.length - 1][1]; };
  const PS = [[-700, [0, 0, 0]], [-420, [2, 1, 0]], ...PM.stops]; const S = []; for (let d = -700; d <= 760; d += 20) { const a = at(PS, d), b = at(E, d); S.push([d, a.map((v, j) => v + (b[j] - v) * w)]); }
  const d0 = S[0][0], d1 = S[S.length - 1][0];
  let g;
  if (Math.abs(k) < 2e-6) { // straight edge
    const up = k <= 0; g = up ? c.createLinearGradient(0, yc - d0, 0, yc - d1) : c.createLinearGradient(0, yc + d0, 0, yc + d1);
    for (const [d, col] of S) g.addColorStop((d - d0) / (d1 - d0), `rgb(${col.map(Math.round).join(',')})`);
  } else {
    const R = 1 / Math.abs(k), cy = k < 0 ? yc + R : yc - R, r0 = Math.max(1, R + d0), r1 = R + d1;
    g = c.createRadialGradient(PM.cx, cy, r0, PM.cx, cy, r1);
    for (const [d, col] of S) if (R + d >= r0) g.addColorStop((R + d - r0) / (r1 - r0), `rgb(${col.map(Math.round).join(',')})`);
  }
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function planetTitle(c, t) {
  const k = seg(t, [[11.68, 1.0], [12.0, .77, 's']]);
  c.save(); cam(c, k, 960, 538);
  c.font = `700 128px ${DISP}`; const bw = c.measureText('Build with').width;
  const x0 = seg(t, [[11.42, 960 - bw / 2], [11.6, 527, 'o'], [12.0, 390, 's']]);
  const end = typeLetters(c, t, 'Build with', 10.0, 10.01, x0, 545, `700 128px ${DISP}`, '#FFFFFF');
  const e2 = typeLetters(c, t, 'Claude', 11.45, 11.85, end + 26, 552, `400 140px ${SERIF}`, '#FFFFFF'); const sa = seg(t, [[11.95, 0], [12.15, 1, 'b']]);
  if (sa > 0) { glow(c, e2 + 82, 540, 150 * sa, '#FFE6D2', .35 * sa); spark(c, e2 + 82, 540, 62 * sa, { rot: t * .5, color: '#FBD6BE', glow: 'rgba(255,215,190,0.95)', glowK: 1.6 }); }  // level with the text, big soft halo
  c.restore();
}
function endScene(c, t) {
  if (t < 11.285 || (t >= 11.317 && t < 11.35)) return scBuildWhite(c, t);   // white dome (and the white strobe frame)
  if (t < 11.385) {                                                          // dark strobe frames (the second one zoom-blurred)
    if (t < 11.317) return scPlanet(c, 11.30);
    if (!TMP) TMP = mk(); const g = TMP.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; scPlanet(g, 11.30);
    c.save(); c.filter = 'blur(5px)'; c.drawImage(TMP, 0, 0); c.restore(); return 0;
  }
  planetGlow(c, t); planetTitle(c, t); return 0;
}

// Shot 7: the white dome rising (measured edge + colour profile) and "Build with" typing in from a 2.6× zoom (measured)
let DM;
async function loadDome() { DM = await (await fetch('ref/dome_model.json')).json(); }
function domeScene(c, t) {
  c.fillStyle = '#FDFDFD'; c.fillRect(0, 0, W, H);
  const top = seg(t, [[10.82, 1080], [10.863, 749, 'o'], [10.9, 575, 'o'], [11.0, 555, 's'], [11.28, 545, 's']]), R = 830, cy = top + R, S = DM.stops, d0 = S[0][0], d1 = S[S.length - 1][0];
  const g = c.createRadialGradient(958, cy, R + d0, 958, cy, R + d1);
  for (const [d, col] of S) g.addColorStop((d - d0) / (d1 - d0), `rgb(${col.map(Math.round).join(',')})`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const k = seg(t, [[10.833, 2.6], [11.17, 1, 'o']]); c.save(); cam(c, k, 960, 545);
  c.font = `700 128px ${DISP}`; typeLetters(c, t, 'Build with', 10.78, 11.06, 960 - c.measureText('Build with').width / 2, 545, `700 128px ${DISP}`, '#262626');
  c.restore(); return 0;
}
