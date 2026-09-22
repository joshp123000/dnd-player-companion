import { useState, type FormEvent } from 'react'
import type { Ability, AbilityKind } from '../types'
import type { AbilityInput } from '../lib/api'
import { MAGIC_ITEM_RARITIES } from '../lib/magicItems'
import { Button, Field, Input, Select } from './ui'

type CreatableAbilityKind = Extract<AbilityKind, 'custom' | 'magic_item'>

const fromAbility = (
  ability?: Ability | null,
  abilityKind: CreatableAbilityKind = 'custom',
): AbilityInput => {
  const isMagicItem = (ability?.ability_kind ?? abilityKind) === 'magic_item'

  return {
    name: ability?.name ?? '',
    category: ability?.category ?? (isMagicItem ? 'Wondrous Item' : 'Class feature'),
    action_type: ability?.action_type ?? null,
    uses: ability?.uses ?? null,
    recharge: ability?.recharge ?? null,
    summary: ability?.summary ?? null,
    description: ability?.description ?? '',
    prerequisite: ability?.prerequisite ?? null,
    repeatable: ability?.repeatable ?? false,
    source: ability?.source ?? (isMagicItem ? 'Homebrew' : null),
    tags: ability?.tags ?? (isMagicItem ? ['magic item'] : []),
    item_type: ability?.item_type ?? null,
    item_rarity: ability?.item_rarity ?? null,
    attunement: ability?.attunement ?? null,
  }
}

export function AbilityEditor({
  ability,
  abilityKind = 'custom',
  busy,
  onSubmit,
  onCancel,
}: {
  ability?: Ability | null
  abilityKind?: CreatableAbilityKind
  busy?: boolean
  onSubmit: (input: AbilityInput) => void
  onCancel: () => void
}) {
  const editorKind = ability?.ability_kind ?? abilityKind
  const isMagicItem = editorKind === 'magic_item'
  const [form, setForm] = useState<AbilityInput>(() => fromAbility(ability, abilityKind))
  const nullable = (value: string) => value.trimStart() || null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const tags = form.tags.map((tag) => tag.trim()).filter(Boolean)
    onSubmit({
      ...form,
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      tags: isMagicItem && !tags.some((tag) => tag.toLowerCase() === 'magic item')
        ? ['magic item', ...tags]
        : tags,
    })
  }

  return (
    <form className="editor-form" onSubmit={submit}>
      <div className="form-grid form-grid--2">
        <Field label={isMagicItem ? 'Item name' : 'Ability name'}><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
        <Field label={isMagicItem ? 'Item category' : 'Category'}><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder={isMagicItem ? 'Wondrous Item, Weapon, Armor…' : 'Class feature, feat, trait…'} required /></Field>
      </div>
      <div className="form-grid form-grid--3">
        <Field label="Action type"><Input value={form.action_type ?? ''} onChange={(event) => setForm({ ...form, action_type: nullable(event.target.value) })} placeholder="Bonus Action" /></Field>
        <Field label="Uses"><Input value={form.uses ?? ''} onChange={(event) => setForm({ ...form, uses: nullable(event.target.value) })} placeholder="2 uses" /></Field>
        <Field label="Recharge"><Input value={form.recharge ?? ''} onChange={(event) => setForm({ ...form, recharge: nullable(event.target.value) })} placeholder="Short Rest" /></Field>
      </div>
      <Field label="One-line summary"><Input value={form.summary ?? ''} onChange={(event) => setForm({ ...form, summary: nullable(event.target.value) })} placeholder={isMagicItem ? 'A short reminder of what the item does.' : 'Regain 1d10 + your level HP.'} /></Field>
      <Field label="Full description" hint="Markdown is supported.">
        <textarea className="textarea textarea--large" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
      </Field>
      {ability?.ability_kind === 'feat' && (
        <div className="form-grid form-grid--2">
          <Field label="Prerequisite"><Input value={form.prerequisite ?? ''} onChange={(event) => setForm({ ...form, prerequisite: nullable(event.target.value) })} placeholder="Level 4+; Strength 13+" /></Field>
          <label className="switch-row"><span><strong>Repeatable feat</strong><small>A character may choose this feat more than once.</small></span><input type="checkbox" checked={form.repeatable} onChange={(event) => setForm({ ...form, repeatable: event.target.checked })} /></label>
        </div>
      )}
      {isMagicItem && (
        <div className="form-grid form-grid--3">
          <Field label="Specific type" hint="Optional; for example, Weapon (Any Sword)."><Input value={form.item_type ?? ''} onChange={(event) => setForm({ ...form, item_type: nullable(event.target.value) })} placeholder="Weapon (Any Sword)" /></Field>
          <Field label="Rarity">
            <Select value={form.item_rarity ?? ''} onChange={(event) => setForm({ ...form, item_rarity: nullable(event.target.value) })} required>
              <option value="">Choose rarity</option>
              {MAGIC_ITEM_RARITIES.map((rarity) => <option value={rarity} key={rarity}>{rarity}</option>)}
            </Select>
          </Field>
          <Field label="Attunement"><Input value={form.attunement ?? ''} onChange={(event) => setForm({ ...form, attunement: nullable(event.target.value) })} placeholder="Requires Attunement" /></Field>
        </div>
      )}
      <div className="form-grid form-grid--2">
        <Field label="Source"><Input value={form.source ?? ''} onChange={(event) => setForm({ ...form, source: nullable(event.target.value) })} placeholder={isMagicItem ? 'Homebrew or book name' : 'Fighter level 1'} /></Field>
        <Field label="Tags" hint="Comma-separated"><Input value={form.tags.join(', ')} onChange={(event) => setForm({ ...form, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder={isMagicItem ? 'weapon, fire, charges' : 'healing, class feature'} /></Field>
      </div>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : ability ? 'Save changes' : isMagicItem ? 'Create magic item' : 'Create ability'}</Button>
      </div>
    </form>
  )
}
