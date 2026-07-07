import type { DraftStep, DraftPhase } from '@/types';

/**
 * MPL Competitive Draft Sequence (20 steps)
 *
 * Phase 1 Bans  (steps 0-5):   Blue, Red, Blue, Red, Blue, Red
 * Phase 1 Picks (steps 6-11):  Blue(1), Red(1), Red(2), Blue(2), Blue(3), Red(3)
 * Phase 2 Bans  (steps 12-15): Red, Blue, Red, Blue
 * Phase 2 Picks (steps 16-19): Red(4), Blue(4), Blue(5), Red(5)
 */
export const DRAFT_SEQUENCE: DraftStep[] = [
  // ── Phase 1 Bans ──
  { index: 0,  action: 'ban',  side: 'blue', phase: 1, label: 'Blue Ban 1' },
  { index: 1,  action: 'ban',  side: 'red',  phase: 1, label: 'Red Ban 1' },
  { index: 2,  action: 'ban',  side: 'blue', phase: 1, label: 'Blue Ban 2' },
  { index: 3,  action: 'ban',  side: 'red',  phase: 1, label: 'Red Ban 2' },
  { index: 4,  action: 'ban',  side: 'blue', phase: 1, label: 'Blue Ban 3' },
  { index: 5,  action: 'ban',  side: 'red',  phase: 1, label: 'Red Ban 3' },

  // ── Phase 1 Picks ──
  { index: 6,  action: 'pick', side: 'blue', phase: 1, label: 'Blue Pick 1' },
  { index: 7,  action: 'pick', side: 'red',  phase: 1, label: 'Red Pick 1' },
  { index: 8,  action: 'pick', side: 'red',  phase: 1, label: 'Red Pick 2' },
  { index: 9,  action: 'pick', side: 'blue', phase: 1, label: 'Blue Pick 2' },
  { index: 10, action: 'pick', side: 'blue', phase: 1, label: 'Blue Pick 3' },
  { index: 11, action: 'pick', side: 'red',  phase: 1, label: 'Red Pick 3' },

  // ── Phase 2 Bans ──
  { index: 12, action: 'ban',  side: 'red',  phase: 2, label: 'Red Ban 4' },
  { index: 13, action: 'ban',  side: 'blue', phase: 2, label: 'Blue Ban 4' },
  { index: 14, action: 'ban',  side: 'red',  phase: 2, label: 'Red Ban 5' },
  { index: 15, action: 'ban',  side: 'blue', phase: 2, label: 'Blue Ban 5' },

  // ── Phase 2 Picks ──
  { index: 16, action: 'pick', side: 'red',  phase: 2, label: 'Red Pick 4' },
  { index: 17, action: 'pick', side: 'blue', phase: 2, label: 'Blue Pick 4' },
  { index: 18, action: 'pick', side: 'blue', phase: 2, label: 'Blue Pick 5' },
  { index: 19, action: 'pick', side: 'red',  phase: 2, label: 'Red Pick 5' },
];

/**
 * Determine the current draft phase from a step index.
 *
 * - 0-5   → ban-phase-1
 * - 6-11  → pick-phase-1
 * - 12-15 → ban-phase-2
 * - 16-19 → pick-phase-2
 * - ≥ 20  → complete
 */
export function getPhaseForStep(stepIndex: number): DraftPhase {
  if (stepIndex < 0) return 'ban-phase-1';
  if (stepIndex <= 5) return 'ban-phase-1';
  if (stepIndex <= 11) return 'pick-phase-1';
  if (stepIndex <= 15) return 'ban-phase-2';
  if (stepIndex <= 19) return 'pick-phase-2';
  return 'complete';
}
