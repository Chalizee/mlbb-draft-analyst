'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDraftStore } from '@/stores/draftStore';
import { useHeroStore } from '@/stores/heroStore';
import { DRAFT_SEQUENCE } from '@/data/draftSequence';
import type { HeroRole } from '@/types';
import TeamPanel from './TeamPanel';
import HeroGrid from './HeroGrid';
import PhaseIndicator from './PhaseIndicator';
import Button from '@/components/ui/Button';

export default function DraftBoard() {
  const {
    currentStep,
    blueBans,
    redBans,
    bluePicks,
    redPicks,
    selectedHeroId,
    isComplete,
    blueSideName,
    redSideName,
    selectHero,
    confirmSelection,
    undoStep,
    resetDraft,
    saveDraft,
    setSideNames,
  } = useDraftStore();

  const { heroes } = useHeroStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<HeroRole | 'All'>('All');

  // All used hero IDs
  const disabledHeroIds = useMemo(() => {
    const ids: number[] = [];
    blueBans.forEach((id) => id !== null && ids.push(id));
    redBans.forEach((id) => id !== null && ids.push(id));
    bluePicks.forEach((id) => id !== null && ids.push(id));
    redPicks.forEach((id) => id !== null && ids.push(id));
    return ids;
  }, [blueBans, redBans, bluePicks, redPicks]);

  // Current step data
  const currentStepData = DRAFT_SEQUENCE[currentStep] || null;
  const currentSide = currentStepData?.side || null;
  const currentAction = currentStepData?.action || null;

  const handleConfirm = useCallback(() => {
    if (selectedHeroId !== null) {
      confirmSelection();
    }
  }, [selectedHeroId, confirmSelection]);

  const handleSave = useCallback(async () => {
    await saveDraft();
  }, [saveDraft]);

  return (
    <div id="draft-board" className="flex flex-col h-full">
      {/* Phase Indicator */}
      <div className="px-4 py-3 border-b border-border bg-bg-surface/50">
        <PhaseIndicator
          currentStep={currentStep}
          blueBans={blueBans}
          redBans={redBans}
          bluePicks={bluePicks}
          redPicks={redPicks}
          isComplete={isComplete}
        />
      </div>

      {/* Main Layout: Blue Panel | Hero Grid | Red Panel */}
      <div className="flex-1 flex min-h-0">
        {/* Blue Side Panel */}
        <div
          className={`
            w-56 flex-shrink-0 p-4 border-r transition-colors duration-300
            ${currentSide === 'blue' && !isComplete ? 'border-blue-side/30 bg-blue-side/[0.03]' : 'border-border'}
          `}
        >
          <TeamPanel
            side="blue"
            teamName={blueSideName}
            onTeamNameChange={(name) => setSideNames(name, redSideName)}
            bans={blueBans}
            picks={bluePicks}
            heroes={heroes}
            currentStep={currentStep}
            currentSide={currentSide}
            currentAction={currentAction}
          />
        </div>

        {/* Center: Hero Grid */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Draft Complete Summary */}
          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mx-4 mt-4 p-4 rounded-xl bg-success/10 border border-success/30 text-center"
              >
                <p className="text-success font-heading font-bold text-lg mb-1">
                  ✅ Draft Complete
                </p>
                <p className="text-text-secondary text-sm">
                  All picks and bans have been locked in. Save or reset the draft.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hero Grid */}
          <div className="flex-1 p-4 min-h-0">
            <HeroGrid
              heroes={heroes}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              roleFilter={roleFilter}
              onRoleFilterChange={setRoleFilter}
              selectedHeroId={selectedHeroId}
              onHeroSelect={selectHero}
              disabledHeroIds={disabledHeroIds}
            />
          </div>

          {/* Action Bar */}
          <div className="px-4 py-3 border-t border-border bg-bg-surface/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                id="draft-undo-btn"
                variant="secondary"
                size="sm"
                onClick={undoStep}
                disabled={currentStep === 0 && !isComplete}
              >
                ↩ Undo
              </Button>
              <Button
                id="draft-reset-btn"
                variant="ghost"
                size="sm"
                onClick={resetDraft}
              >
                ↻ Reset
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Current action indicator */}
              {!isComplete && currentStepData && (
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-semibold
                    ${
                      currentAction === 'ban'
                        ? currentSide === 'blue'
                          ? 'bg-blue-side/10 text-blue-side border border-blue-side/30'
                          : 'bg-red-side/10 text-red-side border border-red-side/30'
                        : currentSide === 'blue'
                        ? 'bg-blue-side/20 text-blue-side border border-blue-side/40'
                        : 'bg-red-side/20 text-red-side border border-red-side/40'
                    }
                  `}
                >
                  {currentStepData.label}
                </motion.div>
              )}

              {!isComplete ? (
                <Button
                  id="draft-confirm-btn"
                  variant={currentSide === 'blue' ? 'blue' : 'red'}
                  size="md"
                  onClick={handleConfirm}
                  disabled={selectedHeroId === null}
                >
                  {currentAction === 'ban' ? '🚫 Confirm Ban' : '✓ Confirm Pick'}
                </Button>
              ) : (
                <Button
                  id="draft-save-btn"
                  variant="primary"
                  size="md"
                  onClick={handleSave}
                >
                  💾 Save Draft
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Red Side Panel */}
        <div
          className={`
            w-56 flex-shrink-0 p-4 border-l transition-colors duration-300
            ${currentSide === 'red' && !isComplete ? 'border-red-side/30 bg-red-side/[0.03]' : 'border-border'}
          `}
        >
          <TeamPanel
            side="red"
            teamName={redSideName}
            onTeamNameChange={(name) => setSideNames(blueSideName, name)}
            bans={redBans}
            picks={redPicks}
            heroes={heroes}
            currentStep={currentStep}
            currentSide={currentSide}
            currentAction={currentAction}
          />
        </div>
      </div>
    </div>
  );
}
