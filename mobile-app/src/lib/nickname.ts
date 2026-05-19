const ADJECTIVES = ['Iron', 'Steel', 'Swift', 'Bold', 'Apex', 'Peak', 'Core', 'Prime', 'Force', 'Flex', 'Surge', 'Alpha']
const NOUNS = ['Lifter', 'Athlete', 'Beast', 'Warrior', 'Runner', 'Titan', 'Grinder', 'Chaser', 'Crusher', 'Racer']

export function getNickname(seed?: string): string {
  return generateNickname(seed)
}

export function generateNickname(seed?: string): string {
  const hash = seed ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) : Math.floor(Math.random() * 10000)
  const adj = ADJECTIVES[hash % ADJECTIVES.length]
  const noun = NOUNS[(hash >> 3) % NOUNS.length]
  const num = (hash % 99) + 1
  return `${adj}${noun}${num}`
}
