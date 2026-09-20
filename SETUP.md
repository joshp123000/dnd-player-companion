# Setup guide

You only need to do the Supabase setup once. After that, changes pushed to `main` deploy automatically to GitHub Pages.

## 1. Create the Supabase project

1. Create a free project at [supabase.com](https://supabase.com/).
2. Open **Authentication → Providers → Email**.
3. Enable email/password authentication and turn **Confirm email** off. Player accounts use private internal login addresses rather than real email inboxes.
4. Open **SQL Editor** and run the complete contents of:
   1. `supabase/migrations/202609190001_initial_schema.sql`
   2. `supabase/migrations/202609200001_campaign_groups.sql`
   3. `supabase/migrations/202609200002_account_recovery.sql`
   4. `supabase/migrations/202609200003_artificer.sql`
   5. `supabase/migrations/202609200004_class_features.sql`
   6. `supabase/migrations/202609200005_phb_feats.sql`
   7. `supabase/migrations/202609200006_magic_items.sql`
   8. `supabase/seed.sql`

The magic-item migration imports all 258 SRD 5.2.1 items. The final script imports all 339 SRD spells. Both update built-in records without replacing custom cards or changing assignment IDs.

### Existing installations

For an existing installation that already has the feat cards, run only `supabase/migrations/202609200006_magic_items.sql` to add the magic-item library and tab data. If it does not yet have feats, run `202609200005_phb_feats.sql` first. If an older installation is missing campaign groups, account recovery, Artificer support, or class features, run the missing migrations in the numbered order above. Every migration preserves existing players, custom ability cards, and card assignments.

## 2. Create the first DM account

1. In **Authentication → Users**, choose **Add user**.
2. Enter your real email, choose a strong password, and mark the user confirmed.
3. Return to **SQL Editor** and run this with your details:

```sql
select public.promote_user_to_dm(
  'your-email@example.com',
  'Dungeon Master',
  'dm'
);
```

That promotion function cannot be called by the public website. It is reserved for the database owner through the SQL editor.

## 3. Connect the frontend

In **Project Settings → API**, copy:

- Project URL
- Publishable/anonymous key

For local development, copy `.env.example` to `.env.local` and add those two values.

For GitHub Pages, open the repository's **Settings → Secrets and variables → Actions** and create these repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not use the service-role key. The anonymous key is the correct browser key; the database policies enforce the privacy boundary.

## 4. Turn on GitHub Pages

1. Open **Settings → Pages** in the GitHub repository.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Open **Actions**, choose **Deploy to GitHub Pages**, and run the workflow—or push a commit to `main`.

The deployed address will normally be:

`https://YOUR-GITHUB-USERNAME.github.io/dnd-player-companion/`

## 5. Add players

1. Sign in to the site with the DM email and password.
2. Open **Players → Add player**.
3. Choose the campaign, then enter a short login username, one-time activation code, character name, class, and level.
4. Privately give that player their username and activation code.
5. The player opens **First-time setup**, enters both values, and creates a permanent password.

The activation code is stored as a one-way hash and is erased after successful use. The DM cannot see the player's permanent password.

## Normal campaign workflow

- Each player can choose **Account → Compendium style**. Their Classic, Spelljammer, or Tomb of Annihilation selection is saved to their login and follows them between devices.
- Use the campaign selector above the DM tabs to switch rosters.
- Choose **New campaign** to add another group. Spells, magic items, and abilities remain shared between every campaign.
- Move a character between groups from that character's **Edit** form. Empty campaigns can be deleted; campaigns containing players cannot.
- If one person plays in both campaigns, create a separate player username and character for each campaign.
- Use **Open prep for everyone** after a Long Rest so prepared casters can change their leveled spells. Click it again to lock preparation.
- Prepared casters can select or remove several leveled spells on the preparation page, then use **Save changes** once when they are finished. Cantrips never appear on that page.
- Assign cantrips and permanent known spells yourself from the **Spell library** after the player chooses them from the book.
- In the DM **Spell library**, use the player-status filter to review everything on a character, only their currently prepared selections, always-prepared spells, inactive assignments, or a Wizard’s spellbook.
- Update the character's class or level; the default limits recalculate automatically.
- Base-class feature cards are automatically added or removed when the character's class or level changes.
- In **Abilities**, use **Hide** to suppress an automatic feature for one character and **Restore** to bring it back. Adding an off-class or higher-level feature creates a DM override.
- Choose **Feats only** to browse all 75 Player’s Handbook feats. Each card shows its prerequisite and whether it is repeatable; use **Add** or **Remove** for the selected character.
- Open **Magic items** to search the 258-item SRD catalog by name, type, or rarity. Choose a character and use **Assign** or **Remove**; the same item can be assigned to any number of characters.
- Players see their assigned items in their own **Magic items** tab and alongside their other cards under **All cards**.
- Use overrides for feats, multiclassing, house rules, or unusual rewards.
- Turn on **Preparation unlocked** after a long rest for Artificers, Clerics, Druids, Paladins, and Wizards.
- For Bards, Rangers, Sorcerers, and Warlocks, assign their chosen spells with **Selected/prepared now** turned on so the cards appear immediately.
- For Wizards, assign leveled spells without selecting them to add them to the spellbook. Assign Wizard cantrips with **Selected/prepared now** turned on. The player can prepare leveled spellbook entries while preparation is unlocked.
- Artificers receive Mending automatically as an always-prepared card; it does not use one of their normal cantrip choices.
- Mark subclass or granted spells **Always prepared** so they stay active without using the normal limit.

## Password recovery for a player

Players who know their current password can choose **Account → Change password** while signed in.

Player accounts intentionally do not use real email addresses, so forgotten passwords use a DM-controlled reset:

1. On the DM **Players** page, choose **Reset login** on that player's card.
2. Keep or change the username and enter a new one-time activation code.
3. Give the player those details privately.
4. The player chooses **First-time setup** and creates a new private password.

The reset removes the old login and sessions, but preserves the character, campaign membership, spells, abilities, and DM settings. For a player who has not activated yet, **Access setup** can change the username or unused activation code without deleting anything.

## Updating the spell source

The imported source is pinned in `scripts/import-spells.mjs`. To refresh it:

```bash
npm run import:spells
```

Review the generated changes to `public/data/spells.json` and `supabase/seed.sql`, run the seed against Supabase, then commit the updated files.

## Updating the magic-item source

The SRD 5.2.1 Markdown conversion is pinned in `scripts/import-magic-items.mjs`. To refresh the generated card library and SQL migration:

```bash
npm run import:magic-items
```

Review `src/data/magic-items.json` and `supabase/migrations/202609200006_magic_items.sql`, then run the migration against Supabase. The importer validates the expected 258 entries before writing either file.
