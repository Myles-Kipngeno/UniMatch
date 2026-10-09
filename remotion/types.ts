export const VIDEO_CONFIG = {
  fps: 60,
  width: 1080,
  height: 1920,
  durationInSeconds: 45,
  totalFrames: 45 * 60, // 2700 frames
  bpm: 140,
  framesPerBeat: 25.714,
  framesPerBar: 102.857,
} as const

export const SCENE_RANGES = {
  scene1Hook: { from: 0, duration: 205 }, // 0:00.0 - 0:03.4
  scene2Verification: { from: 206, duration: 310 }, // 0:03.4 - 0:08.6
  scene3Onboarding: { from: 516, duration: 410 }, // 0:08.6 - 0:15.4
  scene4CampusPulse: { from: 926, duration: 414 }, // 0:15.4 - 0:22.3
  scene5DiscoveryDeck: { from: 1340, duration: 410 }, // 0:22.3 - 0:29.1
  scene6MatchMoment: { from: 1750, duration: 310 }, // 0:29.1 - 0:34.3
  scene7Chat: { from: 2060, duration: 308 }, // 0:34.3 - 0:39.4
  scene8Outro: { from: 2368, duration: 332 }, // 0:39.4 - 0:45.0
} as const

export const THEME = {
  bg: '#0b0914',
  cardBg: 'rgba(20, 17, 38, 0.75)',
  purple: '#7c3aed',
  purpleGlow: 'rgba(124, 58, 237, 0.5)',
  neonViolet: '#a78bfa',
  neonPink: '#ec4899',
  white: '#ffffff',
  gray: '#94a3b8',
  verifiedGreen: '#10b981',
} as const
