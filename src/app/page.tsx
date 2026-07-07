'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useHeroStore } from '@/stores/heroStore';
import { useTeamIdentityStore } from '@/stores/teamIdentityStore';
import { db } from '@/lib/db';
import type { DraftSession } from '@/types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { heroes, loadHeroes } = useHeroStore();
  const { identity, loadIdentity } = useTeamIdentityStore();
  const [recentDrafts, setRecentDrafts] = useState<DraftSession[]>([]);
  const [totalDrafts, setTotalDrafts] = useState(0);

  useEffect(() => {
    loadHeroes();
    loadIdentity();

    const loadDrafts = async () => {
      try {
        const drafts = await db.table('draftSessions').orderBy('createdAt').reverse().limit(5).toArray();
        setRecentDrafts(drafts);
        const count = await db.table('draftSessions').count();
        setTotalDrafts(count);
      } catch {
        // DB might not have this table yet
      }
    };
    loadDrafts();
  }, [loadHeroes, loadIdentity]);

  return (
    <motion.div
      className="p-8 max-w-6xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="font-heading text-3xl font-bold mb-2">
          Welcome to <span className="gradient-text">Draft Analyst</span>
        </h1>
        <p className="text-text-secondary text-base">
          Your professional MLBB draft preparation and analysis hub.
        </p>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4 mb-8">
        <Card variant="elevated" className="text-center">
          <p className="text-3xl font-heading font-bold gradient-text mb-1">
            {heroes.length}
          </p>
          <p className="text-sm text-text-secondary">Total Heroes</p>
          <p className="text-[10px] text-text-muted mt-1">in database</p>
        </Card>

        <Card variant="elevated" className="text-center">
          <p className="text-3xl font-heading font-bold gradient-text mb-1">
            {totalDrafts}
          </p>
          <p className="text-sm text-text-secondary">Draft Sessions</p>
          <p className="text-[10px] text-text-muted mt-1">completed</p>
        </Card>

        <Card variant="elevated" className="text-center">
          <p className="text-3xl font-heading font-bold mb-1">
            {identity ? (
              <span className="text-success">✓</span>
            ) : (
              <span className="text-warning">—</span>
            )}
          </p>
          <p className="text-sm text-text-secondary">Team Identity</p>
          <p className="text-[10px] text-text-muted mt-1">
            {identity ? 'Configured' : 'Not set'}
          </p>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="mb-8">
        <h2 className="font-heading text-lg font-semibold text-text-primary mb-4">
          Quick Actions
        </h2>
        <div className="flex gap-3">
          <Link href="/draft" className="flex-1">
            <Card variant="interactive" className="text-center !cursor-pointer group" id="quick-new-draft">
              <p className="text-2xl mb-2 group-hover:animate-float">⚔</p>
              <p className="font-heading font-semibold text-sm text-text-primary">New Draft</p>
              <p className="text-[11px] text-text-muted mt-1">Start a draft simulation</p>
            </Card>
          </Link>

          <Link href="/heroes" className="flex-1">
            <Card variant="interactive" className="text-center !cursor-pointer group" id="quick-browse-heroes">
              <p className="text-2xl mb-2 group-hover:animate-float">👤</p>
              <p className="font-heading font-semibold text-sm text-text-primary">Browse Heroes</p>
              <p className="text-[11px] text-text-muted mt-1">Manage hero database</p>
            </Card>
          </Link>

          <Link href="/identity" className="flex-1">
            <Card variant="interactive" className="text-center !cursor-pointer group" id="quick-set-identity">
              <p className="text-2xl mb-2 group-hover:animate-float">🛡</p>
              <p className="font-heading font-semibold text-sm text-text-primary">Set Identity</p>
              <p className="text-[11px] text-text-muted mt-1">Configure team playstyle</p>
            </Card>
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-5 gap-6">
        {/* Recent Drafts */}
        <motion.div variants={itemVariants} className="col-span-3">
          <h2 className="font-heading text-lg font-semibold text-text-primary mb-4">
            Recent Draft Sessions
          </h2>
          {recentDrafts.length > 0 ? (
            <div className="space-y-2">
              {recentDrafts.map((draft, i) => (
                <motion.div
                  key={draft.id || i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card variant="interactive" className="!p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-blue-side">
                            {draft.blueSideName || 'Blue'}
                          </span>
                          <span className="text-xs text-text-muted">vs</span>
                          <span className="text-sm font-semibold text-red-side">
                            {draft.redSideName || 'Red'}
                          </span>
                        </div>
                        {draft.result && draft.result !== 'pending' && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase
                            ${
                              draft.result === 'blue-win'
                                ? 'bg-blue-side/15 text-blue-side'
                                : draft.result === 'red-win'
                                ? 'bg-red-side/15 text-red-side'
                                : 'bg-bg-elevated text-text-muted'
                            }`}
                          >
                            {draft.result.replace('-', ' ')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted font-mono">
                        {new Date(draft.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card variant="default" className="text-center !py-12">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm text-text-secondary">No draft sessions yet</p>
              <p className="text-xs text-text-muted mt-1">
                Start your first draft to see it here
              </p>
              <Link href="/draft" className="inline-block mt-4">
                <Button id="start-first-draft-btn" variant="primary" size="sm">
                  ⚔ Start Draft
                </Button>
              </Link>
            </Card>
          )}
        </motion.div>

        {/* Team Identity Summary */}
        <motion.div variants={itemVariants} className="col-span-2">
          <h2 className="font-heading text-lg font-semibold text-text-primary mb-4">
            Team Identity
          </h2>
          {identity ? (
            <Card variant="elevated" glow glowColor="accent">
              <div className="space-y-4">
                <div>
                  <p className="font-heading font-bold text-lg text-text-primary">
                    {identity.name || 'Unnamed Team'}
                  </p>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mt-0.5">
                    Team Profile
                  </p>
                </div>

                {identity.playstyles.length > 0 && (
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1.5">
                      Playstyles
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {identity.playstyles.map((ps) => (
                        <span
                          key={ps}
                          className="px-2 py-1 text-[10px] rounded-md bg-accent/10 border border-accent/30 text-accent-hover font-medium"
                        >
                          {ps}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-bg-primary/50">
                    <p className="text-text-muted text-[10px] mb-0.5">Damage</p>
                    <p className="text-text-primary font-medium">{identity.damageProfile}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-bg-primary/50">
                    <p className="text-text-muted text-[10px] mb-0.5">Engage</p>
                    <p className="text-text-primary font-medium">{identity.engageLevel}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-bg-primary/50">
                    <p className="text-text-muted text-[10px] mb-0.5">Scaling</p>
                    <p className="text-text-primary font-medium">{identity.scalingPreference}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-bg-primary/50">
                    <p className="text-text-muted text-[10px] mb-0.5">Frontline</p>
                    <p className="text-text-primary font-medium">{identity.frontlineRequirement}</p>
                  </div>
                </div>

                <Link href="/identity">
                  <Button id="edit-identity-btn" variant="ghost" size="sm" fullWidth>
                    ✏️ Edit Identity
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card variant="default" className="text-center !py-12">
              <p className="text-2xl mb-2">🛡</p>
              <p className="text-sm text-text-secondary">No identity configured</p>
              <p className="text-xs text-text-muted mt-1 mb-4">
                Set up your team&apos;s playstyle and preferences
              </p>
              <Link href="/identity">
                <Button id="setup-identity-btn" variant="primary" size="sm">
                  Set Up Identity
                </Button>
              </Link>
            </Card>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
