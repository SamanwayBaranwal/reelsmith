// Ground-truth comp: each element uses one known animation, so the analyser can be scored against it.
const COMP = {
  background: '#101014', fonts: ['700 30px Inter'], motionBlurSamples: 16,
  layers: [
    { name: 'card', type: 'group', motionBlur: true,
      position: { keys: [[0.6, [-300, 300]], [1.0, [700, 300], 'in'], [4.5, [700, 300]], [5.0, [700, -300], 'whip']], bounce: { amp: .05, freq: 2.5, decay: 6 } },
      layers: [
        { name: 't', type: 'text', text: 'Revenue', size: 40, weight: 700, fill: '#222', position: [0, -40] },
        { name: 'b', type: 'rect', size: [300, 16], radius: 8, fill: '#D97757', position: [0, 50] },
        { name: 'bg', type: 'rect', size: [400, 260], radius: 24, fill: '#FFFFFF' }] },
    { name: 'mark', type: 'path', logo: 'claude', fill: '#D97757', size: 200, position: [1400, 300],
      scale: [[1.2, 0], [1.7, 100, 'pop']], rotation: [[1.2, -90], [1.8, 0, 'out']] },
    { name: 'title', type: 'text', text: 'Hello agents', size: 90, weight: 700, fill: '#F4EDE6',
      position: [[2.0, [960, 820]], [2.6, [960, 750], 'out']], opacity: [[2.0, 0], [2.6, 100, 'smooth']] },
    { name: 'box', type: 'rect', size: [260, 260], radius: 30, fill: { linear: [-130, -130, 130, 130], stops: [[0, '#F2A07F'], [1, '#7DA7F0']] }, position: [400, 800],
      rotation: [[3.0, 0], [3.8, 180, 'inOut']], scale: [[3.0, 100], [3.6, 60, 'back']] },
  ],
};
