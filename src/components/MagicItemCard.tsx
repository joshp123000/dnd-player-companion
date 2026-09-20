import { ChevronDown, ChevronUp, Gem } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Ability } from '../types'

export function MagicItemCard({
  item,
  note,
  badge,
  action,
}: {
  item: Ability
  note?: string | null
  badge?: string
  action?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const details = [
    item.item_type ?? item.category,
    item.item_rarity,
    item.attunement,
  ].filter(Boolean).join(' · ')

  return (
    <article className="content-card magic-item-card">
      <button
        type="button"
        className="content-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="magic-item-card__icon" aria-hidden="true"><Gem size={20} /></span>
        <span className="content-card__heading">
          <span className="content-card__title-row">
            <strong>{item.name}</strong>
            {item.item_rarity && <span className="badge">{item.item_rarity}</span>}
            {badge && <span className="badge badge--accent">{badge}</span>}
          </span>
          <span className="content-card__subtitle">{details || 'Magic item'}</span>
        </span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {item.summary && <p className="magic-item-card__summary">{item.summary}</p>}
      {open && (
        <div className="content-card__details">
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.description}</ReactMarkdown>
          </div>
          {note && <div className="callout"><strong>DM note</strong><p>{note}</p></div>}
          {item.tags.length > 0 && (
            <div className="tag-list">
              {item.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
            </div>
          )}
          {item.source && <p className="source-line">Source: {item.source}</p>}
        </div>
      )}

      {action && <footer className="content-card__actions">{action}</footer>}
    </article>
  )
}
