'use client';

import React from 'react';
import type { HeroRole } from '@/types';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  role?: HeroRole;
  label?: string;
  variant?: 'role' | 'status' | 'custom';
  color?: string;
  size?: BadgeSize;
  className?: string;
  id?: string;
}

const roleColors: Record<HeroRole, { bg: string; text: string; border: string }> = {
  Tank: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  Fighter: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  Assassin: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  Mage: {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
  Marksman: {
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  Support: {
    bg: 'bg-green-500/15',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export default function Badge({
  role,
  label,
  variant = 'role',
  size = 'sm',
  className = '',
  id,
}: BadgeProps) {
  if (variant === 'role' && role) {
    const colors = roleColors[role];
    return (
      <span
        id={id}
        className={`
          inline-flex items-center font-semibold uppercase tracking-wider
          rounded-md border
          ${colors.bg} ${colors.text} ${colors.border}
          ${sizeStyles[size]}
          ${className}
        `}
      >
        {label || role}
      </span>
    );
  }

  return (
    <span
      id={id}
      className={`
        inline-flex items-center font-medium uppercase tracking-wider
        rounded-md border bg-bg-surface text-text-secondary border-border
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {label || 'Badge'}
    </span>
  );
}
