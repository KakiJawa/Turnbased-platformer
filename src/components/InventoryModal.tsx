import { Shield, Sword, X } from 'lucide-react';
import { MATERIAL_META, STAT_LABELS } from '../game/data';
import { RARITY_META } from '../game/palette';
import { computePlayerStats, getEquipmentEffectiveStats } from '../game/rpgLogic';
import {
  EquipmentItem,
  EquipmentSlot,
  MaterialId,
  PlayerState,
  StatKey,
} from '../game/types';

interface InventoryModalProps {
  player: PlayerState;
  onClose: () => void;
  onEquipItem: (itemId: string) => void;
  onSellItem: (itemId: string) => void;
}

const SLOTS: { key: EquipmentSlot; label: string }[] = [
  { key: 'weapon', label: 'Weapon' },
  { key: 'armor', label: 'Armor' },
  { key: 'helm', label: 'Helm' },
  { key: 'charm', label: 'Charm / Boots' },
];

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

function ItemCard({
  item,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  item: EquipmentItem;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const rMeta = RARITY_META[item.rarity];
  const effStats = getEquipmentEffectiveStats(item);
  return (
    <div
      className="p-2.5 border-2 flex flex-col justify-between gap-2"
      style={{ backgroundColor: rMeta.bg, borderColor: rMeta.border }}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-pixel text-xs" style={{ color: rMeta.color }}>
            {item.name} {item.level > 0 ? `+${item.level}` : ''}
          </span>
          <span className="text-[10px] font-mono-num uppercase text-[#e6d8bd]">
            {rMeta.label} · {item.slot}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono-num text-[#f4efe6]">
          {Object.entries(effStats).map(([k, v]) => (
            <span key={k}>
              +{v} {STAT_LABELS[k as StatKey]}
            </span>
          ))}
        </div>

        {item.affixes.length > 0 && (
          <div className="mt-1 pt-1 border-t border-white/10 flex flex-wrap gap-x-2.5 text-[10px] font-mono-num text-[#fde047]">
            {item.affixes.map((af, idx) => (
              <span key={`${af.stat}_${idx}`}>{af.label}</span>
            ))}
          </div>
        )}
      </div>

      {(onAction || onSecondary) && (
        <div className="flex items-center gap-2 pt-1">
          {onAction && actionLabel && (
            <button
              type="button"
              onClick={onAction}
              className="font-pixel text-[10px] px-2.5 py-1 bg-[#f7c948] text-[#0e0b16] border border-[#0e0b16] hover:bg-[#fde047] cursor-pointer"
            >
              {actionLabel}
            </button>
          )}
          {onSecondary && secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary}
              className="font-pixel text-[10px] px-2.5 py-1 bg-[#2d2544] text-[#e6d8bd] border border-[#4b3f6b] hover:border-[#ef4444] cursor-pointer"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function InventoryModal({
  player,
  onClose,
  onEquipItem,
  onSellItem,
}: InventoryModalProps) {
  const stats = computePlayerStats(player);

  return (
    <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#1b162b] border-4 border-[#f7c948] shadow-[0_8px_0_#0e0b16] w-full max-w-5xl max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[#4b3f6b]">
          <div className="flex items-center gap-3">
            <Sword className="w-5 h-5 text-[#f7c948]" />
            <h2 className="font-pixel text-base text-[#f7c948]">
              Equipment &amp; Inventory (Mid-Stage Swap Enabled)
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono-num text-sm font-bold text-[#f7c948]">
              {player.gold} Gold
            </span>
            <button
              type="button"
              aria-label="Close inventory"
              onClick={onClose}
              className="p-1.5 bg-[#2d2544] border border-[#4b3f6b] hover:border-[#f7c948] text-[#f4efe6] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: 4 Equipped Slots + 11 Stats */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div>
              <h3 className="font-pixel text-xs text-[#e6d8bd] mb-2">
                Equipped Gear (4 Slots)
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {SLOTS.map(({ key, label }) => {
                  const eq = player.equipment[key];
                  return eq ? (
                    <ItemCard key={key} item={eq} />
                  ) : (
                    <div
                      key={key}
                      className="p-3 border-2 border-dashed border-[#4b3f6b] text-xs text-[#94a3b8] flex items-center gap-2"
                    >
                      <Shield className="w-4 h-4 opacity-50" />
                      <span>Empty {label} Slot</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="font-pixel text-xs text-[#e6d8bd] mb-2">
                Character Stats ({player.className} Lv.{player.level})
              </h3>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-mono-num">
                {STAT_KEYS.map((k) => (
                  <div
                    key={k}
                    className="flex justify-between bg-[#0e0b16] border border-[#4b3f6b] px-2 py-1"
                  >
                    <span className="text-[#94a3b8]">{STAT_LABELS[k]}</span>
                    <span className="font-bold text-[#f4efe6]">{stats[k]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Bag Gear + Materials & Consumables */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div>
              <h3 className="font-pixel text-xs text-[#e6d8bd] mb-2">
                Equipment Bag ({player.inventory.length} items)
              </h3>
              {player.inventory.length === 0 ? (
                <div className="p-6 border border-[#4b3f6b] bg-[#0e0b16]/60 text-xs text-[#94a3b8]">
                  Defeat monsters, open chests, or visit the Shop near a Fireplace to find tiered gear.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {player.inventory.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      actionLabel="Equip"
                      onAction={() => onEquipItem(item.id)}
                      secondaryLabel={`Sell (${item.sellValue}G)`}
                      onSecondary={() => onSellItem(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="font-pixel text-xs text-[#e6d8bd] mb-2">
                  Crafting Materials
                </h3>
                <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2.5 flex flex-col gap-1.5 text-xs font-mono-num">
                  {(Object.keys(MATERIAL_META) as MaterialId[]).map((mId) => (
                    <div key={mId} className="flex justify-between">
                      <span style={{ color: MATERIAL_META[mId].color }}>
                        {MATERIAL_META[mId].name}
                      </span>
                      <span className="font-bold">{player.materials[mId]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-pixel text-xs text-[#e6d8bd] mb-2">
                  Consumables
                </h3>
                <div className="bg-[#0e0b16] border border-[#4b3f6b] p-2.5 flex flex-col gap-1.5 text-xs">
                  {player.consumables.filter((c) => c.quantity > 0).length === 0 ? (
                    <span className="text-[#94a3b8]">Empty</span>
                  ) : (
                    player.consumables
                      .filter((c) => c.quantity > 0)
                      .map((c) => (
                        <div key={c.id} className="flex justify-between">
                          <span className="text-[#86efac]">{c.name}</span>
                          <span className="font-mono-num font-bold">x{c.quantity}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
