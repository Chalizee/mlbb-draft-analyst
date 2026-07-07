'use client';

import React, { useState, useEffect } from 'react';

interface HeroAvatarProps {
  imageUrl?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  glow?: boolean;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-[10px] rounded-md',
  sm: 'w-8 h-8 text-xs rounded-lg',
  md: 'w-10 h-10 text-sm rounded-xl',
  lg: 'w-16 h-16 text-2xl rounded-2xl',
  xl: 'w-20 h-20 text-3xl rounded-2xl',
};

export default function HeroAvatar({
  imageUrl,
  name,
  size = 'md',
  className = '',
  glow = false,
}: HeroAvatarProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(!imageUrl);
  const [attempt, setAttempt] = useState<number>(0); // 0 = wsrv.nl, 1 = images.weserv.nl, 2 = direct URL

  // If the image URL changes, reset states
  useEffect(() => {
    Promise.resolve().then(() => {
      setLoading(!!imageUrl);
      setError(!imageUrl);
      setAttempt(0);
    });
  }, [imageUrl]);

  const initials = name.substring(0, 2).toUpperCase();

  // Compute the optimal source URL based on the current attempt index.
  // We use Cloudflare-backed proxies (wsrv.nl / images.weserv.nl) to bypass Fandom hotlinking protection.
  const getSrc = () => {
    if (!imageUrl) return undefined;
    if (!imageUrl.includes('static.wikia.nocookie.net')) {
      return imageUrl; // Non-Fandom URLs don't need proxying
    }

    const cleanUrl = imageUrl.replace(/^https?:\/\//, '');
    const encoded = encodeURIComponent(cleanUrl);

    if (attempt === 0) {
      return `https://wsrv.nl/?url=${encoded}&w=120&h=120&fit=cover`;
    }
    if (attempt === 1) {
      return `https://images.weserv.nl/?url=${encoded}&w=120&h=120&fit=cover`;
    }
    return imageUrl; // Direct Wikia URL fallback (uses referrerPolicy="no-referrer")
  };

  const currentSrc = getSrc();

  const handleImageError = () => {
    if (imageUrl && imageUrl.includes('static.wikia.nocookie.net')) {
      if (attempt < 2) {
        console.warn(`[HeroAvatar] Fallback triggered for ${name} at attempt index ${attempt}. Trying next source.`);
        setAttempt(prev => prev + 1);
        setLoading(true);
        return;
      }
    }
    // All modes failed, fallback to initials
    setError(true);
    setLoading(false);
  };

  return (
    <div
      className={`
        relative overflow-hidden flex items-center justify-center font-heading font-bold select-none flex-shrink-0
        ${sizeClasses[size]}
        ${
          error
            ? 'bg-bg-elevated text-text-secondary border border-border/50'
            : 'bg-bg-elevated/40 border border-border/20'
        }
        ${glow ? 'shadow-[0_0_15px_rgba(99,102,241,0.25)] border-accent/40' : ''}
        ${className}
      `}
    >
      {/* Background Shimmer while Loading */}
      {loading && !error && (
        <div className="absolute inset-0 bg-gradient-to-r from-bg-surface via-bg-elevated to-bg-surface bg-[length:200%_100%] animate-[shimmer_1.5s_infinite] z-10" />
      )}

      {/* Hero Image */}
      {currentSrc && !error && (
        <img
          src={currentSrc}
          alt={name}
          referrerPolicy="no-referrer"
          onLoad={() => setLoading(false)}
          onError={handleImageError}
          className={`
            w-full h-full object-cover transition-all duration-300
            ${loading ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}
          `}
        />
      )}

      {/* Styled Initials Fallback (Triggered offline or if image fails) */}
      {error && (
        <span className="relative z-0 tracking-wider">
          {initials}
        </span>
      )}
    </div>
  );
}
