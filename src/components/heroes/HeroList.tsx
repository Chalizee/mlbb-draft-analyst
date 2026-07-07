'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHeroStore } from '@/stores/heroStore';
import type { Hero, HeroRole } from '@/types';
import SearchInput from '@/components/ui/SearchInput';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import HeroAvatar from '@/components/ui/HeroAvatar';

const roleTabs = [
  { id: 'All', label: 'All' },
  { id: 'Tank', label: 'Tank' },
  { id: 'Fighter', label: 'Fighter' },
  { id: 'Assassin', label: 'Assassin' },
  { id: 'Mage', label: 'Mage' },
  { id: 'Marksman', label: 'MM' },
  { id: 'Support', label: 'Support' },
];

export default function HeroList() {
  const {
    heroes,
    searchQuery,
    roleFilter,
    selectedHeroId,
    searchHeroes,
    filterByRole,
    selectHero,
  } = useHeroStore();

  const filteredHeroes = useMemo(() => {
    let list = heroes;
    if (roleFilter !== null) {
      list = list.filter(
        (h: Hero) => h.role === roleFilter || h.secondaryRole === roleFilter
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((h: Hero) => h.name.toLowerCase().includes(q));
    }
    return list.sort((a: Hero, b: Hero) => a.name.localeCompare(b.name));
  }, [heroes, roleFilter, searchQuery]);

  return (
    <div id="hero-list" className="flex flex-col h-full">
      {/* Search */}
      <div className="mb-4">
        <SearchInput
          id="hero-list-search"
          value={searchQuery}
          onChange={searchHeroes}
          placeholder="Search heroes..."
        />
      </div>

      {/* Role Filters */}
      <div className="mb-4 overflow-x-auto">
        <Tabs
          id="hero-list-role-filter"
          tabs={roleTabs}
          activeTab={roleFilter || 'All'}
          onTabChange={(id) => filterByRole(id === 'All' ? null : id as HeroRole)}
        />
      </div>

      {/* Results count */}
      <p className="text-xs text-text-muted mb-3">
        {filteredHeroes.length} hero{filteredHeroes.length !== 1 ? 'es' : ''} found
      </p>

      {/* Hero Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        <motion.div className="grid grid-cols-2 gap-2" layout>
          <AnimatePresence mode="popLayout">
            {filteredHeroes.map((hero: Hero) => {
              const isSelected = selectedHeroId === hero.id;

              return (
                <motion.button
                  key={hero.id}
                  id={`hero-list-item-${hero.id}`}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectHero(hero.id!)}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl border text-left
                    transition-all duration-200 cursor-pointer
                    ${
                      isSelected
                        ? 'bg-accent/10 border-accent glow-border-accent'
                        : 'bg-bg-surface hover:bg-bg-surface-hover border-border hover:border-border-bright'
                    }
                  `}
                >
                  {/* Avatar */}
                  <HeroAvatar
                    imageUrl={hero.imageUrl}
                    name={hero.name}
                    size="md"
                    glow={isSelected}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${
                      isSelected ? 'text-accent-hover' : 'text-text-primary'
                    }`}>
                      {hero.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge role={hero.role} size="sm" />
                      {hero.laneRecommendation[0] && (
                        <span className="text-[10px] text-text-muted">
                          {hero.laneRecommendation[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {filteredHeroes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm">No heroes found</p>
          </div>
        )}
      </div>
    </div>
  );
}
