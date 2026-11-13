import { Crown, RotateCcw, Skull } from 'lucide-react';
import { PlayerState } from '../game/types';

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
}

export function OutcomeModal({ kind, player, zone, onRestart }: OutcomeModalProps) {
  const isVictory = kind === 'victory';
  return (
    <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
      <div
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
          {isVictory ? 'DRAGON CONQUERED!' : 'DEFEATED IN BATTLE'}
        </h2>
        <p className="text-xs text-[#cbd5e1] mb-4">
          {isVictory
            ? 'You rose from a humble Villager to vanquish Ignis at Obsidian Peaks!'
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
            <div className="font-bold text-[#f7c948] mt-0.5">{zone}/4</div>
          </div>
          <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2">
            <div className="text-[#94a3b8]">Slain</div>
            <div className="font-bold text-[#4ade80] mt-0.5">
              {player.monstersDefeated}
            </div>
          </div>
        </div>

        <button
          type="button"
          data-start="true"
          onClick={onRestart}
          className="w-full flex items-center justify-center gap-2 font-pixel text-sm py-3 bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_4px_0_#0e0b16] hover:bg-[#fde047] cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{isVictory ? 'Play Again' : 'Try Again'}</span>
        </button>
      </div>
    </div>
  );
}
