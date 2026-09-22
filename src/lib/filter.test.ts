import { describe, expect, it } from 'vitest'
import { filterSpells } from './filter'

const spells = [
  { name: 'Fireball', level: 3, classes: ['sorcerer', 'wizard'], school: 'evocation', description: 'A fiery explosion.' },
  { name: 'Mage Hand', level: 0, classes: ['bard', 'sorcerer', 'warlock', 'wizard'], school: 'conjuration' },
  { name: 'Cure Wounds', level: 1, classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'], school: 'abjuration' },
]

describe('spell filtering', () => {
  it('combines search, level, class, and school filters', () => {
    expect(filterSpells(spells, { search: 'fire', level: 3, classKey: 'wizard', school: 'evocation' }))
      .toEqual([spells[0]])
  })

  it('returns all spells when filters are clear', () => {
    expect(filterSpells(spells, { search: '', level: 'all', classKey: 'all', school: 'all' })).toHaveLength(3)
  })

  it('searches spell details as well as names', () => {
    expect(filterSpells(spells, { search: 'fiery explosion', level: 'all', classKey: 'all', school: 'all' }))
      .toEqual([spells[0]])
  })
})
