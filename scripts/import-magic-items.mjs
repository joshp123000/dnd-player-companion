import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const OUTPUT_URL = new URL('../src/data/magic-items.json', import.meta.url)
const MIGRATION_URL = new URL('../supabase/migrations/202609200006_magic_items.sql', import.meta.url)
const SOURCE_URL = 'https://raw.githubusercontent.com/downfallx/dnd-5e-srd-markdown/1b4b99dcb786cdd1a2fb26f8acec1551191f1ca4/magic-items.md'
const EXPECTED_ITEM_COUNT = 258
const ITEM_METADATA = /^_(Armor|Potion|Ring|Rod|Scroll|Staff|Wand|Weapon|Wondrous Item)\b(.*)_$/
const RARITY = /\b(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)\b/g

const slugify = (value) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’']/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const decodeHtml = (value) => value
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#(?:39|x27);/gi, "'")
  .replace(/&#(d+);/g, (_, code) => String.fromCodePoint(Number(code)))

const tableCell = (value) => decodeHtml(value)
  .replace(/<br\s*\/?\s*>/gi, '; ')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\\/g, '\\\\')
  .replace(/\|/g, '\\|')

const htmlTableToMarkdown = (html) => {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) => (
    [...rowMatch[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)].map((cellMatch) => tableCell(cellMatch[2]))
  )).filter((row) => row.length > 0)

  if (rows.length === 0) return ''
  const width = Math.max(...rows.map((row) => row.length))
  const normalized = rows.map((row) => [...row, ...Array(width - row.length).fill('')])
  const [header, ...body] = normalized
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

const normalizeDescription = (value) => value
  .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (table) => htmlTableToMarkdown(table))
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const plainText = (value) => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`>#|~-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const summarize = (description) => {
  const paragraph = description
    .split(/\n\s*\n/)
    .map(plainText)
    .find((value) => value && !/^\d+\s/.test(value)) ?? plainText(description)
  if (paragraph.length <= 220) return paragraph
  const sentence = paragraph.match(/^.{1,220}?[.!?](?:\s|$)/)?.[0]?.trim()
  return sentence || `${paragraph.slice(0, 217).trimEnd()}…`
}

const loadSource = async () => {
  const path = process.argv[2]
  if (path) return readFile(path, 'utf8')
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`Could not download magic-item source (${response.status}).`)
  return response.text()
}

const parseMagicItems = (markdown) => {
  const lines = markdown.split(/\r?\n/)
  const sectionStart = lines.findIndex((line) => line === '## Magic Items A–Z')
  if (sectionStart < 0) throw new Error('The Magic Items A–Z section was not found.')

  const starts = []
  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    if (!lines[index].startsWith('#### ')) continue
    let metadataIndex = index + 1
    while (metadataIndex < lines.length && !lines[metadataIndex].trim()) metadataIndex += 1
    const match = lines[metadataIndex]?.match(ITEM_METADATA)
    if (match) starts.push({ index, metadataIndex, name: lines[index].slice(5).trim(), category: match[1] })
  }

  if (starts.length !== EXPECTED_ITEM_COUNT) {
    throw new Error(`Expected ${EXPECTED_ITEM_COUNT} magic items, found ${starts.length}. The source format may have changed.`)
  }

  return starts.map((start, itemIndex) => {
    const end = starts[itemIndex + 1]?.index ?? lines.length
    const metadata = lines[start.metadataIndex].slice(1, -1).trim()
    const description = normalizeDescription(lines.slice(start.metadataIndex + 1, end).join('\n'))
    const rarityMatches = [...metadata.matchAll(RARITY)].map((match) => match[1])
    const uniqueRarities = [...new Set(rarityMatches)]
    const rarity = /Rarity Varies/i.test(metadata) || uniqueRarities.length !== 1
      ? 'Varies'
      : uniqueRarities[0]
    const attunement = metadata.match(/\((Requires Attunement[^)]*)\)/i)?.[1] ?? null
    const itemType = metadata
      .replace(/,\s*(?:Rarity Varies|Common|Uncommon|Rare|Very Rare|Legendary|Artifact)\b[\s\S]*$/i, '')
      .trim()
    const tags = [
      'magic item',
      start.category.toLowerCase(),
      rarity.toLowerCase(),
      '2024 rules',
      ...(attunement ? ['attunement'] : []),
    ]

    return {
      slug: `srd52-magic-item-${slugify(start.name)}`,
      name: start.name,
      category: start.category,
      ability_kind: 'magic_item',
      class_key: null,
      level_required: null,
      feature_order: itemIndex + 1,
      action_type: null,
      uses: null,
      recharge: null,
      summary: summarize(description),
      description,
      prerequisite: null,
      repeatable: false,
      source: 'SRD 5.2.1 (2024)',
      tags,
      source_type: 'srd',
      item_type: itemType,
      item_rarity: rarity,
      attunement,
    }
  })
}

const migrationSql = (items) => `-- Add the complete SRD 5.2.1 (2024) magic-item library as manually assigned cards.
-- SRD 5.2.1 © 2024 Wizards of the Coast LLC, licensed under CC BY 4.0.
-- https://www.dndbeyond.com/srd

begin;

alter table public.abilities add column if not exists item_type text;
alter table public.abilities add column if not exists item_rarity text;
alter table public.abilities add column if not exists attunement text;

alter table public.abilities drop constraint if exists abilities_system_metadata_check;
alter table public.abilities drop constraint if exists abilities_kind_check;

alter table public.abilities add constraint abilities_kind_check
  check (ability_kind in ('class_feature', 'feat', 'magic_item', 'custom'));

alter table public.abilities add constraint abilities_system_metadata_check
  check (
    not is_system
    or (
      slug is not null
      and (
        (ability_kind = 'class_feature' and class_key is not null and level_required is not null)
        or (ability_kind = 'feat' and class_key is null)
        or (
          ability_kind = 'magic_item'
          and class_key is null
          and level_required is null
          and item_type is not null
          and item_rarity is not null
        )
      )
    )
  );

create index if not exists abilities_magic_item_idx
  on public.abilities (item_rarity, category, name)
  where ability_kind = 'magic_item';

with magic_item_data as (
  select value as item
  from jsonb_array_elements($magic_item_data$${JSON.stringify(items)}$magic_item_data$::jsonb)
)
insert into public.abilities (
  slug,
  name,
  category,
  ability_kind,
  class_key,
  level_required,
  feature_order,
  is_system,
  source_type,
  action_type,
  uses,
  recharge,
  summary,
  description,
  prerequisite,
  repeatable,
  source,
  tags,
  item_type,
  item_rarity,
  attunement,
  created_by
)
select
  item->>'slug',
  item->>'name',
  item->>'category',
  item->>'ability_kind',
  nullif(item->>'class_key', ''),
  (item->>'level_required')::integer,
  (item->>'feature_order')::integer,
  true,
  item->>'source_type',
  nullif(item->>'action_type', ''),
  nullif(item->>'uses', ''),
  nullif(item->>'recharge', ''),
  nullif(item->>'summary', ''),
  item->>'description',
  nullif(item->>'prerequisite', ''),
  coalesce((item->>'repeatable')::boolean, false),
  nullif(item->>'source', ''),
  array(select jsonb_array_elements_text(item->'tags')),
  nullif(item->>'item_type', ''),
  nullif(item->>'item_rarity', ''),
  nullif(item->>'attunement', ''),
  null
from magic_item_data
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  ability_kind = excluded.ability_kind,
  class_key = excluded.class_key,
  level_required = excluded.level_required,
  feature_order = excluded.feature_order,
  is_system = true,
  source_type = excluded.source_type,
  action_type = excluded.action_type,
  uses = excluded.uses,
  recharge = excluded.recharge,
  summary = excluded.summary,
  description = excluded.description,
  prerequisite = excluded.prerequisite,
  repeatable = excluded.repeatable,
  source = excluded.source,
  tags = excluded.tags,
  item_type = excluded.item_type,
  item_rarity = excluded.item_rarity,
  attunement = excluded.attunement,
  updated_at = now();

commit;
`

const markdown = await loadSource()
const items = parseMagicItems(markdown)
const slugs = new Set(items.map((item) => item.slug))
if (slugs.size !== items.length) throw new Error('Generated magic-item slugs are not unique.')

await writeFile(OUTPUT_URL, `${JSON.stringify(items, null, 2)}\n`)
await writeFile(MIGRATION_URL, migrationSql(items))

console.log(`Wrote ${items.length} magic items to ${fileURLToPath(OUTPUT_URL)}`)
console.log(`Wrote migration to ${fileURLToPath(MIGRATION_URL)}`)
