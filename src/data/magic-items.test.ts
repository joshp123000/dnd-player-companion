import { describe, expect, it } from 'vitest'
import items from './magic-items.json'

const expectedCategories = {
  Armor: 19,
  Potion: 24,
  Ring: 22,
  Rod: 7,
  Scroll: 1,
  Staff: 12,
  Wand: 13,
  Weapon: 33,
  'Wondrous Item': 127,
}

describe('SRD 5.2.1 magic-item data', () => {
  it('contains all 258 items in the expected categories', () => {
    expect(items).toHaveLength(258)
    const counts = items.reduce<Record<string, number>>((result, item) => {
      result[item.category] = (result[item.category] ?? 0) + 1
      return result
    }, {})
    expect(counts).toEqual(expectedCategories)
  })

  it('uses unique protected records with complete card metadata', () => {
    expect(new Set(items.map((item) => item.slug)).size).toBe(items.length)
    expect(items.every((item) => item.ability_kind === 'magic_item')).toBe(true)
    expect(items.every((item) => item.source_type === 'srd')).toBe(true)
    expect(items.every((item) => item.item_type.length > 0)).toBe(true)
    expect(items.every((item) => item.item_rarity.length > 0)).toBe(true)
    expect(items.every((item) => item.description.length > 0)).toBe(true)
  })

  it('preserves attunement and variable rarity details', () => {
    expect(items.filter((item) => item.attunement)).toHaveLength(140)
    expect(items.filter((item) => item.item_rarity === 'Varies')).toHaveLength(13)
  })

  it('converts source HTML tables into card-safe Markdown', () => {
    expect(items.some((item) => /<table/i.test(item.description))).toBe(false)
    expect(items.find((item) => item.name === 'Ammunition of Slaying')?.description).toContain('| 1d100 | Creature Type |')
  })
})
