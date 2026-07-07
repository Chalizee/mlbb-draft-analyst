'use client';

import { create } from 'zustand';
import type {
  Hero,
  HeroRole,
  LanePosition,
  HeroRelationship,
  HeroNote,
  RelationshipType,
  SidePreference,
} from '@/types';
import { db } from '@/lib/db';

// ────────────────────────────────────────────────
// State shape
// ────────────────────────────────────────────────
interface HeroState {
  heroes: Hero[];
  searchQuery: string;
  roleFilter: HeroRole | null;
  laneFilter: LanePosition | null;
  selectedHeroId: number | null;
  relationships: HeroRelationship[];
  heroNotes: HeroNote[];
}

// ────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────
interface HeroActions {
  /** Load all heroes from IndexedDB into the store. */
  loadHeroes: () => Promise<void>;
  /** Filter heroes by free-text search (name / slug). */
  searchHeroes: (query: string) => void;
  /** Filter heroes by role (or clear filter with `null`). */
  filterByRole: (role: HeroRole | null) => void;
  /** Filter heroes by lane (or clear filter with `null`). */
  filterByLane: (lane: LanePosition | null) => void;
  /** Select a hero and load its relationships + notes. */
  selectHero: (id: number | null) => Promise<void>;
  /** Persist a new hero relationship to IndexedDB. */
  addRelationship: (
    relatedHeroId: number,
    type: RelationshipType,
    notes: string,
    strength: number,
  ) => Promise<void>;
  /** Remove a hero relationship from IndexedDB. */
  removeRelationship: (relationshipId: number) => Promise<void>;
  /** Add a note for the currently-selected hero. */
  addNote: (
    content: string,
    tags: string[],
    firstPickViability: HeroNote['firstPickViability'],
    sidePreference: SidePreference,
  ) => Promise<void>;
  /** Load relationships for a specific hero id. */
  loadRelationships: (heroId: number) => Promise<void>;
  /** Load notes for a specific hero id. */
  loadNotes: (heroId: number) => Promise<void>;
}

// ────────────────────────────────────────────────
// Store
// ────────────────────────────────────────────────
export const useHeroStore = create<HeroState & HeroActions>()((set, get) => ({
  heroes: [],
  searchQuery: '',
  roleFilter: null,
  laneFilter: null,
  selectedHeroId: null,
  relationships: [],
  heroNotes: [],

  // ── Actions ────────────────────────────────

  async loadHeroes() {
    if (!db) return;
    const heroes = await db.heroes.toArray();
    set({ heroes });
  },

  searchHeroes(query: string) {
    set({ searchQuery: query });
  },

  filterByRole(role: HeroRole | null) {
    set({ roleFilter: role });
  },

  filterByLane(lane: LanePosition | null) {
    set({ laneFilter: lane });
  },

  async selectHero(id: number | null) {
    set({ selectedHeroId: id, relationships: [], heroNotes: [] });
    if (id !== null) {
      await get().loadRelationships(id);
      await get().loadNotes(id);
    }
  },

  async addRelationship(
    relatedHeroId: number,
    type: RelationshipType,
    notes: string,
    strength: number,
  ) {
    if (!db) return;
    const { selectedHeroId } = get();
    if (selectedHeroId === null) return;

    const relationship: Omit<HeroRelationship, 'id'> = {
      heroId: selectedHeroId,
      relatedHeroId,
      type,
      notes,
      strength: Math.max(1, Math.min(5, strength)),
    };

    await db.heroRelationships.add(relationship as HeroRelationship);
    await get().loadRelationships(selectedHeroId);
  },

  async removeRelationship(relationshipId: number) {
    if (!db) return;
    const { selectedHeroId } = get();
    await db.heroRelationships.delete(relationshipId);
    if (selectedHeroId !== null) {
      await get().loadRelationships(selectedHeroId);
    }
  },

  async addNote(
    content: string,
    tags: string[],
    firstPickViability: HeroNote['firstPickViability'],
    sidePreference: SidePreference,
  ) {
    if (!db) return;
    const { selectedHeroId } = get();
    if (selectedHeroId === null) return;

    const now = new Date();
    const note: Omit<HeroNote, 'id'> = {
      heroId: selectedHeroId,
      content,
      tags,
      firstPickViability,
      sidePreference,
      createdAt: now,
      updatedAt: now,
    };

    await db.heroNotes.add(note as HeroNote);
    await get().loadNotes(selectedHeroId);
  },

  async loadRelationships(heroId: number) {
    if (!db) return;
    const relationships = await db.heroRelationships
      .where('heroId')
      .equals(heroId)
      .toArray();
    set({ relationships });
  },

  async loadNotes(heroId: number) {
    if (!db) return;
    const heroNotes = await db.heroNotes
      .where('heroId')
      .equals(heroId)
      .toArray();
    set({ heroNotes });
  },
}));
