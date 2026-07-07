'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Hero, HeroRole } from '@/types';
import Badge from '@/components/ui/Badge';
import SearchInput from '@/components/ui/SearchInput';
import Tabs from '@/components/ui/Tabs';
import HeroAvatar from '@/components/ui/HeroAvatar';

interface HeroGridProps {
  heroes: Hero[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  roleFilter: HeroRole | 'All';
  onRoleFilterChange: (role: HeroRole | 'All') => void;
  selectedHeroId: number | null;
  onHeroSelect: (heroId: number) => void;
  disabledHeroIds: number[];
}

const roleTabs = [
  { id: 'All', label: 'All' },
  { id: 'Tank', label: 'Tank' },
  { id: 'Fighter', label: 'Fighter' },
  { id: 'Assassin', label: 'Assassin' },
  { id: 'Mage', label: 'Mage' },
  { id: 'Marksman', label: 'MM' },
  { id: 'Support', label: 'Support' },
];

export default function HeroGrid({
  heroes,
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  selectedHeroId,
  onHeroSelect,
  disabledHeroIds,
}: HeroGridProps) {
  const filteredHeroes = useMemo(() => {
    let list = heroes;
    if (roleFilter !== 'All') {
      list = list.filter((h) => h.role === roleFilter || h.secondaryRole === roleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [heroes, roleFilter, searchQuery]);

  return (
    <div id="hero-grid" className="flex flex-col h-full">
      {/* Search */}
      <div className="mb-3">
        <SearchInput
          id="draft-hero-search"
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search heroes..."
        />
      </div>

      {/* Role Filter Tabs */}
      <div className="mb-3 overflow-x-auto">
        <Tabs
          id="role-filter-tabs"
          tabs={roleTabs}
          activeTab={roleFilter}
          onTabChange={(id) => onRoleFilterChange(id as HeroRole | 'All')}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        <motion.div
          className="grid grid-cols-4 gap-2"
          layout
        >
          <AnimatePresence mode="popLayout">
            {filteredHeroes.map((hero) => {
              const isDisabled = disabledHeroIds.includes(hero.id!);
              const isSelected = selectedHeroId === hero.id;

              return (
                <motion.button
                  key={hero.id}
                  id={`hero-card-${hero.id}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  whileHover={isDisabled ? {} : { scale: 1.05 }}
                  whileTap={isDisabled ? {} : { scale: 0.95 }}
                  onClick={() => !isDisabled && onHeroSelect(hero.id!)}
                  disabled={isDisabled}
                  className={`
                    relative flex flex-col items-center gap-1.5 p-3 rounded-xl border
                    transition-all duration-200 cursor-pointer text-center
                    ${
                      isDisabled
                        ? 'opacity-30 cursor-not-allowed bg-bg-elevated/30 border-border/30'
                        : isSelected
                        ? 'bg-accent/15 border-accent glow-border-accent'
                        : 'bg-bg-surface hover:bg-bg-surface-hover border-border hover:border-border-bright'
                    }
                  `}
                >
                  {/* Hero Avatar */}
                  <HeroAvatar
                    imageUrl={hero.imageUrl}
                    name={hero.name}
                    size="md"
                    glow={isSelected}
                    className={isDisabled ? 'opacity-40' : ''}
                  />

                  {/* Hero Name */}
                  <p className={`text-[11px] font-medium leading-tight truncate w-full ${
                    isDisabled ? 'text-text-muted/30' : 'text-text-primary'
                  }`}>
                    {hero.name}
                  </p>

                  {/* Role Badge */}
                  <Badge role={hero.role} size="sm" />

                  {/* Disabled overlay */}
                  {isDisabled && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                      <span className="text-red-side/30 text-xl font-bold">✕</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {filteredHeroes.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">
            No heroes found
          </div>
        )}
      </div>
    </div>
  );
}
