import { Crown, GitBranch, Lock, RotateCcw, Save, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { BRANCH_META, SKILL_TREE } from '../game/data';
import {
  MAX_EQUIPPED_SKILLS,
  MAX_TIER1_LEVEL,
  canAdvanceClass,
  canUnlockSkill,
  getRespecCost,
  getSkillById,
} from '../game/rpgLogic';
import { PlayerState, SkillBranch } from '../game/types';

interface SkillTreeModalProps {
  player: PlayerState;
  onClose: () => void;
  onUnlockSkill: (skillId: string) => void;
  onToggleEquipSkill: (skillId: string) => void;
  onAdvanceClass: () => void;
  onRespec: () => { ok: boolean; msg: string };
  onSavePreset: (slotIndex: number) => void;
  onLoadPreset: (slotIndex: number) => void;
}

const BRANCHES: SkillBranch[] = [
  'physical',
  'magical',
  'defensive',
  'support',
  'speed',
  'allstat',
];

export function SkillTreeModal({
  player,
  onClose,
  onUnlockSkill,
  onToggleEquipSkill,
  onAdvanceClass,
  onRespec,
  onSavePreset,
  onLoadPreset,
}: SkillTreeModalProps) {
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const readyToAdvance = canAdvanceClass(player);
  const respecCost = getRespecCost(player);
  const presets = player.skillPresets ?? [
    { name: 'Preset 1', skillIds: ['phy_t1_slash'], ultimateId: '' },
    { name: 'Preset 2', skillIds: ['phy_t1_slash'], ultimateId: '' },
  ];

  return (
    <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#1b162b] border-4 border-[#38bdf8] shadow-[0_8px_0_#0e0b16] w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#4b3f6b]">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-[#38bdf8]" />
            <div>
              <h2 className="font-pixel text-base text-[#38bdf8]">
                6-Branch Skill Tree · {player.className} (Tier {player.classTier})
              </h2>
              <p className="text-xs text-[#cbd5e1]">
                Max 6 Active Skills (1–5t CD) &amp; 1 Ultimate equipped · Advance at Villager Lv.{MAX_TIER1_LEVEL}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="font-pixel text-xs bg-[#0e0b16] border border-[#f7c948] px-3 py-1.5 text-[#f7c948]">
              Skill Points: {player.skillPoints}
            </div>
            <button
              type="button"
              data-testid="respec-skills"
              disabled={respecCost === 0 || player.gold < respecCost}
              onClick={() => setFeedback(onRespec())}
              title={
                respecCost === 0
                  ? 'Unlock at least 1 extra node first'
                  : `Refund all skill points for ${respecCost}G`
              }
              className="font-pixel text-[11px] px-3 py-1.5 bg-[#2d2544] text-[#fb7185] border border-[#fb7185]/60 hover:border-[#fb7185] disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Respec ({respecCost}G)</span>
            </button>
            {readyToAdvance && (
              <button
                type="button"
                onClick={onAdvanceClass}
                className="animate-ult-ready font-pixel text-xs px-4 py-2 bg-[#f7c948] text-[#0e0b16] border-2 border-[#0e0b16] hover:bg-[#fde047] flex items-center gap-1.5 cursor-pointer"
              >
                <Crown className="w-4 h-4" />
                <span>Advance to Vanguard Hero!</span>
              </button>
            )}
            <button
              type="button"
              aria-label="Close skill tree"
              onClick={onClose}
              className="p-1.5 bg-[#2d2544] border border-[#4b3f6b] hover:border-[#38bdf8] text-[#f4efe6] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Equipped Loadout Bar (6 Skills + 1 Ultimate + Presets) */}
        <div className="px-5 py-2.5 bg-[#0e0b16]/80 border-b border-[#4b3f6b] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-pixel text-[11px] text-[#e6d8bd] mr-1">
              Loadout ({player.equippedSkillIds.length}/{MAX_EQUIPPED_SKILLS}):
            </span>
            {player.equippedSkillIds.map((id) => {
              const sk = getSkillById(id);
              if (!sk) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onToggleEquipSkill(id)}
                  className="font-pixel text-[10px] px-2.5 py-1 bg-[#2d2544] border border-[#38bdf8] text-[#f4efe6] hover:border-[#ef4444] cursor-pointer"
                >
                  {sk.name} ×
                </button>
              );
            })}
            <span className="font-pixel text-[11px] text-[#facc15] ml-2">Ultimate:</span>
            {player.equippedUltimateId ? (
              <button
                type="button"
                onClick={() => onToggleEquipSkill(player.equippedUltimateId)}
                className="font-pixel text-[10px] px-2.5 py-1 bg-[#4c1d95] border border-[#facc15] text-[#fef08a] cursor-pointer"
              >
                {getSkillById(player.equippedUltimateId)?.name} ×
              </button>
            ) : (
              <span className="text-xs text-[#94a3b8]">None equipped</span>
            )}
          </div>

          {/* Preset Slots */}
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((preset, idx) => (
              <div
                key={preset.name}
                className="flex items-center bg-[#1b162b] border border-[#4b3f6b] px-1.5 py-0.5 gap-1"
              >
                <span className="font-pixel text-[10px] text-[#cbd5e1] px-1">
                  {preset.name}
                </span>
                <button
                  type="button"
                  data-testid={`save-preset-${idx}`}
                  onClick={() => {
                    onSavePreset(idx);
                    setFeedback({ ok: true, msg: `Saved current loadout to ${preset.name}!` });
                  }}
                  title={`Save current loadout to ${preset.name}`}
                  className="font-pixel text-[9px] px-1.5 py-0.5 bg-[#2d2544] text-[#f7c948] border border-[#4b3f6b] hover:border-[#f7c948] flex items-center gap-0.5 cursor-pointer"
                >
                  <Save className="w-2.5 h-2.5" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  data-testid={`load-preset-${idx}`}
                  onClick={() => {
                    onLoadPreset(idx);
                    setFeedback({ ok: true, msg: `Loaded ${preset.name}!` });
                  }}
                  className="font-pixel text-[9px] px-1.5 py-0.5 bg-[#142e22] text-[#86efac] border border-[#22c55e]/60 hover:border-[#4ade80] cursor-pointer"
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            className={`px-5 py-1.5 text-xs font-pixel border-b border-[#4b3f6b] ${
              feedback.ok
                ? 'bg-[#142e22] text-[#86efac]'
                : 'bg-[#3d1221] text-[#fca5a5]'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {/* 6 Branches Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {BRANCHES.map((branch) => {
            const meta = BRANCH_META[branch];
            const nodes = SKILL_TREE.filter((s) => s.branch === branch);
            return (
              <div
                key={branch}
                className="bg-[#0e0b16]/75 border-2 p-3 flex flex-col gap-2"
                style={{ borderColor: meta.accent }}
              >
                <div
                  className="font-pixel text-xs font-bold pb-1 border-b border-white/10 flex justify-between"
                  style={{ color: meta.accent }}
                >
                  <span>{meta.label} Branch</span>
                  <span>
                    {nodes.filter((n) => player.unlockedSkillIds.includes(n.id)).length}/
                    {nodes.length}
                  </span>
                </div>

                {nodes.map((node) => {
                  const unlocked = player.unlockedSkillIds.includes(node.id);
                  const canBuy = canUnlockSkill(player, node.id);
                  const isEquipped =
                    player.equippedSkillIds.includes(node.id) ||
                    player.equippedUltimateId === node.id;
                  const tierLocked = player.classTier < node.tierRequired;

                  return (
                    <div
                      key={node.id}
                      className={`p-2 border transition-colors ${
                        unlocked
                          ? 'bg-[#2d2544] border-[#f4efe6]/40'
                          : canBuy
                          ? 'bg-[#1f2937] border-[#f7c948]'
                          : 'bg-[#14101f] border-[#2d2544] opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {node.kind === 'ultimate' && (
                              <Sparkles className="w-3.5 h-3.5 text-[#facc15]" />
                            )}
                            {tierLocked && (
                              <Lock className="w-3 h-3 text-[#f43f5e]" />
                            )}
                            <span className="font-pixel text-[11px] text-[#f4efe6]">
                              {node.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#94a3b8] mt-0.5">
                            {node.kind === 'active'
                              ? `Active · ${node.mpCost ?? 0} MP · ${node.cooldown ?? 1}t CD`
                              : node.kind === 'ultimate'
                              ? 'Ultimate (100% Charge)'
                              : 'Passive / Stat'}
                            {node.tierRequired === 2 ? ' · Hero Tier 2' : ''}
                          </div>
                        </div>

                        {unlocked ? (
                          node.kind === 'active' || node.kind === 'ultimate' ? (
                            <button
                              type="button"
                              onClick={() => onToggleEquipSkill(node.id)}
                              className={`font-pixel text-[10px] px-2 py-1 border cursor-pointer shrink-0 ${
                                isEquipped
                                  ? 'bg-[#22c55e] text-[#0e0b16] border-[#0e0b16]'
                                  : 'bg-[#1b162b] text-[#f4efe6] border-[#4b3f6b] hover:border-[#38bdf8]'
                              }`}
                            >
                              {isEquipped ? 'Equipped' : 'Equip'}
                            </button>
                          ) : (
                            <span className="font-pixel text-[10px] text-[#4ade80]">
                              Active
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={!canBuy}
                            onClick={() => onUnlockSkill(node.id)}
                            className="font-pixel text-[10px] px-2 py-1 bg-[#f7c948] text-[#0e0b16] border border-[#0e0b16] hover:bg-[#fde047] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shrink-0"
                          >
                            Unlock (1 SP)
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#cbd5e1] mt-1 leading-snug">
                        {node.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
