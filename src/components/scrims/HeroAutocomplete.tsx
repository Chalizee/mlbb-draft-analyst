'use client';

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { HERO_DATA } from '@/data/heroData';
import HeroAvatar from '@/components/ui/HeroAvatar';
import styles from './HeroAutocomplete.module.css';

const HERO_ALIASES: Record<string, string[]> = {
  Zetian: ['Wu Zetian'],
};

const SORTED_HEROES = [...HERO_DATA].sort((a, b) =>
  a.name.localeCompare(b.name),
);

function normalizeHeroName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function heroSearchText(hero: (typeof HERO_DATA)[number]) {
  return normalizeHeroName(
    [hero.name, hero.slug, ...(HERO_ALIASES[hero.name] ?? [])].join(' '),
  );
}

interface HeroAutocompleteProps {
  label: string;
  value: string[];
  onChange: (heroes: string[]) => void;
  placeholder: string;
  slotPrefix: 'P' | 'B';
  maxSelections?: number;
  unavailableNames?: string[];
  disabled?: boolean;
}

interface PlayerHeroSelectProps {
  value: string;
  ourPicks: string[];
  unavailableNames?: string[];
  onChange: (heroName: string) => void;
  label: string;
  disabled?: boolean;
}

export default function HeroAutocomplete({
  label,
  value,
  onChange,
  placeholder,
  slotPrefix,
  maxSelections = 5,
  unavailableNames = [],
  disabled = false,
}: HeroAutocompleteProps) {
  const inputId = useId();
  const listboxId = `${inputId}-options`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedNames = useMemo(
    () => new Set(value.map(normalizeHeroName)),
    [value],
  );
  const unavailable = useMemo(
    () => new Set(unavailableNames.map(normalizeHeroName)),
    [unavailableNames],
  );
  const normalizedQuery = normalizeHeroName(query);

  const suggestions = useMemo(() => {
    const tokens = normalizedQuery.split(' ').filter(Boolean);

    return SORTED_HEROES.filter((hero) => {
      const heroKey = normalizeHeroName(hero.name);
      if (selectedNames.has(heroKey) || unavailable.has(heroKey)) return false;
      if (tokens.length === 0) return true;

      const searchText = heroSearchText(hero);
      return tokens.every((token) => searchText.includes(token));
    })
      .sort((a, b) => {
        if (!normalizedQuery) return a.name.localeCompare(b.name);
        const aStarts = heroSearchText(a).startsWith(normalizedQuery);
        const bStarts = heroSearchText(b).startsWith(normalizedQuery);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [normalizedQuery, selectedNames, unavailable]);

  const maxReached = value.length >= maxSelections;
  const showMenu = isOpen && !maxReached && !disabled;

  function selectHero(heroName: string) {
    if (disabled || maxReached || selectedNames.has(normalizeHeroName(heroName))) {
      return;
    }

    onChange([...value, heroName]);
    setQuery('');
    setActiveIndex(0);
    setIsOpen(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function removeHero(index: number) {
    if (disabled) return;
    onChange(value.filter((_, currentIndex) => currentIndex !== index));
    setQuery('');
    setActiveIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        suggestions.length === 0 ? 0 : (current + 1) % suggestions.length,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        suggestions.length === 0
          ? 0
          : (current - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }

    if ((event.key === 'Enter' || event.key === ',') && suggestions.length > 0) {
      event.preventDefault();
      selectHero(suggestions[Math.min(activeIndex, suggestions.length - 1)].name);
      return;
    }

    if (event.key === 'Backspace' && query.length === 0 && value.length > 0) {
      event.preventDefault();
      removeHero(value.length - 1);
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  }

  return (
    <div
      className={styles.field}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
          setQuery('');
        }
      }}
    >
      <div className={styles.labelRow}>
        <label htmlFor={inputId}>{label}</label>
        <span>
          {value.length}/{maxSelections}
        </span>
      </div>

      <div
        className={`${styles.control} ${isOpen ? styles.focused : ''} ${
          disabled ? styles.disabled : ''
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((heroName, index) => {
          const hero = HERO_DATA.find(
            (item) => normalizeHeroName(item.name) === normalizeHeroName(heroName),
          );

          return (
            <span className={styles.chip} key={`${heroName}-${index}`}>
              <b>{slotPrefix}{index + 1}</b>
              <HeroAvatar
                imageUrl={hero?.imageUrl}
                name={heroName}
                size="xs"
                className={styles.avatar}
              />
              <span>{heroName}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${heroName}`}
                  title={`Remove ${heroName}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeHero(index);
                  }}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}

        {!maxReached && (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-expanded={showMenu}
            aria-controls={listboxId}
            aria-activedescendant={
              showMenu && suggestions[activeIndex]
                ? `${listboxId}-${activeIndex}`
                : undefined
            }
            value={query}
            disabled={disabled}
            placeholder={value.length === 0 ? placeholder : 'Tambah hero…'}
            onFocus={() => setIsOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>

      {showMenu && (
        <div className={styles.menu} id={listboxId} role="listbox">
          {suggestions.length > 0 ? (
            suggestions.map((hero, index) => (
              <button
                id={`${listboxId}-${index}`}
                className={index === activeIndex ? styles.activeOption : ''}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                key={hero.slug}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectHero(hero.name)}
              >
                <HeroAvatar
                  imageUrl={hero.imageUrl}
                  name={hero.name}
                  size="sm"
                />
                <span>
                  <strong>{hero.name}</strong>
                  <small>
                    {hero.role} · {hero.laneRecommendation.join(' / ')}
                  </small>
                </span>
                <b>+ ADD</b>
              </button>
            ))
          ) : (
            <p>
              Hero “{query.trim()}” tidak ada di database.
            </p>
          )}
        </div>
      )}

      <small className={styles.hint}>
        Ketik nama hero lalu klik pilihan. Backspace menghapus pilihan terakhir.
      </small>
    </div>
  );
}

export function PlayerHeroSelect({
  value,
  ourPicks,
  unavailableNames = [],
  onChange,
  label,
  disabled = false,
}: PlayerHeroSelectProps) {
  const unavailable = new Set(unavailableNames.map(normalizeHeroName));
  const hasPicks = ourPicks.length > 0;

  return (
    <select
      className={styles.playerSelect}
      aria-label={label}
      value={value}
      disabled={disabled || !hasPicks}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">
        {hasPicks ? 'Select our pick' : 'Fill Our Picks first'}
      </option>
      {ourPicks.map((heroName, index) => (
        <option
          value={heroName}
          key={`${heroName}-${index}`}
          disabled={
            normalizeHeroName(heroName) !== normalizeHeroName(value) &&
            unavailable.has(normalizeHeroName(heroName))
          }
        >
          {slotLabel(index)} · {heroName}
        </option>
      ))}
    </select>
  );
}

function slotLabel(index: number) {
  return `P${index + 1}`;
}
