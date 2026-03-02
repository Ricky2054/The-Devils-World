# Asset Requirements for Fully Polished Devil World MVP

## 1) Core Visual Art (High Priority)
- **Parallax background layers** (minimum 3):
  - Far mountains/sky (loopable)
  - Mid forest layer
  - Foreground foliage/atmospheric layer
- **Ground tile set (pixel-art, seamless):** grass, dirt, stone, path, water edge, cliff edge
- **Biome variants:** day + night palette swaps

## 2) Character and Combat Art
- **Player sprite sheet** (same frame dimensions for all states):
  - idle, run, attack1, attack2, combo, defend, roll, hurt, death
- **Enemy sprite sheets** (at least 3 enemy archetypes):
  - melee grunt, ranged caster, elite miniboss
- **VFX sprites:** slash arcs, hit sparks, crit burst, shield block flash

## 3) Collectibles and World Props
- **Treasure sprites:** chest closed/open, coin pile, crystal node
- **Consumables:** potion, food, stamina fruit
- **Interactive props:** campfire, shrine, portal, signboards
- **Building sprites (for build menu):** outpost, farm, mine, tower

## 4) UI/UX Art Pack
- **HUD frame kit:** corner frame, panel background, dividers
- **Buttons:** normal/hover/pressed states
- **Progress bars:** HP/XP/energy bar textures + fill overlays
- **Icon set:** XP, gold, crystal, materials, wallet, AVAX, NFT, token, quest, settings
- **Typography:** one readable pixel font for body + one stylized title font

## 5) Web3-Specific Visuals
- **Wallet connected state icon set** (connected, wrong network, pending tx, success, failed)
- **Transaction status badges** (pending/confirmed/reverted)
- **NFT rarity frames** (common/uncommon/rare/epic/legendary)
- **Token reward popups** (CIT earned, AVAX rewards claimed)

## 6) Audio Assets (Massive Perceived Quality Upgrade)
- **Background music loops:**
  - title theme
  - day exploration
  - night danger
  - boss encounter
- **SFX pack:** movement, sword swings, hit impacts, enemy death, pickups, UI click, tx success/fail cue
- **Ambient loops:** wind, insects, cave drip, magical hum

## 7) Technical Asset Specs (So Integration Is Smooth)
- Sprite sheets: transparent PNG, power-of-two when possible
- Recommended frame sizes: 32x32 or 48x48 (pick one standard)
- Tile size standard: 8x8 or 16x16 (keep consistent project-wide)
- Audio: OGG for web delivery + WAV source masters
- Naming convention: `category_type_state_variant` (e.g., `player_attack_combo_01.png`)

## 8) Minimum Asset Pack for Interview-Ready Polish (Must Have)
1. One polished parallax background set
2. One complete player animation sheet
3. Two enemy sheets + one elite variant
4. Full HUD icon set + progress bar textures
5. Day/night music + 10 core SFX

## 9) Free Sources You Can Use Quickly
- Kenney (UI + game assets)
- itch.io free game asset packs (filter by commercial use)
- OpenGameArt (check license per pack)
- Freesound for SFX (license-check each clip)
- Google Fonts for web-safe UI typography

## 10) Asset Integration Priority Order
1. HUD/UI icons and panels
2. Player + enemy animation consistency
3. Background/parallax mood
4. Combat VFX and audio response
5. Extra decorative props

If you finish items in this order, the game will look dramatically better fastest while remaining stable for your Avalanche demo.
