export type ThemeKey = 'classic' | 'spelljammer' | 'tomb'

export const THEME_OPTIONS: Array<{
  value: ThemeKey
  label: string
  description: string
}> = [
  {
    value: 'classic',
    label: 'Classic Compendium',
    description: 'Clean navy, parchment, and gold for any campaign.',
  },
  {
    value: 'spelljammer',
    label: 'Spelljammer',
    description: 'Deep wildspace purple with starlight blue accents.',
  },
  {
    value: 'tomb',
    label: 'Tomb of Annihilation',
    description: 'Jungle green, weathered parchment, and ancient gold.',
  },
]

const themeKeys = new Set<ThemeKey>(THEME_OPTIONS.map((theme) => theme.value))

export const normalizeThemeKey = (value: unknown): ThemeKey =>
  typeof value === 'string' && themeKeys.has(value as ThemeKey)
    ? value as ThemeKey
    : 'classic'
