'use client';

import { useEffect, useRef, useState } from 'react';

interface PlayerStatInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  allowCompact?: boolean;
  disabled?: boolean;
}

function formatStatValue(value: number, useGrouping: boolean) {
  if (!value) return '';
  return useGrouping ? value.toLocaleString('en-US') : String(value);
}

function parseStatValue(rawValue: string, allowCompact: boolean) {
  const normalized = rawValue.trim().toLowerCase().replace(/\s+/g, '');
  if (!normalized) return 0;

  if (allowCompact && normalized.endsWith('k')) {
    const compactValue = normalized.slice(0, -1).replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(compactValue)) return null;
    const parsed = Number(compactValue);
    return Number.isFinite(parsed) ? Math.round(parsed * 1_000) : null;
  }

  if (/^\d+$/.test(normalized)) return Number(normalized);

  if (/^\d{1,3}([,.]\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/[,.]/g, ''));
  }

  return null;
}

export default function PlayerStatInput({
  value,
  onChange,
  label,
  allowCompact = false,
  disabled = false,
}: PlayerStatInputProps) {
  const [draft, setDraft] = useState(() =>
    formatStatValue(value, allowCompact),
  );
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(formatStatValue(value, allowCompact));
  }, [allowCompact, value]);

  return (
    <input
      type="text"
      inputMode={allowCompact ? 'decimal' : 'numeric'}
      autoComplete="off"
      spellCheck={false}
      value={draft}
      disabled={disabled}
      placeholder={allowCompact ? '12500 / 12.5k' : '0'}
      title={
        allowCompact
          ? 'Type an exact number (12500) or compact value (12.5k)'
          : label
      }
      aria-label={label}
      onFocus={(event) => {
        focused.current = true;
        setDraft(value ? String(value) : '');
        const input = event.currentTarget;
        window.requestAnimationFrame(() => input.select());
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        const parsed = parseStatValue(nextDraft, allowCompact);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => {
        focused.current = false;
        const parsed = parseStatValue(draft, allowCompact);
        if (parsed === null) {
          setDraft(formatStatValue(value, allowCompact));
          return;
        }
        onChange(parsed);
        setDraft(formatStatValue(parsed, allowCompact));
      }}
    />
  );
}
