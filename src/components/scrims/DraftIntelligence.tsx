'use client';

import { useMemo } from 'react';
import { HERO_DATA } from '@/data/heroData';
import HeroAvatar from '@/components/ui/HeroAvatar';
import { safeRate, type ScrimGame, type ScrimSession } from '@/lib/scrimDatabase';
import styles from './DraftIntelligence.module.css';

export interface DraftRecommendationContext {
  owner: 'our' | 'enemy';
  kind: 'pick' | 'ban';
  slot: number;
  phase: 1 | 2;
}

interface DraftIntelligenceProps {
  sessions: ScrimSession[];
  game: ScrimGame;
  opponent: string;
  patch: string;
  context: DraftRecommendationContext | null;
}

interface GameRecord {
  session: ScrimSession;
  game: ScrimGame;
}

interface HeroSuggestion {
  name: string;
  score: number;
  sample: number;
  wins: number;
  reason: string;
}

interface ThreatMemory {
  key: string;
  playerName: string;
  hero: string;
  games: number;
  opponentWins: number;
  averageDamage: number;
  averageGold: number;
}

const HERO_VISUALS = new Map(
  HERO_DATA.flatMap((hero) => [
    [normalize(hero.name), hero],
    [normalize(hero.slug), hero],
  ]),
);

export default function DraftIntelligence({
  sessions,
  game,
  opponent,
  patch,
  context,
}: DraftIntelligenceProps) {
  const intelligence = useMemo(
    () => buildIntelligence(sessions, game, opponent, patch, context),
    [context, game, opponent, patch, sessions],
  );

  return (
    <aside className={styles.panel}>
      <header>
        <div>
          <span>DRAFT DATA ASSISTANT</span>
          <h4>{intelligence.title}</h4>
          <p>{intelligence.scopeLabel}</p>
        </div>
        <span className={styles.sampleBadge}>
          {intelligence.scopeGames} GAME SAMPLE
        </span>
      </header>

      <div className={styles.recommendationGrid}>
        <section>
          <h5>{intelligence.primaryLabel}</h5>
          {intelligence.suggestions.length === 0 ? (
            <div className={styles.empty}>
              Belum ada sampel yang cocok. Input draft tetap bisa dilanjutkan.
            </div>
          ) : (
            <div className={styles.suggestions}>
              {intelligence.suggestions.map((suggestion, index) => (
                <article key={suggestion.name}>
                  <b>{index + 1}</b>
                  <HeroAvatar
                    name={suggestion.name}
                    imageUrl={heroVisual(suggestion.name)?.imageUrl}
                    size="sm"
                  />
                  <div>
                    <strong>{suggestion.name}</strong>
                    <span>{suggestion.reason}</span>
                  </div>
                  <small data-confidence={confidence(suggestion.sample)}>
                    n={suggestion.sample}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.memory}>
          <h5>OPPONENT MEMORY</h5>
          {intelligence.threats.length === 0 ? (
            <div className={styles.empty}>
              Full opponent box scores will build player + hero threat memory here.
            </div>
          ) : (
            <div>
              {intelligence.threats.slice(0, 4).map((threat) => (
                <article key={threat.key}>
                  <HeroAvatar
                    name={threat.hero}
                    imageUrl={heroVisual(threat.hero)?.imageUrl}
                    size="xs"
                  />
                  <div>
                    <strong>{threat.playerName || 'Unknown player'} · {threat.hero}</strong>
                    <span>
                      {Math.round(threat.averageDamage).toLocaleString()} dmg ·{' '}
                      {threat.opponentWins}-{threat.games - threat.opponentWins} vs us
                    </span>
                  </div>
                  <small>n={threat.games}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer>
        <span>{intelligence.warning}</span>
        <small>Historical evidence—not a guaranteed counter or causal recommendation.</small>
      </footer>
    </aside>
  );
}

function buildIntelligence(
  sessions: ScrimSession[],
  game: ScrimGame,
  opponent: string,
  patch: string,
  context: DraftRecommendationContext | null,
) {
  const allRecords = sessions.flatMap((session) =>
    session.games
      .filter((candidate) => candidate.id !== game.id)
      .map((candidate) => ({ session, game: candidate })),
  );
  const patchRecords = patch.trim()
    ? allRecords.filter(
        (record) => normalize(record.session.patch) === normalize(patch),
      )
    : [];
  const scope = patchRecords.length >= 3 ? patchRecords : allRecords;
  const opponentRecords = scope.filter(
    (record) => normalize(record.session.opponent) === normalize(opponent),
  );
  const relevantOpponentRecords =
    opponentRecords.length > 0 ? opponentRecords : scope;
  const suggestions = context
    ? context.owner === 'our' && context.kind === 'pick'
      ? ourPickSuggestions(scope, game)
      : context.owner === 'our' && context.kind === 'ban'
        ? banSuggestions(relevantOpponentRecords, game)
        : opponentPrediction(relevantOpponentRecords, game, context)
    : [];
  const threats = threatMemory(opponentRecords.length > 0 ? opponentRecords : []);
  const combo = compRecord(scope, game.ourPicks);
  const contextLabel = context
    ? `${context.owner === 'our' ? 'Our' : 'Opponent'} ${context.kind} ${context.slot}`
    : 'Draft complete';

  return {
    title: context ? `${contextLabel} · ranked from saved scrims` : 'Draft review memory',
    primaryLabel:
      context?.owner === 'our'
        ? context.kind === 'pick'
          ? 'OUR PICK OPTIONS'
          : 'BAN OPTIONS'
        : context?.kind === 'pick'
          ? 'LIKELY OPPONENT PICKS'
          : 'LIKELY OPPONENT BANS',
    suggestions: suggestions.slice(0, 4),
    threats,
    scopeGames: scope.length,
    scopeLabel:
      patchRecords.length >= 3
        ? `Patch ${patch} evidence · opponent-specific samples are prioritized`
        : `All-patch fallback · only ${patchRecords.length} game${patchRecords.length === 1 ? '' : 's'} on Patch ${patch || '—'}`,
    warning:
      combo.games > 0
        ? `Current ${game.ourPicks.length}-hero core appeared ${combo.games}×: ${combo.wins}-${combo.games - combo.wins}.`
        : game.ourPicks.length > 1
          ? 'Current hero core has no exact historical sample yet.'
          : 'Samples stay visible so one-off results do not look stronger than they are.',
  };
}

function ourPickSuggestions(records: GameRecord[], current: ScrimGame) {
  const used = usedHeroes(current);
  const selected = current.ourPicks.map(normalize).filter(Boolean);
  const candidates = new Map<string, HeroSuggestion>();

  records.forEach((record) => {
    uniqueHeroes(record.game.ourPicks).forEach((name) => {
      const key = normalize(name);
      if (!key || used.has(key)) return;
      const entry = candidates.get(key) ?? {
        name,
        score: 0,
        sample: 0,
        wins: 0,
        reason: '',
      };
      entry.sample += 1;
      entry.wins += record.game.result === 'Win' ? 1 : 0;
      candidates.set(key, entry);
    });
  });

  return [...candidates.values()]
    .map((entry) => {
      const candidateKey = normalize(entry.name);
      const pairRecords = selected.length
        ? records.filter(
            (record) =>
              record.game.ourPicks.some((hero) => normalize(hero) === candidateKey) &&
              selected.every((hero) =>
                record.game.ourPicks.some((pick) => normalize(pick) === hero),
              ),
          )
        : [];
      const pairWins = pairRecords.filter(
        (record) => record.game.result === 'Win',
      ).length;
      const smoothedWinRate = safeRate(entry.wins + 1, entry.sample + 2);
      const comboRate = pairRecords.length
        ? safeRate(pairWins + 1, pairRecords.length + 2)
        : 0.5;
      return {
        ...entry,
        score:
          smoothedWinRate * 62 +
          comboRate * 24 +
          Math.min(entry.sample, 8) * 2 +
          Math.min(pairRecords.length, 4) * 3,
        reason: `${Math.round(safeRate(entry.wins, entry.sample) * 100)}% WR · ${entry.wins}-${entry.sample - entry.wins}${
          pairRecords.length
            ? ` · core ${pairWins}-${pairRecords.length - pairWins}`
            : ''
        }`,
      };
    })
    .sort((a, b) => b.score - a.score || b.sample - a.sample);
}

function banSuggestions(records: GameRecord[], current: ScrimGame) {
  const used = usedHeroes(current);
  const candidates = new Map<
    string,
    { name: string; games: number; opponentWins: number; totalDamage: number; damageSamples: number }
  >();

  records.forEach((record) => {
    uniqueHeroes(record.game.enemyPicks).forEach((name) => {
      const key = normalize(name);
      if (!key || used.has(key)) return;
      const entry = candidates.get(key) ?? {
        name,
        games: 0,
        opponentWins: 0,
        totalDamage: 0,
        damageSamples: 0,
      };
      entry.games += 1;
      entry.opponentWins += record.game.result === 'Loss' ? 1 : 0;
      const tracked = record.game.opponentPlayers?.find(
        (player) => normalize(player.hero) === key,
      );
      if (tracked?.damageDealt !== null && tracked?.damageDealt !== undefined) {
        entry.totalDamage += tracked.damageDealt;
        entry.damageSamples += 1;
      }
      candidates.set(key, entry);
    });
  });

  return [...candidates.values()]
    .map((entry) => ({
      name: entry.name,
      sample: entry.games,
      wins: entry.opponentWins,
      score:
        safeRate(entry.opponentWins + 1, entry.games + 2) * 68 +
        Math.min(entry.games, 8) * 3 +
        Math.min(safeRate(entry.totalDamage, entry.damageSamples) / 2500, 12),
      reason: `${entry.opponentWins}-${entry.games - entry.opponentWins} vs us${
        entry.damageSamples
          ? ` · ${Math.round(safeRate(entry.totalDamage, entry.damageSamples)).toLocaleString()} avg dmg`
          : ''
      }`,
    }))
    .sort((a, b) => b.score - a.score || b.sample - a.sample);
}

function opponentPrediction(
  records: GameRecord[],
  current: ScrimGame,
  context: DraftRecommendationContext,
) {
  const used = usedHeroes(current);
  const field = context.kind === 'pick' ? 'enemyPicks' : 'enemyBans';
  const candidates = new Map<string, HeroSuggestion>();

  records.forEach((record) => {
    const exact = record.game[field][context.slot - 1];
    uniqueHeroes(record.game[field]).forEach((name) => {
      const key = normalize(name);
      if (!key || used.has(key)) return;
      const entry = candidates.get(key) ?? {
        name,
        score: 0,
        sample: 0,
        wins: 0,
        reason: '',
      };
      entry.sample += 1;
      entry.wins += record.game.result === 'Loss' ? 1 : 0;
      entry.score += normalize(exact) === key ? 7 : 2;
      candidates.set(key, entry);
    });
  });

  return [...candidates.values()]
    .map((entry) => ({
      ...entry,
      score: entry.score + entry.sample * 2 + entry.wins,
      reason: `${entry.sample}× recorded · opponent ${entry.wins}-${entry.sample - entry.wins}`,
    }))
    .sort((a, b) => b.score - a.score || b.sample - a.sample);
}

function threatMemory(records: GameRecord[]): ThreatMemory[] {
  const threats = new Map<
    string,
    ThreatMemory & { totalDamage: number; damageSamples: number; totalGold: number; goldSamples: number }
  >();

  records.forEach((record) => {
    record.game.opponentPlayers?.forEach((player) => {
      const hero = player.hero.trim();
      if (!hero) return;
      const key = `${normalize(player.playerName) || 'unknown'}::${normalize(hero)}`;
      const entry = threats.get(key) ?? {
        key,
        playerName: player.playerName,
        hero,
        games: 0,
        opponentWins: 0,
        averageDamage: 0,
        averageGold: 0,
        totalDamage: 0,
        damageSamples: 0,
        totalGold: 0,
        goldSamples: 0,
      };
      entry.games += 1;
      entry.opponentWins += record.game.result === 'Loss' ? 1 : 0;
      if (player.damageDealt !== null) {
        entry.totalDamage += player.damageDealt;
        entry.damageSamples += 1;
      }
      if (player.gold !== null) {
        entry.totalGold += player.gold;
        entry.goldSamples += 1;
      }
      threats.set(key, entry);
    });
  });

  return [...threats.values()]
    .map((entry) => ({
      ...entry,
      averageDamage: safeRate(entry.totalDamage, entry.damageSamples),
      averageGold: safeRate(entry.totalGold, entry.goldSamples),
    }))
    .sort(
      (a, b) =>
        b.opponentWins - a.opponentWins ||
        b.averageDamage - a.averageDamage ||
        b.games - a.games,
    );
}

function compRecord(records: GameRecord[], picks: string[]) {
  const keys = picks.map(normalize).filter(Boolean);
  const matches = keys.length
    ? records.filter((record) =>
        keys.every((key) =>
          record.game.ourPicks.some((hero) => normalize(hero) === key),
        ),
      )
    : [];
  return {
    games: matches.length,
    wins: matches.filter((record) => record.game.result === 'Win').length,
  };
}

function usedHeroes(game: ScrimGame) {
  return new Set(
    [
      ...game.ourPicks,
      ...game.enemyPicks,
      ...game.ourBans,
      ...game.enemyBans,
    ]
      .map(normalize)
      .filter(Boolean),
  );
}

function uniqueHeroes(values: string[]) {
  const unique = new Map<string, string>();
  values.forEach((value) => {
    const clean = value.trim();
    if (clean) unique.set(normalize(clean), clean);
  });
  return [...unique.values()];
}

function confidence(sample: number) {
  if (sample >= 8) return 'high';
  if (sample >= 3) return 'medium';
  return 'low';
}

function heroVisual(name: string) {
  return HERO_VISUALS.get(normalize(name));
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
