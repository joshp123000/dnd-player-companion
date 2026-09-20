import { describe, expect, it } from 'vitest'
import { advancementFieldsForLevel } from './spellAdvancement'

describe('spell advancement fields', () => {
  it('keeps only cantrip advancement for cantrips', () => {
    expect(advancementFieldsForLevel(0, 'Stale slot text', 'Cantrip text')).toEqual({
      higher_level: null,
      cantrip_upgrade: 'Cantrip text',
    })
  })

  it('keeps only higher-level advancement for leveled spells', () => {
    expect(advancementFieldsForLevel(1, 'Slot text', 'Stale cantrip text')).toEqual({
      higher_level: 'Slot text',
      cantrip_upgrade: null,
    })
  })
})
