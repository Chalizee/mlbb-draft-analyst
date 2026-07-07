'use client';

import { create } from 'zustand';
import type {
  DraftStep,
  DraftAction,
  DraftFormat,
  DraftPhase,
  DraftSession,
} from '@/types';
import { DRAFT_SEQUENCE, getPhaseForStep } from '@/data/draftSequence';
import { db } from '@/lib/db';

// ────────────────────────────────────────────────
// State shape
// ────────────────────────────────────────────────
interface DraftState {
  /** Current step index (0-19, or 20 when complete). */
  currentStep: number;
  blueBans: number[];
  redBans: number[];
  bluePicks: number[];
  redPicks: number[];
  /** Hero the user is currently hovering / selecting before confirming. */
  selectedHeroId: number | null;
  /** Full ordered history of confirmed draft actions. */
  draftHistory: DraftAction[];
  format: DraftFormat;
  isComplete: boolean;
  blueSideName: string;
  redSideName: string;
}

// ────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────
interface DraftActions {
  /** Tentatively select a hero (before confirming). */
  selectHero: (heroId: number) => void;
  /** Confirm the current selection — advances the draft by one step. */
  confirmSelection: () => void;
  /** Undo the last confirmed step. */
  undoStep: () => void;
  /** Reset the entire draft to its initial state. */
  resetDraft: () => void;
  /** Switch draft format. */
  setFormat: (format: DraftFormat) => void;
  /** Set team names for both sides. */
  setSideNames: (blue: string, red: string) => void;
  /** Persist the current draft to IndexedDB and return the saved id. */
  saveDraft: () => Promise<number | undefined>;

  // ── Computed helpers ──
  /** Return the `DraftStep` descriptor for the current index. */
  getCurrentStep: () => DraftStep | null;
  /** Return the current draft phase. */
  getPhase: () => DraftPhase;
  /** Return every hero id already picked or banned. */
  getUsedHeroIds: () => number[];
  /** Check whether a hero is still available. */
  isHeroAvailable: (heroId: number) => boolean;
}

// ────────────────────────────────────────────────
// Initial state factory
// ────────────────────────────────────────────────
function initialState(): DraftState {
  return {
    currentStep: 0,
    blueBans: [],
    redBans: [],
    bluePicks: [],
    redPicks: [],
    selectedHeroId: null,
    draftHistory: [],
    format: 'standard',
    isComplete: false,
    blueSideName: 'Blue Side',
    redSideName: 'Red Side',
  };
}

// ────────────────────────────────────────────────
// Store
// ────────────────────────────────────────────────
export const useDraftStore = create<DraftState & DraftActions>()((set, get) => ({
  ...initialState(),

  // ── Actions ────────────────────────────────

  selectHero(heroId: number) {
    set({ selectedHeroId: heroId });
  },

  confirmSelection() {
    const { currentStep, selectedHeroId, isComplete } = get();
    if (selectedHeroId === null || isComplete) return;

    const step = DRAFT_SEQUENCE[currentStep];
    if (!step) return;

    // Verify the hero isn't already used
    if (!get().isHeroAvailable(selectedHeroId)) return;

    const action: DraftAction = {
      step,
      heroId: selectedHeroId,
      timestamp: new Date(),
    };

    set((state) => {
      const nextBlueBans = [...state.blueBans];
      const nextRedBans = [...state.redBans];
      const nextBluePicks = [...state.bluePicks];
      const nextRedPicks = [...state.redPicks];

      if (step.action === 'ban' && step.side === 'blue') nextBlueBans.push(selectedHeroId);
      if (step.action === 'ban' && step.side === 'red') nextRedBans.push(selectedHeroId);
      if (step.action === 'pick' && step.side === 'blue') nextBluePicks.push(selectedHeroId);
      if (step.action === 'pick' && step.side === 'red') nextRedPicks.push(selectedHeroId);

      const nextStep = currentStep + 1;

      return {
        blueBans: nextBlueBans,
        redBans: nextRedBans,
        bluePicks: nextBluePicks,
        redPicks: nextRedPicks,
        draftHistory: [...state.draftHistory, action],
        currentStep: nextStep,
        selectedHeroId: null,
        isComplete: nextStep >= DRAFT_SEQUENCE.length,
      };
    });
  },

  undoStep() {
    const { currentStep, draftHistory } = get();
    if (currentStep === 0 || draftHistory.length === 0) return;

    const lastAction = draftHistory[draftHistory.length - 1];
    if (!lastAction || lastAction.heroId === null) return;

    const { step, heroId } = lastAction;

    set((state) => {
      const nextBlueBans = [...state.blueBans];
      const nextRedBans = [...state.redBans];
      const nextBluePicks = [...state.bluePicks];
      const nextRedPicks = [...state.redPicks];

      if (step.action === 'ban' && step.side === 'blue') nextBlueBans.pop();
      if (step.action === 'ban' && step.side === 'red') nextRedBans.pop();
      if (step.action === 'pick' && step.side === 'blue') nextBluePicks.pop();
      if (step.action === 'pick' && step.side === 'red') nextRedPicks.pop();

      return {
        blueBans: nextBlueBans,
        redBans: nextRedBans,
        bluePicks: nextBluePicks,
        redPicks: nextRedPicks,
        draftHistory: state.draftHistory.slice(0, -1),
        currentStep: currentStep - 1,
        selectedHeroId: heroId, // re-select the hero that was undone
        isComplete: false,
      };
    });
  },

  resetDraft() {
    set(initialState());
  },

  setFormat(format: DraftFormat) {
    set({ format });
  },

  setSideNames(blue: string, red: string) {
    set({ blueSideName: blue, redSideName: red });
  },

  async saveDraft(): Promise<number | undefined> {
    if (!db) return undefined;

    const state = get();

    const session: Omit<DraftSession, 'id'> = {
      blueSideName: state.blueSideName,
      redSideName: state.redSideName,
      draftActions: state.draftHistory,
      blueBans: state.blueBans,
      redBans: state.redBans,
      bluePicks: state.bluePicks,
      redPicks: state.redPicks,
      result: 'pending',
      notes: '',
      format: state.format,
      createdAt: new Date(),
    };

    const id = await db.draftSessions.add(session as DraftSession);
    return id;
  },

  // ── Computed helpers ────────────────────────

  getCurrentStep(): DraftStep | null {
    const { currentStep } = get();
    return DRAFT_SEQUENCE[currentStep] ?? null;
  },

  getPhase(): DraftPhase {
    return getPhaseForStep(get().currentStep);
  },

  getUsedHeroIds(): number[] {
    const { blueBans, redBans, bluePicks, redPicks } = get();
    return [...blueBans, ...redBans, ...bluePicks, ...redPicks];
  },

  isHeroAvailable(heroId: number): boolean {
    return !get().getUsedHeroIds().includes(heroId);
  },
}));
