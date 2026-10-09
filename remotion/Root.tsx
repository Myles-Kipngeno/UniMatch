import React from 'react'
import { Composition } from 'remotion'
import { VIDEO_CONFIG } from './types'
import { UniMatchPromo } from './UniMatchPromo'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="UniMatchPromo"
      component={UniMatchPromo}
      durationInFrames={VIDEO_CONFIG.totalFrames}
      fps={VIDEO_CONFIG.fps}
      width={VIDEO_CONFIG.width}
      height={VIDEO_CONFIG.height}
    />
  )
}

export default RemotionRoot
