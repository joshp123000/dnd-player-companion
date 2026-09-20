import { describe, expect, it } from 'vitest'
import { normalizeThemeKey, THEME_OPTIONS } from './themes'

describe('account themes', () => {
  it('includes the three player-facing styles', () => {
    expect(THEME_OPTIONS.map((theme) => theme.value)).toEqual(['classic', 'spelljammer', 'tomb'])
  })

  it('falls back to the readable classic theme for unknown metadata', () => {
    expect(normalizeThemeKey('spelljammer')).toBe('spelljammer')
    expect(normalizeThemeKey('unknown')).toBe('classic')
    expect(normalizeThemeKey(null)).toBe('classic')
  })
})
