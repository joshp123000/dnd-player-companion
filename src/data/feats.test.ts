import { describe, expect, it } from 'vitest'
import feats from './feats.json'

const expectedCounts = {
  'Origin Feat': 10,
  'General Feat': 43,
  'Fighting Style Feat': 10,
  'Epic Boon Feat': 12,
}

describe('2024 feat data', () => {
  it('contains all 75 Player’s Handbook feats in the expected categories', () => {
    expect(feats).toHaveLength(75)

    const counts = feats.reduce<Record<string, number>>((result, feat) => {
      result[feat.category] = (result[feat.category] ?? 0) + 1
      return result
    }, {})

    expect(counts).toEqual(expectedCounts)
  })

  it('uses unique protected feat records that require manual assignment', () => {
    expect(new Set(feats.map((feat) => feat.slug)).size).toBe(feats.length)
    expect(feats.every((feat) => feat.ability_kind === 'feat')).toBe(true)
    expect(feats.every((feat) => feat.class_key === null)).toBe(true)
    expect(feats.every((feat) => feat.source_type === 'book')).toBe(true)
    expect(feats.every((feat) => feat.description.length >= 40)).toBe(true)
  })

  it('marks every repeatable 2024 feat', () => {
    expect(feats.filter((feat) => feat.repeatable).map((feat) => feat.name).sort()).toEqual([
      'Ability Score Improvement',
      'Elemental Adept',
      'Magic Initiate',
      'Skilled',
    ])
  })

  it('keeps general and epic level prerequisites available for filtering and display', () => {
    expect(feats.filter((feat) => feat.category === 'General Feat').every((feat) => feat.level_required === 4)).toBe(true)
    expect(feats.filter((feat) => feat.category === 'Epic Boon Feat').every((feat) => feat.level_required === 19)).toBe(true)
  })
})
