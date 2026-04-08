const adjectives = [
  'amber',
  'brisk',
  'calm',
  'clever',
  'daring',
  'eager',
  'gentle',
  'keen',
  'lively',
  'lucid',
  'nimble',
  'quiet',
  'steady',
  'swift',
  'vivid',
  'wise'
]

const nouns = [
  'anchor',
  'beacon',
  'bridge',
  'compass',
  'falcon',
  'forge',
  'harbor',
  'lantern',
  'meadow',
  'otter',
  'pine',
  'quartz',
  'river',
  'signal',
  'spruce',
  'trail'
]

const sample = (values: string[]): string =>
  values[Math.floor(Math.random() * values.length)] ?? 'assistant'

export const generateAssistantTitle = (): string => `${sample(adjectives)}_${sample(nouns)}`
