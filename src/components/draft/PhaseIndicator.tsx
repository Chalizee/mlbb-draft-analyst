'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DraftStep } from '@/types';
import { DRAFT_SEQUENCE, getPhaseForStep } from '@/data/draftSequence';

interface PhaseIndicatorProps {
  currentStep: number;
  blueBans: (number | null)[];
  redBans: (number | null)[];
  bluePicks: (number | null)[];
  redPicks: (number | null)[];
  isComplete: boolean;
}

const phaseLabels: Record<string, string> = {
  'ban-phase-1': 'Phase 1 Bans',
  'pick-phase-1': 'Phase 1 Picks',
  'ban-phase-2': 'Phase 2 Bans',
  'pick-phase-2': 'Phase 2 Picks',
  complete: 'Draft Complete',
};

export default function PhaseIndicator({
  currentStep,
  isComplete,
}: PhaseIndicatorProps) {
  const currentPhase = isComplete ? 'complete' : getPhaseForStep(currentStep);
  const currentStepData: DraftStep | undefined = DRAFT_SEQUENCE[currentStep];

  return (
    <div id="phase-indicator" className="w-full">
      {/* Phase Label */}
      <div className="flex items-center justify-between mb-3">
        <AnimatePresence mode="wait">
          <motion.h3
            key={currentPhase}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="font-heading font-semibold text-sm text-text-primary"
          >
            {phaseLabels[currentPhase] || 'Draft'}
          </motion.h3>
        </AnimatePresence>
        <span className="text-xs text-text-muted font-mono">
          {isComplete ? '20/20' : `${currentStep + 1}/20`}
        </span>
      </div>

      {/* Step Dots */}
      <div className="flex items-center gap-1">
        {DRAFT_SEQUENCE.map((step: DraftStep, i: number) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep && !isComplete;
          const isBan = step.action === 'ban';
          const isBlue = step.side === 'blue';

          let dotClass = 'bg-bg-elevated border-border';

          if (isCompleted) {
            dotClass = isBan
              ? isBlue
                ? 'bg-blue-side/40 border-blue-side/60'
                : 'bg-red-side/40 border-red-side/60'
              : isBlue
              ? 'bg-blue-side border-blue-side'
              : 'bg-red-side border-red-side';
          }

          return (
            <div key={step.index} className="relative flex-1">
              <motion.div
                className={`
                  h-2 rounded-full border transition-colors duration-300
                  ${dotClass}
                  ${isCurrent ? 'animate-pulse-glow border-accent bg-accent' : ''}
                `}
                initial={false}
                animate={
                  isCurrent
                    ? { scale: [1, 1.2, 1] }
                    : { scale: 1 }
                }
                transition={
                  isCurrent
                    ? { repeat: Infinity, duration: 1.5 }
                    : { duration: 0.2 }
                }
                title={step.label}
              />
              {/* Phase dividers */}
              {(i === 5 || i === 11 || i === 15) && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-0.5 w-px h-4 bg-border-bright" />
              )}
            </div>
          );
        })}
      </div>

      {/* Current step description */}
      {currentStepData && !isComplete && (
        <motion.p
          key={currentStep}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-text-muted mt-2 text-center font-mono"
        >
          {currentStepData.label}
        </motion.p>
      )}
    </div>
  );
}
