const CHARACTER_SESSION_PREFIX = 'campaign-compendium:last-character:'

const storageKey = (profileId: string) => `${CHARACTER_SESSION_PREFIX}${profileId}`

export const lastCharacterForSession = (profileId: string) => {
  try {
    return window.sessionStorage.getItem(storageKey(profileId)) || undefined
  } catch {
    return undefined
  }
}

export const rememberCharacterForSession = (profileId: string, characterId: string) => {
  try {
    window.sessionStorage.setItem(storageKey(profileId), characterId)
  } catch {
    // Storage can be unavailable in strict privacy modes; the app still works normally.
  }
}

export const clearCharacterSession = (profileId?: string) => {
  try {
    if (profileId) {
      window.sessionStorage.removeItem(storageKey(profileId))
      return
    }
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index)
      if (key?.startsWith(CHARACTER_SESSION_PREFIX)) window.sessionStorage.removeItem(key)
    }
  } catch {
    // No cleanup is needed when session storage is unavailable.
  }
}
