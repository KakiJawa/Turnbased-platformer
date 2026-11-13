import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CloudRain,
  Crosshair,
  Eye,
  Flame,
  Heart,
  Package,
  ScrollText,
  Shield,
  Snowflake,
  Sparkles,
  Sun,
  Sword,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  BattleLogEntry,
  BattleState,
  canUseComboFinisher,
  canUseStaggerExecute,
  getActiveEnemy,
  getComboBonuses,
  getEffectivePlayerCombatStats,
  getEquippedSkillsList,
  getUnlockedConsumables,
} from '../game/battleEngine';
import { BRANCH_META, STAT_LABELS } from '../game/data';
import { getSkillById } from '../game/rpgLogic';
import { PlayerState, StatKey } from '../game/types';
import { getWeatherCombatEffect, getZoneWeatherProfile } from '../game/weather';

interface BattleHudProps {
  player: PlayerState;
  battle: BattleState;
  inspectEnemyOpen: boolean;
  showItems: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onToggleInspectEnemy: (open: boolean) => void;
  onToggleShowItems: () => void;
  onAction: (
    action:
      | { kind: 'attack' }
      | { kind: 'guard' }
      | { kind: 'skill'; skillId: string }
      | { kind: 'ultimate' }
      | { kind: 'consumable'; itemId: string }
      | { kind: 'finisher'; mode: 'burst' | 'execute' }
  ) => void;
  onQteTrigger: () => void;
}

const STAT_KEYS: StatKey[] = [
  'hp',
  'mp',
  'atk',
  'matk',
  'def',
  'mdef',
  'crit',
  'critDmg',
  'block',
  'dodge',
  'speed',
];

const LOG_TONE_META: Record<
  BattleLogEntry['tone'],
  { tag: string; color: string; textColor: string }
> = {
  crit: { tag: 'CRIT', color: '#facc15', textColor: '#fef08a' },
  hit: { tag: 'HIT', color: '#e2e8f0', textColor: '#f4efe6' },
  miss: { tag: 'MISS', color: '#94a3b8', textColor: '#94a3b8' },
  stagger: { tag: 'STAG', color: '#fb923c', textColor: '#fed7aa' },
  heal: { tag: 'HEAL', color: '#4ade80', textColor: '#bbf7d0' },
  enemy: { tag: 'FOE', color: '#fb7185', textColor: '#fecdd3' },
  info: { tag: 'LOG', color: '#38bdf8', textColor: '#bae6fd' },
};

export function BattleHud({
  player,
  battle,
  inspectEnemyOpen,
  showItems,
  muted,
  onToggleMute,
  onToggleInspectEnemy,
  onToggleShowItems,
  onAction,
  onQteTrigger,
}: BattleHudProps) {
  const enemy = getActiveEnemy(battle);
  const pStats = getEffectivePlayerCombatStats(player, battle);
  const weatherProfile = getZoneWeatherProfile(battle.zone);
  const weatherFx = getWeatherCombatEffect(battle.zone);
  const equippedSkills = getEquippedSkillsList(player);
  const ultimateSkill = player.equippedUltimateId
    ? getSkillById(player.equippedUltimateId)
    : undefined;
  const consumables = getUnlockedConsumables(player);

  const [logCollapsed, setLogCollapsed] = useState(false);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const latestLogId = battle.logs[0]?.id ?? 0;

  useEffect(() => {
    const el = logScrollRef.current;
    if (el && !logCollapsed) {
      el.scrollTop = el.scrollHeight;
    }
  }, [latestLogId, logCollapsed]);

  const isPlayerTurn = battle.phase === 'player_turn';
  const hpPct = Math.max(0, Math.min(100, (player.currentHp / pStats.hp) * 100));
  const mpPct = Math.max(0, Math.min(100, (player.currentMp / pStats.mp) * 100));
  const ultPct = Math.max(0, Math.min(100, player.ultimateCharge));
  const stagPct = Math.max(
    0,
    Math.min(100, (player.currentStagger / player.maxStagger) * 100)
  );
  const comboBonuses = getComboBonuses(battle.comboCount);
  const finisherReady = canUseComboFinisher(battle);
  const executeReady = canUseStaggerExecute(battle);

  const activePassives: string[] = [];
  if (player.unlockedSkillIds.includes('phy_t1_might') || player.unlockedSkillIds.includes('phy_t2_mastery')) {
    activePassives.push('Crit Surge');
  }
  if (player.unlockedSkillIds.includes('mag_t1_focus') || player.unlockedSkillIds.includes('mag_t2_sage')) {
    activePassives.push('Mana Flow');
  }
  if (player.unlockedSkillIds.includes('def_t1_plate') || player.unlockedSkillIds.includes('def_t2_bulwark')) {
    activePassives.push('Thorns');
  }
  if (player.unlockedSkillIds.includes('spd_t1_step') || player.unlockedSkillIds.includes('spd_t2_phantom')) {
    activePassives.push('Shadow Step');
  }
  if (player.unlockedSkillIds.includes('all_t1_seed') || player.unlockedSkillIds.includes('all_t2_awakening')) {
    activePassives.push('Harvest');
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 md:p-4">
      {/* Top Row: Player Small Box (Left) + Combo Counter (Center) + Wave/Inspect & Mute (Right) */}
      <div className="flex items-start justify-between gap-4">
        {/* Small Player Box: Name, HP, small MP, Ultimate, Stagger, Buffs/Debuffs */}
        <div className="pointer-events-auto bg-[#1b162b]/95 border-2 border-[#f7c948] px-3 py-2.5 shadow-[0_4px_0_#0e0b16] w-[256px]">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="font-pixel text-xs text-[#f7c948] truncate">
              {player.name}
            </div>
            <div className="font-pixel text-[10px] text-[#e6d8bd]">
              {player.className} Lv.{player.level}
            </div>
          </div>

          {/* HP Bar */}
          <div className="mb-1">
            <div className="flex justify-between text-[11px] font-mono-num leading-none mb-0.5">
              <span className="text-[#fca5a5] font-bold">HP</span>
              <span>
                {Math.round(player.currentHp)}/{pStats.hp}
              </span>
            </div>
            <div className="h-2.5 bg-[#0e0b16] border border-[#4b3f6b]">
              <div
                className="h-full bg-[#ef4444] transition-all duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Small MP Bar */}
          <div className="mb-1">
            <div className="flex justify-between text-[10px] font-mono-num leading-none mb-0.5 text-[#93c5fd]">
              <span>MP</span>
              <span>
                {Math.round(player.currentMp)}/{pStats.mp}
              </span>
            </div>
            <div className="h-1.5 bg-[#0e0b16]">
              <div
                className="h-full bg-[#38bdf8] transition-all duration-150"
                style={{ width: `${mpPct}%` }}
              />
            </div>
          </div>

          {/* Ultimate & Stagger Bars */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <div className="flex justify-between text-[9px] font-mono-num leading-none mb-0.5 text-[#fde047]">
                <span>ULT</span>
                <span>{Math.round(ultPct)}%</span>
              </div>
              <div className="h-1.5 bg-[#0e0b16]">
                <div
                  className="h-full bg-[#facc15] transition-all duration-150"
                  style={{ width: `${ultPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[9px] font-mono-num leading-none mb-0.5 text-[#fdba74]">
                <span>STAG</span>
                <span>
                  {Math.round(player.currentStagger)}/{player.maxStagger}
                </span>
              </div>
              <div className="h-1.5 bg-[#0e0b16]">
                <div
                  className="h-full bg-[#f97316] transition-all duration-150"
                  style={{ width: `${stagPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Buff / Debuff Icon Strip */}
          <div className="mt-2 pt-1.5 border-t border-[#4b3f6b]/60 flex items-center gap-1.5 min-h-[22px] flex-wrap">
            {battle.playerBuffs.length === 0 ? (
              <span className="text-[10px] text-[#94a3b8]">No active effects</span>
            ) : (
              battle.playerBuffs.map((b) => (
                <span
                  key={b.id}
                  title={`${b.label} (${b.turns}t)`}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono-num border ${
                    b.isDebuff
                      ? 'bg-[#3d1221] border-[#ef4444] text-[#fca5a5]'
                      : 'bg-[#142e22] border-[#22c55e] text-[#86efac]'
                  }`}
                >
                  {b.type === 'def_up' ? (
                    <Shield className="w-3 h-3" />
                  ) : b.type === 'regen' ? (
                    <Heart className="w-3 h-3" />
                  ) : (
                    <Flame className="w-3 h-3" />
                  )}
                  {b.label} {b.turns}t
                </span>
              ))
            )}
          </div>

          {activePassives.length > 0 && (
            <div className="mt-1 pt-1 border-t border-[#4b3f6b]/40 flex flex-wrap gap-1">
              {activePassives.map((p) => (
                <span
                  key={p}
                  className="text-[9px] font-mono-num px-1 py-0.2 bg-[#0e0b16] border border-[#38bdf8]/40 text-[#7dd3fc]"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Top-Center: Juicy 16-Bit Combo Counter & Total Combo Damage */}
        {battle.comboCount > 0 && (
          <div
            key={battle.comboFlashSeq}
            data-testid="combo-hud"
            style={{ borderColor: comboBonuses.tierColor }}
            className="pointer-events-none bg-[#1b162b]/95 border-2 px-3.5 py-2 shadow-[0_4px_0_#0e0b16] text-center animate-combo-slam min-w-[205px]"
          >
            <div className="flex items-baseline justify-center gap-2">
              <span
                className="font-pixel text-lg font-bold leading-none"
                style={{ color: comboBonuses.tierColor }}
              >
                {battle.comboCount} HIT{battle.comboCount > 1 ? 'S' : ''}
              </span>
              <span
                className="font-pixel text-[10px] px-1.5 py-0.5 bg-[#0e0b16] border leading-none"
                style={{
                  color: comboBonuses.tierColor,
                  borderColor: comboBonuses.tierColor,
                }}
              >
                {comboBonuses.tierLabel}
              </span>
            </div>
            <div
              data-testid="combo-total-dmg"
              className="font-mono-num text-xs font-bold text-[#fffbeb] mt-1 tracking-wide"
            >
              {battle.comboDamage.toLocaleString()} TOTAL DMG
            </div>
            <div className="flex items-center justify-center gap-2 mt-1 text-[10px] font-mono-num">
              <span className="text-[#fde047] font-semibold">
                +{comboBonuses.critDmgBonus}% CRIT DMG
              </span>
              <span className="text-[#4b3f6b]">·</span>
              <span className="text-[#fdba74] font-semibold">
                +{comboBonuses.staggerBonusPct}% STAG
              </span>
            </div>
          </div>
        )}

        {/* Top-Right: Wave Banner, Combat Log Feed & Enemy Inspect Button */}
        <div className="pointer-events-auto flex flex-col items-end gap-2 max-w-[390px]">
          <div className="flex items-center gap-2">
            <div className="bg-[#1b162b]/95 border-2 border-[#4b3f6b] px-3 py-1.5 font-pixel text-xs text-[#f4efe6] shadow-[0_3px_0_#0e0b16] whitespace-nowrap shrink-0">
              Wave {battle.waveIndex + 1}/{battle.wave.length} · Turn {battle.turnCount}
            </div>
            <button
              type="button"
              onClick={() => onToggleInspectEnemy(!inspectEnemyOpen)}
              className="flex items-center gap-1.5 bg-[#2d2544] hover:bg-[#3d335c] border-2 border-[#4b3f6b] hover:border-[#f7c948] px-2.5 py-1.5 font-pixel text-xs text-[#f7c948] shadow-[0_3px_0_#0e0b16] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="bg-[#1b162b]/95 border-2 border-[#4b3f6b] p-1.5 text-[#f4efe6] shadow-[0_3px_0_#0e0b16] cursor-pointer shrink-0"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Active Stage Weather Combat Modifier */}
          <div
            data-testid="battle-weather-badge"
            title={weatherFx.summary}
            style={{ borderColor: weatherFx.accent }}
            className="bg-[#1b162b]/95 border px-2.5 py-1 shadow-[0_3px_0_#0e0b16] flex items-center gap-1.5 text-[11px] font-mono-num"
          >
            {weatherProfile.kind === 'rain' ? (
              <CloudRain className="w-3.5 h-3.5 shrink-0" style={{ color: weatherFx.accent }} />
            ) : weatherProfile.kind === 'snow' ? (
              <Snowflake className="w-3.5 h-3.5 shrink-0" style={{ color: weatherFx.accent }} />
            ) : weatherProfile.kind === 'embers' || weatherProfile.kind === 'volcanic_storm' ? (
              <Flame className="w-3.5 h-3.5 shrink-0" style={{ color: weatherFx.accent }} />
            ) : weatherProfile.kind === 'leaves' ? (
              <Wind className="w-3.5 h-3.5 shrink-0" style={{ color: weatherFx.accent }} />
            ) : weatherProfile.kind === 'arcane_ash' ? (
              <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: weatherFx.accent }} />
            ) : (
              <Sun className="w-3.5 h-3.5 shrink-0" style={{ color: weatherFx.accent }} />
            )}
            <span className="font-pixel text-[10px] text-[#f4efe6]">{weatherFx.name}</span>
            <span className="text-[#4b3f6b]">·</span>
            <span className="font-semibold" style={{ color: weatherFx.accent }}>
              {weatherFx.shortEffect}
            </span>
          </div>

          {/* Translucent Scrolling Classic RPG Combat Log Feed */}
          <div
            data-testid="combat-log-feed"
            className="w-[340px] md:w-[390px] bg-[#0e0b16]/62 backdrop-blur-[2px] border-2 border-[#4b3f6b]/90 shadow-[0_3px_0_#0e0b16]"
          >
            <div className="flex items-center justify-between px-2.5 py-1 border-b border-[#4b3f6b]/60 bg-[#1b162b]/55">
              <div className="flex items-center gap-1.5">
                <ScrollText className="w-3 h-3 text-[#f7c948]" />
                <span className="font-pixel text-[10px] text-[#f7c948] tracking-wide">
                  COMBAT LOG
                </span>
                <span className="font-mono-num text-[10px] text-[#94a3b8]">
                  ({battle.logs.length})
                </span>
              </div>
              <button
                type="button"
                aria-label={logCollapsed ? 'Expand combat log' : 'Collapse combat log'}
                onClick={() => setLogCollapsed((prev) => !prev)}
                className="flex items-center gap-0.5 text-[10px] font-mono-num text-[#cbd5e1] hover:text-[#f7c948] cursor-pointer px-1"
              >
                <span>{logCollapsed ? 'Show' : 'Hide'}</span>
                {logCollapsed ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronUp className="w-3 h-3" />
                )}
              </button>
            </div>

            {!logCollapsed && (
              <div
                ref={logScrollRef}
                data-testid="combat-log-scroll"
                className="max-h-[112px] overflow-y-auto px-2.5 py-1.5 space-y-1 text-[11px] leading-snug"
              >
                {[...battle.logs].reverse().map((l, idx, arr) => {
                  const isLatest = idx === arr.length - 1;
                  const meta = LOG_TONE_META[l.tone];
                  return (
                    <div
                      key={l.id}
                      data-tone={l.tone}
                      className={`flex items-start gap-1.5 ${
                        isLatest ? 'opacity-100 font-semibold' : 'opacity-80'
                      } ${l.tone === 'miss' ? 'italic' : ''}`}
                    >
                      <span className="font-mono-num text-[10px] text-[#64748b] shrink-0 mt-[1px]">
                        T{l.turn ?? 1}
                      </span>
                      <span
                        className="font-mono-num text-[9px] font-bold px-1 py-0.2 border shrink-0 mt-[1px]"
                        style={{
                          color: meta.color,
                          borderColor: `${meta.color}66`,
                          backgroundColor: 'rgba(14, 11, 22, 0.72)',
                        }}
                      >
                        {meta.tag}
                      </span>
                      <span style={{ color: isLatest ? meta.textColor : '#cbd5e1' }}>
                        {l.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center QTE Timing Overlay (Dodge -> Counter Attack) */}
      {battle.qte.active && (
        <div className="pointer-events-auto self-center w-full max-w-md bg-[#1b162b] border-4 border-[#f7c948] p-4 shadow-[0_6px_0_#0e0b16] animate-juicy-pop">
          <div className="flex items-center justify-between mb-2">
            <span
              className={`font-pixel text-sm font-bold ${
                battle.qte.phase === 'counter' ? 'text-[#4ade80]' : 'text-[#facc15]'
              }`}
            >
              {battle.qte.promptLabel}
            </span>
            <span className="font-mono-num text-xs text-[#e6d8bd]">
              {battle.qte.resultTimer.toFixed(1)}s
            </span>
          </div>

          {/* Timing Track */}
          <div className="relative h-7 bg-[#0e0b16] border-2 border-[#4b3f6b] overflow-hidden mb-3">
            {/* Sweet-Spot Target Zone */}
            <div
              className={`absolute top-0 bottom-0 ${
                battle.qte.phase === 'counter'
                  ? 'bg-[#22c55e]/55 border-x-2 border-[#4ade80]'
                  : 'bg-[#38bdf8]/55 border-x-2 border-[#7dd3fc]'
              }`}
              style={{
                left: `${battle.qte.zoneStart * 100}%`,
                width: `${(battle.qte.zoneEnd - battle.qte.zoneStart) * 100}%`,
              }}
            />
            {/* Moving Cursor */}
            <div
              data-testid="qte-cursor"
              className="absolute top-0 bottom-0 w-2 bg-[#facc15] border border-[#0e0b16]"
              style={{ left: `calc(${battle.qte.cursor * 100}% - 4px)` }}
            />
          </div>

          <button
            type="button"
            onClick={onQteTrigger}
            className="w-full font-pixel py-2.5 text-sm font-bold bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_3px_0_#0e0b16] hover:bg-[#fde047] active:translate-y-0.5 cursor-pointer"
          >
            {battle.qte.phase === 'dodge'
              ? 'DODGE NOW! [SPACE / CLICK]'
              : 'COUNTER STRIKE! [SPACE / CLICK]'}
          </button>
        </div>
      )}

      {/* Enemy Full Stat Inspector Modal (Opens on Clicking Enemy or Inspect Button) */}
      {inspectEnemyOpen && enemy && (
        <div className="pointer-events-auto self-center bg-[#1b162b] border-3 border-[#f7c948] p-4 shadow-[0_6px_0_#0e0b16] w-full max-w-md animate-juicy-pop">
          <div className="flex items-center justify-between border-b border-[#4b3f6b] pb-2 mb-3">
            <div>
              <div className="font-pixel text-sm text-[#f7c948]">{enemy.name}</div>
              <div className="text-xs text-[#cbd5e1] capitalize">
                Zone {enemy.zone} · {enemy.rarity} · Lv.{enemy.level}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close enemy inspector"
              onClick={() => onToggleInspectEnemy(false)}
              className="p-1 bg-[#2d2544] border border-[#4b3f6b] text-[#f4efe6] hover:border-[#f7c948] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Vitality & Points */}
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs font-mono-num">
            <div className="bg-[#0e0b16] border border-[#4b3f6b] px-2.5 py-1.5">
              <span className="text-[#fca5a5]">HP:</span> {enemy.currentHp}/{enemy.stats.hp}
            </div>
            <div className="bg-[#0e0b16] border border-[#4b3f6b] px-2.5 py-1.5">
              <span className="text-[#93c5fd]">MP:</span> {enemy.currentMp}/{enemy.stats.mp}
            </div>
            <div className="bg-[#0e0b16] border border-[#4b3f6b] px-2.5 py-1.5">
              <span className="text-[#fde047]">ULT:</span> {enemy.ultimateCharge}/100
            </div>
            <div className="bg-[#0e0b16] border border-[#4b3f6b] px-2.5 py-1.5">
              <span className="text-[#fdba74]">STAGGER:</span> {enemy.currentStagger}/
              {enemy.maxStagger}
            </div>
          </div>

          {/* All 11 Base Stats */}
          <div className="grid grid-cols-3 gap-1.5 text-xs font-mono-num mb-2">
            {STAT_KEYS.map((k) => (
              <div
                key={k}
                className="flex justify-between bg-[#2d2544]/70 px-2 py-1 border border-[#4b3f6b]/50"
              >
                <span className="text-[#cbd5e1]">{STAT_LABELS[k]}</span>
                <span className="font-bold text-[#f4efe6]">{enemy.stats[k]}</span>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-[#cbd5e1] mt-2">
            Special Move: <span className="text-[#facc15] font-semibold">{enemy.specialName}</span> (Dodge QTE window)
          </div>
        </div>
      )}

      {/* Bottom-Center Juicy Battle Action Deck */}
      <div className="pointer-events-auto self-center w-full max-w-4xl flex flex-col items-center gap-2">
        {/* Combo Finisher & Stagger Execute Bar (Appears at 3+ Combo) */}
        {battle.comboCount >= 3 && (
          <div className="flex flex-wrap items-center justify-center gap-2 animate-juicy-pop">
            <button
              type="button"
              data-testid="btn-stagger-execute"
              disabled={!isPlayerTurn || !executeReady}
              onClick={() => onAction({ kind: 'finisher', mode: 'execute' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-[#ea580c] to-[#9a3412] border-2 border-[#fdba74] shadow-[0_3px_0_#0e0b16] hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Crosshair className="w-3.5 h-3.5 text-[#ffedd5]" />
              <span className="font-pixel text-[11px] text-[#fff7ed]">
                [X] Stagger Execute (3+ Hits)
              </span>
            </button>

            <button
              type="button"
              data-testid="btn-combo-finisher"
              disabled={!isPlayerTurn || !finisherReady}
              onClick={() => onAction({ kind: 'finisher', mode: 'burst' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-[#9333ea] to-[#581c87] border-2 border-[#e879f9] shadow-[0_3px_0_#0e0b16] hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                finisherReady && isPlayerTurn ? 'animate-ult-ready' : ''
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#f5d0fe]" />
              <span className="font-pixel text-[11px] text-[#fae8ff]">
                [C] Combo Finisher {finisherReady ? 'READY!' : `(${battle.comboCount}/5)`}
              </span>
            </button>
          </div>
        )}

        {/* Pop-up Consumables Hotbar Tray */}
        {showItems && (
          <div
            data-testid="consumable-hotbar"
            className="bg-[#1b162b] border-2 border-[#4ade80] p-2.5 shadow-[0_4px_0_#0e0b16] flex flex-wrap items-center justify-center gap-2 animate-juicy-pop"
          >
            {consumables.length === 0 ? (
              <span className="text-xs text-[#94a3b8] px-3 py-1">
                No consumables left! Visit the Shop near a Fireplace.
              </span>
            ) : (
              consumables.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!isPlayerTurn}
                  onClick={() => {
                    onToggleShowItems();
                    onAction({ kind: 'consumable', itemId: item.id });
                  }}
                  className="px-3 py-1.5 bg-[#142e22] hover:bg-[#1d4231] border-2 border-[#4ade80] text-left cursor-pointer disabled:opacity-40 transition-transform hover:-translate-y-0.5 active:scale-95"
                >
                  <div className="font-pixel text-[11px] text-[#86efac]">
                    {item.name} x{item.quantity}
                  </div>
                  <div className="text-[10px] text-[#cbd5e1]">{item.description}</div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Primary Action Bar */}
        <div className="bg-[#1b162b]/95 border-2 border-[#4b3f6b] p-2 shadow-[0_6px_0_#0e0b16] flex flex-wrap items-center justify-center gap-2">
          {/* Basic Attack */}
          <button
            type="button"
            disabled={!isPlayerTurn}
            onClick={() => onAction({ kind: 'attack' })}
            className="group relative flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-b from-[#d97706] to-[#92400e] border-2 border-[#f7c948] shadow-[0_4px_0_#0e0b16] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_#0e0b16] transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Sword className="w-4 h-4 text-[#fef08a] group-hover:rotate-12 transition-transform" />
            <div className="text-left">
              <div className="font-pixel text-xs text-[#fffbeb]">Attack [Q]</div>
              <div className="text-[10px] font-mono-num text-[#fde68a]">+4 MP · 24 Stag</div>
            </div>
          </button>

          {/* Guard */}
          <button
            type="button"
            disabled={!isPlayerTurn}
            onClick={() => onAction({ kind: 'guard' })}
            className="group flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-b from-[#334155] to-[#1e293b] border-2 border-[#38bdf8] shadow-[0_4px_0_#0e0b16] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_#0e0b16] transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Shield className="w-4 h-4 text-[#7dd3fc] group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <div className="font-pixel text-xs text-[#f0f9ff]">Guard [G]</div>
              <div className="text-[10px] font-mono-num text-[#bae6fd]">+8 MP · Block</div>
            </div>
          </button>

          {/* Equipped Skills (up to 6) */}
          {equippedSkills.map((skill, idx) => {
            const cd = battle.skillCooldowns[skill.id] ?? 0;
            const notEnoughMp = player.currentMp < (skill.mpCost ?? 0);
            const disabled = !isPlayerTurn || cd > 0 || notEnoughMp;
            const accent = BRANCH_META[skill.branch].accent;
            return (
              <button
                key={skill.id}
                type="button"
                disabled={disabled}
                title={skill.description}
                onClick={() => onAction({ kind: 'skill', skillId: skill.id })}
                style={{ borderColor: disabled ? '#4b3f6b' : accent }}
                className="group relative flex items-center gap-2 px-3 py-2 bg-[#2d2544] hover:bg-[#3a3057] border-2 shadow-[0_4px_0_#0e0b16] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_#0e0b16] transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4 shrink-0" style={{ color: accent }} />
                <div className="text-left">
                  <div className="font-pixel text-[11px] text-[#f4efe6] whitespace-nowrap">
                    [{idx + 1}] {skill.name}
                  </div>
                  <div className="text-[10px] font-mono-num text-[#cbd5e1]">
                    {cd > 0 ? `CD: ${cd}t` : `${skill.mpCost ?? 0} MP · ${skill.cooldown ?? 1}t CD`}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Equipped Ultimate (1 slot) */}
          {ultimateSkill && (
            <button
              type="button"
              disabled={!isPlayerTurn || player.ultimateCharge < 100}
              title={ultimateSkill.description}
              onClick={() => onAction({ kind: 'ultimate' })}
              className={`flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-b from-[#7e22ce] to-[#4c1d95] border-2 border-[#facc15] shadow-[0_4px_0_#0e0b16] hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                player.ultimateCharge >= 100 ? 'animate-ult-ready' : ''
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#fde047]" />
              <div className="text-left">
                <div className="font-pixel text-xs text-[#fef08a]">
                  [U] {ultimateSkill.name}
                </div>
                <div className="text-[10px] font-mono-num text-[#e9d5ff]">
                  {player.ultimateCharge >= 100
                    ? 'READY!'
                    : `${Math.round(player.ultimateCharge)}/100%`}
                </div>
              </div>
            </button>
          )}

          {/* Consumables Toggle */}
          <button
            type="button"
            disabled={!isPlayerTurn}
            onClick={onToggleShowItems}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-[#142e22] hover:bg-[#1e4432] border-2 border-[#4ade80] shadow-[0_4px_0_#0e0b16] hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-45"
          >
            <Package className="w-4 h-4 text-[#86efac]" />
            <div className="text-left">
              <div className="font-pixel text-xs text-[#dcfce7]">Items [F]</div>
              <div className="text-[10px] font-mono-num text-[#86efac]">
                {consumables.reduce((acc, c) => acc + c.quantity, 0)} left
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
