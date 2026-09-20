import { describe, expect, it } from 'vitest'
import { setsMatch, spellSelectionChanges, toggleSetValue } from './spellSelection'

describe('staged spell selection', () => {
  it('finds additions and removals for one save', () => {
    expect(spellSelectionChanges(
      new Set(['shield', 'light']),
      new Set(['shield', 'mage-hand']),
    )).toEqual({
      added: ['mage-hand'],
      removed: ['light'],
    })
  })

  it('compares sets without depending on insertion order', () => {
    expect(setsMatch(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
    expect(setsMatch(new Set(['a']), new Set(['a', 'b']))).toBe(false)
  })

  it('toggles a draft value without mutating the original set', () => {
    const original = new Set(['a'])
    const added = toggleSetValue(original, 'b')
    const removed = toggleSetValue(added, 'a')

    expect([...original]).toEqual(['a'])
    expect([...added]).toEqual(['a', 'b'])
    expect([...removed]).toEqual(['b'])
  })
})
