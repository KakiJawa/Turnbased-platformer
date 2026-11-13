import { Flame, Hammer, ShoppingBag, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import {
  MATERIAL_META,
  SHOP_CONSUMABLES,
  STARTER_SHOP_SLOTS,
  STAT_LABELS,
} from '../game/data';
import { RARITY_META } from '../game/palette';
import {
  MAX_ENCHANT_LEVEL,
  getEnchantCost,
  getEquipmentEffectiveStats,
  getReforgeCost,
} from '../game/rpgLogic';
import { EquipmentItem, EquipmentSlot, MaterialId, PlayerState, StatKey } from '../game/types';

interface FireplaceTownModalProps {
  player: PlayerState;
  initialTab?: 'shop' | 'blacksmith';
  onClose: () => void;
  onRestAtFireplace: () => void;
  onBuyConsumable: (consumableId: string) => void;
  onBuyStarterGear: (slot: EquipmentSlot, name: string, price: number) => void;
  onBuyMaterial: (materialId: MaterialId) => void;
  onEnchantItem: (itemId: string, equippedSlot?: EquipmentSlot) => { ok: boolean; msg: string };
  onReforgeItem: (itemId: string, equippedSlot?: EquipmentSlot) => { ok: boolean; msg: string };
}

export function FireplaceTownModal({
  player,
  initialTab = 'shop',
  onClose,
  onRestAtFireplace,
  onBuyConsumable,
  onBuyStarterGear,
  onBuyMaterial,
  onEnchantItem,
  onReforgeItem,
}: FireplaceTownModalProps) {
  const [tab, setTab] = useState<'shop' | 'blacksmith'>(initialTab);
  const [feedback, setFeedback] = useState<string>('');

  const allItems: { item: EquipmentItem; equippedSlot?: EquipmentSlot }[] = [
    ...(['weapon', 'armor', 'helm', 'charm'] as EquipmentSlot[])
      .filter((s) => player.equipment[s] !== null)
      .map((s) => ({ item: player.equipment[s]!, equippedSlot: s })),
    ...player.inventory.map((item) => ({ item })),
  ];

  return (
    <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#1b162b] border-4 border-[#f28729] shadow-[0_8px_0_#0e0b16] w-full max-w-5xl max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#4b3f6b]">
          <div className="flex items-center gap-3">
            <Flame className="w-5 h-5 text-[#f28729]" />
            <h2 className="font-pixel text-base text-[#f7c948]">
              Wayside Camp · Fireplace, Shop &amp; Blacksmith
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono-num text-sm font-bold text-[#f7c948]">
              {player.gold} Gold
            </span>
            <button
              type="button"
              onClick={() => {
                onRestAtFireplace();
                setFeedback('Rested by the warm Fireplace! HP, MP & Stagger fully restored.');
              }}
              className="font-pixel text-xs px-3 py-1.5 bg-[#f28729] text-[#0e0b16] border border-[#0e0b16] hover:bg-[#fb923c] cursor-pointer"
            >
              Rest &amp; Recover
            </button>
            <button
              type="button"
              aria-label="Close camp menu"
              onClick={onClose}
              className="p-1.5 bg-[#2d2544] border border-[#4b3f6b] hover:border-[#f7c948] text-[#f4efe6] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between px-5 py-2 bg-[#0e0b16]/75 border-b border-[#4b3f6b]">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('shop')}
              className={`flex items-center gap-1.5 font-pixel text-xs px-4 py-2 border cursor-pointer ${
                tab === 'shop'
                  ? 'bg-[#f7c948] text-[#0e0b16] border-[#0e0b16]'
                  : 'bg-[#2d2544] text-[#e6d8bd] border-[#4b3f6b]'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Merchant Shop</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('blacksmith')}
              className={`flex items-center gap-1.5 font-pixel text-xs px-4 py-2 border cursor-pointer ${
                tab === 'blacksmith'
                  ? 'bg-[#f28729] text-[#0e0b16] border-[#0e0b16]'
                  : 'bg-[#2d2544] text-[#e6d8bd] border-[#4b3f6b]'
              }`}
            >
              <Hammer className="w-4 h-4" />
              <span>Blacksmith Forge</span>
            </button>
          </div>

          {feedback && (
            <span className="text-xs font-semibold text-[#4ade80]">{feedback}</span>
          )}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">
          {tab === 'shop' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Consumables */}
              <div>
                <h3 className="font-pixel text-xs text-[#86efac] mb-2">
                  Consumables
                </h3>
                <div className="flex flex-col gap-2">
                  {SHOP_CONSUMABLES.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 bg-[#0e0b16] border border-[#4b3f6b] flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-pixel text-xs text-[#f4efe6]">{c.name}</div>
                        <div className="text-[11px] text-[#94a3b8]">{c.description}</div>
                      </div>
                      <button
                        type="button"
                        disabled={player.gold < c.price}
                        onClick={() => {
                          onBuyConsumable(c.id);
                          setFeedback(`Bought ${c.name}!`);
                        }}
                        className="font-pixel text-[10px] px-2.5 py-1.5 bg-[#22c55e] text-[#0e0b16] border border-[#0e0b16] hover:bg-[#4ade80] disabled:opacity-35 cursor-pointer shrink-0"
                      >
                        {c.price}G
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Starter Common Equipment */}
              <div>
                <h3 className="font-pixel text-xs text-[#cbd5e1] mb-2">
                  Common Equipment
                </h3>
                <div className="flex flex-col gap-2">
                  {STARTER_SHOP_SLOTS.map((g) => (
                    <div
                      key={g.slot}
                      className="p-2.5 bg-[#0e0b16] border border-[#4b3f6b] flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-pixel text-xs text-[#cbd5e1]">{g.name}</div>
                        <div className="text-[11px] text-[#94a3b8] capitalize">
                          Common {g.slot}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={player.gold < g.price}
                        onClick={() => {
                          onBuyStarterGear(g.slot, g.name, g.price);
                          setFeedback(`Purchased ${g.name}!`);
                        }}
                        className="font-pixel text-[10px] px-2.5 py-1.5 bg-[#f7c948] text-[#0e0b16] border border-[#0e0b16] hover:bg-[#fde047] disabled:opacity-35 cursor-pointer shrink-0"
                      >
                        {g.price}G
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Common Materials */}
              <div>
                <h3 className="font-pixel text-xs text-[#fde047] mb-2">
                  Basic Materials
                </h3>
                <div className="flex flex-col gap-2">
                  {(['feather', 'hide', 'ironShard'] as MaterialId[]).map((mId) => {
                    const m = MATERIAL_META[mId];
                    return (
                      <div
                        key={mId}
                        className="p-2.5 bg-[#0e0b16] border border-[#4b3f6b] flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-pixel text-xs" style={{ color: m.color }}>
                            {m.name}
                          </div>
                          <div className="text-[11px] text-[#94a3b8] font-mono-num">
                            Owned: {player.materials[mId]}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={player.gold < m.price}
                          onClick={() => {
                            onBuyMaterial(mId);
                            setFeedback(`Bought 1x ${m.name}!`);
                          }}
                          className="font-pixel text-[10px] px-2.5 py-1.5 bg-[#38bdf8] text-[#0e0b16] border border-[#0e0b16] hover:bg-[#7dd3fc] disabled:opacity-35 cursor-pointer shrink-0"
                        >
                          {m.price}G
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Blacksmith Tab: Enchant + Reforge */
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3 text-xs font-mono-num bg-[#0e0b16] border border-[#4b3f6b] px-3 py-2">
                {(Object.keys(MATERIAL_META) as MaterialId[]).map((mId) => (
                  <span key={mId} style={{ color: MATERIAL_META[mId].color }}>
                    {MATERIAL_META[mId].name}: <strong>{player.materials[mId]}</strong>
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allItems.map(({ item, equippedSlot }) => {
                  const rMeta = RARITY_META[item.rarity];
                  const enchCost = getEnchantCost(item);
                  const refCost = getReforgeCost(item);
                  const eff = getEquipmentEffectiveStats(item);
                  return (
                    <div
                      key={item.id}
                      className="p-3 border-2 flex flex-col justify-between gap-2.5"
                      style={{ backgroundColor: rMeta.bg, borderColor: rMeta.border }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-pixel text-xs" style={{ color: rMeta.color }}>
                            {item.name} {item.level > 0 ? `+${item.level}` : ''}
                          </span>
                          <span className="text-[10px] font-mono-num text-[#f4efe6]">
                            {equippedSlot ? `EQUIPPED (${equippedSlot})` : item.slot.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-2.5 text-[11px] font-mono-num text-[#f4efe6]">
                          {Object.entries(eff).map(([k, v]) => (
                            <span key={k}>
                              +{v} {STAT_LABELS[k as StatKey]}
                            </span>
                          ))}
                        </div>
                        {item.affixes.length > 0 && (
                          <div className="mt-1 text-[10px] font-mono-num text-[#fde047] flex flex-wrap gap-x-2">
                            {item.affixes.map((af, idx) => (
                              <span key={`${af.stat}_${idx}`}>{af.label}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={item.level >= MAX_ENCHANT_LEVEL}
                          onClick={() => {
                            const r = onEnchantItem(item.id, equippedSlot);
                            setFeedback(r.msg);
                          }}
                          className="flex items-center gap-1 font-pixel text-[10px] px-2.5 py-1.5 bg-[#f28729] text-[#0e0b16] border border-[#0e0b16] hover:bg-[#fb923c] disabled:opacity-35 cursor-pointer"
                        >
                          <Hammer className="w-3 h-3" />
                          <span>
                            {item.level >= MAX_ENCHANT_LEVEL
                              ? 'Max +10'
                              : `Enchant (${enchCost.gold}G, ${enchCost.materialAmount} ${MATERIAL_META[enchCost.materialId].name})`}
                          </span>
                        </button>

                        {item.affixes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const r = onReforgeItem(item.id, equippedSlot);
                              setFeedback(r.msg);
                            }}
                            className="flex items-center gap-1 font-pixel text-[10px] px-2.5 py-1.5 bg-[#a855f7] text-[#ffffff] border border-[#0e0b16] hover:bg-[#c084fc] cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>
                              Reforge ({refCost.gold}G, {refCost.materialAmount}{' '}
                              {MATERIAL_META[refCost.materialId].name})
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
