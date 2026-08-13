'use client';

import { useMemo, useState } from 'react';
import HeroAvatar from '@/components/ui/HeroAvatar';
import { HERO_DATA } from '@/data/heroData';
import {
  safeRate,
  type ScrimGame,
  type ScrimSession,
  type ScrimSide,
} from '@/lib/scrimDatabase';
import styles from './OpponentInsights.module.css';

interface OpponentInsightsProps {
  sessions: ScrimSession[];
}

interface OpponentGameRecord {
  key: string;
  date: string;
  patch: string;
  game: ScrimGame;
}

interface CountEntry {
  name: string;
  count: number;
}

interface HeroPoolEntry extends CountEntry {
  wins: number;
  blue: number;
  red: number;
  trackedGames: number;
  averageDamage: number;
  averageGold: number;
  averageKda: number;
  playerNames: string[];
}

interface OpponentPlayerProfile {
  key: string;
  name: string;
  games: number;
  wins: number;
  averageDamage: number;
  averageGold: number;
  averageKda: number;
  topHeroes: CountEntry[];
}

interface ObjectiveEntry {
  key: 'turtles' | 'lords' | 'towers';
  label: string;
  opponent: number;
  ours: number;
  control: number;
}

interface FirstObjectiveEntry {
  label: string;
  recorded: number;
  opponent: number;
  rate: number;
}

interface OpponentSideDraft {
  side: 'Blue' | 'Red';
  games: number;
  wins: number;
  openingLabel: string;
  openingPicks: CountEntry[];
  pickPriority: CountEntry[];
  firstPhaseBans: CountEntry[];
}

interface OpponentProfile {
  key: string;
  name: string;
  sessions: number;
  games: number;
  opponentWins: number;
  averageDuration: number;
  firstTurtle: FirstObjectiveEntry;
  firstLord: FirstObjectiveEntry;
  objectives: ObjectiveEntry[];
  heroPool: HeroPoolEntry[];
  players: OpponentPlayerProfile[];
  fullBoxScoreGames: number;
  sideDrafts: OpponentSideDraft[];
}

const heroVisuals = new Map(
  HERO_DATA.flatMap((hero) => [
    [normalize(hero.name), hero],
    [normalize(hero.slug), hero],
  ]),
);

export default function OpponentInsights({ sessions }: OpponentInsightsProps) {
  const profiles = useMemo(() => buildOpponentProfiles(sessions), [sessions]);
  const [selectedKey, setSelectedKey] = useState('');
  const selected = profiles.find((profile) => profile.key === selectedKey);

  if (selected) {
    return (
      <OpponentDetail
        profile={selected}
        onBack={() => setSelectedKey('')}
      />
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p>OPPONENT INSIGHTS</p>
          <h2>Open one opponent. Read every recorded tendency.</h2>
        </div>
        <span>{profiles.length} OPPONENT PROFILES</span>
      </header>

      {profiles.length === 0 ? (
        <div className={styles.empty}>
          <span>NO OPPONENT SAMPLE</span>
          <h3>No opponent data yet.</h3>
          <p>Profiles appear after opponent names, drafts, and objectives are saved.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {profiles.map((profile) => {
            const ourWins = profile.games - profile.opponentWins;
            return (
              <button
                className={styles.profileCard}
                type="button"
                key={profile.key}
                onClick={() => setSelectedKey(profile.key)}
              >
                <header>
                  <div>
                    <span>OPPONENT PROFILE</span>
                    <h3>{profile.name}</h3>
                  </div>
                  <b>→</b>
                </header>
                <div className={styles.cardMetrics}>
                  <Metric label="OUR RECORD" value={`${ourWins}-${profile.opponentWins}`} />
                  <Metric label="GAMES" value={String(profile.games)} />
                  <Metric
                    label="THEIR 1ST TURTLE"
                    value={
                      profile.firstTurtle.recorded > 0
                        ? `${Math.round(profile.firstTurtle.rate)}%`
                        : '—'
                    }
                  />
                </div>
                <div className={styles.heroStrip}>
                  {profile.heroPool.slice(0, 5).map((hero) => (
                    <div key={hero.name} title={`${hero.name} · ${hero.count} picks`}>
                      <HeroAvatar
                        name={hero.name}
                        imageUrl={heroVisual(hero.name)?.imageUrl}
                        size="sm"
                      />
                    </div>
                  ))}
                  {profile.heroPool.length === 0 && <small>No picks recorded</small>}
                </div>
                <footer>
                  <span>
                    {profile.sessions} sessions · {profile.fullBoxScoreGames} full box scores
                  </span>
                  <strong>VIEW FULL PROFILE</strong>
                </footer>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OpponentDetail({
  profile,
  onBack,
}: {
  profile: OpponentProfile;
  onBack: () => void;
}) {
  const ourWins = profile.games - profile.opponentWins;

  return (
    <section className={styles.page}>
      <button className={styles.backButton} type="button" onClick={onBack}>
        ← All opponents
      </button>

      <header className={styles.detailHero}>
        <div>
          <p>OPPONENT PROFILE</p>
          <h2>{profile.name}</h2>
          <span>Raw tendencies from every saved scrim against this team.</span>
        </div>
        <div className={styles.detailRecord}>
          <span>OUR RECORD</span>
          <strong>{ourWins}-{profile.opponentWins}</strong>
          <small>{profile.games} games · {profile.sessions} sessions</small>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <Metric label="OPPONENT WIN RATE" value={`${Math.round(safeRate(profile.opponentWins, profile.games) * 100)}%`} />
        <Metric label="AVERAGE GAME" value={`${profile.averageDuration.toFixed(1)}m`} />
        <Metric
          label="THEIR FIRST TURTLE"
          value={profile.firstTurtle.recorded > 0 ? `${Math.round(profile.firstTurtle.rate)}%` : '—'}
        />
        <Metric
          label="THEIR FIRST LORD"
          value={profile.firstLord.recorded > 0 ? `${Math.round(profile.firstLord.rate)}%` : '—'}
        />
        <Metric
          label="FULL PLAYER TRACKING"
          value={`${profile.fullBoxScoreGames}/${profile.games}`}
        />
      </section>

      <section className={styles.panel}>
        <SectionTitle
          eyebrow="OBJECTIVE PROFILE"
          title="What they secured against us"
          meta={`${profile.games} GAMES`}
        />
        <div className={styles.objectiveGrid}>
          {profile.objectives.map((objective) => (
            <article className={styles.objectiveCard} key={objective.key}>
              <span>{objective.label}</span>
              <strong>{objective.opponent}<i>:</i>{objective.ours}</strong>
              <small>opponent · us</small>
              <div><i style={{ width: `${objective.control}%` }} /></div>
              <b>
                {objective.opponent + objective.ours > 0
                  ? `${Math.round(objective.control)}% control`
                  : 'No recorded objective'}
              </b>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <SectionTitle
          eyebrow="DRAFT BY SIDE"
          title="Their priorities when First Pick and Second Pick"
          meta="ORDER PRESERVED"
        />
        <div className={styles.sideGrid}>
          {profile.sideDrafts.map((draft) => (
            <SideDraftCard draft={draft} key={draft.side} />
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <SectionTitle
          eyebrow="OPPONENT PLAYERS"
          title="Player + hero threat memory"
          meta={`${profile.players.length} TRACKED NICKS`}
        />
        {profile.players.length === 0 ? (
          <div className={styles.inlineEmpty}>
            Legacy games stay in the profile, but they do not invent missing enemy stats.
            Import a verified two-screen box score to start this table.
          </div>
        ) : (
          <div className={styles.playerThreatGrid}>
            {profile.players.map((player) => (
              <article key={player.key}>
                <header>
                  <div>
                    <span>OPPONENT PLAYER</span>
                    <h4>{player.name || 'Unknown player'}</h4>
                  </div>
                  <strong>{player.wins}-{player.games - player.wins}</strong>
                </header>
                <div className={styles.playerHeroStrip}>
                  {player.topHeroes.slice(0, 4).map((hero) => (
                    <span key={hero.name} title={`${hero.name} · ${hero.count} games`}>
                      <HeroAvatar
                        name={hero.name}
                        imageUrl={heroVisual(hero.name)?.imageUrl}
                        size="xs"
                      />
                      <small>{hero.count}</small>
                    </span>
                  ))}
                </div>
                <footer>
                  <span><small>AVG DAMAGE</small><b>{formatMetric(player.averageDamage)}</b></span>
                  <span><small>AVG GOLD</small><b>{formatMetric(player.averageGold)}</b></span>
                  <span><small>AVG KDA</small><b>{player.averageKda.toFixed(1)}</b></span>
                  <span><small>SAMPLE</small><b>{player.games}</b></span>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <SectionTitle
          eyebrow="HERO POOL"
          title="Every recorded opponent pick and box score"
          meta={`${profile.heroPool.length} UNIQUE HEROES`}
        />
        {profile.heroPool.length === 0 ? (
          <div className={styles.inlineEmpty}>No opponent picks recorded.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.heroTable}>
              <thead>
                <tr>
                  <th>Hero</th>
                  <th>Picks</th>
                  <th>Record</th>
                  <th>WR</th>
                  <th>First Pick</th>
                  <th>Second Pick</th>
                  <th>Tracked</th>
                  <th>Avg damage</th>
                  <th>Avg gold</th>
                </tr>
              </thead>
              <tbody>
                {profile.heroPool.map((hero) => (
                  <tr key={hero.name}>
                    <td>
                      <div className={styles.heroCell}>
                        <HeroAvatar
                          name={hero.name}
                          imageUrl={heroVisual(hero.name)?.imageUrl}
                          size="sm"
                        />
                        <strong>{hero.name}</strong>
                      </div>
                    </td>
                    <td><strong>{hero.count}</strong></td>
                    <td>{hero.wins}-{hero.count - hero.wins}</td>
                    <td><b>{Math.round(safeRate(hero.wins, hero.count) * 100)}%</b></td>
                    <td>{hero.blue}</td>
                    <td>{hero.red}</td>
                    <td>{hero.trackedGames || '—'}</td>
                    <td>{hero.trackedGames ? formatMetric(hero.averageDamage) : '—'}</td>
                    <td>{hero.trackedGames ? formatMetric(hero.averageGold) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function SideDraftCard({ draft }: { draft: OpponentSideDraft }) {
  return (
    <article className={styles.sideCard} data-side={draft.side.toLowerCase()}>
      <header>
        <div>
          <span>{draft.side.toUpperCase()} SIDE</span>
          <h4>{draft.side === 'Blue' ? 'Opponent First Pick' : 'Opponent Second Pick'}</h4>
        </div>
        <div>
          <strong>{draft.wins}-{draft.games - draft.wins}</strong>
          <small>{draft.games} games</small>
        </div>
      </header>
      {draft.games === 0 ? (
        <div className={styles.inlineEmpty}>No games recorded on this side.</div>
      ) : (
        <div className={styles.priorityGrid}>
          <PriorityList
            label={draft.openingLabel}
            entries={draft.openingPicks}
            games={draft.games}
          />
          <PriorityList
            label="ALL PICK PRIORITY"
            entries={draft.pickPriority}
            games={draft.games}
          />
          <PriorityList
            label="FIRST-PHASE BAN PRIORITY"
            entries={draft.firstPhaseBans}
            games={draft.games}
          />
        </div>
      )}
    </article>
  );
}

function PriorityList({
  label,
  entries,
  games,
}: {
  label: string;
  entries: CountEntry[];
  games: number;
}) {
  return (
    <section className={styles.priorityList}>
      <h5>{label}</h5>
      {entries.length === 0 ? (
        <p>No recorded data</p>
      ) : (
        <div>
          {entries.slice(0, 6).map((entry) => (
            <article key={entry.name}>
              <HeroAvatar
                name={entry.name}
                imageUrl={heroVisual(entry.name)?.imageUrl}
                size="xs"
              />
              <span>{entry.name}</span>
              <strong>{entry.count}</strong>
              <small>{Math.round(safeRate(entry.count, games) * 100)}%</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.metric}>
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta: string;
}) {
  return (
    <header className={styles.sectionTitle}>
      <div>
        <p>{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      <span>{meta}</span>
    </header>
  );
}

function buildOpponentProfiles(sessions: ScrimSession[]): OpponentProfile[] {
  const groups = new Map<string, ScrimSession[]>();

  sessions.forEach((session) => {
    const name = session.opponent.trim();
    if (!name) return;
    const key = normalize(name);
    groups.set(key, [...(groups.get(key) ?? []), session]);
  });

  return [...groups.entries()]
    .map(([key, group]) => {
      const records: OpponentGameRecord[] = group.flatMap((session) =>
        session.games.map((game) => ({
          key: `${session.id}-${game.id}`,
          date: session.date,
          patch: session.patch,
          game,
        })),
      );
      const games = records.length;
      const opponentWins = records.filter(
        (record) => record.game.result === 'Loss',
      ).length;

      return {
        key,
        name: group[0].opponent,
        sessions: group.length,
        games,
        opponentWins,
        averageDuration: safeRate(
          records.reduce(
            (sum, record) => sum + numeric(record.game.durationMinutes),
            0,
          ),
          games,
        ),
        firstTurtle: buildFirstObjective(records, 'firstTurtle', 'First Turtle'),
        firstLord: buildFirstObjective(records, 'firstLord', 'First Lord'),
        objectives: buildObjectives(records),
        heroPool: buildHeroPool(records),
        players: buildOpponentPlayers(records),
        fullBoxScoreGames: records.filter(
          (record) => record.game.importMeta?.opponentStatsComplete,
        ).length,
        sideDrafts: [
          buildOpponentSideDraft(records, 'Blue'),
          buildOpponentSideDraft(records, 'Red'),
        ],
      };
    })
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
}

function buildHeroPool(records: OpponentGameRecord[]): HeroPoolEntry[] {
  const heroes = new Map<string, HeroPoolEntry>();

  records.forEach((record) => {
    const side = opponentSide(record.game.side);
    uniqueHeroes(record.game.enemyPicks).forEach((name) => {
      const key = normalize(name);
      const entry = heroes.get(key) ?? {
        name,
        count: 0,
        wins: 0,
        blue: 0,
        red: 0,
        trackedGames: 0,
        averageDamage: 0,
        averageGold: 0,
        averageKda: 0,
        playerNames: [],
      };
      entry.count += 1;
      entry.wins += record.game.result === 'Loss' ? 1 : 0;
      entry.blue += side === 'Blue' ? 1 : 0;
      entry.red += side === 'Red' ? 1 : 0;
      heroes.set(key, entry);
    });

    record.game.opponentPlayers?.forEach((player) => {
      const name = canonicalHeroName(player.hero);
      if (!name) return;
      const key = normalize(name);
      const entry = heroes.get(key) ?? {
        name,
        count: 0,
        wins: 0,
        blue: 0,
        red: 0,
        trackedGames: 0,
        averageDamage: 0,
        averageGold: 0,
        averageKda: 0,
        playerNames: [],
      };
      entry.trackedGames += 1;
      entry.averageDamage += player.damageDealt ?? 0;
      entry.averageGold += player.gold ?? 0;
      entry.averageKda += safeRate(
        (player.kills ?? 0) + (player.assists ?? 0),
        Math.max(player.deaths ?? 0, 1),
      );
      const playerName = player.playerName.trim();
      if (
        playerName &&
        !entry.playerNames.some(
          (candidate) => normalize(candidate) === normalize(playerName),
        )
      ) {
        entry.playerNames.push(playerName);
      }
      heroes.set(key, entry);
    });
  });

  return [...heroes.values()]
    .map((entry) => ({
      ...entry,
      averageDamage: safeRate(entry.averageDamage, entry.trackedGames),
      averageGold: safeRate(entry.averageGold, entry.trackedGames),
      averageKda: safeRate(entry.averageKda, entry.trackedGames),
    }))
    .sort(
    (a, b) =>
      b.count - a.count ||
      b.wins - a.wins ||
      a.name.localeCompare(b.name),
    );
}

function buildOpponentPlayers(
  records: OpponentGameRecord[],
): OpponentPlayerProfile[] {
  const players = new Map<
    string,
    {
      key: string;
      name: string;
      games: number;
      wins: number;
      totalDamage: number;
      damageSamples: number;
      totalGold: number;
      goldSamples: number;
      totalKda: number;
      kdaSamples: number;
      heroes: string[];
    }
  >();

  records.forEach((record) => {
    record.game.opponentPlayers?.forEach((player, index) => {
      const cleanName = player.playerName.trim();
      const key = normalize(cleanName) || `unknown-slot-${index}`;
      const entry = players.get(key) ?? {
        key,
        name: cleanName,
        games: 0,
        wins: 0,
        totalDamage: 0,
        damageSamples: 0,
        totalGold: 0,
        goldSamples: 0,
        totalKda: 0,
        kdaSamples: 0,
        heroes: [],
      };
      entry.games += 1;
      entry.wins += record.game.result === 'Loss' ? 1 : 0;
      if (player.damageDealt !== null) {
        entry.totalDamage += player.damageDealt;
        entry.damageSamples += 1;
      }
      if (player.gold !== null) {
        entry.totalGold += player.gold;
        entry.goldSamples += 1;
      }
      if (
        player.kills !== null &&
        player.deaths !== null &&
        player.assists !== null
      ) {
        entry.totalKda += safeRate(
          player.kills + player.assists,
          Math.max(player.deaths, 1),
        );
        entry.kdaSamples += 1;
      }
      if (player.hero.trim()) entry.heroes.push(player.hero.trim());
      players.set(key, entry);
    });
  });

  return [...players.values()]
    .map((player) => ({
      key: player.key,
      name: player.name,
      games: player.games,
      wins: player.wins,
      averageDamage: safeRate(player.totalDamage, player.damageSamples),
      averageGold: safeRate(player.totalGold, player.goldSamples),
      averageKda: safeRate(player.totalKda, player.kdaSamples),
      topHeroes: countValues(player.heroes),
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.averageDamage - a.averageDamage ||
        b.games - a.games,
    );
}

function formatMetric(value: number) {
  return Math.round(value).toLocaleString('en-US');
}

function buildObjectives(records: OpponentGameRecord[]): ObjectiveEntry[] {
  const definitions = [
    { key: 'turtles', label: 'Turtles', opponent: 'turtlesAgainst', ours: 'turtlesFor' },
    { key: 'lords', label: 'Lords', opponent: 'lordsAgainst', ours: 'lordsFor' },
    { key: 'towers', label: 'Towers', opponent: 'towersAgainst', ours: 'towersFor' },
  ] as const;

  return definitions.map((definition) => {
    const opponent = records.reduce(
      (sum, record) => sum + numeric(record.game[definition.opponent]),
      0,
    );
    const ours = records.reduce(
      (sum, record) => sum + numeric(record.game[definition.ours]),
      0,
    );
    return {
      key: definition.key,
      label: definition.label,
      opponent,
      ours,
      control: safeRate(opponent, opponent + ours) * 100,
    };
  });
}

function buildFirstObjective(
  records: OpponentGameRecord[],
  field: 'firstTurtle' | 'firstLord',
  label: string,
): FirstObjectiveEntry {
  const recorded = records.filter((record) => record.game[field] !== 'None');
  const opponent = recorded.filter(
    (record) => record.game[field] === 'Opponent',
  ).length;
  return {
    label,
    recorded: recorded.length,
    opponent,
    rate: safeRate(opponent, recorded.length) * 100,
  };
}

function buildOpponentSideDraft(
  records: OpponentGameRecord[],
  side: 'Blue' | 'Red',
): OpponentSideDraft {
  const sideRecords = records.filter(
    (record) => opponentSide(record.game.side) === side,
  );
  const openingSize = side === 'Blue' ? 1 : 2;
  return {
    side,
    games: sideRecords.length,
    wins: sideRecords.filter((record) => record.game.result === 'Loss').length,
    openingLabel: side === 'Blue' ? 'P1 OPENING PRIORITY' : 'R1—R2 OPENING PRIORITY',
    openingPicks: countValues(
      sideRecords.flatMap((record) => record.game.enemyPicks.slice(0, openingSize)),
    ),
    pickPriority: countValues(
      sideRecords.flatMap((record) => record.game.enemyPicks),
    ),
    firstPhaseBans: countValues(
      sideRecords.flatMap((record) => record.game.enemyBans.slice(0, 3)),
    ),
  };
}

function countValues(values: string[]): CountEntry[] {
  const counts = new Map<string, CountEntry>();
  values.forEach((rawName) => {
    const name = canonicalHeroName(rawName);
    if (!name) return;
    const key = normalize(name);
    const entry = counts.get(key) ?? { name, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  });
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

function uniqueHeroes(values: string[]) {
  const heroes = new Map<string, string>();
  values.forEach((value) => {
    const name = canonicalHeroName(value);
    if (name) heroes.set(normalize(name), name);
  });
  return [...heroes.values()];
}

function opponentSide(ourSide: ScrimSide): 'Blue' | 'Red' {
  return ourSide === 'Blue' ? 'Red' : 'Blue';
}

function heroVisual(name: string) {
  return heroVisuals.get(normalize(name));
}

function canonicalHeroName(value: string) {
  const clean = value.trim();
  return normalize(clean) === 'wu zetian' ? 'Zetian' : clean;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
