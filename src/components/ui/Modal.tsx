'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  id?: string;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
} as const;

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
} as const;

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  id = 'modal',
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={id}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            variants={backdropVariants}
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            className={`relative w-full ${maxWidth} glass-card-elevated p-0 overflow-hidden`}
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="font-heading text-lg font-semibold text-text-primary">
                  {title}
                </h3>
                <button
                  id={`${id}-close`}
                  onClick={onClose}
                  className="text-text-muted hover:text-text-secondary transition-colors
                             w-8 h-8 flex items-center justify-center rounded-lg
                             hover:bg-bg-surface-hover cursor-pointer"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-6">{children}</div>

            {/* Close button if no title */}
            {!title && (
              <button
                id={`${id}-close`}
                onClick={onClose}
                className="absolute top-3 right-3 text-text-muted hover:text-text-secondary
                           transition-colors w-8 h-8 flex items-center justify-center
                           rounded-lg hover:bg-bg-surface-hover cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
