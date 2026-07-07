'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTeamIdentityStore } from '@/stores/teamIdentityStore';
import { useHeroStore } from '@/stores/heroStore';
import type { PlaystyleType, DamageProfile, ScalingType, Hero } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

const PLAYSTYLE_OPTIONS: PlaystyleType[] = [
  'Teamfight Heavy',
  'Front-to-Back',
  'Pickoff',
  'Dive Composition',
  'Early Invade',
  'Scaling',
  'Split Push',
  'Poke',
];

const DAMAGE_PROFILES: DamageProfile[] = [
  'Physical Heavy',
  'Magic Heavy',
  'Balanced',
  'True Damage',
];

const ENGAGE_LEVELS = ['High', 'Medium', 'Low'] as const;
const SCALING_PREFS: ScalingType[] = ['Early', 'Mid', 'Late', 'Consistent'];
const FRONTLINE_REQS = ['Strong', 'Moderate', 'Flexible'] as const;

export default function IdentityEditor() {
  const { identity, loadIdentity, saveIdentity } = useTeamIdentityStore();
  const { heroes } = useHeroStore();

  const [teamName, setTeamName] = useState('');
  const [playstyles, setPlaystyles] = useState<PlaystyleType[]>([]);
  const [damageProfile, setDamageProfile] = useState<DamageProfile>('Balanced');
  const [engageLevel, setEngageLevel] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [scalingPreference, setScalingPreference] = useState<ScalingType>('Mid');
  const [frontlineRequirement, setFrontlineRequirement] = useState<'Strong' | 'Moderate' | 'Flexible'>('Moderate');
  const [priorityHeroes, setPriorityHeroes] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [heroSearchQuery, setHeroSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  useEffect(() => {
    if (identity) {
      Promise.resolve().then(() => {
        setTeamName(identity.name || '');
        setPlaystyles(identity.playstyles || []);
        setDamageProfile(identity.damageProfile || 'Balanced');
        setEngageLevel(identity.engageLevel || 'Medium');
        setScalingPreference(identity.scalingPreference || 'Mid');
        setFrontlineRequirement(identity.frontlineRequirement || 'Moderate');
        setPriorityHeroes(identity.priorityHeroes || []);
        setNotes(identity.notes || '');
      });
    }
  }, [identity]);

  const togglePlaystyle = (ps: PlaystyleType) => {
    setPlaystyles((prev) =>
      prev.includes(ps) ? prev.filter((p) => p !== ps) : [...prev, ps]
    );
  };

  const filteredHeroes = useMemo(() => {
    if (!heroSearchQuery.trim()) return [];
    const q = heroSearchQuery.toLowerCase();
    return heroes
      .filter(
        (h: Hero) =>
          h.name.toLowerCase().includes(q) && !priorityHeroes.includes(h.id!)
      )
      .slice(0, 8);
  }, [heroes, heroSearchQuery, priorityHeroes]);

  const addPriorityHero = (heroId: number) => {
    setPriorityHeroes((prev) => [...prev, heroId]);
    setHeroSearchQuery('');
  };

  const removePriorityHero = (heroId: number) => {
    setPriorityHeroes((prev) => prev.filter((id) => id !== heroId));
  };

  const getHeroName = (id: number) =>
    heroes.find((h: Hero) => h.id === id)?.name || 'Unknown';

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveIdentity({
        name: teamName,
        playstyles,
        damageProfile,
        engageLevel,
        scalingPreference,
        frontlineRequirement,
        priorityHeroes,
        notes,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      id="identity-editor"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-2xl"
    >
      {/* Team Name */}
      <Card variant="default" className="!p-5">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          Team Name
        </h4>
        <input
          id="identity-team-name"
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Enter your team name..."
          className="w-full bg-bg-elevated/50 border border-border rounded-xl py-3 px-4 text-lg
                     font-heading font-semibold text-text-primary placeholder-text-muted
                     focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
        />
      </Card>

      {/* Playstyles */}
      <Card variant="default" className="!p-5">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          🎯 Preferred Playstyles
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {PLAYSTYLE_OPTIONS.map((ps) => (
            <button
              key={ps}
              id={`playstyle-${ps.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => togglePlaystyle(ps)}
              className={`
                p-3 rounded-xl border text-sm font-medium text-left transition-all duration-200 cursor-pointer
                ${
                  playstyles.includes(ps)
                    ? 'bg-accent/15 border-accent/40 text-accent-hover'
                    : 'bg-bg-elevated/30 border-border/50 text-text-secondary hover:border-border-bright hover:bg-bg-surface-hover'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                    ${playstyles.includes(ps) ? 'border-accent bg-accent' : 'border-border-bright'}
                  `}
                >
                  {playstyles.includes(ps) && (
                    <span className="text-white text-[10px]">✓</span>
                  )}
                </div>
                {ps}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Damage Profile */}
      <Card variant="default" className="!p-5">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          💥 Damage Profile
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {DAMAGE_PROFILES.map((dp) => (
            <button
              key={dp}
              id={`damage-profile-${dp.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => setDamageProfile(dp)}
              className={`
                p-3 rounded-xl border text-sm font-medium text-center transition-all duration-200 cursor-pointer
                ${
                  damageProfile === dp
                    ? 'bg-accent/15 border-accent/40 text-accent-hover'
                    : 'bg-bg-elevated/30 border-border/50 text-text-secondary hover:border-border-bright'
                }
              `}
            >
              {dp}
            </button>
          ))}
        </div>
      </Card>

      {/* Engage Level */}
      <Card variant="default" className="!p-5">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          ⚡ Engage Level
        </h4>
        <div className="flex gap-2">
          {ENGAGE_LEVELS.map((level) => (
            <button
              key={level}
              id={`engage-level-${level.toLowerCase()}`}
              onClick={() => setEngageLevel(level)}
              className={`
                flex-1 py-3 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer
                ${
                  engageLevel === level
                    ? 'bg-accent/15 border-accent/40 text-accent-hover'
                    : 'bg-bg-elevated/30 border-border/50 text-text-secondary hover:border-border-bright'
                }
              `}
            >
              {level}
            </button>
          ))}
        </div>
      </Card>

      {/* Scaling Preference */}
      <Card variant="default" className="!p-5">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          📈 Scaling Preference
        </h4>
        <div className="flex gap-2">
          {SCALING_PREFS.map((pref) => (
            <button
              key={pref}
              id={`scaling-pref-${pref.toLowerCase()}`}
              onClick={() => setScalingPreference(pref)}
              className={`
                flex-1 py-3 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer
                ${
                  scalingPreference === pref
                    ? 'bg-accent/15 border-accent/40 text-accent-hover'
                    : 'bg-bg-elevated/30 border-border/50 text-text-secondary hover:border-border-bright'
                }
              `}
            >
              {pref}
            </button>
          ))}
        </div>
      </Card>

      {/* Frontline Requirement */}
      <Card variant="default" className="!p-5">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          🛡 Frontline Requirement
        </h4>
        <div className="flex gap-2">
          {FRONTLINE_REQS.map((req) => (
            <button
              key={req}
              id={`frontline-req-${req.toLowerCase()}`}
              onClick={() => setFrontlineRequirement(req)}
              className={`
                flex-1 py-3 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer
                ${
                  frontlineRequirement === req
                    ? 'bg-accent/15 border-accent/40 text-accent-hover'
                    : 'bg-bg-elevated/30 border-border/50 text-text-secondary hover:border-border-bright'
                }
              `}
            >
              {req}
            </button>
          ))}
        </div>
      </Card>

      {/* Priority Heroes */}
      <Card variant="default" className="!p-5">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          ⭐ Priority Heroes
        </h4>

        {/* Added Heroes */}
        {priorityHeroes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {priorityHeroes.map((heroId) => (
              <motion.div
                key={heroId}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30"
              >
                <span className="text-sm font-medium text-text-primary">
                  {getHeroName(heroId)}
                </span>
                <button
                  onClick={() => removePriorityHero(heroId)}
                  className="text-text-muted hover:text-danger transition-colors text-xs cursor-pointer"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <input
            id="priority-hero-search"
            type="text"
            value={heroSearchQuery}
            onChange={(e) => setHeroSearchQuery(e.target.value)}
            placeholder="Search heroes to add..."
            className="w-full bg-bg-elevated/50 border border-border rounded-xl py-2.5 px-4 text-sm
                       text-text-primary placeholder-text-muted focus:outline-none focus:border-accent
                       focus:ring-1 focus:ring-accent/30 transition-all"
          />
          {filteredHeroes.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-bg-surface
                            shadow-xl shadow-black/30 overflow-hidden z-10 max-h-48 overflow-y-auto">
              {filteredHeroes.map((hero: Hero) => (
                <button
                  key={hero.id}
                  onClick={() => addPriorityHero(hero.id!)}
                  className="w-full text-left px-4 py-2.5 text-sm text-text-secondary
                             hover:text-text-primary hover:bg-bg-surface-hover transition-colors
                             cursor-pointer border-b border-border/30 last:border-b-0"
                >
                  {hero.name}
                  <span className="text-[10px] text-text-muted ml-2">{hero.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Notes */}
      <Card variant="default" className="!p-5">
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3">
          📝 Notes
        </h4>
        <textarea
          id="identity-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Team strategy notes, general observations..."
          className="w-full h-32 bg-bg-elevated/50 border border-border rounded-xl p-4 text-sm text-text-primary
                     placeholder-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1
                     focus:ring-accent/30 transition-all"
        />
      </Card>

      {/* Save Button */}
      <Button
        id="identity-save-btn"
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleSave}
        loading={saving}
      >
        💾 Save Team Identity
      </Button>
    </motion.div>
  );
}
