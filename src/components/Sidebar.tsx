'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  disabled?: boolean;
  comingSoon?: boolean;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '⌂' },
  { href: '/draft', label: 'Draft Simulator', icon: '⚔' },
  { href: '/heroes', label: 'Hero Database', icon: '👤' },
  { href: '/identity', label: 'Team Identity', icon: '🛡' },
  { href: '/scouting', label: 'Scouting Portal', icon: '🔍' },
  { href: '/scrims', label: 'Scrims', icon: '📊' },
  { href: '/players', label: 'Players', icon: '👥', disabled: true, comingSoon: true },
  { href: '/notes', label: 'Notes', icon: '📝', disabled: true, comingSoon: true },
];

const sidebarVariants = {
  expanded: { width: 240 },
  collapsed: { width: 72 },
};

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside
      id="sidebar"
      className="h-screen flex flex-col bg-bg-surface border-r border-border z-40 flex-shrink-0"
      initial={false}
      animate={isCollapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center font-heading font-bold text-white text-lg flex-shrink-0">
          D
        </div>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="font-heading font-bold text-sm text-text-primary leading-tight">
                Draft Analyst
              </h1>
              <p className="text-[10px] text-text-muted font-mono">MLBB Pro</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                           text-text-muted/40 cursor-not-allowed select-none"
                title={item.comingSoon ? 'Coming Soon' : undefined}
              >
                <span className="text-lg flex-shrink-0 w-6 text-center">{item.icon}</span>
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {!isCollapsed && item.comingSoon && (
                  <span className="ml-auto text-[9px] bg-bg-elevated px-1.5 py-0.5 rounded text-text-muted uppercase tracking-wider">
                    Soon
                  </span>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-colors duration-200 group
                ${
                  isActive
                    ? 'text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-accent/15 border border-accent/30 rounded-lg"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative text-lg flex-shrink-0 w-6 text-center">{item.icon}</span>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-3 py-3 border-t border-border flex-shrink-0">
        <button
          id="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     text-text-muted hover:text-text-secondary hover:bg-bg-surface-hover
                     transition-colors duration-200 cursor-pointer"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.span
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{ duration: 0.3 }}
            className="text-sm"
          >
            »
          </motion.span>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-medium"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
