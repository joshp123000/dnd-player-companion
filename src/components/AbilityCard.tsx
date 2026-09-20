import { ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Ability } from '../types'

export function AbilityCard({
  ability,
  note,
  badge,
  action,
  secondaryAction,
}: {
  ability: Ability
  note?: string | null
  badge?: string
  action?: ReactNode
  secondaryAction?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const details = [
    ability.level_required ? `Level ${ability.level_required}` : null,
    ability.action_type,
    ability.uses,
    ability.recharge,
  ].filter(Boolean).join(' · ')

  return (
    <article className="content-card ability-card">
      <button
        type="button"
        className="content-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ability-card__icon" aria-hidden="true">
          <Zap size={20} />
        </span>
        <span className="content-card__heading">
          <span className="content-card__title-row">
            <strong>{ability.name}</strong>
            <span className="badge">{ability.category}</span>
            {badge && <span className="badge badge--accent">{badge}</span>}
          </span>
          <span className="content-card__subtitle">
            {details || 'Passive ability'}
          </span>
        </span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {ability.summary && <p className="ability-card__summary">{ability.summary}</p>}
      {open && (
        <div className="content-card__details">
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{ability.description}</ReactMarkdown>
          </div>
          {note && <div className="callout"><strong>DM note</strong><p>{note}</p></div>}
          {ability.tags.length > 0 && (
            <div className="tag-list">
              {ability.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
            </div>
          )}
          {ability.source && <p className="source-line">Source: {ability.source}</p>}
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
