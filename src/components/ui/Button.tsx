'use client';

import React from 'react';
import { motion } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'blue' | 'red';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20',
  secondary:
    'bg-bg-surface hover:bg-bg-surface-hover text-text-primary border border-border hover:border-border-bright',
  ghost:
    'bg-transparent hover:bg-bg-surface-hover text-text-secondary hover:text-text-primary',
  danger:
    'bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 hover:border-danger/50',
  blue:
    'bg-blue-side/10 hover:bg-blue-side/20 text-blue-side border border-blue-side/30 hover:border-blue-side/50',
  red:
    'bg-red-side/10 hover:bg-red-side/20 text-red-side border border-red-side/30 hover:border-red-side/50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  children,
  disabled,
  className = '',
  id,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      id={id}
      whileHover={isDisabled ? {} : { scale: 1.02 }}
      whileTap={isDisabled ? {} : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={`
        inline-flex items-center justify-center font-medium
        transition-colors duration-200 cursor-pointer
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
        ${className}
      `}
      disabled={isDisabled}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...(props as any)}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
      {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </motion.button>
  );
}
