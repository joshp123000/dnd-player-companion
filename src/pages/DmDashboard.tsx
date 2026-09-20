import {
  BookCopy,
  BookOpenText,
  Check,
  Edit3,
  KeyRound,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AbilityCard } from '../components/AbilityCard'
import { AbilityEditor } from '../components/AbilityEditor'
import { CharacterEditor } from '../components/CharacterEditor'
import { SpellCard } from '../components/SpellCard'
import { SpellEditor } from '../components/SpellEditor'
import { SpellFilters } from '../components/SpellFilters'
import { Button, EmptyState, Field, Input, LoadingState, Modal, SegmentedControl, Select } from '../components/ui'
import {
  assignAbility,
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
  listCharacterAbilityIds,
  listCharacterSpellIds,
  listCharacters,
  listSpells,
  removeAbilityAssignment,
  removeSpellAssignment,
  rotateActivationCode,
  updateAbility,
  updateCampaign,
  updateCharacter,
  updateSpell,
  type AbilityInput,
  type SpellInput,
} from '../lib/api'
import { canDeleteCampaign, charactersForCampaign, cleanCampaignName } from '../lib/campaigns'
import { friendlyError, initials } from '../lib/format'
import { filterSpells } from '../lib/filter'
import { CHARACTER_CLASSES, classLabel } from '../lib/rules'
import type { Ability, Campaign, Character, Spell, SpellFilters as FilterValues } from '../types'

type DmTab = 'players' | 'spells' | 'abilities'
type EditorState =
  | { kind: 'campaign'; campaign?: Campaign }
  | { kind: 'create-character' }
  | { kind: 'edit-character'; character: Character }
  | { kind: 'activation'; character: Character }
  | { kind: 'spell'; spell?: Spell; duplicate?: boolean }
  | { kind: 'ability'; ability?: Ability }
  | { kind: 'assign-spell'; spell: Spell }
  | null

const initialFilters: FilterValues = { search: '', level: 'all', classKey: 'all', school: 'all' }

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

function ActivationCodeForm({
  character,
  busy,
  onSubmit,
  onCancel,
}: {
  character: Character
  busy: boolean
  onSubmit: (code: string) => void
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  return (
    <form className="editor-form" onSubmit={(event) => { event.preventDefault(); onSubmit(code) }}>
      <p>Replace the unused activation code for <strong>{character.login_username}</strong>.</p>
      <Field label="New activation code" hint="The old code will stop working immediately.">
        <Input minLength={6} value={code} onChange={(event) => setCode(event.target.value)} required autoFocus />
      </Field>
      <div className="form-actions"><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Replace code'}</Button></div>
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
  onSubmit: (prepared: boolean, alwaysPrepared: boolean) => void
  onCancel: () => void
}) {
  const [prepared, setPrepared] = useState(character.class_key !== 'wizard')
  const [alwaysPrepared, setAlwaysPrepared] = useState(false)
  return (
    <form className="editor-form" onSubmit={(event) => { event.preventDefault(); onSubmit(prepared || alwaysPrepared, alwaysPrepared) }}>
      <div className="assignment-summary"><span className="spell-card__sigil">{spell.level === 0 ? 'C' : spell.level}</span><div><strong>{spell.name}</strong><span>Assign to {character.name}</span></div></div>
      <div className="unlock-panel">
        <label className="switch-row"><span><strong>Selected/prepared now</strong><small>Show this spell with the player’s active cards immediately.</small></span><input type="checkbox" checked={prepared} onChange={(event) => setPrepared(event.target.checked)} /></label>
        <label className="switch-row"><span><strong>Always prepared</strong><small>Keep it active and exclude it from the normal spell limit.</small></span><input type="checkbox" checked={alwaysPrepared} onChange={(event) => { setAlwaysPrepared(event.target.checked); if (event.target.checked) setPrepared(true) }} /></label>
      </div>
      {character.class_key === 'wizard' && <p className="form-tip">For a Wizard, leaving “selected” off adds the spell to the spellbook without preparing it.</p>}
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
  const [assignedSpellIds, setAssignedSpellIds] = useState<Set<string>>(new Set())
  const [assignedAbilityIds, setAssignedAbilityIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<FilterValues>(initialFilters)
  const [abilitySearch, setAbilitySearch] = useState('')
  const [visibleSpells, setVisibleSpells] = useState(40)
  const [editor, setEditor] = useState<EditorState>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null
  const campaignCharacters = useMemo(
    () => charactersForCampaign(characters, selectedCampaignId),
    [characters, selectedCampaignId],
  )
  const selectedCharacter = campaignCharacters.find((character) => character.id === selectedCharacterId) ?? null

  const load = useCallback(async (preferredCampaignId?: string) => {
    setLoading(true)
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
      setLoading(false)
    }
  }, [onError])

  const loadAssignments = useCallback(async (characterId: string) => {
    if (!characterId) {
      setAssignedSpellIds(new Set())
      setAssignedAbilityIds(new Set())
      return
    }
    try {
      const [spellIds, abilityIds] = await Promise.all([
        listCharacterSpellIds(characterId),
        listCharacterAbilityIds(characterId),
      ])
      setAssignedSpellIds(new Set(spellIds))
      setAssignedAbilityIds(new Set(abilityIds))
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

  const filteredSpells = useMemo(() => filterSpells(spells, filters), [spells, filters])
  const filteredAbilities = useMemo(() => {
    const search = abilitySearch.trim().toLowerCase()
    if (!search) return abilities
    return abilities.filter((ability) =>
      `${ability.name} ${ability.category} ${ability.tags.join(' ')}`.toLowerCase().includes(search),
    )
  }, [abilities, abilitySearch])

  const act = async (operation: () => Promise<void>, success: string, close = true) => {
    setBusy(true)
    try {
      await operation()
      if (close) setEditor(null)
      await load()
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
      await load(savedCampaign.id)
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
      await load()
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

  const saveSpell = async (input: SpellInput) => {
    if (editor?.kind !== 'spell') return
    const isEdit = Boolean(editor.spell && !editor.duplicate && editor.spell.source_type === 'custom')
    await act(async () => {
      if (isEdit && editor.spell) await updateSpell(editor.spell.id, input)
      else await createSpell(input)
    }, isEdit ? `${input.name} updated.` : `${input.name} created.`)
  }

  const saveAbility = async (input: AbilityInput) => {
    if (editor?.kind !== 'ability') return
    const isEdit = Boolean(editor.ability)
    await act(async () => {
      if (editor.ability) await updateAbility(editor.ability.id, input)
      else await createAbility(input)
    }, isEdit ? `${input.name} updated.` : `${input.name} created.`)
  }

  if (loading) return <LoadingState label="Opening the DM workshop…" />

  return (
    <div className="dm-dashboard">
      <section className="dm-hero">
        <div><span className="eyebrow">Dungeon Master workshop</span><h1>Campaign control room</h1><p>Create player access, build cards, and decide exactly what each character can see.</p></div>
        <div className="dm-hero__stats"><span><strong>{campaignCharacters.length}</strong> players here</span><span><strong>{campaigns.length}</strong> campaigns</span><span><strong>{spells.length + abilities.length}</strong> shared cards</span></div>
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
        <p className="campaign-bar__copy">{campaignCharacters.length} {campaignCharacters.length === 1 ? 'player' : 'players'} · one shared spell and ability library</p>
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
        onChange={(value) => { setTab(value); setVisibleSpells(40) }}
        options={[
          { value: 'players', label: 'Players' },
          { value: 'spells', label: 'Spell library' },
          { value: 'abilities', label: 'Abilities' },
        ]}
      />

      {tab === 'players' && (
        <section className="dashboard-section">
          <div className="section-heading">
            <div><span className="eyebrow">Access & progression</span><h2>{selectedCampaign?.name ?? 'Players and characters'}</h2></div>
            <Button disabled={!selectedCampaign} onClick={() => setEditor({ kind: 'create-character' })}><UserPlus size={18} /> Add player</Button>
          </div>
          {!selectedCampaign ? (
            <EmptyState icon={<Users />} title="Create your first campaign" message="Campaigns keep player rosters separate while sharing the same card library." action={<Button onClick={() => setEditor({ kind: 'campaign' })}><Plus size={18} /> Create campaign</Button>} />
          ) : campaignCharacters.length === 0 ? (
            <EmptyState icon={<Users />} title={`Add a player to ${selectedCampaign.name}`} message="Give them a username, one-time activation code, and starting character details." action={<Button onClick={() => setEditor({ kind: 'create-character' })}><Plus size={18} /> Create player</Button>} />
          ) : (
            <div className="player-admin-grid">
              {campaignCharacters.map((character) => (
                <article className="player-admin-card" key={character.id}>
                  <div className="player-avatar">{initials(character.name)}</div>
                  <div className="player-admin-card__identity">
                    <h3>{character.name}</h3>
                    <p>Level {character.level} {classLabel(character.class_key)}</p>
                    <span className={`status-chip ${character.user_id ? 'status-chip--active' : ''}`}>{character.user_id ? 'Activated' : 'Waiting for player'}</span>
                  </div>
                  <dl className="player-admin-card__details">
                    <div><dt>Username</dt><dd>{character.login_username}</dd></div>
                    <div><dt>Preparation</dt><dd>{character.preparation_unlocked ? 'Unlocked' : 'Locked'}</dd></div>
                    <div><dt>Choices</dt><dd>{character.choices_unlocked ? 'Unlocked' : 'Locked'}</dd></div>
                  </dl>
                  <div className="player-admin-card__actions">
                    <Button variant="secondary" onClick={() => setEditor({ kind: 'edit-character', character })}><Edit3 size={16} /> Edit</Button>
                    {!character.user_id && <Button variant="ghost" onClick={() => setEditor({ kind: 'activation', character })}><KeyRound size={16} /> New code</Button>}
                    <Button variant="ghost" onClick={() => { setSelectedCharacterId(character.id); setTab('spells') }}><BookOpenText size={16} /> Cards</Button>
                    <Button variant="ghost" className="danger-text" onClick={() => void deleteCharacterRow(character)}><Trash2 size={16} /> Delete</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {(tab === 'spells' || tab === 'abilities') && (
        <div className="library-toolbar">
          <label><span>Assign cards to</span><Select value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}><option value="">Choose a character</option>{campaignCharacters.map((character) => <option key={character.id} value={character.id}>{character.name} — L{character.level} {classLabel(character.class_key)}</option>)}</Select></label>
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
          <div className="library-summary"><span>{filteredSpells.length} matching spells</span><span>{assignedSpellIds.size} assigned to {selectedCharacter?.name ?? 'no player'}</span></div>
          {filteredSpells.length === 0 ? (
            <EmptyState icon={<BookOpenText />} title="No matching spells" message="Change the filters or create a custom spell." />
          ) : (
            <>
              <div className="card-grid">
                {filteredSpells.slice(0, visibleSpells).map((spell) => {
                  const assigned = assignedSpellIds.has(spell.id)
                  return (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      badge={assigned ? `Assigned to ${selectedCharacter?.name}` : undefined}
                      secondaryAction={
                        <div className="card-action-group">
                          <Button variant="ghost" onClick={() => setEditor({ kind: 'spell', spell, duplicate: true })}><BookCopy size={16} /> Duplicate</Button>
                          {spell.source_type === 'custom' && <Button variant="ghost" onClick={() => setEditor({ kind: 'spell', spell })}><Edit3 size={16} /> Edit</Button>}
                          {spell.source_type === 'custom' && <Button variant="ghost" className="danger-text" onClick={() => {
                            if (window.confirm(`Delete the custom spell ${spell.name}?`)) void act(() => deleteSpell(spell.id), `${spell.name} deleted.`, false)
                          }}><Trash2 size={16} /></Button>}
                        </div>
                      }
                      action={
                        assigned ? (
                          <Button variant="secondary" disabled={!selectedCharacter || busy} onClick={() => selectedCharacter && void act(() => removeSpellAssignment(selectedCharacter.id, spell.id), `${spell.name} removed from ${selectedCharacter.name}.`, false)}><X size={17} /> Remove</Button>
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

      {tab === 'abilities' && (
        <section className="dashboard-section">
          <div className="section-heading"><div><span className="eyebrow">Features, feats & items</span><h2>Ability library</h2></div><Button onClick={() => setEditor({ kind: 'ability' })}><Plus size={18} /> New ability</Button></div>
          <label className="search-input standalone-search"><Search size={18} /><Input aria-label="Search abilities" placeholder="Search abilities…" value={abilitySearch} onChange={(event) => setAbilitySearch(event.target.value)} /></label>
          <div className="library-summary"><span>{filteredAbilities.length} matching abilities</span><span>{assignedAbilityIds.size} assigned to {selectedCharacter?.name ?? 'no player'}</span></div>
          {filteredAbilities.length === 0 ? (
            <EmptyState icon={<Zap />} title="No abilities yet" message="Create a reusable virtual card for a class feature, feat, item, or homebrew power." action={<Button onClick={() => setEditor({ kind: 'ability' })}><Sparkles size={18} /> Create ability</Button>} />
          ) : (
            <div className="card-grid">
              {filteredAbilities.map((ability) => {
                const assigned = assignedAbilityIds.has(ability.id)
                return (
                  <AbilityCard
                    ability={ability}
                    key={ability.id}
                    secondaryAction={<div className="card-action-group"><Button variant="ghost" onClick={() => setEditor({ kind: 'ability', ability })}><Edit3 size={16} /> Edit</Button><Button variant="ghost" className="danger-text" onClick={() => { if (window.confirm(`Delete ${ability.name}?`)) void act(() => deleteAbility(ability.id), `${ability.name} deleted.`, false) }}><Trash2 size={16} /></Button></div>}
                    action={assigned ? <Button variant="secondary" disabled={!selectedCharacter || busy} onClick={() => selectedCharacter && void act(() => removeAbilityAssignment(selectedCharacter.id, ability.id), `${ability.name} removed from ${selectedCharacter.name}.`, false)}><X size={17} /> Remove</Button> : <Button disabled={!selectedCharacter} onClick={() => selectedCharacter && void act(() => assignAbility(selectedCharacter.id, ability.id), `${ability.name} assigned to ${selectedCharacter.name}.`, false)}><Check size={17} /> Assign</Button>}
                  />
                )
              })}
            </div>
          )}
        </section>
      )}

      {editor?.kind === 'campaign' && <Modal title={editor.campaign ? `Rename ${editor.campaign.name}` : 'Create a campaign'} description="Campaigns separate player rosters. Spells and abilities stay shared." onClose={() => setEditor(null)}><CampaignForm campaign={editor.campaign} busy={busy} onCancel={() => setEditor(null)} onSubmit={(name) => void saveCampaign(name)} /></Modal>}
      {editor?.kind === 'create-character' && <Modal title="Add a player" description="They will use the username and activation code for first-time setup." onClose={() => setEditor(null)} wide><CreateCharacterForm campaigns={campaigns} initialCampaignId={selectedCampaignId} busy={busy} onCancel={() => setEditor(null)} onSubmit={(input) => void act(() => createCharacter(input).then(() => undefined), `${input.characterName} created.`)} /></Modal>}
      {editor?.kind === 'edit-character' && <Modal title={`Edit ${editor.character.name}`} description="Automatic limits update when class or level changes unless you set an override." onClose={() => setEditor(null)} wide><CharacterEditor character={editor.character} campaigns={campaigns} busy={busy} onCancel={() => setEditor(null)} onSubmit={(changes) => void act(() => updateCharacter(editor.character.id, changes), `${changes.name} updated.`)} /></Modal>}
      {editor?.kind === 'activation' && <Modal title="Replace activation code" onClose={() => setEditor(null)}><ActivationCodeForm character={editor.character} busy={busy} onCancel={() => setEditor(null)} onSubmit={(code) => void act(() => rotateActivationCode(editor.character.id, code), 'Activation code replaced.')} /></Modal>}
      {editor?.kind === 'spell' && <Modal title={editor.duplicate ? `Duplicate ${editor.spell?.name}` : editor.spell ? `Edit ${editor.spell.name}` : 'Create a custom spell'} description={editor.duplicate ? 'This creates a separate homebrew copy; the SRD original remains unchanged.' : 'Fill in the fields and the app will generate the player card.'} onClose={() => setEditor(null)} wide><SpellEditor key={`${editor.spell?.id ?? 'new'}-${editor.duplicate ? 'copy' : 'edit'}`} spell={editor.spell} duplicate={editor.duplicate} busy={busy} onCancel={() => setEditor(null)} onSubmit={(input) => void saveSpell(input)} /></Modal>}
      {editor?.kind === 'ability' && <Modal title={editor.ability ? `Edit ${editor.ability.name}` : 'Create an ability card'} description="Use this for class features, feats, magic items, or any custom ability." onClose={() => setEditor(null)} wide><AbilityEditor key={editor.ability?.id ?? 'new'} ability={editor.ability} busy={busy} onCancel={() => setEditor(null)} onSubmit={(input) => void saveAbility(input)} /></Modal>}
      {editor?.kind === 'assign-spell' && selectedCharacter && <Modal title="Assign spell" onClose={() => setEditor(null)}><AssignmentForm spell={editor.spell} character={selectedCharacter} busy={busy} onCancel={() => setEditor(null)} onSubmit={(prepared, alwaysPrepared) => void act(() => assignSpell(selectedCharacter.id, editor.spell.id, { prepared, alwaysPrepared }), `${editor.spell.name} assigned to ${selectedCharacter.name}.`)} /></Modal>}
    </div>
  )
}
