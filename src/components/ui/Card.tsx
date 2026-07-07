'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type CardVariant = 'default' | 'elevated' | 'interactive';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: CardVariant;
  glow?: boolean;
  glowColor?: 'accent' | 'blue' | 'red';
  children: React.ReactNode;
  className?: string;
  id?: string;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'glass-card',
  elevated: 'glass-card-elevated',
  interactive: 'glass-card-interactive',
};

const glowClasses: Record<string, string> = {
  accent: 'glow-border-accent',
  blue: 'glow-border-blue',
  red: 'glow-border-red',
};

export default function Card({
  variant = 'default',
  glow = false,
  glowColor = 'accent',
  children,
  className = '',
  id,
  ...motionProps
}: CardProps) {
  const baseClass = variantClasses[variant];
  const glowClass = glow ? glowClasses[glowColor] : '';

  const hoverAnimation =
    variant === 'interactive'
      ? {
          whileHover: { y: -2, transition: { duration: 0.2 } },
          whileTap: { scale: 0.98 },
        }
      : {};

  return (
    <motion.div
      id={id}
      className={`${baseClass} ${glowClass} p-5 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      {...hoverAnimation}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
