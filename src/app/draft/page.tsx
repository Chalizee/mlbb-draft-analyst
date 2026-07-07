'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DraftBoard from '@/components/draft/DraftBoard';
import DraftWarnings from '@/components/draft/DraftWarnings';
import { useDraftStore } from '@/stores/draftStore';
import { useHeroStore } from '@/stores/heroStore';
import { useTeamIdentityStore } from '@/stores/teamIdentityStore';
import Button from '@/components/ui/Button';

export default function DraftPage() {
  const { heroes, loadHeroes } = useHeroStore();
  const { bluePicks, redPicks, isComplete } = useDraftStore();
  const { warnings, analyzeDraft } = useTeamIdentityStore();
  const [showWarnings, setShowWarnings] = useState(false);

  useEffect(() => {
    loadHeroes();
  }, [loadHeroes]);

  // Analyze draft when picks change
  useEffect(() => {
    if (bluePicks.some((p) => p !== null) || redPicks.some((p) => p !== null)) {
      analyzeDraft(
        bluePicks.filter((p): p is number => p !== null),
        redPicks.filter((p): p is number => p !== null),
        heroes
      );
    }
  }, [bluePicks, redPicks, heroes, analyzeDraft]);

  return (
    <div id="draft-page" className="h-full flex flex-col relative">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-surface/30"
      >
        <div>
          <h1 className="font-heading text-lg font-bold text-text-primary">
            Draft Simulator
          </h1>
          <p className="text-xs text-text-muted">
            MLBB Competitive Draft · Standard Format
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            id="toggle-warnings-btn"
            variant="secondary"
            size="sm"
            onClick={() => setShowWarnings(!showWarnings)}
          >
            ⚠ Warnings
            {warnings.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-danger/20 text-danger text-[10px] rounded-full font-bold">
                {warnings.length}
              </span>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Draft Board */}
      <div className="flex-1 min-h-0">
        <DraftBoard />
      </div>

      {/* Warnings Overlay */}
      <DraftWarnings
        warnings={warnings}
        isOpen={showWarnings}
        onClose={() => setShowWarnings(false)}
      />
    </div>
  );
}
