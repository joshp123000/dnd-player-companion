import type { Ability, MagicItemFilters } from '../types'

export const MAGIC_ITEM_RARITIES = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary',
  'Artifact',
  'Varies',
] as const

export const magicItemCategories = (items: Ability[]) => (
  [...new Set(items.map((item) => item.category))].sort((left, right) => left.localeCompare(right))
)

export const filterMagicItems = (items: Ability[], filters: MagicItemFilters) => {
  const search = filters.search.trim().toLowerCase()
  return items.filter((item) => (
    item.ability_kind === 'magic_item'
    && (filters.category === 'all' || item.category === filters.category)
    && (filters.rarity === 'all' || item.item_rarity === filters.rarity)
    && (
      !search
      || [item.name, item.item_type, item.item_rarity, item.attunement, item.summary, ...item.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search)
    )
  ))
}
