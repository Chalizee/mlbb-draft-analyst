'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import HeroList from '@/components/heroes/HeroList';
import HeroDetailPanel from '@/components/heroes/HeroDetailPanel';
import { useHeroStore } from '@/stores/heroStore';

export default function HeroesPage() {
  const { loadHeroes } = useHeroStore();

  useEffect(() => {
    loadHeroes();
  }, [loadHeroes]);

  return (
    <div id="heroes-page" className="h-full flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-8 py-5 border-b border-border"
      >
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          Hero Database
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Browse, search, and manage hero relationships and analyst notes.
        </p>
      </motion.div>

      {/* Two-Column Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Hero List (60%) */}
        <div className="w-[55%] border-r border-border p-5 overflow-hidden flex flex-col">
          <HeroList />
        </div>

        {/* Right: Hero Detail Panel (40%) */}
        <div className="w-[45%] bg-bg-surface/30 overflow-hidden">
          <HeroDetailPanel />
        </div>
      </div>
    </div>
  );
}
