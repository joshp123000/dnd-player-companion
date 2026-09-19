export const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export const joinNonEmpty = (parts: Array<string | null | undefined>, separator = ' · ') =>
  parts.filter(Boolean).join(separator)

export const initials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

export const friendlyError = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String(error.message)
  return 'Something went wrong. Please try again.'
}
