'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './GoldCheckpoint.module.css';

interface GoldCheckpointProps {
  minute: 5 | 10 | 15;
  ourGold: number;
  enemyGold: number;
  onOurGoldChange: (totalGold: number) => void;
  onEnemyGoldChange: (totalGold: number) => void;
  disabled?: boolean;
}

function formatGoldInput(totalGold: number) {
  if (!totalGold) return '';
  return (totalGold / 1_000).toFixed(2).replace(/\.?0+$/, '');
}

function parseGoldInput(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 1_000) : null;
}

function formatDifference(difference: number) {
  const value = Math.abs(difference) / 1_000;
  return `${value.toFixed(2).replace(/\.?0+$/, '')}K`;
}

export default function GoldCheckpoint({
  minute,
  ourGold,
  enemyGold,
  onOurGoldChange,
  onEnemyGoldChange,
  disabled = false,
}: GoldCheckpointProps) {
  const hasBothTotals = ourGold > 0 && enemyGold > 0;
  const difference = ourGold - enemyGold;
  const tone = !hasBothTotals
    ? 'pending'
    : difference > 0
      ? 'ours'
      : difference < 0
        ? 'enemy'
        : 'even';
  const result = !hasBothTotals
    ? 'Isi kedua total gold'
    : difference > 0
      ? `OUR LEAD +${formatDifference(difference)}`
      : difference < 0
        ? `ENEMY LEAD +${formatDifference(difference)}`
        : 'EVEN · 0K';

  return (
    <article className={styles.card}>
      <header>
        <strong>@ {minute} MIN</strong>
        <span>TOTAL GOLD</span>
      </header>
      <div className={styles.inputs}>
        <GoldInput
          label="Our gold"
          value={ourGold}
          onChange={onOurGoldChange}
          disabled={disabled}
        />
        <GoldInput
          label="Enemy gold"
          value={enemyGold}
          onChange={onEnemyGoldChange}
          disabled={disabled}
        />
      </div>
      <div className={styles.result} data-tone={tone}>
        <small>AUTO DIFFERENCE</small>
        <b>{result}</b>
      </div>
    </article>
  );
}

function GoldInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (totalGold: number) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(() => formatGoldInput(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(formatGoldInput(value));
  }, [value]);

  return (
    <label className={styles.inputField}>
      <span>{label}</span>
      <div>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          disabled={disabled}
          placeholder="15.9"
          aria-label={`${label} in thousands`}
          onFocus={() => {
            focused.current = true;
          }}
          onChange={(event) => {
            const nextDraft = event.target.value;
            setDraft(nextDraft);
            const parsed = parseGoldInput(nextDraft);
            if (parsed !== null) onChange(parsed);
          }}
          onBlur={() => {
            focused.current = false;
            const parsed = parseGoldInput(draft);
            if (parsed === null) {
              setDraft(formatGoldInput(value));
              return;
            }
            setDraft(formatGoldInput(parsed));
          }}
        />
        <b>K</b>
      </div>
    </label>
  );
}
