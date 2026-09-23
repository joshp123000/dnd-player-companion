import type { Session } from '@supabase/supabase-js'
import type {
  Ability,
  AbilityAssignmentType,
  AbilityKind,
  Campaign,
  Character,
  CharacterAbility,
  CharacterClass,
  CharacterClassInput,
  CharacterSpell,
  ClassProgression,
  PlayerBundle,
  Profile,
  Spell,
} from '../types'
import { loginIdentifierToEmail, normalizeUsername, usernameToEmail } from './auth'
import { advancementFieldsForLevel } from './spellAdvancement'
import { alwaysPreparedPatch, type SpellAssignmentState } from './spellAssignments'
import { requireSupabase } from './supabase'
import type { ThemeKey } from './themes'

export interface CreateCharacterInput {
  username: string
  activationCode: string
  characterName: string
  classKey: string
  level: number
  campaignId: string
}

export interface AddCharacterToAccountInput {
  accountCharacterId: string
  characterName: string
  classKey: string
  level: number
  campaignId: string
}

export interface SpellInput {
  name: string
  level: number
  school: string
  classes: string[]
  action_type: string
  casting_time: string | null
  casting_trigger: string | null
  range: string
  components: string[]
  material: string | null
  duration: string
  concentration: boolean
  ritual: boolean
  description: string
  higher_level: string | null
  cantrip_upgrade: string | null
  source_label: string
  original_spell_id?: string | null
}

export type SpellAssignmentSummary = SpellAssignmentState

export interface AbilityAssignmentSummary {
  ability_id: string
  assignment_type: AbilityAssignmentType
  is_enabled: boolean
}

export interface AbilityInput {
  name: string
  category: string
  action_type: string | null
  uses: string | null
  recharge: string | null
  summary: string | null
  description: string
  prerequisite: string | null
  repeatable: boolean
  source: string | null
  tags: string[]
  item_type: string | null
  item_rarity: string | null
  attunement: string | null
}

export const signIn = async (identifier: string, password: string): Promise<Session> => {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email: loginIdentifierToEmail(identifier),
    password,
  })
  if (error) throw error
  if (!data.session) throw new Error('Login succeeded without a session. Please try again.')
  return data.session
}

export const activatePlayer = async (
  username: string,
  activationCode: string,
  password: string,
) => {
  const client = requireSupabase()
  const normalized = normalizeUsername(username)
  const { data, error } = await client.auth.signUp({
    email: usernameToEmail(normalized),
    password,
    options: {
      data: {
        username: normalized,
        activation_code: activationCode.trim(),
      },
    },
  })
  if (error) throw error
  return data
}

export const signOut = async () => {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw error
}

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const client = requireSupabase()
  const { data, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!data.user?.email) throw new Error('Your login could not be verified. Please sign in again.')

  const { error: signInError } = await client.auth.signInWithPassword({
    email: data.user.email,
    password: currentPassword,
  })
  if (signInError) throw new Error('The current password is incorrect.')

  const { error: updateError } = await client.auth.updateUser({ password: newPassword })
  if (updateError) throw updateError
}

export const updateTheme = async (themeKey: ThemeKey) => {
  const { data, error } = await requireSupabase().auth.updateUser({
    data: { theme_key: themeKey },
  })
  if (error) throw error
  return data.user
}

export const loadProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data as Profile
}

export const loadPlayerBundle = async (
  userId: string,
  preferredCharacterId?: string,
): Promise<PlayerBundle> => {
  const client = requireSupabase()
  const { data: characterData, error: characterError } = await client
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
    .order('name')
  if (characterError) throw characterError
  const bareCharacters = (characterData ?? []) as Character[]
  const characterIds = bareCharacters.map((row) => row.id)
  const { data: classData, error: classError } = characterIds.length > 0
    ? await client
      .from('character_classes')
      .select('*')
      .in('character_id', characterIds)
      .order('is_primary', { ascending: false })
      .order('class_key')
    : { data: [], error: null }
  if (classError) throw classError

  const classesByCharacter = new Map<string, CharacterClass[]>()
  for (const classLevel of (classData ?? []) as CharacterClass[]) {
    const rows = classesByCharacter.get(classLevel.character_id) ?? []
    rows.push(classLevel)
    classesByCharacter.set(classLevel.character_id, rows)
  }
  const availableCharacters = bareCharacters.map((row) => ({
    ...row,
    class_levels: classesByCharacter.get(row.id) ?? [],
  }))
  const character = availableCharacters.find((row) => row.id === preferredCharacterId)
    ?? availableCharacters[0]
  if (!character) throw new Error('No character is attached to this account yet.')

  const classLevels = character.class_levels?.length
    ? character.class_levels
    : [{
      id: `legacy-${character.id}`,
      character_id: character.id,
      class_key: character.class_key,
      class_level: character.level,
      subclass: character.subclass,
      is_primary: true,
      max_cantrips_override: character.max_cantrips_override,
      max_prepared_override: character.max_prepared_override,
      max_spell_level_override: character.max_spell_level_override,
      created_at: character.created_at,
      updated_at: character.updated_at,
    }]

  const campaignIds = [...new Set(availableCharacters.map((row) => row.campaign_id))]

  const [campaignResult, progressionResult, spellResult, abilityResult] = await Promise.all([
    client
      .from('campaigns')
      .select('*')
      .in('id', campaignIds)
      .order('created_at')
      .order('name'),
    client
      .from('class_progression')
      .select('*')
      .in('class_key', classLevels.map((entry) => entry.class_key)),
    client
      .from('character_spells')
      .select('*, spell:spells(*)')
      .eq('character_id', character.id)
      .order('created_at'),
    client
      .from('character_abilities')
      .select('*, ability:abilities(*)')
      .eq('character_id', character.id)
      .eq('is_enabled', true)
      .order('sort_order'),
  ])

  if (campaignResult.error) throw campaignResult.error
  if (progressionResult.error) throw progressionResult.error
  if (spellResult.error) throw spellResult.error
  if (abilityResult.error) throw abilityResult.error

  const progressions = ((progressionResult.data ?? []) as ClassProgression[]).filter((row) =>
    classLevels.some((entry) => entry.class_key === row.class_key && entry.class_level === row.level),
  )
  const primaryClass = classLevels.find((entry) => entry.is_primary) ?? classLevels[0]

  return {
    character,
    availableCharacters,
    campaigns: (campaignResult.data ?? []) as Campaign[],
    progression: progressions.find((row) => (
      row.class_key === primaryClass?.class_key && row.level === primaryClass?.class_level
    )) ?? null,
    classLevels,
    progressions,
    spellAssignments: (spellResult.data ?? []) as CharacterSpell[],
    abilities: (abilityResult.data ?? []) as CharacterAbility[],
  }
}

export const listEligibleSpells = async (
  classLevels: CharacterClass[],
  progressions: ClassProgression[],
): Promise<Spell[]> => {
  const spellcastingClasses = classLevels.filter((entry) =>
    progressions.some((row) => row.class_key === entry.class_key && row.level === entry.class_level),
  )
  if (spellcastingClasses.length === 0) return []
  const maxSpellLevel = Math.max(0, ...spellcastingClasses.map((entry) =>
    entry.max_spell_level_override
      ?? progressions.find((row) => row.class_key === entry.class_key && row.level === entry.class_level)?.max_spell_level
      ?? 0,
  ))
  const client = requireSupabase()
  const query = client
    .from('spells')
    .select('*')
    .lte('level', maxSpellLevel)
    .overlaps('classes', spellcastingClasses.map((entry) => entry.class_key))
    .order('level')
    .order('name')
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Spell[]
}

export const playerToggleSpell = async (
  characterId: string,
  spellId: string,
  sourceClassKey: string,
  active: boolean,
) => {
  const { error } = await requireSupabase().rpc('player_toggle_spell', {
    p_character_id: characterId,
    p_spell_id: spellId,
    p_source_class_key: sourceClassKey,
    p_active: active,
  })
  if (error) throw error
}

export const setAllPreparationUnlocked = async (
  characterIds: string[],
  unlocked: boolean,
) => {
  if (characterIds.length === 0) return
  const { error } = await requireSupabase()
    .from('characters')
    .update({ preparation_unlocked: unlocked })
    .in('id', characterIds)
  if (error) throw error
}

export const listCharacters = async (): Promise<Character[]> => {
  const client = requireSupabase()
  const { data, error } = await client
    .from('characters')
    .select('*')
    .order('name')
  if (error) throw error
  const characters = (data ?? []) as Character[]
  if (characters.length === 0) return []
  const { data: classData, error: classError } = await client
    .from('character_classes')
    .select('*')
    .in('character_id', characters.map((character) => character.id))
    .order('is_primary', { ascending: false })
    .order('class_key')
  if (classError) throw classError
  const classesByCharacter = new Map<string, CharacterClass[]>()
  for (const classLevel of (classData ?? []) as CharacterClass[]) {
    const rows = classesByCharacter.get(classLevel.character_id) ?? []
    rows.push(classLevel)
    classesByCharacter.set(classLevel.character_id, rows)
  }
  return characters.map((character) => ({
    ...character,
    class_levels: classesByCharacter.get(character.id) ?? [],
  }))
}

export const listCampaigns = async (): Promise<Campaign[]> => {
  const { data, error } = await requireSupabase()
    .from('campaigns')
    .select('*')
    .order('created_at')
    .order('name')
  if (error) throw error
  return (data ?? []) as Campaign[]
}

export const createCampaign = async (name: string): Promise<Campaign> => {
  const { data, error } = await requireSupabase()
    .from('campaigns')
    .insert({ name: name.trim() })
    .select('*')
    .single()
  if (error) throw error
  return data as Campaign
}

export const updateCampaign = async (campaignId: string, name: string): Promise<Campaign> => {
  const { data, error } = await requireSupabase()
    .from('campaigns')
    .update({ name: name.trim() })
    .eq('id', campaignId)
    .select('*')
    .single()
  if (error) throw error
  return data as Campaign
}

export const deleteCampaign = async (campaignId: string) => {
  const { error } = await requireSupabase().from('campaigns').delete().eq('id', campaignId)
  if (error) throw error
}

export const createCharacter = async (input: CreateCharacterInput): Promise<string> => {
  const { data, error } = await requireSupabase().rpc('dm_create_character', {
    p_username: normalizeUsername(input.username),
    p_activation_code: input.activationCode.trim(),
    p_character_name: input.characterName.trim(),
    p_class_key: input.classKey,
    p_level: input.level,
    p_campaign_id: input.campaignId,
  })
  if (error) throw error
  return String(data)
}

export const addCharacterToAccount = async (
  input: AddCharacterToAccountInput,
): Promise<string> => {
  const { data, error } = await requireSupabase().rpc('dm_add_character_to_account', {
    p_account_character_id: input.accountCharacterId,
    p_character_name: input.characterName.trim(),
    p_class_key: input.classKey,
    p_level: input.level,
    p_campaign_id: input.campaignId,
  })
  if (error) throw error
  return String(data)
}

export const updateCharacter = async (characterId: string, changes: Partial<Character>) => {
  const allowed = {
    campaign_id: changes.campaign_id,
    name: changes.name,
    class_key: changes.class_key,
    subclass: changes.subclass,
    level: changes.level,
    notes: changes.notes,
    preparation_unlocked: changes.preparation_unlocked,
    choices_unlocked: changes.choices_unlocked,
    max_cantrips_override: changes.max_cantrips_override,
    max_prepared_override: changes.max_prepared_override,
    max_spell_level_override: changes.max_spell_level_override,
  }
  const clean = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined))
  const { error } = await requireSupabase().from('characters').update(clean).eq('id', characterId)
  if (error) throw error
}

export const updateCharacterMulticlass = async (
  characterId: string,
  changes: Pick<Character, 'campaign_id' | 'name' | 'notes' | 'preparation_unlocked'>,
  classes: CharacterClassInput[],
) => {
  const { error } = await requireSupabase().rpc('dm_update_character_multiclass', {
    p_character_id: characterId,
    p_campaign_id: changes.campaign_id,
    p_name: changes.name.trim(),
    p_notes: changes.notes?.trim() || null,
    p_preparation_unlocked: changes.preparation_unlocked,
    p_classes: classes,
  })
  if (error) throw error
}

export const resetPlayerLogin = async (
  characterId: string,
  username: string,
  activationCode: string,
) => {
  const { error } = await requireSupabase().rpc('dm_reset_player_login', {
    p_character_id: characterId,
    p_username: normalizeUsername(username),
    p_activation_code: activationCode.trim(),
  })
  if (error) throw error
}

export const deleteCharacter = async (characterId: string) => {
  const { error } = await requireSupabase().from('characters').delete().eq('id', characterId)
  if (error) throw error
}

export const listSpells = async (): Promise<Spell[]> => {
  const { data, error } = await requireSupabase()
    .from('spells')
    .select('*')
    .order('level')
    .order('name')
  if (error) throw error
  return (data ?? []) as Spell[]
}

export const createSpell = async (input: SpellInput): Promise<Spell> => {
  const advancement = advancementFieldsForLevel(input.level, input.higher_level, input.cantrip_upgrade)
  const { data, error } = await requireSupabase()
    .from('spells')
    .insert({ ...input, ...advancement, source_type: 'custom' })
    .select('*')
    .single()
  if (error) throw error
  return data as Spell
}

export const updateSpell = async (
  spell: Pick<Spell, 'id' | 'source_type'>,
  input: SpellInput,
): Promise<void> => {
  const advancement = advancementFieldsForLevel(input.level, input.higher_level, input.cantrip_upgrade)
  const client = requireSupabase()
  if (spell.source_type === 'srd') {
    const { error } = await client.rpc('dm_update_generated_spell', {
      p_spell_id: spell.id,
      p_card: { ...input, ...advancement },
    })
    if (error) throw error
    return
  }

  const { error } = await client
    .from('spells')
    .update({ ...input, ...advancement })
    .eq('id', spell.id)
    .eq('source_type', 'custom')
  if (error) throw error
}

export const deleteSpell = async (spellId: string) => {
  const { error } = await requireSupabase()
    .from('spells')
    .delete()
    .eq('id', spellId)
    .eq('source_type', 'custom')
  if (error) throw error
}

export const assignSpell = async (
  characterId: string,
  spellId: string,
  options: { sourceClassKey?: string; prepared?: boolean; alwaysPrepared?: boolean } = {},
) => {
  const { error } = await requireSupabase().rpc('dm_assign_spell', {
    p_character_id: characterId,
    p_spell_id: spellId,
    p_source_class_key: options.sourceClassKey ?? 'dm',
    p_prepared: options.prepared ?? false,
    p_always_prepared: options.alwaysPrepared ?? false,
  })
  if (error) throw error
}

export const removeSpellAssignment = async (characterId: string, spellId: string) => {
  const { error } = await requireSupabase()
    .from('character_spells')
    .delete()
    .eq('character_id', characterId)
    .eq('spell_id', spellId)
  if (error) throw error
}

export const updateSpellAlwaysPrepared = async (
  characterId: string,
  spellId: string,
  alwaysPrepared: boolean,
) => {
  const { error } = await requireSupabase()
    .from('character_spells')
    .update(alwaysPreparedPatch(alwaysPrepared))
    .eq('character_id', characterId)
    .eq('spell_id', spellId)
  if (error) throw error
}

export const listAbilities = async (): Promise<Ability[]> => {
  const { data, error } = await requireSupabase()
    .from('abilities')
    .select('*')
    .order('is_system', { ascending: false })
    .order('class_key')
    .order('level_required')
    .order('feature_order')
    .order('name')
  if (error) throw error
  const kindOrder = { class_feature: 0, feat: 1, magic_item: 2, custom: 3 }
  return ((data ?? []) as Ability[]).sort((left, right) =>
    (kindOrder[left.ability_kind] ?? 3) - (kindOrder[right.ability_kind] ?? 3)
    || (left.class_key ?? '').localeCompare(right.class_key ?? '')
    || (left.level_required ?? 0) - (right.level_required ?? 0)
    || left.name.localeCompare(right.name),
  )
}

export const createAbility = async (
  input: AbilityInput,
  abilityKind: Extract<AbilityKind, 'custom' | 'magic_item'> = 'custom',
): Promise<Ability> => {
  const { data, error } = await requireSupabase()
    .from('abilities')
    .insert({ ...input, ability_kind: abilityKind })
    .select('*')
    .single()
  if (error) throw error
  return data as Ability
}

export const updateAbility = async (
  ability: Pick<Ability, 'id' | 'is_system'>,
  input: AbilityInput,
): Promise<void> => {
  const client = requireSupabase()
  if (ability.is_system) {
    const { error } = await client.rpc('dm_update_generated_ability', {
      p_ability_id: ability.id,
      p_card: input,
    })
    if (error) throw error
    return
  }

  const { error } = await client
    .from('abilities')
    .update(input)
    .eq('id', ability.id)
    .eq('is_system', false)
  if (error) throw error
}

export const deleteAbility = async (abilityId: string) => {
  const { error } = await requireSupabase().from('abilities').delete().eq('id', abilityId)
  if (error) throw error
}

export const setAbilityAssignment = async (
  characterId: string,
  abilityId: string,
  enabled: boolean,
) => {
  const { error } = await requireSupabase().rpc('dm_set_ability_override', {
    p_character_id: characterId,
    p_ability_id: abilityId,
    p_enabled: enabled,
  })
  if (error) throw error
}

export const listCharacterSpellAssignments = async (characterId: string): Promise<SpellAssignmentSummary[]> => {
  const { data, error } = await requireSupabase()
    .from('character_spells')
    .select('spell_id, source_class_key, in_collection, is_prepared, always_prepared, assigned_by_dm')
    .eq('character_id', characterId)
  if (error) throw error
  const summaries = new Map<string, SpellAssignmentSummary>()
  for (const row of data ?? []) {
    const spellId = String(row.spell_id)
    const current = summaries.get(spellId)
    const sourceClassKey = String(row.source_class_key)
    summaries.set(spellId, {
      spell_id: spellId,
      source_class_key: current?.source_class_key ?? sourceClassKey,
      source_class_keys: [...new Set([...(current?.source_class_keys ?? []), sourceClassKey])],
      in_collection: Boolean(current?.in_collection || row.in_collection),
      is_prepared: Boolean(current?.is_prepared || row.is_prepared),
      always_prepared: Boolean(current?.always_prepared || row.always_prepared),
      assigned_by_dm: Boolean(current?.assigned_by_dm || row.assigned_by_dm),
    })
  }
  return [...summaries.values()]
}

export const listCharacterAbilityAssignments = async (
  characterId: string,
): Promise<AbilityAssignmentSummary[]> => {
  const { data, error } = await requireSupabase()
    .from('character_abilities')
    .select('ability_id, assignment_type, is_enabled')
    .eq('character_id', characterId)
  if (error) throw error
  return (data ?? []).map((row) => ({
    ability_id: String(row.ability_id),
    assignment_type: row.assignment_type as AbilityAssignmentType,
    is_enabled: Boolean(row.is_enabled),
  }))
}
