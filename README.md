# Villager's Trial: 16-Bit Stagger RPG

A 16-bit side-scrolling platformer and turn-based stagger RPG built with React, TypeScript, Tailwind CSS, HTML5 `<canvas>` (`480x270` internal pixel buffer), and procedural Web Audio chiptune sound/music.

## Overview

Start as a humble **Villager (Lv. 1)** armed with a Wooden Pitchfork and progress across **10 distinct zones**—from Sunlit Farmlands and Whispering Woods through Cinder Peak, Sunken Starfall Ruins, and The Void Spire. Explore platforms, dodge stage hazards, activate Blessing Shrines, trigger dramatic encounter transitions, break enemy Stagger gauges, chain combos, advance into **Tier 2 Vanguard Hero** and **Tier 3 Specializations**, and push infinitely scaling floors in the **Endless Void Tower** after clearing the main story.

## Key Features

- **16-Bit Pixel Art & Chiptune Audio**
  - Fixed `480x270` internal `<canvas>` scaled crisply with `image-rendering: pixelated` and zero smoothing.
  - Procedural pixel-art sprites, tiles, VFX bursts, shockwave rings, hitstop frames, and screen shake.
  - Synthesized Web Audio API chiptune SFX and dynamic battle music that intensifies as enemy HP drops.
- **2D Platformer Exploration (Zones 1–10)**
  - Run, jump, collect gold & crafting materials, open chests, rest at Fireplaces, and interact with Blessing Shrines.
  - Zones 9–10 add stage hazards, jump-activated Super Bounce Pads, and persistent per-zone progress saved in `localStorage`.
  - Dynamic day/weather particles per zone (`Rain`, `Heat`, `Frost`, `Void Anomaly`, etc.) that apply real combat buffs and debuffs.
- **Turn-Based Stagger, QTE & Combo Combat**
  - Break enemy Stagger bars to deal **1.5x Staggered Damage**, or trigger **Dodge -> Counter QTE** timing windows on enemy special attacks.
  - Build hit combos for bonus Crit DMG & Stagger DMG and unleash **Stagger Execute (`[X]`)** or **Combo Finisher (`[C]`)**.
  - Target multiple enemies/summons on the field (`[Tab]` or click sprite), battle multi-phase enraging bosses, and track every hit, crit, and dodge in the translucent scrolling Combat Log.
- **6-Branch Skill Tree, Class Advancement & Gear Forging**
  - Unlock active, passive, and ultimate abilities across 6 branches, save/load loadout presets, or respec points for gold.
  - Advance from **Villager -> Vanguard Hero (Tier 2)** and specialize into **Tier 3 Classes (Lv. 30+)**.
  - Loot **Common -> Mythic** equipment with affixes, compare stats side-by-side, **Lock/Favorite** items to protect them from selling/salvaging, and Enchant (`+10`) or Reforge at the Blacksmith.
- **Pet Familiars, Boss Rush Arena & Endless Void Tower**
  - Adopt and equip Pet Familiars with gold for passive stats and automatic periodic battle assists.
  - Challenge multi-boss gauntlets in the **Boss Rush Arena**.
  - Defeating the Zone 10 boss preserves your character, gear, and save while unlocking the **Endless Void Tower**—featuring infinitely scaling floors, rotating Rift Mutators, 5-floor checkpoints, and Overlord Bosses every 5th floor.

## Controls

### Explore Mode
- **Move**: `A` / `D` or `Left` / `Right` Arrow
- **Jump / Super Bounce Pad**: `Space`, `W`, or `Up` Arrow
- **Interact** *(Fireplace, Shop, Chest, Shrine, Portal)*: `E` or `Enter`
- **Inventory & Equipment**: `I` or `Tab`
- **Skill Tree & Class Advancement**: `K`
- **Pause / Mute**: `Esc` / `P` to pause, `M` to mute
- **Touch / Mouse & Gamepad**: Toggle the on-screen touch pad with the Gamepad icon in the top-right HUD, or plug in a standard HTML5 controller.

### Battle Mode
- **Basic Attack / Guard / Ultimate / Items**: `Q` / `G` / `U` / `F`
- **Skill Deck (Slots 1–6)**: `1` – `6`
- **Stagger Execute / Combo Finisher**: `X` / `C` *(unlocked at 3+ / 5+ Combo)*
- **Switch Target**: `Tab` or click any enemy sprite on the canvas
- **Dodge & Counter QTE**: `Space`, `Enter`, or click the QTE button when the cursor enters the highlight zone

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons
- **Rendering & Audio**: HTML5 Canvas 2D, Web Audio API
- **Testing**: Node.js built-in test runner (`node:test`) via `tsx`

## Prerequisites

- **Node.js** `v20+` (recommended `v22+`)
- **npm** (included with Node.js)

## How to Run Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server** *(runs on port `3000`)*:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.
   *(Tip: append `?autostart=1` to skip the Title screen and jump straight into gameplay.)*

3. **Run unit tests**:
   ```bash
   npx tsx --test src/game/*.test.ts
   ```

4. **Type-check & build for production**:
   ```bash
   npm run lint
   npm run build
   ```

5. **Preview production build**:
   ```bash
   npm run preview
   ```

## Project Structure

- `src/App.tsx` — Main `requestAnimationFrame` loop, input/gamepad handling, scene switching, and persistence wiring
- `src/game/` — Decoupled game systems (`battleEngine.ts`, `platformer.ts`, `rpgLogic.ts`, `stages.ts`, `weather.ts`, `audio.ts`, `canvasRenderer.ts`, `sprites.ts`, `vfx.ts`, `data.ts`, `persistence.ts`) and unit tests (`*.test.ts`)
- `src/components/` — HUD and modal overlays (`ExploreHud.tsx`, `BattleHud.tsx`, `InventoryModal.tsx`, `SkillTreeModal.tsx`, `FireplaceTownModal.tsx`, `StatusModals.tsx`, `TitleOverlay.tsx`)
