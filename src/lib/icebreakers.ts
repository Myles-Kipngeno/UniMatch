export const ICEBREAKERS = [
  "What's your dream vacation?",
  "What would you do if money wasn't an issue?",
  "Describe your perfect Sunday morning.",
  "What's the best meal you've ever had?",
  "What three things can you not live without?"
]

export function getRandomIcebreakers(count: number = 3): string[] {
  const shuffled = [...ICEBREAKERS].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}
