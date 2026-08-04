'use client';

import { useId } from 'react';
import type { ScrimRole } from '@/lib/scrimDatabase';
import styles from './SmartPlayerInput.module.css';

interface PlayerNameInputProps {
  role: ScrimRole;
  value: string;
  suggestions: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

interface SmartInputActionsProps {
  hasLineup: boolean;
  hasPicks: boolean;
  disabled?: boolean;
  message?: string;
  onFillLineup: () => void;
  onAssignHeroes: () => void;
}

export function PlayerNameInput({
  role,
  value,
  suggestions,
  disabled = false,
  onChange,
}: PlayerNameInputProps) {
  const inputId = useId();
  const listId = `${inputId}-roster`;

  return (
    <>
      <input
        id={inputId}
        list={suggestions.length > 0 ? listId : undefined}
        value={value}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        placeholder={`${role} player`}
        title={
          suggestions.length > 0
            ? 'Ketik atau pilih nama roster yang pernah dipakai'
            : 'Ketik nama pemain sekali; game berikutnya akan menyalinnya'
        }
        onChange={(event) => onChange(event.target.value)}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((name) => (
            <option value={name} key={name} />
          ))}
        </datalist>
      )}
    </>
  );
}

export function SmartInputActions({
  hasLineup,
  hasPicks,
  disabled = false,
  message = '',
  onFillLineup,
  onAssignHeroes,
}: SmartInputActionsProps) {
  return (
    <div className={styles.assistant}>
      <div className={styles.copy}>
        <span>SMART INPUT</span>
        <p>
          Ambil roster terakhir dan cocokkan Our Picks ke role yang jelas. Flex
          pick tetap dipilih manual.
        </p>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={disabled || !hasLineup}
          onClick={onFillLineup}
        >
          ↻ Fill last lineup
        </button>
        <button
          type="button"
          disabled={disabled || !hasPicks}
          onClick={onAssignHeroes}
        >
          ✦ Auto assign heroes
        </button>
      </div>
      {message && <small className={styles.message}>{message}</small>}
    </div>
  );
}
