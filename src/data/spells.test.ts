import { describe, expect, it } from 'vitest'
import spells from '../../public/data/spells.json'

describe('SRD spell import', () => {
  it('contains the complete normalized source list', () => {
    expect(spells).toHaveLength(339)
    expect(new Set(spells.map((spell) => spell.slug)).size).toBe(spells.length)
  })

  it('contains usable structured card fields', () => {
    for (const spell of spells) {
      expect(spell.name.length).toBeGreaterThan(0)
      expect(spell.level).toBeGreaterThanOrEqual(0)
      expect(spell.level).toBeLessThanOrEqual(9)
      expect(spell.description.length).toBeGreaterThan(0)
      expect(Array.isArray(spell.classes)).toBe(true)
      expect(Array.isArray(spell.components)).toBe(true)
      expect(spell.source_type).toBe('srd')
    }
  })

  it('tags the SRD-overlapping Artificer list', () => {
    const artificerSpells = spells.filter((spell) => spell.classes.includes('artificer'))
    const artificerNames = new Set(artificerSpells.map((spell) => spell.name))

    expect(artificerSpells).toHaveLength(74)
    expect(artificerNames.has('Acid Splash')).toBe(true)
    expect(artificerNames.has('Cure Wounds')).toBe(true)
    expect(artificerNames.has('Arcane Hand')).toBe(true)
    expect(artificerNames.has('Mending')).toBe(true)
    expect(artificerNames.has('Fireball')).toBe(false)
  })
})
