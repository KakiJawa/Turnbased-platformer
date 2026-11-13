import { ArrowRight, Compass, Crown, Flame, RotateCcw, Skull, Sparkles } from 'lucide-react';
import { MATERIAL_META } from '../game/data';
import { RARITY_META } from '../game/palette';
import { EquipmentItem, MaterialId, PlayerState } from '../game/types';

export interface VictoryRecapData {
  zone: number;
  title?: string;
  enemyName: string;
  turnCount: number;
  xp: number;
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  items: EquipmentItem[];
  levelsGained: number;
  maxComboCount: number;
  maxComboDamage: number;
  voidTowerFloor?: number;
  nextVoidTowerFloor?: number;
}

interface BattleVictoryModalProps {
  recap: VictoryRecapData;
  onContinue: () => void;
  onContinueVoidTower?: (nextFloor: number) => void;
}

export function BattleVictoryModal({
  recap,
  onContinue,
  onContinueVoidTower,
}: BattleVictoryModalProps) {
  const matEntries = (Object.entries(recap.materials) as [MaterialId, number][]).filter(
    ([, amt]) => amt > 0
  );

  return (
    <div className="fixed inset-0 z-30 bg-black/65 flex items-center justify-center p-4">
      <div
        data-testid="victory-recap"
        className="bg-[#1b162b] border-4 border-[#f7c948] shadow-[0_8px_0_#0e0b16] p-5 w-full max-w-md animate-juicy-pop"
      >
        <div className="flex items-center justify-between border-b-2 border-[#4b3f6b] pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#f7c948]" />
            <h2 className="font-pixel text-base text-[#f7c948]">
              {recap.title ?? 'VICTORY!'}
            </h2>
          </div>
          {recap.levelsGained > 0 && (
            <span className="font-pixel text-[11px] px-2 py-0.5 bg-[#4ade80] text-[#0e0b16] border border-[#0e0b16]">
              +{recap.levelsGained} LEVEL UP!
            </span>
          )}
        </div>

        <p className="text-xs text-[#cbd5e1] mb-3">
          Defeated <span className="text-[#f4efe6] font-semibold">{recap.enemyName}</span> in{' '}
          <span className="font-mono-num text-[#f7c948]">{recap.turnCount} turns</span> (Zone {recap.zone}).
        </p>

        {/* Combo & Loot Summary Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs font-mono-num">
          <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2">
            <div className="text-[#94a3b8] text-[10px]">BEST COMBO</div>
            <div className="font-bold text-[#fb923c] flex items-center gap-1 mt-0.5">
              <Flame className="w-3.5 h-3.5" />
              <span>
                {recap.maxComboCount} HIT{recap.maxComboCount === 1 ? '' : 'S'}
              </span>
            </div>
          </div>
          <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2">
            <div className="text-[#94a3b8] text-[10px]">COMBO DMG</div>
            <div className="font-bold text-[#c084fc] mt-0.5">
              {recap.maxComboDamage.toLocaleString()} DMG
            </div>
          </div>
          <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2">
            <div className="text-[#94a3b8] text-[10px]">XP GAINED</div>
            <div className="font-bold text-[#d8b4fe] mt-0.5">+{recap.xp} XP</div>
          </div>
          <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2">
            <div className="text-[#94a3b8] text-[10px]">GOLD EARNED</div>
            <div className="font-bold text-[#f7c948] mt-0.5">+{recap.gold} G</div>
          </div>
        </div>

        {matEntries.length > 0 && (
          <div className="bg-[#0e0b16] border border-[#4b3f6b] px-3 py-2 mb-3 text-xs font-mono-num flex flex-wrap gap-3">
            {matEntries.map(([id, amt]) => (
              <span key={id} style={{ color: MATERIAL_META[id].color }}>
                +{amt} {MATERIAL_META[id].name}
              </span>
            ))}
          </div>
        )}

        {recap.items.length > 0 && (
          <div className="mb-4 flex flex-col gap-1.5">
            <div className="font-pixel text-[10px] text-[#e6d8bd]">LOOT DROPPED:</div>
            {recap.items.map((item) => {
              const rMeta = RARITY_META[item.rarity];
              return (
                <div
                  key={item.id}
                  className="px-2.5 py-1.5 border flex items-center justify-between text-xs"
                  style={{ backgroundColor: rMeta.bg, borderColor: rMeta.border }}
                >
                  <span className="font-pixel text-[11px]" style={{ color: rMeta.color }}>
                    {item.name}
                  </span>
                  <span className="font-mono-num text-[10px] uppercase text-[#e6d8bd]">
                    {rMeta.label} · {item.slot}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {recap.nextVoidTowerFloor && onContinueVoidTower && (
            <button
              type="button"
              data-testid="victory-push-tower"
              onClick={() => onContinueVoidTower(recap.nextVoidTowerFloor!)}
              className="flex-1 flex items-center justify-center gap-1.5 font-pixel text-xs py-2.5 bg-[#c084fc] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_3px_0_#0e0b16] hover:bg-[#d8b4fe] cursor-pointer"
            >
              <span>Push Floor {recap.nextVoidTowerFloor}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            data-testid="victory-continue"
            onClick={onContinue}
            className="flex-1 font-pixel text-xs py-2.5 bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_3px_0_#0e0b16] hover:bg-[#fde047] cursor-pointer"
          >
            {recap.nextVoidTowerFloor ? 'Return to Camp' : 'CONTINUE [SPACE / ENTER]'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function PauseModal({ onResume, onRestart, onQuitToTitle }: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#1b162b] border-4 border-[#f7c948] shadow-[0_8px_0_#0e0b16] p-6 w-full max-w-sm text-center">
        <h2 className="font-pixel text-xl text-[#f7c948] mb-2">PAUSED</h2>
        <p className="text-xs text-[#cbd5e1] mb-5">Press Esc or P to resume adventure.</p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="font-pixel text-sm py-2.5 bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] hover:bg-[#fde047] cursor-pointer"
          >
            Resume Game
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="font-pixel text-xs py-2.5 bg-[#2d2544] text-[#f4efe6] border-2 border-[#4b3f6b] hover:border-[#f7c948] cursor-pointer"
          >
            Restart Run
          </button>
          <button
            type="button"
            onClick={onQuitToTitle}
            className="font-pixel text-xs py-2.5 bg-[#0e0b16] text-[#cbd5e1] border-2 border-[#4b3f6b] hover:border-[#ef4444] cursor-pointer"
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}

interface OutcomeModalProps {
  kind: 'victory' | 'gameover';
  player: PlayerState;
  zone: number;
  onRestart: () => void;
  onContinuePostgame?: () => void;
  onEnterVoidTower?: () => void;
}

export function OutcomeModal({
  kind,
  player,
  zone,
  onRestart,
  onContinuePostgame,
  onEnterVoidTower,
}: OutcomeModalProps) {
  const isVictory = kind === 'victory';
  return (
    <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
      <div
        data-testid={isVictory ? 'outcome-victory-modal' : 'outcome-gameover-modal'}
        className={`bg-[#1b162b] border-4 shadow-[0_8px_0_#0e0b16] p-6 w-full max-w-md text-center ${
          isVictory ? 'border-[#f7c948]' : 'border-[#ef4444]'
        }`}
      >
        <div className="flex justify-center mb-3">
          {isVictory ? (
            <Crown className="w-10 h-10 text-[#f7c948]" />
          ) : (
            <Skull className="w-10 h-10 text-[#ef4444]" />
          )}
        </div>

        <h2
          className={`font-pixel text-xl mb-1 ${
            isVictory ? 'text-[#f7c948]' : 'text-[#ef4444]'
          }`}
        >
          {isVictory ? 'VOID SPIRE CONQUERED!' : 'DEFEATED IN BATTLE'}
        </h2>
        <p className="text-xs text-[#cbd5e1] mb-4">
          {isVictory
            ? 'You vanquished Architect Malakor! Your save, gear, skills, and Pet Familiar remain intact, and the Endless Void Tower is now open.'
            : 'Your journey ended in the field, but your legend awaits another try.'}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-5 text-xs font-mono-num">
          <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2">
            <div className="text-[#94a3b8]">Class / Lv</div>
            <div className="font-bold text-[#f4efe6] mt-0.5">
              {player.className} {player.level}
            </div>
          </div>
          <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2">
            <div className="text-[#94a3b8]">Zone</div>
            <div className="font-bold text-[#f7c948] mt-0.5">{zone}/10</div>
          </div>
          <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2">
            <div className="text-[#94a3b8]">Slain</div>
            <div className="font-bold text-[#4ade80] mt-0.5">
              {player.monstersDefeated}
            </div>
          </div>
        </div>

        {isVictory ? (
          <div className="flex flex-col gap-2.5">
            {onEnterVoidTower && (
              <button
                type="button"
                data-testid="victory-enter-tower"
                onClick={onEnterVoidTower}
                className="w-full flex items-center justify-center gap-2 font-pixel text-xs sm:text-sm py-3 bg-[#c084fc] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_4px_0_#0e0b16] hover:bg-[#d8b4fe] cursor-pointer"
              >
                <Crown className="w-4 h-4" />
                <span>Enter Endless Void Tower (Floor 1)</span>
              </button>
            )}
            {onContinuePostgame && (
              <button
                type="button"
                data-testid="victory-keep-exploring"
                onClick={onContinuePostgame}
                className="w-full flex items-center justify-center gap-2 font-pixel text-xs py-2.5 bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_4px_0_#0e0b16] hover:bg-[#fde047] cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Keep Exploring (Wayside Camp)</span>
              </button>
            )}
            <button
              type="button"
              data-testid="victory-new-run"
              onClick={onRestart}
              className="w-full flex items-center justify-center gap-2 font-pixel text-[11px] py-2 bg-[#0e0b16] text-[#cbd5e1] border-2 border-[#4b3f6b] hover:border-[#ef4444] hover:text-[#fca5a5] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start Fresh Lv.1 Run (Resets Save)</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-start="true"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 font-pixel text-sm py-3 bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_4px_0_#0e0b16] hover:bg-[#fde047] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        )}
      </div>
    </div>
  );
}
