import { useMemo, useState, type FormEvent } from 'react'
import type { Campaign, Character } from '../types'
import { CHARACTER_CLASSES, classLabel, defaultProgression } from '../lib/rules'
import { Button, Field, Input, Select } from './ui'

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
  onSubmit: (changes: Partial<Character>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ ...character })
  const defaults = useMemo(() => defaultProgression(form.class_key, form.level), [form.class_key, form.level])
  const numberOrNull = (value: string) => value === '' ? null : Number(value)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      campaign_id: form.campaign_id,
      name: form.name.trim(),
      class_key: form.class_key,
      subclass: form.subclass?.trim() || null,
      level: form.level,
      notes: form.notes?.trim() || null,
      preparation_unlocked: form.preparation_unlocked,
      choices_unlocked: form.choices_unlocked,
      max_cantrips_override: form.max_cantrips_override,
      max_prepared_override: form.max_prepared_override,
      max_spell_level_override: form.max_spell_level_override,
    })
  }

  return (
    <form className="editor-form" onSubmit={submit}>
      <div className="form-grid form-grid--3">
        <Field label="Character name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
        <Field label="Login username" hint="The login name cannot be changed after creation."><Input value={form.login_username} disabled /></Field>
        <Field label="Campaign">
          <Select value={form.campaign_id} onChange={(event) => setForm({ ...form, campaign_id: event.target.value })} required>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="form-grid form-grid--3">
        <Field label="Class">
          <Select value={form.class_key} onChange={(event) => setForm({ ...form, class_key: event.target.value })}>
            {CHARACTER_CLASSES.map((classKey) => <option key={classKey} value={classKey}>{classLabel(classKey)}</option>)}
          </Select>
        </Field>
        <Field label="Subclass"><Input value={form.subclass ?? ''} onChange={(event) => setForm({ ...form, subclass: event.target.value || null })} /></Field>
        <Field label="Level"><Input type="number" min={1} max={20} value={form.level} onChange={(event) => setForm({ ...form, level: Number(event.target.value) })} required /></Field>
      </div>

      <div className="unlock-panel">
        <label className="switch-row">
          <span><strong>Preparation unlocked</strong><small>Lets daily casters and Wizards change prepared spells.</small></span>
          <input type="checkbox" checked={form.preparation_unlocked} onChange={(event) => setForm({ ...form, preparation_unlocked: event.target.checked })} />
        </label>
        <label className="switch-row">
          <span><strong>Spell choices unlocked</strong><small>Lets players choose cantrips or make level-up spell choices.</small></span>
          <input type="checkbox" checked={form.choices_unlocked} onChange={(event) => setForm({ ...form, choices_unlocked: event.target.checked })} />
        </label>
      </div>

      <fieldset className="choice-fieldset">
        <legend>Optional rule overrides</legend>
        <p className="fieldset-copy">Leave a field blank to use the automatic 2024 class value.</p>
        <div className="form-grid form-grid--3">
          <Field label="Cantrip limit" hint={`Automatic: ${defaults?.cantrips ?? 0}`}><Input type="number" min={0} max={50} value={form.max_cantrips_override ?? ''} onChange={(event) => setForm({ ...form, max_cantrips_override: numberOrNull(event.target.value) })} /></Field>
          <Field label="Spell limit" hint={`Automatic: ${defaults?.prepared_spells ?? 0}`}><Input type="number" min={0} max={100} value={form.max_prepared_override ?? ''} onChange={(event) => setForm({ ...form, max_prepared_override: numberOrNull(event.target.value) })} /></Field>
          <Field label="Maximum spell level" hint={`Automatic: ${defaults?.max_spell_level ?? 0}`}><Input type="number" min={0} max={9} value={form.max_spell_level_override ?? ''} onChange={(event) => setForm({ ...form, max_spell_level_override: numberOrNull(event.target.value) })} /></Field>
        </div>
      </fieldset>

      <Field label="DM notes"><textarea className="textarea" value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value || null })} /></Field>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save character'}</Button>
      </div>
    </form>
  )
}
