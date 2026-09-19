import type { SpellFilters } from '../types'

export const filterSpells = <T extends { name: string; level: number; classes: string[]; school: string }>(
  spells: T[],
  filters: SpellFilters,
) => {
  const search = filters.search.trim().toLowerCase()
  return spells.filter((spell) => {
    if (search && !spell.name.toLowerCase().includes(search)) return false
    if (filters.level !== 'all' && spell.level !== filters.level) return false
    if (filters.classKey !== 'all' && !spell.classes.includes(filters.classKey)) return false
    if (filters.school !== 'all' && spell.school !== filters.school) return false
    return true
  })
}
