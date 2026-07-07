'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DraftWarning } from '@/types';

interface DraftWarningsProps {
  warnings: DraftWarning[];
  isOpen: boolean;
  onClose: () => void;
}

const severityConfig: Record<DraftWarning['type'], { icon: string; color: string; bg: string; border: string }> = {
  danger: {
    icon: '🚨',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  warning: {
    icon: '⚠️',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
  },
  info: {
    icon: 'ℹ️',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
};

const categoryLabels: Record<DraftWarning['category'], string> = {
  engage: 'Engage',
  damage: 'Damage',
  frontline: 'Frontline',
  scaling: 'Scaling',
  identity: 'Identity',
  synergy: 'Synergy',
};

export default function DraftWarnings({ warnings, isOpen, onClose }: DraftWarningsProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-30 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            id="draft-warnings-panel"
            className="fixed top-0 right-0 h-full w-80 z-40 bg-bg-surface border-l border-border
                       shadow-2xl shadow-black/40 overflow-y-auto"
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-bg-surface z-10">
              <h3 className="font-heading font-semibold text-text-primary">
                Draft Warnings
              </h3>
              <button
                id="draft-warnings-close"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg
                           text-text-muted hover:text-text-secondary hover:bg-bg-surface-hover
                           transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Warnings List */}
            <div className="p-4 space-y-3">
              {warnings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-sm text-text-secondary">No warnings</p>
                  <p className="text-xs text-text-muted mt-1">
                    Your draft looks good so far
                  </p>
                </div>
              ) : (
                warnings.map((warning, index) => {
                  const config = severityConfig[warning.type];
                  return (
                    <motion.div
                      key={index}
                      id={`draft-warning-${index}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`
                        p-3 rounded-xl border
                        ${config.bg} ${config.border}
                      `}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm flex-shrink-0 mt-0.5">
                          {config.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] uppercase font-bold tracking-wider ${config.color}`}>
                              {categoryLabels[warning.category]}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {warning.message}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
