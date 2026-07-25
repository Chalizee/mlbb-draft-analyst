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
- Review team side performance, first-phase priorities, and contested heroes.
- Keep all imported data inside the browser. Nothing is shared automatically.
- Create a scrim session with any number of games.
- Record side, result, objectives, gold checkpoints, ordered drafts, and five
  player box scores per game.
- Calculate KDA, KP, GPM, DPM, durability, player trends, and opponent patterns.
- Autosave scrim sessions to local IndexedDB and download a JSON backup.
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

Tournament imports and scrim records are stored in the current browser. Clearing
browser site data can remove them, so download a scrim JSON backup periodically.
No data is automatically uploaded or shared.
