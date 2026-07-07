'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Hero, DraftSide } from '@/types';
import HeroAvatar from '@/components/ui/HeroAvatar';

interface TeamPanelProps {
  side: DraftSide;
  teamName: string;
  onTeamNameChange: (name: string) => void;
  bans: (number | null)[];
  picks: (number | null)[];
  heroes: Hero[];
  currentStep: number;
  currentSide: DraftSide | null;
  currentAction: 'ban' | 'pick' | null;
}

function getHeroById(heroes: Hero[], id: number | null): Hero | undefined {
  if (id === null) return undefined;
  return heroes.find((h) => h.id === id);
}

export default function TeamPanel({
  side,
  teamName,
  onTeamNameChange,
  bans,
  picks,
  heroes,
}: TeamPanelProps) {
  const isBlue = side === 'blue';
  const accentColor = isBlue ? 'blue-side' : 'red-side';
  const glowClass = isBlue ? 'glow-border-blue' : 'glow-border-red';

  return (
    <div
      id={`team-panel-${side}`}
      className="flex flex-col h-full"
    >
      {/* Team Name */}
      <div className={`mb-4 pb-3 border-b border-${accentColor}/20`}>
        <input
          id={`team-name-${side}`}
          type="text"
          value={teamName}
          onChange={(e) => onTeamNameChange(e.target.value)}
          className={`
            w-full bg-transparent border-none text-center font-heading font-bold text-lg
            focus:outline-none
            ${isBlue ? 'text-blue-side' : 'text-red-side'}
          `}
          placeholder={isBlue ? 'Blue Side' : 'Red Side'}
        />
        <p className="text-center text-[10px] text-text-muted uppercase tracking-widest mt-1">
          {isBlue ? 'FIRST PICK' : 'SECOND PICK'}
        </p>
      </div>

      {/* Bans */}
      <div className="mb-4">
        <h4 className="text-[10px] uppercase tracking-widest text-text-muted mb-2 font-semibold">
          Bans
        </h4>
        <div className="flex gap-1.5">
          {bans.map((banId, i) => {
            const hero = getHeroById(heroes, banId);
            return (
              <motion.div
                key={`${side}-ban-${i}`}
                id={`${side}-ban-slot-${i}`}
                className={`
                  relative flex-1 h-10 rounded-lg border flex items-center justify-center
                  ${
                    hero
                      ? `bg-${accentColor}/10 border-${accentColor}/30`
                      : 'bg-bg-elevated/50 border-border/50'
                  }
                `}
                initial={false}
                animate={hero ? { scale: [0.9, 1.05, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {hero ? (
                  <>
                    <HeroAvatar
                      imageUrl={hero.imageUrl}
                      name={hero.name}
                      size="sm"
                      className="opacity-35 grayscale scale-95 border-red-side/10"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-red-side/90 text-2xl font-bold font-heading drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">✕</span>
                    </div>
                  </>
                ) : (
                  <span className="text-text-muted/30 text-xs">—</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Picks */}
      <div className="flex-1">
        <h4 className="text-[10px] uppercase tracking-widest text-text-muted mb-2 font-semibold">
          Picks
        </h4>
        <div className="space-y-2">
          {picks.map((pickId, i) => {
            const hero = getHeroById(heroes, pickId);
            const laneLabels = ['Roam', 'Jungle', 'Mid', 'Gold', 'EXP'];

            return (
              <AnimatePresence key={`${side}-pick-${i}`}>
                <motion.div
                  id={`${side}-pick-slot-${i}`}
                  className={`
                    relative rounded-xl border p-3 transition-all duration-300
                    ${
                      hero
                        ? `${glowClass} bg-${accentColor}/5 border-${accentColor}/30`
                        : 'bg-bg-elevated/30 border-border/40'
                    }
                  `}
                  initial={false}
                  animate={hero ? { scale: [0.95, 1.02, 1], opacity: 1 } : { opacity: 0.6 }}
                  transition={{ duration: 0.3 }}
                >
                  {hero ? (
                    <div className="flex items-center gap-2">
                      <HeroAvatar
                        imageUrl={hero.imageUrl}
                        name={hero.name}
                        size="sm"
                        className={isBlue ? 'border-blue-side/30 glow-border-blue' : 'border-red-side/30 glow-border-red'}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {hero.name}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {hero.role} · {hero.laneRecommendation[0]}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-bg-surface/50 border border-border/30 flex items-center justify-center">
                        <span className="text-text-muted/30 text-xs">{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-text-muted/40">{laneLabels[i] || `Pick ${i + 1}`}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            );
          })}
        </div>
      </div>
    </div>
  );
}
