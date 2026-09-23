import { afterEach, describe, expect, it } from 'vitest'
import { clearCharacterSession, lastCharacterForSession, rememberCharacterForSession } from './characterSession'

afterEach(() => window.sessionStorage.clear())

describe('last selected character for a login session', () => {
  it('remembers selections independently for each player account', () => {
    rememberCharacterForSession('player-one', 'character-two')
    rememberCharacterForSession('player-two', 'character-four')

    expect(lastCharacterForSession('player-one')).toBe('character-two')
    expect(lastCharacterForSession('player-two')).toBe('character-four')
  })

  it('clears the current account selection when the player signs out', () => {
    rememberCharacterForSession('player-one', 'character-two')
    clearCharacterSession('player-one')
    expect(lastCharacterForSession('player-one')).toBeUndefined()
  })
})
