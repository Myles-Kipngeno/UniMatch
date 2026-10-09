import React from 'react'
import { VIDEO_CONFIG } from './types'
import { UniMatchPromo } from './UniMatchPromo'

// Standard Remotion Root component structure
// If @remotion/cli is used, this will register the composition
export const RemotionRoot: React.FC = () => {
  return (
    <div style={{ width: VIDEO_CONFIG.width, height: VIDEO_CONFIG.height }}>
      <UniMatchPromo currentFrame={0} />
    </div>
  )
}

export default RemotionRoot
