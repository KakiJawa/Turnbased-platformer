import { Check, Crown, Flame, Hammer, Heart, Lock, ShoppingBag, Sparkles, Swords, X } from 'lucide-react';
import { useState } from 'react';
import {
  ARENA_TRIALS,
  MATERIAL_META,
  PET_CATALOG,
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
  getVoidTowerMutator,
} from '../game/rpgLogic';
import { EquipmentItem, EquipmentSlot, MaterialId, PlayerState, StatKey } from '../game/types';

export type TownTab = 'shop' | 'blacksmith' | 'pets' | 'arena' | 'tower';

interface FireplaceTownModalProps {
  player: PlayerState;
  initialTab?: TownTab;
  onClose: () => void;
  onRestAtFireplace: () => void;
  onBuyConsumable: (consumableId: string) => void;
  onBuyStarterGear: (slot: EquipmentSlot, name: string, price: number) => void;
  onBuyMaterial: (materialId: MaterialId) => void;
  onEnchantItem: (itemId: string, equippedSlot?: EquipmentSlot) => { ok: boolean; msg: string };
  onReforgeItem: (itemId: string, equippedSlot?: EquipmentSlot) => { ok: boolean; msg: string };
  onBuyPet: (petId: string) => { ok: boolean; msg: string };
  onEquipPet: (petId: string | null) => void;
  onStartArenaTrial: (trialId: string) => void;
  onStartVoidTowerFloor: (floor: number) => void;
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
  onBuyPet,
  onEquipPet,
  onStartArenaTrial,
  onStartVoidTowerFloor,
}: FireplaceTownModalProps) {
  const [tab, setTab] = useState<TownTab>(initialTab);
  const [feedback, setFeedback] = useState<string>('');
  const bestFloor = player.voidTowerBestFloor ?? 0;
  const [selectedTowerFloor, setSelectedTowerFloor] = useState<number>(() =>
    Math.max(1, bestFloor + 1)
  );

  const allItems: { item: EquipmentItem; equippedSlot?: EquipmentSlot }[] = [
    ...(['weapon', 'armor', 'helm', 'charm'] as EquipmentSlot[])
      .filter((s) => player.equipment[s] !== null)
      .map((s) => ({ item: player.equipment[s]!, equippedSlot: s })),
    ...player.inventory.map((item) => ({ item })),
  ];

  const ownedPets = player.ownedPetIds ?? [];
  const completedArenas = player.completedArenaIds ?? [];

  return (
    <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#1b162b] border-4 border-[#f28729] shadow-[0_8px_0_#0e0b16] w-full max-w-5xl max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#4b3f6b]">
          <div className="flex items-center gap-3">
            <Flame className="w-5 h-5 text-[#f28729]" />
            <h2 className="font-pixel text-base text-[#f7c948]">
              Wayside Camp · Shop, Blacksmith, Pets &amp; Arena
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2 bg-[#0e0b16]/75 border-b border-[#4b3f6b]">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab('shop')}
              className={`flex items-center gap-1.5 font-pixel text-xs px-3.5 py-2 border cursor-pointer ${
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
              className={`flex items-center gap-1.5 font-pixel text-xs px-3.5 py-2 border cursor-pointer ${
                tab === 'blacksmith'
                  ? 'bg-[#f28729] text-[#0e0b16] border-[#0e0b16]'
                  : 'bg-[#2d2544] text-[#e6d8bd] border-[#4b3f6b]'
              }`}
            >
              <Hammer className="w-4 h-4" />
              <span>Blacksmith Forge</span>
            </button>
            <button
              type="button"
              data-testid="tab-pets"
              onClick={() => setTab('pets')}
              className={`flex items-center gap-1.5 font-pixel text-xs px-3.5 py-2 border cursor-pointer ${
                tab === 'pets'
                  ? 'bg-[#4ade80] text-[#0e0b16] border-[#0e0b16]'
                  : 'bg-[#2d2544] text-[#e6d8bd] border-[#4b3f6b]'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>Pet Familiars ({ownedPets.length}/{PET_CATALOG.length})</span>
            </button>
            <button
              type="button"
              data-testid="tab-arena"
              onClick={() => setTab('arena')}
              className={`flex items-center gap-1.5 font-pixel text-xs px-3.5 py-2 border cursor-pointer ${
                tab === 'arena'
                  ? 'bg-[#fb7185] text-[#0e0b16] border-[#0e0b16]'
                  : 'bg-[#2d2544] text-[#e6d8bd] border-[#4b3f6b]'
              }`}
            >
              <Swords className="w-4 h-4" />
              <span>Boss Rush Arena</span>
            </button>
            <button
              type="button"
              data-testid="tab-tower"
              onClick={() => setTab('tower')}
              className={`flex items-center gap-1.5 font-pixel text-xs px-3.5 py-2 border cursor-pointer ${
                tab === 'tower'
                  ? 'bg-[#c084fc] text-[#0e0b16] border-[#0e0b16]'
                  : 'bg-[#2d2544] text-[#e9d5ff] border-[#7e22ce]'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Void Tower {player.voidTowerUnlocked ? `(Best F${bestFloor})` : '(Locked)'}</span>
            </button>
          </div>

          {feedback && (
            <span className="text-xs font-semibold text-[#4ade80]">{feedback}</span>
          )}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">
          {tab === 'shop' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Consumables */}
              <div>
                <h3 className="font-pixel text-xs text-[#86efac] mb-2">Consumables</h3>
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
                <h3 className="font-pixel text-xs text-[#cbd5e1] mb-2">Common Equipment</h3>
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

              {/* Materials */}
              <div>
                <h3 className="font-pixel text-xs text-[#fde047] mb-2">Basic Materials</h3>
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
          )}

          {tab === 'blacksmith' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3 text-xs font-mono-num bg-[#0e0b16] border border-[#4b3f6b] px-3 py-2">
                {(Object.keys(MATERIAL_META) as MaterialId[]).map((mId) => (
                  <span key={mId} style={{ color: MATERIAL_META[mId].color }}>
                    {MATERIAL_META[mId].name}: <strong>{player.materials[mId] ?? 0}</strong>
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
                          <span className="font-pixel text-xs inline-flex items-center gap-1" style={{ color: rMeta.color }}>
                            {item.locked && <Lock className="w-3 h-3 text-[#f7c948]" />}
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

          {tab === 'pets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="pet-shop-list">
              {PET_CATALOG.map((pet) => {
                const owned = ownedPets.includes(pet.id);
                const equipped = player.equippedPetId === pet.id;
                return (
                  <div
                    key={pet.id}
                    className="p-3.5 bg-[#0e0b16] border-2 flex flex-col justify-between gap-2.5"
                    style={{ borderColor: equipped ? pet.accent : '#4b3f6b' }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-pixel text-sm" style={{ color: pet.accent }}>
                          {pet.name}
                        </span>
                        <span className="font-mono-num text-xs text-[#f7c948]">
                          {owned ? (equipped ? 'ACTIVE FAMILIAR' : 'OWNED') : `${pet.price} Gold`}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-mono-num text-[#cbd5e1]">
                        {Object.entries(pet.statBonus).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-1.5 py-0.5 bg-[#1b162b] border border-[#4b3f6b]"
                          >
                            +{v} {STAT_LABELS[k as StatKey]}
                          </span>
                        ))}
                      </div>

                      <div className="mt-2 text-xs text-[#e6d8bd]">
                        <span className="font-semibold" style={{ color: pet.accent }}>
                          {pet.assistName}:
                        </span>{' '}
                        {pet.assistDesc}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {!owned ? (
                        <button
                          type="button"
                          data-testid={`buy-pet-${pet.id}`}
                          disabled={player.gold < pet.price}
                          onClick={() => {
                            const res = onBuyPet(pet.id);
                            setFeedback(res.msg);
                          }}
                          className="font-pixel text-xs px-4 py-1.5 bg-[#f7c948] text-[#0e0b16] border border-[#0e0b16] hover:bg-[#fde047] disabled:opacity-35 cursor-pointer"
                        >
                          Adopt for {pet.price}G
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid={`equip-pet-${pet.id}`}
                          onClick={() => {
                            onEquipPet(equipped ? null : pet.id);
                            setFeedback(
                              equipped ? `Dismissed ${pet.name}.` : `Summoned ${pet.name} to follow you!`
                            );
                          }}
                          className={`font-pixel text-xs px-4 py-1.5 border cursor-pointer ${
                            equipped
                              ? 'bg-[#2d2544] text-[#fca5a5] border-[#ef4444]'
                              : 'bg-[#22c55e] text-[#0e0b16] border-[#0e0b16] hover:bg-[#4ade80]'
                          }`}
                        >
                          {equipped ? 'Unequip' : 'Equip Familiar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'arena' && (
            <div className="flex flex-col gap-3" data-testid="arena-trials-list">
              <div className="text-xs text-[#cbd5e1] bg-[#0e0b16] border border-[#4b3f6b] px-3 py-2">
                Challenge sequential Multi-Boss Gauntlets! You restore +25% HP &amp; MP between arena waves, and defeat safely returns you to camp without losing your run.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ARENA_TRIALS.map((trial) => {
                  const unlocked = player.highestZone >= trial.minHighestZone;
                  const cleared = completedArenas.includes(trial.id);
                  const rMeta = RARITY_META[trial.guaranteedRarity];
                  return (
                    <div
                      key={trial.id}
                      className="p-3.5 bg-[#0e0b16] border-2 flex flex-col justify-between gap-3"
                      style={{ borderColor: unlocked ? rMeta.border : '#2d2544' }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-pixel text-xs" style={{ color: rMeta.color }}>
                            {trial.name}
                          </span>
                          {cleared && <Check className="w-4 h-4 text-[#4ade80] shrink-0" />}
                        </div>
                        <p className="text-[11px] text-[#cbd5e1] mt-1 leading-snug">
                          {trial.subtitle}
                        </p>
                        <div className="mt-2 space-y-1 text-[11px] font-mono-num">
                          <div className="text-[#f7c948]">
                            Reward: +{trial.bonusGold}G · +{trial.bonusXp} XP
                          </div>
                          <div style={{ color: rMeta.color }}>
                            Guaranteed: Lv.{trial.rewardZoneLevel} {rMeta.label} Gear
                          </div>
                          {!unlocked && (
                            <div className="text-[#fb7185]">
                              Requires reaching Zone {trial.minHighestZone}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid={`start-arena-${trial.id}`}
                        disabled={!unlocked}
                        onClick={() => onStartArenaTrial(trial.id)}
                        className="w-full font-pixel text-xs py-2 bg-[#fb7185] text-[#0e0b16] border border-[#0e0b16] hover:bg-[#fda4af] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {cleared ? 'Replay Gauntlet' : 'Enter Arena'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'tower' && (
            <div className="flex flex-col gap-4" data-testid="void-tower-panel">
              {!player.voidTowerUnlocked ? (
                <div className="p-5 bg-[#0e0b16] border-2 border-[#7e22ce] text-center space-y-2">
                  <Crown className="w-8 h-8 text-[#c084fc] mx-auto" />
                  <h3 className="font-pixel text-sm text-[#e9d5ff]">
                    ENDLESS VOID TOWER SEALED
                  </h3>
                  <p className="text-xs text-[#cbd5e1] max-w-lg mx-auto">
                    Defeat Architect Malakor atop Zone 10: The Void Spire to unseal the Endless Void Tower. Your hero, skills, pets, and gear remain intact so you can push infinite scaling floors!
                  </p>
                </div>
              ) : (
                (() => {
                  const mutator = getVoidTowerMutator(selectedTowerFloor);
                  const isBossFloor = selectedTowerFloor % 5 === 0;
                  const checkpoints: number[] = [1];
                  for (let f = 5; f <= bestFloor; f += 5) {
                    checkpoints.push(f);
                  }
                  const nextResumeFloor = bestFloor + 1;
                  if (!checkpoints.includes(nextResumeFloor)) {
                    checkpoints.push(nextResumeFloor);
                  }

                  return (
                    <>
                      <div className="bg-[#0e0b16] border-2 border-[#c084fc] p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-pixel text-sm text-[#e9d5ff]">
                            ENDLESS VOID TOWER · POST-ZONE 10
                          </div>
                          <div className="text-xs text-[#cbd5e1] mt-1">
                            Infinitely scaling floors with rotating Rift Mutators. Restores +30% HP/MP on floor clear; defeat returns you safely to camp without losing gear or progress.
                          </div>
                        </div>
                        <div className="bg-[#2e1065] border border-[#c084fc] px-3 py-2 text-right font-mono-num">
                          <div className="text-[10px] text-[#e9d5ff]">BEST FLOOR</div>
                          <div className="font-pixel text-base text-[#facc15]">
                            F{bestFloor}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-[#0e0b16] border border-[#4b3f6b] p-3.5 space-y-2.5">
                          <div className="font-pixel text-xs text-[#f7c948]">
                            Select Starting Floor (5-Floor Checkpoints)
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {checkpoints.map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setSelectedTowerFloor(f)}
                                className={`font-pixel text-[11px] px-2.5 py-1.5 border cursor-pointer ${
                                  selectedTowerFloor === f
                                    ? 'bg-[#c084fc] text-[#0e0b16] border-[#0e0b16]'
                                    : f % 5 === 0
                                    ? 'bg-[#3d1221] text-[#fecdd3] border-[#f43f5e]/60'
                                    : 'bg-[#2d2544] text-[#e6d8bd] border-[#4b3f6b]'
                                }`}
                              >
                                Floor {f}
                                {f === nextResumeFloor && f > 1 ? ' (Next)' : f % 5 === 0 ? ' (Boss)' : ''}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div
                          className="bg-[#0e0b16] border-2 p-3.5 flex flex-col justify-between gap-2"
                          style={{ borderColor: mutator.accent }}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-pixel text-xs text-[#f4efe6]">
                                Floor {selectedTowerFloor} {isBossFloor ? '· OVERLORD BOSS' : '· Rift Wave'}
                              </span>
                              <span
                                className="font-pixel text-[10px] px-2 py-0.5 bg-[#1b162b] border"
                                style={{ color: mutator.accent, borderColor: mutator.accent }}
                              >
                                {mutator.name}
                              </span>
                            </div>
                            <p className="text-xs text-[#cbd5e1] mt-1.5">{mutator.description}</p>
                            {isBossFloor && (
                              <p className="text-[11px] text-[#facc15] font-mono-num mt-1">
                                Boss Milestone: Guaranteed Mythic Gear + Void Essence + Starlight Ore!
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            data-testid="start-void-tower"
                            onClick={() => onStartVoidTowerFloor(selectedTowerFloor)}
                            className="w-full font-pixel text-xs py-2.5 bg-[#c084fc] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_3px_0_#0e0b16] hover:bg-[#d8b4fe] cursor-pointer"
                          >
                            Challenge Void Tower · Floor {selectedTowerFloor}
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
