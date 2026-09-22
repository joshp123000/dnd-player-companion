import type { Ability } from '../types'

export interface SearchableSpellCard {
  name: string
  level: number
  school: string
  classes: string[]
  action_type?: string | null
  casting_time?: string | null
  casting_trigger?: string | null
  range?: string | null
  components?: string[]
  material?: string | null
  duration?: string | null
  description?: string | null
  higher_level?: string | null
  cantrip_upgrade?: string | null
  source_label?: string | null
}

const searchableText = (values: unknown[]) => values
  .flatMap((value) => Array.isArray(value) ? value : [value])
  .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
  .join(' ')
  .toLowerCase()

export const matchesCardSearch = (search: string, ...values: unknown[]) => {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = searchableText(values)
  return terms.every((term) => haystack.includes(term))
}

export const matchesSpellSearch = (spell: SearchableSpellCard, search: string) => matchesCardSearch(
  search,
  spell.name,
  spell.level === 0 ? 'cantrip level 0' : `level ${spell.level}`,
  spell.school,
  spell.classes,
  spell.action_type,
  spell.casting_time,
  spell.casting_trigger,
  spell.range,
  spell.components,
  spell.material,
  spell.duration,
  spell.description,
  spell.higher_level,
  spell.cantrip_upgrade,
  spell.source_label,
)

export const matchesAbilitySearch = (
  ability: Ability,
  search: string,
  additionalValues: unknown[] = [],
) => matchesCardSearch(
  search,
  ability.name,
  ability.category,
  ability.class_key,
  ability.level_required ? `level ${ability.level_required}` : null,
  ability.action_type,
  ability.uses,
  ability.recharge,
  ability.summary,
  ability.description,
  ability.prerequisite,
  ability.source,
  ability.tags,
  ability.item_type,
  ability.item_rarity,
  ability.attunement,
  additionalValues,
)
