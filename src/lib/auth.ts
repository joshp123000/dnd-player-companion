const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/
export const INTERNAL_EMAIL_DOMAIN = 'dnd-player.invalid'

export const normalizeUsername = (value: string) => value.trim().toLowerCase()

export const isValidUsername = (value: string) => USERNAME_PATTERN.test(normalizeUsername(value))

export const usernameToEmail = (username: string) => {
  const normalized = normalizeUsername(username)
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error('Usernames must be 3–32 characters using letters, numbers, _ or -.')
  }
  return `${normalized}@${INTERNAL_EMAIL_DOMAIN}`
}

export const loginIdentifierToEmail = (identifier: string) => {
  const trimmed = identifier.trim().toLowerCase()
  return trimmed.includes('@') ? trimmed : usernameToEmail(trimmed)
}
