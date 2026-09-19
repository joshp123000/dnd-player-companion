import { BookMarked, BookOpen, LockKeyhole, SearchX, WandSparkles, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AbilityCard } from '../components/AbilityCard'
import { SpellCard } from '../components/SpellCard'
import { SpellFilters } from '../components/SpellFilters'
import { Button, EmptyState, LoadingState, ProgressMeter, SegmentedControl } from '../components/ui'
import { listEligibleSpells, loadPlayerBundle, playerToggleSpell } from '../lib/api'
import { friendlyError } from '../lib/format'
import { filterSpells } from '../lib/filter'
import { classLabel, effectiveLimits, selectionLabel } from '../lib/rules'
import type { PlayerBundle, Profile, Spell, SpellFilters as FilterValues } from '../types'

type PlayerTab = 'cards' | 'spells' | 'abilities' | 'choices'

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
  const [busySpell, setBusySpell] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const nextBundle = await loadPlayerBundle(profile.id)
      const limits = effectiveLimits(nextBundle.character, nextBundle.progression)
      const spells = await listEligibleSpells(nextBundle.character, limits.maxSpellLevel)
      setBundle(nextBundle)
      setEligibleSpells(spells)
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      setLoading(false)
    }
  }, [profile.id, onError])

  useEffect(() => { void load() }, [load])

  const assignmentMap = useMemo(
    () => new Map(bundle?.spellAssignments.map((assignment) => [assignment.spell_id, assignment]) ?? []),
    [bundle],
  )

  if (loading) return <LoadingState label="Opening your character cards…" />
  if (!bundle) {
    return <EmptyState title="No character found" message="Ask your DM to attach a character to this account." />
  }

  const { character, spellAssignments, abilities } = bundle
  const limits = effectiveLimits(character, bundle.progression)
  const activeAssignments = spellAssignments.filter(
    (assignment) => assignment.always_prepared || assignment.is_prepared,
  )
  const activeCantrips = activeAssignments.filter((assignment) => assignment.spell?.level === 0)
  const activeLeveled = activeAssignments.filter((assignment) => (assignment.spell?.level ?? 0) > 0 && !assignment.always_prepared)
  const filteredActive = filterSpells(
    activeAssignments.map((assignment) => assignment.spell).filter((spell): spell is Spell => Boolean(spell)),
    filters,
  )

  let choices = eligibleSpells
  if (limits.selectionMode === 'spellbook') {
    const spellbookIds = new Set(spellAssignments.filter((row) => row.in_collection).map((row) => row.spell_id))
    choices = eligibleSpells.filter((spell) => spell.level === 0 || spellbookIds.has(spell.id))
  }
  const filteredChoices = filterSpells(choices, filters)

  const canEditSpell = (spell: Spell) => {
    if (spell.level === 0) return character.choices_unlocked
    if (limits.selectionMode === 'daily' || limits.selectionMode === 'spellbook') {
      return character.preparation_unlocked
    }
    return limits.selectionMode === 'level_choice' && character.choices_unlocked
  }

  const toggleSpell = async (spell: Spell, active: boolean) => {
    setBusySpell(spell.id)
    try {
      await playerToggleSpell(character.id, spell.id, active)
      await load()
      onSuccess(active ? `${spell.name} added.` : `${spell.name} removed.`)
    } catch (error) {
      onError(friendlyError(error))
    } finally {
      setBusySpell(null)
    }
  }

  return (
    <div className="player-dashboard">
      <section className="character-hero">
        <div>
          <span className="eyebrow">Player dashboard</span>
          <h1>{character.name}</h1>
          <p>Level {character.level} {character.subclass ? `${character.subclass} ` : ''}{classLabel(character.class_key)}</p>
        </div>
        <div className="character-hero__meters">
          {limits.cantrips > 0 && <ProgressMeter value={activeCantrips.length} max={limits.cantrips} label="Cantrips" />}
          {limits.preparedSpells > 0 && (
            <ProgressMeter value={activeLeveled.length} max={limits.preparedSpells} label={selectionLabel(limits.selectionMode)} />
          )}
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
          { value: 'abilities', label: 'Abilities' },
          { value: 'choices', label: limits.selectionMode === 'daily' || limits.selectionMode === 'spellbook' ? 'Prepare' : 'Choices' },
        ]}
      />

      {(tab === 'spells' || tab === 'choices') && (
        <SpellFilters value={filters} onChange={setFilters} hideClass />
      )}

      {tab === 'cards' && (
        <div className="dashboard-section">
          <div className="section-heading"><div><span className="eyebrow">At the table</span><h2>Your active cards</h2></div></div>
          {activeAssignments.length === 0 && abilities.length === 0 ? (
            <EmptyState icon={<BookOpen />} title="No cards yet" message="Your DM can assign abilities, or unlock spell choices for you." />
          ) : (
            <div className="card-grid">
              {activeAssignments.map((assignment) => assignment.spell && (
                <SpellCard
                  key={assignment.id}
                  spell={assignment.spell}
                  badge={assignment.always_prepared ? 'Always prepared' : assignment.spell.level === 0 ? 'Cantrip' : 'Ready'}
                />
              ))}
              {abilities.map((assignment) => assignment.ability && (
                <AbilityCard key={assignment.id} ability={assignment.ability} note={assignment.notes} />
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

      {tab === 'abilities' && (
        <div className="dashboard-section">
          <div className="section-heading"><div><span className="eyebrow">Feature cards</span><h2>Abilities & traits</h2></div></div>
          {abilities.length === 0 ? (
            <EmptyState icon={<Zap />} title="No abilities assigned" message="Your DM can add class features, feats, items, or homebrew abilities here." />
          ) : (
            <div className="card-grid">
              {abilities.map((assignment) => assignment.ability && (
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
              <h2>{limits.selectionMode === 'spellbook' ? 'Prepare from your spellbook' : limits.selectionMode === 'daily' ? 'Prepare spells' : 'Choose spells'}</h2>
            </div>
            <span className="result-count">Up to level {limits.maxSpellLevel}</span>
          </div>
          {!character.preparation_unlocked && !character.choices_unlocked && (
            <div className="locked-notice"><LockKeyhole size={20} /><div><strong>Choices are locked</strong><span>Your DM can unlock this section after a long rest or when you level up.</span></div></div>
          )}
          <div className="card-grid">
            {filteredChoices.map((spell) => {
              const assignment = assignmentMap.get(spell.id)
              const active = Boolean(assignment?.always_prepared || assignment?.is_prepared)
              const editable = canEditSpell(spell) && !assignment?.always_prepared
              return (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  badge={assignment?.always_prepared ? 'Always prepared' : active ? 'Selected' : undefined}
                  action={
                    <Button
                      variant={active ? 'secondary' : 'primary'}
                      disabled={!editable || busySpell === spell.id}
                      onClick={() => void toggleSpell(spell, !active)}
                    >
                      {active ? <BookMarked size={17} /> : <WandSparkles size={17} />}
                      {busySpell === spell.id ? 'Saving…' : active ? 'Remove' : 'Select'}
                    </Button>
                  }
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
