import { useState, type FormEvent } from 'react'
import type { Ability } from '../types'
import type { AbilityInput } from '../lib/api'
import { Button, Field, Input } from './ui'

const fromAbility = (ability?: Ability | null): AbilityInput => ({
  name: ability?.name ?? '',
  category: ability?.category ?? 'Class feature',
  action_type: ability?.action_type ?? null,
  uses: ability?.uses ?? null,
  recharge: ability?.recharge ?? null,
  summary: ability?.summary ?? null,
  description: ability?.description ?? '',
  source: ability?.source ?? null,
  tags: ability?.tags ?? [],
})

export function AbilityEditor({
  ability,
  busy,
  onSubmit,
  onCancel,
}: {
  ability?: Ability | null
  busy?: boolean
  onSubmit: (input: AbilityInput) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<AbilityInput>(() => fromAbility(ability))
  const nullable = (value: string) => value.trimStart() || null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ ...form, name: form.name.trim(), category: form.category.trim(), description: form.description.trim() })
  }

  return (
    <form className="editor-form" onSubmit={submit}>
      <div className="form-grid form-grid--2">
        <Field label="Ability name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
        <Field label="Category"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Class feature, feat, item…" required /></Field>
      </div>
      <div className="form-grid form-grid--3">
        <Field label="Action type"><Input value={form.action_type ?? ''} onChange={(event) => setForm({ ...form, action_type: nullable(event.target.value) })} placeholder="Bonus Action" /></Field>
        <Field label="Uses"><Input value={form.uses ?? ''} onChange={(event) => setForm({ ...form, uses: nullable(event.target.value) })} placeholder="2 uses" /></Field>
        <Field label="Recharge"><Input value={form.recharge ?? ''} onChange={(event) => setForm({ ...form, recharge: nullable(event.target.value) })} placeholder="Short Rest" /></Field>
      </div>
      <Field label="One-line summary"><Input value={form.summary ?? ''} onChange={(event) => setForm({ ...form, summary: nullable(event.target.value) })} placeholder="Regain 1d10 + your level HP." /></Field>
      <Field label="Full description" hint="Markdown is supported.">
        <textarea className="textarea textarea--large" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
      </Field>
      <div className="form-grid form-grid--2">
        <Field label="Source"><Input value={form.source ?? ''} onChange={(event) => setForm({ ...form, source: nullable(event.target.value) })} placeholder="Fighter level 1" /></Field>
        <Field label="Tags" hint="Comma-separated"><Input value={form.tags.join(', ')} onChange={(event) => setForm({ ...form, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="healing, class feature" /></Field>
      </div>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : ability ? 'Save changes' : 'Create ability'}</Button>
      </div>
    </form>
  )
}
