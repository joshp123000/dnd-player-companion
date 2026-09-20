import { describe, expect, it } from 'vitest'
import type { Ability } from '../types'
import { filterMagicItems, magicItemCategories } from './magicItems'

const item = (overrides: Partial<Ability>): Ability => ({
  id: 'item-id',
  slug: 'srd52-magic-item-bag-of-holding',
  name: 'Bag of Holding',
  category: 'Wondrous Item',
  class_key: null,
  level_required: null,
  feature_order: 1,
  is_system: true,
  ability_kind: 'magic_item',
  source_type: 'srd',
  action_type: null,
  uses: null,
  recharge: null,
  summary: 'A roomy extradimensional bag.',
  description: 'The bag can hold far more than its outside dimensions suggest.',
  prerequisite: null,
  repeatable: false,
  source: 'SRD 5.2.1 (2024)',
  tags: ['magic item', 'wondrous item', 'uncommon'],
  item_type: 'Wondrous Item',
  item_rarity: 'Uncommon',
  attunement: null,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

describe('magic-item filters', () => {
  const items = [
    item({ id: 'bag' }),
    item({ id: 'ring', name: 'Ring of Protection', category: 'Ring', item_type: 'Ring', item_rarity: 'Rare', attunement: 'Requires Attunement', tags: ['magic item', 'ring', 'rare', 'attunement'] }),
    item({ id: 'ability', name: 'Not an item', ability_kind: 'custom' }),
  ]

  it('searches item metadata and excludes non-item abilities', () => {
    expect(filterMagicItems(items, { search: 'attunement', category: 'all', rarity: 'all' }).map((entry) => entry.id)).toEqual(['ring'])
  })

  it('filters category and rarity together', () => {
    expect(filterMagicItems(items, { search: '', category: 'Wondrous Item', rarity: 'Uncommon' }).map((entry) => entry.id)).toEqual(['bag'])
  })

  it('returns sorted unique categories', () => {
    expect(magicItemCategories(items.filter((entry) => entry.ability_kind === 'magic_item'))).toEqual(['Ring', 'Wondrous Item'])
  })
})
