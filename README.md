# Campaign Compendium

A phone-first D&D 2024 spell and ability companion for a private campaign. Players see only their own character cards. The DM controls player access, creates or duplicates content, assigns abilities, and unlocks spell preparation or level-up choices.

The frontend is a static React app designed for GitHub Pages. Supabase supplies authentication, the database, and row-level permissions.

## What it includes

- Username/password access for players and email/password access for the DM
- One-time player activation codes—passwords never live in the GitHub repository
- Multiple campaign groups with separate player rosters and one shared spell/ability library
- 339 SRD 5.2 spells imported from the supplied JSON source
- Separate spell and ability entities with structured virtual-card editors
- Search and filters by name, level, class, and school
- Duplicate any SRD spell into an independent editable homebrew version
- 2024 class/level spell and cantrip limits for Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, and Wizard
- Per-character DM overrides for every automatic limit
- Daily preparation, level-up choice, and Wizard spellbook workflows
- Staged spell selection so players can make several choices and save once
- One-click DM control to open or lock spell and cantrip choices for every player
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

## Architecture

- `src/pages/PlayerDashboard.tsx` — player cards and spell choices
- `src/pages/DmDashboard.tsx` — player management and content workshop
- `src/lib/campaigns.ts` — campaign roster filtering and deletion safeguards
- `src/data/class-progression.json` — shared 2024 class limits
- `supabase/migrations/` — tables, policies, authentication hooks, and guarded spell-selection functions
- `supabase/seed.sql` — generated SRD spell seed
- `scripts/import-spells.mjs` — repeatable SRD JSON importer
- `.github/workflows/deploy-pages.yml` — tested GitHub Pages deployment

The Supabase anonymous key is designed to be public. Access control comes from the included row-level-security policies. Never put a Supabase service-role key into this frontend or into a `VITE_` variable.

## Rules and content notes

The automatic limits follow the 2024 class tables. A DM override is available because feats, multiclassing, subclasses, house rules, and campaign rewards can change a character's normal allowance.

The built-in spell library is SRD content. See [SRD-ATTRIBUTION.md](SRD-ATTRIBUTION.md). Project source code is licensed under [MIT](LICENSE).
