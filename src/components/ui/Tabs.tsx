'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  id?: string;
}

export default function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  id = 'tabs',
}: TabsProps) {
  return (
    <div
      id={id}
      className={`flex items-center gap-1 p-1 bg-bg-surface rounded-xl border border-border ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            id={`${id}-${tab.id}`}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={`
              relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer
              ${
                tab.disabled
                  ? 'text-text-muted/50 cursor-not-allowed'
                  : isActive
                  ? 'text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }
            `}
          >
            {isActive && (
              <motion.div
                layoutId={`tab-indicator-${id}`}
                className="absolute inset-0 bg-accent rounded-lg"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
