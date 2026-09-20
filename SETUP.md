# Setup guide

You only need to do the Supabase setup once. After that, changes pushed to `main` deploy automatically to GitHub Pages.

## 1. Create the Supabase project

1. Create a free project at [supabase.com](https://supabase.com/).
2. Open **Authentication → Providers → Email**.
3. Enable email/password authentication and turn **Confirm email** off. Player accounts use private internal login addresses rather than real email inboxes.
4. Open **SQL Editor** and run the complete contents of:
   1. `supabase/migrations/202609190001_initial_schema.sql`
   2. `supabase/migrations/202609200001_campaign_groups.sql`
   3. `supabase/seed.sql`

The final script imports all 339 SRD spells. The spell seed updates SRD records without replacing custom spells or changing assignment IDs.

### Existing installations

If the app was already set up before campaign groups were added, run only `supabase/migrations/202609200001_campaign_groups.sql`. It creates a **Main Campaign** and moves every existing character into it, so no players or card assignments are lost.

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

- Use the campaign selector above the DM tabs to switch rosters.
- Choose **New campaign** to add another group. Spells and abilities remain shared between every campaign.
- Move a character between groups from that character's **Edit** form. Empty campaigns can be deleted; campaigns containing players cannot.
- If one person plays in both campaigns, create a separate player username and character for each campaign.
- Use **Open choices for everyone** to unlock both prepared spells and cantrip choices for every player in one click. The same button locks them again.
- Players can select or remove several spells on the preparation page, then use **Save changes** once when they are finished.
- Update the character's class or level; the default limits recalculate automatically.
- Use overrides only for feats, multiclassing, house rules, or unusual rewards.
- Turn on **Preparation unlocked** after a long rest for Clerics, Druids, Paladins, and Wizards.
- Turn on **Spell choices unlocked** during character creation or level-up for Bards, Rangers, Sorcerers, and Warlocks. It also controls cantrip changes.
- For Wizards, assign spells without selecting them to add them to the spellbook. The player can then prepare those entries while preparation is unlocked.
- Mark subclass or granted spells **Always prepared** so they stay active without using the normal limit.

## Password recovery for a player

Player accounts intentionally do not use real email addresses. If someone forgets a password:

1. In Supabase **Authentication → Users**, delete that player's internal account (`username@dnd-player.invalid`). The character and assigned cards remain.
2. In the DM site's player editor, create a new activation code.
3. Have the player repeat **First-time setup** and choose a new password.

## Updating the spell source

The imported source is pinned in `scripts/import-spells.mjs`. To refresh it:

```bash
npm run import:spells
```

Review the generated changes to `public/data/spells.json` and `supabase/seed.sql`, run the seed against Supabase, then commit the updated files.
