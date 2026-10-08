// Demo comp: every move lands on a detected hit of the song (beats.json from tools/beats.py).
// This file is the only thing an agent writes: layers, keyframes, eases, effects. No drawing code.
const CORAL = '#D97757', CREAM = '#F4EDE6';

// a small dashboard card, built as a precomp so it moves, blurs and casts a shadow as one layer
const card = (title, value, accent, fillAt) => [
  { name: 'value', type: 'text', text: value, font: 'Inter', weight: 700, size: 58, fill: '#1A1A1A', align: 'left', position: [-250, -40] },
  { name: 'title', type: 'text', text: title, font: 'Inter', weight: 500, size: 24, fill: '#8A8580', align: 'left', position: [-250, -110] },
  { name: 'fill', type: 'rect', pivot: [0, .5], position: [-250, 60], radius: 7, fill: accent,
    size: [[fillAt, [0, 14]], [fillAt + '+0.6', [360, 14], 'out']] },
  { name: 'bar', type: 'rect', size: [500, 14], radius: 7, fill: '#EFEAE4', position: [0, 60] },
  { name: 'bg', type: 'rect', size: [600, 320], radius: 28, fill: '#FFFFFF' },
];

const COMP = {
  background: '#0B0A09',
  beats: 'beats.json',
  fonts: ['600 30px Inter', '700 30px Inter', '500 30px Inter', '700 30px DM Sans', '400 30px Source Serif 4'],
  motionBlurSamples: 16, shutterAngle: 180,
  // 2D camera: look at `anchor`, put it at `position`, zoom with `scale`
  camera: {
    scale: { keys: [['beat:9', 100], ['beat:10', 112, 'out'], ['beat:15', 112], ['beat:16', 100, 'whip']] },
    anchor: [['beat:9', [960, 540]], ['beat:10', [1180, 560], 'out'], ['beat:15', [1180, 560]], ['beat:16', [960, 540], 'whip']],
  },
  layers: [
    // ---- outro: everything collapses into the mark on the last hit
    { name: 'outroMark', type: 'path', logo: 'claude', fill: CORAL, in: 'beat:19', size: 140,
      scale: [['beat:19', 0], ['beat:19+0.35', 100, 'pop']], rotation: [['beat:19', -90], ['beat:21', 0, 'out']],
      effects: [{ type: 'glow', radius: 24, intensity: .9 }] },
    { name: 'outroText', type: 'text', text: 'reelsmith motion', font: 'DM Sans', weight: 700, size: 72, fill: CREAM, in: 'beat:20', position: [960, 700],
      animator: { by: 'char', start: 'beat:20', stagger: .025, dur: .45, ease: 'out', from: { opacity: 0, y: 40, blur: 10 } } },

    // ---- feature list, word by word on the beat
    { name: 'features', type: 'text', text: 'keyframes · springs · glow · motion blur · beat sync', font: 'Inter', weight: 500, size: 38, fill: '#B9B2AA',
      position: [960, 900], in: 'beat:11', out: 'beat:19',
      animator: { by: 'word', start: 'beat:11', stagger: .1, dur: .4, ease: 'back', from: { opacity: 0, y: 30, scale: 70 } },
      opacity: [['beat:18', 100], ['beat:19', 0, 'in']] },

    // ---- two cards whip in with inertial bounce + motion blur
    { name: 'card2', type: 'group', layers: card('Users this week', '18,240', '#7DA7F0', 'beat:12'), in: 'beat:12-0.4', out: 'beat:19',
      position: { keys: [['beat:12-0.4', [2500, 600]], ['beat:12', [1480, 600], 'in']], bounce: { amp: .045, freq: 2.2, decay: 7 } },
      rotation: { keys: [['beat:12-0.4', 14], ['beat:12', 4, 'in']], bounce: { amp: .05, freq: 2.2, decay: 7 } },
      scale: [['beat:18', 100], ['beat:19', 0, 'anticipate']],
      motionBlur: true, effects: [{ type: 'shadow', blur: 60, y: 30, color: 'rgba(0,0,0,0.45)' }] },
    { name: 'card1', type: 'group', layers: card('Revenue', '$12,304', CORAL, 'beat:9'), in: 'beat:9-0.4', out: 'beat:19',
      position: { keys: [['beat:9-0.4', [-600, 520]], ['beat:9', [900, 520], 'in']], bounce: { amp: .045, freq: 2.2, decay: 7 } },
      rotation: { keys: [['beat:9-0.4', -12], ['beat:9', -3, 'in']], bounce: { amp: .05, freq: 2.2, decay: 7 } },
      scale: [['beat:18', 100], ['beat:19', 0, 'anticipate']],
      motionBlur: true, effects: [{ type: 'shadow', blur: 60, y: 30, color: 'rgba(0,0,0,0.45)' }] },

    // ---- title: per-character animator, then a light sweep through it (track matte)
    { name: 'sweep', type: 'rect', size: [180, 300], fill: '#FFFFFF', rotation: 20,
      position: [['beat:7', [300, 330]], ['beat:8', [1650, 330], 'inOut']] },
    { name: 'titleShine', type: 'text', text: 'After Effects, for agents', font: 'DM Sans', weight: 700, size: 104, fill: '#FFE3D2', position: [960, 330],
      in: 'beat:7', out: 'beat:8', blend: 'add', matte: { layer: 'sweep', mode: 'alpha' }, effects: [{ type: 'glow', radius: 20, intensity: .8 }] },
    { name: 'title', type: 'text', text: 'After Effects, for agents', font: 'DM Sans', weight: 700, size: 104, fill: CREAM, position: [960, 330],
      in: 'beat:4', out: 'beat:9-0.1',
      animator: { by: 'char', start: 'beat:4', stagger: .022, dur: .5, ease: 'out', from: { opacity: 0, y: 70, blur: 14, rotation: 8 } },
      position: [['beat:8', [960, 330]], ['beat:9-0.1', [960, 180], 'whip']], opacity: [['beat:8+0.2', 100], ['beat:9-0.1', 0, 'in']] },

    // ---- the mark: pops on a hit, breathes with wiggle, glows, spins away with motion blur
    { name: 'mark', type: 'path', logo: 'claude', fill: CORAL, out: 'beat:9',
      position: [['beat:3', [960, 540]], ['beat:4', [960, 640], 'out']],
      scale: { keys: [['beat:2', 0], ['beat:2+0.5', 260, 'pop'], ['beat:4', 260], ['beat:4+0.3', 150, 'out'], ['beat:8', 150], ['beat:9-0.3', 0, 'anticipate']] },
      rotation: { keys: [['beat:2', -120], ['beat:3', 0, 'out'], ['beat:8', 0], ['beat:9-0.3', 360, 'in']], wiggle: { freq: 1.2, amp: 3 } },
      size: 120, motionBlur: true, effects: [{ type: 'glow', radius: 30, intensity: [['beat:2', 0], ['beat:3', 1.1, 'out'], ['beat:5', .6]] }] },

    // ---- background: warm glow that pumps on every hit from 4 on
    { name: 'pulse', type: 'ellipse', size: [1500, 1500], position: [960, 600], blend: 'add',
      fill: { radial: [0, 0, 0, 750], stops: [[0, 'rgba(217,119,87,0.32)'], [1, 'rgba(217,119,87,0)']] },
      scale: (t) => { let s = 100; for (const h of MOTION.hits) if (t >= h && h > 1.6) s = 100 + 9 * Math.exp(-(t - h) * 7); return s; },
      opacity: [['beat:1', 0], ['beat:3', 100, 'smooth'], ['beat:21', 100], ['beat:21+0.6', 0]] },
  ],
};
