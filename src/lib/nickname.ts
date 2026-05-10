const ADJ  = ['Fit', 'Iron', 'Peak', 'Bold', 'Swift', 'Lean', 'Wild', 'Apex', 'Pure', 'Fast']
const NOUN = ['Fox', 'Wolf', 'Bear', 'Hawk', 'Lion', 'Rook', 'Crane', 'Bull', 'Lynx', 'Stag']

export function getNickname(userId: string): string {
  let h = 2166136261
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i)
    h = (Math.imul(h, 16777619)) >>> 0
  }
  const adj  = ADJ[h % ADJ.length]
  const noun = NOUN[(h >>> 4) % NOUN.length]
  const num  = ((h >>> 8) % 90) + 10
  return `${adj}${noun}${num}`
}
