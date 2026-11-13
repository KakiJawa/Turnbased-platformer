import { ENEMY_TEMPLATES } from './data';
import { PALETTE } from './palette';
import { MaterialId, StageDefinition, WorldEntity } from './types';

interface ZoneTheme {
  zone: number;
  name: string;
  subtitle: string;
  skyTop: string;
  skyBottom: string;
  groundColor: string;
  grassColor: string;
  materialId: MaterialId;
}

const ZONE_THEMES: ZoneTheme[] = [
  {
    zone: 1,
    name: 'Meadow Farmlands',
    subtitle: 'Zone 1 · Chickens, Pigs & Barn Cows',
    skyTop: PALETTE.skyDayTop,
    skyBottom: PALETTE.skyDayBottom,
    groundColor: '#5c3c24',
    grassColor: PALETTE.grassMid,
    materialId: 'feather',
  },
  {
    zone: 2,
    name: 'Timber Foothills',
    subtitle: 'Zone 2 · Wolves, Bandits & Stone Golems',
    skyTop: '#1b3b36',
    skyBottom: '#4c8067',
    groundColor: '#3f3026',
    grassColor: '#2c6e49',
    materialId: 'ironShard',
  },
  {
    zone: 3,
    name: 'Ironhold Stronghold',
    subtitle: 'Zone 3 · Orc Raiders & War Boars',
    skyTop: PALETTE.skyDuskTop,
    skyBottom: PALETTE.skyDuskBottom,
    groundColor: '#3a2d3d',
    grassColor: '#6b443b',
    materialId: 'orcFang',
  },
  {
    zone: 4,
    name: 'Obsidian Dragon Peaks',
    subtitle: 'Zone 4 · Wyverns & Ignis the Dragon',
    skyTop: PALETTE.skyPeakTop,
    skyBottom: PALETTE.skyPeakBottom,
    groundColor: '#261b26',
    grassColor: '#7f1d1d',
    materialId: 'dragonScale',
  },
];

export function buildStage(zone: number): StageDefinition {
  const theme = ZONE_THEMES[Math.min(ZONE_THEMES.length - 1, Math.max(0, zone - 1))];
  const groundY = 228;
  const stageWidth = 1560;

  const platforms = [
    // Continuous main floor
    { x: 0, y: groundY, w: stageWidth, h: 42, kind: 'ground' as const },
    // Elevated wooden / stone platforms for platforming collectibles & routes
    { x: 240, y: 176, w: 96, h: 12, kind: 'wood' as const },
    { x: 375, y: 138, w: 84, h: 12, kind: 'wood' as const },
    { x: 560, y: 174, w: 110, h: 12, kind: 'stone' as const },
    { x: 740, y: 132, w: 96, h: 12, kind: 'wood' as const },
    { x: 930, y: 174, w: 120, h: 12, kind: 'stone' as const },
    { x: 1120, y: 138, w: 96, h: 12, kind: 'wood' as const },
  ];

  const zoneNormals = ENEMY_TEMPLATES.filter(
    (e) => e.zone === theme.zone && e.rarity === 'normal'
  );
  const zoneElites = ENEMY_TEMPLATES.filter(
    (e) => e.zone === theme.zone && e.rarity === 'elite'
  );
  const zoneBoss = ENEMY_TEMPLATES.find(
    (e) => e.zone === theme.zone && e.rarity === 'boss'
  )!;

  const n1 = zoneNormals[0] ?? ENEMY_TEMPLATES[0];
  const n2 = zoneNormals[1] ?? n1;
  const elite = zoneElites[0] ?? n2;

  const entities: WorldEntity[] = [
    // Fireplace + Shop/Blacksmith near start (safe hub)
    {
      id: `z${zone}_fireplace_1`,
      kind: 'fireplace',
      x: 126,
      y: groundY,
      w: 28,
      h: 24,
    },
    {
      id: `z${zone}_shop_1`,
      kind: 'shop',
      x: 168,
      y: groundY,
      w: 44,
      h: 38,
    },

    // Platform collectibles: Gold & Materials
    { id: `z${zone}_g1`, kind: 'gold', x: 266, y: 176, w: 12, h: 12, amount: 12 * zone },
    { id: `z${zone}_g2`, kind: 'gold', x: 304, y: 176, w: 12, h: 12, amount: 12 * zone },
    {
      id: `z${zone}_m1`,
      kind: 'material',
      x: 417,
      y: 138,
      w: 12,
      h: 12,
      materialId: theme.materialId,
      amount: 2,
    },
    { id: `z${zone}_chest_1`, kind: 'chest', x: 615, y: 174, w: 20, h: 16, opened: false },

    // Normal Enemy 1
    {
      id: `z${zone}_en_1`,
      kind: 'enemy',
      x: 470,
      y: groundY,
      w: 24,
      h: 24,
      enemyRarity: 'normal',
      enemySprite: n1.sprite,
      enemyName: n1.name,
      patrolMinX: 430,
      patrolMaxX: 540,
      vx: 22,
      facing: -1,
    },

    // Normal Enemy 2
    {
      id: `z${zone}_en_2`,
      kind: 'enemy',
      x: 720,
      y: groundY,
      w: 24,
      h: 24,
      enemyRarity: 'normal',
      enemySprite: n2.sprite,
      enemyName: n2.name,
      patrolMinX: 670,
      patrolMaxX: 800,
      vx: -24,
      facing: -1,
    },

    // Mid-stage Fireplace + Shop before Elite & Boss
    {
      id: `z${zone}_fireplace_2`,
      kind: 'fireplace',
      x: 860,
      y: groundY,
      w: 28,
      h: 24,
    },
    {
      id: `z${zone}_shop_2`,
      kind: 'shop',
      x: 902,
      y: groundY,
      w: 44,
      h: 38,
    },

    // High platform rewards
    { id: `z${zone}_g3`, kind: 'gold', x: 788, y: 132, w: 12, h: 12, amount: 18 * zone },
    {
      id: `z${zone}_m2`,
      kind: 'material',
      x: 990,
      y: 174,
      w: 12,
      h: 12,
      materialId: theme.materialId,
      amount: 2,
    },
    { id: `z${zone}_chest_2`, kind: 'chest', x: 1168, y: 138, w: 20, h: 16, opened: false },

    // Elite Enemy
    {
      id: `z${zone}_elite`,
      kind: 'enemy',
      x: 1090,
      y: groundY,
      w: 28,
      h: 28,
      enemyRarity: 'elite',
      enemySprite: elite.sprite,
      enemyName: elite.name,
      patrolMinX: 1040,
      patrolMaxX: 1180,
      vx: 20,
      facing: -1,
    },

    // Boss at end of stage
    {
      id: `z${zone}_boss`,
      kind: 'enemy',
      x: 1370,
      y: groundY,
      w: 38,
      h: 38,
      enemyRarity: 'boss',
      enemySprite: zoneBoss.sprite,
      enemyName: zoneBoss.name,
      patrolMinX: 1345,
      patrolMaxX: 1410,
      vx: 14,
      facing: -1,
    },

    // Portal to next zone (active once Boss is defeated)
    {
      id: `z${zone}_portal`,
      kind: 'portal',
      x: 1490,
      y: groundY,
      w: 28,
      h: 36,
    },
  ];

  return {
    zone: theme.zone,
    name: theme.name,
    subtitle: theme.subtitle,
    width: stageWidth,
    height: 270,
    skyTop: theme.skyTop,
    skyBottom: theme.skyBottom,
    groundColor: theme.groundColor,
    grassColor: theme.grassColor,
    platforms,
    entities,
  };
}
