export const advancementFieldsForLevel = (
  level: number,
  higherLevel: string | null,
  cantripUpgrade: string | null,
) => level === 0
  ? { higher_level: null, cantrip_upgrade: cantripUpgrade }
  : { higher_level: higherLevel, cantrip_upgrade: null }
