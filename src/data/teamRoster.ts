// Team Roster Data for MPL Turkey MTC S7
// Source: Official Tournament Roster Information

export interface TeamRosterData {
  teamCode: string;
  teamName: string;
  players: PlayerData[];
}

export interface PlayerData {
  name: string;
  role: 'EXP' | 'Jungle' | 'Mid' | 'Gold' | 'Roam';
  status?: 'active' | 'sub' | 'former';
}

export const mplTurkeyRosters: TeamRosterData[] = [
  {
    teamCode: 'AUR',
    teamName: 'Aurora Gaming',
    players: [
      { name: 'Lunar', role: 'EXP', status: 'active' },
      { name: 'Tienzy', role: 'Jungle', status: 'active' },
      { name: 'Rosa', role: 'Mid', status: 'active' },
      { name: 'Sigibum', role: 'Gold', status: 'active' },
      { name: 'Pagu', role: 'Roam', status: 'active' },
      { name: 'ReiNNNN', role: 'Mid', status: 'sub' }, // flex sub
    ],
  },
  {
    teamCode: 'FUT',
    teamName: 'FUT Esports',
    players: [
      { name: 'EKSI', role: 'EXP', status: 'active' },
      { name: 'Kazue', role: 'Jungle', status: 'active' },
      { name: 'Saiki', role: 'Mid', status: 'active' },
      { name: 'Rx', role: 'Gold', status: 'active' },
      { name: 'Blotzfet', role: 'Roam', status: 'active' },
    ],
  },
  {
    teamCode: 'MISA',
    teamName: 'Misa Esports',
    players: [
      { name: 'Wassa', role: 'EXP', status: 'active' },
      { name: 'Moji', role: 'Jungle', status: 'active' },
      { name: 'After Dark', role: 'Mid', status: 'active' },
      { name: 'XIAO', role: 'Gold', status: 'active' },
      { name: 'Qaro', role: 'Roam', status: 'active' },
      { name: 'Mozi', role: 'EXP', status: 'former' },
      { name: 'Sayaka', role: 'Mid', status: 'former' },
    ],
  },
  {
    teamCode: 'BJK',
    teamName: 'Beşiktaş Esports',
    players: [
      { name: 'Kunteper', role: 'EXP', status: 'active' },
      { name: 'Zeyn', role: 'Jungle', status: 'active' },
      { name: 'Sancho', role: 'Mid', status: 'active' },
      { name: 'Ravex', role: 'Gold', status: 'active' },
      { name: 'NUMB', role: 'Roam', status: 'active' },
      { name: 'Shao', role: 'Jungle', status: 'sub' },
      { name: 'Kirai', role: 'Mid', status: 'former' },
    ],
  },
  {
    teamCode: 'BW',
    teamName: 'Bushido Wildcats',
    players: [
      { name: 'Doran', role: 'EXP', status: 'active' },
      { name: 'Nexus', role: 'Jungle', status: 'active' },
      { name: 'Kirai', role: 'Mid', status: 'active' },
      { name: 'Sunshine', role: 'Gold', status: 'active' },
      { name: 'Wackter', role: 'Roam', status: 'active' },
      { name: 'Aizawa', role: 'Mid', status: 'sub' },
      { name: 'BRIAN', role: 'Jungle', status: 'former' },
      { name: 'Alien', role: 'EXP', status: 'former' },
    ],
  },
  {
    teamCode: 'PCF',
    teamName: 'PCIFIC Esports',
    players: [
      { name: 'Ross', role: 'EXP', status: 'active' },
      { name: 'Titan', role: 'Jungle', status: 'active' },
      { name: 'Remember Me', role: 'Mid', status: 'active' },
      { name: 'Elvis', role: 'Gold', status: 'active' },
      { name: 'Diffy', role: 'Roam', status: 'active' },
      { name: 'Miku', role: 'Mid', status: 'former' },
      { name: 'Kvanch', role: 'Roam', status: 'sub' },
      { name: 'Yalnız Ryuu', role: 'Jungle', status: 'former' },
      { name: 'Anthesis', role: 'Jungle', status: 'sub' },
      { name: 'Starmurre', role: 'Gold', status: 'former' },
      { name: 'Mozi', role: 'EXP', status: 'former' },
    ],
  },
  {
    teamCode: 'EF',
    teamName: 'Eternal Fire',
    players: [
      { name: 'Saviom', role: 'EXP', status: 'active' },
      { name: 'Harikasın Samet', role: 'Jungle', status: 'active' },
      { name: 'Zeichnen', role: 'Mid', status: 'active' },
      { name: 'Ranque', role: 'Gold', status: 'active' },
      { name: 'Intangible', role: 'Roam', status: 'active' },
      { name: 'Kiritooo', role: 'Mid', status: 'sub' },
      { name: 'Alien', role: 'EXP', status: 'sub' },
    ],
  },
  {
    teamCode: 'RGE',
    teamName: 'Regnum Carya Esports',
    players: [
      { name: 'Kausei', role: 'EXP', status: 'active' },
      { name: 'Elandor', role: 'Jungle', status: 'active' },
      { name: 'EASYY', role: 'Mid', status: 'active' },
      { name: 'Kite', role: 'Gold', status: 'active' },
      { name: 'Shinki', role: 'Roam', status: 'active' },
      { name: 'Wain', role: 'Gold', status: 'former' },
      { name: 'Revass', role: 'EXP', status: 'former' },
      { name: 'Borisgry', role: 'Gold', status: 'former' },
      { name: 'Peasyy', role: 'Roam', status: 'sub' },
      { name: 'Akuran', role: 'EXP', status: 'sub' },
    ],
  },
];
