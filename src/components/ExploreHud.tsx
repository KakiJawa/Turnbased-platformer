import { AlertTriangle, Backpack, GitBranch, Pause, Volume2, VolumeX } from 'lucide-react';
import { computePlayerStats, getXpToNextLevel } from '../game/rpgLogic';
import { PlayerState, StageDefinition, WorldEntity } from '../game/types';

interface ExploreHudProps {
  player: PlayerState;
  stage: StageDefinition;
  playerX: number;
  nearbyInteractable: WorldEntity | null;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenInventory: () => void;
  onOpenSkillTree: () => void;
  onInteract: () => void;
  onSelectZone: (zone: number) => void;
}

export function ExploreHud({
  player,
  stage,
  playerX,
  nearbyInteractable,
  muted,
  onToggleMute,
  onPause,
  onOpenInventory,
  onOpenSkillTree,
  onInteract,
  onSelectZone,
}: ExploreHudProps) {
  const stats = computePlayerStats(player);
  const xpNeeded = getXpToNextLevel(player.level, player.classTier);
  const hpPct = Math.max(0, Math.min(100, (player.currentHp / stats.hp) * 100));
  const mpPct = Math.max(0, Math.min(100, (player.currentMp / stats.mp) * 100));
  const xpPct = Math.max(0, Math.min(100, (player.xp / xpNeeded) * 100));

  const interactLabel =
    nearbyInteractable?.kind === 'fireplace'
      ? 'Rest at Fireplace [E]'
      : nearbyInteractable?.kind === 'shop'
      ? 'Open Shop & Blacksmith [E]'
      : nearbyInteractable?.kind === 'chest'
      ? 'Open Chest [E]'
      : nearbyInteractable?.kind === 'portal'
      ? 'Enter Next Zone [E]'
      : null;

  const activeEnemies = stage.entities.filter((e) => e.kind === 'enemy' && !e.defeated);
  const bossEntity = stage.entities.find((e) => e.kind === 'enemy' && e.enemyRarity === 'boss');
  const bossDefeated = Boolean(bossEntity?.defeated);
  const nearbyThreat = activeEnemies.find(
    (e) =>
      (e.enemyRarity === 'boss' || e.enemyRarity === 'elite') &&
      Math.abs(e.x - playerX) < 220
  );

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 md:p-4">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Compact Player Vitality & Zone */}
        <div className="pointer-events-auto bg-[#1b162b]/90 border-2 border-[#4b3f6b] px-3 py-2 shadow-[0_3px_0_#0e0b16] min-w-[230px]">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="font-pixel text-xs text-[#f7c948]">
              {player.name} · {player.className} Lv.{player.level}
            </span>
            <span className="font-mono-num text-xs font-bold text-[#f7c948]">
              {player.gold}G
            </span>
          </div>

          {/* HP Bar */}
          <div className="mb-1">
            <div className="flex justify-between text-[11px] font-mono-num leading-none mb-0.5">
              <span className="text-[#fca5a5]">HP</span>
              <span>
                {Math.round(player.currentHp)}/{stats.hp}
              </span>
            </div>
            <div className="h-2 bg-[#0e0b16] border border-[#4b3f6b]">
              <div
                className="h-full bg-[#ef4444] transition-all duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* MP & XP row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[10px] font-mono-num leading-none mb-0.5 text-[#93c5fd]">
                <span>MP</span>
                <span>
                  {Math.round(player.currentMp)}/{stats.mp}
                </span>
              </div>
              <div className="h-1.5 bg-[#0e0b16]">
                <div
                  className="h-full bg-[#38bdf8]"
                  style={{ width: `${mpPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-mono-num leading-none mb-0.5 text-[#d8b4fe]">
                <span>XP</span>
                <span>{Math.round(xpPct)}%</span>
              </div>
              <div className="h-1.5 bg-[#0e0b16]">
                <div
                  className="h-full bg-[#a855f7]"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top-Center: Stage Banner & Quick Zone Selector */}
        <div className="pointer-events-auto hidden md:flex flex-col items-center bg-[#1b162b]/90 border-2 border-[#4b3f6b] px-4 py-1.5 shadow-[0_3px_0_#0e0b16]">
          <div className="font-pixel text-xs text-[#f4efe6]">{stage.name}</div>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((z) => (
              <button
                key={z}
                type="button"
                disabled={z > player.highestZone}
                onClick={() => onSelectZone(z)}
                className={`font-pixel text-[10px] px-1.5 py-0.5 border cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                  stage.zone === z
                    ? 'bg-[#f7c948] text-[#0e0b16] border-[#0e0b16]'
                    : 'bg-[#2d2544] text-[#e6d8bd] border-[#4b3f6b] hover:bg-[#3d335c]'
                }`}
              >
                Z{z}
              </button>
            ))}
          </div>
        </div>

        {/* Top-Right: Menu & Audio Utilities */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenInventory}
            className="flex items-center gap-1.5 bg-[#1b162b]/95 border-2 border-[#4b3f6b] hover:border-[#f7c948] px-3 py-2 font-pixel text-xs text-[#f4efe6] shadow-[0_3px_0_#0e0b16] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Backpack className="w-4 h-4 text-[#f7c948]" />
            <span>Gear [I]</span>
          </button>

          <button
            type="button"
            onClick={onOpenSkillTree}
            className="relative flex items-center gap-1.5 bg-[#1b162b]/95 border-2 border-[#4b3f6b] hover:border-[#38bdf8] px-3 py-2 font-pixel text-xs text-[#f4efe6] shadow-[0_3px_0_#0e0b16] cursor-pointer whitespace-nowrap shrink-0"
          >
            <GitBranch className="w-4 h-4 text-[#38bdf8]" />
            <span>Skills [K]</span>
            {player.skillPoints > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-[#f7c948] text-[#0e0b16] text-[10px] font-bold">
                {player.skillPoints}
              </span>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="bg-[#1b162b]/95 border-2 border-[#4b3f6b] hover:border-[#f7c948] p-2 text-[#f4efe6] shadow-[0_3px_0_#0e0b16] cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause game"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="bg-[#1b162b]/95 border-2 border-[#4b3f6b] hover:border-[#f7c948] p-2 text-[#f4efe6] shadow-[0_3px_0_#0e0b16] cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Interactive Prompt, Stage Minimap & Controls Hint */}
      <div className="flex flex-col items-center gap-2 pb-1">
        {nearbyThreat && (
          <div
            data-testid="enemy-proximity-alert"
            className={`pointer-events-none flex items-center gap-1.5 px-3 py-1 border-2 font-pixel text-[11px] shadow-[0_3px_0_#0e0b16] animate-juicy-pop ${
              nearbyThreat.enemyRarity === 'boss'
                ? 'bg-[#3d1221] border-[#c084fc] text-[#f5d0fe]'
                : 'bg-[#2d1b12] border-[#fb923c] text-[#fed7aa]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              {nearbyThreat.enemyRarity === 'boss' ? 'BOSS NEARBY: ' : 'ELITE AHEAD: '}
              {nearbyThreat.enemyName}
            </span>
          </div>
        )}

        {interactLabel && (
          <button
            type="button"
            onClick={onInteract}
            className="pointer-events-auto animate-juicy-pop font-pixel text-xs md:text-sm px-5 py-2.5 bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_4px_0_#0e0b16] hover:bg-[#fde047] cursor-pointer"
          >
            {interactLabel}
          </button>
        )}

        {/* 16-Bit Stage Minimap & Threat Tracker */}
        <div
          data-testid="stage-minimap"
          className="pointer-events-auto bg-[#1b162b]/95 border-2 border-[#4b3f6b] px-3 py-1.5 shadow-[0_3px_0_#0e0b16] w-full max-w-lg flex flex-col gap-1"
        >
          <div className="flex items-center justify-between text-[10px] font-mono-num text-[#cbd5e1]">
            <span className="font-pixel text-[#f7c948]">STAGE MAP · Z{stage.zone}</span>
            <div className="flex items-center gap-3">
              <span>Enemies: {activeEnemies.length}</span>
              <span className={bossDefeated ? 'text-[#4ade80]' : 'text-[#fb7185]'}>
                Boss: {bossDefeated ? 'Defeated' : 'Active'}
              </span>
            </div>
          </div>

          <div className="relative h-3 bg-[#0e0b16] border border-[#4b3f6b]">
            {stage.entities.map((ent) => {
              if (ent.kind === 'gold' || ent.kind === 'material') return null;
              if (ent.kind === 'chest' && ent.opened) return null;
              if (ent.kind === 'enemy' && ent.defeated) return null;

              const leftPct = Math.max(1, Math.min(98, (ent.x / stage.width) * 100));
              let color = '#94a3b8';
              let sizeCls = 'w-1.5 h-2 top-0.5';
              if (ent.kind === 'fireplace' || ent.kind === 'shop') {
                color = '#f28729';
              } else if (ent.kind === 'chest') {
                color = '#facc15';
              } else if (ent.kind === 'portal') {
                color = bossDefeated ? '#4ade80' : '#4b3f6b';
                sizeCls = 'w-2 h-2.5 top-0';
              } else if (ent.kind === 'enemy') {
                if (ent.enemyRarity === 'boss') {
                  color = '#c084fc';
                  sizeCls = 'w-2.5 h-2.5 top-0';
                } else if (ent.enemyRarity === 'elite') {
                  color = '#fb923c';
                  sizeCls = 'w-2 h-2 top-0.5';
                } else {
                  color = '#ef4444';
                }
              }
              return (
                <div
                  key={ent.id}
                  title={ent.enemyName ?? ent.kind}
                  className={`absolute ${sizeCls}`}
                  style={{ left: `${leftPct}%`, backgroundColor: color, transform: 'translateX(-50%)' }}
                />
              );
            })}
            {/* Player Marker */}
            <div
              className="absolute top-0 bottom-0 w-2 bg-[#38bdf8] border border-white"
              style={{
                left: `${Math.max(1, Math.min(98, (playerX / stage.width) * 100))}%`,
                transform: 'translateX(-50%)',
              }}
            />
          </div>
        </div>

        <div className="text-[11px] font-pixel text-[#f4efe6]/85 drop-shadow-[0_2px_0_#0e0b16]">
          A/D Move · Space Jump · E Interact
        </div>
      </div>
    </div>
  );
}
