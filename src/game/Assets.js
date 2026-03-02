// Lightweight image loader with graceful fallback
// Tries public paths first; if not found, falls back to solid-color drawing

export async function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadFirstAvailable(paths) {
  for (const p of paths) {
    const img = await loadImage(p);
    if (img) return img;
  }
  return null;
}

export async function loadGameAssets() {
  // Try multiple public paths for each asset name. Put your images in public/assets/... to be picked up
  const ext = '/assets/external';
  const obj = `${ext}/objects`;
  const candidates = {
    tileset: [
      `${ext}/tiles/FieldsTileset.png`,
      '/assets/tiles/Tiles.png',
      '/Legacy-Fantasy - High Forest 2.3/Assets/Tiles.png'
    ],
    ground: [
      `${ext}/tiles/FieldsTile_01.png`,
      '/assets/tiles/ground.png',
      '/Legacy-Fantasy - High Forest 2.3/Background/Background.png'
    ],
    treeSmall: [
      `${obj}/grass_5.png`,
      '/assets/props/tree_small.png',
      '/Legacy-Fantasy - High Forest 2.3/Trees/Green-Tree.png'
    ],
    treeMedium: [
      `${obj}/grass_6.png`,
      '/assets/props/tree_medium.png',
      '/Legacy-Fantasy - High Forest 2.3/Trees/Dark-Tree.png'
    ],
    rock: [
      `${obj}/stone_1.png`,
      '/assets/props/rock.png',
      '/Legacy-Fantasy - High Forest 2.3/Assets/Props-Rocks.png'
    ],
    bush: [
      `${obj}/grass_2.png`,
      '/assets/props/bush.png',
      '/Legacy-Fantasy - High Forest 2.3/Assets/bush.png'
    ],
    stump: [
      `${obj}/stone_3.png`,
      '/assets/props/stump.png',
      '/Legacy-Fantasy - High Forest 2.3/Assets/stump.png'
    ],
    house: [
      `${obj}/house_1.png`,
      '/assets/buildings/house.png',
      '/Legacy-Fantasy - High Forest 2.3/Assets/Buildings.png'
    ],
    well: [
      `${obj}/decor_1.png`,
      '/assets/props/well.png',
      '/Legacy-Fantasy - High Forest 2.3/Assets/well.png'
    ],
    bridgeH: [
      `${obj}/decor_2.png`,
      '/assets/props/bridge_horizontal.png'
    ],
    bridgeV: [
      `${obj}/decor_3.png`,
      '/assets/props/bridge_vertical.png'
    ],
    fenceH: [
      `${obj}/decor_4.png`,
      '/assets/props/fence_horizontal.png'
    ],
    fenceV: [
      `${obj}/decor_5.png`,
      '/assets/props/fence_vertical.png'
    ],
    tent: [
      `${obj}/tent_1.png`,
      '/assets/props/tent.png'
    ],
    windmill: [
      `${obj}/house_3.png`,
      '/assets/buildings/windmill.png'
    ],
    tower: [
      `${obj}/house_4.png`,
      '/assets/buildings/tower.png'
    ],
    barrel: [
      `${obj}/box_1.png`,
      '/assets/props/barrel.png'
    ],
    chest: [
      `${obj}/box_3.png`,
      '/assets/props/chest.png'
    ],
    door: [
      `${ext}/animated/Door1.png`,
      `${ext}/animated/Door2.png`
    ],
    doubleDoor: [
      `${ext}/animated/DoubleDoor1.png`,
      `${ext}/animated/DoubleDoor2.png`
    ],
    npc: [
      '/assets/characters/npc.png',
      '/Legacy-Fantasy - High Forest 2.3/Character/Idle/Idle-Sheet.png'
    ],
    enemy: [
      '/assets/characters/enemy.png',
      '/Legacy-Fantasy - High Forest 2.3/Mob/Boar/Idle/Idle-Sheet.png'
    ],
    boar: [
      '/assets/mobs/boar.png',
      '/Legacy-Fantasy - High Forest 2.3/Mob/Boar/Idle/Idle-Sheet.png'
    ],
    bee: [
      '/assets/mobs/bee.png',
      '/Legacy-Fantasy - High Forest 2.3/Mob/Small Bee/Fly/Fly-Sheet.png'
    ],
    snail: [
      '/assets/mobs/snail.png',
      '/Legacy-Fantasy - High Forest 2.3/Mob/Snail/walk-Sheet.png'
    ]
  };

  const inferFrameConfig = (img) => {
    if (!img) {
      return { frameWidth: 120, frameHeight: 80, framesPerRow: 10, totalFrames: 1 };
    }

    const candidateSizes = [128, 120, 96, 80, 64, 48, 32, 24, 16, 8];
    const frameWidth = candidateSizes.find((size) => img.width % size === 0) || img.width;
    const frameHeight = candidateSizes.find((size) => img.height % size === 0) || img.height;
    const framesPerRow = Math.max(1, Math.floor(img.width / frameWidth));
    const rows = Math.max(1, Math.floor(img.height / frameHeight));
    return {
      frameWidth,
      frameHeight,
      framesPerRow,
      totalFrames: framesPerRow * rows
    };
  };

  // Main Character Knight: prefer external pack, fallback to existing in-project sheets
  const knightBasePath = '/Main_character/Colour1/NoOutline/120x80_PNGSheets';
  const externalKnightBasePath = '/assets/external/knight';
  const knightPaths = {
    idle: [`${externalKnightBasePath}/idle.png`, `${knightBasePath}/_Idle.png`],
    run: [`${externalKnightBasePath}/run.png`, `${knightBasePath}/_Run.png`],
    attack: [`${externalKnightBasePath}/attack.png`, `${knightBasePath}/_Attack.png`],
    attack2: [`${externalKnightBasePath}/attack2.png`, `${knightBasePath}/_Attack2.png`],
    attackCombo: [`${externalKnightBasePath}/attackCombo.png`, `${knightBasePath}/_AttackCombo.png`],
    defend: [`${externalKnightBasePath}/defend.png`, `${knightBasePath}/_Crouch.png`],
    crouchAttack: [`${externalKnightBasePath}/crouchAttack.png`, `${knightBasePath}/_CrouchAttack.png`],
    hit: [`${externalKnightBasePath}/hit.png`, `${knightBasePath}/_Hit.png`],
    death: [`${externalKnightBasePath}/death.png`, `${knightBasePath}/_Death.png`],
    roll: [`${knightBasePath}/_Roll.png`],
    dash: [`${externalKnightBasePath}/dash.png`, `${knightBasePath}/_Dash.png`],
    jump: [`${externalKnightBasePath}/jump.png`, `${knightBasePath}/_Jump.png`],
    fall: [`${knightBasePath}/_Fall.png`, `${externalKnightBasePath}/jump.png`]
  };

  const uiCandidates = {
    uiFrame: ['/assets/external/ui/frame.png'],
    uiHeart: ['/assets/external/ui/heart.png'],
    uiEnergy: ['/assets/external/ui/energy.png'],
    uiCoin: ['/assets/external/ui/coin.png']
  };

  const sparkleCandidates = [
    '/assets/external/effects/sparkle/01.png',
    '/assets/external/effects/sparkle/02.png',
    '/assets/external/effects/sparkle/03.png',
    '/assets/external/effects/sparkle/04.png'
  ];

  // RPG combat/effect sprites (one per Part folder)
  const rpgEffectPaths = [];
  for (let i = 16; i <= 36; i++) {
    rpgEffectPaths.push(`/assets/external/rpg-effects/Part ${i}.png`);
  }

  // UI Book sprites for inventory/menu overlays
  const uiBookCandidates = {
    bookCover: [`${ext}/ui-book/UI_TravelBook_BookCover01a.png`],
    bookPageLeft: [`${ext}/ui-book/UI_TravelBook_BookPageLeft01a.png`],
    bookPageRight: [`${ext}/ui-book/UI_TravelBook_BookPageRight01a.png`],
    bookBar: [`${ext}/ui-book/UI_TravelBook_Bar01a.png`],
    bookCursor: [`${ext}/ui-book/UI_TravelBook_Cursor01c.png`],
    bookAlert: [`${ext}/ui-book/UI_TravelBook_Alert01a.png`],
    bookFill: [`${ext}/ui-book/UI_TravelBook_Fill01a.png`],
    bookButton: [`${ext}/ui-book/UI_TravelBook_ButtonValue01a.png`]
  };

  // Individual ground tile variants for richer terrain
  const groundTilePaths = [];
  for (let i = 1; i <= 8; i++) {
    groundTilePaths.push(`${ext}/tiles/FieldsTile_${String(i).padStart(2,'0')}.png`);
  }

  console.log('🏰 Loading Knight Assets from:', knightBasePath);

  const [ground, tileset, treeSmall, treeMedium, rock, bush, stump, house, well, bridgeH, bridgeV, fenceH, fenceV, tent, windmill, tower, barrel, chest, door, doubleDoor, npc, enemy, boar, bee, snail, uiFrame, uiHeart, uiEnergy, uiCoin, sparkle01, sparkle02, sparkle03, sparkle04, bookCover, bookPageLeft, bookPageRight, bookBar, bookCursor, bookAlert, bookFill, bookButton] = await Promise.all([
    loadFirstAvailable(candidates.ground),
    loadFirstAvailable(candidates.tileset),
    loadFirstAvailable(candidates.treeSmall),
    loadFirstAvailable(candidates.treeMedium),
    loadFirstAvailable(candidates.rock),
    loadFirstAvailable(candidates.bush),
    loadFirstAvailable(candidates.stump),
    loadFirstAvailable(candidates.house),
    loadFirstAvailable(candidates.well),
    loadFirstAvailable(candidates.bridgeH),
    loadFirstAvailable(candidates.bridgeV),
    loadFirstAvailable(candidates.fenceH),
    loadFirstAvailable(candidates.fenceV),
    loadFirstAvailable(candidates.tent),
    loadFirstAvailable(candidates.windmill),
    loadFirstAvailable(candidates.tower),
    loadFirstAvailable(candidates.barrel),
    loadFirstAvailable(candidates.chest),
    loadFirstAvailable(candidates.door),
    loadFirstAvailable(candidates.doubleDoor),
    loadFirstAvailable(candidates.npc),
    loadFirstAvailable(candidates.enemy),
    loadFirstAvailable(candidates.boar),
    loadFirstAvailable(candidates.bee),
    loadFirstAvailable(candidates.snail),
    loadFirstAvailable(uiCandidates.uiFrame),
    loadFirstAvailable(uiCandidates.uiHeart),
    loadFirstAvailable(uiCandidates.uiEnergy),
    loadFirstAvailable(uiCandidates.uiCoin),
    loadImage(sparkleCandidates[0]),
    loadImage(sparkleCandidates[1]),
    loadImage(sparkleCandidates[2]),
    loadImage(sparkleCandidates[3]),
    loadFirstAvailable(uiBookCandidates.bookCover),
    loadFirstAvailable(uiBookCandidates.bookPageLeft),
    loadFirstAvailable(uiBookCandidates.bookPageRight),
    loadFirstAvailable(uiBookCandidates.bookBar),
    loadFirstAvailable(uiBookCandidates.bookCursor),
    loadFirstAvailable(uiBookCandidates.bookAlert),
    loadFirstAvailable(uiBookCandidates.bookFill),
    loadFirstAvailable(uiBookCandidates.bookButton)
  ]);

  // Load RPG effect frames in parallel
  const rpgEffectFrames = (await Promise.all(rpgEffectPaths.map(p => loadImage(p)))).filter(Boolean);

  // Load ground tile variants in parallel
  const groundTileVariants = (await Promise.all(groundTilePaths.map(p => loadImage(p)))).filter(Boolean);

  const knightEntries = await Promise.all(
    Object.entries(knightPaths).map(async ([state, paths]) => {
      const image = await loadFirstAvailable(paths);
      if (image) {
        console.log(`✅ Knight ${state} loaded:`, image.width, 'x', image.height);
      } else {
        console.warn(`⚠️ Knight ${state} not found in configured asset paths`);
      }
      return [state, image];
    })
  );

  const knight = Object.fromEntries(knightEntries);
  const knightFrameConfig = Object.fromEntries(
    Object.entries(knight).map(([state, image]) => [state, inferFrameConfig(image)])
  );

  const sparkleFrames = [sparkle01, sparkle02, sparkle03, sparkle04].filter(Boolean);

  const loadedCount = [ground, tileset, treeSmall, treeMedium, rock, bush, stump, house, well, barrel, chest, door, npc, enemy, boar, bee, snail, uiFrame, uiHeart, uiEnergy, uiCoin, bookCover].filter(Boolean).length;
  console.log(`🎮 All assets loaded! ${loadedCount} images + ${rpgEffectFrames.length} effects + ${groundTileVariants.length} tile variants + ${sparkleFrames.length} sparkle frames`);
  
  return {
    ground,
    tileset,
    treeSmall,
    treeMedium,
    tree: treeMedium || treeSmall,
    rock,
    bush,
    stump,
    house,
    well,
    bridgeH,
    bridgeV,
    fenceH,
    fenceV,
    tent,
    windmill,
    tower,
    barrel,
    chest,
    door,
    doubleDoor,
    npc,
    enemy,
    boar,
    bee,
    snail,
    knight,
    knightFrameConfig,
    uiFrame,
    uiHeart,
    uiEnergy,
    uiCoin,
    sparkleFrames,
    rpgEffectFrames,
    groundTileVariants,
    bookCover,
    bookPageLeft,
    bookPageRight,
    bookBar,
    bookCursor,
    bookAlert,
    bookFill,
    bookButton
  };
}


