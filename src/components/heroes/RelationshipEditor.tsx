'use client';

import React, { useState, useMemo } from 'react';
import type { Hero } from '@/types';
import Button from '@/components/ui/Button';

interface RelationshipEditorProps {
  heroes: Hero[];
  currentHeroId: number;
  existingRelatedIds: number[];
  onSave: (relatedHeroId: number, strength: number, notes: string) => void;
  onCancel: () => void;
}

export default function RelationshipEditor({
  heroes,
  currentHeroId,
  existingRelatedIds,
  onSave,
  onCancel,
}: RelationshipEditorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHeroId, setSelectedHeroId] = useState<number | null>(null);
  const [strength, setStrength] = useState(3);
  const [notes, setNotes] = useState('');

  const availableHeroes = useMemo(() => {
    const excludeIds = new Set([currentHeroId, ...existingRelatedIds]);
    let list = heroes.filter((h) => h.id && !excludeIds.has(h.id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10);
  }, [heroes, currentHeroId, existingRelatedIds, searchQuery]);

  const selectedHero = heroes.find((h) => h.id === selectedHeroId);

  const handleSave = () => {
    if (selectedHeroId !== null) {
      onSave(selectedHeroId, strength, notes);
      setSearchQuery('');
      setSelectedHeroId(null);
      setStrength(3);
      setNotes('');
    }
  };

  return (
    <div id="relationship-editor" className="p-3 rounded-xl bg-bg-elevated/50 border border-border space-y-3">
      {/* Hero Search */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1 block">
          Select Hero
        </label>
        {selectedHero ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-accent/10 border border-accent/30">
            <span className="text-sm font-medium text-text-primary">{selectedHero.name}</span>
            <button
              onClick={() => setSelectedHeroId(null)}
              className="text-xs text-text-muted hover:text-text-secondary cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <input
              id="relationship-hero-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hero..."
              className="w-full bg-bg-surface border border-border rounded-lg py-2 px-3 text-sm
                         text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                         focus:ring-1 focus:ring-accent/30 transition-all"
            />
            {searchQuery && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-border bg-bg-surface">
                {availableHeroes.map((hero) => (
                  <button
                    key={hero.id}
                    onClick={() => {
                      setSelectedHeroId(hero.id!);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-text-secondary
                               hover:text-text-primary hover:bg-bg-surface-hover
                               transition-colors cursor-pointer border-b border-border/30 last:border-b-0"
                  >
                    {hero.name}
                    <span className="text-[10px] text-text-muted ml-2">{hero.role}</span>
                  </button>
                ))}
                {availableHeroes.length === 0 && (
                  <p className="px-3 py-2 text-xs text-text-muted">No heroes found</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Strength Slider */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-2 block">
          Strength: {strength}/5
        </label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setStrength(n)}
              className={`
                flex-1 h-2.5 rounded-full transition-all duration-200 cursor-pointer
                ${n <= strength ? 'bg-accent' : 'bg-bg-elevated hover:bg-border'}
              `}
            />
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1 block">
          Notes (optional)
        </label>
        <input
          id="relationship-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. 'strong in lane phase'"
          className="w-full bg-bg-surface border border-border rounded-lg py-2 px-3 text-sm
                     text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                     focus:ring-1 focus:ring-accent/30 transition-all"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          id="relationship-save-btn"
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={selectedHeroId === null}
          className="flex-1"
        >
          Save
        </Button>
        <Button
          id="relationship-cancel-btn"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
