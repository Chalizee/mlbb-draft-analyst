# Chalize MLBB Scouting & Scrim Tracker

A private workspace for scouting completed MLBB tournament exports and tracking
your own team scrims.

## Current scope

- Import `player_match_record.csv` and `team_match_record.csv`.
- Validate aliases, incomplete drafts, result labels, and inferred roles.
- Assign one EXP, Jungle, Mid, Gold, and Roam to every complete five-player lineup.
- Rank players against the same role using role-specific metrics.
- Shrink low-sample scores toward the role baseline.
- Compare up to three players.
- Open a player profile with role percentiles, full box score, expanded
  per-hero metrics, and a game-by-game match log.
- Review team side performance, first-phase priorities, and contested heroes.
- Keep all imported data inside the browser. Nothing is shared automatically.
- Create a scrim session with any number of games.
- Record side, result, objectives, gold checkpoints, ordered drafts, and five
  player box scores per game.
- Calculate KDA, KP, GPM, DPM, durability, player trends, and opponent patterns.
- Autosave scrim sessions to local IndexedDB and, when configured, a private
  Supabase workspace.
- Use Owner, Editor, and Viewer roles. Viewers only receive sessions explicitly
  marked `Shared`.
- Move reports through `Draft → Complete → Reviewed → Shared`.
- Migrate existing browser sessions online without deleting the local backup.
- Generate a concise session report that requires coach review before sharing.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Choose **Scouting** to upload tournament CSVs or
**Scrims** to create a manual scrim session.

## Scoring guardrails

The adjusted Impact score does not directly use win rate or KDA. Those values
form a separate Surface score. Impact uses same-role percentiles for efficiency,
activity, pressure, objectives, survival, and versatility.

The **Context boosted** signal means surface stats are meaningfully ahead of
adjusted impact. It is a review flag, not proof that a player is overrated.

## Data storage

Tournament imports remain in the current browser. Scrim records also keep a
local IndexedDB backup. When Supabase environment variables are configured,
signed-in Owners and Editors sync new scrim changes to the team workspace.
Existing local sessions are only copied online after pressing **Migrate to
cloud**. Viewer accounts can only read sessions marked `Shared`.

## Secure workspace setup

1. Create a Supabase project and disable public user signup.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Create the owner's Auth user.
4. Replace `YOUR_OWNER_EMAIL` in `supabase/bootstrap-workspace.sql`, then run it.
5. Add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to Vercel.
6. Create the boss/management Auth user.
7. Replace the two email placeholders in `supabase/add-viewer.sql`, then run it.

Only the publishable key belongs in the browser/Vercel environment. Never expose
a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.
