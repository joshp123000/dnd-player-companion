import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const SOURCE_URL = 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf'
const OUTPUT_URL = new URL('../src/data/class-features.json', import.meta.url)
const ARTIFICER_URL = new URL('../src/data/artificer-features.json', import.meta.url)
const MIGRATION_URL = new URL('../supabase/migrations/202609200004_class_features.sql', import.meta.url)

const CLASSES = [
  ['barbarian', 'Barbarian'],
  ['bard', 'Bard'],
  ['cleric', 'Cleric'],
  ['druid', 'Druid'],
  ['fighter', 'Fighter'],
  ['monk', 'Monk'],
  ['paladin', 'Paladin'],
  ['ranger', 'Ranger'],
  ['rogue', 'Rogue'],
  ['sorcerer', 'Sorcerer'],
  ['warlock', 'Warlock'],
  ['wizard', 'Wizard'],
]

const ACTION_OVERRIDES = new Map([
  ['barbarian:rage', 'Bonus Action'],
  ['bard:bardic-inspiration', 'Bonus Action'],
  ['bard:countercharm', 'Reaction'],
  ['cleric:channel-divinity', 'Magic Action'],
  ['cleric:divine-intervention', 'Magic Action'],
  ['cleric:greater-divine-intervention', 'Magic Action'],
  ['druid:wild-shape', 'Bonus Action'],
  ['druid:wild-companion', 'Magic Action'],
  ['fighter:second-wind', 'Bonus Action'],
  ['monk:monks-focus', 'Bonus Action'],
  ['monk:deflect-attacks', 'Reaction'],
  ['monk:slow-fall', 'Reaction'],
  ['monk:deflect-energy', 'Reaction'],
  ['paladin:lay-on-hands', 'Bonus Action'],
  ['paladin:restoring-touch', 'Bonus Action'],
  ['ranger:natures-veil', 'Bonus Action'],
  ['rogue:cunning-action', 'Bonus Action'],
  ['rogue:uncanny-dodge', 'Reaction'],
  ['sorcerer:innate-sorcery', 'Bonus Action'],
  ['sorcerer:sorcery-incarnate', 'Bonus Action'],
  ['warlock:contact-patron', 'Magic Action'],
])

const slugify = (value) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’']/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const reflow = (value, classLabel) => {
  const lines = value
    .replace(/\r/g, '')
    .replace(/\u00ad\s*/g, '')
    .replace(new RegExp(`^${classLabel}$`, 'gm'), '')
    .replace(/([A-Za-z])-\n([a-z])/g, '$1$2')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  let result = ''
  for (const line of lines) {
    if (line.startsWith('•')) {
      result += `${result ? '\n' : ''}- ${line.slice(1).trim()}`
      continue
    }
    result += `${result && !result.endsWith('\n') ? ' ' : ''}${line}`
  }

  return result
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

const summarize = (description) => {
  const plain = description.replace(/\n- /g, ' ').replace(/\*+/g, '')
  const firstSentence = plain.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? plain
  return firstSentence.length <= 180
    ? firstSentence
    : `${firstSentence.slice(0, 177).trimEnd()}…`
}

const extractFeatures = (rawText, classKey, classLabel) => {
  const sectionStart = rawText.indexOf(`${classLabel} Class Features`)
  const sectionEnd = rawText.indexOf(`${classLabel} Subclass:`, sectionStart)
  if (sectionStart < 0 || sectionEnd < 0) {
    throw new Error(`Could not isolate ${classLabel} class features.`)
  }

  const section = rawText.slice(sectionStart, sectionEnd)
  const headings = [...section.matchAll(/^Level (\d+): (.+)$/gm)]
  const perLevelOrder = new Map()

  return headings.flatMap((match, index) => {
    const level = Number(match[1])
    const name = match[2].trim()
    if (/Subclass$/i.test(name)) return []

    const descriptionStart = match.index + match[0].length
    const descriptionEnd = headings[index + 1]?.index ?? section.length
    const description = reflow(section.slice(descriptionStart, descriptionEnd), classLabel)
    if (!description) throw new Error(`No description found for ${classLabel} ${name}.`)

    const featureKey = slugify(name)
    const order = (perLevelOrder.get(level) ?? 0) + 1
    perLevelOrder.set(level, order)

    return [{
      slug: `srd52-${classKey}-${level}-${featureKey}`,
      name,
      category: `${classLabel} feature`,
      class_key: classKey,
      level_required: level,
      feature_order: order,
      action_type: ACTION_OVERRIDES.get(`${classKey}:${featureKey}`) ?? null,
      uses: null,
      recharge: null,
      summary: summarize(description),
      description,
      source: `${classLabel} level ${level} · SRD 5.2.1 (2024)`,
      tags: [classKey, 'class feature', `level ${level}`, '2024 rules'],
      source_type: 'srd',
    }]
  })
}

const response = await fetch(SOURCE_URL)
if (!response.ok) throw new Error(`Could not download SRD 5.2.1 (${response.status}).`)
const pdf = Buffer.from(await response.arrayBuffer())

const conversion = spawnSync('pdftotext', ['-f', '28', '-l', '83', '-raw', '-', '-'], {
  input: pdf,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
})
if (conversion.error) throw conversion.error
if (conversion.status !== 0) throw new Error(conversion.stderr || 'pdftotext failed.')

const rawText = conversion.stdout
  .replace(/\f/g, '\n')
  .replace(/System Reference Document 5\.2\.1\n\d+\n/g, '\n')

const coreFeatures = CLASSES.flatMap(([classKey, classLabel]) => (
  extractFeatures(rawText, classKey, classLabel)
))
const artificerFeatures = JSON.parse(await readFile(ARTIFICER_URL, 'utf8'))
const features = [...coreFeatures, ...artificerFeatures]

await writeFile(OUTPUT_URL, `${JSON.stringify(features, null, 2)}\n`)
const migration = await readFile(MIGRATION_URL, 'utf8')
const dataMarker = '$feature_data$'
const dataStart = migration.indexOf(dataMarker)
const dataEnd = migration.indexOf(dataMarker, dataStart + dataMarker.length)
if (dataStart < 0 || dataEnd < 0) throw new Error('Class-feature migration data markers are missing.')
await writeFile(
  MIGRATION_URL,
  `${migration.slice(0, dataStart + dataMarker.length)}${JSON.stringify(features)}${migration.slice(dataEnd)}`,
)
console.log(`Wrote ${features.length} base-class features (${coreFeatures.length} SRD, ${artificerFeatures.length} Artificer) to ${fileURLToPath(OUTPUT_URL)}.`)
