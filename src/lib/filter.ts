import type { SpellFilters } from '../types'
import { matchesSpellSearch, type SearchableSpellCard } from './cardSearch'

export const filterSpells = <T extends SearchableSpellCard>(
  spells: T[],
  filters: SpellFilters,
) => {
  return spells.filter((spell) => {
    if (!matchesSpellSearch(spell, filters.search)) return false
    if (filters.level !== 'all' && spell.level !== filters.level) return false
    if (filters.classKey !== 'all' && !spell.classes.includes(filters.classKey)) return false
    if (filters.school !== 'all' && spell.school !== filters.school) return false
    return true
  })
}
