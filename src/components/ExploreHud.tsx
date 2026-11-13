import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Backpack,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Crown,
  Flame,
  Gamepad2,
  GitBranch,
  Hand,
  Pause,
  Snowflake,
  Sparkles,
  Sun,
  Swords,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { PET_CATALOG } from '../game/data';
import { computePlayerStats, getXpToNextLevel } from '../game/rpgLogic';
import { PlayerState, StageDefinition, WorldEntity } from '../game/types';
import { getWeatherCombatEffect, getZoneWeatherProfile } from '../game/weather';

interface ExploreHudProps {
  player: PlayerState;
  stage: StageDefinition;
  playerX: number;
  nearbyInteractable: WorldEntity | null;
  nearBouncePad?: WorldEntity | null;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenInventory: () => void;
  onOpenSkillTree: () => void;
  onOpenArena?: () => void;
  onOpenVoidTower?: () => void;
  onInteract: () => void;
  onSelectZone: (zone: number) => void;
  onTouchMove?: (dir: -1 | 0 | 1) => void;
  onTouchJump?: () => void;
}

export function ExploreHud({
  player,
  stage,
  playerX,
  nearbyInteractable,
  nearBouncePad,
  muted,
  onToggleMute,
  onPause,
  onOpenInventory,
  onOpenSkillTree,
  onOpenArena,
  onOpenVoidTower,
  onInteract,
  onSelectZone,
  onTouchMove,
  onTouchJump,
}: ExploreHudProps) {
  const [showTouchPad, setShowTouchPad] = useState(false);

  const stats = computePlayerStats(player);
  const weatherProfile = getZoneWeatherProfile(stage.zone);
  const weatherFx = getWeatherCombatEffect(stage.zone);
  const xpNeeded = getXpToNextLevel(player.level, player.classTier);
  const hpPct = Math.max(0, Math.min(100, (player.currentHp / stats.hp) * 100));
  const mpPct = Math.max(0, Math.min(100, (player.currentMp / stats.mp) * 100));
  const xpPct = Math.max(0, Math.min(100, (player.xp / xpNeeded) * 100));
  const equippedPet = player.equippedPetId
    ? PET_CATALOG.find((p) => p.id === player.equippedPetId)
    : undefined;

  const interactLabel =
    nearbyInteractable?.kind === 'fireplace'
      ? 'Rest at Fireplace [E]'
      : nearbyInteractable?.kind === 'shop'
      ? 'Open Shop & Blacksmith [E]'
      : nearbyInteractable?.kind === 'chest'
      ? 'Open Chest [E]'
      : nearbyInteractable?.kind === 'shrine'
      ? 'Activate Blessing Shrine [E]'
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
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 md:p-4">
      {/* Top Perimeter Clusters */}
      <div className="flex flex-wrap items-start justify-between gap-2 md:gap-4">
        {/* Top-Left: Compact Player Vitality, Pet & Zone */}
        <div className="pointer-events-auto bg-[#1b162b]/90 border-2 border-[#4b3f6b] px-3 py-2 shadow-[0_3px_0_#0e0b16] min-w-[220px] md:min-w-[238px]">
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
            <div className="h-2.5 bg-[#0e0b16] border border-[#4b3f6b]">
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

          {equippedPet && (
            <div className="mt-1.5 pt-1 border-t border-[#4b3f6b]/60 flex items-center justify-between text-[10px] font-mono-num">
              <span className="text-[#94a3b8]">Familiar:</span>
              <span className="font-semibold" style={{ color: equippedPet.accent }}>
                {equippedPet.name} ({equippedPet.assistName})
              </span>
            </div>
          )}
        </div>

        {/* Top-Center: Responsive Stage Banner & Quick Zone Selector (Z1..Z10) */}
        <div
          data-testid="zone-selector-panel"
          className="pointer-events-auto flex flex-col items-center bg-[#1b162b]/90 border-2 border-[#4b3f6b] px-3 md:px-4 py-1.5 shadow-[0_3px_0_#0e0b16] order-3 lg:order-2 w-full lg:w-auto"
        >
          <div className="font-pixel text-[11px] md:text-xs text-[#f4efe6]">{stage.name}</div>
          <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((z) => (
              <button
                key={z}
                type="button"
                disabled={z > player.highestZone}
                onClick={() => onSelectZone(z)}
                className={`font-pixel text-[10px] px-1.5 py-0.5 border cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                  stage.zone === z
                    ? 'bg-[#f7c948] text-[#0e0b16] border-[#0e0b16]'
                    : z >= 9
                    ? 'bg-[#1e1b4b] text-[#7dd3fc] border-[#38bdf8]/60 hover:bg-[#312e81]'
                    : 'bg-[#2d2544] text-[#e6d8bd] border-[#4b3f6b] hover:bg-[#3d335c]'
                }`}
              >
                Z{z}
              </button>
            ))}
          </div>
          <div
            data-testid="explore-weather-badge"
            title={weatherFx.summary}
            className="mt-1.5 pt-1 border-t border-[#4b3f6b]/60 flex items-center gap-1.5 text-[10px] font-mono-num"
          >
            {weatherProfile.kind === 'rain' ? (
              <CloudRain className="w-3 h-3 shrink-0" style={{ color: weatherFx.accent }} />
            ) : weatherProfile.kind === 'snow' ? (
              <Snowflake className="w-3 h-3 shrink-0" style={{ color: weatherFx.accent }} />
            ) : weatherProfile.kind === 'embers' || weatherProfile.kind === 'volcanic_storm' ? (
              <Flame className="w-3 h-3 shrink-0" style={{ color: weatherFx.accent }} />
            ) : weatherProfile.kind === 'leaves' ? (
              <Wind className="w-3 h-3 shrink-0" style={{ color: weatherFx.accent }} />
            ) : weatherProfile.kind === 'arcane_ash' || weatherProfile.kind === 'void_rift' ? (
              <Zap className="w-3 h-3 shrink-0" style={{ color: weatherFx.accent }} />
            ) : weatherProfile.kind === 'starfall' ? (
              <Sparkles className="w-3 h-3 shrink-0" style={{ color: weatherFx.accent }} />
            ) : (
              <Sun className="w-3 h-3 shrink-0" style={{ color: weatherFx.accent }} />
            )}
            <span className="text-[#f4efe6] font-semibold">{weatherProfile.label}:</span>
            <span style={{ color: weatherFx.accent }}>{weatherFx.shortEffect}</span>
          </div>
        </div>

        {/* Top-Right: Menu & Audio Utilities */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 md:gap-2 order-2 lg:order-3">
          {player.voidTowerUnlocked && onOpenVoidTower && (
            <button
              type="button"
              data-testid="btn-void-tower-shortcut"
              onClick={onOpenVoidTower}
              className="flex items-center gap-1.5 bg-[#2e1065]/95 border-2 border-[#c084fc] hover:border-[#facc15] px-2.5 md:px-3 py-2 font-pixel text-xs text-[#f5d0fe] shadow-[0_3px_0_#0e0b16] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Crown className="w-4 h-4 text-[#facc15]" />
              <span>Void Tower</span>
            </button>
          )}

          {onOpenArena && player.highestZone >= 2 && (
            <button
              type="button"
              data-testid="btn-arena-shortcut"
              onClick={onOpenArena}
              className="flex items-center gap-1.5 bg-[#3d1221]/95 border-2 border-[#fb7185] hover:border-[#facc15] px-2.5 md:px-3 py-2 font-pixel text-xs text-[#fecdd3] shadow-[0_3px_0_#0e0b16] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Swords className="w-4 h-4 text-[#fb7185]" />
              <span>Arena</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenInventory}
            className="flex items-center gap-1.5 bg-[#1b162b]/95 border-2 border-[#4b3f6b] hover:border-[#f7c948] px-2.5 md:px-3 py-2 font-pixel text-xs text-[#f4efe6] shadow-[0_3px_0_#0e0b16] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Backpack className="w-4 h-4 text-[#f7c948]" />
            <span>Gear [I]</span>
          </button>

          <button
            type="button"
            onClick={onOpenSkillTree}
            className="relative flex items-center gap-1.5 bg-[#1b162b]/95 border-2 border-[#4b3f6b] hover:border-[#38bdf8] px-2.5 md:px-3 py-2 font-pixel text-xs text-[#f4efe6] shadow-[0_3px_0_#0e0b16] cursor-pointer whitespace-nowrap shrink-0"
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
            data-testid="toggle-touch-controls"
            aria-label={showTouchPad ? 'Hide on-screen controls' : 'Show on-screen controls'}
            title="Toggle On-Screen Touch/Mouse Controls"
            onClick={(e) => {
              e.currentTarget.blur();
              setShowTouchPad((v) => !v);
            }}
            className={`bg-[#1b162b]/95 border-2 p-2 shadow-[0_3px_0_#0e0b16] cursor-pointer ${
              showTouchPad
                ? 'border-[#38bdf8] text-[#38bdf8]'
                : 'border-[#4b3f6b] hover:border-[#f7c948] text-[#f4efe6]'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
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

      {/* Bottom Interactive Prompt, Stage Minimap, Optional Touch Controls & Hint */}
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

        {interactLabel ? (
          <button
            type="button"
            onClick={onInteract}
            className="pointer-events-auto animate-juicy-pop font-pixel text-xs md:text-sm px-5 py-2.5 bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_4px_0_#0e0b16] hover:bg-[#fde047] cursor-pointer"
          >
            {interactLabel}
          </button>
        ) : (
          nearBouncePad && (
            <div
              data-testid="bounce-pad-hint"
              className="pointer-events-none animate-juicy-pop font-pixel text-xs px-4 py-1.5 bg-[#083344]/95 text-[#22d3ee] border-2 border-[#22d3ee] shadow-[0_3px_0_#0e0b16]"
            >
              Super Bounce Pad · Press [SPACE] to Launch!
            </div>
          )
        )}

        {/* Optional On-Screen Touch / Mouse Controls */}
        {showTouchPad && (
          <div
            data-testid="explore-touch-pad"
            className="pointer-events-auto w-full max-w-2xl flex items-center justify-between px-2"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Move left"
                onPointerDown={() => onTouchMove?.(-1)}
                onPointerUp={() => onTouchMove?.(0)}
                onPointerLeave={() => onTouchMove?.(0)}
                onPointerCancel={() => onTouchMove?.(0)}
                className="w-12 h-11 flex items-center justify-center bg-[#1b162b]/95 border-2 border-[#4b3f6b] active:border-[#f7c948] text-[#f4efe6] shadow-[0_3px_0_#0e0b16] cursor-pointer select-none"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                aria-label="Move right"
                onPointerDown={() => onTouchMove?.(1)}
                onPointerUp={() => onTouchMove?.(0)}
                onPointerLeave={() => onTouchMove?.(0)}
                onPointerCancel={() => onTouchMove?.(0)}
                className="w-12 h-11 flex items-center justify-center bg-[#1b162b]/95 border-2 border-[#4b3f6b] active:border-[#f7c948] text-[#f4efe6] shadow-[0_3px_0_#0e0b16] cursor-pointer select-none"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {nearbyInteractable && (
                <button
                  type="button"
                  onClick={onInteract}
                  className="px-3.5 h-11 flex items-center gap-1.5 bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] font-pixel text-xs shadow-[0_3px_0_#0e0b16] cursor-pointer"
                >
                  <Hand className="w-4 h-4" />
                  <span>ACT</span>
                </button>
              )}
              <button
                type="button"
                aria-label="Jump"
                onPointerDown={() => onTouchJump?.()}
                className="px-4 h-11 flex items-center gap-1.5 bg-[#1e293b]/95 border-2 border-[#38bdf8] active:bg-[#0ea5e9] text-[#bae6fd] font-pixel text-xs shadow-[0_3px_0_#0e0b16] cursor-pointer select-none"
              >
                <ArrowUp className="w-4 h-4" />
                <span>JUMP</span>
              </button>
            </div>
          </div>
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
              if (ent.kind === 'gold' || ent.kind === 'material' || ent.kind === 'bounce_pad') {
                return null;
              }
              if (ent.kind === 'chest' && ent.opened) return null;
              if (ent.kind === 'shrine' && ent.used) return null;
              if (ent.kind === 'enemy' && ent.defeated) return null;

              const leftPct = Math.max(1, Math.min(98, (ent.x / stage.width) * 100));
              let color = '#94a3b8';
              let sizeCls = 'w-1.5 h-2 top-0.5';
              if (ent.kind === 'fireplace' || ent.kind === 'shop') {
                color = '#f28729';
              } else if (ent.kind === 'chest') {
                color = '#facc15';
              } else if (ent.kind === 'shrine') {
                color = '#22d3ee';
              } else if (ent.kind === 'hazard') {
                color = '#f43f5e';
                sizeCls = 'w-1 h-1 bottom-0';
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
          A/D Move · Space Jump · E Interact · Gamepad Supported
        </div>
      </div>
    </div>
  );
}
