export const alwaysPreparedPatch = (alwaysPrepared: boolean) => alwaysPrepared
  ? { always_prepared: true, is_prepared: true }
  : { always_prepared: false }

export type DmSpellView = 'all' | 'assigned' | 'prepared' | 'always' | 'unprepared' | 'spellbook'

export interface SpellAssignmentState {
  spell_id: string
  in_collection: boolean
  is_prepared: boolean
  always_prepared: boolean
  assigned_by_dm: boolean
}

export const matchesDmSpellView = (
  assignment: SpellAssignmentState | undefined,
  view: DmSpellView,
  isWizard: boolean,
) => {
  if (view === 'all') return true
  if (!assignment) return false
  if (view === 'assigned') return assignment.in_collection
  if (view === 'prepared') return assignment.is_prepared
  if (view === 'always') return assignment.always_prepared
  if (view === 'unprepared') return assignment.in_collection && !assignment.is_prepared
  return isWizard && assignment.in_collection
}

export const dmSpellStatusLabel = (
  assignment: SpellAssignmentState | undefined,
  isWizard: boolean,
) => {
  if (!assignment?.in_collection) return undefined
  if (assignment.always_prepared) return 'Always prepared'
  if (assignment.is_prepared) return 'Prepared now'
  if (isWizard) return 'In spellbook · not prepared'
  return 'Assigned · not active'
}
