'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  id?: string;
}

export default function SearchInput({
  value: controlledValue,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className = '',
  id = 'search-input',
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (controlledValue !== undefined) {
      Promise.resolve().then(() => {
        setInternalValue(controlledValue);
      });
    }
  }, [controlledValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInternalValue(val);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(val);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChange('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">
        🔍
      </span>
      <input
        id={id}
        type="text"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full bg-bg-surface border border-border rounded-lg py-2.5 pl-10 pr-9
                   text-sm text-text-primary placeholder-text-muted
                   focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
                   transition-all duration-200"
      />
      {internalValue && (
        <button
          id={`${id}-clear`}
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary
                     transition-colors duration-150 text-sm cursor-pointer"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
