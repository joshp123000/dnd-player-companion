import { BookMarked, BookOpen, Gem, LockKeyhole, RotateCcw, Save, Search, SearchX, WandSparkles, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AbilityCard } from '../components/AbilityCard'
import { MagicItemCard } from '../components/MagicItemCard'
import { SpellCard } from '../components/SpellCard'
import { SpellFilters } from '../components/SpellFilters'
import { Button, EmptyState, Input, LoadingState, ProgressMeter, SegmentedControl, Select } from '../components/ui'
import { listEligibleSpells, loadPlayerBundle, playerToggleSpell } from '../lib/api'
import { matchesAbilitySearch } from '../lib/cardSearch'
import { friendlyError } from '../lib/format'
import { filterSpells } from '../lib/filter'
import {
  characterBuildLabel,
  classAssignmentKey,
  effectiveClassLimits,
  parseClassAssignmentKey,
  sharedSpellSlots,
} from '../lib/multiclass'
import { classLabel, selectionLabel } from '../lib/rules'
import { setsMatch, spellSelectionChanges, toggleSetValue } from '../lib/spellSelection'
import type { CharacterSpell, PlayerBundle, Profile, Spell, SpellFilters as FilterValues } from '../types'

type PlayerTab = 'cards' | 'spells' | 'items' | 'abilities' | 'choices'

const initialFilters: FilterValues = { search: '', level: 'all', classKey: 'all', school: 'all' }

export function PlayerDashboard({
  profile,
  onError,
  onSuccess,
}: {
  profile: Profile
  onError: (message: string) => void
  onSuccess: (message: string) => void
}) {
  const [bundle, setBundle] = useState<PlayerBundle | null>(null)
  const [eligibleSpells, setEligibleSpells] = useState<Spell[]>([])
  const [tab, setTab] = useState<PlayerTab>('cards')
  const [filters, setFilters] = useState<FilterValues>(initialFilters)
  const [loading, setLoading] = useState(true)
  const [savingSelection, setSavingSelection] = useState(false)
  const [draftSelectedSpellKeys, setDraftSelectedSpellKeys] = useState<Set<string>>(new Set())
  const [prepClassKey, setPrepClassKey] = useState('')

  const load = useCallback(async (showLoader = true, characterId?: string) => {
    if (showLoader) setLoading(true)
    try {
      const nextBundle = await loadPlayerBundle(profile.id, characterId)
      const spells = await listEligibleSpells(nextBundle.classLevels, nextBundle.progressions)
      const classKeys = new Set(nextBundle.classLevels.map((entry) => entry.class_key))
      const preparableClassKeys = nextBundle.classLevels
        .filter((entry) => {
          const progression = nextBundle.progressions.find((row) => row.class_key === entry.class_key && row.level === entry.class_level)
          return progression?.selection_mode === 'daily' || progression?.selection_mode === 'spellbook'
        })
        .map((entry) => entry.class_key)
      setBundle(nextBundle)
      setEligibleSpells(spells)
      setDraftSelectedSpellKeys(new Set(
        nextBundle.spellAssignments
          .filter((assignment) => assignment.is_prepared && !assignment.always_prepared && classKeys.has(assignment.source_class_key))
          .map((assignment) => classAssignmentKey(assignment.source_class_key, assignment.spell_id)),
      ))
      setPrepClassKey((current) => preparableClassKeys.includes(current) ? current : preparableClassKeys[0] ?? '')
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [profile.id, onError])

  useEffect(() => { void load() }, [load])

  const savedSelectedSpellKeys = useMemo(
    () => new Set(
      bundle?.spellAssignments
        .filter((assignment) => assignment.is_prepared && !assignment.always_prepared && assignment.source_class_key !== 'dm')
        .map((assignment) => classAssignmentKey(assignment.source_class_key, assignment.spell_id)) ?? [],
    ),
    [bundle],
  )

  if (loading) return <LoadingState label="Opening your character cards…" />
  if (!bundle) {
    return <EmptyState title="No character found" message="Ask your DM to attach a character to this account." />
  }

  const { character, spellAssignments, abilities, classLevels, progressions } = bundle
  const classProfiles = classLevels.map((classLevel) => {
    const progression = progressions.find((row) => row.class_key === classLevel.class_key && row.level === classLevel.class_level) ?? null
    return { classLevel, progression, limits: effectiveClassLimits(classLevel, progression) }
  })
  const preparableProfiles = classProfiles.filter(({ limits }) => limits.selectionMode === 'daily' || limits.selectionMode === 'spellbook')
  const selectedProfile = preparableProfiles.find(({ classLevel }) => classLevel.class_key === prepClassKey) ?? preparableProfiles[0] ?? null
  const slotSummary = sharedSpellSlots(classLevels)
  const magicItemAssignments = abilities.filter((assignment) => assignment.ability?.ability_kind === 'magic_item')
  const abilityAssignments = abilities.filter((assignment) => assignment.ability?.ability_kind !== 'magic_item')

  const assignmentsBySpell = new Map<string, CharacterSpell[]>()
  for (const assignment of spellAssignments) {
    const rows = assignmentsBySpell.get(assignment.spell_id) ?? []
    rows.push(assignment)
    assignmentsBySpell.set(assignment.spell_id, rows)
  }
  const assignmentByClassSpell = new Map(
    spellAssignments.map((assignment) => [classAssignmentKey(assignment.source_class_key, assignment.spell_id), assignment]),
  )
  const activeSpellRows = [...assignmentsBySpell.values()]
    .map((assignments) => ({
      spell: assignments.find((assignment) => assignment.spell)?.spell,
      assignments: assignments.filter((assignment) => assignment.always_prepared || assignment.is_prepared),
    }))
    .filter((row): row is { spell: Spell; assignments: CharacterSpell[] } => Boolean(row.spell && row.assignments.length > 0))
  const filteredActive = filterSpells(activeSpellRows.map((row) => row.spell), filters)
  const activeRowsBySpell = new Map(activeSpellRows.map((row) => [row.spell.id, row.assignments]))

  const filteredMagicItemAssignments = magicItemAssignments.filter(
    (assignment) => assignment.ability && matchesAbilitySearch(assignment.ability, filters.search, [assignment.notes]),
  )
  const filteredAbilityAssignments = abilityAssignments.filter(
    (assignment) => assignment.ability && matchesAbilitySearch(assignment.ability, filters.search, [assignment.notes]),
  )
  const searchActive = Boolean(filters.search.trim())
  const allCardCount = activeSpellRows.length + abilityAssignments.length + magicItemAssignments.length
  const filteredAllCardCount = filteredActive.length + filteredAbilityAssignments.length + filteredMagicItemAssignments.length

  const spellById = new Map<string, Spell>()
  eligibleSpells.forEach((spell) => spellById.set(spell.id, spell))
  spellAssignments.forEach((assignment) => { if (assignment.spell) spellById.set(assignment.spell.id, assignment.spell) })
  const selectedClassKey = selectedProfile?.classLevel.class_key ?? ''
  const selectedLimits = selectedProfile?.limits
  const selectedAssignments = spellAssignments.filter((assignment) => assignment.source_class_key === selectedClassKey)
  const selectedAssignmentIds = new Set(selectedAssignments.filter((assignment) => assignment.in_collection).map((assignment) => assignment.spell_id))
  let choices = [...spellById.values()].filter((spell) => (
    Boolean(selectedProfile)
    && spell.level > 0
    && spell.level <= (selectedLimits?.maxSpellLevel ?? 0)
    && (
      spell.classes.includes(selectedClassKey)
      || (spell.source_type === 'custom' && selectedAssignmentIds.has(spell.id))
    )
  ))
  if (selectedLimits?.selectionMode === 'spellbook') {
    choices = choices.filter((spell) => selectedAssignmentIds.has(spell.id))
  }
  choices.sort((left, right) => left.level - right.level || left.name.localeCompare(right.name))
  const filteredChoices = filterSpells(choices, filters)
  const selectedDraftCount = [...draftSelectedSpellKeys].filter((key) => parseClassAssignmentKey(key).classKey === selectedClassKey).length
  const selectionChanges = spellSelectionChanges(savedSelectedSpellKeys, draftSelectedSpellKeys)
  const selectionChangeCount = selectionChanges.added.length + selectionChanges.removed.length
  const hasUnsavedSelection = !setsMatch(savedSelectedSpellKeys, draftSelectedSpellKeys)

  const activeSpellBadge = (spellId: string) => {
    const assignments = activeRowsBySpell.get(spellId) ?? []
    if (assignments.some((assignment) => assignment.always_prepared)) return 'Always prepared'
    const sources = [...new Set(assignments.map((assignment) => (
      assignment.source_class_key === 'dm' ? 'DM granted' : classLabel(assignment.source_class_key)
    )))]
    return sources.length > 0 ? sources.join(' / ') : 'Ready'
  }

  const saveSpellSelection = async () => {
    if (!hasUnsavedSelection) return
    setSavingSelection(true)
    try {
      for (const key of selectionChanges.removed) {
        const { classKey, spellId } = parseClassAssignmentKey(key)
        await playerToggleSpell(character.id, spellId, classKey, false)
      }
      for (const key of selectionChanges.added) {
        const { classKey, spellId } = parseClassAssignmentKey(key)
        await playerToggleSpell(character.id, spellId, classKey, true)
      }
      await load(false, character.id)
      onSuccess(`${selectionChangeCount} spell ${selectionChangeCount === 1 ? 'change' : 'changes'} saved.`)
    } catch (error) {
      await load(false, character.id)
      onError(`The full selection could not be saved. ${friendlyError(error)}`)
    } finally {
      setSavingSelection(false)
    }
  }

  const campaignById = new Map(bundle.campaigns.map((campaign) => [campaign.id, campaign]))
  const activeCampaign = campaignById.get(character.campaign_id)
  const switchCharacter = (characterId: string) => {
    if (characterId === character.id) return
    if (hasUnsavedSelection && !window.confirm('Switch characters and discard the unsaved spell changes?')) return
    setTab('cards')
    setFilters(initialFilters)
    void load(true, characterId)
  }

  return (
    <div className="player-dashboard">
      <section className="character-hero">
        <div>
          <span className="eyebrow">Player dashboard</span>
          <h1>{character.name}</h1>
          <p>Level {character.level} · {characterBuildLabel(classLevels)}{activeCampaign ? ` · ${activeCampaign.name}` : ''}</p>
          {classLevels.length > 1 && (
            <p className="multiclass-slot-summary">
              {slotSummary.slots.length > 0 && <>Shared slots: {slotSummary.slots.map((count, index) => `${index + 1}:${count}`).join(' · ')}</>}
              {slotSummary.pactMagic && <>{slotSummary.slots.length > 0 ? ' · ' : ''}Pact Magic: {slotSummary.pactMagic.slots} level-{slotSummary.pactMagic.slotLevel}</>}
            </p>
          )}
        </div>
        <div className="character-hero__side">
          {bundle.availableCharacters.length > 1 && (
            <label className="character-switcher">
              <span>Character &amp; campaign</span>
              <Select aria-label="Character and campaign" value={character.id} onChange={(event) => switchCharacter(event.target.value)}>
                {bundle.availableCharacters.map((option) => (
                  <option value={option.id} key={option.id}>{option.name} — {campaignById.get(option.campaign_id)?.name ?? 'Campaign'}</option>
                ))}
              </Select>
            </label>
          )}
          <div className="character-hero__meters">
            {preparableProfiles.map(({ classLevel, limits }) => {
              const count = [...draftSelectedSpellKeys].filter((key) => parseClassAssignmentKey(key).classKey === classLevel.class_key).length
              return limits.preparedSpells > 0 && <ProgressMeter key={classLevel.class_key} value={count} max={limits.preparedSpells} label={`${classLabel(classLevel.class_key)} ${selectionLabel(limits.selectionMode)}`} />
            })}
          </div>
        </div>
      </section>

      <SegmentedControl
        label="Character sections"
        value={tab}
        onChange={(value) => { setTab(value); setFilters(initialFilters) }}
        options={[
          { value: 'cards', label: 'All cards' },
          { value: 'spells', label: 'Spells' },
          { value: 'items', label: 'Magic items' },
          { value: 'abilities', label: 'Abilities' },
          ...(preparableProfiles.length > 0 ? [{ value: 'choices' as PlayerTab, label: 'Prepare' }] : []),
        ]}
      />

      {(tab === 'spells' || tab === 'choices') && <SpellFilters value={filters} onChange={setFilters} hideClass />}

      {(tab === 'cards' || tab === 'items' || tab === 'abilities') && (
        <label className="search-input standalone-search">
          <Search size={18} />
          <Input
            aria-label={tab === 'cards' ? 'Search all cards' : tab === 'items' ? 'Search magic items' : 'Search abilities'}
            placeholder={tab === 'cards' ? 'Search all your cards…' : tab === 'items' ? 'Search your magic items…' : 'Search your abilities…'}
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
        </label>
      )}

      {tab === 'cards' && (
        <div className="dashboard-section">
          <div className="section-heading"><div><span className="eyebrow">At the table</span><h2>Your active cards</h2></div><span className="result-count">{searchActive ? `${filteredAllCardCount} of ${allCardCount}` : `${allCardCount} cards`}</span></div>
          {allCardCount === 0 ? (
            <EmptyState icon={<BookOpen />} title="No cards yet" message="Your DM can assign your spells, magic items, and abilities here." />
          ) : filteredAllCardCount === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching cards" message="Try another name, category, tag, or word from a card’s description." />
          ) : (
            <div className="card-grid">
              {filteredActive.map((spell) => <SpellCard key={spell.id} spell={spell} badge={activeSpellBadge(spell.id)} />)}
              {filteredAbilityAssignments.map((assignment) => assignment.ability && <AbilityCard key={assignment.id} ability={assignment.ability} note={assignment.notes} />)}
              {filteredMagicItemAssignments.map((assignment) => assignment.ability && <MagicItemCard key={assignment.id} item={assignment.ability} note={assignment.notes} />)}
            </div>
          )}
        </div>
      )}

      {tab === 'spells' && (
        <div className="dashboard-section">
          <div className="section-heading"><div><span className="eyebrow">Spell cards</span><h2>Your active spells</h2></div><span className="result-count">{filteredActive.length} shown</span></div>
          {filteredActive.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching spells" message="Try a different search or choose spells from the preparation tab." />
          ) : <div className="card-grid">{filteredActive.map((spell) => <SpellCard key={spell.id} spell={spell} badge={activeSpellBadge(spell.id)} />)}</div>}
        </div>
      )}

      {tab === 'items' && (
        <div className="dashboard-section">
          <div className="section-heading"><div><span className="eyebrow">Carried treasures</span><h2>Magic items</h2></div><span className="result-count">{searchActive ? `${filteredMagicItemAssignments.length} of ${magicItemAssignments.length}` : `${magicItemAssignments.length} assigned`}</span></div>
          {magicItemAssignments.length === 0 ? (
            <EmptyState icon={<Gem />} title="No magic items assigned" message="Your DM can add magic-item cards to your character." />
          ) : filteredMagicItemAssignments.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching magic items" message="Try another name, rarity, type, tag, or word from the item’s description." />
          ) : <div className="card-grid">{filteredMagicItemAssignments.map((assignment) => assignment.ability && <MagicItemCard key={assignment.id} item={assignment.ability} note={assignment.notes} />)}</div>}
        </div>
      )}

      {tab === 'abilities' && (
        <div className="dashboard-section">
          <div className="section-heading"><div><span className="eyebrow">Feature cards</span><h2>Abilities &amp; traits</h2></div><span className="result-count">{searchActive ? `${filteredAbilityAssignments.length} of ${abilityAssignments.length}` : `${abilityAssignments.length} abilities`}</span></div>
          {abilityAssignments.length === 0 ? (
            <EmptyState icon={<Zap />} title="No abilities assigned" message="Your DM can add class features, feats, or homebrew abilities here." />
          ) : filteredAbilityAssignments.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching abilities" message="Try another name, category, tag, or word from the ability’s description." />
          ) : <div className="card-grid">{filteredAbilityAssignments.map((assignment) => assignment.ability && <AbilityCard key={assignment.id} ability={assignment.ability} note={assignment.notes} />)}</div>}
        </div>
      )}

      {tab === 'choices' && selectedProfile && (
        <div className="dashboard-section">
          <div className="section-heading">
            <div><span className="eyebrow">{classLabel(selectedClassKey)} level {selectedProfile.classLevel.class_level}</span><h2>{selectedLimits?.selectionMode === 'spellbook' ? 'Prepare from your spellbook' : 'Prepare spells'}</h2></div>
            <span className="result-count">Up to level {selectedLimits?.maxSpellLevel}</span>
          </div>
          {preparableProfiles.length > 1 && (
            <label className="prep-class-selector"><span>Prepare spells for</span><Select aria-label="Preparation class" value={selectedClassKey} onChange={(event) => { setPrepClassKey(event.target.value); setFilters(initialFilters) }}>{preparableProfiles.map(({ classLevel }) => <option key={classLevel.class_key} value={classLevel.class_key}>{classLabel(classLevel.class_key)} level {classLevel.class_level}</option>)}</Select></label>
          )}
          <div className="multiclass-rule-note"><strong>Separate class preparation</strong><span>This list and its limit use only your {classLabel(selectedClassKey)} level. Your shared spell slots can still cast or upcast any spell you have prepared.</span></div>
          {!character.preparation_unlocked && <div className="locked-notice"><LockKeyhole size={20} /><div><strong>Prepared spell changes are locked</strong><span>Your DM must open preparation after a Long Rest before you can make changes.</span></div></div>}
          <div className={`selection-save-bar ${hasUnsavedSelection ? 'selection-save-bar--dirty' : ''}`}>
            <div><strong>{hasUnsavedSelection ? `${selectionChangeCount} unsaved ${selectionChangeCount === 1 ? 'change' : 'changes'}` : 'Spell choices saved'}</strong><span>{classLabel(selectedClassKey)}: {selectedDraftCount} of {selectedLimits?.preparedSpells ?? 0} selected. Make changes for either class, then save once.</span></div>
            <div className="selection-save-bar__actions">
              <Button type="button" variant="ghost" disabled={!hasUnsavedSelection || savingSelection} onClick={() => setDraftSelectedSpellKeys(new Set(savedSelectedSpellKeys))}><RotateCcw size={16} /> Undo</Button>
              <Button type="button" disabled={!hasUnsavedSelection || savingSelection} onClick={() => void saveSpellSelection()}><Save size={16} /> {savingSelection ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </div>
          {filteredChoices.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching spells" message={selectedLimits?.selectionMode === 'spellbook' ? 'Ask your DM to add spells to this Wizard spellbook, or change the filters.' : 'Try a different spell name, level, school, or search term.'} />
          ) : <div className="card-grid">
            {filteredChoices.map((spell) => {
              const key = classAssignmentKey(selectedClassKey, spell.id)
              const assignment = assignmentByClassSpell.get(key)
              const active = Boolean(assignment?.always_prepared || draftSelectedSpellKeys.has(key))
              const editable = character.preparation_unlocked && !assignment?.always_prepared
              const limitReached = selectedDraftCount >= (selectedLimits?.preparedSpells ?? 0)
              return (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  badge={assignment?.always_prepared ? `Always prepared · ${classLabel(selectedClassKey)}` : active ? `Selected · ${classLabel(selectedClassKey)}` : classLabel(selectedClassKey)}
                  action={
                    <Button
                      variant={active ? 'secondary' : 'primary'}
                      disabled={!editable || savingSelection || (!active && limitReached)}
                      title={!active && limitReached ? `Remove another ${classLabel(selectedClassKey)} spell before selecting this one.` : undefined}
                      onClick={() => setDraftSelectedSpellKeys((current) => toggleSetValue(current, key))}
                    >
                      {active ? <BookMarked size={17} /> : <WandSparkles size={17} />}
                      {active ? 'Remove' : 'Select'}
                    </Button>
                  }
                />
              )
            })}
          </div>}
        </div>
      )}
    </div>
  )
}
