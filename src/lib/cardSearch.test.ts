import { describe, expect, it } from 'vitest'
import type { Ability } from '../types'
import { matchesAbilitySearch, matchesCardSearch, matchesSpellSearch } from './cardSearch'

const ability: Ability = {
  id: 'ability-id',
  slug: 'ring-of-stars',
  name: 'Ring of Stars',
  category: 'Ring',
  class_key: null,
  level_required: null,
  feature_order: 0,
  is_system: false,
  ability_kind: 'magic_item',
  source_type: 'custom',
  action_type: 'Bonus Action',
  uses: '3 charges',
  recharge: 'Dawn',
  summary: 'Create a protective constellation.',
  description: 'Stars circle the wearer and grant resistance to radiant damage.',
  prerequisite: null,
  repeatable: false,
  source: 'Homebrew',
  tags: ['magic item', 'space'],
  item_type: 'Ring',
  item_rarity: 'Rare',
  attunement: 'Requires Attunement',
  created_by: null,
  created_at: '',
  updated_at: '',
}

describe('player card search', () => {
  it('matches multiple terms across different card fields', () => {
    expect(matchesCardSearch('rare dawn', ability.item_rarity, ability.recharge)).toBe(true)
    expect(matchesAbilitySearch(ability, 'radiant space')).toBe(true)
  })

  it('includes assignment notes when supplied', () => {
    expect(matchesAbilitySearch(ability, 'gift from lucien', ['Gift from Lucien'])).toBe(true)
  })

  it('searches spell rules and metadata in addition to its name', () => {
    const spell = {
      name: 'Solar Snare',
      level: 2,
      school: 'evocation',
      classes: ['wizard'],
      description: 'The target is restrained by radiant chains.',
      components: ['v', 's'],
    }

    expect(matchesSpellSearch(spell, 'radiant restrained')).toBe(true)
    expect(matchesSpellSearch(spell, 'level 2 wizard')).toBe(true)
    expect(matchesSpellSearch(spell, 'necrotic')).toBe(false)
  })
})
