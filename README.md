# Campaign Compendium

A phone-first D&D 2024 spell and ability companion for a private campaign. Players see only their own character cards. The DM controls player access, creates or duplicates content, assigns permanent spell choices and abilities, and unlocks daily spell preparation.

The frontend is a static React app designed for GitHub Pages. Supabase supplies authentication, the database, and row-level permissions.

## What it includes

- Username/password access for players and email/password access for the DM
- One-time player activation codes—passwords never live in the GitHub repository
- Self-service password changes plus DM-controlled account recovery and username changes
- Per-account Classic Compendium, Spelljammer, and Tomb of Annihilation visual themes
- Multiple campaign groups with separate player rosters and shared spell, magic-item, and ability libraries
- 339 SRD 5.2 spells imported from the supplied JSON source
- All 258 magic-item entries from SRD 5.2.1, with type, rarity, attunement, rules text, and roll tables
- 174 built-in base-class feature cards covering every 2024 core class and the 2025 Artificer
- All 75 feats from the 2024 Player’s Handbook, with categories, prerequisites, repeatability, and concise rules summaries
- Separate spell, magic-item, and ability card tabs for both DMs and players
- Spell search by name, level, class, and school, plus magic-item search by name, type, rarity, and tag
- Duplicate any SRD spell into an independent editable homebrew version
- Edit generated spell, class-feature, feat, and magic-item cards globally without breaking assignments or automatic unlock rules
- Automatic class/level spell and cantrip limits for the 2024 core casters plus the 2025 Artificer
- Per-character DM overrides for every automatic limit
- Automatic class-feature assignments by class and level, with per-card DM hide/restore overrides
- Magic items can be assigned to any number of characters; players see only their own assigned items
- DM-assigned cantrips and permanent known spells, plus daily preparation and Wizard spellbook workflows
- DM spell-library views for each character’s assigned, currently prepared, always-prepared, inactive, and spellbook cards
- DM player-status views for assigned magic items and currently shown, automatic, DM-added, or hidden abilities
- Staged spell selection so players can make several choices and save once
- One-click DM control for opening or locking daily spell preparation
- Always-prepared spells that do not count against a character's normal limit
- Secure Supabase row-level security: players cannot read another player's character or assignments
- Responsive, accessible layout for phones, tablets, and desktops
- Automatic tests and GitHub Pages deployment

## Setup

Follow [SETUP.md](SETUP.md). It covers Supabase, the first DM account, GitHub secrets, and player onboarding.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Before committing changes:

```bash
npm test
npm run lint
npm run build
```

To refresh the vendored spell JSON and SQL seed from the configured source:

```bash
npm run import:spells
```

To refresh the 2024 SRD base-class feature cards and their migration data:

```bash
npm run import:class-features
```

To rebuild the 2024 feat cards and their migration data:

```bash
npm run import:feats
```

To refresh the SRD 5.2.1 magic-item cards and their migration data:

```bash
npm run import:magic-items
```

## Architecture

- `src/pages/PlayerDashboard.tsx` — player cards and spell choices
- `src/pages/DmDashboard.tsx` — player management and content workshop
- `src/lib/campaigns.ts` — campaign roster filtering and deletion safeguards
- `src/data/class-progression.json` — shared automatic class limits
- `src/data/class-features.json` — generated base-class feature card library
- `src/data/artificer-features.json` — summarized 2025 Artificer feature cards
- `src/data/feats.json` — generated 2024 Player’s Handbook feat-card library
- `src/data/magic-items.json` — generated SRD 5.2.1 magic-item card library
- `supabase/migrations/` — tables, policies, authentication hooks, account recovery, and guarded spell-selection functions
- `supabase/seed.sql` — generated SRD spell seed
- `scripts/import-spells.mjs` — repeatable SRD JSON importer
- `scripts/import-class-features.mjs` — repeatable SRD class-feature importer and migration-data builder
- `scripts/import-feats.mjs` — repeatable feat-card and migration-data builder
- `scripts/import-magic-items.mjs` — pinned SRD magic-item importer and migration-data builder
- `.github/workflows/deploy-pages.yml` — tested GitHub Pages deployment

The Supabase anonymous key is designed to be public. Access control comes from the included row-level-security policies. Never put a Supabase service-role key into this frontend or into a `VITE_` variable.

## Rules and content notes

The automatic limits and base-class feature cards follow the 2024 core classes and the printed 2025 Artificer. Artificers receive Mending automatically as an always-prepared card, outside their normal cantrip limit. Class features appear automatically when a character reaches their required level; the DM can hide a feature or add another card when subclasses, multiclassing, house rules, or campaign rewards require it. Feats are intentionally manual: the DM assigns the chosen feat after checking the prerequisite displayed on its card.

The built-in spell and magic-item libraries are SRD content. The magic-item tab contains the complete SRD 5.2.1 catalog; items published only in the Dungeon Master’s Guide and not released in the SRD are not copied into the repository. See [SRD-ATTRIBUTION.md](SRD-ATTRIBUTION.md). Project source code is licensed under [MIT](LICENSE).
