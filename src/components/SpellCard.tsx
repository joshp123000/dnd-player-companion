import { ChevronDown, ChevronUp, Clock3, Focus, Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Spell } from '../types'
import { titleCase } from '../lib/format'
import { spellLevelLabel } from '../lib/rules'

export function SpellCard({
  spell,
  badge,
  action,
  secondaryAction,
  defaultOpen = false,
}: {
  spell: Spell
  badge?: string
  action?: ReactNode
  secondaryAction?: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const castingTime = spell.casting_time || titleCase(spell.action_type)

  return (
    <article className={`content-card spell-card school-${spell.school}`}>
      <button
        type="button"
        className="content-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="spell-card__sigil" aria-hidden="true">
          {spell.level === 0 ? 'C' : spell.level}
        </span>
        <span className="content-card__heading">
          <span className="content-card__title-row">
            <strong>{spell.name}</strong>
            {badge && <span className="badge badge--accent">{badge}</span>}
            {spell.source_type === 'custom' && <span className="badge">Custom</span>}
            {spell.dm_edited && <span className="badge">DM edited</span>}
          </span>
          <span className="content-card__subtitle">
            {spellLevelLabel(spell.level)} · {titleCase(spell.school)}
          </span>
        </span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <div className="spell-card__quick-facts">
        <span>
          <Clock3 size={15} /> {castingTime}
        </span>
        <span>
          <Focus size={15} /> {spell.range}
        </span>
        {spell.concentration && (
          <span>
            <Sparkles size={15} /> Concentration
          </span>
        )}
      </div>

      {open && (
        <div className="content-card__details">
          <dl className="detail-list">
            <div>
              <dt>Duration</dt>
              <dd>{spell.duration}</dd>
            </div>
            <div>
              <dt>Components</dt>
              <dd>{spell.components.map((value) => value.toUpperCase()).join(', ') || 'None'}</dd>
            </div>
            {spell.material && (
              <div className="detail-list__wide">
                <dt>Material</dt>
                <dd>{spell.material}</dd>
              </div>
            )}
            {spell.casting_trigger && (
              <div className="detail-list__wide">
                <dt>Trigger</dt>
                <dd>{spell.casting_trigger}</dd>
              </div>
            )}
          </dl>
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{spell.description}</ReactMarkdown>
          </div>
          {spell.level > 0 && spell.higher_level && (
            <div className="callout">
              <strong>Using a Higher-Level Slot</strong>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{spell.higher_level}</ReactMarkdown>
            </div>
          )}
          {spell.level === 0 && spell.cantrip_upgrade && (
            <div className="callout">
              <strong>Cantrip Upgrade</strong>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{spell.cantrip_upgrade}</ReactMarkdown>
            </div>
          )}
          <p className="source-line">Source: {spell.source_label}</p>
        </div>
      )}

      {(action || secondaryAction) && (
        <footer className="content-card__actions">
          {secondaryAction}
          {action}
        </footer>
      )}
    </article>
  )
}
