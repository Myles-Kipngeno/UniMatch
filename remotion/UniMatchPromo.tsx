import React from 'react'
import { useCurrentFrame } from 'remotion'
import { SCENE_RANGES, VIDEO_CONFIG } from './types'
import { Scene1Hook } from './scenes/Scene1Hook'
import { Scene2Verification } from './scenes/Scene2Verification'
import { Scene3Onboarding } from './scenes/Scene3Onboarding'
import { Scene4CampusPulse } from './scenes/Scene4CampusPulse'
import { Scene5DiscoveryDeck } from './scenes/Scene5DiscoveryDeck'
import { Scene6MatchMoment } from './scenes/Scene6MatchMoment'
import { Scene7Chat } from './scenes/Scene7Chat'
import { Scene8Outro } from './scenes/Scene8Outro'

interface PromoProps {
  currentFrame?: number
}

export const UniMatchPromo: React.FC<PromoProps> = ({ currentFrame }) => {
  let frame = currentFrame ?? 0
  try {
    const rf = useCurrentFrame()
    if (typeof rf === 'number') {
      frame = rf
    }
  } catch {
    frame = currentFrame ?? 0
  }

  // Render the appropriate scene based on the 140 BPM timeline
  if (frame < SCENE_RANGES.scene2Verification.from) {
    return <Scene1Hook frame={frame} />
  }

  if (frame < SCENE_RANGES.scene3Onboarding.from) {
    return <Scene2Verification frame={frame - SCENE_RANGES.scene2Verification.from} />
  }

  if (frame < SCENE_RANGES.scene4CampusPulse.from) {
    return <Scene3Onboarding frame={frame - SCENE_RANGES.scene3Onboarding.from} />
  }

  if (frame < SCENE_RANGES.scene5DiscoveryDeck.from) {
    return <Scene4CampusPulse frame={frame - SCENE_RANGES.scene4CampusPulse.from} />
  }

  if (frame < SCENE_RANGES.scene6MatchMoment.from) {
    return <Scene5DiscoveryDeck frame={frame - SCENE_RANGES.scene5DiscoveryDeck.from} />
  }

  if (frame < SCENE_RANGES.scene7Chat.from) {
    return <Scene6MatchMoment frame={frame - SCENE_RANGES.scene6MatchMoment.from} />
  }

  if (frame < SCENE_RANGES.scene8Outro.from) {
    return <Scene7Chat frame={frame - SCENE_RANGES.scene7Chat.from} />
  }

  return <Scene8Outro frame={frame - SCENE_RANGES.scene8Outro.from} />
}

export default UniMatchPromo
