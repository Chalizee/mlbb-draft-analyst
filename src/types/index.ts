// ========================
// MLBB Draft Analyst Types
// ========================

// Hero Roles
export type HeroRole = 'Tank' | 'Fighter' | 'Assassin' | 'Mage' | 'Marksman' | 'Support';

// Competitive lane positions
export type LanePosition = 'Roam' | 'Jungle' | 'Mid' | 'Gold' | 'EXP';

// Damage types
export type DamageType = 'Physical' | 'Magic' | 'Mixed' | 'True';

// Scaling type
export type ScalingType = 'Early' | 'Mid' | 'Late' | 'Consistent';

// Teamfight style
export type TeamfightStyle = 'Engage' | 'Poke' | 'Burst' | 'Sustain' | 'Split' | 'Protect' | 'Dive';

// Side preference
export type SidePreference = 'Blue' | 'Red' | 'Neutral';

// ========================
// Hero
// ========================
export interface Hero {
  id?: number;
  name: string;
  slug: string;
  role: HeroRole;
  secondaryRole?: HeroRole;
  specialty: string;
  laneRecommendation: LanePosition[];
  damageType: DamageType;
  scalingType: ScalingType;
  teamfightStyle: TeamfightStyle;
  imageUrl?: string;
}

// ========================
// Hero Relationships
// ========================
export type RelationshipType = 'counter' | 'synergy' | 'weakness';

export interface HeroRelationship {
  id?: number;
  heroId: number;
  relatedHeroId: number;
  type: RelationshipType;
  notes: string;
  strength: number; // 1-5
}

// ========================
// Hero Notes
// ========================
export interface HeroNote {
  id?: number;
  heroId: number;
  content: string;
  tags: string[];
  firstPickViability: 'Strong' | 'Situational' | 'Weak' | 'Unknown';
  sidePreference: SidePreference;
  createdAt: Date;
  updatedAt: Date;
}

// ========================
// Draft
// ========================
export type DraftActionType = 'ban' | 'pick';
export type DraftSide = 'blue' | 'red';
export type DraftFormat = 'standard' | 'brave-draft';

export interface DraftStep {
  index: number;
  action: DraftActionType;
  side: DraftSide;
  phase: 1 | 2;
  label: string;
}

export interface DraftAction {
  step: DraftStep;
  heroId: number | null;
  timestamp: Date;
}

export type DraftPhase = 'ban-phase-1' | 'pick-phase-1' | 'ban-phase-2' | 'pick-phase-2' | 'complete';

export interface DraftSession {
  id?: number;
  blueSideName: string;
  redSideName: string;
  draftActions: DraftAction[];
  blueBans: number[];
  redBans: number[];
  bluePicks: number[];
  redPicks: number[];
  result?: 'blue-win' | 'red-win' | 'draw' | 'pending';
  notes: string;
  format: DraftFormat;
  scrimId?: number;
  createdAt: Date;
}

// ========================
// Team Identity
// ========================
export type PlaystyleType = 
  | 'Teamfight Heavy'
  | 'Front-to-Back'
  | 'Pickoff'
  | 'Dive Composition'
  | 'Early Invade'
  | 'Scaling'
  | 'Split Push'
  | 'Poke';

export type DamageProfile = 'Physical Heavy' | 'Magic Heavy' | 'Balanced' | 'True Damage';

export interface TeamIdentity {
  id?: number;
  name: string;
  playstyles: PlaystyleType[];
  priorityHeroes: number[]; // hero IDs
  damageProfile: DamageProfile;
  engageLevel: 'High' | 'Medium' | 'Low';
  scalingPreference: ScalingType;
  frontlineRequirement: 'Strong' | 'Moderate' | 'Flexible';
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftWarning {
  type: 'danger' | 'warning' | 'info';
  message: string;
  category: 'engage' | 'damage' | 'frontline' | 'scaling' | 'identity' | 'synergy';
}

// ========================
// Scrims
// ========================
export interface Scrim {
  id?: number;
  date: Date;
  opponentId: number;
  draftSessionId?: number;
  result: 'win' | 'loss' | 'draw';
  notes: string;
  heroPerformance: HeroPerformanceEntry[];
  banPriorities: number[]; // hero IDs
  createdAt: Date;
}

export interface HeroPerformanceEntry {
  heroId: number;
  playerId: number;
  kills: number;
  deaths: number;
  assists: number;
  rating: number; // 1-10
  notes: string;
}

// ========================
// Opponents
// ========================
export interface Opponent {
  id?: number;
  name: string;
  notes: string;
  firstPhaseBans: number[];
  comfortPicks: number[];
  sidePreference: SidePreference;
  priorityHeroes: number[];
  pocketPicks: number[];
  tendencies: string;
  createdAt: Date;
  updatedAt: Date;
}

// ========================
// Players
// ========================
export interface Player {
  id?: number;
  name: string;
  role: LanePosition;
  comfortHeroes: number[];
  notes: string;
  createdAt: Date;
}

export interface PlayerHeroStat {
  id?: number;
  playerId: number;
  heroId: number;
  gamesPlayed: number;
  wins: number;
  winrate: number;
  confidenceScore: number; // 1-10
  tournamentPerformance: number; // 1-10
  scrimPerformance: number; // 1-10
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
}

// ========================
// Analyst Notes
// ========================
export type NoteCategory = 'draft' | 'hero' | 'opponent' | 'general' | 'emergency';

export interface AnalystNote {
  id?: number;
  category: NoteCategory;
  title: string;
  content: string;
  tags: string[];
  relatedHeroId?: number;
  relatedOpponentId?: number;
  relatedScrimId?: number;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ========================
// Version 2 Relational Scrim Types
// ========================
export interface ScrimRecord {
  id?: number;
  matchId: string;
  date: string;
  opponent: string;
  match: string;
  patch: string;
  side: 'Blue' | 'Red';
  gameNumber: number;
  result: 'W' | 'L';
  duration: number; // in minutes
  teamKills?: number;
  oppKills?: number;
  goldDiff10?: number;
  towerDiff?: number;
  firstTurtle?: 'Yes' | 'No' | '';
  firstLord?: 'Yes' | 'No' | '';
  expPlayer: string;
  expHero: string;
  junglePlayer: string;
  jungleHero: string;
  midPlayer: string;
  midHero: string;
  goldPlayer: string;
  goldHero: string;
  roamPlayer: string;
  roamHero: string;
  teamBans: string[]; // size 5
  oppBans: string[];  // size 5
  oppPicks: string[]; // size 5
  week?: string;
  notes?: string;
  createdAt: Date;
}

export interface ScrimPlayerStats {
  id?: number;
  scrimRecordId?: number; // references ScrimRecord.id
  matchId: string;
  date: string;
  opponent: string;
  match: string;
  side: 'Blue' | 'Red';
  gameNumber: number;
  result: 'W' | 'L';
  player: string;
  role: LanePosition;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  heroDamage: number;
  towerDamage: number;
  damageTaken: number;
  killParticipation: number; // 0-100 percentage
}

