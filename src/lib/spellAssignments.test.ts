import { describe, expect, it } from 'vitest'
import { alwaysPreparedPatch } from './spellAssignments'

describe('always-prepared assignment updates', () => {
  it('also prepares a spell when always prepared is enabled', () => {
    expect(alwaysPreparedPatch(true)).toEqual({
      always_prepared: true,
      is_prepared: true,
    })
  })

  it('keeps the current prepared state when always prepared is disabled', () => {
    expect(alwaysPreparedPatch(false)).toEqual({ always_prepared: false })
  })
})
