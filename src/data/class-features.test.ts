import { describe, expect, it } from 'vitest'
import features from './class-features.json'

const expectedClasses = [
  'artificer',
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
]

describe('base-class feature import', () => {
  it('contains unique feature cards for every supported class', () => {
    expect(features).toHaveLength(174)
    expect(new Set(features.map((feature) => feature.slug)).size).toBe(features.length)
    expect([...new Set(features.map((feature) => feature.class_key))].sort()).toEqual(expectedClasses)
  })

  it('contains valid automatic-assignment metadata', () => {
    for (const feature of features) {
      expect(feature.level_required).toBeGreaterThanOrEqual(1)
      expect(feature.level_required).toBeLessThanOrEqual(20)
      expect(feature.feature_order).toBeGreaterThan(0)
      expect(feature.description.length).toBeGreaterThan(0)
      expect(feature.tags).toContain(feature.class_key)
      expect(['srd', 'book']).toContain(feature.source_type)
      expect(feature.name.toLowerCase()).not.toContain('subclass')
    }
  })

  it('uses the supplied 2025 Artificer feature progression', () => {
    const artificer = features.filter((feature) => feature.class_key === 'artificer')
    const unlocks = new Map(artificer.map((feature) => [feature.name, feature.level_required]))

    expect(artificer).toHaveLength(12)
    expect(unlocks.get('Tinker’s Magic')).toBe(1)
    expect(unlocks.get('Replicate Magic Item')).toBe(2)
    expect(unlocks.get('Flash of Genius')).toBe(7)
    expect(unlocks.get('Spell-Storing Item')).toBe(11)
    expect(unlocks.get('Soul of Artifice')).toBe(20)
  })

  it('includes representative 2024 core features', () => {
    const slugs = new Set(features.map((feature) => feature.slug))
    expect(slugs.has('srd52-barbarian-1-rage')).toBe(true)
    expect(slugs.has('srd52-fighter-2-action-surge')).toBe(true)
    expect(slugs.has('srd52-monk-5-stunning-strike')).toBe(true)
    expect(slugs.has('srd52-rogue-1-sneak-attack')).toBe(true)
    expect(slugs.has('srd52-wizard-1-arcane-recovery')).toBe(true)
  })
})
