import { describe, expect, it } from 'vitest'
import { isValidUsername, loginIdentifierToEmail, normalizeUsername, usernameToEmail } from './auth'

describe('player login identifiers', () => {
  it('normalizes player usernames', () => {
    expect(normalizeUsername('  Ragnar_12 ')).toBe('ragnar_12')
    expect(usernameToEmail('Ragnar_12')).toBe('ragnar_12@dnd-player.invalid')
  })

  it('leaves DM email addresses intact', () => {
    expect(loginIdentifierToEmail(' DM@example.com ')).toBe('dm@example.com')
  })

  it('rejects unsafe or ambiguous usernames', () => {
    expect(isValidUsername('ab')).toBe(false)
    expect(isValidUsername('name with spaces')).toBe(false)
    expect(() => usernameToEmail('bad@email')).toThrow()
  })
})
