// Ground truth for the camera tracker: a static UI filmed by a 2D camera that zooms, pans, tilts and whips back.
const row = (y, label, value) => [
  { name: label, type: 'text', text: label, size: 34, weight: 500, fill: '#B9B2AA', align: 'left', position: [520, y] },
  { name: label + 'v', type: 'text', text: value, size: 34, weight: 700, fill: '#F4EDE6', align: 'right', position: [1400, y] }];
const COMP = {
  background: '#0E0D0C', fonts: ['500 30px Inter', '700 30px Inter', '400 30px Source Serif 4'],
  camera: {
    scale: [[1.0, 100], [1.4, 180, 'out'], [2.5, 180], [2.8, 100, 'whip']],
    anchor: [[1.0, [960, 540]], [1.4, [760, 420], 'out'], [2.0, [760, 420]], [2.5, [820, 470], 'smooth'], [2.8, [960, 540], 'whip']],
    rotation: [[1.0, 0], [1.4, -4, 'out'], [2.5, -4], [2.8, 0, 'whip']],
  },
  layers: [
    { name: 'head', type: 'text', text: 'Welcome, yowerse', font: 'Source Serif 4', weight: 400, size: 88, fill: '#F4EDE6', position: [960, 300] },
    ...row(470, 'Revenue', '$12,304'), ...row(560, 'Users', '18,240'), ...row(650, 'Churn', '2.1%'),
    { name: 'btn', type: 'rect', size: [260, 70], radius: 35, fill: '#D97757', position: [960, 800] },
    { name: 'btnt', type: 'text', text: 'Get started', size: 30, weight: 700, fill: '#fff', position: [960, 800] },
    { name: 'panel', type: 'rect', size: [1100, 420], radius: 32, fill: '#1C1A18', stroke: '#2C2A27', strokeWidth: 2, position: [960, 560] },
    { name: 'grid', type: 'custom', draw: (c) => { c.strokeStyle = 'rgba(217,119,87,0.25)'; c.lineWidth = 2; for (let x = -900; x <= 900; x += 120) { c.beginPath(); c.moveTo(x, -560); c.lineTo(x, 560); c.stroke(); } for (let y = -540; y <= 540; y += 120) { c.beginPath(); c.moveTo(-1000, y); c.lineTo(1000, y); c.stroke(); } } },
  ],
};
