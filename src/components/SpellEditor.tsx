import { useState, type FormEvent } from 'react'
import type { Spell } from '../types'
import type { SpellInput } from '../lib/api'
import { SPELLCASTING_CLASSES, classLabel } from '../lib/rules'
import { advancementFieldsForLevel } from '../lib/spellAdvancement'
import { Button, Field, Input, Select } from './ui'

const COMPONENTS = ['v', 's', 'm']
const SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation']

const fromSpell = (spell?: Spell | null): SpellInput => ({
  name: spell ? `${spell.name}${spell.source_type === 'srd' ? ' (Custom)' : ''}` : '',
  level: spell?.level ?? 0,
  school: spell?.school ?? 'evocation',
  classes: spell?.classes ?? [],
  action_type: spell?.action_type ?? 'action',
  casting_time: spell?.casting_time ?? null,
  casting_trigger: spell?.casting_trigger ?? null,
  range: spell?.range ?? 'Self',
  components: spell?.components ?? [],
  material: spell?.material ?? null,
  duration: spell?.duration ?? 'Instantaneous',
  concentration: spell?.concentration ?? false,
  ritual: spell?.ritual ?? false,
  description: spell?.description ?? '',
  higher_level: spell?.higher_level ?? null,
  cantrip_upgrade: spell?.cantrip_upgrade ?? null,
  source_label: spell?.source_type === 'custom' ? spell.source_label : 'Homebrew',
  original_spell_id: spell?.source_type === 'srd' ? spell.id : spell?.original_spell_id ?? null,
})

export function SpellEditor({
  spell,
  duplicate = false,
  busy,
  onSubmit,
  onCancel,
}: {
  spell?: Spell | null
  duplicate?: boolean
  busy?: boolean
  onSubmit: (input: SpellInput) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<SpellInput>(() => fromSpell(duplicate ? spell : spell))

  const setText = (key: keyof SpellInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value.trimStart() || null }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      ...form,
      ...advancementFieldsForLevel(form.level, form.higher_level, form.cantrip_upgrade),
      name: form.name.trim(),
      description: form.description.trim(),
      range: form.range.trim(),
      duration: form.duration.trim(),
      source_label: form.source_label.trim() || 'Homebrew',
    })
  }

  return (
    <form className="editor-form" onSubmit={submit}>
      <div className="form-grid form-grid--3">
        <Field label="Spell name">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </Field>
        <Field label="Level">
          <Select value={form.level} onChange={(event) => setForm({ ...form, level: Number(event.target.value) })}>
            <option value={0}>Cantrip</option>
            {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => <option key={level} value={level}>Level {level}</option>)}
          </Select>
        </Field>
        <Field label="School">
          <Select value={form.school} onChange={(event) => setForm({ ...form, school: event.target.value })}>
            {SCHOOLS.map((school) => <option key={school} value={school}>{classLabel(school)}</option>)}
          </Select>
        </Field>
      </div>

      <fieldset className="choice-fieldset">
        <legend>Class lists</legend>
        <div className="check-grid">
          {SPELLCASTING_CLASSES.map((classKey) => (
            <label className="check-chip" key={classKey}>
              <input
                type="checkbox"
                checked={form.classes.includes(classKey)}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  classes: event.target.checked
                    ? [...current.classes, classKey]
                    : current.classes.filter((item) => item !== classKey),
                }))}
              />
              <span>{classLabel(classKey)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-grid form-grid--3">
        <Field label="Action type">
          <Input value={form.action_type} onChange={(event) => setForm({ ...form, action_type: event.target.value })} placeholder="Action, Bonus Action…" required />
        </Field>
        <Field label="Casting time override" hint="Leave blank when action type is enough.">
          <Input value={form.casting_time ?? ''} onChange={(event) => setText('casting_time', event.target.value)} placeholder="1 minute" />
        </Field>
        <Field label="Range">
          <Input value={form.range} onChange={(event) => setForm({ ...form, range: event.target.value })} required />
        </Field>
      </div>

      <div className="form-grid form-grid--2">
        <Field label="Duration">
          <Input value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
        </Field>
        <Field label="Casting trigger">
          <Input value={form.casting_trigger ?? ''} onChange={(event) => setText('casting_trigger', event.target.value)} placeholder="When a creature…" />
        </Field>
      </div>

      <fieldset className="choice-fieldset">
        <legend>Components and flags</legend>
        <div className="check-grid check-grid--compact">
          {COMPONENTS.map((component) => (
            <label className="check-chip" key={component}>
              <input
                type="checkbox"
                checked={form.components.includes(component)}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  components: event.target.checked
                    ? [...current.components, component]
                    : current.components.filter((item) => item !== component),
                }))}
              />
              <span>{component.toUpperCase()}</span>
            </label>
          ))}
          <label className="check-chip">
            <input type="checkbox" checked={form.concentration} onChange={(event) => setForm({ ...form, concentration: event.target.checked })} />
            <span>Concentration</span>
          </label>
          <label className="check-chip">
            <input type="checkbox" checked={form.ritual} onChange={(event) => setForm({ ...form, ritual: event.target.checked })} />
            <span>Ritual</span>
          </label>
        </div>
      </fieldset>

      {form.components.includes('m') && (
        <Field label="Material component">
          <Input value={form.material ?? ''} onChange={(event) => setText('material', event.target.value)} />
        </Field>
      )}

      <Field label="Description" hint="Markdown is supported for headings, lists, bold text, and tables.">
        <textarea className="textarea textarea--large" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
      </Field>
      {form.level === 0 ? (
        <Field label="Cantrip upgrade">
          <textarea className="textarea" value={form.cantrip_upgrade ?? ''} onChange={(event) => setText('cantrip_upgrade', event.target.value)} />
        </Field>
      ) : (
        <Field label="Using a higher-level slot">
          <textarea className="textarea" value={form.higher_level ?? ''} onChange={(event) => setText('higher_level', event.target.value)} />
        </Field>
      )}
      <Field label="Source label">
        <Input value={form.source_label} onChange={(event) => setForm({ ...form, source_label: event.target.value })} placeholder="Homebrew" />
      </Field>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : duplicate ? 'Create duplicate' : spell ? 'Save changes' : 'Create spell'}</Button>
      </div>
    </form>
  )
}
