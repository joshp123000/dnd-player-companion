import { describe, expect, it } from 'vitest'
import type { Character } from '../types'
import {
  CHARACTER_CLASSES,
  SPELLCASTING_CLASSES,
  defaultProgression,
  effectiveLimits,
  spellLevelLabel,
} from './rules'

const character = (changes: Partial<Character> = {}): Character => ({
  id: 'character-id',
  user_id: 'user-id',
  campaign_id: 'campaign-id',
  login_username: 'player',
  name: 'Test Hero',
  class_key: 'wizard',
  subclass: null,
  level: 5,
  notes: null,
  preparation_unlocked: false,
  choices_unlocked: false,
  max_cantrips_override: null,
  max_prepared_override: null,
  max_spell_level_override: null,
  created_at: '',
  updated_at: '',
  ...changes,
})

describe('class progression', () => {
  it('uses the printed 2025 Artificer progression', () => {
    expect(CHARACTER_CLASSES).toContain('artificer')
    expect(SPELLCASTING_CLASSES).toContain('artificer')
    expect(defaultProgression('artificer', 1)).toMatchObject({
      cantrips: 2,
      prepared_spells: 2,
      max_spell_level: 1,
      selection_mode: 'daily',
    })
    expect(defaultProgression('artificer', 14)).toMatchObject({
      cantrips: 4,
      prepared_spells: 11,
      max_spell_level: 4,
      selection_mode: 'daily',
    })
    expect(defaultProgression('artificer', 20)).toMatchObject({
      cantrips: 4,
      prepared_spells: 15,
      max_spell_level: 5,
      selection_mode: 'daily',
    })
  })

  it('returns Wizard level 5 limits', () => {
    expect(defaultProgression('wizard', 5)).toMatchObject({
      cantrips: 4,
      prepared_spells: 9,
      max_spell_level: 3,
      selection_mode: 'spellbook',
    })
  })

  it('uses Paladin half-caster progression', () => {
    expect(defaultProgression('paladin', 9)).toMatchObject({
      cantrips: 0,
      prepared_spells: 9,
      max_spell_level: 3,
      selection_mode: 'daily',
    })
  })

  it('lets the DM override individual limits', () => {
    expect(effectiveLimits(character({ max_prepared_override: 12, max_spell_level_override: 4 }))).toMatchObject({
      cantrips: 4,
      preparedSpells: 12,
      maxSpellLevel: 4,
      selectionMode: 'spellbook',
    })
  })

  it('handles a non-spellcasting class', () => {
    expect(effectiveLimits(character({ class_key: 'fighter' }))).toEqual({
      cantrips: 0,
      preparedSpells: 0,
      maxSpellLevel: 0,
      selectionMode: 'none',
    })
  })
})

describe('spell level labels', () => {
  it.each([[0, 'Cantrip'], [1, '1st level'], [2, '2nd level'], [3, '3rd level'], [4, '4th level']])(
    'formats level %i',
    (level, expected) => expect(spellLevelLabel(level)).toBe(expected),
  )
})
