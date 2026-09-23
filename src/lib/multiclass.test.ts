import { describe, expect, it } from 'vitest'
import { casterLevelContribution, sharedSpellSlots, validateCharacterClasses } from './multiclass'

const level = (class_key: string, class_level: number, subclass: string | null = null, is_primary = false) => ({
  class_key,
  class_level,
  subclass,
  is_primary,
})

describe('2024 multiclass spellcasting', () => {
  it('combines Paladin and Cleric slot contributions but not their spell access', () => {
    const slots = sharedSpellSlots([
      level('paladin', 5, null, true),
      level('cleric', 4),
    ])

    expect(slots.casterLevel).toBe(7)
    expect(slots.slots).toEqual([4, 3, 3, 1])
  })

  it('rounds 2024 half-caster contributions up, including the 2025 Artificer', () => {
    expect(casterLevelContribution(level('paladin', 3))).toBe(2)
    expect(casterLevelContribution(level('ranger', 3))).toBe(2)
    expect(casterLevelContribution(level('artificer', 5))).toBe(3)
  })

  it('only counts Fighter and Rogue levels for their spellcasting subclasses', () => {
    expect(casterLevelContribution(level('fighter', 7, 'Champion'))).toBe(0)
    expect(casterLevelContribution(level('fighter', 7, 'Eldritch Knight'))).toBe(2)
    expect(casterLevelContribution(level('rogue', 8, 'Arcane Trickster'))).toBe(2)
  })

  it('keeps Warlock Pact Magic separate from shared Spellcasting slots', () => {
    const slots = sharedSpellSlots([
      level('cleric', 4, null, true),
      level('warlock', 5),
    ])
    expect(slots.casterLevel).toBe(4)
    expect(slots.slots).toEqual([4, 3])
    expect(slots.pactMagic).toEqual({ classLevel: 5, slots: 2, slotLevel: 3 })
  })
})

describe('multiclass build validation', () => {
  it('requires unique classes, one primary class, and at most 20 total levels', () => {
    expect(validateCharacterClasses([level('cleric', 4, null, true), level('paladin', 5)])).toBeNull()
    expect(validateCharacterClasses([level('cleric', 4, null, true), level('cleric', 1)])).toMatch(/once/)
    expect(validateCharacterClasses([level('cleric', 4), level('paladin', 5)])).toMatch(/primary/)
    expect(validateCharacterClasses([level('cleric', 16, null, true), level('paladin', 5)])).toMatch(/20/)
  })
})
