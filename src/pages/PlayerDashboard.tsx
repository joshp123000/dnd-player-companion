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
import { classLabel, effectiveLimits, selectionLabel } from '../lib/rules'
import { setsMatch, spellSelectionChanges, toggleSetValue } from '../lib/spellSelection'
import type { PlayerBundle, Profile, Spell, SpellFilters as FilterValues } from '../types'

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
  const [draftSelectedSpellIds, setDraftSelectedSpellIds] = useState<Set<string>>(new Set())

  const load = useCallback(async (showLoader = true, characterId?: string) => {
    if (showLoader) setLoading(true)
    try {
      const nextBundle = await loadPlayerBundle(profile.id, characterId)
      const limits = effectiveLimits(nextBundle.character, nextBundle.progression)
      const spells = await listEligibleSpells(nextBundle.character, limits.maxSpellLevel)
      setBundle(nextBundle)
      setEligibleSpells(spells)
      setDraftSelectedSpellIds(new Set(
        nextBundle.spellAssignments
          .filter((assignment) => assignment.always_prepared || assignment.is_prepared)
          .map((assignment) => assignment.spell_id),
      ))
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [profile.id, onError])

  useEffect(() => { void load() }, [load])

  const assignmentMap = useMemo(
    () => new Map(bundle?.spellAssignments.map((assignment) => [assignment.spell_id, assignment]) ?? []),
    [bundle],
  )
  const savedSelectedSpellIds = useMemo(
    () => new Set(
      bundle?.spellAssignments
        .filter((assignment) => assignment.always_prepared || assignment.is_prepared)
        .map((assignment) => assignment.spell_id) ?? [],
    ),
    [bundle],
  )

  if (loading) return <LoadingState label="Opening your character cards…" />
  if (!bundle) {
    return <EmptyState title="No character found" message="Ask your DM to attach a character to this account." />
  }

  const { character, spellAssignments, abilities } = bundle
  const magicItemAssignments = abilities.filter((assignment) => assignment.ability?.ability_kind === 'magic_item')
  const abilityAssignments = abilities.filter((assignment) => assignment.ability?.ability_kind !== 'magic_item')
  const limits = effectiveLimits(character, bundle.progression)
  const activeAssignments = spellAssignments.filter(
    (assignment) => assignment.always_prepared || assignment.is_prepared,
  )
  const filteredActive = filterSpells(
    activeAssignments.map((assignment) => assignment.spell).filter((spell): spell is Spell => Boolean(spell)),
    filters,
  )
  const filteredMagicItemAssignments = magicItemAssignments.filter(
    (assignment) => assignment.ability && matchesAbilitySearch(assignment.ability, filters.search, [assignment.notes]),
  )
  const filteredAbilityAssignments = abilityAssignments.filter(
    (assignment) => assignment.ability && matchesAbilitySearch(assignment.ability, filters.search, [assignment.notes]),
  )
  const searchActive = Boolean(filters.search.trim())
  const allCardCount = activeAssignments.length + abilityAssignments.length + magicItemAssignments.length
  const filteredAllCardCount = filteredActive.length + filteredAbilityAssignments.length + filteredMagicItemAssignments.length

  const usesPreparedSelection = limits.selectionMode === 'daily' || limits.selectionMode === 'spellbook'
  let choices = eligibleSpells.filter((spell) => spell.level > 0)
  if (limits.selectionMode === 'spellbook') {
    const spellbookIds = new Set(spellAssignments.filter((row) => row.in_collection).map((row) => row.spell_id))
    choices = choices.filter((spell) => spellbookIds.has(spell.id))
  }
  const filteredChoices = filterSpells(choices, filters)
  const alwaysPreparedIds = new Set(
    spellAssignments.filter((assignment) => assignment.always_prepared).map((assignment) => assignment.spell_id),
  )
  const spellById = new Map<string, Spell>()
  eligibleSpells.forEach((spell) => spellById.set(spell.id, spell))
  spellAssignments.forEach((assignment) => {
    if (assignment.spell) spellById.set(assignment.spell.id, assignment.spell)
  })
  const draftSpells = [...draftSelectedSpellIds]
    .map((spellId) => spellById.get(spellId))
    .filter((spell): spell is Spell => Boolean(spell))
  const draftCantripCount = draftSpells.filter(
    (spell) => spell.level === 0 && !alwaysPreparedIds.has(spell.id),
  ).length
  const draftLeveledCount = draftSpells.filter(
    (spell) => spell.level > 0 && !alwaysPreparedIds.has(spell.id),
  ).length
  const selectionChanges = spellSelectionChanges(savedSelectedSpellIds, draftSelectedSpellIds)
  const selectionChangeCount = selectionChanges.added.length + selectionChanges.removed.length
  const hasUnsavedSelection = !setsMatch(savedSelectedSpellIds, draftSelectedSpellIds)

  const canEditSpell = (spell: Spell) => {
    if (spell.level === 0) return false
    return usesPreparedSelection && character.preparation_unlocked
  }

  const saveSpellSelection = async () => {
    if (!hasUnsavedSelection) return
    setSavingSelection(true)
    try {
      for (const spellId of selectionChanges.removed) {
        await playerToggleSpell(character.id, spellId, false)
      }
      for (const spellId of selectionChanges.added) {
        await playerToggleSpell(character.id, spellId, true)
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
          <p>Level {character.level} {character.subclass ? `${character.subclass} ` : ''}{classLabel(character.class_key)}{activeCampaign ? ` · ${activeCampaign.name}` : ''}</p>
        </div>
        <div className="character-hero__side">
          {bundle.availableCharacters.length > 1 && (
            <label className="character-switcher">
              <span>Character &amp; campaign</span>
              <Select
                aria-label="Character and campaign"
                value={character.id}
                onChange={(event) => switchCharacter(event.target.value)}
              >
                {bundle.availableCharacters.map((option) => (
                  <option value={option.id} key={option.id}>
                    {option.name} — {campaignById.get(option.campaign_id)?.name ?? 'Campaign'}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <div className="character-hero__meters">
            {limits.cantrips > 0 && <ProgressMeter value={draftCantripCount} max={limits.cantrips} label="Cantrips" />}
            {limits.preparedSpells > 0 && (
              <ProgressMeter value={draftLeveledCount} max={limits.preparedSpells} label={selectionLabel(limits.selectionMode)} />
            )}
          </div>
        </div>
      </section>

      <SegmentedControl
        label="Character sections"
        value={tab}
        onChange={(value) => {
          setTab(value)
          setFilters(initialFilters)
        }}
        options={[
          { value: 'cards', label: 'All cards' },
          { value: 'spells', label: 'Spells' },
          { value: 'items', label: 'Magic items' },
          { value: 'abilities', label: 'Abilities' },
          ...(usesPreparedSelection ? [{ value: 'choices' as PlayerTab, label: 'Prepare' }] : []),
        ]}
      />

      {(tab === 'spells' || tab === 'choices') && (
        <SpellFilters value={filters} onChange={setFilters} hideClass />
      )}

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
              {filteredActive.map((spell) => {
                const assignment = assignmentMap.get(spell.id)
                return (
                  <SpellCard
                    key={spell.id}
                    spell={spell}
                    badge={assignment?.always_prepared ? 'Always prepared' : spell.level === 0 ? 'Cantrip' : 'Ready'}
                  />
                )
              })}
              {filteredAbilityAssignments.map((assignment) => assignment.ability && (
                <AbilityCard key={assignment.id} ability={assignment.ability} note={assignment.notes} />
              ))}
              {filteredMagicItemAssignments.map((assignment) => assignment.ability && (
                <MagicItemCard key={assignment.id} item={assignment.ability} note={assignment.notes} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'spells' && (
        <div className="dashboard-section">
          <div className="section-heading">
            <div><span className="eyebrow">Spell cards</span><h2>{limits.selectionMode === 'spellbook' ? 'Prepared & spellbook' : 'Your spells'}</h2></div>
            <span className="result-count">{filteredActive.length} shown</span>
          </div>
          {filteredActive.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching spells" message="Try a different search or choose spells from the preparation tab." />
          ) : (
            <div className="card-grid">
              {filteredActive.map((spell) => {
                const assignment = assignmentMap.get(spell.id)
                return <SpellCard key={spell.id} spell={spell} badge={assignment?.always_prepared ? 'Always prepared' : 'Ready'} />
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'items' && (
        <div className="dashboard-section">
          <div className="section-heading">
            <div><span className="eyebrow">Carried treasures</span><h2>Magic items</h2></div>
            <span className="result-count">{searchActive ? `${filteredMagicItemAssignments.length} of ${magicItemAssignments.length}` : `${magicItemAssignments.length} assigned`}</span>
          </div>
          {magicItemAssignments.length === 0 ? (
            <EmptyState icon={<Gem />} title="No magic items assigned" message="Your DM can add magic-item cards to your character." />
          ) : filteredMagicItemAssignments.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching magic items" message="Try another name, rarity, type, tag, or word from the item’s description." />
          ) : (
            <div className="card-grid">
              {filteredMagicItemAssignments.map((assignment) => assignment.ability && (
                <MagicItemCard key={assignment.id} item={assignment.ability} note={assignment.notes} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'abilities' && (
        <div className="dashboard-section">
          <div className="section-heading"><div><span className="eyebrow">Feature cards</span><h2>Abilities & traits</h2></div><span className="result-count">{searchActive ? `${filteredAbilityAssignments.length} of ${abilityAssignments.length}` : `${abilityAssignments.length} abilities`}</span></div>
          {abilityAssignments.length === 0 ? (
            <EmptyState icon={<Zap />} title="No abilities assigned" message="Your DM can add class features, feats, or homebrew abilities here." />
          ) : filteredAbilityAssignments.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching abilities" message="Try another name, category, tag, or word from the ability’s description." />
          ) : (
            <div className="card-grid">
              {filteredAbilityAssignments.map((assignment) => assignment.ability && (
                <AbilityCard key={assignment.id} ability={assignment.ability} note={assignment.notes} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'choices' && (
        <div className="dashboard-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{classLabel(character.class_key)} level {character.level}</span>
              <h2>{limits.selectionMode === 'spellbook' ? 'Prepare from your spellbook' : 'Prepare spells'}</h2>
            </div>
            <span className="result-count">Up to level {limits.maxSpellLevel}</span>
          </div>
          {!character.preparation_unlocked && (
            <div className="locked-notice"><LockKeyhole size={20} /><div><strong>Prepared spell changes are locked</strong><span>Your DM must open preparation after a Long Rest before you can make changes.</span></div></div>
          )}
          <div className={`selection-save-bar ${hasUnsavedSelection ? 'selection-save-bar--dirty' : ''}`}>
            <div>
              <strong>{hasUnsavedSelection ? `${selectionChangeCount} unsaved ${selectionChangeCount === 1 ? 'change' : 'changes'}` : 'Spell choices saved'}</strong>
              <span>Select everything you want, then save once.</span>
            </div>
            <div className="selection-save-bar__actions">
              <Button type="button" variant="ghost" disabled={!hasUnsavedSelection || savingSelection} onClick={() => setDraftSelectedSpellIds(new Set(savedSelectedSpellIds))}><RotateCcw size={16} /> Undo</Button>
              <Button type="button" disabled={!hasUnsavedSelection || savingSelection} onClick={() => void saveSpellSelection()}><Save size={16} /> {savingSelection ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </div>
          {filteredChoices.length === 0 ? (
            <EmptyState icon={<SearchX />} title="No matching spells" message="Try a different spell name, level, school, or search term." />
          ) : <div className="card-grid">
            {filteredChoices.map((spell) => {
              const assignment = assignmentMap.get(spell.id)
              const active = Boolean(assignment?.always_prepared || draftSelectedSpellIds.has(spell.id))
              const editable = canEditSpell(spell) && !assignment?.always_prepared
              const limitReached = spell.level === 0
                ? draftCantripCount >= limits.cantrips
                : draftLeveledCount >= limits.preparedSpells
              return (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  badge={assignment?.always_prepared ? 'Always prepared' : active ? 'Selected' : undefined}
                  action={
                    <Button
                      variant={active ? 'secondary' : 'primary'}
                      disabled={!editable || savingSelection || (!active && limitReached)}
                      title={!active && limitReached ? 'Remove another spell of this type before selecting this one.' : undefined}
                      onClick={() => setDraftSelectedSpellIds((current) => toggleSetValue(current, spell.id))}
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
