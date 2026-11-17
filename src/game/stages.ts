import { ENEMY_TEMPLATES } from './data';
import { PALETTE } from './palette';
import { HazardKind, MaterialId, PlatformRect, StageDefinition, WorldEntity } from './types';

interface ZoneTheme {
  zone: number;
  name: string;
  subtitle: string;
  skyTop: string;
  skyBottom: string;
  groundColor: string;
  grassColor: string;
  materialId: MaterialId;
  hazardKind: HazardKind;
  platformKind: PlatformRect['kind'];
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
    hazardKind: 'thorns',
    platformKind: 'wood',
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
    hazardKind: 'thorns',
    platformKind: 'wood',
  },
  {
    zone: 3,
    name: 'Briar Canyon',
    subtitle: 'Zone 3 · Stalkers, Brigands & Granite Golems',
    skyTop: '#24293d',
    skyBottom: '#697296',
    groundColor: '#3d332c',
    grassColor: '#5c6b4d',
    materialId: 'ironShard',
    hazardKind: 'spikes',
    platformKind: 'stone',
  },
  {
    zone: 4,
    name: 'Ironhold Stronghold',
    subtitle: 'Zone 4 · Orc Raiders & War Boars',
    skyTop: PALETTE.skyDuskTop,
    skyBottom: PALETTE.skyDuskBottom,
    groundColor: '#3a2d3d',
    grassColor: '#6b443b',
    materialId: 'orcFang',
    hazardKind: 'spikes',
    platformKind: 'stone',
  },
  {
    zone: 5,
    name: 'Magma Tunnels',
    subtitle: 'Zone 5 · Berserkers, Magma & Hellboars',
    skyTop: '#260e16',
    skyBottom: '#7c2d12',
    groundColor: '#291a1c',
    grassColor: '#991b1b',
    materialId: 'orcFang',
    hazardKind: 'lava',
    platformKind: 'stone',
  },
  {
    zone: 6,
    name: 'Wyvern Ridge',
    subtitle: 'Zone 6 · Storm Wyverns & Scalebound Knights',
    skyTop: '#162038',
    skyBottom: '#475569',
    groundColor: '#2b2d3c',
    grassColor: '#334155',
    materialId: 'dragonScale',
    hazardKind: 'spikes',
    platformKind: 'stone',
  },
  {
    zone: 7,
    name: 'Ashen Citadel',
    subtitle: 'Zone 7 · Abyssal Wyverns & Drake Guards',
    skyTop: '#1d1224',
    skyBottom: '#581c87',
    groundColor: '#241b2b',
    grassColor: '#4c1d95',
    materialId: 'dragonScale',
    hazardKind: 'void_rift',
    platformKind: 'stone',
  },
  {
    zone: 8,
    name: 'Obsidian Dragon Peaks',
    subtitle: 'Zone 8 · Royal Drakes & Ignis the Dragon',
    skyTop: PALETTE.skyPeakTop,
    skyBottom: PALETTE.skyPeakBottom,
    groundColor: '#261b26',
    grassColor: '#7f1d1d',
    materialId: 'dragonScale',
    hazardKind: 'lava',
    platformKind: 'stone',
  },
  {
    zone: 9,
    name: 'Sunken Starfall Ruins',
    subtitle: 'Zone 9 Endgame · Leviathans & Starfall Empress',
    skyTop: '#081b33',
    skyBottom: '#164e63',
    groundColor: '#132a3e',
    grassColor: '#0891b2',
    materialId: 'starlightOre',
    hazardKind: 'void_rift',
    platformKind: 'crystal',
  },
  {
    zone: 10,
    name: 'The Void Spire',
    subtitle: 'Zone 10 Endgame · Chrono Wardens & Architect Malakor',
    skyTop: '#070312',
    skyBottom: '#3b0764',
    groundColor: '#160b24',
    grassColor: '#7e22ce',
    materialId: 'voidEssence',
    hazardKind: 'void_rift',
    platformKind: 'void',
  },
];

const VARIANT_POOLS_BY_TIER: Record<number, import('./types').EnemyVariantId[]> = {
  1: ['standard', 'standard', 'standard'],
  2: ['standard', 'fierce', 'swift'],
  3: ['standard', 'armored', 'swift', 'fierce'],
  4: ['fierce', 'armored', 'thorny', 'vampiric'],
  5: ['armored', 'vampiric', 'hexed', 'thorny'],
  6: ['vampiric', 'colossal', 'hexed', 'swift'],
  7: ['colossal', 'hexed', 'thorny', 'twinborn'],
  8: ['vampiric', 'colossal', 'twinborn', 'corrupted'],
  9: ['hexed', 'twinborn', 'thorny', 'corrupted'],
  10: ['corrupted', 'twinborn', 'colossal', 'vampiric'],
};

export function buildStage(zone: number): StageDefinition {
  const theme = ZONE_THEMES[Math.min(ZONE_THEMES.length - 1, Math.max(0, zone - 1))];
  const groundY = 228;
  const stageWidth = 1740 + zone * 122; // 1862px (Z1) up to 2960px (Z10)
  const pKind = theme.platformKind;
  const skyKind: PlatformRect['kind'] = zone >= 9 ? pKind : 'stone';

  const platforms: PlatformRect[] = [
    // Continuous main floor
    { x: 0, y: groundY, w: stageWidth, h: 42, kind: 'ground' },
    // Zone 1 reachable starter ledge & dual-route platforms
    { x: 240, y: 184, w: 96, h: 12, kind: pKind },
    { x: 375, y: 144, w: 92, h: 12, kind: pKind },
    { x: 545, y: 184, w: 112, h: 12, kind: pKind },
    { x: 715, y: 142, w: 100, h: 12, kind: pKind },
    { x: 880, y: 184, w: 116, h: 12, kind: pKind },
    { x: 1060, y: 144, w: 106, h: 12, kind: pKind },
    { x: 1235, y: 184, w: 118, h: 12, kind: pKind },
    { x: 1410, y: 142, w: 104, h: 12, kind: pKind },
    // High aerial sky-ledges reached via Bounce Pads
    { x: 365, y: 96, w: 96, h: 10, kind: skyKind },
    { x: 1065, y: 96, w: 96, h: 10, kind: skyKind },
  ];

  // Add extended upper-route platforms across wider Z2..Z10 stages
  if (stageWidth >= 2000) {
    platforms.push(
      { x: 1585, y: 184, w: 112, h: 12, kind: pKind },
      { x: 1755, y: 142, w: 100, h: 12, kind: pKind }
    );
  }
  if (stageWidth >= 2300) {
    platforms.push(
      { x: 1930, y: 184, w: 118, h: 12, kind: pKind },
      { x: 2105, y: 142, w: 104, h: 12, kind: pKind },
      { x: 1935, y: 96, w: 96, h: 10, kind: skyKind }
    );
  }
  if (stageWidth >= 2650) {
    platforms.push(
      { x: 2285, y: 184, w: 118, h: 12, kind: pKind },
      { x: 2465, y: 144, w: 108, h: 12, kind: pKind }
    );
  }

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
  const n3 = zoneNormals[2] ?? n1;
  const elite = zoneElites[0] ?? n2;
  const elite2 = zoneElites[1] ?? elite;

  const variantPool = VARIANT_POOLS_BY_TIER[theme.zone] ?? ['standard'];
  const pickVariant = (slotIdx: number, isElite = false): import('./types').EnemyVariantId => {
    if (zone === 1) return slotIdx === 3 ? 'fierce' : 'standard';
    if (isElite) {
      return variantPool[(slotIdx + 1) % variantPool.length] ?? 'fierce';
    }
    return variantPool[slotIdx % variantPool.length] ?? 'standard';
  };

  // Determine non-boss encounter counts:
  // Z1-Z2: 4 (3 normal + 1 elite) -> 5 total with boss
  // Z3-Z4: 5 (4 normal + 1 elite) -> 6 total with boss
  // Z5-Z7: 6 (4 normal + 2 elite) -> 7 total with boss
  // Z8-Z10: 7 (5 normal + 2 elite) -> 8 total with boss
  const normalCount = zone <= 2 ? 3 : zone <= 7 ? 4 : 5;
  const eliteCount = zone <= 4 ? 1 : 2;
  const bossX = stageWidth - 210;
  const portalX = stageWidth - 82;

  const entities: WorldEntity[] = [
    // Starting safe camp (Fireplace + Village Shop/Smith)
    {
      id: `z${zone}_fireplace_1`,
      kind: 'fireplace',
      x: 120,
      y: groundY,
      w: 28,
      h: 24,
    },
    {
      id: `z${zone}_shop_1`,
      kind: 'shop',
      x: 164,
      y: groundY,
      w: 44,
      h: 38,
    },

    // Platform collectibles along early & mid routes
    { id: `z${zone}_g1`, kind: 'gold', x: 266, y: 184, w: 12, h: 12, amount: 12 * zone },
    { id: `z${zone}_g2`, kind: 'gold', x: 304, y: 184, w: 12, h: 12, amount: 12 * zone },
    {
      id: `z${zone}_m1`,
      kind: 'material',
      x: 417,
      y: 144,
      w: 12,
      h: 12,
      materialId: theme.materialId,
      amount: 2,
    },
    { id: `z${zone}_chest_1`, kind: 'chest', x: 600, y: 184, w: 20, h: 16, opened: false },
    { id: `z${zone}_g3`, kind: 'gold', x: 765, y: 142, w: 12, h: 12, amount: 16 * zone },
    {
      id: `z${zone}_m2`,
      kind: 'material',
      x: 938,
      y: 184,
      w: 12,
      h: 12,
      materialId: theme.materialId,
      amount: 2,
    },
    { id: `z${zone}_chest_2`, kind: 'chest', x: 1112, y: 144, w: 20, h: 16, opened: false },
    {
      id: `z${zone}_g4`,
      kind: 'gold',
      x: 1294,
      y: 184,
      w: 12,
      h: 12,
      amount: 18 * zone,
    },
    {
      id: `z${zone}_m3`,
      kind: 'material',
      x: 1462,
      y: 142,
      w: 12,
      h: 12,
      materialId: theme.materialId,
      amount: 2,
    },

    // Bounce Pads & Blessing Shrines
    {
      id: `z${zone}_bounce_1`,
      kind: 'bounce_pad',
      x: 344,
      y: groundY,
      w: 22,
      h: 10,
      bounceVelocity: -415,
    },
    {
      id: `z${zone}_bounce_2`,
      kind: 'bounce_pad',
      x: 1038,
      y: groundY,
      w: 22,
      h: 10,
      bounceVelocity: -415,
    },
    {
      id: `z${zone}_shrine_1`,
      kind: 'shrine',
      x: 412,
      y: 96,
      w: 20,
      h: 28,
      used: false,
    },
    {
      id: `z${zone}_sky_mat`,
      kind: 'material',
      x: 1112,
      y: 96,
      w: 12,
      h: 12,
      materialId: theme.materialId,
      amount: zone >= 9 ? 3 : 2,
    },
  ];

  // Mid-stage Fireplace + Shop ONLY in early learning zones (Zones 1-2)
  if (zone <= 2) {
    entities.push(
      {
        id: `z${zone}_fireplace_2`,
        kind: 'fireplace',
        x: 910,
        y: groundY,
        w: 28,
        h: 24,
      },
      {
        id: `z${zone}_shop_2`,
        kind: 'shop',
        x: 954,
        y: groundY,
        w: 44,
        h: 38,
      }
    );
  }

  // Extra bounce pad, shrine, chest & sky collectibles on larger stages
  if (stageWidth >= 2300) {
    entities.push(
      {
        id: `z${zone}_bounce_3`,
        kind: 'bounce_pad',
        x: 1905,
        y: groundY,
        w: 22,
        h: 10,
        bounceVelocity: -415,
      },
      {
        id: `z${zone}_shrine_2`,
        kind: 'shrine',
        x: 1982,
        y: 96,
        w: 20,
        h: 28,
        used: false,
      },
      {
        id: `z${zone}_chest_3`,
        kind: 'chest',
        x: 2154,
        y: 142,
        w: 20,
        h: 16,
        opened: false,
      }
    );
  }
  if (stageWidth >= 2650) {
    entities.push(
      {
        id: `z${zone}_g5`,
        kind: 'gold',
        x: 2344,
        y: 184,
        w: 12,
        h: 12,
        amount: 24 * zone,
      },
      {
        id: `z${zone}_m4`,
        kind: 'material',
        x: 2518,
        y: 144,
        w: 12,
        h: 12,
        materialId: theme.materialId,
        amount: zone >= 9 ? 3 : 2,
      }
    );
  }

  // Distribute normal & elite encounters evenly before the sealed boss gate
  const spanStart = 430;
  const spanEnd = bossX - 150;
  const nonBossTotal = normalCount + eliteCount;
  const step = (spanEnd - spanStart) / Math.max(1, nonBossTotal - 1);

  const normalPool = [n1, n2, n3];
  for (let i = 0; i < nonBossTotal; i++) {
    const isEliteSlot = i >= normalCount;
    const x = Math.round(spanStart + i * step);
    const tpl = isEliteSlot
      ? i === normalCount
        ? elite
        : elite2
      : normalPool[i % normalPool.length];
    const variant = pickVariant(i, isEliteSlot);
    const elevated = !isEliteSlot && i % 2 === 1 && i < 3;
    const ey = elevated && x >= 545 && x <= 650 ? 184 : groundY;

    entities.push({
      id: isEliteSlot ? `z${zone}_elite_${i - normalCount + 1}` : `z${zone}_en_${i + 1}`,
      kind: 'enemy',
      x,
      y: ey,
      w: isEliteSlot ? 28 : 24,
      h: isEliteSlot ? 28 : 24,
      enemyRarity: isEliteSlot ? 'elite' : 'normal',
      enemyTemplateId: tpl.id,
      enemyVariant: variant,
      enemySprite: tpl.sprite,
      enemyName: tpl.name,
      patrolMinX: elevated ? x - 24 : x - 48,
      patrolMaxX: elevated ? x + 24 : x + 48,
      vx: (i % 2 === 0 ? 1 : -1) * (isEliteSlot ? 20 : 24),
      facing: -1,
    });
  }

  // Stage Hazards placed cleanly in traversal gaps (3 to 5 per stage)
  const hazardXs = [604, 992, 1345];
  if (stageWidth >= 2200) hazardXs.push(1720);
  if (stageWidth >= 2550) hazardXs.push(2210);
  hazardXs.forEach((hx, idx) => {
    entities.push({
      id: `z${zone}_haz_${idx + 1}`,
      kind: 'hazard',
      x: hx,
      y: groundY,
      w: zone >= 5 ? 40 : 36,
      h: 10,
      hazardKind: theme.hazardKind,
      hazardDamagePct: Math.min(15, 5 + Math.floor(zone * 0.75) + (idx % 2)),
    });
  });

  // Sealed Zone Boss guarding the Portal at the end of the stage
  entities.push({
    id: `z${zone}_boss`,
    kind: 'enemy',
    x: bossX,
    y: groundY,
    w: 38,
    h: 38,
    enemyRarity: 'boss',
    enemyTemplateId: zoneBoss.id,
    enemyVariant: 'standard',
    enemySprite: zoneBoss.sprite,
    enemyName: zoneBoss.name,
    patrolMinX: bossX - 24,
    patrolMaxX: bossX + 24,
    vx: 14,
    facing: -1,
  });

  // Portal to next zone (sealed until all guards & Zone Boss are defeated)
  entities.push({
    id: `z${zone}_portal`,
    kind: 'portal',
    x: portalX,
    y: groundY,
    w: 28,
    h: 36,
  });

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
