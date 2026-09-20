import type { Session } from '@supabase/supabase-js'
import type {
  Ability,
  Campaign,
  Character,
  CharacterAbility,
  CharacterSpell,
  ClassProgression,
  PlayerBundle,
  Profile,
  Spell,
} from '../types'
import { loginIdentifierToEmail, normalizeUsername, usernameToEmail } from './auth'
import { requireSupabase } from './supabase'

export interface CreateCharacterInput {
  username: string
  activationCode: string
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

export interface AbilityInput {
  name: string
  category: string
  action_type: string | null
  uses: string | null
  recharge: string | null
  summary: string | null
  description: string
  source: string | null
  tags: string[]
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

export const loadProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data as Profile
}

export const loadPlayerBundle = async (userId: string): Promise<PlayerBundle> => {
  const client = requireSupabase()
  const { data: characterData, error: characterError } = await client
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (characterError) throw characterError
  const character = characterData as Character

  const [progressionResult, spellResult, abilityResult] = await Promise.all([
    client
      .from('class_progression')
      .select('*')
      .eq('class_key', character.class_key)
      .eq('level', character.level)
      .maybeSingle(),
    client
      .from('character_spells')
      .select('*, spell:spells(*)')
      .eq('character_id', character.id)
      .order('created_at'),
    client
      .from('character_abilities')
      .select('*, ability:abilities(*)')
      .eq('character_id', character.id)
      .order('sort_order'),
  ])

  if (progressionResult.error) throw progressionResult.error
  if (spellResult.error) throw spellResult.error
  if (abilityResult.error) throw abilityResult.error

  return {
    character,
    progression: (progressionResult.data as ClassProgression | null) ?? null,
    spellAssignments: (spellResult.data ?? []) as CharacterSpell[],
    abilities: (abilityResult.data ?? []) as CharacterAbility[],
  }
}

export const listEligibleSpells = async (
  character: Character,
  maxSpellLevel: number,
): Promise<Spell[]> => {
  const client = requireSupabase()
  const query = client
    .from('spells')
    .select('*')
    .lte('level', maxSpellLevel)
    .contains('classes', [character.class_key])
    .order('level')
    .order('name')
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Spell[]
}

export const playerToggleSpell = async (
  characterId: string,
  spellId: string,
  active: boolean,
) => {
  const { error } = await requireSupabase().rpc('player_toggle_spell', {
    p_character_id: characterId,
    p_spell_id: spellId,
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

export const setAllChoicesUnlocked = async (
  characterIds: string[],
  unlocked: boolean,
) => {
  if (characterIds.length === 0) return
  const { error } = await requireSupabase()
    .from('characters')
    .update({ choices_unlocked: unlocked })
    .in('id', characterIds)
  if (error) throw error
}

export const listCharacters = async (): Promise<Character[]> => {
  const { data, error } = await requireSupabase()
    .from('characters')
    .select('*')
    .order('name')
  if (error) throw error
  return (data ?? []) as Character[]
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
  const { data, error } = await requireSupabase()
    .from('spells')
    .insert({ ...input, source_type: 'custom' })
    .select('*')
    .single()
  if (error) throw error
  return data as Spell
}

export const updateSpell = async (spellId: string, input: SpellInput): Promise<Spell> => {
  const { data, error } = await requireSupabase()
    .from('spells')
    .update(input)
    .eq('id', spellId)
    .eq('source_type', 'custom')
    .select('*')
    .single()
  if (error) throw error
  return data as Spell
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
  options: { prepared?: boolean; alwaysPrepared?: boolean } = {},
) => {
  const { error } = await requireSupabase().from('character_spells').upsert(
    {
      character_id: characterId,
      spell_id: spellId,
      in_collection: true,
      is_prepared: options.prepared ?? false,
      always_prepared: options.alwaysPrepared ?? false,
      assigned_by_dm: true,
    },
    { onConflict: 'character_id,spell_id' },
  )
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

export const listAbilities = async (): Promise<Ability[]> => {
  const { data, error } = await requireSupabase()
    .from('abilities')
    .select('*')
    .order('name')
  if (error) throw error
  return (data ?? []) as Ability[]
}

export const createAbility = async (input: AbilityInput): Promise<Ability> => {
  const { data, error } = await requireSupabase()
    .from('abilities')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data as Ability
}

export const updateAbility = async (abilityId: string, input: AbilityInput): Promise<Ability> => {
  const { data, error } = await requireSupabase()
    .from('abilities')
    .update(input)
    .eq('id', abilityId)
    .select('*')
    .single()
  if (error) throw error
  return data as Ability
}

export const deleteAbility = async (abilityId: string) => {
  const { error } = await requireSupabase().from('abilities').delete().eq('id', abilityId)
  if (error) throw error
}

export const assignAbility = async (characterId: string, abilityId: string) => {
  const { error } = await requireSupabase().from('character_abilities').upsert(
    { character_id: characterId, ability_id: abilityId },
    { onConflict: 'character_id,ability_id' },
  )
  if (error) throw error
}

export const removeAbilityAssignment = async (characterId: string, abilityId: string) => {
  const { error } = await requireSupabase()
    .from('character_abilities')
    .delete()
    .eq('character_id', characterId)
    .eq('ability_id', abilityId)
  if (error) throw error
}

export const listCharacterSpellIds = async (characterId: string): Promise<string[]> => {
  const { data, error } = await requireSupabase()
    .from('character_spells')
    .select('spell_id')
    .eq('character_id', characterId)
  if (error) throw error
  return (data ?? []).map((row) => String(row.spell_id))
}

export const listCharacterAbilityIds = async (characterId: string): Promise<string[]> => {
  const { data, error } = await requireSupabase()
    .from('character_abilities')
    .select('ability_id')
    .eq('character_id', characterId)
  if (error) throw error
  return (data ?? []).map((row) => String(row.ability_id))
}
