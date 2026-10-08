// Ground truth for perspective tracking: 3D tilts, a flip-up and a push back in depth, each with a known ease.
const COMP = {
  background: '#101014', fonts: ['700 30px Inter', '500 30px Inter'], motionBlurSamples: 12,
  layers: [
    { name: 'flipper', type: 'group', threeD: true, position: [1480, 780, 0], motionBlur: true,
      rotationX: [[1.5, 0], [2.1, 50, 'back']],
      layers: [
        { name: 'l', type: 'text', text: 'FLIP', size: 64, weight: 700, fill: '#101014' },
        { name: 'b', type: 'rect', size: [260, 260], radius: 36, fill: { linear: [-130, -130, 130, 130], stops: [[0, '#F2A07F'], [1, '#7DA7F0']] } }] },
    { name: 'tilt', type: 'group', threeD: true, motionBlur: true,
      position: [[0.5, [900, 420, 0]], [1.3, [900, 420, 0]], [2.5, [900, 420, 0]], [3.2, [900, 420, 400], 'inOut']],
      rotationY: [[0.5, 70], [1.3, 0, 'out'], [2.5, 0], [3.2, -35, 'inOut']],
      rotationX: [[0.5, 25], [1.3, 0, 'out']],
      layers: [
        { name: 't', type: 'text', text: 'Revenue', size: 44, weight: 700, fill: '#222', align: 'left', position: [-210, -90] },
        { name: 'v', type: 'text', text: '$12,304', size: 72, weight: 700, fill: '#111', align: 'left', position: [-210, 0] },
        { name: 'bar', type: 'rect', size: [420, 18], radius: 9, fill: '#D97757', position: [0, 100] },
        { name: 'bg', type: 'rect', size: [520, 320], radius: 28, fill: '#FFFFFF' }] },
  ],
};
