import {
  BookCopy,
  BookOpenText,
  Check,
  Edit3,
  Gem,
  KeyRound,
  LockKeyhole,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UnlockKeyhole,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AbilityCard } from '../components/AbilityCard'
import { AbilityEditor } from '../components/AbilityEditor'
import { CharacterEditor } from '../components/CharacterEditor'
import { MagicItemCard } from '../components/MagicItemCard'
import { SpellCard } from '../components/SpellCard'
import { SpellEditor } from '../components/SpellEditor'
import { SpellFilters } from '../components/SpellFilters'
import { Button, EmptyState, Field, Input, LoadingState, Modal, SegmentedControl, Select } from '../components/ui'
import {
  addCharacterToAccount,
  assignSpell,
  createAbility,
  createCampaign,
  createCharacter,
  createSpell,
  deleteAbility,
  deleteCampaign,
  deleteCharacter,
  deleteSpell,
  listAbilities,
  listCampaigns,
  listCharacterAbilityAssignments,
  listCharacterSpellAssignments,
  listCharacters,
  listSpells,
  removeSpellAssignment,
  resetPlayerLogin,
  setAbilityAssignment,
  setAllPreparationUnlocked,
  updateAbility,
  updateCampaign,
  updateCharacterMulticlass,
  updateSpell,
  updateSpellAlwaysPrepared,
  type AbilityAssignmentSummary,
  type AbilityInput,
  type SpellAssignmentSummary,
  type SpellInput,
} from '../lib/api'
import { canDeleteCampaign, charactersForCampaign, cleanCampaignName } from '../lib/campaigns'
import {
  matchesDmAbilityView,
  matchesDmMagicItemView,
  type DmAbilityView,
  type DmMagicItemView,
} from '../lib/abilityAssignments'
import { friendlyError, initials } from '../lib/format'
import { filterSpells } from '../lib/filter'
import { filterMagicItems, MAGIC_ITEM_RARITIES, magicItemCategories } from '../lib/magicItems'
import { characterBuildLabel } from '../lib/multiclass'
import { useRealtimeRefresh } from '../lib/realtime'
import { CHARACTER_CLASSES, SPELLCASTING_CLASSES, classLabel } from '../lib/rules'
import { dmSpellStatusLabel, matchesDmSpellView, type DmSpellView } from '../lib/spellAssignments'
import type { Ability, Campaign, Character, MagicItemFilters, Spell, SpellFilters as FilterValues } from '../types'

type DmTab = 'players' | 'spells' | 'items' | 'abilities'
type EditorState =
  | { kind: 'campaign'; campaign?: Campaign }
  | { kind: 'create-character' }
  | { kind: 'add-account-character'; accountCharacter: Character }
  | { kind: 'edit-character'; character: Character }
  | { kind: 'player-access'; character: Character }
  | { kind: 'spell'; spell?: Spell; duplicate?: boolean }
  | { kind: 'ability'; ability?: Ability; newKind?: 'custom' | 'magic_item' }
  | { kind: 'assign-spell'; spell: Spell }
  | null

const initialFilters: FilterValues = { search: '', level: 'all', classKey: 'all', school: 'all' }
const initialMagicItemFilters: MagicItemFilters = { search: '', category: 'all', rarity: 'all' }

const classRowsFor = (character: Character) => character.class_levels?.length
  ? character.class_levels
  : [{
    class_key: character.class_key,
    class_level: character.level,
    subclass: character.subclass,
    is_primary: true,
  }]

const characterClassesLabel = (character: Character) => characterBuildLabel(classRowsFor(character))

const hasCharacterClass = (character: Character | null, classKey: string) =>
  Boolean(character && classRowsFor(character).some((entry) => entry.class_key === classKey))

function CreateCharacterForm({
  campaigns,
  initialCampaignId,
  busy,
  onSubmit,
  onCancel,
}: {
  campaigns: Campaign[]
  initialCampaignId: string
  busy: boolean
  onSubmit: (input: { username: string; activationCode: string; characterName: string; classKey: string; level: number; campaignId: string }) => void
  onCancel: () => void
}) {
  const [username, setUsername] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [characterName, setCharacterName] = useState('')
  const [classKey, setClassKey] = useState('fighter')
  const [level, setLevel] = useState(1)
  const [campaignId, setCampaignId] = useState(initialCampaignId)

  return (
    <form className="editor-form" onSubmit={(event) => {
      event.preventDefault()
      onSubmit({ username, activationCode, characterName, classKey, level, campaignId })
    }}>
      <Field label="Campaign" hint="This controls which campaign roster the character appears in.">
        <Select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} required>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </Select>
      </Field>
      <div className="form-grid form-grid--2">
        <Field label="Player username" hint="3–32 lowercase letters, numbers, _ or -.">
          <Input pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="ragnar" required />
        </Field>
        <Field label="One-time activation code" hint="Use at least 6 characters; share it privately.">
          <Input minLength={6} value={activationCode} onChange={(event) => setActivationCode(event.target.value)} placeholder="moon-4821" required />
        </Field>
      </div>
      <div className="form-grid form-grid--3">
        <Field label="Character name"><Input value={characterName} onChange={(event) => setCharacterName(event.target.value)} required /></Field>
        <Field label="Class">
          <Select value={classKey} onChange={(event) => setClassKey(event.target.value)}>
            {CHARACTER_CLASSES.map((key) => <option value={key} key={key}>{classLabel(key)}</option>)}
          </Select>
        </Field>
        <Field label="Level"><Input type="number" min={1} max={20} value={level} onChange={(event) => setLevel(Number(event.target.value))} required /></Field>
      </div>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create player'}</Button>
      </div>
    </form>
  )
}

function AddAccountCharacterForm({
  accountCharacter,
  campaigns,
  initialCampaignId,
  busy,
  onSubmit,
  onCancel,
}: {
  accountCharacter: Character
  campaigns: Campaign[]
  initialCampaignId: string
  busy: boolean
  onSubmit: (input: { characterName: string; classKey: string; level: number; campaignId: string }) => void
  onCancel: () => void
}) {
  const [characterName, setCharacterName] = useState('')
  const [classKey, setClassKey] = useState('fighter')
  const [level, setLevel] = useState(1)
  const [campaignId, setCampaignId] = useState(initialCampaignId)

  return (
    <form className="editor-form" onSubmit={(event) => {
      event.preventDefault()
      onSubmit({ characterName, classKey, level, campaignId })
    }}>
      <div className="form-message form-message--info">
        <strong>{accountCharacter.login_username}</strong> will use the same username and password for both characters.
      </div>
      <Field label="Campaign" hint="Choose the campaign this character belongs to.">
        <Select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} required>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </Select>
      </Field>
      <div className="form-grid form-grid--3">
        <Field label="Character name"><Input value={characterName} onChange={(event) => setCharacterName(event.target.value)} required autoFocus /></Field>
        <Field label="Class">
          <Select value={classKey} onChange={(event) => setClassKey(event.target.value)}>
            {CHARACTER_CLASSES.map((key) => <option value={key} key={key}>{classLabel(key)}</option>)}
          </Select>
        </Field>
        <Field label="Level"><Input type="number" min={1} max={20} value={level} onChange={(event) => setLevel(Number(event.target.value))} required /></Field>
      </div>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add to account'}</Button>
      </div>
    </form>
  )
}

function CampaignForm({
  campaign,
  busy,
  onSubmit,
  onCancel,
}: {
  campaign?: Campaign
  busy: boolean
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(campaign?.name ?? '')

  return (
    <form className="editor-form" onSubmit={(event) => { event.preventDefault(); onSubmit(cleanCampaignName(name)) }}>
      <Field label="Campaign name" hint="Players only see their own character; this name organizes your DM dashboard.">
        <Input minLength={1} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Spelljammer" required autoFocus />
      </Field>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy || cleanCampaignName(name).length === 0}>{busy ? 'Saving…' : campaign ? 'Save campaign' : 'Create campaign'}</Button>
      </div>
    </form>
  )
}

function PlayerAccessForm({
  character,
  accountCharacterCount,
  busy,
  onSubmit,
  onCancel,
}: {
  character: Character
  accountCharacterCount: number
  busy: boolean
  onSubmit: (username: string, code: string) => void
  onCancel: () => void
}) {
  const [username, setUsername] = useState(character.login_username)
  const [code, setCode] = useState('')
  const active = Boolean(character.user_id)

  return (
    <form className="editor-form" onSubmit={(event) => {
      event.preventDefault()
      if (active && !window.confirm(
        accountCharacterCount > 1
          ? `Reset ${character.login_username}'s login for all ${accountCharacterCount} linked characters? Their current password and signed-in sessions will stop working.`
          : `Reset ${character.name}'s login? Their current password and signed-in sessions will stop working.`,
      )) return
      onSubmit(username, code)
    }}>
      <div className={`form-message ${active ? 'form-message--error' : 'form-message--info'}`}>
        {active
          ? <>This removes only the current login for {accountCharacterCount > 1 ? `all ${accountCharacterCount} linked characters` : 'this character'}. <strong>Campaigns, cards, and character data will not be deleted.</strong></>
          : <>Update the shared username or replace the unused one-time code before this player activates.</>}
      </div>
      <Field label="Player username" hint="You may keep the current username or enter a new one.">
        <Input
          pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          required
          autoFocus
        />
      </Field>
      <Field label="New one-time activation code" hint="At least 6 characters. Copy it now; it cannot be viewed later.">
        <Input minLength={6} value={code} onChange={(event) => setCode(event.target.value)} required />
      </Field>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant={active ? 'danger' : 'primary'} disabled={busy}>
          {busy ? 'Saving…' : active ? accountCharacterCount > 1 ? 'Reset account login' : 'Reset player login' : 'Save access details'}
        </Button>
      </div>
    </form>
  )
}

function AssignmentForm({
  spell,
  character,
  busy,
  onSubmit,
  onCancel,
}: {
  spell: Spell
  character: Character
  busy: boolean
  onSubmit: (sourceClassKey: string, prepared: boolean, alwaysPrepared: boolean) => void
  onCancel: () => void
}) {
  const sourceOptions = classRowsFor(character).filter((entry) => (
    SPELLCASTING_CLASSES.includes(entry.class_key)
    && (spell.source_type === 'custom' || spell.classes.includes(entry.class_key))
  ))
  const initialSource = sourceOptions.find((entry) => entry.is_primary)?.class_key
    ?? sourceOptions[0]?.class_key
    ?? 'dm'
  const [sourceClassKey, setSourceClassKey] = useState(initialSource)
  const [prepared, setPrepared] = useState(spell.level === 0 || initialSource !== 'wizard')
  const [alwaysPrepared, setAlwaysPrepared] = useState(false)
  return (
    <form className="editor-form" onSubmit={(event) => { event.preventDefault(); onSubmit(sourceClassKey, prepared || alwaysPrepared, alwaysPrepared) }}>
      <div className="assignment-summary"><span className="spell-card__sigil">{spell.level === 0 ? 'C' : spell.level}</span><div><strong>{spell.name}</strong><span>Assign to {character.name}</span></div></div>
      <Field label="Spell source" hint="Preparation and limits are tracked separately for each class.">
        <Select value={sourceClassKey} onChange={(event) => {
          const nextSource = event.target.value
          setSourceClassKey(nextSource)
          if (nextSource === 'wizard' && spell.level > 0) setPrepared(false)
        }}>
          {sourceOptions.map((entry) => <option key={entry.class_key} value={entry.class_key}>{classLabel(entry.class_key)} spell</option>)}
          <option value="dm">General DM-granted spell</option>
        </Select>
      </Field>
      <div className="unlock-panel">
        <label className="switch-row"><span><strong>Selected/prepared now</strong><small>Show this spell with the player’s active cards immediately.</small></span><input type="checkbox" checked={prepared} onChange={(event) => setPrepared(event.target.checked)} /></label>
        <label className="switch-row"><span><strong>Always prepared</strong><small>Keep it active and exclude it from the normal spell limit.</small></span><input type="checkbox" checked={alwaysPrepared} onChange={(event) => { setAlwaysPrepared(event.target.checked); if (event.target.checked) setPrepared(true) }} /></label>
      </div>
      {sourceClassKey === 'wizard' && <p className="form-tip">For a Wizard, leaving “selected” off adds the spell to that character’s Wizard spellbook without preparing it.</p>}
      {sourceClassKey === 'dm' && <p className="form-tip">A general DM-granted spell is not part of a class preparation pool. Turn on “selected” or “always prepared” if it should appear on the player’s active cards.</p>}
      <div className="form-actions"><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Assigning…' : 'Assign spell'}</Button></div>
    </form>
  )
}

export function DmDashboard({
  onError,
  onSuccess,
}: {
  onError: (message: string) => void
  onSuccess: (message: string) => void
}) {
  const [tab, setTab] = useState<DmTab>('players')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [spells, setSpells] = useState<Spell[]>([])
  const [abilities, setAbilities] = useState<Ability[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [spellAssignments, setSpellAssignments] = useState<Map<string, SpellAssignmentSummary>>(new Map())
  const [abilityAssignments, setAbilityAssignments] = useState<Map<string, AbilityAssignmentSummary>>(new Map())
  const [filters, setFilters] = useState<FilterValues>(initialFilters)
  const [spellView, setSpellView] = useState<DmSpellView>('all')
  const [abilitySearch, setAbilitySearch] = useState('')
  const [abilityClassFilter, setAbilityClassFilter] = useState('selected')
  const [abilityView, setAbilityView] = useState<DmAbilityView>('all')
  const [magicItemFilters, setMagicItemFilters] = useState<MagicItemFilters>(initialMagicItemFilters)
  const [magicItemView, setMagicItemView] = useState<DmMagicItemView>('all')
  const [visibleSpells, setVisibleSpells] = useState(40)
  const [visibleMagicItems, setVisibleMagicItems] = useState(40)
  const [editor, setEditor] = useState<EditorState>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null
  const campaignCharacters = useMemo(
    () => charactersForCampaign(characters, selectedCampaignId),
    [characters, selectedCampaignId],
  )
  const selectedCharacter = campaignCharacters.find((character) => character.id === selectedCharacterId) ?? null
  const assignedAbilityIds = useMemo(() => new Set(
    [...abilityAssignments.values()]
      .filter((assignment) => assignment.is_enabled)
      .map((assignment) => assignment.ability_id),
  ), [abilityAssignments])
  const allPreparationUnlocked = characters.length > 0 && characters.every(
    (character) => character.preparation_unlocked,
  )
  const accountCharactersFor = (character: Character) => characters.filter((candidate) => (
    character.user_id
      ? candidate.user_id === character.user_id
      : candidate.user_id === null && candidate.login_username === character.login_username
  ))

  const load = useCallback(async (preferredCampaignId?: string, showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      const [campaignRows, characterRows, spellRows, abilityRows] = await Promise.all([
        listCampaigns(),
        listCharacters(),
        listSpells(),
        listAbilities(),
      ])
      setCampaigns(campaignRows)
      setCharacters(characterRows)
      setSpells(spellRows)
      setAbilities(abilityRows)
      setSelectedCampaignId((current) =>
        preferredCampaignId && campaignRows.some((campaign) => campaign.id === preferredCampaignId)
          ? preferredCampaignId
          : campaignRows.some((campaign) => campaign.id === current)
            ? current
            : campaignRows[0]?.id ?? '',
      )
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [onError])

  const loadAssignments = useCallback(async (characterId: string) => {
    if (!characterId) {
      setSpellAssignments(new Map())
      setAbilityAssignments(new Map())
      return
    }
    try {
      const [spellAssignments, abilityRows] = await Promise.all([
        listCharacterSpellAssignments(characterId),
        listCharacterAbilityAssignments(characterId),
      ])
      setSpellAssignments(new Map(
        spellAssignments.map((assignment) => [assignment.spell_id, assignment]),
      ))
      setAbilityAssignments(new Map(
        abilityRows.map((assignment) => [assignment.ability_id, assignment]),
      ))
    } catch (error) {
      onError(friendlyError(error))
    }
  }, [onError])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    setSelectedCharacterId((current) =>
      campaignCharacters.some((character) => character.id === current)
        ? current
        : campaignCharacters[0]?.id ?? '',
    )
  }, [campaignCharacters])
  useEffect(() => { void loadAssignments(selectedCharacterId) }, [loadAssignments, selectedCharacterId])
  useEffect(() => {
    if (spellView === 'spellbook' && !hasCharacterClass(selectedCharacter, 'wizard')) setSpellView('assigned')
  }, [selectedCharacter, spellView])
  useEffect(() => {
    if (selectedCharacter) return
    setAbilityView('all')
    setMagicItemView('all')
  }, [selectedCharacter])

  const selectedCharacterIdRef = useRef(selectedCharacterId)
  selectedCharacterIdRef.current = selectedCharacterId
  const refreshLiveData = useCallback(async () => {
    await Promise.all([
      load(undefined, false),
      loadAssignments(selectedCharacterIdRef.current),
    ])
  }, [load, loadAssignments])
  useRealtimeRefresh({
    channelName: 'campaign-compendium-dm',
    onRefresh: refreshLiveData,
  })

  const filteredSpells = useMemo(() => {
    const isWizard = hasCharacterClass(selectedCharacter, 'wizard')
    return filterSpells(spells, filters).filter((spell) => (
      matchesDmSpellView(spellAssignments.get(spell.id), spellView, isWizard)
    ))
  }, [spells, filters, selectedCharacter, spellAssignments, spellView])
  const magicItems = useMemo(
    () => abilities.filter((ability) => ability.ability_kind === 'magic_item'),
    [abilities],
  )
  const nonMagicAbilities = useMemo(
    () => abilities.filter((ability) => ability.ability_kind !== 'magic_item'),
    [abilities],
  )
  const filteredMagicItems = useMemo(
    () => filterMagicItems(magicItems, magicItemFilters).filter((item) => (
      matchesDmMagicItemView(abilityAssignments.get(item.id), magicItemView)
    )),
    [magicItems, magicItemFilters, abilityAssignments, magicItemView],
  )
  const magicItemCategoryOptions = useMemo(() => magicItemCategories(magicItems), [magicItems])
  const filteredAbilities = useMemo(() => {
    const search = abilitySearch.trim().toLowerCase()
    return nonMagicAbilities.filter((ability) =>
      matchesDmAbilityView(abilityAssignments.get(ability.id), abilityView)
      && (abilityClassFilter === 'all'
        || (abilityClassFilter === 'selected'
          ? !ability.is_system || ability.ability_kind === 'feat' || Boolean(
            selectedCharacter && classRowsFor(selectedCharacter).some((entry) => entry.class_key === ability.class_key)
          )
          : abilityClassFilter === 'feats'
            ? ability.ability_kind === 'feat'
          : abilityClassFilter === 'custom'
            ? !ability.is_system
          : ability.class_key === abilityClassFilter))
      && (!search || `${ability.name} ${ability.category} ${ability.prerequisite ?? ''} ${ability.tags.join(' ')}`.toLowerCase().includes(search)),
    )
  }, [nonMagicAbilities, abilityAssignments, abilityClassFilter, abilitySearch, abilityView, selectedCharacter])
  const assignedAbilityCount = nonMagicAbilities.filter((ability) => assignedAbilityIds.has(ability.id)).length
  const assignedMagicItemCount = magicItems.filter((item) => assignedAbilityIds.has(item.id)).length
  const assignedSpellCount = [...spellAssignments.values()].filter((assignment) => assignment.in_collection).length
  const preparedSpellCount = [...spellAssignments.values()].filter((assignment) => assignment.is_prepared).length

  const act = async (operation: () => Promise<void>, success: string, close = true) => {
    setBusy(true)
    try {
      await operation()
      if (close) setEditor(null)
      await load(undefined, false)
      await loadAssignments(selectedCharacterId)
      onSuccess(success)
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  const saveCampaign = async (name: string) => {
    if (editor?.kind !== 'campaign') return
    setBusy(true)
    try {
      const savedCampaign = editor.campaign
        ? await updateCampaign(editor.campaign.id, name)
        : await createCampaign(name)
      const wasUpdate = Boolean(editor.campaign)
      setEditor(null)
      await load(savedCampaign.id, false)
      onSuccess(wasUpdate ? `${savedCampaign.name} updated.` : `${savedCampaign.name} created.`)
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  const deleteCampaignRow = async (campaign: Campaign) => {
    if (campaigns.length <= 1) {
      onError('Keep at least one campaign.')
      return
    }
    if (!canDeleteCampaign(characters, campaign.id)) {
      onError('Move or delete every player in this campaign before deleting it.')
      return
    }
    if (!window.confirm(`Delete the empty campaign ${campaign.name}?`)) return

    setBusy(true)
    try {
      await deleteCampaign(campaign.id)
      await load(undefined, false)
      onSuccess(`${campaign.name} deleted.`)
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  const deleteCharacterRow = async (character: Character) => {
    if (!window.confirm(`Delete ${character.name} and all assigned cards? This cannot be undone.`)) return
    await act(() => deleteCharacter(character.id), `${character.name} deleted.`, false)
  }

  const toggleAllPreparation = async () => {
    const unlocked = !allPreparationUnlocked
    setBusy(true)
    try {
      await setAllPreparationUnlocked(characters.map((character) => character.id), unlocked)
      setCharacters((current) => current.map((character) => ({
        ...character,
        preparation_unlocked: unlocked,
      })))
      onSuccess(unlocked ? 'Spell preparation opened for every player.' : 'Spell preparation locked for every player.')
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  const saveSpell = async (input: SpellInput) => {
    if (editor?.kind !== 'spell') return
    const isEdit = Boolean(editor.spell && !editor.duplicate)
    await act(async () => {
      if (isEdit && editor.spell) await updateSpell(editor.spell, input)
      else await createSpell(input)
    }, isEdit ? `${input.name} updated.` : `${input.name} created.`)
  }

  const saveAbility = async (input: AbilityInput) => {
    if (editor?.kind !== 'ability') return
    const isEdit = Boolean(editor.ability)
    await act(async () => {
      if (editor.ability) await updateAbility(editor.ability, input)
      else await createAbility(input, editor.newKind ?? 'custom')
    }, isEdit ? `${input.name} updated.` : `${input.name} created.`)
  }

  const setAlwaysPrepared = async (spell: Spell, alwaysPrepared: boolean) => {
    if (!selectedCharacter) return
    setBusy(true)
    try {
      await updateSpellAlwaysPrepared(selectedCharacter.id, spell.id, alwaysPrepared)
      setSpellAssignments((current) => {
        const next = new Map(current)
        const assignment = next.get(spell.id)
        if (assignment) {
          next.set(spell.id, {
            ...assignment,
            always_prepared: alwaysPrepared,
            is_prepared: alwaysPrepared ? true : assignment.is_prepared,
          })
        }
        return next
      })
      onSuccess(alwaysPrepared
        ? `${spell.name} is now always prepared for ${selectedCharacter.name}.`
        : `${spell.name} now counts toward ${selectedCharacter.name}'s normal spell limit.`)
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Opening the DM workshop…" />

  return (
    <div className="dm-dashboard">
      <section className="dm-hero">
        <div><span className="eyebrow">Dungeon Master workshop</span><h1>Campaign control room</h1><p>Create player access, build cards, and decide exactly what each character can see.</p></div>
        <div className="dm-hero__stats"><span><strong>{campaignCharacters.length}</strong> characters here</span><span><strong>{campaigns.length}</strong> campaigns</span><span><strong>{spells.length + abilities.length}</strong> shared cards</span></div>
      </section>

      <section className="campaign-bar" aria-label="Campaign controls">
        <label className="campaign-bar__selection">
          <span className="eyebrow">Active campaign</span>
          <Select
            value={selectedCampaignId}
            onChange={(event) => {
              setSelectedCampaignId(event.target.value)
              setSelectedCharacterId('')
            }}
            aria-label="Active campaign"
          >
            {campaigns.length === 0 && <option value="">No campaigns yet</option>}
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </Select>
        </label>
        <p className="campaign-bar__copy">{campaignCharacters.length} {campaignCharacters.length === 1 ? 'character' : 'characters'} · shared spell, item, and ability libraries</p>
        <div className="campaign-bar__actions">
          <Button variant="secondary" onClick={() => setEditor({ kind: 'campaign' })}><Plus size={17} /> New campaign</Button>
          <Button variant="ghost" disabled={!selectedCampaign} onClick={() => selectedCampaign && setEditor({ kind: 'campaign', campaign: selectedCampaign })}><Edit3 size={16} /> Rename</Button>
          <Button
            variant="ghost"
            className="danger-text"
            disabled={!selectedCampaign || campaigns.length <= 1 || !canDeleteCampaign(characters, selectedCampaign.id)}
            title={campaigns.length <= 1 ? 'Keep at least one campaign' : selectedCampaign && !canDeleteCampaign(characters, selectedCampaign.id) ? 'Move or delete this campaign’s players first' : 'Delete empty campaign'}
            onClick={() => selectedCampaign && void deleteCampaignRow(selectedCampaign)}
          ><Trash2 size={16} /> Delete</Button>
        </div>
      </section>

      <SegmentedControl
        label="DM sections"
        value={tab}
        onChange={(value) => { setTab(value); setVisibleSpells(40); setVisibleMagicItems(40) }}
        options={[
          { value: 'players', label: 'Players' },
          { value: 'spells', label: 'Spell library' },
          { value: 'items', label: 'Magic items' },
          { value: 'abilities', label: 'Abilities' },
        ]}
      />

      {tab === 'players' && (
        <section className="dashboard-section">
          <div className="section-heading">
            <div><span className="eyebrow">Access & progression</span><h2>{selectedCampaign?.name ?? 'Players and characters'}</h2></div>
            <div className="section-heading__actions">
              <Button variant="secondary" disabled={characters.length === 0 || busy} onClick={() => void toggleAllPreparation()}>
                {allPreparationUnlocked ? <LockKeyhole size={17} /> : <UnlockKeyhole size={17} />}
                {allPreparationUnlocked ? 'Lock prep for everyone' : 'Open prep for everyone'}
              </Button>
              <Button disabled={!selectedCampaign || busy} onClick={() => setEditor({ kind: 'create-character' })}><UserPlus size={18} /> Add player</Button>
            </div>
          </div>
          {!selectedCampaign ? (
            <EmptyState icon={<Users />} title="Create your first campaign" message="Campaigns keep player rosters separate while sharing the same card library." action={<Button onClick={() => setEditor({ kind: 'campaign' })}><Plus size={18} /> Create campaign</Button>} />
          ) : campaignCharacters.length === 0 ? (
            <EmptyState icon={<Users />} title={`Add a player to ${selectedCampaign.name}`} message="Give them a username, one-time activation code, and starting character details." action={<Button onClick={() => setEditor({ kind: 'create-character' })}><Plus size={18} /> Create player</Button>} />
          ) : (
            <div className="player-admin-grid">
              {campaignCharacters.map((character) => {
                const accountCharacterCount = accountCharactersFor(character).length
                return (
                <article className="player-admin-card" key={character.id}>
                  <div className="player-avatar">{initials(character.name)}</div>
                  <div className="player-admin-card__identity">
                    <h3>{character.name}</h3>
                    <p>Level {character.level} · {characterClassesLabel(character)}</p>
                    <span className={`status-chip ${character.user_id ? 'status-chip--active' : ''}`}>{character.user_id ? 'Activated' : 'Waiting for player'}</span>
                  </div>
                  <dl className="player-admin-card__details">
                    <div><dt>Username</dt><dd>{character.login_username}</dd></div>
                    <div><dt>Account</dt><dd>{accountCharacterCount} {accountCharacterCount === 1 ? 'character' : 'characters'}</dd></div>
                    <div><dt>Preparation</dt><dd>{character.preparation_unlocked ? 'Unlocked' : 'Locked'}</dd></div>
                  </dl>
                  <div className="player-admin-card__actions">
                    <Button variant="secondary" onClick={() => setEditor({ kind: 'edit-character', character })}><Edit3 size={16} /> Edit</Button>
                    <Button variant="ghost" onClick={() => setEditor({ kind: 'add-account-character', accountCharacter: character })}><UserPlus size={16} /> Add character</Button>
                    <Button variant="ghost" onClick={() => setEditor({ kind: 'player-access', character })}><KeyRound size={16} /> {character.user_id ? accountCharacterCount > 1 ? 'Reset account' : 'Reset login' : 'Access setup'}</Button>
                    <Button variant="ghost" onClick={() => { setSelectedCharacterId(character.id); setTab('spells') }}><BookOpenText size={16} /> Cards</Button>
                    <Button variant="ghost" className="danger-text" onClick={() => void deleteCharacterRow(character)}><Trash2 size={16} /> Delete</Button>
                  </div>
                </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {(tab === 'spells' || tab === 'items' || tab === 'abilities') && (
        <div className="library-toolbar">
          <label><span>Assign cards to</span><Select value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}><option value="">Choose a character</option>{campaignCharacters.map((character) => <option key={character.id} value={character.id}>{character.name} — L{character.level} {characterClassesLabel(character)}</option>)}</Select></label>
          {!selectedCharacter && <span className="toolbar-hint"><Shield size={16} /> Select a character in {selectedCampaign?.name ?? 'this campaign'} to assign cards.</span>}
        </div>
      )}

      {tab === 'spells' && (
        <section className="dashboard-section">
          <div className="section-heading">
            <div><span className="eyebrow">SRD + homebrew</span><h2>Spell library</h2></div>
            <Button onClick={() => setEditor({ kind: 'spell' })}><Plus size={18} /> Custom spell</Button>
          </div>
          <SpellFilters value={filters} onChange={(value) => { setFilters(value); setVisibleSpells(40) }} />
          <div className="spell-player-filter">
            <label>
              <span>Show for {selectedCharacter?.name ?? 'selected player'}</span>
              <Select
                aria-label="Filter by player spell status"
                value={spellView}
                disabled={!selectedCharacter}
                onChange={(event) => { setSpellView(event.target.value as DmSpellView); setVisibleSpells(40) }}
              >
                <option value="all">Every spell in the library</option>
                <option value="assigned">On this character</option>
                <option value="prepared">Prepared or selected now</option>
                <option value="always">Always prepared</option>
                <option value="unprepared">Assigned but not active</option>
                {hasCharacterClass(selectedCharacter, 'wizard') && <option value="spellbook">Wizard spellbook</option>}
              </Select>
            </label>
            {selectedCharacter && <span>{assignedSpellCount} on character · {preparedSpellCount} currently active</span>}
          </div>
          <div className="library-summary"><span>{filteredSpells.length} matching spells</span><span>{assignedSpellCount} assigned to {selectedCharacter?.name ?? 'no player'}</span></div>
          {filteredSpells.length === 0 ? (
            <EmptyState icon={<BookOpenText />} title="No matching spells" message="Change the spell filters or the selected player view." />
          ) : (
            <>
              <div className="card-grid">
                {filteredSpells.slice(0, visibleSpells).map((spell) => {
                  const assignment = spellAssignments.get(spell.id)
                  const assigned = Boolean(assignment?.in_collection)
                  const alwaysPrepared = Boolean(assignment?.always_prepared)
                  const status = dmSpellStatusLabel(assignment, hasCharacterClass(selectedCharacter, 'wizard'))
                  const sources = assignment?.source_class_keys
                    ?.map((source) => source === 'dm' ? 'DM granted' : classLabel(source))
                    .join(' / ')
                  return (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      badge={status && selectedCharacter ? `${status}${sources ? ` · ${sources}` : ''} · ${selectedCharacter.name}` : undefined}
                      secondaryAction={
                        <div className="card-action-group">
                          <Button variant="ghost" onClick={() => setEditor({ kind: 'spell', spell, duplicate: true })}><BookCopy size={16} /> Duplicate</Button>
                          <Button variant="ghost" onClick={() => setEditor({ kind: 'spell', spell })}><Edit3 size={16} /> Edit</Button>
                          {spell.source_type === 'custom' && <Button variant="ghost" className="danger-text" onClick={() => {
                            if (window.confirm(`Delete the custom spell ${spell.name}?`)) void act(() => deleteSpell(spell.id), `${spell.name} deleted.`, false)
                          }}><Trash2 size={16} /></Button>}
                        </div>
                      }
                      action={
                        assigned ? (
                          <div className="card-action-group">
                            <label className="compact-switch" title={alwaysPrepared ? 'Turn off to make this count toward the normal spell limit.' : 'Turn on to keep this prepared without counting toward the normal spell limit.'}>
                              <input
                                type="checkbox"
                                aria-label={`Always prepared: ${spell.name}`}
                                checked={alwaysPrepared}
                                disabled={!selectedCharacter || busy}
                                onChange={(event) => void setAlwaysPrepared(spell, event.target.checked)}
                              />
                              <span>Always prepared</span>
                            </label>
                            <Button variant="ghost" disabled={!selectedCharacter || busy} onClick={() => setEditor({ kind: 'assign-spell', spell })}><Plus size={17} /> Add source</Button>
                            <Button variant="secondary" disabled={!selectedCharacter || busy} onClick={() => selectedCharacter && void act(() => removeSpellAssignment(selectedCharacter.id, spell.id), `${spell.name} removed from ${selectedCharacter.name}.`, false)}><X size={17} /> Remove all</Button>
                          </div>
                        ) : (
                          <Button disabled={!selectedCharacter} onClick={() => setEditor({ kind: 'assign-spell', spell })}><Plus size={17} /> Assign</Button>
                        )
                      }
                    />
                  )
                })}
              </div>
              {visibleSpells < filteredSpells.length && <div className="load-more"><Button variant="secondary" onClick={() => setVisibleSpells((count) => count + 40)}>Show more spells</Button></div>}
            </>
          )}
        </section>
      )}

      {tab === 'items' && (
        <section className="dashboard-section">
          <div className="section-heading">
            <div><span className="eyebrow">2024 rules &amp; homebrew</span><h2>Magic item library</h2></div>
            <div className="section-heading__actions"><span className="result-count">{magicItems.length} items</span><Button onClick={() => setEditor({ kind: 'ability', newKind: 'magic_item' })}><Plus size={18} /> New magic item</Button></div>
          </div>
          <div className="form-grid form-grid--3 magic-item-library-filters">
            <Field label="Search magic items">
              <span className="search-input"><Search size={18} /><Input aria-label="Search magic items" placeholder="Search by name, type, rarity, or tag…" value={magicItemFilters.search} onChange={(event) => { setMagicItemFilters((current) => ({ ...current, search: event.target.value })); setVisibleMagicItems(40) }} /></span>
            </Field>
            <Field label="Item type">
              <Select value={magicItemFilters.category} onChange={(event) => { setMagicItemFilters((current) => ({ ...current, category: event.target.value })); setVisibleMagicItems(40) }}>
                <option value="all">All item types</option>
                {magicItemCategoryOptions.map((category) => <option value={category} key={category}>{category}</option>)}
              </Select>
            </Field>
            <Field label="Rarity">
              <Select value={magicItemFilters.rarity} onChange={(event) => { setMagicItemFilters((current) => ({ ...current, rarity: event.target.value })); setVisibleMagicItems(40) }}>
                <option value="all">All rarities</option>
                {MAGIC_ITEM_RARITIES.map((rarity) => <option value={rarity} key={rarity}>{rarity}</option>)}
              </Select>
            </Field>
          </div>
          <div className="player-card-filter">
            <label>
              <span>Show for {selectedCharacter?.name ?? 'selected player'}</span>
              <Select
                aria-label="Filter by player magic-item status"
                value={magicItemView}
                disabled={!selectedCharacter}
                onChange={(event) => { setMagicItemView(event.target.value as DmMagicItemView); setVisibleMagicItems(40) }}
              >
                <option value="all">Every magic item in the library</option>
                <option value="assigned">Assigned to this character</option>
                <option value="unassigned">Not assigned to this character</option>
              </Select>
            </label>
            {selectedCharacter && <span>{assignedMagicItemCount} assigned to {selectedCharacter.name}</span>}
          </div>
          <div className="callout"><strong>Assigning magic items</strong><p>Create homebrew items or use the SRD library, then add any item to one or more characters. Players see only the items assigned to their character.</p></div>
          <div className="library-summary"><span>{filteredMagicItems.length} matching items</span><span>{assignedMagicItemCount} assigned to {selectedCharacter?.name ?? 'no player'}</span></div>
          {filteredMagicItems.length === 0 ? (
            <EmptyState
              icon={<Gem />}
              title={magicItemView === 'assigned' ? 'No assigned magic items' : 'No matching magic items'}
              message={magicItemView === 'assigned' && selectedCharacter
                ? `${selectedCharacter.name} does not currently have a magic item matching these filters.`
                : 'Change the player status, search, item type, or rarity filters.'}
            />
          ) : (
            <>
              <div className="card-grid">
                {filteredMagicItems.slice(0, visibleMagicItems).map((item) => {
                  const assigned = assignedAbilityIds.has(item.id)
                  return (
                    <MagicItemCard
                      item={item}
                      key={item.id}
                      badge={assigned ? `Assigned to ${selectedCharacter?.name}` : undefined}
                      secondaryAction={<div className="card-action-group"><Button variant="ghost" onClick={() => setEditor({ kind: 'ability', ability: item })}><Edit3 size={16} /> Edit</Button>{!item.is_system && <Button variant="ghost" className="danger-text" aria-label={`Delete ${item.name}`} onClick={() => { if (window.confirm(`Delete the custom magic item ${item.name}? It will also be removed from every character.`)) void act(() => deleteAbility(item.id), `${item.name} deleted.`, false) }}><Trash2 size={16} /></Button>}</div>}
                      action={<Button variant={assigned ? 'secondary' : 'primary'} disabled={!selectedCharacter || busy} onClick={() => selectedCharacter && void act(
                        () => setAbilityAssignment(selectedCharacter.id, item.id, !assigned),
                        assigned ? `${item.name} removed from ${selectedCharacter.name}.` : `${item.name} assigned to ${selectedCharacter.name}.`,
                        false,
                      )}>{assigned ? <X size={17} /> : <Check size={17} />} {assigned ? 'Remove' : 'Assign'}</Button>}
                    />
                  )
                })}
              </div>
              {visibleMagicItems < filteredMagicItems.length && <div className="load-more"><Button variant="secondary" onClick={() => setVisibleMagicItems((count) => count + 40)}>Show more items</Button></div>}
            </>
          )}
        </section>
      )}

      {tab === 'abilities' && (
        <section className="dashboard-section">
          <div className="section-heading"><div><span className="eyebrow">Features, feats & homebrew</span><h2>Ability library</h2></div><Button onClick={() => setEditor({ kind: 'ability' })}><Plus size={18} /> New ability</Button></div>
          <div className="form-grid form-grid--2 ability-library-filters">
            <Field label="Search abilities">
              <span className="search-input"><Search size={18} /><Input aria-label="Search abilities" placeholder="Search by name, class, or tag…" value={abilitySearch} onChange={(event) => setAbilitySearch(event.target.value)} /></span>
            </Field>
            <Field label="Show abilities for">
              <Select value={abilityClassFilter} onChange={(event) => setAbilityClassFilter(event.target.value)}>
                <option value="selected">{selectedCharacter ? `${characterClassesLabel(selectedCharacter)} + feats + custom` : 'Current character + feats + custom'}</option>
                <option value="feats">Feats only</option>
                <option value="custom">Custom cards only</option>
                <option value="all">Every ability</option>
                {CHARACTER_CLASSES.map((key) => <option key={key} value={key}>{classLabel(key)}</option>)}
              </Select>
            </Field>
          </div>
          <div className="player-card-filter">
            <label>
              <span>Show for {selectedCharacter?.name ?? 'selected player'}</span>
              <Select
                aria-label="Filter by player ability status"
                value={abilityView}
                disabled={!selectedCharacter}
                onChange={(event) => {
                  const nextView = event.target.value as DmAbilityView
                  setAbilityView(nextView)
                  if (nextView !== 'all') setAbilityClassFilter('all')
                }}
              >
                <option value="all">Every ability matching the library filters</option>
                <option value="shown">Currently shown to this character</option>
                <option value="automatic">Automatic class features</option>
                <option value="dm_added">Added by the DM</option>
                <option value="hidden">Hidden by the DM</option>
                <option value="not_shown">Not currently shown to this character</option>
              </Select>
            </label>
            {selectedCharacter && <span>{assignedAbilityCount} currently shown to {selectedCharacter.name}</span>}
          </div>
          <div className="callout"><strong>Class features and feats</strong><p>Class features follow class and level automatically. Feats are added manually after a character chooses or earns one; use the prerequisite shown on each card to check eligibility.</p></div>
          <div className="library-summary"><span>{filteredAbilities.length} matching abilities</span><span>{assignedAbilityCount} assigned to {selectedCharacter?.name ?? 'no player'}</span></div>
          {filteredAbilities.length === 0 ? (
            <EmptyState
              icon={<Zap />}
              title={abilityView === 'shown' ? 'No abilities currently shown' : 'No matching abilities'}
              message={abilityView === 'shown' && selectedCharacter
                ? `${selectedCharacter.name} does not currently have an ability matching these filters.`
                : 'Change the player status, library, or search filters.'}
              action={abilityView === 'all' ? <Button onClick={() => setEditor({ kind: 'ability' })}><Sparkles size={18} /> Create ability</Button> : undefined}
            />
          ) : (
            <div className="card-grid">
              {filteredAbilities.map((ability) => {
                const assignment = abilityAssignments.get(ability.id)
                const assigned = assignment?.is_enabled ?? false
                const excluded = assignment?.assignment_type === 'dm_excluded'
                const automatic = assignment?.assignment_type === 'automatic'
                const nextEnabled = !assigned
                const actionLabel = excluded ? 'Restore' : assigned ? automatic ? 'Hide' : 'Remove' : 'Add'
                const assignmentBadge = excluded ? 'Hidden by DM' : automatic ? 'Automatic' : assigned ? ability.ability_kind === 'feat' ? 'Assigned feat' : 'DM override' : undefined
                return (
                  <AbilityCard
                    ability={ability}
                    key={ability.id}
                    badge={assignmentBadge}
                    secondaryAction={<div className="card-action-group"><Button variant="ghost" onClick={() => setEditor({ kind: 'ability', ability })}><Edit3 size={16} /> Edit</Button>{!ability.is_system && <Button variant="ghost" className="danger-text" onClick={() => { if (window.confirm(`Delete ${ability.name}?`)) void act(() => deleteAbility(ability.id), `${ability.name} deleted.`, false) }}><Trash2 size={16} /></Button>}</div>}
                    action={<Button variant={nextEnabled ? 'primary' : 'secondary'} disabled={!selectedCharacter || busy} onClick={() => selectedCharacter && void act(
                      () => setAbilityAssignment(selectedCharacter.id, ability.id, nextEnabled),
                      nextEnabled ? `${ability.name} shown to ${selectedCharacter.name}.` : `${ability.name} hidden from ${selectedCharacter.name}.`,
                      false,
                    )}>{nextEnabled ? <Check size={17} /> : <X size={17} />} {actionLabel}</Button>}
                  />
                )
              })}
            </div>
          )}
        </section>
      )}

      {editor?.kind === 'campaign' && <Modal title={editor.campaign ? `Rename ${editor.campaign.name}` : 'Create a campaign'} description="Campaigns separate player rosters. Spells, magic items, and abilities stay shared." onClose={() => setEditor(null)}><CampaignForm campaign={editor.campaign} busy={busy} onCancel={() => setEditor(null)} onSubmit={(name) => void saveCampaign(name)} /></Modal>}
      {editor?.kind === 'create-character' && <Modal title="Add a player" description="They will use the username and activation code for first-time setup." onClose={() => setEditor(null)} wide><CreateCharacterForm campaigns={campaigns} initialCampaignId={selectedCampaignId} busy={busy} onCancel={() => setEditor(null)} onSubmit={(input) => void act(() => createCharacter(input).then(() => undefined), `${input.characterName} created.`)} /></Modal>}
      {editor?.kind === 'add-account-character' && (
        <Modal
          title={`Add a character for ${editor.accountCharacter.login_username}`}
          description="The new character will use this player's existing account. No second login or activation code is needed."
          onClose={() => setEditor(null)}
          wide
        >
          <AddAccountCharacterForm
            accountCharacter={editor.accountCharacter}
            campaigns={campaigns}
            initialCampaignId={campaigns.find((campaign) => campaign.id !== editor.accountCharacter.campaign_id)?.id ?? editor.accountCharacter.campaign_id}
            busy={busy}
            onCancel={() => setEditor(null)}
            onSubmit={(input) => void act(
              () => addCharacterToAccount({
                accountCharacterId: editor.accountCharacter.id,
                ...input,
              }).then(() => undefined),
              `${input.characterName} added to ${editor.accountCharacter.login_username}'s account.`,
            )}
          />
        </Modal>
      )}
      {editor?.kind === 'edit-character' && <Modal title={`Edit ${editor.character.name}`} description="Add every class and its individual level. Class features and spell preparation update automatically." onClose={() => setEditor(null)} wide><CharacterEditor character={editor.character} campaigns={campaigns} busy={busy} onCancel={() => setEditor(null)} onSubmit={(changes, classes) => void act(() => updateCharacterMulticlass(editor.character.id, changes, classes), `${changes.name} updated.`)} /></Modal>}
      {editor?.kind === 'player-access' && (
        <Modal
          title={editor.character.user_id
            ? accountCharactersFor(editor.character).length > 1
              ? `Reset ${editor.character.login_username}'s account`
              : `Reset ${editor.character.name}'s login`
            : `Update ${editor.character.login_username}'s access`}
          description={editor.character.user_id ? 'They will reactivate once through First-time setup and choose a new private password.' : 'Set the shared username and one-time code they will use for First-time setup.'}
          onClose={() => setEditor(null)}
        >
          <PlayerAccessForm
            character={editor.character}
            accountCharacterCount={accountCharactersFor(editor.character).length}
            busy={busy}
            onCancel={() => setEditor(null)}
            onSubmit={(username, code) => void act(
              () => resetPlayerLogin(editor.character.id, username, code),
              editor.character.user_id
                ? `${editor.character.login_username}'s account was reset. Give them the username and new one-time code.`
                : `${editor.character.login_username}'s access details were updated.`,
            )}
          />
        </Modal>
      )}
      {editor?.kind === 'spell' && <Modal title={editor.duplicate ? `Duplicate ${editor.spell?.name}` : editor.spell ? `Edit ${editor.spell.name}` : 'Create a custom spell'} description={editor.duplicate ? 'This creates a separate homebrew copy; the original remains unchanged.' : editor.spell ? 'This changes the shared card for every campaign and player who can see it. Existing assignments stay in place.' : 'Fill in the fields and the app will generate the player card.'} onClose={() => setEditor(null)} wide><SpellEditor key={`${editor.spell?.id ?? 'new'}-${editor.duplicate ? 'copy' : 'edit'}`} spell={editor.spell} duplicate={editor.duplicate} busy={busy} onCancel={() => setEditor(null)} onSubmit={(input) => void saveSpell(input)} /></Modal>}
      {editor?.kind === 'ability' && <Modal title={editor.ability ? `Edit ${editor.ability.name}` : editor.newKind === 'magic_item' ? 'Create a custom magic item' : 'Create an ability card'} description={editor.ability ? 'This changes the shared card for every campaign and assigned player. Automatic class and level unlock rules stay protected.' : editor.newKind === 'magic_item' ? 'Fill in the item details once, then assign the finished card to any number of characters.' : 'Use this for a homebrew feature, feat, trait, or other custom ability.'} onClose={() => setEditor(null)} wide><AbilityEditor key={editor.ability?.id ?? editor.newKind ?? 'new'} ability={editor.ability} abilityKind={editor.newKind} busy={busy} onCancel={() => setEditor(null)} onSubmit={(input) => void saveAbility(input)} /></Modal>}
      {editor?.kind === 'assign-spell' && selectedCharacter && <Modal title="Assign spell" onClose={() => setEditor(null)}><AssignmentForm spell={editor.spell} character={selectedCharacter} busy={busy} onCancel={() => setEditor(null)} onSubmit={(sourceClassKey, prepared, alwaysPrepared) => void act(() => assignSpell(selectedCharacter.id, editor.spell.id, { sourceClassKey, prepared, alwaysPrepared }), `${editor.spell.name} assigned to ${selectedCharacter.name}.`)} /></Modal>}
    </div>
  )
}
