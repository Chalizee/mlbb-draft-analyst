'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import IdentityEditor from '@/components/identity/IdentityEditor';
import Card from '@/components/ui/Card';
import { useTeamIdentityStore } from '@/stores/teamIdentityStore';
import { useHeroStore } from '@/stores/heroStore';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function IdentityPage() {
  const { identity, warnings, loadIdentity } = useTeamIdentityStore();
  const { loadHeroes } = useHeroStore();

  useEffect(() => {
    loadIdentity();
    loadHeroes();
  }, [loadIdentity, loadHeroes]);

  return (
    <motion.div
      id="identity-page"
      className="h-full overflow-y-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            Team Identity
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Define your team&apos;s playstyle, priorities, and draft philosophy.
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-8">
          {/* Editor (left 2 cols) */}
          <motion.div variants={itemVariants} className="col-span-2">
            <IdentityEditor />
          </motion.div>

          {/* Sidebar (right col) */}
          <motion.div variants={itemVariants} className="space-y-6">
            {/* Identity Summary */}
            {identity && (
              <Card variant="elevated" glow glowColor="accent">
                <h3 className="font-heading font-semibold text-sm text-text-primary mb-3">
                  📋 Identity Summary
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1">
                      Team
                    </p>
                    <p className="text-sm font-heading font-semibold text-text-primary">
                      {identity.name || 'Unnamed'}
                    </p>
                  </div>

                  {identity.playstyles.length > 0 && (
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1">
                        Playstyles
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {identity.playstyles.map((ps) => (
                          <span
                            key={ps}
                            className="px-2 py-0.5 text-[10px] rounded bg-accent/10 text-accent-hover font-medium"
                          >
                            {ps}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-text-muted text-[10px]">Damage</p>
                      <p className="text-text-primary font-medium">{identity.damageProfile}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-[10px]">Engage</p>
                      <p className="text-text-primary font-medium">{identity.engageLevel}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-[10px]">Scaling</p>
                      <p className="text-text-primary font-medium">{identity.scalingPreference}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-[10px]">Frontline</p>
                      <p className="text-text-primary font-medium">{identity.frontlineRequirement}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Warning Preview */}
            <Card variant="default">
              <h3 className="font-heading font-semibold text-sm text-text-primary mb-3">
                ⚠️ Warning Preview
              </h3>
              <p className="text-xs text-text-muted mb-3">
                Warnings that would trigger during a draft based on your identity.
              </p>

              {warnings.length > 0 ? (
                <div className="space-y-2">
                  {warnings.map((w, i) => (
                    <div
                      key={i}
                      className={`
                        p-2.5 rounded-lg border text-xs
                        ${
                          w.type === 'danger'
                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : w.type === 'warning'
                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        }
                      `}
                    >
                      <span className="font-semibold uppercase text-[10px] tracking-wider">
                        {w.category}
                      </span>
                      <p className="mt-0.5 text-text-secondary text-[11px]">{w.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xl mb-1">✅</p>
                  <p className="text-xs text-text-muted">
                    No warnings to show. Start a draft to see live analysis.
                  </p>
                </div>
              )}
            </Card>

            {/* Quick Tips */}
            <Card variant="default">
              <h3 className="font-heading font-semibold text-sm text-text-primary mb-3">
                💡 Tips
              </h3>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">●</span>
                  <span>Select multiple playstyles to define a flexible identity.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">●</span>
                  <span>Priority heroes will be flagged if left unbanned or unpicked.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">●</span>
                  <span>Warnings adapt in real-time during draft simulations.</span>
                </li>
              </ul>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
