// One 60-second seamless loop per piece; video/make.mjs repeats the loop to the track length and adds the audio.
// Props must be JSON, so compositions pass the scene id and PixelScene looks up its draw function.
import { Composition } from 'remotion';
import { PixelScene } from './PixelScene.jsx';
import { SCENES } from './scenes/index.js';

export const FPS = 30, LOOP_SECONDS = 60;

export const RemotionRoot = () => (
  <>
    {Object.keys(SCENES).map(id => (
      <Composition key={id} id={id} component={PixelScene} defaultProps={{ scene: id }}
        durationInFrames={FPS * LOOP_SECONDS} fps={FPS} width={1920} height={1080} />
    ))}
  </>
);
