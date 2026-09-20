import { describe, expect, it } from 'vitest'
import {
  alwaysPreparedPatch,
  dmSpellStatusLabel,
  matchesDmSpellView,
  type SpellAssignmentState,
} from './spellAssignments'

const assignment = (overrides: Partial<SpellAssignmentState> = {}): SpellAssignmentState => ({
  spell_id: 'spell-id',
  in_collection: true,
  is_prepared: false,
  always_prepared: false,
  assigned_by_dm: true,
  ...overrides,
})

describe('always-prepared assignment updates', () => {
  it('also prepares a spell when always prepared is enabled', () => {
    expect(alwaysPreparedPatch(true)).toEqual({
      always_prepared: true,
      is_prepared: true,
    })
  })

  it('keeps the current prepared state when always prepared is disabled', () => {
    expect(alwaysPreparedPatch(false)).toEqual({ always_prepared: false })
  })
})

describe('DM spell-assignment views', () => {
  it('filters the full library down to a character’s current spell states', () => {
    const prepared = assignment({ is_prepared: true })
    const always = assignment({ is_prepared: true, always_prepared: true })
    const unprepared = assignment()

    expect(matchesDmSpellView(undefined, 'all', false)).toBe(true)
    expect(matchesDmSpellView(undefined, 'assigned', false)).toBe(false)
    expect(matchesDmSpellView(prepared, 'prepared', false)).toBe(true)
    expect(matchesDmSpellView(always, 'always', false)).toBe(true)
    expect(matchesDmSpellView(unprepared, 'unprepared', false)).toBe(true)
    expect(matchesDmSpellView(unprepared, 'spellbook', true)).toBe(true)
    expect(matchesDmSpellView(unprepared, 'spellbook', false)).toBe(false)
  })

  it('describes the status shown on each DM spell card', () => {
    expect(dmSpellStatusLabel(assignment({ is_prepared: true, always_prepared: true }), false)).toBe('Always prepared')
    expect(dmSpellStatusLabel(assignment({ is_prepared: true }), false)).toBe('Prepared now')
    expect(dmSpellStatusLabel(assignment(), true)).toBe('In spellbook · not prepared')
    expect(dmSpellStatusLabel(assignment(), false)).toBe('Assigned · not active')
    expect(dmSpellStatusLabel(undefined, false)).toBeUndefined()
  })
})
