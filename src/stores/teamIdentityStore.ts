'use client';

import { create } from 'zustand';
import type {
  Hero,
  TeamIdentity,
  DraftWarning,
  PlaystyleType,
} from '@/types';
import { db } from '@/lib/db';

// ────────────────────────────────────────────────
// State shape
// ────────────────────────────────────────────────
interface TeamIdentityState {
  identity: TeamIdentity | null;
  warnings: DraftWarning[];
}

// ────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────
interface TeamIdentityActions {
  /** Load the first (primary) team identity from the database. */
  loadIdentity: () => Promise<void>;
  /** Persist the current identity to IndexedDB. */
  saveIdentity: (identity: Omit<TeamIdentity, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  /**
   * Analyse a completed (or in-progress) draft and produce warnings.
   *
   * @param bluePicks – hero IDs on blue side
   * @param redPicks  – hero IDs on red side  (for symmetry / opponent analysis)
   * @param heroes    – full hero catalogue so we can inspect roles & damage
   */
  analyzeDraft: (bluePicks: number[], redPicks: number[], heroes: Hero[]) => void;
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

/** Resolve hero objects from a list of IDs. */
function resolveHeroes(ids: number[], allHeroes: Hero[]): Hero[] {
  const map = new Map(allHeroes.map((h) => [h.id, h]));
  return ids.map((id) => map.get(id)).filter(Boolean) as Hero[];
}

/**
 * Core analysis engine.
 * Evaluates a set of picked heroes and the team identity to produce
 * actionable warnings for the analyst.
 */
function generateWarnings(picks: Hero[], identity: TeamIdentity | null): DraftWarning[] {
  const warnings: DraftWarning[] = [];

  if (picks.length === 0) return warnings;

  // ── Roles present ──
  const roles = new Set(picks.map((h) => h.role));
  const secondaryRoles = new Set(picks.filter((h) => h.secondaryRole).map((h) => h.secondaryRole));
  const allRoles = new Set([...roles, ...secondaryRoles]);

  // ── Engage check ──
  const hasEngage = picks.some(
    (h) =>
      h.teamfightStyle === 'Engage' ||
      h.role === 'Tank' ||
      h.secondaryRole === 'Tank',
  );
  if (!hasEngage && picks.length >= 3) {
    warnings.push({
      type: 'warning',
      message: 'Current draft lacks engage',
      category: 'engage',
    });
  }

  // ── Frontline check ──
  const hasTank = allRoles.has('Tank');
  if (!hasTank && picks.length >= 3) {
    warnings.push({
      type: 'danger',
      message: 'Weak frontline — no Tank role picked',
      category: 'frontline',
    });
  }

  // ── Damage profile ──
  const magicHeroes = picks.filter((h) => h.damageType === 'Magic');
  const physicalHeroes = picks.filter((h) => h.damageType === 'Physical');

  if (magicHeroes.length >= 3) {
    warnings.push({
      type: 'warning',
      message: `Damage profile too magic-heavy (${magicHeroes.length} magic heroes)`,
      category: 'damage',
    });
  }
  if (physicalHeroes.length >= 3) {
    warnings.push({
      type: 'warning',
      message: `Damage profile too physical-heavy (${physicalHeroes.length} physical heroes)`,
      category: 'damage',
    });
  }

  // ── Scaling balance ──
  const earlyCount = picks.filter((h) => h.scalingType === 'Early').length;
  const lateCount = picks.filter((h) => h.scalingType === 'Late').length;

  if (earlyCount === picks.length && picks.length >= 3) {
    warnings.push({
      type: 'warning',
      message: 'Poor scaling balance — all early-game heroes, will fall off late',
      category: 'scaling',
    });
  }
  if (lateCount === picks.length && picks.length >= 3) {
    warnings.push({
      type: 'info',
      message: 'Full late-game scaling comp — early game will be vulnerable',
      category: 'scaling',
    });
  }

  // ── Identity deviation check ──
  if (identity && picks.length >= 3) {
    const playstyleMatchMap: Record<PlaystyleType, (h: Hero) => boolean> = {
      'Teamfight Heavy': (h) => h.teamfightStyle === 'Engage' || h.teamfightStyle === 'Protect',
      'Front-to-Back': (h) => h.role === 'Tank' || h.role === 'Marksman' || h.teamfightStyle === 'Protect',
      'Pickoff': (h) => h.role === 'Assassin' || h.teamfightStyle === 'Burst',
      'Dive Composition': (h) => h.teamfightStyle === 'Dive' || h.teamfightStyle === 'Engage',
      'Early Invade': (h) => h.scalingType === 'Early',
      'Scaling': (h) => h.scalingType === 'Late' || h.scalingType === 'Mid',
      'Split Push': (h) => h.teamfightStyle === 'Split',
      'Poke': (h) => h.teamfightStyle === 'Poke',
    };

    const identityPlaystyles = identity.playstyles;
    if (identityPlaystyles.length > 0) {
      // Count how many picks match ANY of the team's declared playstyles
      const matchCount = picks.filter((h) =>
        identityPlaystyles.some((ps) => playstyleMatchMap[ps]?.(h)),
      ).length;

      const matchRatio = matchCount / picks.length;
      if (matchRatio < 0.4) {
        warnings.push({
          type: 'warning',
          message: `Draft deviates from identity — only ${matchCount}/${picks.length} picks align with team playstyle (${identityPlaystyles.join(', ')})`,
          category: 'identity',
        });
      }
    }

    // Scaling preference check
    if (identity.scalingPreference === 'Early' && lateCount > earlyCount && picks.length >= 3) {
      warnings.push({
        type: 'info',
        message: 'Draft leans late-game but team prefers early aggression',
        category: 'identity',
      });
    }
    if (identity.scalingPreference === 'Late' && earlyCount > lateCount && picks.length >= 3) {
      warnings.push({
        type: 'info',
        message: 'Draft leans early-game but team prefers late scaling',
        category: 'identity',
      });
    }

    // Engage level check
    const engageHeroes = picks.filter(
      (h) => h.teamfightStyle === 'Engage' || h.teamfightStyle === 'Dive',
    );
    if (identity.engageLevel === 'High' && engageHeroes.length === 0 && picks.length >= 3) {
      warnings.push({
        type: 'danger',
        message: 'Team identity requires high engage, but draft has no engage heroes',
        category: 'identity',
      });
    }

    // Frontline requirement check
    if (identity.frontlineRequirement === 'Strong' && !hasTank && picks.length >= 4) {
      warnings.push({
        type: 'danger',
        message: 'Team requires strong frontline but no Tank has been drafted',
        category: 'identity',
      });
    }
  }

  return warnings;
}

// ────────────────────────────────────────────────
// Store
// ────────────────────────────────────────────────
export const useTeamIdentityStore = create<TeamIdentityState & TeamIdentityActions>()(
  (set, get) => ({
    identity: null,
    warnings: [],

    async loadIdentity() {
      if (!db) return;
      const identities = await db.teamIdentities.toArray();
      if (identities.length > 0) {
        set({ identity: identities[0] });
      }
    },

    async saveIdentity(data) {
      if (!db) return;

      const now = new Date();
      const existing = get().identity;

      if (existing?.id) {
        // Update in place
        const updated: TeamIdentity = {
          ...existing,
          ...data,
          updatedAt: now,
        };
        await db.teamIdentities.put(updated);
        set({ identity: updated });
      } else {
        // Create new
        const newIdentity: Omit<TeamIdentity, 'id'> = {
          ...data,
          createdAt: now,
          updatedAt: now,
        };
        const id = await db.teamIdentities.add(newIdentity as TeamIdentity);
        set({ identity: { ...newIdentity, id } as TeamIdentity });
      }
    },

    analyzeDraft(bluePicks: number[], _redPicks: number[], heroes: Hero[]) {
      const blueHeroes = resolveHeroes(bluePicks, heroes);
      const warnings = generateWarnings(blueHeroes, get().identity);
      set({ warnings });
    },
  }),
);
