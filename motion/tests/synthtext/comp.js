// Ground truth for text-animator analysis: one per-letter animator, one per-word animator.
const COMP = {
  background: '#101014', fonts: ['700 30px DM Sans', '500 30px Inter'],
  layers: [
    { name: 'title', type: 'text', text: 'After Effects for agents', font: 'DM Sans', weight: 700, size: 110, fill: '#F4EDE6', position: [960, 380],
      animator: { by: 'char', start: 0.5, stagger: .03, dur: .5, ease: 'out', from: { opacity: 0, y: 70, blur: 10 } } },
    { name: 'sub', type: 'text', text: 'keyframes springs glow motion blur', font: 'Inter', weight: 500, size: 56, fill: '#D97757', position: [960, 700],
      animator: { by: 'word', start: 1.6, stagger: .12, dur: .4, ease: 'back', from: { opacity: 0, scale: 60 } } },
  ],
};
