'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHeroStore } from '@/stores/heroStore';
import type { Hero, HeroRelationship } from '@/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import RelationshipEditor from './RelationshipEditor';
import HeroAvatar from '@/components/ui/HeroAvatar';

export default function HeroDetailPanel() {
  const {
    heroes,
    selectedHeroId,
    relationships,
    heroNotes,
    loadRelationships,
    loadNotes,
    addRelationship,
    removeRelationship,
    addNote,
  } = useHeroStore();

  const [showCounterEditor, setShowCounterEditor] = useState(false);
  const [showSynergyEditor, setShowSynergyEditor] = useState(false);
  const [showWeaknessEditor, setShowWeaknessEditor] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [firstPickViability, setFirstPickViability] = useState<'Strong' | 'Situational' | 'Weak' | 'Unknown'>('Unknown');
  const [sidePreference, setSidePreference] = useState<'Blue' | 'Red' | 'Neutral'>('Neutral');

  const selectedHero = useMemo(() => {
    if (selectedHeroId === null) return null;
    return heroes.find((h: Hero) => h.id === selectedHeroId) || null;
  }, [heroes, selectedHeroId]);

  useEffect(() => {
    if (selectedHeroId !== null) {
      loadRelationships(selectedHeroId);
      loadNotes(selectedHeroId);
    }
  }, [selectedHeroId, loadRelationships, loadNotes]);

  useEffect(() => {
    const latest = heroNotes.length > 0 ? heroNotes[0] : null;
    const content = latest?.content || '';
    const viability = latest?.firstPickViability || 'Unknown';
    const preference = latest?.sidePreference || 'Neutral';

    Promise.resolve().then(() => {
      setNoteContent(content);
      setFirstPickViability(viability);
      setSidePreference(preference);
    });
  }, [heroNotes]);

  const counters = useMemo(
    () => relationships.filter((r: HeroRelationship) => r.type === 'counter'),
    [relationships]
  );
  const synergies = useMemo(
    () => relationships.filter((r: HeroRelationship) => r.type === 'synergy'),
    [relationships]
  );
  const weaknesses = useMemo(
    () => relationships.filter((r: HeroRelationship) => r.type === 'weakness'),
    [relationships]
  );

  const getHeroName = (id: number) => {
    return heroes.find((h: Hero) => h.id === id)?.name || 'Unknown';
  };

  const handleSaveNote = async () => {
    if (selectedHeroId === null) return;
    await addNote(noteContent, [], firstPickViability, sidePreference);
  };

  if (!selectedHero) {
    return (
      <div id="hero-detail-empty" className="flex flex-col items-center justify-center h-full text-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-4xl mb-4">👤</p>
          <h3 className="font-heading text-lg font-semibold text-text-secondary mb-2">
            Select a Hero
          </h3>
          <p className="text-sm text-text-muted max-w-xs">
            Choose a hero from the list to view and edit their details, relationships, and notes.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      id="hero-detail-panel"
      key={selectedHeroId}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full overflow-y-auto p-5 space-y-5"
    >
      {/* Hero Header */}
      <div className="flex items-start gap-4">
        <HeroAvatar
          imageUrl={selectedHero.imageUrl}
          name={selectedHero.name}
          size="lg"
          glow={true}
          className="border-accent/40"
        />
        <div className="flex-1">
          <h2 className="font-heading text-xl font-bold text-text-primary">
            {selectedHero.name}
          </h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge role={selectedHero.role} size="md" />
            {selectedHero.secondaryRole && (
              <Badge role={selectedHero.secondaryRole} size="md" />
            )}
          </div>
        </div>
      </div>

      {/* Hero Info Grid */}
      <Card variant="default" className="!p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Lane</p>
            <p className="text-sm text-text-primary">{selectedHero.laneRecommendation.join(', ')}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Damage</p>
            <p className="text-sm text-text-primary">{selectedHero.damageType}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Scaling</p>
            <p className="text-sm text-text-primary">{selectedHero.scalingType}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Teamfight</p>
            <p className="text-sm text-text-primary">{selectedHero.teamfightStyle}</p>
          </div>
        </div>
      </Card>

      {/* First Pick Viability */}
      <Card variant="default" className="!p-4">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          First Pick Viability
        </h4>
        <div className="flex gap-2">
          {(['Strong', 'Situational', 'Weak', 'Unknown'] as const).map((opt) => (
            <button
              key={opt}
              id={`fp-viability-${opt.toLowerCase()}`}
              onClick={() => setFirstPickViability(opt)}
              className={`
                flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200 border cursor-pointer
                ${
                  firstPickViability === opt
                    ? opt === 'Strong'
                      ? 'bg-success/15 border-success/40 text-success'
                      : opt === 'Situational'
                      ? 'bg-warning/15 border-warning/40 text-warning'
                      : opt === 'Weak'
                      ? 'bg-danger/15 border-danger/40 text-danger'
                      : 'bg-bg-surface-hover border-border-bright text-text-primary'
                    : 'bg-bg-elevated/50 border-border/50 text-text-muted hover:border-border-bright'
                }
              `}
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>

      {/* Side Preference */}
      <Card variant="default" className="!p-4">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          Side Preference
        </h4>
        <div className="flex gap-2">
          {(['Blue', 'Neutral', 'Red'] as const).map((opt) => (
            <button
              key={opt}
              id={`side-pref-${opt.toLowerCase()}`}
              onClick={() => setSidePreference(opt)}
              className={`
                flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200 border cursor-pointer
                ${
                  sidePreference === opt
                    ? opt === 'Blue'
                      ? 'bg-blue-side/15 border-blue-side/40 text-blue-side'
                      : opt === 'Red'
                      ? 'bg-red-side/15 border-red-side/40 text-red-side'
                      : 'bg-accent/15 border-accent/40 text-accent'
                    : 'bg-bg-elevated/50 border-border/50 text-text-muted hover:border-border-bright'
                }
              `}
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>

      {/* Counters */}
      <RelationshipSection
        title="Counters"
        icon="⚔"
        items={counters}
        getHeroName={getHeroName}
        onRemove={removeRelationship}
        showEditor={showCounterEditor}
        onToggleEditor={() => setShowCounterEditor(!showCounterEditor)}
        onAdd={(relatedHeroId, strength, notes) => {
          addRelationship(relatedHeroId, 'counter', notes, strength);
          setShowCounterEditor(false);
        }}
        heroes={heroes}
        currentHeroId={selectedHeroId!}
      />

      {/* Synergies */}
      <RelationshipSection
        title="Synergies"
        icon="🤝"
        items={synergies}
        getHeroName={getHeroName}
        onRemove={removeRelationship}
        showEditor={showSynergyEditor}
        onToggleEditor={() => setShowSynergyEditor(!showSynergyEditor)}
        onAdd={(relatedHeroId, strength, notes) => {
          addRelationship(relatedHeroId, 'synergy', notes, strength);
          setShowSynergyEditor(false);
        }}
        heroes={heroes}
        currentHeroId={selectedHeroId!}
      />

      {/* Weaknesses */}
      <RelationshipSection
        title="Weaknesses"
        icon="💀"
        items={weaknesses}
        getHeroName={getHeroName}
        onRemove={removeRelationship}
        showEditor={showWeaknessEditor}
        onToggleEditor={() => setShowWeaknessEditor(!showWeaknessEditor)}
        onAdd={(relatedHeroId, strength, notes) => {
          addRelationship(relatedHeroId, 'weakness', notes, strength);
          setShowWeaknessEditor(false);
        }}
        heroes={heroes}
        currentHeroId={selectedHeroId!}
      />

      {/* Notes */}
      <Card variant="default" className="!p-4">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          📝 Analyst Notes
        </h4>
        <textarea
          id="hero-analyst-notes"
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Write your analysis notes here..."
          className="w-full h-28 bg-bg-elevated/50 border border-border rounded-xl p-3 text-sm text-text-primary
                     placeholder-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1
                     focus:ring-accent/30 transition-all"
        />
      </Card>

      {/* Save Button */}
      <Button
        id="hero-save-btn"
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleSaveNote}
      >
        💾 Save Hero Details
      </Button>
    </motion.div>
  );
}

/* ============ Relationship Section Sub-Component ============ */

interface RelationshipSectionProps {
  title: string;
  icon: string;
  items: HeroRelationship[];
  getHeroName: (id: number) => string;
  onRemove: (id: number) => void;
  showEditor: boolean;
  onToggleEditor: () => void;
  onAdd: (relatedHeroId: number, strength: number, notes: string) => void;
  heroes: Hero[];
  currentHeroId: number;
}

function RelationshipSection({
  title,
  icon,
  items,
  getHeroName,
  onRemove,
  showEditor,
  onToggleEditor,
  onAdd,
  heroes,
  currentHeroId,
}: RelationshipSectionProps) {
  return (
    <Card variant="default" className="!p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          {icon} {title}
        </h4>
        <Button
          id={`add-${title.toLowerCase()}-btn`}
          variant="ghost"
          size="sm"
          onClick={onToggleEditor}
        >
          {showEditor ? '✕ Cancel' : '+ Add'}
        </Button>
      </div>

      {/* Items */}
      <div className="space-y-2">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-bg-elevated/30 border border-border/50"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-medium text-text-primary truncate">
                  {getHeroName(item.relatedHeroId)}
                </span>
                {/* Strength dots */}
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className={`w-1.5 h-1.5 rounded-full ${
                        n <= item.strength ? 'bg-accent' : 'bg-bg-elevated'
                      }`}
                    />
                  ))}
                </div>
              </div>
              {item.notes && (
                <span className="text-[10px] text-text-muted truncate max-w-20">
                  {item.notes}
                </span>
              )}
              <button
                onClick={() => item.id && onRemove(item.id)}
                className="text-text-muted hover:text-danger text-xs transition-colors cursor-pointer flex-shrink-0"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && !showEditor && (
          <p className="text-xs text-text-muted/60 text-center py-2">
            No {title.toLowerCase()} added yet
          </p>
        )}
      </div>

      {/* Editor */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3"
          >
            <RelationshipEditor
              heroes={heroes}
              currentHeroId={currentHeroId}
              existingRelatedIds={items.map((i) => i.relatedHeroId)}
              onSave={onAdd}
              onCancel={onToggleEditor}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
