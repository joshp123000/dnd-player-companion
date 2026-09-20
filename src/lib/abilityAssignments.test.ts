import { describe, expect, it } from 'vitest'
import {
  matchesDmAbilityView,
  matchesDmMagicItemView,
  type AbilityAssignmentState,
} from './abilityAssignments'

const assignment = (
  assignment_type: AbilityAssignmentState['assignment_type'],
  is_enabled = true,
): AbilityAssignmentState => ({ assignment_type, is_enabled })

describe('DM magic-item assignment views', () => {
  it('separates assigned and unassigned items', () => {
    expect(matchesDmMagicItemView(undefined, 'all')).toBe(true)
    expect(matchesDmMagicItemView(assignment('dm_included'), 'assigned')).toBe(true)
    expect(matchesDmMagicItemView(undefined, 'assigned')).toBe(false)
    expect(matchesDmMagicItemView(undefined, 'unassigned')).toBe(true)
  })
})

describe('DM ability assignment views', () => {
  it('distinguishes currently shown, automatic, DM-added, and hidden cards', () => {
    const automatic = assignment('automatic')
    const dmAdded = assignment('dm_included')
    const hidden = assignment('dm_excluded', false)

    expect(matchesDmAbilityView(automatic, 'shown')).toBe(true)
    expect(matchesDmAbilityView(automatic, 'automatic')).toBe(true)
    expect(matchesDmAbilityView(dmAdded, 'dm_added')).toBe(true)
    expect(matchesDmAbilityView(hidden, 'hidden')).toBe(true)
    expect(matchesDmAbilityView(hidden, 'not_shown')).toBe(true)
    expect(matchesDmAbilityView(undefined, 'not_shown')).toBe(true)
    expect(matchesDmAbilityView(undefined, 'shown')).toBe(false)
  })
})
