'use client';

import { useId, useMemo, useState } from 'react';
import HeroAvatar from '@/components/ui/HeroAvatar';
import { HERO_DATA } from '@/data/heroData';
import {
  safeRate,
  type ScrimResult,
  type ScrimRole,
  type ScrimSession,
} from '@/lib/scrimDatabase';
import styles from './PlayerPerformance.module.css';

interface PlayerPerformanceProps {
  sessions: ScrimSession[];
}

interface RecentGame {
  id: string;
  timestamp: string;
  date: string;
  opponent: string;
  gameNumber: number;
  result: ScrimResult;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
}

interface HeroPerformance {
  name: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  minutes: number;
  teamKills: number;
  gold: number;
  damage: number;
  damageTaken: number;
  turretDamage: number;
  kda: number;
  kp: number;
  gpm: number;
  dpm: number;
  dtpm: number;
  turretDpm: number;
}

interface PlayerProfile {
  key: string;
  name: string;
  role: ScrimRole;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  minutes: number;
  teamKills: number;
  gold: number;
  damage: number;
  damageTaken: number;
  turretDamage: number;
  kda: number;
  kp: number;
  gpm: number;
  dpm: number;
  dtpm: number;
  turretDpm: number;
  heroPool: HeroPerformance[];
  recentGames: RecentGame[];
}

interface AggregateBucket {
  name: string;
  role: ScrimRole;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  minutes: number;
  teamKills: number;
  gold: number;
  damage: number;
  damageTaken: number;
  turretDamage: number;
  heroes: Map<string, HeroBucket>;
  recentGames: RecentGame[];
}

interface HeroBucket {
  name: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  minutes: number;
  teamKills: number;
  gold: number;
  damage: number;
  damageTaken: number;
  turretDamage: number;
}

interface RadarMetric {
  key: string;
  label: string;
  detail: string;
  raw: string;
  score: number;
}

const numberFormat = new Intl.NumberFormat('en-US');
const compactFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const HERO_VISUALS = new Map(
  HERO_DATA.flatMap((hero) => [
    [normalizeName(hero.name), hero],
    [normalizeName(hero.slug), hero],
  ]),
);

export default function PlayerPerformance({ sessions }: PlayerPerformanceProps) {
  const profiles = useMemo(() => buildPlayerProfiles(sessions), [sessions]);
  const [selectedKey, setSelectedKey] = useState('');
  const activeProfile =
    profiles.find((profile) => profile.key === selectedKey) ?? profiles[0] ?? null;

  return (
    <section className={styles.performance}>
      <header className={styles.heading}>
        <div>
          <p>PLAYER PERFORMANCE</p>
          <h2>Turn box scores into player profiles.</h2>
        </div>
        <div className={styles.context}>
          <span>{profiles.length} PLAYER PROFILES</span>
          <small>Radar compares the current scrim roster, not every MLBB role.</small>
        </div>
      </header>

      {profiles.length === 0 || !activeProfile ? (
        <div className={styles.empty}>
          <span>NO SAMPLE YET</span>
          <h3>Player profiles will build themselves.</h3>
          <p>
            Fill player names, heroes, and box scores in Match Input. Radar and
            hero-pool evidence will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <nav className={styles.playerPicker} aria-label="Choose player profile">
            {profiles.map((profile) => (
              <button
                type="button"
                key={profile.key}
                className={profile.key === activeProfile.key ? styles.activePlayer : ''}
                aria-pressed={profile.key === activeProfile.key}
                onClick={() => setSelectedKey(profile.key)}
              >
                <span>{profile.role}</span>
                <strong>{profile.name}</strong>
                <small>
                  {profile.games} games · {profile.wins}-{profile.games - profile.wins}
                </small>
                <b>{profile.kda.toFixed(1)} KDA</b>
              </button>
            ))}
          </nav>

          <PlayerProfileView profile={activeProfile} profiles={profiles} />
        </>
      )}
    </section>
  );
}

function PlayerProfileView({
  profile,
  profiles,
}: {
  profile: PlayerProfile;
  profiles: PlayerProfile[];
}) {
  const radarMetrics = buildRadarMetrics(profile, profiles);
  const topHero = profile.heroPool[0];
  const winRate = safeRate(profile.wins, profile.games) * 100;

  return (
    <div className={styles.profile}>
      <header className={styles.profileHero}>
        <div className={styles.identity}>
          <span className={styles.initials}>{initials(profile.name)}</span>
          <div>
            <span className={styles.roleBadge}>{profile.role}</span>
            <h3>{profile.name}</h3>
            <p>
              {topHero
                ? `${topHero.name} most played · ${profile.heroPool.length} hero pool`
                : 'Hero pool starts after heroes are assigned in Match Input'}
            </p>
          </div>
        </div>
        <div className={styles.sampleBadge}>
          <span>CURRENT SAMPLE</span>
          <strong>{profile.games}</strong>
          <small>scrim games</small>
        </div>
      </header>

      <section className={styles.scoreGrid}>
        <Score label="Record" value={`${profile.wins}-${profile.games - profile.wins}`} detail={`${Math.round(winRate)}% win rate`} />
        <Score label="KDA" value={profile.kda.toFixed(2)} detail={`${average(profile.kills, profile.games)} / ${average(profile.deaths, profile.games)} / ${average(profile.assists, profile.games)}`} />
        <Score label="Kill participation" value={`${Math.round(profile.kp)}%`} detail={`${profile.kills + profile.assists} involvements`} />
        <Score label="Gold / min" value={Math.round(profile.gpm)} detail={`${compactFormat.format(profile.gold)} total gold`} />
        <Score label="Damage / min" value={numberFormat.format(Math.round(profile.dpm))} detail={`${compactFormat.format(profile.damage)} dealt`} />
        <Score label="Taken / min" value={numberFormat.format(Math.round(profile.dtpm))} detail={`${compactFormat.format(profile.damageTaken)} absorbed`} />
      </section>

      <div className={styles.analysisGrid}>
        <section className={styles.radarCard}>
          <div className={styles.cardHeading}>
            <div>
              <p>ROSTER-RELATIVE SHAPE</p>
              <h4>How this player impacts scrims</h4>
            </div>
            <span>0—100</span>
          </div>
          <PerformanceRadar playerName={profile.name} metrics={radarMetrics} />
          <p className={styles.radarNote}>
            A wider axis means more recorded output versus teammates. DTPM shows
            frontline load, not automatically good or bad performance.
          </p>
        </section>

        <section className={styles.outputCard}>
          <div className={styles.cardHeading}>
            <div>
              <p>OUTPUT BREAKDOWN</p>
              <h4>Exact metrics behind the shape</h4>
            </div>
            <span>{profile.role}</span>
          </div>
          <div className={styles.metricBars}>
            {radarMetrics.map((metric) => (
              <div className={styles.metricBar} key={metric.key}>
                <div>
                  <span>{metric.label}</span>
                  <strong>{metric.raw}</strong>
                </div>
                <div className={styles.barTrack}>
                  <i style={{ width: `${metric.score}%` }} />
                </div>
                <small>{metric.detail}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <HeroPool profile={profile} />
      <RecentForm games={profile.recentGames} />
    </div>
  );
}

function Score({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className={styles.score}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PerformanceRadar({
  playerName,
  metrics,
}: {
  playerName: string;
  metrics: RadarMetric[];
}) {
  const titleId = useId();
  const size = 390;
  const center = size / 2;
  const radius = 116;
  const labelRadius = 153;
  const levels = [20, 40, 60, 80, 100];
  const angleFor = (index: number) =>
    -Math.PI / 2 + (Math.PI * 2 * index) / metrics.length;
  const pointAt = (index: number, value: number, customRadius = radius) => {
    const angle = angleFor(index);
    const scaledRadius = customRadius * (value / 100);
    return {
      x: center + Math.cos(angle) * scaledRadius,
      y: center + Math.sin(angle) * scaledRadius,
    };
  };
  const polygon = (value: number) =>
    metrics
      .map((_, index) => {
        const point = pointAt(index, value);
        return `${point.x},${point.y}`;
      })
      .join(' ');
  const dataPolygon = metrics
    .map((metric, index) => {
      const point = pointAt(index, metric.score);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <figure className={styles.radar}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{playerName} scrim performance radar</title>
        {levels.map((level) => (
          <polygon
            key={level}
            points={polygon(level)}
            className={level === 100 ? styles.radarOuter : styles.radarGrid}
          />
        ))}
        {metrics.map((metric, index) => {
          const outer = pointAt(index, 100);
          return (
            <line
              key={metric.key}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              className={styles.radarAxis}
            />
          );
        })}
        <polygon points={dataPolygon} className={styles.radarArea} />
        {metrics.map((metric, index) => {
          const point = pointAt(index, metric.score);
          const label = pointAt(index, 100, labelRadius);
          const anchor =
            label.x < center - 18
              ? 'end'
              : label.x > center + 18
                ? 'start'
                : 'middle';
          return (
            <g key={metric.key}>
              <circle cx={point.x} cy={point.y} r="4" className={styles.radarPoint} />
              <text
                x={label.x}
                y={label.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={styles.radarLabel}
              >
                {metric.label}
              </text>
              <text
                x={label.x}
                y={label.y + 13}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={styles.radarValue}
              >
                {Math.round(metric.score)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function HeroPool({ profile }: { profile: PlayerProfile }) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionTitle}>
        <div>
          <p>HERO POOL</p>
          <h4>{profile.heroPool.length} heroes used across {profile.games} games</h4>
        </div>
        <span>Sorted by sample</span>
      </div>

      {profile.heroPool.length === 0 ? (
        <div className={styles.inlineEmpty}>
          Assign a hero to each player in Match Input to build this pool.
        </div>
      ) : (
        <div className={styles.heroGrid}>
          {profile.heroPool.map((hero, index) => {
            const visual = heroVisual(hero.name);
            const gameShare = safeRate(hero.games, profile.games) * 100;
            return (
              <article className={styles.heroCard} key={hero.name}>
                <div className={styles.heroCardHead}>
                  <span className={styles.heroRank}>{String(index + 1).padStart(2, '0')}</span>
                  <HeroAvatar
                    name={hero.name}
                    imageUrl={visual?.imageUrl}
                    size="lg"
                    className={styles.heroAvatar}
                  />
                  <div>
                    <strong>{hero.name}</strong>
                    <small>{visual?.role ?? profile.role} · {Math.round(gameShare)}% pick share</small>
                  </div>
                  <b>{Math.round(safeRate(hero.wins, hero.games) * 100)}% WR</b>
                </div>
                <div className={styles.heroStats}>
                  <span><small>GAMES</small><b>{hero.games}</b></span>
                  <span><small>RECORD</small><b>{hero.wins}-{hero.games - hero.wins}</b></span>
                  <span><small>KDA</small><b>{hero.kda.toFixed(1)}</b></span>
                  <span><small>KP</small><b>{Math.round(hero.kp)}%</b></span>
                  <span><small>GPM</small><b>{Math.round(hero.gpm)}</b></span>
                  <span><small>DPM</small><b>{numberFormat.format(Math.round(hero.dpm))}</b></span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecentForm({ games }: { games: RecentGame[] }) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionTitle}>
        <div>
          <p>RECENT FORM</p>
          <h4>Latest games behind the profile</h4>
        </div>
        <span>Newest first</span>
      </div>
      <div className={styles.recentList}>
        {games.slice(0, 6).map((game) => {
          const visual = heroVisual(game.hero);
          return (
            <article key={game.id}>
              <time>{formatDate(game.date)}</time>
              <div className={styles.recentOpponent}>
                <strong>{game.opponent || 'Untitled scrim'}</strong>
                <small>Game {game.gameNumber}</small>
              </div>
              <span className={game.result === 'Win' ? styles.win : styles.loss}>
                {game.result.toUpperCase()}
              </span>
              <div className={styles.recentHero}>
                <HeroAvatar
                  name={game.hero || '—'}
                  imageUrl={visual?.imageUrl}
                  size="sm"
                />
                <span>{game.hero || 'Hero not set'}</span>
              </div>
              <b>{game.kills} / {game.deaths} / {game.assists}</b>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function buildRadarMetrics(
  profile: PlayerProfile,
  profiles: PlayerProfile[],
): RadarMetric[] {
  const definitions: Array<{
    key: keyof Pick<PlayerProfile, 'kda' | 'kp' | 'gpm' | 'dpm' | 'dtpm' | 'turretDpm'>;
    label: string;
    detail: string;
    format: (value: number) => string;
  }> = [
    { key: 'kda', label: 'KDA', detail: 'fight efficiency', format: (value) => value.toFixed(2) },
    { key: 'kp', label: 'KP', detail: 'team kill involvement', format: (value) => `${Math.round(value)}%` },
    { key: 'gpm', label: 'GPM', detail: 'resource conversion', format: (value) => numberFormat.format(Math.round(value)) },
    { key: 'dpm', label: 'DPM', detail: 'damage pressure', format: (value) => numberFormat.format(Math.round(value)) },
    { key: 'dtpm', label: 'DTPM', detail: 'frontline load', format: (value) => numberFormat.format(Math.round(value)) },
    { key: 'turretDpm', label: 'TOWER', detail: 'objective pressure / min', format: (value) => numberFormat.format(Math.round(value)) },
  ];

  return definitions.map((definition) => {
    const value = profile[definition.key];
    const max = Math.max(...profiles.map((item) => item[definition.key]), 0);
    return {
      key: definition.key,
      label: definition.label,
      detail: definition.detail,
      raw: definition.format(value),
      score: max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0,
    };
  });
}

function buildPlayerProfiles(sessions: ScrimSession[]): PlayerProfile[] {
  const buckets = new Map<string, AggregateBucket>();

  sessions.forEach((session) => {
    session.games.forEach((game) => {
      const minutes = Math.max(Number(game.durationMinutes) || 0, 1);
      const teamKills = Math.max(Number(game.teamKills) || 0, 0);

      game.players.forEach((player) => {
        const name = player.playerName.trim();
        if (!name) return;
        const key = `${normalizeName(name)}-${player.role.toLowerCase()}`;
        const bucket = buckets.get(key) ?? {
          name,
          role: player.role,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          minutes: 0,
          teamKills: 0,
          gold: 0,
          damage: 0,
          damageTaken: 0,
          turretDamage: 0,
          heroes: new Map<string, HeroBucket>(),
          recentGames: [],
        };
        const won = game.result === 'Win';
        const kills = Number(player.kills) || 0;
        const deaths = Number(player.deaths) || 0;
        const assists = Number(player.assists) || 0;
        const gold = Number(player.gold) || 0;
        const damage = Number(player.damageDealt) || 0;
        const damageTaken = Number(player.damageTaken) || 0;
        const turretDamage = Number(player.turretDamage) || 0;

        bucket.games += 1;
        bucket.wins += won ? 1 : 0;
        bucket.kills += kills;
        bucket.deaths += deaths;
        bucket.assists += assists;
        bucket.minutes += minutes;
        bucket.teamKills += teamKills;
        bucket.gold += gold;
        bucket.damage += damage;
        bucket.damageTaken += damageTaken;
        bucket.turretDamage += turretDamage;
        bucket.recentGames.push({
          id: `${session.id}-${game.id}-${player.id}`,
          timestamp: `${session.date || '0000-00-00'}T${session.time || '00:00'}-${String(game.number).padStart(3, '0')}`,
          date: session.date,
          opponent: session.opponent,
          gameNumber: game.number,
          result: game.result,
          hero: player.hero.trim(),
          kills,
          deaths,
          assists,
        });

        const heroName = player.hero.trim();
        if (heroName) {
          const heroKey = normalizeName(heroName);
          const hero = bucket.heroes.get(heroKey) ?? {
            name: heroName,
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            minutes: 0,
            teamKills: 0,
            gold: 0,
            damage: 0,
            damageTaken: 0,
            turretDamage: 0,
          };
          hero.games += 1;
          hero.wins += won ? 1 : 0;
          hero.kills += kills;
          hero.deaths += deaths;
          hero.assists += assists;
          hero.minutes += minutes;
          hero.teamKills += teamKills;
          hero.gold += gold;
          hero.damage += damage;
          hero.damageTaken += damageTaken;
          hero.turretDamage += turretDamage;
          bucket.heroes.set(heroKey, hero);
        }

        buckets.set(key, bucket);
      });
    });
  });

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      name: bucket.name,
      role: bucket.role,
      games: bucket.games,
      wins: bucket.wins,
      kills: bucket.kills,
      deaths: bucket.deaths,
      assists: bucket.assists,
      minutes: bucket.minutes,
      teamKills: bucket.teamKills,
      gold: bucket.gold,
      damage: bucket.damage,
      damageTaken: bucket.damageTaken,
      turretDamage: bucket.turretDamage,
      kda: (bucket.kills + bucket.assists) / Math.max(bucket.deaths, 1),
      kp: safeRate(bucket.kills + bucket.assists, bucket.teamKills) * 100,
      gpm: safeRate(bucket.gold, bucket.minutes),
      dpm: safeRate(bucket.damage, bucket.minutes),
      dtpm: safeRate(bucket.damageTaken, bucket.minutes),
      turretDpm: safeRate(bucket.turretDamage, bucket.minutes),
      heroPool: [...bucket.heroes.values()]
        .map(buildHeroPerformance)
        .sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name)),
      recentGames: bucket.recentGames.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    }))
    .sort((a, b) => b.games - a.games || b.dpm - a.dpm || a.name.localeCompare(b.name));
}

function buildHeroPerformance(hero: HeroBucket): HeroPerformance {
  return {
    ...hero,
    kda: (hero.kills + hero.assists) / Math.max(hero.deaths, 1),
    kp: safeRate(hero.kills + hero.assists, hero.teamKills) * 100,
    gpm: safeRate(hero.gold, hero.minutes),
    dpm: safeRate(hero.damage, hero.minutes),
    dtpm: safeRate(hero.damageTaken, hero.minutes),
    turretDpm: safeRate(hero.turretDamage, hero.minutes),
  };
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function heroVisual(name: string) {
  const normalized = normalizeName(name === 'Wu Zetian' ? 'Zetian' : name);
  const hero = HERO_VISUALS.get(normalized);
  if (!hero) return null;
  return {
    ...hero,
    imageUrl: `/images/heroes/avatars/${hero.slug}.webp`,
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function average(value: number, games: number) {
  return safeRate(value, games).toFixed(1);
}

function formatDate(value: string) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  }).format(new Date(`${value}T00:00:00`));
}
