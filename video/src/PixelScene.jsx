// Draws one pixel-art scene per frame on a low-resolution canvas, scaled to 1080p, with a small lofi title.
import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/PressStart2P';
import { W, H } from './px.js';
import { SCENES } from './scenes/index.js';

const { fontFamily } = loadFont();

export const PixelScene = ({ scene }) => {
  const { draw, title, accent } = SCENES[scene];
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ref = useRef(null);
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    draw(ctx, frame / durationInFrames, frame);
  }, [frame, draw, durationInFrames]);
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <canvas ref={ref} width={W} height={H} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
      <div style={{ position: 'absolute', left: 56, top: 48, fontFamily, color: '#fff', textShadow: '4px 4px 0 rgba(0,0,0,0.55)', opacity: 0.9 }}>
        <div style={{ fontSize: 34, letterSpacing: 2 }}>{title}</div>
        <div style={{ fontSize: 16, marginTop: 18, color: accent, opacity: 0.85 }}>music mania</div>
      </div>
    </AbsoluteFill>
  );
};
