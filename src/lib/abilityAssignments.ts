import type { AbilityAssignmentType } from '../types'

export type DmMagicItemView = 'all' | 'assigned' | 'unassigned'
export type DmAbilityView = 'all' | 'shown' | 'automatic' | 'dm_added' | 'hidden' | 'not_shown'

export interface AbilityAssignmentState {
  assignment_type: AbilityAssignmentType
  is_enabled: boolean
}

export const matchesDmMagicItemView = (
  assignment: AbilityAssignmentState | undefined,
  view: DmMagicItemView,
) => {
  if (view === 'all') return true
  if (view === 'assigned') return Boolean(assignment?.is_enabled)
  return !assignment?.is_enabled
}

export const matchesDmAbilityView = (
  assignment: AbilityAssignmentState | undefined,
  view: DmAbilityView,
) => {
  if (view === 'all') return true
  if (view === 'shown') return Boolean(assignment?.is_enabled)
  if (view === 'automatic') return assignment?.is_enabled === true && assignment.assignment_type === 'automatic'
  if (view === 'dm_added') return assignment?.is_enabled === true && assignment.assignment_type === 'dm_included'
  if (view === 'hidden') return assignment?.assignment_type === 'dm_excluded'
  return !assignment?.is_enabled
}
