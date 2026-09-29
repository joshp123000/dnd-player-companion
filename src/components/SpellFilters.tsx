import { Search } from 'lucide-react'
import type { SpellFilters as SpellFilterValues, SpellSortMode } from '../types'
import { SPELLCASTING_CLASSES, classLabel } from '../lib/rules'
import { Input, Select } from './ui'

const SCHOOLS = [
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
]

export function SpellFilters({
  value,
  onChange,
  hideClass = false,
  sort,
  onSortChange,
}: {
  value: SpellFilterValues
  onChange: (value: SpellFilterValues) => void
  hideClass?: boolean
  sort?: SpellSortMode
  onSortChange?: (value: SpellSortMode) => void
}) {
  return (
    <div className="filters">
      <label className="search-input">
        <Search size={18} />
        <Input
          aria-label="Search spells"
          placeholder="Search spells…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
        />
      </label>
      <Select
        aria-label="Filter by spell level"
        value={value.level}
        onChange={(event) =>
          onChange({ ...value, level: event.target.value === 'all' ? 'all' : Number(event.target.value) })
        }
      >
        <option value="all">All levels</option>
        <option value="0">Cantrips</option>
        {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
          <option key={level} value={level}>Level {level}</option>
        ))}
      </Select>
      {!hideClass && (
        <Select
          aria-label="Filter by class"
          value={value.classKey}
          onChange={(event) => onChange({ ...value, classKey: event.target.value })}
        >
          <option value="all">All classes</option>
          {SPELLCASTING_CLASSES.map((classKey) => (
            <option value={classKey} key={classKey}>{classLabel(classKey)}</option>
          ))}
        </Select>
      )}
      <Select
        aria-label="Filter by school"
        value={value.school}
        onChange={(event) => onChange({ ...value, school: event.target.value })}
      >
        <option value="all">All schools</option>
        {SCHOOLS.map((school) => <option value={school} key={school}>{classLabel(school)}</option>)}
      </Select>
      {sort && onSortChange && (
        <Select
          aria-label="Sort spells"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as SpellSortMode)}
        >
          <option value="level">Level (low to high)</option>
          <option value="name">Name (A–Z)</option>
        </Select>
      )}
    </div>
  )
}
