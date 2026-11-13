import { Rarity } from './types';

// Cohesive 28-color 16-bit fantasy RPG palette
export const PALETTE = {
  ink: '#0e0b16',
  slateDark: '#1b162b',
  slateMid: '#2d2544',
  slateLight: '#4b3f6b',
  stoneDark: '#474454',
  stoneLight: '#7b788a',
  parchment: '#f4efe6',
  cream: '#e6d8bd',
  woodDark: '#4a2b1d',
  woodMid: '#78472a',
  woodLight: '#a66a3e',
  skinLight: '#f3be9b',
  skinShadow: '#c78767',
  grassDark: '#275933',
  grassMid: '#418a43',
  grassBright: '#74c253',
  skyDayTop: '#244b7a',
  skyDayBottom: '#6ea8cf',
  skyDuskTop: '#2a183b',
  skyDuskBottom: '#8c3b5a',
  skyPeakTop: '#160c1c',
  skyPeakBottom: '#591d2b',
  fireRed: '#d93b2b',
  fireOrange: '#f28729',
  gold: '#f7c948',
  cyanMagic: '#38bdf8',
  violetArcane: '#a855f7',
  crimson: '#ef4444',
  emerald: '#22c55e',
  white: '#ffffff',
} as const;

export const RARITY_META: Record<
  Rarity,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    affixCount: number;
    statMult: number;
    growthMult: number;
  }
> = {
  common: {
    label: 'Common',
    color: '#cbd5e1',
    bg: '#262b38',
    border: '#64748b',
    affixCount: 0,
    statMult: 1.0,
    growthMult: 1.0,
  },
  uncommon: {
    label: 'Uncommon',
    color: '#4ade80',
    bg: '#142e22',
    border: '#22c55e',
    affixCount: 1,
    statMult: 1.25,
    growthMult: 1.2,
  },
  rare: {
    label: 'Rare',
    color: '#38bdf8',
    bg: '#12293d',
    border: '#0ea5e9',
    affixCount: 2,
    statMult: 1.55,
    growthMult: 1.45,
  },
  epic: {
    label: 'Epic',
    color: '#c084fc',
    bg: '#2c1742',
    border: '#a855f7',
    affixCount: 3,
    statMult: 1.95,
    growthMult: 1.75,
  },
  legendary: {
    label: 'Legendary',
    color: '#fbbf24',
    bg: '#382411',
    border: '#f59e0b',
    affixCount: 4,
    statMult: 2.5,
    growthMult: 2.15,
  },
  mythic: {
    label: 'Mythic',
    color: '#fb7185',
    bg: '#3d1221',
    border: '#f43f5e',
    affixCount: 5,
    statMult: 3.25,
    growthMult: 2.7,
  },
};

export const RARITY_ORDER: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];
