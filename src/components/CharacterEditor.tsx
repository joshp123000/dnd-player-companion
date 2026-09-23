import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { characterBuildLabel, sharedSpellSlots, totalCharacterLevel, validateCharacterClasses } from '../lib/multiclass'
import { CHARACTER_CLASSES, classLabel, defaultProgression } from '../lib/rules'
import type { Campaign, Character, CharacterClassInput } from '../types'
import { Button, Field, Input, Select } from './ui'

const initialClasses = (character: Character): CharacterClassInput[] => {
  if (character.class_levels?.length) {
    return character.class_levels.map((entry) => ({
      class_key: entry.class_key,
      class_level: entry.class_level,
      subclass: entry.subclass,
      is_primary: entry.is_primary,
      max_cantrips_override: entry.max_cantrips_override,
      max_prepared_override: entry.max_prepared_override,
      max_spell_level_override: entry.max_spell_level_override,
    }))
  }
  return [{
    class_key: character.class_key,
    class_level: character.level,
    subclass: character.subclass,
    is_primary: true,
    max_cantrips_override: character.max_cantrips_override,
    max_prepared_override: character.max_prepared_override,
    max_spell_level_override: character.max_spell_level_override,
  }]
}

const emptyClass = (used: Set<string>): CharacterClassInput => ({
  class_key: CHARACTER_CLASSES.find((classKey) => !used.has(classKey)) ?? 'fighter',
  class_level: 1,
  subclass: null,
  is_primary: false,
  max_cantrips_override: null,
  max_prepared_override: null,
  max_spell_level_override: null,
})

export function CharacterEditor({
  character,
  campaigns,
  busy,
  onSubmit,
  onCancel,
}: {
  character: Character
  campaigns: Campaign[]
  busy?: boolean
  onSubmit: (changes: Pick<Character, 'campaign_id' | 'name' | 'notes' | 'preparation_unlocked'>, classes: CharacterClassInput[]) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    campaign_id: character.campaign_id,
    name: character.name,
    notes: character.notes,
    preparation_unlocked: character.preparation_unlocked,
  })
  const [classes, setClasses] = useState<CharacterClassInput[]>(() => initialClasses(character))
  const [validationError, setValidationError] = useState<string | null>(null)
  const totalLevel = totalCharacterLevel(classes)
  const slotSummary = useMemo(() => sharedSpellSlots(classes), [classes])
  const numberOrNull = (value: string) => value === '' ? null : Number(value)

  const updateClass = (index: number, changes: Partial<CharacterClassInput>) => {
    setClasses((current) => current.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...changes } : entry
    )))
    setValidationError(null)
  }

  const makePrimary = (index: number) => {
    setClasses((current) => current.map((entry, entryIndex) => ({
      ...entry,
      is_primary: entryIndex === index,
    })))
  }

  const removeClass = (index: number) => {
    setClasses((current) => {
      if (current.length === 1) return current
      const removedPrimary = current[index].is_primary
      const next = current.filter((_, entryIndex) => entryIndex !== index)
      if (removedPrimary) next[0] = { ...next[0], is_primary: true }
      return next
    })
    setValidationError(null)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const classError = validateCharacterClasses(classes)
    if (classError) {
      setValidationError(classError)
      return
    }
    onSubmit({
      campaign_id: form.campaign_id,
      name: form.name.trim(),
      notes: form.notes?.trim() || null,
      preparation_unlocked: form.preparation_unlocked,
    }, classes.map((entry) => ({ ...entry, subclass: entry.subclass?.trim() || null })))
  }

  return (
    <form className="editor-form" onSubmit={submit}>
      <div className="form-grid form-grid--3">
        <Field label="Character name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
        <Field label="Login username" hint="Use Reset login on the player card to change this safely."><Input value={character.login_username} disabled /></Field>
        <Field label="Campaign">
          <Select value={form.campaign_id} onChange={(event) => setForm({ ...form, campaign_id: event.target.value })} required>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </Select>
        </Field>
      </div>

      <fieldset className="choice-fieldset class-builder">
        <legend>Classes &amp; levels</legend>
        <div className="class-builder__summary">
          <div><strong>Level {totalLevel}</strong><span>{characterBuildLabel(classes)}</span></div>
          <div className="class-builder__slot-summary">
            {slotSummary.slots.length > 0 && <span>Shared slots: {slotSummary.slots.map((count, index) => `${index + 1}:${count}`).join(' · ')}</span>}
            {slotSummary.pactMagic && <span>Pact Magic: {slotSummary.pactMagic.slots} level-{slotSummary.pactMagic.slotLevel} slots</span>}
          </div>
        </div>
        <p className="fieldset-copy">Each class uses its own level for features, spell access, cantrips, and prepared-spell limits. The primary class controls the short label shown around the DM screen.</p>

        <div className="class-builder__rows">
          {classes.map((entry, index) => {
            const defaults = defaultProgression(entry.class_key, entry.class_level)
            return (
              <section className="class-builder__row" key={`${index}-${entry.class_key}`}>
                <div className="class-builder__row-heading">
                  <label className="primary-class-choice">
                    <input type="radio" name="primary-class" checked={entry.is_primary} onChange={() => makePrimary(index)} />
                    <span>{entry.is_primary ? 'Primary class' : 'Make primary'}</span>
                  </label>
                  <Button type="button" variant="ghost" className="danger-text" disabled={classes.length === 1} onClick={() => removeClass(index)}><Trash2 size={16} /> Remove</Button>
                </div>
                <div className="form-grid form-grid--3">
                  <Field label="Class">
                    <Select value={entry.class_key} onChange={(event) => updateClass(index, { class_key: event.target.value })}>
                      {CHARACTER_CLASSES.map((classKey) => <option key={classKey} value={classKey}>{classLabel(classKey)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Subclass"><Input value={entry.subclass ?? ''} onChange={(event) => updateClass(index, { subclass: event.target.value || null })} /></Field>
                  <Field label="Class level"><Input type="number" min={1} max={20} value={entry.class_level} onChange={(event) => updateClass(index, { class_level: Number(event.target.value) })} required /></Field>
                </div>
                {defaults && (
                  <details className="class-builder__overrides">
                    <summary>Optional {classLabel(entry.class_key)} spell-limit overrides</summary>
                    <p className="fieldset-copy">Leave blank to use the automatic value for this class level.</p>
                    <div className="form-grid form-grid--3">
                      <Field label="Cantrip limit" hint={`Automatic: ${defaults.cantrips}`}><Input type="number" min={0} max={50} value={entry.max_cantrips_override ?? ''} onChange={(event) => updateClass(index, { max_cantrips_override: numberOrNull(event.target.value) })} /></Field>
                      <Field label="Prepared/chosen limit" hint={`Automatic: ${defaults.prepared_spells}`}><Input type="number" min={0} max={100} value={entry.max_prepared_override ?? ''} onChange={(event) => updateClass(index, { max_prepared_override: numberOrNull(event.target.value) })} /></Field>
                      <Field label="Maximum spell level" hint={`Automatic: ${defaults.max_spell_level}`}><Input type="number" min={0} max={9} value={entry.max_spell_level_override ?? ''} onChange={(event) => updateClass(index, { max_spell_level_override: numberOrNull(event.target.value) })} /></Field>
                    </div>
                  </details>
                )}
              </section>
            )
          })}
        </div>
        <Button type="button" variant="secondary" disabled={classes.length >= CHARACTER_CLASSES.length || totalLevel >= 20} onClick={() => setClasses((current) => [...current, emptyClass(new Set(current.map((entry) => entry.class_key)))])}><Plus size={17} /> Add another class</Button>
        {validationError && <div className="form-message form-message--error">{validationError}</div>}
      </fieldset>

      <div className="unlock-panel">
        <label className="switch-row">
          <span><strong>Preparation unlocked</strong><small>Lets every daily-preparation class and Wizard on this character update prepared spells.</small></span>
          <input type="checkbox" checked={form.preparation_unlocked} onChange={(event) => setForm({ ...form, preparation_unlocked: event.target.checked })} />
        </label>
      </div>

      <Field label="DM notes"><textarea className="textarea" value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value || null })} /></Field>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save character'}</Button>
      </div>
    </form>
  )
}
