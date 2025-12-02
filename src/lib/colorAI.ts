
import sentiment from 'wink-sentiment'

export function colorFromTitle(title: string): string {
  const s = sentiment(title || '')
  const clamped = Math.max(-5, Math.min(5, s.score))
  // Map score [-5,5] -> hue [210, 330] (blue to magenta)
  const hue = 270 + clamped * 12
  const sat = 70
  const light = 60
  return `hsl(${Math.round(hue)}, ${sat}%, ${light}%)`
}

export type GummyKind = 'circle' | 'capsule' | 'star'
export function kindFromTitle(title: string): GummyKind {
  const t = (title || '').toLowerCase()
  if (t.includes('試験') || t.includes('study') || t.includes('勉強')) return 'star'
  if (t.includes('mtg') || t.includes('meeting') || t.includes('会議')) return 'capsule'
  return 'circle'
}
