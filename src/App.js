import React, { useRef, useEffect, useState } from 'react';
import { BrowserProvider, formatEther } from 'ethers';
import { contractService } from './services/contractService.js';
import './App.css';
import { createSeasonSystem, Season } from './game/SeasonSystem.js';
import { createEnergySystem } from './game/EnergySystem.js';
import { createKarmaSystem } from './game/KarmaSystem.js';
import { nextHint as guideHint } from './ai/GuideAgent.js';
import { createChallengerAgent } from './ai/ChallengerAgent.js';
import { loadGameAssets } from './game/Assets.js';
import { getPresetMap, getOpenWorld, getMotherWorldMap } from './game/TileMaps.js';
import { AudioManager } from './game/Audio.js';
import { SpriteSheet } from './game/SpriteSheet.js';
import { BlockchainManager, GamePointSystem } from './game/BlockchainIntegration.js';
import { InventorySystem, InfrastructureSystem, GAME_ITEMS } from './game/InventorySystem.js';
import { GameScreenManager } from './game/GameScreens.js';
import { DayNightCycle } from './game/DayNightCycle.js';
import { MusicManager } from './game/MusicManager.js';
import { DialogueManager, TutorialManager, STORY_CHAPTERS, NPC_DIALOGUES } from './game/DialogueSystem.js';

function App() {
  const canvasRef = useRef(null);
  const [playerStats, setPlayerStats] = useState({
    energy: 100,
    streak: 0,
    points: 0,
    avax: 0
  });
  const [isConnected, setIsConnected] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [web3Quest, setWeb3Quest] = useState({
    wallet: false,
    stake: false,
    nft: false,
    rewards: false,
    cit: false,
  });
  // ── Blockchain demo state ──
  const [txHistory, setTxHistory] = useState([]); // [{hash, type, amount, timestamp, status}]
  const [citBalance, setCitBalance] = useState('0');
  const [nftCount, setNftCount] = useState(0);
  const [citStakerInfo, setCitStakerInfo] = useState(null);
  const [avaxStakerInfo, setAvaxStakerInfo] = useState(null); // {stakedAmount, tier, currentAPY, multiplierBps_, pendingRewards, isStaking}
  const [blockchainLoading, setBlockchainLoading] = useState(''); // loading indicator text
  const pendingRewardRef = useRef({ kills: 0, gold: 0, treasures: 0 }); // accumulate game events between claims
  const EXCHANGE_RATE = 50; // 50 in-game gold = 1 CIT token
  const KILL_REWARD_THRESHOLD = 10; // every 10 kills unlocks an NFT mint prompt
  // Real-time points system
  const [realtimeStats, setRealtimeStats] = useState({
    lastUpdate: Date.now(),
    pointsPerSecond: 0.0001,
    stakingMultiplier: 1,
    activityMultiplier: 1,
    totalPointsEarned: 0
  });

  // New: season/energy/karma systems
  const seasonSystemRef = useRef(createSeasonSystem({ cycleSeconds: 120 }));
  const energySystemRef = useRef(createEnergySystem());
  const karmaSystemRef = useRef(createKarmaSystem());
  const [seasonUI, setSeasonUI] = useState({ season: Season.Summer, progress: 0 });
  const [hint, setHint] = useState('');
  const minutesPlayedRef = useRef(0);
  const challengerRef = useRef(createChallengerAgent());
  const prevSeasonRef = useRef(Season.Summer);
  const lastUIUpdateRef = useRef(0);
  const rafRef = useRef(0);
  const [hud, setHud] = useState({ hunger: 0, life: 1, xp: 0, karma: 0 });
  const [hazards, setHazards] = useState([]); // {type:'lightning',x,y,ttl}

  // Force refresh UI to ensure updates are visible
  const forceRefreshUI = () => {
    // Force a re-render by updating a dummy state
    setRealtimeStats(prev => ({ ...prev, lastUpdate: Date.now() }));
  };

  // Update real-time stats immediately when player stats change
  const updateRealtimeStatsImmediately = () => {
    const basePoints = 0.0001;
    const stakingMultiplier = playerStats.avax > 0 ? 2 : 1;
    const activityMultiplier = 1 + (playerStats.streak * 0.1) + (playerStats.energy / 1000);
    
    setRealtimeStats(prev => ({
      ...prev,
      pointsPerSecond: basePoints * stakingMultiplier * activityMultiplier,
      stakingMultiplier,
      activityMultiplier,
      lastUpdate: Date.now()
    }));
    
    // quiet: avoid console spam in production
  };

  // Initialize real-time stats and point system on component mount
  useEffect(() => {
    forceRefreshUI();
    
    // Initialize Fantasy Knight Adventure systems
    if (!pointSystem.current) {
      pointSystem.current = new GamePointSystem(blockchainManager.current);
      pointSystem.current.load(); // Load saved progress
      setGamePoints(pointSystem.current.points);
      setAchievements(pointSystem.current.points.achievements);
      
      // Initialize inventory system
      inventorySystem.current = new InventorySystem();
      inventorySystem.current.load();
      
      // Initialize infrastructure system
      infrastructureSystem.current = new InfrastructureSystem(pointSystem.current);
      infrastructureSystem.current.load();
      
      // Add some starting materials
      if (!pointSystem.current.points.materials) {
        pointSystem.current.points.materials = 5;
        inventorySystem.current.addItem({...GAME_ITEMS.wood, quantity: 10});
        inventorySystem.current.addItem({...GAME_ITEMS.stone, quantity: 5});
        inventorySystem.current.addItem({...GAME_ITEMS.ironSword, quantity: 1});
        inventorySystem.current.save();
      }
      
      console.log('✅ Fantasy Knight Adventure systems initialized');
    }
  }, []);

  // Real-time points calculation
  const calculateRealtimePoints = () => {
    const now = Date.now();
    const timeDiff = (now - realtimeStats.lastUpdate) / 1000; // seconds
    
    if (timeDiff >= 1) { // Update every second
      let pointsToAdd = 0;
      
      // Base points per second (0.0001 AVAX per second)
      const basePoints = 0.0001;
      
      // Staking multiplier (2x if staking)
      const stakingMultiplier = playerStats.avax > 0 ? 2 : 1;
      
      // Activity multiplier (based on energy and streak) - Updated to be more responsive
      const activityMultiplier = 1 + (playerStats.streak * 0.1) + (playerStats.energy / 1000);
      
      // Calculate points to add
      pointsToAdd = basePoints * stakingMultiplier * activityMultiplier * timeDiff;
      
      // Update player stats
      setPlayerStats(prev => {
        const newStats = {
          ...prev,
          points: prev.points + pointsToAdd,
          avax: prev.avax + pointsToAdd
        };
        return newStats;
      });
      
      // Update realtime stats - Force recalculation of multipliers
      setRealtimeStats(prev => {
        const newRealtimeStats = {
          ...prev,
          lastUpdate: now,
          pointsPerSecond: basePoints * stakingMultiplier * activityMultiplier,
          stakingMultiplier,
          activityMultiplier,
          totalPointsEarned: prev.totalPointsEarned + pointsToAdd
        };
        return newRealtimeStats;
      });
      
      // Update leaderboard if connected
      if (isConnected && contractService.isInitialized()) {
        contractService.getCurrentAddress().then(address => {
          updateLeaderboard(address, pointsToAdd);
        }).catch(console.error);
      }
    }
  };

  const [leaderboard, setLeaderboard] = useState([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const walletAddressRef = useRef(''); // ref so game-loop closures always read latest wallet
  const [avaxBalance, setAvaxBalance] = useState('0');
  const [gamePoints, setGamePoints] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [showAchievement, setShowAchievement] = useState(null);
  
  // Blockchain integration
  const blockchainManager = useRef(new BlockchainManager());
  const pointSystem = useRef(null);
  const inventorySystem = useRef(null);
  const infrastructureSystem = useRef(null);
  const screenManager = useRef(new GameScreenManager());
  const dayNightCycle = useRef(new DayNightCycle());
  const musicManager = useRef(new MusicManager());
  
  // Dialogue & Tutorial systems
  const dialogueManager = useRef(new DialogueManager());
  const tutorialManager = useRef(new TutorialManager());
  const [dialogueData, setDialogueData] = useState(null);   // current dialogue snapshot
  const [tutorialStep, setTutorialStep] = useState(null);    // current tutorial step
  const [showPrologue, setShowPrologue] = useState(false);   // true while prologue cutscene plays
  const hasSeenPrologue = useRef(!!localStorage.getItem('dw_prologue_seen'));

  // UI state for inventory and building
  const [showInventory, setShowInventory] = useState(false);
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [selectedBuildingType, setSelectedBuildingType] = useState(null);
  const [buildingMode, setBuildingMode] = useState(false);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [showWeb3Panel, setShowWeb3Panel] = useState(false);
  
  // Game state management
  const [gameState, setGameState] = useState('title'); // title, playing, paused, gameOver, scoreboard, help
  const gameStateRef = useRef('title');
  const setScreenState = (next) => { gameStateRef.current = next; setGameState(next); };
  const [gameStartTime, setGameStartTime] = useState(null);
  const GOLD_SAVE_KEY = 'dw_gold_v1';
  const [gameStats, setGameStats] = useState(() => {
    const savedGold = parseInt(localStorage.getItem('dw_gold_v1') || '0', 10);
    return {
      level: 1,
      enemiesKilled: 0,
      goldCollected: isNaN(savedGold) ? 0 : savedGold,
      buildingsBuilt: 0,
      achievementsUnlocked: 0,
      timePlayed: 0,
      totalScore: 0
    };
  });
  
  // Day/Night cycle state
  const [timeOfDay, setTimeOfDay] = useState('8:00 AM');
  const [isNight, setIsNight] = useState(false);
  const [skyColor, setSkyColor] = useState('#87CEEB');

  // Keep walletAddressRef in sync so the game-loop closure always gets the real address
  React.useEffect(() => { walletAddressRef.current = walletAddress; }, [walletAddress]);

  // Persist unexchanged gold across sessions
  React.useEffect(() => {
    localStorage.setItem('dw_gold_v1', String(gameStats.goldCollected));
  }, [gameStats.goldCollected]);

  // Connect wallet function
  const connectWallet = async () => {
    try {
      const result = await blockchainManager.current.connectWallet();
      setWalletConnected(true);
      setIsConnected(true);
      setWeb3Quest(prev => ({ ...prev, wallet: true }));
      setWalletAddress(result.address);

      let initialized = false;
      try {
        initialized = await contractService.initialize(blockchainManager.current.ethereumProvider || window.ethereum);
      } catch (initError) {
        console.warn('Contract initialization skipped:', initError?.message || initError);
      }

      await updateBalance();
      await refreshBlockchainState();

      const shortAddress = `${result.address.substring(0, 6)}...${result.address.slice(-4)}`;
      if (initialized) {
        setModalContent(`🔗 Wallet Connected!\nAddress: ${shortAddress}\nNetwork: ${result.network}`);
      } else {
        setModalContent(`🔗 Wallet Connected!\nAddress: ${shortAddress}\nNetwork: ${result.network}\n\n⚠️ Smart contracts are disabled until you switch to Avalanche Fuji.`);
      }
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
    } catch (error) {
      setModalContent(`❌ Wallet connection failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
    }
  };

  // Update AVAX balance
  const updateBalance = async () => {
    if (blockchainManager.current.isConnected) {
      const balance = await blockchainManager.current.getBalance();
      setAvaxBalance(balance);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    const provider = blockchainManager.current?.ethereumProvider || window.ethereum;
    if (provider && typeof provider.request === 'function') {
      try {
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch (error) {
        if (error?.code !== -32601) {
          console.warn('wallet_revokePermissions failed:', error);
        }
      }
    }

    blockchainManager.current.disconnect();
    setWalletConnected(false);
    setIsConnected(false);
    setWalletAddress('');
    setAvaxBalance('0');
  };

  // Handle screen manager actions
  const handleScreenAction = (action) => {
    switch (action) {
      case 'startGame':
        // If player hasn't seen the prologue yet, show it first
        if (!hasSeenPrologue.current) {
          hasSeenPrologue.current = true;
          localStorage.setItem('dw_prologue_seen', '1');
          setShowPrologue(true);
          dialogueManager.current.startCutscene(STORY_CHAPTERS[0].scenes, () => {
            setShowPrologue(false);
            setDialogueData(null);
            // Now actually start the game
            _launchGame();
            // Reset tutorial for new player
            tutorialManager.current.reset();
          });
          return;
        }
        _launchGame();
        break;
      case 'restartGame':
        setScreenState('playing');
        setGameStartTime(Date.now());
        resetGame();
        break;
      case 'showTitle':
        setScreenState('title');
        screenManager.current.currentScreen = 'title';
        musicManager.current.playTrack('title');
        break;
      case 'showScoreboard':
        setScreenState('scoreboard');
        screenManager.current.currentScreen = 'scoreboard';
        break;
      case 'showHelp':
        setScreenState('help');
        screenManager.current.currentScreen = 'help';
        break;
      case 'connectWallet':
        connectWallet();
        break;
    }
  };

  // Internal: actually launch gameplay (after prologue or skipped)
  const _launchGame = () => {
    setScreenState('playing');
    setGameStartTime(Date.now());
    resetGame();
    musicManager.current.resume();
    screenManager.current.currentScreen = 'playing';
    musicManager.current.playTrack(isNight ? 'gameplay_night' : 'gameplay_day');
  };

  const toggleMusicPlayback = () => {
    if (musicManager.current.isPlaying) {
      musicManager.current.stopCurrentTrack();
      return;
    }
    const track = gameStateRef.current === 'title'
      ? 'title'
      : gameStateRef.current === 'playing'
        ? (isNight ? 'gameplay_night' : 'gameplay_day')
        : 'title';
    musicManager.current.playTrack(track);
  };

  const getTitleMenuActionFromClick = (x, y, width, height) => {
    const panelW = Math.min(460, width * 0.58);
    const itemH = 36;
    const panelPad = 14;
    const panelH = itemH * 5 + panelPad * 2;
    const panelX = width / 2 - panelW / 2;
    const panelY = height * 0.62;

    if (x < panelX || x > panelX + panelW || y < panelY || y > panelY + panelH) {
      return null;
    }

    const itemIndex = Math.floor((y - panelY - panelPad) / itemH);
    const actions = ['startGame', 'showScoreboard', 'showHelp', 'connectWallet', 'toggleMusic'];
    if (itemIndex < 0 || itemIndex >= actions.length) return null;
    return actions[itemIndex];
  };

  // Reset game for new playthrough
  const resetGame = () => {
    // Reset player to a safe walkable spawn point
    let spawn = motherWorldRef.current?.spawn || { x: 512, y: 600 };
    if (!isPositionWalkable(spawn.x, spawn.y)) {
      spawn = findNearestSafePosition(spawn.x, spawn.y);
    }
    gameWorldState.current.player.x = spawn.x;
    gameWorldState.current.player.y = spawn.y;
    gameWorldState.current.player.health = 100;
    gameWorldState.current.player.state = 'idle';
    
    // Reset camera centered on player
    const canvas = canvasRef.current;
    const zoomScale = gameWorldState.current.zoomScale || 2.0;
    gameWorldState.current.camera.x = Math.max(0, spawn.x - (canvas ? canvas.width : 800) / (2 * zoomScale));
    gameWorldState.current.camera.y = Math.max(0, spawn.y - (canvas ? canvas.height : 600) / (2 * zoomScale));
    
    // Clear saved position so new game starts fresh
    localStorage.removeItem(PLAYER_PROGRESS_KEY);
    
    // Reset session-based stats but keep gold (so unexchanged gold carries over to next session)
    setGameStats(prev => ({
      level: 1,
      enemiesKilled: 0,
      goldCollected: prev.goldCollected, // ← carries over until exchanged for CIT
      buildingsBuilt: 0,
      achievementsUnlocked: 0,
      timePlayed: 0,
      totalScore: 0
    }));
    
    // Reset point system
    if (pointSystem.current) {
      pointSystem.current.points = {
        experience: 0,
        gold: 0,
        crystals: 0,
        materials: 5,
        achievements: [],
        stats: {
          enemiesDefeated: 0,
          treasuresFound: 0,
          areasExplored: 0,
          questsCompleted: 0,
          timePlayedMinutes: 0
        }
      };
      setGamePoints(pointSystem.current.points);
    }
    
    screenManager.current.resetForNewGame();
    
    // Reset day/night cycle to morning
    dayNightCycle.current.reset(8); // Start at 8 AM
    setTimeOfDay(dayNightCycle.current.getTimeString());
    setIsNight(false);
    setSkyColor(dayNightCycle.current.getSkyColor());
    
    // Start gameplay music
    musicManager.current.playTrack('gameplay_day');
  };

  // Trigger game over
  const triggerGameOver = () => {
    const finalStats = {
      ...gameStats,
      timePlayed: gameStartTime ? (Date.now() - gameStartTime) / 1000 : 0,
      experience: pointSystem.current?.points.experience || 0,
      gold: pointSystem.current?.points.gold || 0,
      crystals: pointSystem.current?.points.crystals || 0,
      level: pointSystem.current?.getLevel() || 1
    };
    
    setGameStats(finalStats);
    setGameState('gameOver');
    screenManager.current.gameOver(finalStats, walletAddressRef.current || 'Anonymous');
    
    // Play game over music
    musicManager.current.playTrack('gameOver', false);
  };

  // Handle canvas click for building placement
  const handleCanvasClick = (e) => {
    // Advance dialogue on click
    if (dialogueManager.current.isActive()) {
      const still = dialogueManager.current.advance();
      setDialogueData(still ? dialogueManager.current.getCurrent() : null);
      return;
    }

    const canvas = canvasRef.current;

    // Title screen menu click handling
    if (gameStateRef.current === 'title') {
      if (!canvas || e.target !== canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const canvasY = ((e.clientY - rect.top) / rect.height) * canvas.height;
      const action = getTitleMenuActionFromClick(canvasX, canvasY, canvas.width, canvas.height);

      if (action === 'toggleMusic') {
        toggleMusicPlayback();
      } else {
        handleScreenAction(action || 'startGame');
      }

      e.stopPropagation();
      return;
    }

    if (!buildingMode || !selectedBuildingType || !infrastructureSystem.current) return;

    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    const zoomScale = gameWorldState.current.zoomScale || 1.5;
    const camera = gameWorldState.current.camera;
    const worldX = (clickX / zoomScale) + camera.x;
    const worldY = (clickY / zoomScale) + camera.y;
    
    // Attempt to build
    const result = infrastructureSystem.current.startBuilding(selectedBuildingType, worldX, worldY);
    
    if (result.success) {
      setModalContent(`🏗️ ${infrastructureSystem.current.buildingTypes[selectedBuildingType].name} construction started!`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 2000);
      
      // Update points display and building stats
      setGamePoints({...pointSystem.current.points});
      setGameStats(prev => ({
        ...prev,
        buildingsBuilt: prev.buildingsBuilt + 1
      }));
      pointSystem.current.save();
      infrastructureSystem.current.save();
      
      // Exit building mode
      setBuildingMode(false);
      setSelectedBuildingType(null);
    } else {
      setModalContent(`❌ ${result.reason}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 2000);
    }
  };

  // Game world state
  const gameWorldState = useRef({
    zoomScale: 2.0, // 2x zoom for crisp visuals
    gameTitle: 'Devil\'s World Adventure', // Changed from crypto island
    showWeatherEffects: false,
    player: {
      x: 400, // Start more centered
      y: 300, // Start more centered  
      width: 32,
      height: 32,
      velocityX: 0,
      velocityY: 0,
      onGround: false,
      facingRight: true,
      animFrame: 0,
      animTimer: 0,
      animSpeed: 0.08, // Slower animation for smoother look
      health: 100,
      maxHealth: 100,
      state: 'idle', // idle, run, attack, attack2, attackCombo, defend, crouchAttack, hit, death, roll, dash
      attackCooldown: 0,
      defendCooldown: 0,
      invulnerable: 0,
      attackComboCount: 0,
      lastAttackTime: 0,
      isEating: false,
      eatTimer: 0
    },
    camera: {
      x: 200, // Start camera centered on player
      y: 150
    },
    keys: {},
    level: 1,
    treasures: [],
    enemies: [],
    enemySpawnTimer: 0,
    enemySpawnInterval: 900,
    maxEnemies: 44,
    combatMode: false,
    questsCompleted: 0,
    areasVisited: new Set(),
    particles: [],
    soundEnabled: true
  });
  const PLAYER_PROGRESS_KEY = 'devil_world_player_progress_v1';
  const lastPlayerSaveRef = useRef(0);

  const savePlayerProgress = (force = false) => {
    try {
      const now = Date.now();
      if (!force && now - lastPlayerSaveRef.current < 1000) return;
      lastPlayerSaveRef.current = now;
      const player = gameWorldState.current.player;
      const camera = gameWorldState.current.camera;
      const payload = {
        x: Math.round(player.x),
        y: Math.round(player.y),
        cameraX: Math.round(camera.x),
        cameraY: Math.round(camera.y),
        health: player.health,
        ts: now,
        stats: null,
        points: null
      };
      // Safely capture game stats (use closure-safe approach)
      try {
        const statsEl = document.querySelector('.hud-stats-grid');
        if (statsEl) {
          const text = statsEl.textContent || '';
          const xpMatch = text.match(/XP\s*(\d+)/);
          const goldMatch = text.match(/Gold\s*(\d+)/);
          payload.points = {
            experience: xpMatch ? parseInt(xpMatch[1]) : 0,
            gold: goldMatch ? parseInt(goldMatch[1]) : 0
          };
        }
      } catch(_) {}
      localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(payload));
    } catch (_) {
      // Ignore persistence errors silently
    }
  };

  const loadPlayerProgress = () => {
    try {
      const raw = localStorage.getItem(PLAYER_PROGRESS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  // Audio context
  const audioContext = useRef(null);
  const audioMgr = useRef(new AudioManager());

  // Initialize audio
  const initAudio = () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  };

  // Sound effects
  // GTA 1-style sound effects system
  const playSound = (soundName, frequency = 440, duration = 0.1, type = 'sine') => {
    if (!gameWorldState.current.soundEnabled || !audioContext.current) return;
    
    const oscillator = audioContext.current.createOscillator();
    const gainNode = audioContext.current.createGain();
    const filter = audioContext.current.createBiquadFilter();
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.current.destination);
    
    // GTA 1-style sound effects
    switch(soundName) {
      case 'walk':
        oscillator.frequency.setValueAtTime(200 + Math.random() * 100, audioContext.current.currentTime);
        oscillator.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, audioContext.current.currentTime);
        break;
      case 'collect':
        oscillator.frequency.setValueAtTime(800, audioContext.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.current.currentTime + 0.1);
        oscillator.type = 'square';
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(400, audioContext.current.currentTime);
        break;
      case 'stake':
        oscillator.frequency.setValueAtTime(300, audioContext.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.current.currentTime + 0.2);
        oscillator.type = 'triangle';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, audioContext.current.currentTime);
        break;
      case 'mint':
        oscillator.frequency.setValueAtTime(1000, audioContext.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(2000, audioContext.current.currentTime + 0.3);
        oscillator.type = 'sine';
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, audioContext.current.currentTime);
        break;
      case 'connect':
        oscillator.frequency.setValueAtTime(440, audioContext.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.current.currentTime + 0.5);
        oscillator.type = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, audioContext.current.currentTime);
        break;
      case 'talk':
        oscillator.frequency.setValueAtTime(150 + Math.random() * 200, audioContext.current.currentTime);
        oscillator.type = 'square';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, audioContext.current.currentTime);
        break;
      case 'attack':
        oscillator.frequency.setValueAtTime(200, audioContext.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.current.currentTime + 0.1);
        oscillator.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, audioContext.current.currentTime);
        break;
      case 'defend':
        oscillator.frequency.setValueAtTime(300, audioContext.current.currentTime);
        oscillator.type = 'triangle';
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(400, audioContext.current.currentTime);
        break;
      case 'hit':
        oscillator.frequency.setValueAtTime(150, audioContext.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.current.currentTime + 0.2);
        oscillator.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, audioContext.current.currentTime);
        break;
      case 'enemyHit':
        oscillator.frequency.setValueAtTime(400, audioContext.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.current.currentTime + 0.15);
        oscillator.type = 'square';
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, audioContext.current.currentTime);
        break;
      case 'heal':
        oscillator.frequency.setValueAtTime(500, audioContext.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.current.currentTime + 0.4);
        oscillator.type = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, audioContext.current.currentTime);
        break;
      case 'dash':
        oscillator.frequency.setValueAtTime(250, audioContext.current.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.current.currentTime + 0.2);
        oscillator.type = 'sawtooth';
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(200, audioContext.current.currentTime);
        break;
      default:
        oscillator.frequency.setValueAtTime(frequency, audioContext.current.currentTime);
        oscillator.type = type;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, audioContext.current.currentTime);
    }
    
    gainNode.gain.setValueAtTime(0.1, audioContext.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + duration);
    
    oscillator.start(audioContext.current.currentTime);
    oscillator.stop(audioContext.current.currentTime + duration);
  };

  // 16-bit SNES-Style Color Palette (Chrono Trigger / Zelda inspired)
  const colors = {
    0: 'transparent', // Empty space
    // Ground & Paths
    1: '#8B4513', // Dirt Path (Saddle Brown)
    2: '#D2B48C', // Sand/Beach (Tan)
    3: '#228B22', // Grass (Forest Green)
    4: '#32CD32', // Bright Grass (Lime Green)
    5: '#696969', // Stone/Rock (Dim Gray)
    
    // Water & Liquids
    6: '#4169E1', // Deep Water (Royal Blue)
    7: '#87CEEB', // Shallow Water (Sky Blue)
    8: '#00CED1', // Crystal Water (Dark Turquoise)
    
    // Buildings & Structures
    9: '#2F4F4F', // Dark Building (Dark Slate Gray)
    10: '#708090', // Medium Building (Slate Gray)
    11: '#A9A9A9', // Light Building (Dark Gray)
    12: '#D3D3D3', // Bright Building (Light Gray)
    13: '#8B0000', // Red Brick (Dark Red)
    14: '#B22222', // Bright Brick (Fire Brick)
    
    // Nature Elements
    15: '#654321', // Tree Trunk (Dark Brown)
    16: '#228B22', // Tree Leaves (Forest Green)
    17: '#32CD32', // Bright Leaves (Lime Green)
    18: '#8B4513', // Wood/Logs (Saddle Brown)
    19: '#FFD700', // Gold/Yellow Leaves (Gold)
    
    // Special Elements
    20: '#FFD700', // Treasure (Gold)
    21: '#DC143C', // Danger/Enemy (Crimson)
    22: '#4B0082', // Magic/Purple (Indigo)
    23: '#FF1493', // Pink/Neon (Deep Pink)
    24: '#00FF00', // Success/Green (Lime)
    25: '#FF4500', // Orange/Fire (Orange Red)
    
    // Character Colors
    26: '#F4A460', // Skin Tone (Sandy Brown)
    27: '#8B4513', // Hair Brown (Saddle Brown)
    28: '#000000', // Black (Hair/Clothes)
    29: '#FFFFFF', // White (Clothes/Highlights)
    30: '#FF0000', // Red (Clothes/Accents)
    31: '#0000FF', // Blue (Clothes/Accents)
    32: '#00FF00', // Green (Clothes/Accents)
    
    // UI Elements
    33: '#2F2F2F', // UI Background (Dark Gray)
    34: '#FFD700', // UI Accent (Gold)
    35: '#FFFFFF', // UI Text (White)
    36: '#000000'  // UI Border (Black)
  };

  // Draw pixel art sprite
  const drawSprite = (ctx, sprite, x, y, scale = 1, flipX = false) => {
    const width = sprite[0].length;
    const height = sprite.length;
    
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const pixel = flipX ? sprite[row][width - 1 - col] : sprite[row][col];
        if (pixel !== 0) {
          ctx.fillStyle = colors[pixel] || '#000000';
          ctx.fillRect(
            x + col * scale,
            y + row * scale,
            scale,
            scale
          );
        }
      }
    }
  };

  // Generate 16-bit SNES-style maps for each area
  function generateBeachMap() {
    const tiles = Array(80).fill().map(() => Array(200).fill(0));
    
    // Beach sand floor (SNES-style tan)
    for (let row = 60; row < 80; row++) {
      for (let col = 0; col < 200; col++) {
        tiles[row][col] = 2; // Sand (Tan)
      }
    }
    
    // Ocean water (SNES-style blue gradient)
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 200; col++) {
        tiles[row][col] = 6; // Deep Water (Royal Blue)
      }
    }
    
    // Shallow water near shore
    for (let row = 20; row < 30; row++) {
      for (let col = 0; col < 200; col++) {
        if (Math.random() > 0.3) {
          tiles[row][col] = 7; // Shallow Water (Sky Blue)
        }
      }
    }
    
    // Ancient stone ruins (SNES-style stone)
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(Math.random() * 180) + 10;
      const y = 50 + Math.floor(Math.random() * 20);
      for (let row = y; row < y + 4; row++) {
        for (let col = x; col < x + 8; col++) {
          if (row >= 0 && row < 80 && col >= 0 && col < 200) {
            tiles[row][col] = 5; // Stone (Dim Gray)
          }
        }
      }
    }
    
    // Palm trees (SNES-style with trunk and leaves)
    for (let i = 0; i < 15; i++) {
      const x = Math.floor(Math.random() * 180) + 10;
      const y = 55 + Math.floor(Math.random() * 15);
      // Tree trunk
      for (let row = y; row < y + 3; row++) {
        for (let col = x; col < x + 2; col++) {
          if (row >= 0 && row < 80 && col >= 0 && col < 200) {
            tiles[row][col] = 15; // Tree Trunk (Dark Brown)
          }
        }
      }
      // Tree leaves
      for (let row = y - 2; row < y + 1; row++) {
        for (let col = x - 1; col < x + 3; col++) {
          if (row >= 0 && row < 80 && col >= 0 && col < 200 && tiles[row][col] === 0) {
            tiles[row][col] = 16; // Tree Leaves (Forest Green)
          }
        }
      }
    }
    
    // Beach rocks and shells
    for (let i = 0; i < 25; i++) {
      const x = Math.floor(Math.random() * 190) + 5;
      const y = 60 + Math.floor(Math.random() * 15);
      if (tiles[y][x] === 0) {
        tiles[y][x] = 5; // Small rocks
      }
    }
    
    return tiles;
  }

  function generateForestMap() {
    const tiles = Array(80).fill().map(() => Array(200).fill(0));
    
    // Forest floor (SNES-style grass)
    for (let row = 60; row < 80; row++) {
      for (let col = 0; col < 200; col++) {
        tiles[row][col] = 3; // Grass (Forest Green)
      }
    }
    
    // Dense forest trees (SNES-style with proper layering)
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(Math.random() * 180) + 10;
      const y = Math.floor(Math.random() * 50) + 10;
      
      // Tree trunk (larger for SNES style)
      for (let row = y; row < y + 5; row++) {
        for (let col = x; col < x + 4; col++) {
          if (row >= 0 && row < 80 && col >= 0 && col < 200) {
            tiles[row][col] = 15; // Tree Trunk (Dark Brown)
          }
        }
      }
      
      // Tree canopy (SNES-style layered leaves)
      for (let row = y - 3; row < y + 2; row++) {
        for (let col = x - 2; col < x + 6; col++) {
          if (row >= 0 && row < 80 && col >= 0 && col < 200 && tiles[row][col] === 0) {
            tiles[row][col] = 16; // Tree Leaves (Forest Green)
          }
        }
      }
    }
    
    // Forest paths (SNES-style dirt paths)
    for (let i = 0; i < 4; i++) {
      const startX = Math.floor(Math.random() * 180) + 10;
      for (let col = startX; col < startX + 25; col++) {
        if (col < 200) {
          tiles[65][col] = 1; // Dirt Path (Saddle Brown)
        }
      }
    }
    
    // Fallen logs and stumps
    for (let i = 0; i < 15; i++) {
      const x = Math.floor(Math.random() * 190) + 5;
      const y = 60 + Math.floor(Math.random() * 15);
      if (tiles[y][x] === 0) {
        tiles[y][x] = 18; // Wood/Logs (Saddle Brown)
      }
    }
    
    // Mushrooms and forest details
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * 190) + 5;
      const y = 60 + Math.floor(Math.random() * 15);
      if (tiles[y][x] === 0) {
        tiles[y][x] = 22; // Magic/Purple (Mushrooms)
      }
    }
    
    return tiles;
  }

  function generateMountainMap() {
    const tiles = Array(80).fill().map(() => Array(200).fill(0));
    
    // Mountain base - much larger
    for (let row = 50; row < 80; row++) {
      for (let col = 0; col < 200; col++) {
        tiles[row][col] = 6; // Rock
      }
    }
    
    // Mountain peaks - more varied
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(Math.random() * 150) + 20;
      const y = 20 + Math.floor(Math.random() * 20);
      const height = 10 + Math.floor(Math.random() * 20);
      const width = 8 + Math.floor(Math.random() * 12);
      
      for (let row = y; row < y + height; row++) {
        for (let col = x; col < x + width; col++) {
          if (row >= 0 && row < 80 && col >= 0 && col < 200) {
            tiles[row][col] = 7; // Mountain peak
          }
        }
      }
    }
    
    // Mountain paths
    for (let i = 0; i < 3; i++) {
      const startX = Math.floor(Math.random() * 150) + 20;
      for (let col = startX; col < startX + 30; col++) {
        if (col < 200) {
          tiles[55][col] = 0; // Clear path
        }
      }
    }
    
    return tiles;
  }

  function generateDowntownMap() {
    const tiles = Array(150).fill().map(() => Array(200).fill(0));
    
    // City streets - SNES-style grid pattern
    for (let row = 0; row < 150; row++) {
      for (let col = 0; col < 200; col++) {
        // Main horizontal streets (SNES-style asphalt)
        if (row % 40 === 0 || row % 40 === 1) {
          tiles[row][col] = 1; // Dirt Path (asphalt streets)
        }
        // Main vertical streets
        if (col % 50 === 0 || col % 50 === 1) {
          tiles[row][col] = 1; // Dirt Path (asphalt streets)
        }
        // Sidewalks (SNES-style concrete)
        if ((row % 40 === 2 || row % 40 === 3) && col % 50 !== 0 && col % 50 !== 1) {
          tiles[row][col] = 12; // Bright Building (concrete sidewalks)
        }
        if ((col % 50 === 2 || col % 50 === 3) && row % 40 !== 0 && row % 40 !== 1) {
          tiles[row][col] = 12; // Bright Building (concrete sidewalks)
        }
      }
    }
    
    // Skyscrapers - SNES-style tall buildings
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(Math.random() * 175) + 12;
      const y = Math.floor(Math.random() * 100) + 12;
      const width = 10 + Math.floor(Math.random() * 12);
      const height = 15 + Math.floor(Math.random() * 20);
      
      for (let row = y; row < y + height && row < 150; row++) {
        for (let col = x; col < x + width && col < 200; col++) {
          if (row >= 0 && row < 150 && col >= 0 && col < 200) {
            tiles[row][col] = 9; // Dark Building (skyscraper base)
          }
        }
      }
      
      // Add windows to skyscrapers (SNES-style)
      for (let row = y + 2; row < y + height - 2 && row < 150; row += 3) {
        for (let col = x + 2; col < x + width - 2 && col < 200; col += 3) {
          if (tiles[row][col] === 9) {
            tiles[row][col] = 11; // Light Building (windows)
          }
        }
      }
    }
    
    // Medium buildings (SNES-style office buildings)
    for (let i = 0; i < 15; i++) {
      const x = Math.floor(Math.random() * 185) + 7;
      const y = Math.floor(Math.random() * 120) + 7;
      const width = 6 + Math.floor(Math.random() * 8);
      const height = 8 + Math.floor(Math.random() * 12);
      
      for (let row = y; row < y + height && row < 150; row++) {
        for (let col = x; col < x + width && col < 200; col++) {
          if (row >= 0 && row < 150 && col >= 0 && col < 200) {
            tiles[row][col] = 10; // Medium Building (office buildings)
          }
        }
      }
    }
    
    // Small shops and houses (SNES-style residential)
    for (let i = 0; i < 25; i++) {
      const x = Math.floor(Math.random() * 190) + 5;
      const y = Math.floor(Math.random() * 130) + 5;
      const width = 4 + Math.floor(Math.random() * 6);
      const height = 5 + Math.floor(Math.random() * 8);
      
      for (let row = y; row < y + height && row < 150; row++) {
        for (let col = x; col < x + width && col < 200; col++) {
          if (row >= 0 && row < 150 && col >= 0 && col < 200) {
            tiles[row][col] = 13; // Red Brick (residential buildings)
          }
        }
      }
    }
    
    // City parks (SNES-style green spaces)
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(Math.random() * 175) + 12;
      const y = Math.floor(Math.random() * 120) + 12;
      const width = 8 + Math.floor(Math.random() * 10);
      const height = 6 + Math.floor(Math.random() * 8);
      
      for (let row = y; row < y + height && row < 150; row++) {
        for (let col = x; col < x + width && col < 200; col++) {
          if (row >= 0 && row < 150 && col >= 0 && col < 200) {
            tiles[row][col] = 4; // Bright Grass (city parks)
          }
        }
      }
      
      // Add trees to parks
      for (let j = 0; j < 3; j++) {
        const treeX = x + Math.floor(Math.random() * width);
        const treeY = y + Math.floor(Math.random() * height);
        if (treeX < 200 && treeY < 150) {
          tiles[treeY][treeX] = 15; // Tree Trunk
          if (treeY > 0) tiles[treeY - 1][treeX] = 16; // Tree Leaves
        }
      }
    }
    
    // Neon signs and crypto decorations (SNES-style)
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(Math.random() * 195) + 2;
      const y = Math.floor(Math.random() * 145) + 2;
      if (tiles[y][x] === 0) {
        tiles[y][x] = 23; // Pink/Neon (crypto signs)
      }
    }
    
    // Crypto ATMs and blockchain nodes
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * 195) + 2;
      const y = Math.floor(Math.random() * 145) + 2;
      if (tiles[y][x] === 0) {
        tiles[y][x] = 22; // Magic/Purple (blockchain nodes)
      }
    }
    
    return tiles;
  }

  function generateVillageMap() {
    const tiles = Array(150).fill().map(() => Array(200).fill(0));
    
    // Village ground
    for (let row = 100; row < 150; row++) {
      for (let col = 0; col < 200; col++) {
        tiles[row][col] = 4; // Grass
      }
    }
    
    // Houses (reduced count for performance)
    for (let i = 0; i < 25; i++) {
      const x = Math.floor(Math.random() * 175) + 12;
      const y = 75 + Math.floor(Math.random() * 50);
      for (let row = y; row < y + 6; row++) {
        for (let col = x; col < x + 8; col++) {
          if (row >= 0 && row < 150 && col >= 0 && col < 200) {
            tiles[row][col] = 3; // House
          }
        }
      }
    }
    
    // Village paths
    for (let row = 110; row < 150; row++) {
      for (let col = 0; col < 200; col++) {
        if (col % 15 < 3) {
          tiles[row][col] = 0; // Path
        }
      }
    }
    
    return tiles;
  }

  // Load Mother World from external JSON (public/mother_world_map.json)
  const motherWorldRef = useRef(null);
  const minimapCacheRef = useRef({ canvas: null, frameCount: 0 });

  // Seeded PRNG for deterministic generation
  const makeRng = (seed = 1337) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  };

  // Lightweight value-noise function using hash-based interpolation
  function noise2D(x, y, rng) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const h = (i, j) => {
      const n = Math.sin((xi + i) * 127.1 + (yi + j) * 311.7) * 43758.5453123;
      return n - Math.floor(n);
    };
    const n00 = h(0, 0), n10 = h(1, 0), n01 = h(0, 1), n11 = h(1, 1);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const nx0 = n00 * (1 - u) + n10 * u;
    const nx1 = n01 * (1 - u) + n11 * u;
    return nx0 * (1 - v) + nx1 * v;
  }

  // Generate a natural island-like Mother World when JSON is empty
  function generateNaturalMotherWorld(width = 640, height = 480, seed = 424242) {
    const T = { empty: 0, dirt: 1, sand: 2, grass: 3, rock: 5, deepWater: 6, shallowWater: 7, mountain: 25, river: 26, forest: 27, village: 28 };
    const tiles = Array(height).fill(null).map(() => Array(width).fill(T.deepWater));
    const props = [];
    const rng = makeRng(seed);

    // Island mask using radial falloff + fBm noise
    const cx = width / 2, cy = height / 2;
    const scale = Math.min(width, height) / 180;
    const fbm = (x, y) => {
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let o = 0; o < 4; o++) {
        sum += noise2D(x * freq, y * freq, rng) * amp;
        norm += amp; amp *= 0.5; freq *= 1.9;
      }
      return sum / norm;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / (width * 0.55);
        const dy = (y - cy) / (height * 0.55);
        const r = Math.sqrt(dx * dx + dy * dy);
        const n = fbm(x / 64, y / 64);
        const mask = 0.65 - r + (n - 0.5) * 0.25; // island threshold
        if (mask > 0) tiles[y][x] = T.grass; else tiles[y][x] = T.deepWater;
      }
    }

    // Coast classification: shallow water and beach sand
    const inB = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    const hasLandNeighbor = (x, y) => {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        if (!i && !j) continue; const nx = x + i, ny = y + j;
        if (inB(nx, ny) && tiles[ny][nx] === T.grass) return true;
      }
      return false;
    };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (tiles[y][x] === T.deepWater && hasLandNeighbor(x, y)) tiles[y][x] = T.shallowWater;
    }
    const nearWater = (x, y) => {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const nx = x + i, ny = y + j; if (!inB(nx, ny)) continue;
        const t = tiles[ny][nx]; if (t === T.deepWater || t === T.shallowWater) return true;
      } return false;
    };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (tiles[y][x] === T.grass && nearWater(x, y)) tiles[y][x] = T.sand;
    }

    // Forest clusters
    const forestSeeds = 18;
    for (let k = 0; k < forestSeeds; k++) {
      const fx = Math.floor(rng() * width), fy = Math.floor(rng() * height);
      const radius = 6 + Math.floor(rng() * 16);
      for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) {
        const nx = fx + x, ny = fy + y; if (!inB(nx, ny)) continue;
        if (tiles[ny][nx] === T.grass && (x * x + y * y) <= radius * radius && rng() > 0.25) tiles[ny][nx] = T.forest;
      }
    }

    // Mountains
    const mountainSeeds = 10;
    for (let k = 0; k < mountainSeeds; k++) {
      const mx = Math.floor(rng() * width), my = Math.floor(rng() * height);
      const radius = 8 + Math.floor(rng() * 18);
      for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) {
        const nx = mx + x, ny = my + y; if (!inB(nx, ny)) continue;
        const d2 = x * x + y * y; if (tiles[ny][nx] === T.grass && d2 <= radius * radius) {
          tiles[ny][nx] = d2 < (radius * radius * 0.35) ? T.mountain : (rng() > 0.7 ? T.rock : tiles[ny][nx]);
        }
      }
    }

    // A winding river from north to south
    let rx = Math.floor(width * (0.3 + rng() * 0.4));
    for (let y = 0; y < height; y++) {
      const meander = Math.floor(Math.sin(y / 35) * 6 + Math.sin(y / 11) * 3);
      rx = Math.max(4, Math.min(width - 5, rx + meander + (rng() < 0.5 ? -1 : 1)));
      for (let w = -1; w <= 1; w++) {
        const nx = rx + w; if (!inB(nx, y)) continue;
        if (tiles[y][nx] !== T.deepWater && tiles[y][nx] !== T.shallowWater) tiles[y][nx] = T.river;
      }
      // sand banks
      for (let w = -2; w <= 2; w += 2) {
        const nx = rx + w; if (inB(nx, y) && tiles[y][nx] === T.grass) tiles[y][nx] = T.sand;
      }
    }

    // Villages: 5 clusters deep inland (not near water)
    const villages = [];
    const farFromWater = (x, y) => {
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        const nx = x + i, ny = y + j; if (!inB(nx, ny)) return false;
        const t = tiles[ny][nx]; if (t === T.deepWater || t === T.shallowWater || t === T.river || t === T.sand) return false;
      } return true;
    };
    let tries = 0; while (villages.length < 5 && tries++ < 4000) {
      const x = Math.floor(rng() * width), y = Math.floor(rng() * height);
      if (tiles[y][x] !== T.grass && tiles[y][x] !== T.forest) continue;
      if (!farFromWater(x, y)) continue;
      villages.push({ x, y });
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        const nx = x + i, ny = y + j; if (!inB(nx, ny)) continue;
        if (Math.abs(i) <= 2 && Math.abs(j) <= 2) tiles[ny][nx] = T.village; else if (tiles[ny][nx] === T.forest) tiles[ny][nx] = T.grass;
      }
    }

    // Dirt paths linking villages with river mouth
    const link = (ax, ay, bx, by) => {
      let x = ax, y = ay; const steps = Math.max(1, Math.abs(ax - bx) + Math.abs(ay - by));
      for (let s = 0; s < steps; s++) {
        const dx = Math.sign(bx - x), dy = Math.sign(by - y);
        const prevX = x, prevY = y;
        if (rng() < 0.6) x += dx; else y += dy;
        if (inB(x, y) && tiles[y][x] !== T.deepWater && tiles[y][x] !== T.shallowWater) {
          // Path tile (thickened)
          tiles[y][x] = T.dirt;
          if (inB(x + 1, y) && tiles[y][x + 1] === T.grass && rng() < 0.5) tiles[y][x + 1] = T.dirt;
          if (inB(x, y + 1) && tiles[y + 1][x] === T.grass && rng() < 0.3) tiles[y + 1][x] = T.dirt;
          // Bridge where path crosses river
          const crossesRiver = near(x, y, t => t === T.river) || tiles[y][x] === T.river;
          if (crossesRiver) {
            const px = x * 8, py = y * 8;
            const horiz = dx !== 0 && dy === 0;
            props.push({ type: horiz ? 'bridgeH' : 'bridgeV', x: px, y: py, block: false });
          }
        }
      }
    };
    for (let i = 1; i < villages.length; i++) link(villages[i - 1].x, villages[i - 1].y, villages[i].x, villages[i].y);
    if (villages.length) link(villages[0].x, villages[0].y, rx, Math.floor(height * 0.6));

    // Entities
    const npcs = villages.map((v, i) => ({ x: v.x * 8, y: v.y * 8, type: 'villager', village: `Village ${i + 1}` }));
    const treasures = Array.from({ length: 20 }, (_, i) => ({ x: Math.floor(rng() * width) * 8, y: Math.floor(rng() * height) * 8, type: 'gold', value: 1 + Math.floor(rng() * 50), collected: false }));
    const enemies = Array.from({ length: 30 }, () => ({ x: Math.floor(rng() * width) * 8, y: Math.floor(rng() * height) * 8, width: 16, height: 16, type: rng() < 0.55 ? 'bee' : 'snail', difficulty: rng() < 0.2 ? 'hard' : rng() < 0.6 ? 'medium' : 'easy', facingRight: rng() < 0.5, health: 100, maxHealth: 100 }));

    // Spawn near middle village or center
    const spawnVillage = villages[0] || { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const spawn = { x: spawnVillage.x * 8, y: (spawnVillage.y + 2) * 8 };

    return { name: 'Mother World', width, height, tiles, npcs, enemies, treasures, spawn };
  }

  // Build world from a high-level spec (climates, features, settlements)
  function buildWorldFromSpec(spec) {
    // Tileset IDs
    const T = { empty: 0, dirt: 1, sand: 2, grass: 3, rock: 5, deepWater: 6, shallowWater: 7, mountain: 25, river: 26, forest: 27, village: 28 };
    const width = spec.width || 768;
    const height = spec.height || 576;
    const seed = spec.seed || 1337;
    const rng = makeRng(seed);
    const tiles = Array(height).fill(null).map(() => Array(width).fill(T.deepWater));
    const props = [];

    // Island mask
    const cx = width / 2, cy = height / 2;
    const radiusX = (spec.island?.radiusX || 0.48) * width;
    const radiusY = (spec.island?.radiusY || 0.48) * height;
    const islandThreshold = spec.island?.threshold || 1.05;
    const fbm = (x, y) => {
      let a = 1, f = 1, s = 0, n = 0;
      for (let o = 0; o < 4; o++) { s += noise2D(x * f, y * f, rng) * a; n += a; a *= 0.5; f *= 1.9; }
      return s / n;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / radiusX;
        const dy = (y - cy) / radiusY;
        const r = Math.sqrt(dx * dx + dy * dy);
        const n = fbm(x / 64, y / 64);
        if (r + (0.22 - n * 0.30) < islandThreshold) tiles[y][x] = T.grass;
      }
    }

    // Shallows and beaches
    const inB = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    const near = (x, y, pred) => {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        if (!i && !j) continue; const nx = x + i, ny = y + j; if (inB(nx, ny) && pred(tiles[ny][nx])) return true;
      }
      return false;
    };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (tiles[y][x] === T.deepWater && near(x, y, t => t === T.grass)) tiles[y][x] = T.shallowWater;
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (tiles[y][x] === T.grass && near(x, y, t => t === T.shallowWater || t === T.deepWater)) tiles[y][x] = T.sand;
    }

    // Optional mode for land-focused RPG maps (reduces large blue/ocean regions)
    if (spec.removeOcean) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (tiles[y][x] === T.deepWater) tiles[y][x] = T.grass;
          else if (tiles[y][x] === T.shallowWater) tiles[y][x] = T.sand;
        }
      }
    }

    // Climate bands
    const climates = spec.climates || [
      { name: 'tropical', y0: 0.55, y1: 0.95, forest: 0.6 },
      { name: 'temperate', y0: 0.25, y1: 0.55, forest: 0.45 },
      { name: 'alpine', y0: 0.0, y1: 0.25, forest: 0.25 }
    ];
    climates.forEach(c => {
      const y0 = Math.floor(height * c.y0), y1 = Math.floor(height * c.y1);
      for (let y = y0; y < y1; y++) for (let x = 0; x < width; x++) {
        if (tiles[y][x] === T.grass && rng() < c.forest * 0.4) tiles[y][x] = T.forest;
      }
    });

    // Mountains
    const m = spec.mountains || { count: 10, minR: 12, maxR: 28 };
    for (let k = 0; k < m.count; k++) {
      const mx = Math.floor(rng() * width), my = Math.floor(rng() * height);
      const r = Math.floor(m.minR + rng() * (m.maxR - m.minR));
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const nx = mx + i, ny = my + j; if (!inB(nx, ny)) continue;
        const d2 = i * i + j * j; if (tiles[ny][nx] === T.grass && d2 <= r * r) {
          tiles[ny][nx] = d2 < (r * r * 0.35) ? T.mountain : (rng() > 0.7 ? T.rock : tiles[ny][nx]);
        }
      }
    }

    // Rivers
    (spec.rivers || [{ fromX: 0.3, toX: 0.7 }]).forEach(riv => {
      let rx = Math.floor(width * (riv.fromX + rng() * 0.1));
      for (let y = 0; y < height; y++) {
        const meander = Math.floor(Math.sin(y / 40) * 5 + Math.sin(y / 13) * 3);
        rx = Math.max(3, Math.min(width - 4, rx + meander + (rng() < 0.5 ? -1 : 1)));
        for (let w = -1; w <= 1; w++) {
          const nx = rx + w; if (!inB(nx, y)) continue;
          const t = tiles[y][nx]; if (t !== T.deepWater && t !== T.shallowWater) tiles[y][nx] = T.river;
        }
        if (inB(rx - 2, y) && tiles[y][rx - 2] === T.grass) tiles[y][rx - 2] = T.sand;
        if (inB(rx + 2, y) && tiles[y][rx + 2] === T.grass) tiles[y][rx + 2] = T.sand;
      }
    });

    // Villages / settlements
    const villages = [];
    const vSpec = spec.villages || { count: 5, minDistWater: 3 };
    const farFromWater = (x, y) => {
      for (let j = -vSpec.minDistWater; j <= vSpec.minDistWater; j++) for (let i = -vSpec.minDistWater; i <= vSpec.minDistWater; i++) {
        const nx = x + i, ny = y + j; if (!inB(nx, ny)) return false;
        const t = tiles[ny][nx]; if (t === T.deepWater || t === T.shallowWater || t === T.river || t === T.sand) return false;
      } return true;
    };
    const settlementSeeds = Array.isArray(spec.settlements) && spec.settlements.length
      ? spec.settlements.map(s => ({ x: Math.floor(width * s.x), y: Math.floor(height * s.y), name: s.name }))
      : [];

    settlementSeeds.forEach(s => {
      if (!inB(s.x, s.y) || !farFromWater(s.x, s.y)) return;
      villages.push({ x: s.x, y: s.y, name: s.name });
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
        const nx = s.x + i, ny = s.y + j;
        if (!inB(nx, ny)) continue;
        if (Math.abs(i) <= 2 && Math.abs(j) <= 2) tiles[ny][nx] = T.village;
        else if (tiles[ny][nx] === T.forest || tiles[ny][nx] === T.rock) tiles[ny][nx] = T.grass;
      }
    });

    let tries = 0;
    while (villages.length < vSpec.count && tries++ < 5000) {
      const x = Math.floor(rng() * width), y = Math.floor(rng() * height);
      if (!(tiles[y][x] === T.grass || tiles[y][x] === T.forest)) continue;
      if (!farFromWater(x, y)) continue;
      if (villages.some(v => Math.hypot(v.x - x, v.y - y) < 18)) continue;
      villages.push({ x, y });
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        const nx = x + i, ny = y + j; if (!inB(nx, ny)) continue;
        if (Math.abs(i) <= 2 && Math.abs(j) <= 2) tiles[ny][nx] = T.village; else if (tiles[ny][nx] === T.forest) tiles[ny][nx] = T.grass;
      }
    }

    // Paths linking villages
    const link = (ax, ay, bx, by) => {
      let x = ax, y = ay; const steps = Math.max(1, Math.abs(ax - bx) + Math.abs(ay - by));
      for (let s = 0; s < steps; s++) {
        const dx = Math.sign(bx - x), dy = Math.sign(by - y);
        if (rng() < 0.6) x += dx; else y += dy;
        if (inB(x, y) && tiles[y][x] !== T.deepWater && tiles[y][x] !== T.shallowWater && tiles[y][x] !== T.river) tiles[y][x] = T.dirt;
      }
    };
    for (let i = 1; i < villages.length; i++) link(villages[i - 1].x, villages[i - 1].y, villages[i].x, villages[i].y);

    // Entities from spec or defaults
    const defaultNpcDialogues = [
      'The old road hides more than it reveals.',
      'Treasure glows brighter near forgotten ruins.',
      'Night creatures avoid torch-lit paths.'
    ];
    const npcs = villages.map((v, i) => ({
      x: v.x * 8,
      y: v.y * 8,
      type: 'villager',
      village: v.name || spec.villageNames?.[i] || `Village ${i + 1}`,
      name: v.name || spec.villageNames?.[i] || `Villager ${i + 1}`,
      politicalAffiliation: 'Neutral',
      dialogueTree: defaultNpcDialogues
    }));
    // Place buildings around each village center
    villages.forEach((v, i) => {
      const name = spec.villageNames?.[i] || `Village ${i + 1}`;
      const baseX = v.x * 8, baseY = v.y * 8;
      const layout = [
        { dx: -16, dy: -12 }, { dx: 16, dy: -12 }, { dx: -16, dy: 12 }, { dx: 16, dy: 12 },
        { dx: 0, dy: -20 }, { dx: 0, dy: 20 }
      ];
      layout.forEach(p => props.push({ type: 'house', x: baseX + p.dx, y: baseY + p.dy, block: true }));
      props.push({ type: 'well', x: baseX - 4, y: baseY - 4, block: false });
      if (rng() < 0.5) props.push({ type: 'barrel', x: baseX + 10, y: baseY + 6, block: false });
      // Clear a plaza
      for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
        const tx = v.x + ox, ty = v.y + oy; if (!inB(tx, ty)) continue; if (tiles[ty][tx] !== T.deepWater) tiles[ty][tx] = (Math.abs(ox) + Math.abs(oy)) <= 2 ? T.dirt : tiles[ty][tx];
      }
    });
    const isWalkableTile = (tile) => tile !== T.deepWater && tile !== T.shallowWater && tile !== T.river && tile !== T.mountain;
    const isWalkableAtPixel = (px, py) => {
      const tx = Math.floor(px / 8);
      const ty = Math.floor(py / 8);
      if (!inB(tx, ty)) return false;
      return isWalkableTile(tiles[ty][tx]);
    };
    const hasMinDistance = (px, py, points, minDistance) => points.every(p => Math.hypot(p.x - px, p.y - py) >= minDistance);

    const spawnVillage = villages[0] || { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const desiredSpawn = spec.spawn || { x: spawnVillage.x * 8, y: (spawnVillage.y + 3) * 8 };

    const findNearestWalkablePixel = (px, py, maxRadius = 60) => {
      const tx = Math.floor(px / 8);
      const ty = Math.floor(py / 8);
      if (inB(tx, ty) && isWalkableTile(tiles[ty][tx])) return { x: tx * 8, y: ty * 8 };
      for (let r = 1; r <= maxRadius; r++) {
        for (let oy = -r; oy <= r; oy++) {
          for (let ox = -r; ox <= r; ox++) {
            if (Math.abs(ox) !== r && Math.abs(oy) !== r) continue;
            const nx = tx + ox;
            const ny = ty + oy;
            if (!inB(nx, ny)) continue;
            if (isWalkableTile(tiles[ny][nx])) return { x: nx * 8, y: ny * 8 };
          }
        }
      }
      return { x: spawnVillage.x * 8, y: spawnVillage.y * 8 };
    };
    const spawn = findNearestWalkablePixel(desiredSpawn.x, desiredSpawn.y);

    const treasures = (spec.treasures || []).map(t => ({ ...t, collected: !!t.collected }));
    const treasureMinDistance = spec.treasureMinDistance || 96;
    const treasureTarget = spec.autoTreasures || 24;
    let treasureTries = 0;
    while (treasures.length < treasureTarget && treasureTries++ < 20000) {
      const px = Math.floor(rng() * width) * 8;
      const py = Math.floor(rng() * height) * 8;
      if (!isWalkableAtPixel(px, py)) continue;
      if (Math.hypot(px - spawn.x, py - spawn.y) < 180) continue;
      if (!hasMinDistance(px, py, treasures, treasureMinDistance)) continue;
      treasures.push({ x: px, y: py, type: rng() < 0.15 ? 'diamond' : 'gold', value: 10 + Math.floor(rng() * 60), collected: false });
    }

    const enemies = (spec.enemies || []).map(e => ({ ...e, health: e.health || 100, maxHealth: e.maxHealth || 100 }));
    const enemyMinDistance = spec.enemyMinDistance || 88;
    const enemyTarget = spec.autoEnemies || 30;
    let enemyTries = 0;
    while (enemies.length < enemyTarget && enemyTries++ < 25000) {
      const px = Math.floor(rng() * width) * 8;
      const py = Math.floor(rng() * height) * 8;
      if (!isWalkableAtPixel(px, py)) continue;
      if (Math.hypot(px - spawn.x, py - spawn.y) < 220) continue;
      if (!hasMinDistance(px, py, enemies, enemyMinDistance)) continue;
      const yNorm = py / (height * 8);
      const type = yNorm < 0.35 ? (rng() < 0.65 ? 'snail' : 'bee') : (yNorm < 0.7 ? (rng() < 0.55 ? 'bee' : 'snail') : (rng() < 0.5 ? 'bee' : 'snail'));
      enemies.push({
        x: px,
        y: py,
        width: 16,
        height: 16,
        type,
        difficulty: yNorm < 0.35 ? 'easy' : (yNorm < 0.7 ? 'medium' : 'hard'),
        facingRight: rng() < 0.5,
        health: 100,
        maxHealth: 100
      });
    }

    // Spawn
    return { name: spec.name || 'Mother World', width, height, tiles, npcs, enemies, treasures, spawn, props };
  }
  const gameMap = {
    get width() { return motherWorldRef.current?.width || 1024; },
    get height() { return motherWorldRef.current?.height || 768; },
    currentArea: 'motherworld',
    areas: { get motherworld() { return motherWorldRef.current || { tiles: [[0]], npcs: [], treasures: [], enemies: [], spawn: { x: 512, y: 600 } }; } }
  };
  // player spawn will be applied once during initGame

  // Initialize treasures — generate gold across walkable terrain
  const initTreasures = () => {
    const world = motherWorldRef.current;
    let list = [...(world?.treasures || [])];

    // Generate treasure items if the map has none
    if (list.length < 20 && world?.tiles?.length) {
      const tileH = world.tiles.length;
      const tileW = world.tiles[0]?.length || 0;
      const spawn = world.spawn || { x: Math.floor(tileW * 4), y: Math.floor(tileH * 4) };
      let tries = 0;
      while (list.length < 45 && tries++ < 8000) {
        const px = Math.floor(Math.random() * Math.max(1, tileW)) * 8;
        const py = Math.floor(Math.random() * Math.max(1, tileH)) * 8;
        if (!isPositionWalkable(px, py)) continue;
        if (Math.hypot(px - spawn.x, py - spawn.y) < 120) continue;
        let tooClose = false;
        for (let i = 0; i < list.length; i++) {
          if (Math.hypot(px - list[i].x, py - list[i].y) < 80) { tooClose = true; break; }
        }
        if (tooClose) continue;
        const val = Math.random() < 0.15 ? 10 : Math.random() < 0.3 ? 5 : 2;
        const tType = val >= 10 ? 'rare_chest' : val >= 5 ? 'chest' : 'gold';
        list.push({ x: px, y: py, type: tType, name: tType === 'rare_chest' ? 'Rare Chest' : tType === 'chest' ? 'Treasure Chest' : 'Gold', value: val, collected: false });
      }
    }

    // Store on motherWorldRef so currentArea.treasures picks them up
    if (world) world.treasures = list;
    gameWorldState.current.treasures = list;
    console.log(`🏆 Generated ${list.length} treasures for the world`);
  };

  // Initialize enemies from Mother World
  const normalizeEnemy = (enemy) => {
    const difficulty = enemy?.difficulty || 'easy';
    const baseSpeed = difficulty === 'hard' ? 1.4 : difficulty === 'medium' ? 1.15 : 0.95;
    const direction = enemy?.direction === -1 || enemy?.direction === 1
      ? enemy.direction
      : (Math.random() < 0.5 ? -1 : 1);
    const type = enemy?.type === 'boar' ? 'bee' : (enemy?.type || 'bee');

    // Render sizes tuned for proportion to knight (64×64 draw with ~50% fill)
    // Bee: small flying insect, Snail: ground crawler
    const profile = type === 'bee'
      ? { width: 10, height: 8,  renderWidth: 24, renderHeight: 24, yOffset: 10 }
      : { width: 12, height: 10, renderWidth: 18, renderHeight: 18, yOffset: 6 };

    return {
      x: enemy?.x ?? 0,
      y: enemy?.y ?? 0,
      width: profile.width,
      height: profile.height,
      renderWidth: profile.renderWidth,
      renderHeight: profile.renderHeight,
      yOffset: profile.yOffset,
      type,
      difficulty,
      speed: typeof enemy?.speed === 'number' ? enemy.speed : baseSpeed,
      direction,
      facingRight: typeof enemy?.facingRight === 'boolean' ? enemy.facingRight : direction > 0,
      state: enemy?.state || 'patrol',
      health: typeof enemy?.health === 'number' ? enemy.health : 100,
      maxHealth: typeof enemy?.maxHealth === 'number' ? enemy.maxHealth : 100,
      attackCooldown: typeof enemy?.attackCooldown === 'number' ? enemy.attackCooldown : 0,
    };
  };

  const initEnemies = () => {
    // Base enemies from Mother World
    const world = motherWorldRef.current;
    let list = [...(world?.enemies || [])].map(normalizeEnemy);

    // Ensure a healthy baseline even if source map has few/no enemy definitions
    if (list.length < 18 && world?.tiles?.length) {
      const tileH = world.tiles.length;
      const tileW = world.tiles[0]?.length || 0;
      const spawn = world.spawn || { x: Math.floor(tileW * 4), y: Math.floor(tileH * 4) };
      let tries = 0;
      while (list.length < 18 && tries++ < 7000) {
        const px = Math.floor(Math.random() * Math.max(1, tileW)) * 8;
        const py = Math.floor(Math.random() * Math.max(1, tileH)) * 8;
        if (!isPositionWalkable(px, py)) continue;
        if (Math.hypot(px - spawn.x, py - spawn.y) < 200) continue;
        let closeToOther = false;
        for (let i = 0; i < list.length; i++) {
          if (Math.hypot(px - list[i].x, py - list[i].y) < 72) {
            closeToOther = true;
            break;
          }
        }
        if (closeToOther) continue;
        const yNorm = tileH > 0 ? py / (tileH * 8) : 0.5;
        const type = yNorm < 0.35
          ? (Math.random() < 0.7 ? 'snail' : 'bee')
          : (yNorm < 0.7 ? (Math.random() < 0.55 ? 'bee' : 'snail') : (Math.random() < 0.5 ? 'bee' : 'snail'));
        const difficulty = yNorm < 0.35 ? 'easy' : (yNorm < 0.7 ? 'medium' : 'hard');
        list.push(normalizeEnemy({ x: px, y: py, width: 16, height: 16, type, difficulty }));
      }
    }

    // Night boost: if starting at night, add extra spawns
    if (dayNightCycle.current && dayNightCycle.current.isNight) {
      const extra = Math.floor(list.length * 0.3);
      for (let i = 0; i < extra; i++) {
        const e = list[(i * 7) % Math.max(1,list.length)];
        list.push(normalizeEnemy({ ...e, x: e.x + (Math.random() * 80 - 40), y: e.y + (Math.random() * 80 - 40) }));
      }
    }
    gameWorldState.current.enemies = list;
    gameWorldState.current.enemySpawnTimer = 0;
    console.log(`👹 Loaded ${list.length} enemies (night boost applied if night)`);
  };

  // Game functions are defined below

  // Game utility functions

  // Collision detection
  const checkCollision = (rect1, rect2) => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  };

  // Utility
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  // Viewport sizing: centered rectangle window (16:10 aspect)
  const computeViewportSize = () => {
    const horizontalPadding = 24;
    const verticalPadding = 24;
    const availableW = window.innerWidth - horizontalPadding;
    const availableH = window.innerHeight - verticalPadding;
    const w = clamp(Math.floor(availableW), 960, 1920);
    const h = clamp(Math.floor(availableH), 600, 1080);
    return { width: w - (w % 8), height: h - (h % 8) };
  };

  // Tile collision detection — blocks impassable terrain
  const checkTileCollision = (x, y, width, height) => {
    const tileSize = 8;
    const left = Math.floor(x / tileSize);
    const right = Math.floor((x + width) / tileSize);
    const top = Math.floor(y / tileSize);
    const bottom = Math.floor((y + height) / tileSize);

    const mw = motherWorldRef.current;
    if (!mw || !mw.tiles) return false; // No world loaded yet — don't block
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (row < 0 || row >= gameMap.height || col < 0 || col >= gameMap.width) continue;
        const tileType = mw.tiles[row]?.[col] ?? 3; // default to walkable grass
        // Only block truly impassable tiles
        if (tileType === 6 ||  // Deep Water
            tileType === 25) { // Mountain core
          return true;
        }
      }
    }
    return false;
  };

  // Check if a pixel position is walkable (for spawn validation)
  const isPositionWalkable = (px, py) => {
    const mw = motherWorldRef.current;
    if (!mw || !mw.tiles) return true;
    const tx = Math.floor(px / 8);
    const ty = Math.floor(py / 8);
    if (ty < 0 || ty >= mw.tiles.length || tx < 0 || tx >= (mw.tiles[0]?.length || 0)) return false;
    const t = mw.tiles[ty][tx];
    return t !== 6 && t !== 25; // not deep water, not mountain
  };

  // Find nearest walkable position (for unsticking)
  const findNearestSafePosition = (px, py) => {
    if (isPositionWalkable(px, py)) return { x: px, y: py };
    const mw = motherWorldRef.current;
    if (!mw || !mw.tiles) return { x: px, y: py };
    for (let r = 1; r <= 80; r++) {
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          if (Math.abs(ox) !== r && Math.abs(oy) !== r) continue;
          const nx = px + ox * 8, ny = py + oy * 8;
          if (isPositionWalkable(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    // Ultimate fallback — spawn point
    const spawn = mw.spawn || { x: 512, y: 600 };
    return spawn;
  };

  // Enhanced area transitions for larger world
  const checkAreaTransition = (nextX, nextY) => {
    const player = gameWorldState.current.player;
    const area = gameMap.areas[gameMap.currentArea];
    const tileSize = 8;
    const worldW = (area && area.tiles && area.tiles[0]) ? area.tiles[0].length * tileSize : (motherWorldRef.current?.width || 0);
    const worldH = (area && area.tiles) ? area.tiles.length * tileSize : (motherWorldRef.current?.height || 0);
    const atLeft = nextX <= 0;
    const atRight = nextX + player.width >= worldW;
    const atTop = nextY <= 0;
    const atBottom = nextY + player.height >= worldH;

    let target = null;
    if (atLeft && area.neighbors && area.neighbors.west) target = area.neighbors.west;
    if (atRight && area.neighbors && area.neighbors.east) target = area.neighbors.east;
    if (atTop && area.neighbors && area.neighbors.north) target = area.neighbors.north;
    if (atBottom && area.neighbors && area.neighbors.south) target = area.neighbors.south;
    if (!target) return;

    gameMap.currentArea = target;
    const nextArea = gameMap.areas[target];
    // place near opposite edge spawn
    const margin = 12;
    if (atLeft && nextArea && nextArea.tiles && nextArea.tiles[0]) {
      player.x = nextArea.tiles[0].length * tileSize - player.width - margin;
      player.y = clamp(player.y, margin, nextArea.tiles.length * tileSize - player.height - margin);
    } else if (atRight && nextArea && nextArea.tiles) {
      player.x = margin;
      player.y = clamp(player.y, margin, nextArea.tiles.length * tileSize - player.height - margin);
    } else if (atTop && nextArea && nextArea.tiles && nextArea.tiles[0]) {
      player.y = nextArea.tiles.length * tileSize - player.height - margin;
      player.x = clamp(player.x, margin, nextArea.tiles[0].length * tileSize - player.width - margin);
    } else if (atBottom && nextArea && nextArea.tiles && nextArea.tiles[0]) {
      player.y = margin;
      player.x = clamp(player.x, margin, nextArea.tiles[0].length * tileSize - player.width - margin);
    }

    // Respawn enemies for new area
    initEnemies();

    playSound('transition', 600, 0.25);
    setModalContent(`Entering ${nextArea.name}...`);
      setShowModal(true);
    setTimeout(() => setShowModal(false), 1600);
  };

  // Enhanced 8-directional RPG movement system
  const updatePlayer = () => {
    const player = gameWorldState.current.player;
    const keys = gameWorldState.current.keys;

    // 8-directional movement with diagonal support
    const isPressed = (names) => names.some((n) => !!keys[n]);
    let moveX = 0;
    let moveY = 0;
    const moveSpeed = 3;

    // Check for game over condition
    if (player.health <= 0 && gameStateRef.current === 'playing') {
      triggerGameOver();
      return;
    }
    
    // Only move if not in combat animation or eating
    if ((player.state === 'idle' || player.state === 'run') && !player.isEating) {
    // Horizontal movement
      if (isPressed(['ArrowLeft','a','A','KeyA'])) {
      moveX = -moveSpeed;
      player.facingRight = false;
    }
      if (isPressed(['ArrowRight','d','D','KeyD'])) {
      moveX = moveSpeed;
      player.facingRight = true;
    }

    // Vertical movement (RPG-style, no gravity)
      if (isPressed(['ArrowUp','w','W','KeyW'])) {
      moveY = -moveSpeed;
    }
      if (isPressed(['ArrowDown','s','S','KeyS'])) {
      moveY = moveSpeed;
      }
    }

    // Diagonal movement (normalize for consistent speed)
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.707; // 1/sqrt(2) for diagonal normalization
      moveY *= 0.707;
    }

    // Apply movement
    player.velocityX = moveX;
    player.velocityY = moveY;

    // Update position
    const newX = player.x + player.velocityX;
    const newY = player.y + player.velocityY;

    // Check area transitions
    checkAreaTransition(newX, newY);

    // Enhanced collision detection for 8-directional movement
    let canMoveX = true;
    let canMoveY = true;

    // Check horizontal collision
    if (checkTileCollision(newX, player.y, player.width, player.height)) {
      canMoveX = false;
    }

    // Check vertical collision
    if (checkTileCollision(player.x, newY, player.width, player.height)) {
      canMoveY = false;
    }

    // Apply movement if no collision
    if (canMoveX) {
      player.x = newX;
    }
    if (canMoveY) {
      player.y = newY;
    }

    // Unstick safety: if player is currently inside a blocked tile, teleport to nearest safe position
    if (checkTileCollision(player.x, player.y, player.width, player.height)) {
      const safe = findNearestSafePosition(player.x, player.y);
      player.x = safe.x;
      player.y = safe.y;
    }

    // Keep player in bounds
    player.x = Math.max(0, Math.min(player.x, gameMap.width * 8 - player.width));
    player.y = Math.max(0, Math.min(player.y, gameMap.height * 8 - player.height));

    // Enhanced camera following with smooth interpolation
    const canvas = canvasRef.current;
    const zoomScale = gameWorldState.current.zoomScale || 2.0;
    const targetCameraX = player.x - (canvas ? canvas.width : 800) / (2 * zoomScale);
    const targetCameraY = player.y - (canvas ? canvas.height : 600) / (2 * zoomScale);
    
    gameWorldState.current.camera.x += (targetCameraX - gameWorldState.current.camera.x) * 0.1;
    gameWorldState.current.camera.y += (targetCameraY - gameWorldState.current.camera.y) * 0.1;

    // Clamp camera so we never see beyond world bounds
    const maxX = gameMap.width * 8 - (canvas ? canvas.width : 800) / zoomScale;
    const maxY = gameMap.height * 8 - (canvas ? canvas.height : 600) / zoomScale;
    gameWorldState.current.camera.x = Math.max(0, Math.min(maxX, gameWorldState.current.camera.x));
    gameWorldState.current.camera.y = Math.max(0, Math.min(maxY, gameWorldState.current.camera.y));

    // Persist progress continuously so position is retained after closing UI/window
    savePlayerProgress(false);

    // Update player timers
    if (player.attackCooldown > 0) player.attackCooldown--;
    if (player.defendCooldown > 0) player.defendCooldown--;
    if (player.invulnerable > 0) player.invulnerable--;
    if (player.eatTimer > 0) {
      player.eatTimer--;
      if (player.eatTimer <= 0) {
        player.isEating = false;
        player.health = Math.min(player.maxHealth, player.health + 20);
        energySystemRef.current.feed(0.3);
        setModalContent('You ate food. Health and hunger restored.');
        
        // Play heal sound effect
        musicManager.current.playSFX('heal', 400, 0.4);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 1500);
      }
    }
    
    // Reset combo if too much time passed
    if (Date.now() - player.lastAttackTime > 1500) {
      player.attackComboCount = 0;
    }
    
    // State transitions
    if (player.state === 'attack' && player.attackCooldown <= 0) player.state = 'idle';
    if (player.state === 'attack2' && player.attackCooldown <= 0) player.state = 'idle';
    if (player.state === 'attackCombo' && player.attackCooldown <= 0) player.state = 'idle';
    if (player.state === 'defend' && player.defendCooldown <= 0 && !player.isEating) player.state = 'idle';
    if (player.state === 'roll' && player.invulnerable <= 0) player.state = 'idle';
    if (player.state === 'hit' && player.invulnerable <= 0) player.state = 'idle';
    
    // Movement state (only if not in special states)
    const canMove = !['attack', 'attack2', 'attackCombo', 'defend', 'roll', 'hit', 'death'].includes(player.state) && !player.isEating;
    if (canMove) {
    if (Math.abs(player.velocityX) > 0.1 || Math.abs(player.velocityY) > 0.1) {
        if (player.state === 'idle') player.state = 'run';
      player.animTimer += 0.2;
      if (player.animTimer >= 1) {
          player.animFrame = (player.animFrame + 1) % 8; // 8-frame run animation
        player.animTimer = 0;
      }
        try { if (Math.random() < 0.2) audioMgr.current.playFootstep(); } catch (_) {}
    } else {
        if (player.state === 'run') player.state = 'idle';
        player.animTimer += 0.15;
        if (player.animTimer >= 1) {
          player.animFrame = (player.animFrame + 1) % 10; // 10-frame idle animation
          player.animTimer = 0;
        }
      }
    }
  };

  // Update enemies with AI
  const updateEnemies = () => {
    const player = gameWorldState.current.player;
    const enemies = gameWorldState.current.enemies;

    // Dynamic enemy spawning for a lively world
    if (gameStateRef.current === 'playing' && motherWorldRef.current?.tiles?.length) {
      const world = motherWorldRef.current;
      const worldWidthPx = (world.tiles[0]?.length || 0) * 8;
      const worldHeightPx = world.tiles.length * 8;
      const targetCount = (dayNightCycle.current?.isNight ? 42 : 30);
      const maxEnemies = gameWorldState.current.maxEnemies || 44;
      gameWorldState.current.enemySpawnTimer = (gameWorldState.current.enemySpawnTimer || 0) + 1;

      if (enemies.length < Math.min(maxEnemies, targetCount) &&
          gameWorldState.current.enemySpawnTimer >= (gameWorldState.current.enemySpawnInterval || 900)) {
        let spawned = false;
        for (let attempt = 0; attempt < 120 && !spawned; attempt++) {
          const px = Math.floor(Math.random() * Math.max(1, worldWidthPx / 8)) * 8;
          const py = Math.floor(Math.random() * Math.max(1, worldHeightPx / 8)) * 8;
          const distToPlayer = Math.hypot(px - player.x, py - player.y);
          if (distToPlayer < 220 || distToPlayer > 820) continue;
          if (!isPositionWalkable(px, py)) continue;

          let tooClose = false;
          for (let i = 0; i < enemies.length; i++) {
            if (Math.hypot(px - enemies[i].x, py - enemies[i].y) < 76) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;

          const yNorm = worldHeightPx > 0 ? (py / worldHeightPx) : 0.5;
          const type = yNorm < 0.35
            ? (Math.random() < 0.7 ? 'snail' : 'bee')
            : (yNorm < 0.7 ? (Math.random() < 0.55 ? 'bee' : 'snail') : (Math.random() < 0.5 ? 'bee' : 'snail'));
          const difficulty = yNorm < 0.35 ? 'easy' : (yNorm < 0.7 ? 'medium' : 'hard');

          enemies.push(normalizeEnemy({ x: px, y: py, width: 16, height: 16, type, difficulty, health: 100, maxHealth: 100 }));
          spawned = true;
        }
        gameWorldState.current.enemySpawnTimer = 0;
      }
    }
    
    // Check if any enemies are in combat range for music
    const enemiesInCombat = enemies.some(enemy => {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < 150 && (enemy.state === 'chase' || enemy.state === 'attack');
    });
    
    // Switch to combat music if enemies are chasing/attacking
    if (enemiesInCombat && musicManager.current.currentTrack?.name !== 'combat') {
      musicManager.current.playTrack('combat');
    } else if (!enemiesInCombat && musicManager.current.currentTrack?.name === 'combat') {
      // Switch back to appropriate background music
      const backgroundTrack = isNight ? 'gameplay_night' : 'gameplay_day';
      musicManager.current.playTrack(backgroundTrack);
    }
    
    gameWorldState.current.enemies.forEach(enemy => {
      if (enemy.health <= 0) return;
      
      // Calculate distance to player
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // AI behavior based on difficulty and distance
      if (distance < 320) { // Detection range
        gameWorldState.current.combatMode = true;
        
        // Move towards player
        const moveSpeed = enemy.speed * (enemy.difficulty === 'hard' ? 1.5 : enemy.difficulty === 'medium' ? 1.2 : 1);
        if (distance > 36) { // Chase
          const moveX = (dx / distance) * moveSpeed;
          const moveY = (dy / distance) * moveSpeed;
          
          const newX = enemy.x + moveX;
          const newY = enemy.y + moveY;
          
          if (!checkTileCollision(newX, enemy.y, enemy.width, enemy.height)) enemy.x = newX;
          if (!checkTileCollision(enemy.x, newY, enemy.width, enemy.height)) enemy.y = newY;
          
          enemy.facingRight = dx > 0;
          enemy.state = 'chase';
        } else { // Attack range
          if (enemy.attackCooldown <= 0) {
            enemy.state = 'attack';
            enemy.attackCooldown = enemy.difficulty === 'hard' ? 30 : enemy.difficulty === 'medium' ? 45 : 60;
            
            // Damage player if not defending
            if (player.invulnerable <= 0) {
              const damage = enemy.difficulty === 'hard' ? 20 : enemy.difficulty === 'medium' ? 15 : 10;
              if (player.state !== 'defend') {
                player.health = Math.max(0, player.health - damage);
                player.state = 'hit';
                player.invulnerable = 30;
                playSound('hit', 300, 0.3);
                if (player.health <= 0) player.state = 'death';
              } else {
                playSound('defend', 500, 0.2);
              }
            }
          }
        }
      } else {
        // Patrol behavior
        enemy.x += enemy.direction * enemy.speed * 0.5;
        
        if (checkTileCollision(enemy.x, enemy.y, enemy.width, enemy.height) || Math.random() < 0.01) {
        enemy.direction *= -1;
        }
        enemy.state = 'patrol';
      }
      
      // Update enemy timers
      if (enemy.attackCooldown > 0) enemy.attackCooldown--;
      
      // Check if player attacks enemy
      if (player.state === 'attack' && player.attackCooldown > 20 && distance < 50) {
        const damage = 25;
        enemy.health = Math.max(0, enemy.health - damage);
        enemy.state = 'hit';
        musicManager.current.playSFX('hit', 350, 0.2);
      }
    });
    
    // Remove dead enemies and track kills
    const beforeCount = gameWorldState.current.enemies.length;
    gameWorldState.current.enemies = gameWorldState.current.enemies.filter(e => e.health > 0);
    const killed = beforeCount - gameWorldState.current.enemies.length;
    if (killed > 0) {
      pendingRewardRef.current.kills += killed;
      setGameStats(prev => {
        const newKills = prev.enemiesKilled + killed;
        checkGameMilestones(newKills, prev.goldCollected, 0);
        return { ...prev, enemiesKilled: newKills };
      });
    }
  };

  // Update treasures
  const updateTreasures = () => {
    const player = gameWorldState.current.player;
    const currentArea = gameMap.areas[gameMap.currentArea];
    
    (currentArea.treasures || []).forEach(treasure => {
      if (!treasure.collected && checkCollision(player, { x: treasure.x, y: treasure.y, width: 20, height: 20 })) {
        treasure.collected = true;
        playSound('collect', 600, 0.2);
        
        // Track gold for blockchain exchange
        pendingRewardRef.current.gold += treasure.value;
        pendingRewardRef.current.treasures += 1;
        setGameStats(prev => {
          const newGold = prev.goldCollected + treasure.value;
          checkGameMilestones(prev.enemiesKilled, newGold, 0);
          return { ...prev, goldCollected: newGold };
        });
        
        // Update player stats - only AVAX
        setPlayerStats(prev => ({
          ...prev,
          points: prev.points + treasure.value, // Add AVAX points
          avax: prev.avax + treasure.value // Add to AVAX balance
        }));

        // Chance to drop apple (food)
        if (Math.random() < 0.5) {
          energySystemRef.current.feed(0.4);
        }
        
        // Immediately update real-time stats to reflect changes
        setTimeout(() => {
          updateRealtimeStatsImmediately();
        }, 100); // Small delay to ensure state is updated
        
        // Show collection message
        setModalContent(`Found ${treasure.name}! +${treasure.value} AVAX Points`);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 3000);
      }
    });
  };

  // Atmospheric drawing functions
  const drawStars = (ctx, canvas) => {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
      const x = (i * 123.456) % canvas.width;
      const y = (i * 234.567) % canvas.height;
      const brightness = 0.3 + 0.7 * Math.sin(Date.now() * 0.001 + i);
      ctx.globalAlpha = brightness;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  };

  const drawMoon = (ctx, canvas) => {
    const moonX = canvas.width * 0.8;
    const moonY = canvas.height * 0.2;
    const moonRadius = 30;
    
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Moon glow
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  const drawSun = (ctx, canvas) => {
    const sunX = canvas.width * 0.8;
    const sunY = canvas.height * 0.2;
    const sunRadius = 40;
    
    // Sun rays
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rayLength = 60;
      ctx.beginPath();
      ctx.moveTo(
        sunX + Math.cos(angle) * (sunRadius + 10),
        sunY + Math.sin(angle) * (sunRadius + 10)
      );
      ctx.lineTo(
        sunX + Math.cos(angle) * (sunRadius + rayLength),
        sunY + Math.sin(angle) * (sunRadius + rayLength)
      );
      ctx.stroke();
    }
    
    // Sun body
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Sun glow
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  // Enhanced render function with rich environments
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const ctx = canvas.getContext('2d');
      
      // Handle different game screens
      if (gameStateRef.current === 'title') {
        screenManager.current.drawTitleScreen(ctx, canvas);
        return;
      } else if (gameStateRef.current === 'gameOver') {
        screenManager.current.drawGameOverScreen(ctx, canvas, gameStats);
        return;
      } else if (gameStateRef.current === 'scoreboard') {
        const scores = screenManager.current.loadScores();
        screenManager.current.drawScoreboard(ctx, canvas, scores);
        return;
      } else if (gameStateRef.current === 'help') {
        screenManager.current.drawHelpScreen(ctx, canvas);
        return;
      }
      
      // Only render game if in playing or paused state
      if (gameStateRef.current !== 'playing' && gameStateRef.current !== 'paused') return;
      
      const camera = gameWorldState.current.camera;
      
      // Debug: Check if gameMap is properly initialized
      if (!gameMap || !gameMap.areas) {
        console.error('Game map not initialized:', gameMap);
        ctx.fillStyle = '#ff0000';
        ctx.font = '20px monospace';
        ctx.fillText('Map Loading Error - Check Console', 50, 50);
        return;
      }
      
      const currentArea = gameMap.areas[gameMap.currentArea];
      
      if (!currentArea) {
        console.error('Current area not found:', gameMap.currentArea, 'Available areas:', Object.keys(gameMap.areas));
        ctx.fillStyle = '#ff0000';
        ctx.font = '20px monospace';
        ctx.fillText(`Area "${gameMap.currentArea}" not found`, 50, 50);
        return;
      }
    
      // Dynamic sky color based on time of day
      let baseSkyColor = '#101a24'; // Dark ambient backdrop to avoid bright blue void
    
    // Override with day/night cycle color if more dramatic
    ctx.fillStyle = skyColor !== '#87CEEB' ? skyColor : baseSkyColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle cinematic daylight tint (keeps scene grounded, less flat)
    if (!isNight) {
      const daylight = ctx.createLinearGradient(0, 0, 0, canvas.height);
      daylight.addColorStop(0, 'rgba(255, 244, 214, 0.10)');
      daylight.addColorStop(1, 'rgba(94, 151, 110, 0.08)');
      ctx.fillStyle = daylight;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Subtle global darkening at night (no sun/moon icons)
    if (isNight) {
      const darkness = Math.max(0.35, 0.8 - dayNightCycle.current.getLightLevel() * 0.8);
      ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Save context and apply zoom
    ctx.save();
    const zoomScale = gameWorldState.current.zoomScale || 1.5;
    ctx.scale(zoomScale, zoomScale);
    // Snap to integer pixels to avoid seam/grid artifacts
    ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));
    // Disable smoothing for crisp pixels
    if (typeof ctx.imageSmoothingEnabled === 'boolean') ctx.imageSmoothingEnabled = false;
    
    // Draw SNES-style tiles with proper layering and effects for Mother World
    const tileSize = 8; // 8px base tiles, zoomed 2x for 16px on screen
    // Visible tile range in world space (camera is already in world coordinates)
    const visibleWorldW = canvas.width / zoomScale;
    const visibleWorldH = canvas.height / zoomScale;
    const startRow = Math.max(0, Math.floor(camera.y / tileSize) - 2);
    const endRow = Math.min(gameMap.height, Math.ceil((camera.y + visibleWorldH) / tileSize) + 2);
    const startCol = Math.max(0, Math.floor(camera.x / tileSize) - 2);
    const endCol = Math.min(gameMap.width, Math.ceil((camera.x + visibleWorldW) / tileSize) + 2);
    
    const assets = gameWorldState.current.assets || {};
    const tilesetImg = assets.tileset;
    // Heuristic tileset grid size detection (prefers 32px, then 16px)
    const tilesetTileSize = (() => {
      if (!tilesetImg) return 32;
      if (tilesetImg.width % 32 === 0 && tilesetImg.height % 32 === 0) return 32;
      if (tilesetImg.width % 16 === 0 && tilesetImg.height % 16 === 0) return 16;
      if (tilesetImg.width % 24 === 0 && tilesetImg.height % 24 === 0) return 24;
      return 32;
    })();

    // Colorful mapping for 256x256 tileset (8x8 grid of 32px tiles, cols 0-7, rows 0-7)
    // At 8px game tile size, the tileset gets too compressed. Use individual tile variants instead.
    const groundTileVariants = assets.groundTileVariants || [];

    // Map tile types to individual ground tile variant indices for terrain diversity
    // Only use FieldsTile images for dirt/sand/village (where earthy textures make sense)
    // Water, grass, forest, mountain use hand-painted colors for correct appearance
    const tileTypeToVariantIdx = {
      1: 3, 2: 2, 28: 5
    };

    const drawTilesetCell = (img, col, row, dx, dy, size) => {
      const ts = tilesetTileSize;
      const sx = col * ts;
      const sy = row * ts;
      if (sx + ts <= img.width && sy + ts <= img.height) {
        ctx.drawImage(img, sx, sy, ts, ts, dx, dy, size, size);
      }
    };

    const drawTerrainTile = (tileType, x, y, size) => {
      const col = Math.floor(x / size);
      const row = Math.floor(y / size);
      const hash = ((row * 73856093) ^ (col * 19349663)) >>> 0;
      const parity = (col + row) & 1;

      // Try to use tile image variant for earthy terrain (dirt, sand, village)
      const varIdx = tileTypeToVariantIdx[tileType];
      const varImg = (varIdx !== undefined) ? groundTileVariants[varIdx] : null;
      if (varImg) {
        ctx.drawImage(varImg, 0, 0, varImg.width, varImg.height, x, y, size, size);
        // Subtle tint for village tiles
        if (tileType === 28) { ctx.fillStyle = 'rgba(140,100,50,0.15)'; ctx.fillRect(x, y, size, size); }
        return;
      }

      // Fallback: hand-painted tile colors with variety
      if (tileType === 6) {
        // Deep water - rich dark blue
        ctx.fillStyle = parity ? '#14324f' : '#193a58';
        ctx.fillRect(x, y, size, size);
        if (hash % 5 === 0) { ctx.fillStyle = 'rgba(60,140,200,0.10)'; ctx.fillRect(x, y + (hash % 4), size, 1); }
        return;
      }
      if (tileType === 7 || tileType === 26) {
        // Shallow water / River - bright blue with wave highlights
        ctx.fillStyle = tileType === 26 ? '#2e7ab5' : (parity ? '#3388bb' : '#3d96cc');
        ctx.fillRect(x, y, size, size);
        if (hash % 3 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y + (hash % 3) + 1, size, 1); }
        return;
      }
      if (tileType === 2) {
        // Sand - warm golden yellow
        ctx.fillStyle = parity ? '#e0be6a' : '#eace80';
        ctx.fillRect(x, y, size, size);
        if (hash % 4 === 0) { ctx.fillStyle = 'rgba(140,100,40,0.10)'; ctx.fillRect(x + (hash % 3), y + (hash % 4), 2, 1); }
        return;
      }
      if (tileType === 1) {
        // Dirt - earthy brown
        ctx.fillStyle = parity ? '#8b6530' : '#9a7040';
        ctx.fillRect(x, y, size, size);
        if (hash % 4 === 0) { ctx.fillStyle = 'rgba(50,30,15,0.12)'; ctx.fillRect(x, y + (hash % 3), size, 1); }
        return;
      }
      if (tileType === 3) {
        // Grass - vibrant green with checkerboard variation
        const shade = hash % 8;
        ctx.fillStyle = shade < 2 ? '#45a64e' : shade < 4 ? '#4db056' : shade < 6 ? '#3e9c48' : '#52b85c';
        ctx.fillRect(x, y, size, size);
        // Add grass texture dots
        if (hash % 5 === 0) { ctx.fillStyle = 'rgba(30,80,25,0.18)'; ctx.fillRect(x + 2, y + 2, 2, 1); }
        if (hash % 7 === 0) { ctx.fillStyle = 'rgba(100,200,80,0.15)'; ctx.fillRect(x + (hash % 4), y + (hash % 5), 1, 1); }
        return;
      }
      if (tileType === 27) {
        // Forest - deep rich green with canopy texture
        ctx.fillStyle = parity ? '#1f6828' : '#257832';
        ctx.fillRect(x, y, size, size);
        // Canopy shadow spots
        ctx.fillStyle = 'rgba(5,30,8,0.28)';
        ctx.fillRect(x + (hash % 4), y + (hash % 3), 3, 3);
        if (hash % 3 === 0) { ctx.fillStyle = 'rgba(80,160,50,0.12)'; ctx.fillRect(x + 1, y + 1, 2, 1); }
        return;
      }
      if (tileType === 25 || tileType === 5) {
        // Mountain / Rock - grey-purple with highlights
        ctx.fillStyle = tileType === 25 ? (parity ? '#6b6570' : '#7a7480') : (parity ? '#5a5a5e' : '#646468');
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x, y, size, 1);
        if (hash % 4 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + (hash % 4), y + 2, 2, 1); }
        return;
      }
      if (tileType === 28) {
        // Village - warm brown cobblestone
        ctx.fillStyle = parity ? '#a87030' : '#b88040';
        ctx.fillRect(x, y, size, size);
        if (hash % 3 === 0) { ctx.fillStyle = 'rgba(220,190,140,0.18)'; ctx.fillRect(x + 1, y + 1, 3, 1); }
        return;
      }
      // Void/empty tiles - very dark
      ctx.fillStyle = '#080c14';
      ctx.fillRect(x, y, size, size);
    };

    const tileColor = (t) => {
      switch (t) {
        case 6: return '#14324f';
        case 7: return '#3388bb';
        case 2: return '#e0be6a';
        case 1: return '#8b6530';
        case 3: return '#45a64e';
        case 27: return '#1f6828';
        case 5: return '#5a5a5e';
        case 25: return '#6b6570';
        case 26: return '#2e7ab5';
        case 28: return '#a87030';
        default: return '#080c14';
      }
    };
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const x = col * tileSize;
        const y = row * tileSize;
        const mw = motherWorldRef.current;
        const tileType = mw?.tiles?.[row]?.[col] ?? 0;
        
        // Draw solid color base first (always works)
        drawTerrainTile(tileType, x, y, tileSize);

        // Decorative detail noise key
        const noiseKey = ((row * 73856093) ^ (col * 19349663)) >>> 0;
        
        // Draw small decorative sprites on terrain tiles (reduced frequency for perf)
        if (tileType === 27 && (noiseKey % 6 === 0)) {
          // Forest tiles: draw tree decoration
          const treeImg = (noiseKey % 8 < 4) ? assets.treeSmall : assets.treeMedium;
          if (treeImg) {
            ctx.drawImage(treeImg, x - 4, y - 10, 16, 18);
          } else {
            ctx.fillStyle = 'rgba(12, 48, 18, 0.4)';
            ctx.beginPath();
            ctx.arc(x + 4, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (tileType === 25 && (noiseKey % 5 === 0)) {
          // Mountain tiles: draw stone
          const rockImg = assets.rock;
          if (rockImg) {
            ctx.drawImage(rockImg, x - 2, y - 2, 12, 10);
          } else {
            ctx.fillStyle = 'rgba(40, 40, 40, 0.35)';
            ctx.fillRect(x + 1, y + 1, 5, 4);
          }
        } else if (tileType === 3 && (noiseKey % 10 === 0)) {
          // Grass tiles: draw bush/flower
          const bushImg = assets.bush;
          if (bushImg) {
            ctx.drawImage(bushImg, x - 1, y - 2, 10, 8);
          } else {
            ctx.fillStyle = 'rgba(80, 160, 70, 0.35)';
            ctx.fillRect(x + 2, y + 2, 4, 3);
          }
        } else if (tileType === 28 && (noiseKey % 8 === 0)) {
          // Village: draw small decoration
          const stoneImg = assets.stump;
          if (stoneImg) {
            ctx.globalAlpha = 0.55;
            ctx.drawImage(stoneImg, x, y, 8, 7);
            ctx.globalAlpha = 1.0;
          }
        } else if (tileType === 2 && (noiseKey % 14 === 0)) {
          // Sand: draw shell/pebble
          ctx.fillStyle = 'rgba(180,160,120,0.3)';
          ctx.fillRect(x + 2, y + 3, 3, 2);
        }
      }
    }

    // Draw props using external asset images with vector fallback
    if (currentArea.props && currentArea.props.length) {
      currentArea.props.forEach(p => {
        const propImg = assets[p.type];
        if (propImg && propImg.width > 0) {
          // Scale prop images appropriately for the game world
          // Small props (stone, grass, box) get 2-3x, big props (house, tent) get scaled to fit
          const targetSizes = {
            house: { w: 72, h: 68 }, well: { w: 32, h: 30 }, barrel: { w: 20, h: 22 },
            bridgeH: { w: 48, h: 16 }, bridgeV: { w: 16, h: 48 }, chest: { w: 22, h: 22 },
            tent: { w: 56, h: 50 }, windmill: { w: 80, h: 78 }, tower: { w: 80, h: 82 },
            fenceH: { w: 36, h: 14 }, fenceV: { w: 14, h: 36 }, rock: { w: 24, h: 20 },
            bush: { w: 22, h: 16 }, stump: { w: 20, h: 18 }, treeSmall: { w: 18, h: 22 },
            treeMedium: { w: 24, h: 30 }, door: { w: 20, h: 28 }, doubleDoor: { w: 32, h: 28 }
          };
          const target = targetSizes[p.type] || { w: 20, h: 20 };
          ctx.drawImage(propImg, p.x - target.w / 2, p.y - target.h, target.w, target.h);
        } else if (p.type === 'house') {
          ctx.fillStyle = '#8f5b3a';
          ctx.fillRect(p.x - 16, p.y - 22, 32, 24);
          ctx.fillStyle = '#5c3a26';
          ctx.fillRect(p.x - 18, p.y - 28, 36, 8);
        } else if (p.type === 'well') {
          ctx.fillStyle = '#6d737a';
          ctx.fillRect(p.x - 6, p.y - 6, 12, 12);
        } else if (p.type === 'barrel') {
          ctx.fillStyle = '#6e4a2c';
          ctx.fillRect(p.x - 5, p.y - 6, 10, 12);
        } else if (p.type === 'bridgeH') {
          ctx.fillStyle = '#8b5e3b';
          ctx.fillRect(p.x - 12, p.y - 3, 24, 6);
        } else if (p.type === 'bridgeV') {
          ctx.fillStyle = '#8b5e3b';
          ctx.fillRect(p.x - 3, p.y - 12, 6, 24);
        } else if (p.type === 'rock') {
          ctx.fillStyle = '#888';
          ctx.fillRect(p.x - 8, p.y - 6, 16, 12);
        } else if (p.type === 'bush') {
          ctx.fillStyle = '#2d7a32';
          ctx.fillRect(p.x - 7, p.y - 5, 14, 10);
        } else if (p.type === 'chest') {
          ctx.fillStyle = '#b8860b';
          ctx.fillRect(p.x - 8, p.y - 7, 16, 14);
        } else if (p.type === 'tent') {
          ctx.fillStyle = '#c69c6d';
          ctx.fillRect(p.x - 16, p.y - 18, 32, 22);
        } else {
          ctx.fillStyle = '#666';
          ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
        }
      });
    }
    
    // Draw NPCs using closest matching asset images
    currentArea.npcs?.forEach(npc => {
      // NPCs at villages: use house image for the village structure background
      const houseImg = assets['house'];
      if (houseImg && houseImg.width > 0) {
        ctx.drawImage(houseImg, npc.x - 36, npc.y - 56, 72, 68);
      }

      // Draw NPC character on top
      const npcImg = assets['villager'] || assets['npc'];
      if (npcImg && npcImg.width && npcImg.height) {
        const ratio = npcImg.width / npcImg.height;
        let cols = 1, rows = 1;
        if (ratio >= 1.5) { cols = Math.min(8, Math.max(2, Math.round(ratio))); rows = 1; }
        else if ((1/ratio) >= 1.5) { rows = Math.min(8, Math.max(2, Math.round(1/ratio))); cols = 1; }
        const frameW = Math.floor(npcImg.width / cols);
        const frameH = Math.floor(npcImg.height / rows);
        const destW = 30; const destH = 38;
        ctx.drawImage(npcImg, 0, 0, frameW, frameH, npc.x - Math.floor(destW/2), npc.y - destH + 10, destW, destH);
      } else {
        // Fallback: draw a simple villager shape
        ctx.fillStyle = '#dbb87a';
        ctx.fillRect(npc.x - 6, npc.y - 18, 12, 18); // body
        ctx.fillStyle = '#f5d6a0';
        ctx.fillRect(npc.x - 5, npc.y - 26, 10, 8); // head
      }
      // Show label only when close to player to reduce clutter
      const player = gameWorldState.current.player;
      const dx = (npc.x - player.x);
      const dy = (npc.y - player.y);
      if ((dx*dx + dy*dy) < (120*120)) {
        const label = npc.type || npc.village || '';
        if (label) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px monospace';
          ctx.fillText(label, npc.x - 12, npc.y - 32);
        }
      }
    });
    
    // Draw treasures — bold glowing items, impossible to miss
    const sparkleFrames = assets.sparkleFrames || [];
    const sparkleFrame = sparkleFrames.length
      ? sparkleFrames[Math.floor(Date.now() / 120) % sparkleFrames.length]
      : null;
    currentArea.treasures?.forEach(treasure => {
      if (!treasure.collected) {
        const t = Date.now();
        const bob = Math.sin(t * 0.004 + treasure.x * 0.02 + treasure.y * 0.015) * 3;
        const isChest = treasure.type === 'chest' || treasure.type === 'rare_chest';
        const chestImg = assets.chest || assets.barrel;

        if (isChest) {
          // Glow under chest
          const glowAlpha = 0.2 + 0.1 * Math.sin(t * 0.003);
          ctx.fillStyle = treasure.type === 'rare_chest'
            ? `rgba(255, 200, 0, ${glowAlpha})`
            : `rgba(180, 140, 50, ${glowAlpha})`;
          ctx.beginPath();
          ctx.arc(treasure.x + 10, treasure.y + 10, 16, 0, Math.PI * 2);
          ctx.fill();
          // Chest sprite or fallback
          if (chestImg && chestImg.width > 0) {
            ctx.drawImage(chestImg, treasure.x - 4, treasure.y - 2, 28, 26);
          } else {
            ctx.fillStyle = '#7c4a1f';
            ctx.fillRect(treasure.x, treasure.y + 2, 20, 14);
            ctx.fillStyle = '#d4a017';
            ctx.fillRect(treasure.x - 1, treasure.y, 22, 5);
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(treasure.x + 7, treasure.y + 5, 6, 5);
          }
          // Sparkle
          if (sparkleFrame) {
            ctx.drawImage(sparkleFrame, treasure.x - 6, treasure.y - 12, 32, 32);
          }
        } else {
          // ===== GOLD COIN — large, glowing, unmissable =====
          const cx = treasure.x + 8;
          const cy = treasure.y + bob;
          const coinRadius = 7;

          // Outer pulsing glow ring
          const pulse = 0.4 + 0.3 * Math.sin(t * 0.005 + treasure.x);
          ctx.beginPath();
          ctx.arc(cx, cy, coinRadius + 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 215, 0, ${pulse * 0.25})`;
          ctx.fill();

          // Inner glow
          ctx.beginPath();
          ctx.arc(cx, cy, coinRadius + 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 230, 80, ${pulse * 0.3})`;
          ctx.fill();

          // Coin body
          ctx.beginPath();
          ctx.arc(cx, cy, coinRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#ffd700';
          ctx.fill();
          ctx.strokeStyle = '#b8860b';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Inner circle detail
          ctx.beginPath();
          ctx.arc(cx, cy, coinRadius - 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = '#daa520';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Dollar/star mark
          ctx.fillStyle = '#b8860b';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('$', cx, cy + 3);
          ctx.textAlign = 'start';

          // Shine highlight
          ctx.fillStyle = 'rgba(255, 255, 240, 0.6)';
          ctx.beginPath();
          ctx.arc(cx - 2, cy - 2, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Twinkling sparkle
          const sparkT = Math.floor(t / 250) % 6;
          if (sparkT < 2) {
            ctx.fillStyle = '#FFFFFF';
            const sx = cx + coinRadius + 2 + sparkT * 2;
            const sy = cy - coinRadius + sparkT;
            ctx.fillRect(sx, sy, 2, 2);
            ctx.fillRect(sx + 1, sy - 1, 1, 1);
            ctx.fillRect(sx - 1, sy + 1, 1, 1);
          }
        }
      }
    });
    
    // Draw enemies by type and state
    gameWorldState.current.enemies.forEach(enemy => {
      let enemyImg = null;
      if (enemy.type === 'bee') enemyImg = assets['bee'] || assets['enemy'];
      else if (enemy.type === 'snail') enemyImg = assets['snail'] || assets['enemy'];
      else enemyImg = assets['bee'] || assets['enemy'];
      
      // Compute draw rect once (shared by tint, sprite, health bar)
      const drawW = enemy.renderWidth || 22;
      const drawH = enemy.renderHeight || 22;
      const drawX = enemy.x - Math.floor((drawW - enemy.width) / 2);
      const drawY = enemy.y - (enemy.yOffset || 8);

      // Hit flash — aligned to sprite rect
      if (enemy.state === 'hit') {
        ctx.fillStyle = 'rgba(255,60,60,0.35)';
        ctx.fillRect(drawX - 1, drawY - 1, drawW + 2, drawH + 2);
      }

      if (enemyImg && enemyImg.width > 0) {
        // Measured frame sizes from actual sprite sheets
        // Boar Idle: 192×32 → 6 frames 32×32
        // Bee Fly:  256×64 → 4 frames 64×64
        // Snail Walk: 384×32 → 12 frames 32×32
        let frameW, frameH;
        if (enemy.type === 'bee') {
          frameW = 64; frameH = 64;
        } else {
          frameW = 32; frameH = 32;
        }

        const totalFrames = Math.max(1, Math.floor(enemyImg.width / frameW));
        const animRate = enemy.state === 'attack' ? 100 : enemy.state === 'chase' ? 130 : 180;
        const frame = Math.floor(Date.now() / animRate) % totalFrames;
        const sx = frame * frameW;
        const sy = 0;

        ctx.save();
        if (!enemy.facingRight) {
          ctx.scale(-1, 1);
          ctx.drawImage(enemyImg, sx, sy, frameW, frameH, -drawX - drawW, drawY, drawW, drawH);
        } else {
          ctx.drawImage(enemyImg, sx, sy, frameW, frameH, drawX, drawY, drawW, drawH);
        }
        ctx.restore();
      } else {
        // Fallback colored rects by type
        let baseColor;
        if (enemy.type === 'bee') baseColor = '#FFD700';
        else if (enemy.type === 'snail') baseColor = '#90EE90';
        else baseColor = '#FFD700';

        if (enemy.difficulty === 'hard') {
          ctx.fillStyle = '#FF0000';
          ctx.fillRect(drawX - 1, drawY - 1, drawW + 2, drawH + 2);
        } else if (enemy.difficulty === 'medium') {
          ctx.fillStyle = '#FFA500';
          ctx.fillRect(drawX, drawY, drawW + 1, drawH + 1);
        }

        ctx.fillStyle = baseColor;
        ctx.fillRect(drawX, drawY, drawW, drawH);
      }

      // Health bar — only when damaged, positioned just above sprite
      const healthPercent = enemy.health / enemy.maxHealth;
      if (healthPercent < 1) {
        const hpY = drawY - 5;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(drawX, hpY, drawW, 3);
        ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
        ctx.fillRect(drawX, hpY, drawW * healthPercent, 3);
      }
    });
    
    // Weather overlays disabled unless explicitly enabled (remove falling dots effect)
    if (gameWorldState.current.showWeatherEffects) {
      const areaPx = canvas.width * canvas.height;
      if (seasonUI.season === Season.Rain) {
        ctx.fillStyle = 'rgba(100,100,255,0.12)';
        const rainCount = Math.max(20, Math.floor(areaPx / 3200));
        for (let i = 0; i < rainCount; i++) {
          const rx = (Math.random() * canvas.width) + camera.x;
          const ry = (Math.random() * canvas.height) + camera.y;
          ctx.fillRect(rx, ry, 1, 6);
        }
      } else if (seasonUI.season === Season.Winter) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        const snowCount = Math.max(10, Math.floor(areaPx / 6400));
        for (let i = 0; i < snowCount; i++) {
          const rx = (Math.random() * canvas.width) + camera.x;
          const ry = (Math.random() * canvas.height) + camera.y;
          ctx.fillRect(rx, ry, 2, 2);
        }
      }
    }

    // Hazards (lightning flashes)
    hazards.forEach(h => {
      if (h.type === 'lightning') {
        const alpha = Math.max(0, h.ttl);
        ctx.fillStyle = `rgba(255,255,200,${alpha})`;
        ctx.fillRect(h.x - 2, h.y - 100, 4, 120);
      }
    });

    // Draw knight with proper sprite sheet animations
    const player = gameWorldState.current.player;
    const knightAssets = assets.knight || {};
    const knightFrameConfig = assets.knightFrameConfig || {};
    
    // Debug: Log available knight assets and force visibility
    if (!window.knightAssetsLogged) {
      console.log('🏰 Available Knight Assets:', Object.keys(knightAssets));
      Object.entries(knightAssets).forEach(([key, img]) => {
        if (img) console.log(`  ${key}: ${img.width}x${img.height}`);
        else console.log(`  ${key}: FAILED TO LOAD`);
      });
      console.log('🎮 Player position:', player.x, player.y);
      console.log('📷 Camera position:', gameWorldState.current.camera.x, gameWorldState.current.camera.y);
      window.knightAssetsLogged = true;
    }
    
    let spriteSheet = null;
    let knightAnimState = 'idle';
    let frameCount = 10; // default frame count
    let currentFrame = player.animFrame;
    
    // Select appropriate sprite sheet based on state
    if (player.state === 'attack' && knightAssets.attack) {
      spriteSheet = knightAssets.attack;
      knightAnimState = 'attack';
      frameCount = 6; // Attack animation frames
      currentFrame = Math.floor((30 - player.attackCooldown) / 5) % frameCount;
    } else if (player.state === 'attack2' && knightAssets.attack2) {
      spriteSheet = knightAssets.attack2;
      knightAnimState = 'attack2';
      frameCount = 6;
      currentFrame = Math.floor((35 - player.attackCooldown) / 6) % frameCount;
    } else if (player.state === 'attackCombo' && knightAssets.attackCombo) {
      spriteSheet = knightAssets.attackCombo;
      knightAnimState = 'attackCombo';
      frameCount = 10;
      currentFrame = Math.floor((45 - player.attackCooldown) / 4.5) % frameCount;
    } else if ((player.state === 'defend' || player.isEating) && knightAssets.defend) {
      spriteSheet = knightAssets.defend;
      knightAnimState = 'defend';
      frameCount = 4;
      currentFrame = player.isEating ? Math.floor(player.eatTimer / 15) % frameCount : 0;
    } else if (player.state === 'roll' && knightAssets.roll) {
      spriteSheet = knightAssets.roll;
      knightAnimState = 'roll';
      frameCount = 7;
      currentFrame = Math.floor((20 - player.invulnerable) / 3) % frameCount;
    } else if (player.state === 'hit' && knightAssets.hit) {
      spriteSheet = knightAssets.hit;
      knightAnimState = 'hit';
      frameCount = 3;
      currentFrame = Math.floor((30 - player.invulnerable) / 10) % frameCount;
    } else if (player.state === 'death' && knightAssets.death) {
      spriteSheet = knightAssets.death;
      knightAnimState = 'death';
      frameCount = 10;
      currentFrame = Math.min(9, Math.floor(player.animFrame));
    } else if (player.state === 'run' && knightAssets.run) {
      spriteSheet = knightAssets.run;
      knightAnimState = 'run';
      frameCount = 8;
    } else if (knightAssets.idle) {
      spriteSheet = knightAssets.idle;
      knightAnimState = 'idle';
      frameCount = 10;
    }
    
    // Remove excessive logging
    // console.log('🎯 Drawing knight at:', player.x, player.y, 'State:', player.state, 'Frame:', currentFrame);
    
    if (spriteSheet && spriteSheet.width > 0) {
      const config = knightFrameConfig[knightAnimState] || {};
      const frameWidth = config.frameWidth || 120;
      const frameHeight = config.frameHeight || 80;
      const framesPerRow = config.framesPerRow || Math.max(1, Math.floor(spriteSheet.width / frameWidth));
      const availableFrames = config.totalFrames || Math.max(1, Math.floor(spriteSheet.width / frameWidth) * Math.floor(spriteSheet.height / frameHeight));
      frameCount = Math.max(1, Math.min(frameCount, availableFrames));
      currentFrame = Math.floor(currentFrame) % frameCount;
      
      const row = Math.floor(currentFrame / framesPerRow);
      const col = currentFrame % framesPerRow;
      const srcX = col * frameWidth;
      const srcY = row * frameHeight;
      
      // Draw knight sprite (proper size)
      const drawWidth = 64;
      const drawHeight = 64;
      const drawX = player.x - 16;
      const drawY = player.y - 32;
      
      ctx.save();
      
      // Add invulnerability flashing
      if (player.invulnerable > 0 && Math.floor(Date.now() / 100) % 2) {
        ctx.globalAlpha = 0.5;
      }
      
      // Remove debug border for clean look
      // ctx.strokeStyle = '#00FF00';
      // ctx.lineWidth = 3;
      // ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
      
      if (!player.facingRight) {
        ctx.scale(-1, 1);
        ctx.drawImage(
          spriteSheet,
          srcX, srcY, frameWidth, frameHeight,
          -drawX - drawWidth, drawY, drawWidth, drawHeight
        );
      } else {
        ctx.drawImage(
          spriteSheet,
          srcX, srcY, frameWidth, frameHeight,
          drawX, drawY, drawWidth, drawHeight
        );
      }
    ctx.restore();
      
      // Draw clean slash effect when player is attacking
      if (player.state && player.state.includes('attack')) {
        const slashProgress = Math.max(0, (30 - player.attackCooldown) / 30);
        if (slashProgress < 0.6) {
          ctx.save();
          ctx.globalAlpha = 1 - slashProgress * 1.5;
          const slashX = player.facingRight ? drawX + drawWidth - 4 : drawX - 20;
          const slashY = drawY + 8;
          // White slash arc
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (player.facingRight) {
            ctx.arc(slashX, slashY + 16, 18 + slashProgress * 12, -Math.PI * 0.6, Math.PI * 0.3);
          } else {
            ctx.arc(slashX + 20, slashY + 16, 18 + slashProgress * 12, Math.PI * 0.7, Math.PI * 1.6);
          }
          ctx.stroke();
          // Impact sparks
          ctx.fillStyle = '#FFD700';
          for (let i = 0; i < 3; i++) {
            const sparkAngle = slashProgress * Math.PI * 2 + i * 2.1;
            const sparkDist = 12 + slashProgress * 16;
            const sx = (player.facingRight ? slashX : slashX + 20) + Math.cos(sparkAngle) * sparkDist;
            const sy = slashY + 16 + Math.sin(sparkAngle) * sparkDist;
            ctx.fillRect(sx, sy, 2, 2);
          }
          ctx.restore();
        }
      }

      // Remove debug text for clean look
      // ctx.fillStyle = '#FFFFFF';
      // ctx.font = '16px Arial';
      // ctx.fillText(`${player.state} F:${currentFrame}`, player.x - 30, player.y - 70);
    } else {
      // Enhanced fallback knight representation (LARGER)
      console.warn('🚨 Knight sprite not loaded, using fallback');
      
      // Knight body (normal size)
      ctx.fillStyle = player.invulnerable > 0 ? '#FF6B6B' : '#4A4A4A';
      ctx.fillRect(player.x - 16, player.y - 16, 48, 48);
      
      // Knight helmet (normal size)
      ctx.fillStyle = '#C0C0C0';
      ctx.fillRect(player.x - 8, player.y - 32, 32, 20);
      
      // Knight sword (if attacking) - normal size
      if (player.state.includes('attack')) {
    ctx.fillStyle = '#FFD700';
        const swordX = player.facingRight ? player.x + 32 : player.x - 16;
        ctx.fillRect(swordX, player.y - 8, 8, 32);
      }
      
      // Debug text - normal size
    ctx.fillStyle = '#FF0000';
      ctx.font = '12px Arial';
      // Hide fallback debug labels in production
    }
    
    // Player health bar
    const healthPercent = player.health / player.maxHealth;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(player.x - 8, player.y - 20, 48, 6);
    ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
    ctx.fillRect(player.x - 8, player.y - 20, 48 * healthPercent, 6);
    
    // Draw buildings before restoring context (so they're affected by zoom)
    if (infrastructureSystem.current) {
      infrastructureSystem.current.buildings.forEach(building => {
        const buildingType = infrastructureSystem.current.buildingTypes[building.type];
        
        // Building base
        ctx.fillStyle = building.completed ? '#8B4513' : '#654321';
        ctx.fillRect(building.x - 20, building.y - 20, 40, 40);
        
        // Building icon/type indicator
        ctx.fillStyle = building.completed ? '#FFD700' : '#FFA500';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        const icons = {
          house: '🏠', blacksmith: '⚒️', farm: '🌾', 
          mine: '⛏️', tower: '🗼', portal: '🌀'
        };
        ctx.fillText(icons[building.type] || '🏗️', building.x, building.y + 5);
        
        // Construction progress bar
        if (!building.completed) {
          const progress = infrastructureSystem.current.getBuildingProgress(building.id);
          if (progress) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(building.x - 25, building.y - 35, 50, 8);
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(building.x - 25, building.y - 35, (50 * progress.progress) / 100, 8);
            
            // Progress text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '10px Arial';
            ctx.fillText(`${Math.floor(progress.progress)}%`, building.x, building.y - 40);
          }
        }
        
        // Building level indicator
        if (building.completed && building.level > 1) {
          ctx.fillStyle = '#FFD700';
          ctx.font = '12px Arial';
          ctx.fillText(`Lv.${building.level}`, building.x, building.y + 25);
        }
        
        ctx.textAlign = 'start';
      });
    }
    
    // Restore context (removes zoom and translation)
    ctx.restore();
    
    // Re-enable smoothing for crisp HUD text and UI elements
    if (typeof ctx.imageSmoothingEnabled === 'boolean') ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // UI elements are drawn in screen space (not zoomed)
      drawUI(ctx);
    } catch (error) {
      console.error('Render error:', error);
      // Fallback rendering
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '20px monospace';
      ctx.fillText('Render Error - Please refresh', 50, 50);
    }
  };

  // Minimal HUD with non-overlapping rows
  const drawUI = (ctx) => {
    const canvas = canvasRef.current;
    const assets = gameWorldState.current.assets || {};
    const area = gameMap.areas[gameMap.currentArea];
    const W = canvas.width;
    const barH = 52;

    // Ensure smoothing is on for clean HUD rendering
    if (typeof ctx.imageSmoothingEnabled === 'boolean') ctx.imageSmoothingEnabled = true;

    // ── Top bar background ── clean gradient (no tiled bookBar for sharpness)
    const grad = ctx.createLinearGradient(0, 0, 0, barH);
    grad.addColorStop(0, 'rgba(12, 8, 6, 0.94)');
    grad.addColorStop(0.7, 'rgba(24, 16, 10, 0.90)');
    grad.addColorStop(1, 'rgba(36, 24, 14, 0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, barH);
    // Subtle inner highlight
    ctx.fillStyle = 'rgba(200, 170, 110, 0.08)';
    ctx.fillRect(0, 0, W, 1);
    // Bottom border accent
    ctx.fillStyle = 'rgba(180, 140, 80, 0.55)';
    ctx.fillRect(0, barH - 1, W, 1);

    // ── Area name badge ──
    const areaName = area?.name || "Devil's World";
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    const nameW = ctx.measureText(areaName).width;
    const badgePad = 10;
    const badgeX = 12;
    const badgeY = 7;
    const badgeW = nameW + badgePad * 2;
    const badgeH = 22;
    // Badge background with subtle gradient
    const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeH);
    badgeGrad.addColorStop(0, 'rgba(40, 25, 12, 0.7)');
    badgeGrad.addColorStop(1, 'rgba(20, 12, 6, 0.6)');
    ctx.fillStyle = badgeGrad;
    ctx.beginPath();
    ctx.moveTo(badgeX + 5, badgeY);
    ctx.lineTo(badgeX + badgeW - 5, badgeY);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + 5);
    ctx.lineTo(badgeX + badgeW, badgeY + badgeH - 5);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - 5, badgeY + badgeH);
    ctx.lineTo(badgeX + 5, badgeY + badgeH);
    ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - 5);
    ctx.lineTo(badgeX, badgeY + 5);
    ctx.quadraticCurveTo(badgeX, badgeY, badgeX + 5, badgeY);
    ctx.fill();
    // Badge border
    ctx.strokeStyle = 'rgba(200, 170, 100, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Badge text
    ctx.fillStyle = '#f5e0a0';
    ctx.textAlign = 'start';
    ctx.fillText(areaName, badgeX + badgePad, badgeY + 16);

    // ── Stat bars (Life, Hunger, Points) ──
    const drawStatBar = (x, y, iconImg, label, value, maxVal, barColor, textColor) => {
      const barW = 100, barFullH = 12, iconSz = 18, radius = 3;
      // Icon
      if (iconImg && iconImg.width > 0) {
        ctx.drawImage(iconImg, x, y, iconSz, iconSz);
      }
      const bx = x + iconSz + 6;
      const by = y + 3;
      // Bar background with rounded rect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.moveTo(bx + radius, by); ctx.lineTo(bx + barW - radius, by);
      ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + radius);
      ctx.lineTo(bx + barW, by + barFullH - radius);
      ctx.quadraticCurveTo(bx + barW, by + barFullH, bx + barW - radius, by + barFullH);
      ctx.lineTo(bx + radius, by + barFullH);
      ctx.quadraticCurveTo(bx, by + barFullH, bx, by + barFullH - radius);
      ctx.lineTo(bx, by + radius);
      ctx.quadraticCurveTo(bx, by, bx + radius, by);
      ctx.fill();
      // Bar fill with gradient
      const fillRatio = Math.max(0, Math.min(1, value / maxVal));
      const fillW = barW * fillRatio;
      if (fillW > 0) {
        const barGrad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
        barGrad.addColorStop(0, barColor);
        barGrad.addColorStop(1, barColor.replace(')', ', 0.7)').replace('rgb', 'rgba'));
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        const fr = Math.min(radius, fillW);
        ctx.moveTo(bx + fr, by); ctx.lineTo(bx + fillW - (fillW >= barW ? radius : 0), by);
        if (fillW >= barW) ctx.quadraticCurveTo(bx + fillW, by, bx + fillW, by + radius); else ctx.lineTo(bx + fillW, by);
        ctx.lineTo(bx + fillW, by + barFullH - (fillW >= barW ? radius : 0));
        if (fillW >= barW) ctx.quadraticCurveTo(bx + fillW, by + barFullH, bx + fillW - radius, by + barFullH); else ctx.lineTo(bx + fillW, by + barFullH);
        ctx.lineTo(bx + fr, by + barFullH);
        ctx.quadraticCurveTo(bx, by + barFullH, bx, by + barFullH - radius);
        ctx.lineTo(bx, by + radius);
        ctx.quadraticCurveTo(bx, by, bx + fr, by);
        ctx.fill();
        // Shine on top edge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(bx + 2, by + 1, fillW - 4, 2);
      }
      // Bar subtle border
      ctx.strokeStyle = 'rgba(200, 180, 140, 0.35)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(bx + radius, by); ctx.lineTo(bx + barW - radius, by);
      ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + radius);
      ctx.lineTo(bx + barW, by + barFullH - radius);
      ctx.quadraticCurveTo(bx + barW, by + barFullH, bx + barW - radius, by + barFullH);
      ctx.lineTo(bx + radius, by + barFullH);
      ctx.quadraticCurveTo(bx, by + barFullH, bx, by + barFullH - radius);
      ctx.lineTo(bx, by + radius);
      ctx.quadraticCurveTo(bx, by, bx + radius, by);
      ctx.stroke();
      // Label + value
      ctx.fillStyle = textColor;
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'start';
      ctx.fillText(`${label} ${Math.round(value * 100)}%`, bx + 4, by + barFullH - 2);
    };

    // Life bar
    const statStartX = badgeX + badgeW + 20;
    drawStatBar(statStartX, 6, assets.uiHeart, 'HP', hud.life, 1,
      hud.life > 0.5 ? 'rgb(80, 210, 80)' : hud.life > 0.25 ? 'rgb(230, 180, 40)' : 'rgb(220, 50, 50)', '#fff');

    // Hunger bar
    const hungerX = statStartX + 148;
    drawStatBar(hungerX, 6, assets.uiEnergy, 'HGR', hud.hunger, 1,
      'rgb(100, 180, 255)', '#fff');

    // Points (gold counter)
    const ptsX = hungerX + 148;
    if (assets.uiCoin && assets.uiCoin.width > 0) {
      ctx.drawImage(assets.uiCoin, ptsX, 6, 18, 18);
    } else {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(ptsX + 9, 15, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText(`${playerStats.points.toFixed(2)} PTS`, ptsX + 24, 20);

    // ── Controls hint (row 2) ── clean anti-aliased text
    ctx.fillStyle = 'rgba(190, 180, 160, 0.65)';
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText('WASD Move  |  J Attack  |  K Defend  |  L Roll  |  E Talk  |  F Eat  |  I Inventory  |  B Build', 14, barH - 7);

    // ── Top-right circular navigator minimap (cached) ──
    const mw = motherWorldRef.current;
    const mapTiles = mw?.tiles;
    const mapH = mapTiles?.length || 0;
    const mapW = mapH ? (mapTiles[0]?.length || 0) : 0;
    if (mapW > 0 && mapH > 0) {
      const radius = 62;
      const centerX = W - radius - 14;
      const centerY = radius + 10;
      const size = radius * 2;
      const mc = minimapCacheRef.current;

      // Build offscreen minimap terrain once, then reuse
      if (!mc.canvas || mc.mapW !== mapW || mc.mapH !== mapH) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = size;
        offCanvas.height = size;
        const offCtx = offCanvas.getContext('2d');
        offCtx.fillStyle = '#0a1620';
        offCtx.fillRect(0, 0, size, size);
        const sampleCols = 48;
        const sampleRows = 48;
        const cellW = size / sampleCols;
        const cellH = size / sampleRows;
        for (let sy = 0; sy < sampleRows; sy++) {
          const ty = Math.min(mapH - 1, Math.floor((sy / sampleRows) * mapH));
          for (let sx = 0; sx < sampleCols; sx++) {
            const tx = Math.min(mapW - 1, Math.floor((sx / sampleCols) * mapW));
            const t = mapTiles[ty][tx] ?? 0;
            if (t === 3) offCtx.fillStyle = '#3a8c44';
            else if (t === 1 || t === 28) offCtx.fillStyle = '#8d6840';
            else if (t === 25 || t === 5) offCtx.fillStyle = '#6e6e78';
            else if (t === 27) offCtx.fillStyle = '#2a7834';
            else if (t === 6 || t === 7 || t === 26) offCtx.fillStyle = '#1e3f5a';
            else if (t === 2) offCtx.fillStyle = '#c4a868';
            else if (t === 0) offCtx.fillStyle = '#0c1a28';
            else offCtx.fillStyle = '#3a8c44';
            offCtx.fillRect(sx * cellW, sy * cellH, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
          }
        }
        mc.canvas = offCanvas;
        mc.mapW = mapW;
        mc.mapH = mapH;
      }

      ctx.save();
      // Outer glow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Clip to circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw cached terrain
      ctx.drawImage(mc.canvas, centerX - radius, centerY - radius, size, size);

      // Player location marker with pulse
      const player = gameWorldState.current.player;
      const worldWpx = mapW * 8;
      const worldHpx = mapH * 8;
      const px = centerX - radius + (Math.max(0, Math.min(worldWpx, player.x)) / worldWpx) * size;
      const py = centerY - radius + (Math.max(0, Math.min(worldHpx, player.y)) / worldHpx) * size;
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.004);
      ctx.beginPath();
      ctx.arc(px, py, 4 + pulse * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 77, 109, ${0.15 + pulse * 0.15})`;
      ctx.fill();
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();

      // Ring border
      ctx.strokeStyle = 'rgba(180, 150, 90, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120, 100, 60, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 3, 0, Math.PI * 2);
      ctx.stroke();

      // "MAP" label
      ctx.fillStyle = 'rgba(12, 8, 4, 0.7)';
      ctx.fillRect(centerX - 18, centerY + radius + 5, 36, 14);
      ctx.fillStyle = '#d4b870';
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAP', centerX, centerY + radius + 15);
      ctx.textAlign = 'start';
    }
  };

  // Game loop
  // Frame throttle to reduce CPU/GPU load
  const targetFps = 30;
  const frameIntervalMs = 1000 / targetFps;
  const lastFrameTimeRef = useRef(0);

  const gameLoop = () => {
    // Tick core systems (assume ~60fps)
    const nowMs = performance.now();
    if (nowMs - lastFrameTimeRef.current < frameIntervalMs) {
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    lastFrameTimeRef.current = nowMs;
    const dt = 1 / targetFps;
    minutesPlayedRef.current += dt / 60;
    seasonSystemRef.current.tick(dt);
    energySystemRef.current.tick(dt, seasonSystemRef.current.modifiers(), false);

    // Tick dialogue and tutorial every frame
    dialogueManager.current.tick();
    if (dialogueManager.current.isActive()) {
      setDialogueData(dialogueManager.current.getCurrent());
    }
    tutorialManager.current.tick();
    setTutorialStep(tutorialManager.current.getCurrentStep());

    const s = seasonSystemRef.current.get();
    const now = performance.now();
    if (now - lastUIUpdateRef.current > 50) {
      lastUIUpdateRef.current = now;
      setSeasonUI({ season: s, progress: seasonSystemRef.current.progress() });
      const energy = energySystemRef.current.state();
      // Sync combat health into HUD: player.health (0-100) → life (0-1)
      const combatLife = (gameWorldState.current.player?.health ?? 100) / (gameWorldState.current.player?.maxHealth ?? 100);
      const effectiveLife = Math.min(energy.life, combatLife); // whichever is lower
      setHud(prev => ({ ...prev, hunger: energy.hunger, life: effectiveLife, xp: karmaSystemRef.current.get().xp, karma: karmaSystemRef.current.get().karma }));
      setHint(guideHint({
        energy,
        season: s,
        inShelter: false,
        thunderNearby: s === Season.Rain,
        nearbyFood: false
      }));
    }
    // Season ambience change
    if (prevSeasonRef.current !== s) {
      try { audioMgr.current.ambienceSeason(s); } catch (_) {}
      prevSeasonRef.current = s;
    }

    // Challenger hazards
    const decision = challengerRef.current.step(dt, { season: s, player: gameWorldState.current.player, minutesPlayed: minutesPlayedRef.current });
    if (decision) {
      setHazards((list) => [...list, { ...decision, ttl: 1.0 }]);
      if (decision.type === 'lightning') { try { audioMgr.current.lightning(); } catch (_) {} }
    }

    // Update hazards ttl
    setHazards((list) => list.map(h => ({ ...h, ttl: h.ttl - dt })).filter(h => h.ttl > 0));

    // Update day/night cycle - only when not paused
    if (gameStateRef.current === 'playing') {
      const transition = dayNightCycle.current.update();
      setTimeOfDay(dayNightCycle.current.getTimeString());
      setIsNight(dayNightCycle.current.isNight);
      setSkyColor(dayNightCycle.current.getSkyColor());
      
      // Handle day/night transitions
      if (transition === 'nightfall') {
        setModalContent('🌙 Night falls... Enemies grow stronger and more numerous!');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 3000);
        playSound('ambient', 200, 0.3);
        // Switch to night music
        musicManager.current.playTrack('gameplay_night');
        // Add night ambient sounds
        musicManager.current.playAmbient('night_crickets');
        musicManager.current.playAmbient('wind');
      } else if (transition === 'dawn') {
        setModalContent('🌅 Dawn breaks! The danger subsides with the morning light.');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 3000);
        playSound('ambient', 400, 0.3);
        // Switch back to day music
        musicManager.current.playTrack('gameplay_day');
        // Add forest ambient sounds
        musicManager.current.playAmbient('forest');
      }
    }
    
    // Only update game logic when playing (not paused)
    if (gameStateRef.current === 'playing') {
    updatePlayer();
    updateEnemies();
    updateTreasures();
    }
    
    // Always render (to show pause screen)
    render();
    rafRef.current = requestAnimationFrame(gameLoop);
  };

  // Initialize game with error handling
  const initGame = async () => {
    try {
      initAudio();
      
      // Initialize music manager
      await musicManager.current.initialize();
      console.log('🎵 Music system initialized');
      
      const assets = await loadGameAssets();
      gameWorldState.current.assets = assets;
      // Fetch external mother world JSON (enforced)
      try {
        const res = await fetch('/mother_world.json');
        const json = await res.json();
        if (json && Array.isArray(json.tiles) && json.tiles.length) {
          motherWorldRef.current = json;
        } else if (json && json.spec) {
          motherWorldRef.current = buildWorldFromSpec(json.spec);
        } else {
          throw new Error('mother_world.json missing tiles/spec');
        }
        console.log('🌍 Mother World ready', { size: motherWorldRef.current.width + 'x' + motherWorldRef.current.height });
      } catch (e) {
        console.error('Failed to load mother_world.json:', e);
        setModalContent('Map load failed: place a valid mother_world.json in public/ and reload.');
        setShowModal(true);
        return; // Abort init until a valid map is provided
      }
      initTreasures();
      initEnemies();
      // place player at saved position if available, otherwise spawn
      const spawn = motherWorldRef.current?.spawn || { x: 512, y: 600 };
      const saved = loadPlayerProgress();
      const worldWpx = (motherWorldRef.current?.width || 200) * 8;
      const worldHpx = (motherWorldRef.current?.height || 150) * 8;
      const player = gameWorldState.current.player;
      let startPos = spawn;
      if (saved && saved.x >= 0 && saved.x <= worldWpx && saved.y >= 0 && saved.y <= worldHpx) {
        // Validate saved position is actually walkable
        if (isPositionWalkable(saved.x, saved.y)) {
          startPos = { x: saved.x, y: saved.y };
          gameWorldState.current.camera.x = Math.max(0, saved.cameraX || 0);
          gameWorldState.current.camera.y = Math.max(0, saved.cameraY || 0);
          // Restore game stats if saved
          if (saved.stats) {
            setGameStats(prev => ({ ...prev, ...saved.stats }));
          }
          if (saved.points && gamePoints) {
            Object.assign(gamePoints, saved.points);
          }
          console.log('📂 Loaded saved progress at', startPos);
        } else {
          // Saved position is blocked — find safe nearby spot
          startPos = findNearestSafePosition(saved.x, saved.y);
          console.log('⚠️ Saved position blocked, moved to safe spot', startPos);
        }
      }
      // Ensure start position is walkable
      if (!isPositionWalkable(startPos.x, startPos.y)) {
        startPos = findNearestSafePosition(startPos.x, startPos.y);
      }
      player.x = startPos.x;
      player.y = startPos.y;
      if (!saved || !isPositionWalkable(saved?.x, saved?.y)) {
        gameWorldState.current.camera.x = Math.max(0, startPos.x - 260);
        gameWorldState.current.camera.y = Math.max(0, startPos.y - 180);
      }
      
      // Start title music after a brief delay; also retry once if AudioContext was suspended
      const startTitle = async () => {
        if (!musicManager.current || !musicManager.current.initialized) return;
        try {
          await musicManager.current.resume();
          musicManager.current.playTrack('title');
          console.log('🎵 Title music started');
        } catch (e) {
          console.warn('Title music play deferred, will retry on first key/click');
        }
      };
      setTimeout(startTitle, 800);
      
      gameLoop();
    } catch (error) {
      console.error('Game initialization error:', error);
      setModalContent('Game initialization failed. Please refresh the page.');
      setShowModal(true);
    }
  };

  // Event handlers
  const handleKeyDown = (e) => {
    const key = e.key;
    const code = e.code;
    gameWorldState.current.keys[key] = true;
    gameWorldState.current.keys[code] = true;
    if (typeof key === 'string') gameWorldState.current.keys[key.toLowerCase()] = true;
    const isGameKey = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S','e','E','f','F','r','R','Enter','Escape','j','J','k','K','l','L','i','I','b','B','n','N','m','M',' ','1','2','3','4','5','6','7','8','9'].includes(e.key);
    if (isGameKey) e.preventDefault();

    // ── Dialogue / Cutscene advance ──
    if (dialogueManager.current.isActive()) {
      if (key === 'Enter' || key === ' ' || key === 'Escape') {
        const still = dialogueManager.current.advance();
        setDialogueData(still ? dialogueManager.current.getCurrent() : null);
      }
      return; // block all other keys while dialogue is showing
    }
    
    // Ensure audio context is resumed on first user interaction
    if (musicManager.current && musicManager.current.audioContext) {
      musicManager.current.resume();
      if (gameState === 'title' && !musicManager.current.isPlaying) {
        musicManager.current.playTrack('title');
      }
    }

    // Handle refresh key (only when not actively playing)
    if ((e.key === 'r' || e.key === 'R') && gameStateRef.current !== 'playing') {
      forceRefreshUI();
    }

    if (e.key === '1') { stakeCoins(); }
    if (e.key === '2') { claimRewards(); }
    if (e.key === '3') { mintNFT(); }
    if (e.key === '4') { showAccountBalance(); }
    if (e.key === '5') { unstakeCoins(); }
    if (e.key === '6') { mintCITTokens(10); }
    if (e.key === '7') { stakeCITTokens(10); }
    if (e.key === '8') { claimCITRewards(); }
    if (e.key === '9') { unstakeCITTokens(); }

    // ── Movement tutorial tracking ──
    if (['w','a','s','d','W','A','S','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
      tutorialManager.current.complete('playerMoved');
    }
    
    // Combat controls
    if (e.key === 'j' || e.key === 'J') {
      tutorialManager.current.complete('playerAttacked');
      // Attack with combo system
      const player = gameWorldState.current.player;
      const currentTime = Date.now();
      
      if (player.attackCooldown <= 0 && player.state !== 'death' && !player.isEating) {
        // Combo system: if attacked within 1 second, do combo
        if (currentTime - player.lastAttackTime < 1000 && player.attackComboCount < 3) {
          player.attackComboCount++;
          if (player.attackComboCount === 2) {
            player.state = 'attack2';
            player.attackCooldown = 35;
          } else if (player.attackComboCount === 3) {
            player.state = 'attackCombo';
            player.attackCooldown = 45;
          }
        } else {
          // First attack
          player.state = 'attack';
          player.attackCooldown = 30;
          player.attackComboCount = 1;
        }
        
        player.lastAttackTime = currentTime;
        musicManager.current.playSFX('attack', 400, 0.2);
      }
    }
    
    if (e.key === 'k' || e.key === 'K') {
      tutorialManager.current.complete('playerDefended');
      // Defend/Crouch
      const player = gameWorldState.current.player;
      if (player.defendCooldown <= 0 && player.state !== 'death' && !player.isEating) {
        player.state = 'defend';
        player.defendCooldown = 30;
        player.isDefending = true;
        player.invulnerable = 15; // Brief invulnerability frames
        
        // Play defend sound effect
        musicManager.current.playSFX('defend', 250, 0.3);
        
        setTimeout(() => {
          if (gameWorldState.current.player) {
            gameWorldState.current.player.isDefending = false;
          }
        }, 800);
      }
    }
    
    if (e.key === 'l' || e.key === 'L') {
      // Roll/Dash
      const player = gameWorldState.current.player;
      if (player.state === 'idle' || player.state === 'run') {
        player.state = 'roll';
        player.invulnerable = 20; // Brief invulnerability during roll
        musicManager.current.playSFX('attack', 350, 0.3);
      }
    }
    
    // Enhanced NPC interaction with dialogue system
    if (e.key === 'e' || e.key === 'E') {
      const player = gameWorldState.current.player;
      const currentArea = gameMap.areas[gameMap.currentArea];
      
      (currentArea?.npcs || []).forEach(npc => {
        if (checkCollision(player, { x: npc.x, y: npc.y, width: 24, height: 32 })) {
          playSound('talk', 500, 0.2);
          tutorialManager.current.complete('playerTalked');
          
          const npcName = npc.name || npc.type || 'Villager';
          const npcType = (npc.type || 'villager').toLowerCase();
          
          // Pick dialogue lines from the NPC_DIALOGUES map or fallback
          const pool = NPC_DIALOGUES[npcType] || NPC_DIALOGUES.villager;
          const dialogueTree = Array.isArray(npc.dialogueTree) && npc.dialogueTree.length
            ? npc.dialogueTree : pool;
          const line = dialogueTree[Math.floor(Math.random() * dialogueTree.length)];
          
          // Start a mini-cutscene with a single line
          dialogueManager.current.startCutscene([{
            speaker: npcName,
            portrait: 'npc',
            text: line,
            bg: 'dark',
          }], () => { setDialogueData(null); });
          setDialogueData(dialogueManager.current.getCurrent());
          
          // Give bonus points
          setPlayerStats(prev => ({
            ...prev,
            points: prev.points + 50,
            streak: prev.streak + 1
          }));
        }
      });
    }
    
    // Eat food shortcut with animation
    if (e.key === 'f' || e.key === 'F') {
      const player = gameWorldState.current.player;
      if (player.health < player.maxHealth && !player.isEating && player.state === 'idle') {
        player.isEating = true;
        player.eatTimer = 60;
        player.state = 'defend';
        playSound('heal', 600, 0.3);
      }
    }
    
    // Inventory controls
    if (e.key === 'i' || e.key === 'I') {
      setShowInventory(prev => !prev);
      tutorialManager.current.complete('inventoryOpened');
    }
    
    // Building menu
    if (e.key === 'b' || e.key === 'B') {
      setShowBuildMenu(prev => !prev);
    }

    if (e.key === 'n' || e.key === 'N') {
      setShowWorldMap(prev => !prev);
      tutorialManager.current.complete('mapOpened');
    }
    
    // Handle Escape key for pause/navigation
    if (e.key === 'Escape') {
      if (gameStateRef.current === 'playing') {
        setScreenState('paused');
        console.log('Game paused');
      } else if (gameStateRef.current === 'paused') {
        setScreenState('playing');
        console.log('Game resumed');
      } else {
        setBuildingMode(false);
        setSelectedBuildingType(null);
      }
    }
    
    // Quit to menu when paused
    if (e.key === 'q' || e.key === 'Q') {
      if (gameStateRef.current === 'paused') {
        setScreenState('title');
        screenManager.current.currentScreen = 'title';
        musicManager.current.playTrack('title');
        console.log('Quit to main menu');
      }
    }
    
    // Restart game when paused
    if (e.key === 'r' || e.key === 'R') {
      if (gameStateRef.current === 'paused') {
        setScreenState('playing');
        resetGame();
        console.log('Game restarted');
      }
    }
    
    // Music controls
    if (e.key === 'm' || e.key === 'M') {
      // Toggle music
      toggleMusicPlayback();
    }
    
    if (e.key === '=' || e.key === '+') {
      // Increase volume
      const currentVol = musicManager.current.musicVolume;
      musicManager.current.setMusicVolume(Math.min(1, currentVol + 0.1));
    }
    
    if (e.key === '-' || e.key === '_') {
      // Decrease volume
      const currentVol = musicManager.current.musicVolume;
      musicManager.current.setMusicVolume(Math.max(0, currentVol - 0.1));
    }
    
    // Handle screen manager input using ref to avoid stale state
    if (gameStateRef.current !== 'playing') {
      const action = screenManager.current.handleInput(e.key);
      if (action) {
        handleScreenAction(action);
        // After consuming a title/help/scoreboard action, swallow key and stop further handling
    e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    
  };

  const handleKeyUp = (e) => {
    const key = e.key;
    const code = e.code;
    gameWorldState.current.keys[key] = false;
    gameWorldState.current.keys[code] = false;
    if (typeof key === 'string') gameWorldState.current.keys[key.toLowerCase()] = false;
    const isGameKey = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S','e','E','f','F','r','R'].includes(e.key);
    if (isGameKey) e.preventDefault();
  };

  // Enhanced Ethers.js MetaMask integration with Avalanche L1 - REMOVED DUPLICATE
  const connectWalletLegacy = async () => {
    try {
      // Check if we're running on localhost or file protocol
      if (window.location.protocol === 'file:') {
        setModalContent('Please run this game from a web server (localhost) for wallet connection to work properly.');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 3000);
        return;
      }

      // Check if MetaMask is available
      if (typeof window.ethereum !== 'undefined') {
        const provider = window.ethereum;
        
        // Check if MetaMask is properly initialized
        if (!provider.isMetaMask) {
          setModalContent('Please use MetaMask wallet. Other wallets are not supported.');
          setShowModal(true);
          setTimeout(() => setShowModal(false), 3000);
          return;
        }
        
        // First, try to get accounts (this will work if already connected)
        let accounts = [];
        try {
          accounts = await provider.request({ method: 'eth_accounts' });
        } catch (error) {
          console.log('No existing connection, will request new connection');
        }
        
        // If no accounts, request connection
        if (accounts.length === 0) {
          try {
            accounts = await provider.request({ method: 'eth_requestAccounts' });
          } catch (error) {
            if (error.code === 4001) {
              setModalContent('Connection rejected. Please try again and approve the connection in MetaMask.');
              setShowModal(true);
              setTimeout(() => setShowModal(false), 4000);
              return;
            }
            throw error;
          }
        }
        
        if (accounts.length === 0) {
          setModalContent('No accounts found. Please unlock MetaMask and try again.');
          setShowModal(true);
          setTimeout(() => setShowModal(false), 3000);
          return;
        }
        
        // Fuji testnet only
        const CHAINS = [
          {
            id: '0xA869',
            name: 'Avalanche Fuji Testnet',
            rpc: 'https://api.avax-test.network/ext/bc/C/rpc',
            currency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 }
          },
        ];

        const trySwitchOrAdd = async (chain) => {
          try {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chain.id }] });
            return true;
          } catch (err) {
            if (err.code === 4902) {
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{ chainId: chain.id, chainName: chain.name, rpcUrls: [chain.rpc], nativeCurrency: chain.currency }],
              });
              return true;
            }
            return false;
          }
        };

        // If already on Fuji, keep it; otherwise switch/add Fuji
        const currentChain = await provider.request({ method: 'eth_chainId' }).catch(() => null);
        const isSupported = CHAINS.some(c => c.id === currentChain);
        if (!isSupported) {
          const okFuji = await trySwitchOrAdd(CHAINS[0]);
          if (!okFuji) {
            setModalContent('Please add Avalanche Fuji Testnet (43113) in MetaMask.');
            setShowModal(true);
            setTimeout(() => setShowModal(false), 5000);
            return;
          }
        }
        
        // Connection successful
        setIsConnected(true);
        playSound('connect', 440, 0.3);
        
        // Initialize contract service
        console.log('Initializing contract service...');
        try {
          const initialized = await contractService.initialize();
          console.log('Contract service initialized:', initialized);
          
          if (!initialized) {
            throw new Error('Contract service failed to initialize');
          }
        } catch (error) {
          console.error('Contract service initialization error:', error);
          setModalContent(`Failed to initialize contract service: ${error.message}`);
          setShowModal(true);
          setTimeout(() => setShowModal(false), 5000);
          return;
        }
        
        // Get account balance using contract service
        const balance = await contractService.getAccountBalance(accounts[0]);
        
        setModalContent(`✅ Connected to Avalanche Fuji Testnet!\nAddress: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}\nBalance: ${balance} AVAX\n\n🎮 Ready for testnet blockchain transactions!`);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 5000);
        
      } else {
        setModalContent('MetaMask not detected! Please install MetaMask from https://metamask.io/');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 3000);
        return;
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setModalContent(`Failed to connect wallet: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 5000);
    }
  };

  // Real-time leaderboard synchronization
  const syncLeaderboardWithBlockchain = async () => {
    if (!isConnected || !contractService.isInitialized()) return;
    
    try {
      const address = await contractService.getCurrentAddress();
      const balance = await contractService.getAccountBalance(address);
      const nftBalance = await contractService.getNFTBalance(address);
      let stakerInfo = null;
      
      try {
        stakerInfo = await contractService.getStakerInfo(address);
      } catch (error) {
        console.log('No staking info available');
      }

      const stakedAmount = stakerInfo ? parseFloat(stakerInfo.stakedAmount) : 0;
      
      // Update leaderboard with current blockchain data
      setLeaderboard(prev => {
        const newLeaderboard = [...prev];
        
        // Find existing user entry
        const userAddress = address.slice(0, 6) + '...' + address.slice(-4);
        const existingIndex = newLeaderboard.findIndex(entry => 
          entry.address === userAddress
        );

        if (existingIndex !== -1) {
          // Update existing entry with current blockchain data
          newLeaderboard[existingIndex].staked = stakedAmount;
          newLeaderboard[existingIndex].nfts = nftBalance;
          // Keep current points (they're calculated in real-time)
        } else {
          // Add new entry
          newLeaderboard.push({
            address: userAddress,
            avaxPoints: playerStats.points,
            staked: stakedAmount,
            nfts: nftBalance,
            rank: 0
          });
        }

        // Sort by AVAX points and update ranks
        newLeaderboard.sort((a, b) => b.avaxPoints - a.avaxPoints);
        newLeaderboard.forEach((entry, index) => {
          entry.rank = index + 1;
        });

        return newLeaderboard.slice(0, 10);
      });
    } catch (error) {
      console.error('Error syncing leaderboard:', error);
    }
  };
  // Update leaderboard with user AVAX points (enhanced for real-time)
  const updateLeaderboard = async (userAddress, avaxPointsToAdd) => {
    try {
      // Get current user info
      const userBalance = await contractService.getAccountBalance(userAddress);
      const userNFTs = await contractService.getNFTBalance(userAddress);
      let stakerInfo = null;
      try {
        stakerInfo = await contractService.getStakerInfo(userAddress);
      } catch (error) {
        console.log('No staking info available');
      }

      const stakedAmount = stakerInfo ? parseFloat(stakerInfo.stakedAmount) : 0;
      
      // Find or create user entry
      const userEntry = {
        address: userAddress.slice(0, 6) + '...' + userAddress.slice(-4),
        avaxPoints: avaxPointsToAdd,
        staked: stakedAmount,
        nfts: userNFTs,
        rank: 0
      };

      // Update leaderboard
      setLeaderboard(prev => {
        const newLeaderboard = [...prev];
        
        // Find existing user entry
        const existingIndex = newLeaderboard.findIndex(entry => 
          entry.address === userEntry.address
        );

        if (existingIndex !== -1) {
          // Update existing entry
          newLeaderboard[existingIndex].avaxPoints += avaxPointsToAdd;
          newLeaderboard[existingIndex].staked = stakedAmount;
          newLeaderboard[existingIndex].nfts = userNFTs;
        } else {
          // Add new entry
          newLeaderboard.push(userEntry);
        }

        // Sort by AVAX points and update ranks
        newLeaderboard.sort((a, b) => b.avaxPoints - a.avaxPoints);
        newLeaderboard.forEach((entry, index) => {
          entry.rank = index + 1;
        });

        // Keep only top 10
        return newLeaderboard.slice(0, 10);
      });
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  };

  // Account balance function
  const showAccountBalance = async () => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Please connect your wallet first!');
      setShowModal(true);
      return;
    }

    try {
      const address = await contractService.getCurrentAddress();
      const balance = await contractService.getAccountBalance(address);
      const balanceInAVAX = parseFloat(balance);
      
      // Get staker info if available
      let stakerInfo = null;
      try {
        stakerInfo = await contractService.getStakerInfo(address);
      } catch (error) {
        console.log('No staking info available');
      }

      // Get NFT balance
      const nftBalance = await contractService.getNFTBalance(address);

      let balanceText = `💰 Account Balance\n\n`;
      balanceText += `📍 Address: ${address.slice(0, 6)}...${address.slice(-4)}\n`;
      balanceText += `🪙 AVAX Balance: ${balanceInAVAX.toFixed(4)} AVAX\n`;
      balanceText += `🎨 NFTs Owned: ${nftBalance}\n\n`;
      
      if (stakerInfo && stakerInfo.isStaking) {
        balanceText += `📊 Staking Info:\n`;
        balanceText += `• Staked: ${stakerInfo.stakedAmount} AVAX\n`;
        balanceText += `• Pending Rewards: ${stakerInfo.pendingRewards} AVAX\n`;
        balanceText += `• Staking Since: ${new Date(stakerInfo.stakingTimestamp * 1000).toLocaleDateString()}\n\n`;
      }
      
      balanceText += `🎮 Game Stats:\n`;
      balanceText += `• Energy: ${playerStats.energy}/100\n`;
      balanceText += `• Streak: ${playerStats.streak}\n`;
      balanceText += `• AVAX Points: ${playerStats.points.toFixed(4)} AVAX\n`;
      balanceText += `• AVAX Balance: ${playerStats.avax.toFixed(4)} AVAX\n\n`;
      
      balanceText += `⚡ Real-Time Stats:\n`;
      balanceText += `• Points/sec: ${realtimeStats.pointsPerSecond.toFixed(6)} AVAX\n`;
      balanceText += `• Staking Multiplier: ${realtimeStats.stakingMultiplier}x\n`;
      balanceText += `• Activity Multiplier: ${realtimeStats.activityMultiplier.toFixed(2)}x\n`;
      balanceText += `• Total Earned: ${realtimeStats.totalPointsEarned.toFixed(4)} AVAX`;

      setModalContent(balanceText);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 8000);
    } catch (error) {
      console.error('Error getting account balance:', error);
      setModalContent('Error getting account balance. Please try again.');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
    }
  };

  // Duplicate disconnectWallet function removed - using blockchain integration version

  // Enhanced Ethers.js account balance function
  const getAccountBalance = async (address) => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(address);
      return formatEther(balance);
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0.0';
    }
  };

  // Enhanced real-time balance update using contract service
  const updateRealTimeBalance = async () => {
    if (isConnected && contractService.isInitialized()) {
      try {
        const address = await contractService.getCurrentAddress();
        const balance = await contractService.getAccountBalance(address);
        
        // Update player stats with real balance
        setPlayerStats(prev => ({
          ...prev,
          avax: parseFloat(balance)
        }));
      } catch (error) {
        console.error('Error updating balance:', error);
      }
    }
  };

  // Enhanced Ethers.js transaction status checker
  const checkTransactionStatus = async (txHash) => {
    try {
        const provider = new BrowserProvider(window.ethereum);
      const receipt = await provider.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      console.error('Error checking transaction:', error);
      return null;
    }
  };

  // Enhanced staking functionality using contract service
  const stakeCoins = async () => {
    console.log('Stake coins called. Connected:', isConnected, 'Contract initialized:', contractService.isInitialized());
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Please connect your wallet first!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }
    
    try {
      const address = await contractService.getCurrentAddress();
      
      // Get current balance using contract service
      const balance = await contractService.getAccountBalance(address);
      const balanceInAVAX = parseFloat(balance);
      
      if (balanceInAVAX < 0.01) {
        setModalContent('Insufficient AVAX balance! You need at least 0.01 AVAX to stake.\n\n💡 Get free testnet AVAX from: https://faucet.avax.network/');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 6000);
        return;
      }
      
      setModalContent('Confirming stake transaction... Please check MetaMask.');
      setShowModal(true);
      
      // Stake using contract service
      const tx = await contractService.stakeAVAX(0.01);
      
      setModalContent(`Staking transaction sent! TX: ${tx.hash}\nWaiting for confirmation...`);
      setShowModal(true);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        playSound('stake', 300, 0.2);
        setWeb3Quest(prev => ({ ...prev, stake: true }));
        setPlayerStats(prev => ({
          ...prev,
          energy: Math.min(100, prev.energy + 20),
          streak: prev.streak + 1,
          avax: prev.avax + 0.01, // Add staked amount to game balance
          points: prev.points + 0.01 // Add AVAX points
        }));
        
        // Immediately update real-time stats to reflect new energy/streak
        setTimeout(() => {
          updateRealtimeStatsImmediately();
        }, 100); // Small delay to ensure state is updated
        
        // Update leaderboard with AVAX points
        await updateLeaderboard(address, 0.01); // 0.01 AVAX points for staking
        
        pushTx(tx.hash, 'AVAX Stake', '0.01 AVAX');
        await refreshBlockchainState();
        setModalContent(`✅ Staked 0.01 AVAX!\nTX: ${tx.hash}\n🔗 https://testnet.snowtrace.io/tx/${tx.hash}`);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 5000);
      } else {
        setModalContent('Staking transaction failed! Please try again.');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 4000);
      }
      
    } catch (error) {
      console.error('Staking error:', error);
      setModalContent(`Staking failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    }
  };

  // Unstake AVAX using contract service
  const unstakeCoins = async () => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Please connect your wallet first!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }
    
    try {
      setModalContent('Unstaking AVAX... Please check MetaMask.');
      setShowModal(true);
      
      // Unstake using contract service
      const tx = await contractService.unstakeAVAX();
      
      setModalContent(`Unstaking transaction sent! TX: ${tx.hash}\nWaiting for confirmation...`);
      setShowModal(true);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        playSound('stake', 300, 0.2);
        setPlayerStats(prev => ({
          ...prev,
          energy: Math.min(100, prev.energy + 10),
          streak: prev.streak + 1
        }));
        
        pushTx(tx.hash, 'AVAX Unstake', 'All staked AVAX');
        await refreshBlockchainState();
        setModalContent(`✅ Unstaked!\nTX: ${tx.hash}\n🔗 https://testnet.snowtrace.io/tx/${tx.hash}`);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 5000);
      } else {
        setModalContent('Unstaking transaction failed! Please try again.');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 4000);
      }
      
    } catch (error) {
      console.error('Unstaking error:', error);
      setModalContent(`Unstaking failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    }
  };

  // Claim rewards using contract service
  const claimRewards = async () => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Please connect your wallet first!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }
    
    try {
      setModalContent('Claiming rewards... Please check MetaMask.');
      setShowModal(true);
      
      // Claim rewards using contract service
      const tx = await contractService.claimRewards();
      
      setModalContent(`Claim rewards transaction sent! TX: ${tx.hash}\nWaiting for confirmation...`);
      setShowModal(true);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        playSound('collect', 600, 0.2);
        setWeb3Quest(prev => ({ ...prev, rewards: true }));
        setPlayerStats(prev => ({
          ...prev,
          points: prev.points + 200,
          streak: prev.streak + 1
        }));
        
        pushTx(tx.hash, 'Claim Rewards', 'Staking Rewards');
        await refreshBlockchainState();
        setModalContent(`✅ Rewards claimed!\nTX: ${tx.hash}\n🔗 https://testnet.snowtrace.io/tx/${tx.hash}`);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 5000);
      } else {
        setModalContent('Claim rewards transaction failed! Please try again.');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 4000);
      }
      
    } catch (error) {
      console.error('Claim rewards error:', error);
      setModalContent(`Claim rewards failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    }
  };

  const mintCITTokens = async (amount = 10) => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Please connect your wallet first!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }

    try {
      setModalContent(`Minting ${amount} CIT tokens... Please confirm in MetaMask.`);
      setShowModal(true);
      const tx = await contractService.mintTokensWithAVAX(amount);
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        pushTx(tx.hash, 'Mint CIT', `${amount} CIT`);
        setWeb3Quest(prev => ({ ...prev, cit: true }));
        await refreshBlockchainState();
        setModalContent(`✅ Minted ${amount} CIT!\nTX: ${tx.hash}\n🔗 https://testnet.snowtrace.io/tx/${tx.hash}`);
      } else {
        setModalContent('CIT mint transaction failed on-chain.');
      }
      setShowModal(true);
      setTimeout(() => setShowModal(false), 5000);
    } catch (error) {
      setModalContent(`CIT mint failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    }
  };

  const stakeCITTokens = async (amount = 10) => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Please connect your wallet first!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }

    try {
      setModalContent(`Staking ${amount} CIT... Please confirm in MetaMask.`);
      setShowModal(true);
      const tx = await contractService.stakeTokens(amount);
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        pushTx(tx.hash, 'Stake CIT', `${amount} CIT`);
        await refreshBlockchainState();
        setModalContent(`✅ Staked ${amount} CIT!\nTX: ${tx.hash}\n🔗 https://testnet.snowtrace.io/tx/${tx.hash}`);
      } else {
        setModalContent('CIT stake failed on-chain.');
      }
      setShowModal(true);
      setTimeout(() => setShowModal(false), 5000);
    } catch (error) {
      setModalContent(`CIT staking failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    }
  };

  const claimCITRewards = async () => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Please connect your wallet first!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }

    try {
      setModalContent('Claiming CIT staking rewards... Please confirm in MetaMask.');
      setShowModal(true);
      const tx = await contractService.claimTokenRewards();
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        pushTx(tx.hash, 'Claim CIT Rewards', 'CIT Staking Rewards');
        await refreshBlockchainState();
        setModalContent(`✅ CIT rewards claimed!\nTX: ${tx.hash}\n🔗 https://testnet.snowtrace.io/tx/${tx.hash}`);
      } else {
        setModalContent('CIT reward claim failed on-chain.');
      }
      setShowModal(true);
      setTimeout(() => setShowModal(false), 5000);
    } catch (error) {
      setModalContent(`CIT reward claim failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    }
  };

  const unstakeCITTokens = async () => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Please connect your wallet first!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }

    try {
      setModalContent('Unstaking CIT... Please confirm in MetaMask.');
      setShowModal(true);
      const tx = await contractService.unstakeTokens();
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        pushTx(tx.hash, 'Unstake CIT', 'All staked CIT');
        await refreshBlockchainState();
        setModalContent(`✅ CIT unstaked!\nTX: ${tx.hash}\n🔗 https://testnet.snowtrace.io/tx/${tx.hash}`);
      } else {
        setModalContent('CIT unstake failed on-chain.');
      }
      setShowModal(true);
      setTimeout(() => setShowModal(false), 5000);
    } catch (error) {
      setModalContent(`CIT unstake failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    }
  };

  // ── Helper: push a transaction into history ──
  const pushTx = (hash, type, amount, status = 'confirmed') => {
    setTxHistory(prev => [{ hash, type, amount, timestamp: Date.now(), status }, ...prev].slice(0, 30));
  };

  // ── Refresh all on-chain balances (AVAX, CIT, NFT, staker info) ──
  const refreshBlockchainState = async () => {
    if (!isConnected || !contractService.isInitialized()) return;
    try {
      const address = await contractService.getCurrentAddress();
      const [avaxBal, citBal, nfts] = await Promise.all([
        contractService.getAccountBalance(address),
        contractService.getTokenBalance(address).catch(() => '0'),
        contractService.getNFTBalance(address).catch(() => 0)
      ]);
      setAvaxBalance(avaxBal);
      setCitBalance(citBal);
      setNftCount(nfts);

      // CIT staker info
      const si = await contractService.getTokenStakerInfo(address).catch(() => null);
      setCitStakerInfo(si);

      // AVAX staker info (includes tier, APY, multiplier)
      const avaxSi = await contractService.getStakerInfo(address).catch(() => null);
      setAvaxStakerInfo(avaxSi);
    } catch (e) {
      console.warn('refreshBlockchainState:', e);
    }
  };

  // ── Exchange in-game gold → CIT tokens (real on-chain mint) ──
  const exchangeGoldForCIT = async (goldAmount) => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Connect your wallet first to exchange gold for CIT tokens!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }
    const citAmount = Math.floor(goldAmount / EXCHANGE_RATE);
    if (citAmount <= 0) {
      setModalContent(`You need at least ${EXCHANGE_RATE} gold to exchange for 1 CIT token.\nYou have: ${gameStats.goldCollected} gold.`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
      return;
    }
    const avaxCost = (citAmount * 0.001).toFixed(4);
    try {
      setBlockchainLoading('Exchanging gold for CIT...');
      setModalContent(`🔄 Exchanging ${goldAmount} gold → ${citAmount} CIT\nAVAX cost: ${avaxCost}\nPlease confirm in MetaMask...`);
      setShowModal(true);
      const tx = await contractService.mintTokensWithAVAX(citAmount);
      setModalContent(`⏳ TX sent: ${tx.hash.slice(0,10)}...\nWaiting for confirmation...`);
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        pushTx(tx.hash, 'Gold→CIT Exchange', `${goldAmount} gold → ${citAmount} CIT`);
        setGameStats(prev => ({ ...prev, goldCollected: Math.max(0, prev.goldCollected - goldAmount) }));
        setWeb3Quest(prev => ({ ...prev, cit: true }));
        playSound('collect', 600, 0.3);
        await refreshBlockchainState();
        setModalContent(`✅ Exchanged ${goldAmount} gold for ${citAmount} CIT!\nTX: ${tx.hash}\n\n🔗 View: https://testnet.snowtrace.io/tx/${tx.hash}`);
      } else {
        setModalContent('❌ Exchange transaction failed on-chain.');
      }
      setShowModal(true);
      setTimeout(() => setShowModal(false), 6000);
    } catch (error) {
      setModalContent(`Exchange failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    } finally {
      setBlockchainLoading('');
    }
  };

  // ── Mint Achievement NFT (triggered by game milestones) ──
  const mintAchievementNFT = async (reason) => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Connect wallet to mint your achievement NFT!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }
    try {
      setBlockchainLoading('Minting achievement NFT...');
      setModalContent(`🎨 Minting Achievement NFT\nReason: ${reason}\nPlease confirm in MetaMask...`);
      setShowModal(true);
      const tx = await contractService.mintNFT();
      setModalContent(`⏳ TX sent: ${tx.hash.slice(0,10)}...\nWaiting for confirmation...`);
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        pushTx(tx.hash, 'Achievement NFT', reason);
        setWeb3Quest(prev => ({ ...prev, nft: true }));
        playSound('mint', 500, 0.3);
        await refreshBlockchainState();
        setModalContent(`✅ Achievement NFT Minted!\n🏆 ${reason}\nTX: ${tx.hash}\n\n🔗 View: https://testnet.snowtrace.io/tx/${tx.hash}`);
      } else {
        setModalContent('❌ NFT minting failed on-chain.');
      }
      setShowModal(true);
      setTimeout(() => setShowModal(false), 6000);
    } catch (error) {
      setModalContent(`NFT mint failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    } finally {
      setBlockchainLoading('');
    }
  };

  // ── Notify player of milestone when threshold crossed ──
  const checkGameMilestones = (kills, gold, treasures) => {
    // NFT milestone every KILL_REWARD_THRESHOLD kills
    if (kills > 0 && kills % KILL_REWARD_THRESHOLD === 0) {
      setModalContent(`🏆 Milestone: ${kills} enemies defeated!\nPress the ⛓ Web3 panel to mint your Achievement NFT!`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 5000);
    }
    // Gold exchange reminder every 100 gold
    if (gold > 0 && gold % 100 === 0 && gold >= EXCHANGE_RATE) {
      setModalContent(`💰 You have ${gold} gold!\nExchange it for CIT tokens in the ⛓ Web3 panel!`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    }
  };

  // Enhanced NFT minting functionality using contract service
  const mintNFT = async () => {
    if (!isConnected || !contractService.isInitialized()) {
      setModalContent('Please connect your wallet first!');
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
      return;
    }
    
    try {
      const address = await contractService.getCurrentAddress();
      
      // Get current balance using contract service
      const balance = await contractService.getAccountBalance(address);
      const balanceInAVAX = parseFloat(balance);
      
      if (balanceInAVAX < 0.0005) {
        setModalContent('Insufficient AVAX balance! You need at least 0.0005 AVAX to mint NFT.\n\n💡 Get free testnet AVAX from: https://faucet.avax.network/');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 6000);
        return;
      }
      
      setModalContent('Minting NFT... Please check MetaMask for transaction confirmation.');
      setShowModal(true);
      
      // Mint NFT using contract service
      const tx = await contractService.mintNFT();
      
      setModalContent(`NFT minting transaction sent! TX: ${tx.hash}\nWaiting for confirmation...`);
      setShowModal(true);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        playSound('mint', 500, 0.3);
        setWeb3Quest(prev => ({ ...prev, nft: true }));
        setPlayerStats(prev => ({
          ...prev,
          points: prev.points + 0.005, // Add AVAX points
          avax: prev.avax + 0.005 // Add minted amount to game balance
        }));
        
        // Immediately update real-time stats to reflect changes
        setTimeout(() => {
          updateRealtimeStatsImmediately();
        }, 100); // Small delay to ensure state is updated
        
        // Update leaderboard with AVAX points
        await updateLeaderboard(address, 0.005); // 0.005 AVAX points for minting NFT
        
        pushTx(tx.hash, 'Mint NFT', '1 NFT (0.0005 AVAX)');
        await refreshBlockchainState();
        setModalContent(`✅ NFT Minted!\nTX: ${tx.hash}\n🔗 https://testnet.snowtrace.io/tx/${tx.hash}`);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 5000);
      } else {
        setModalContent('NFT minting transaction failed! Please try again.');
        setShowModal(true);
        setTimeout(() => setShowModal(false), 4000);
      }
      
    } catch (error) {
      console.error('Minting error:', error);
      setModalContent(`Minting failed: ${error.message}`);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 4000);
    }
  };

  useEffect(() => {
    if (canvasRef.current) {
      initGame();
      
      // Focus the canvas for keyboard input
      canvasRef.current.focus();
      
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('click', handleCanvasClick);
      
      // Add canvas-specific click handler for audio context
      const handleCanvasClickForAudio = (e) => {
        if (musicManager.current && musicManager.current.audioContext) {
          musicManager.current.resume();
        }
        canvasRef.current.focus(); // Ensure canvas stays focused
      };
      
      canvasRef.current.addEventListener('click', handleCanvasClickForAudio);
      const onResize = () => {
        const c = canvasRef.current;
        if (!c) return;
        const { width, height } = computeViewportSize();
        c.width = width;
        c.height = height;
      };
      window.addEventListener('resize', onResize);
      onResize();
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('click', handleCanvasClick);
        window.removeEventListener('resize', onResize);
        if (canvasRef.current) {
          canvasRef.current.removeEventListener('click', handleCanvasClickForAudio);
        }
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, []);

  useEffect(() => {
    const flushProgress = () => savePlayerProgress(true);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushProgress();
    };
    window.addEventListener('beforeunload', flushProgress);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flushProgress);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Auto-update real-time stats when player stats change
  useEffect(() => {
    updateRealtimeStatsImmediately();
  }, [playerStats.energy, playerStats.streak, playerStats.avax]);

  // Real-time points calculation and balance updates
  useEffect(() => {
    const interval = setInterval(() => {
      calculateRealtimePoints();
      
      if (isConnected) {
        updateRealTimeBalance();
        // Sync leaderboard every 10 seconds
        if (Date.now() % 10000 < 1000) {
          syncLeaderboardWithBlockchain();
        }
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isConnected, realtimeStats.lastUpdate, playerStats.avax, playerStats.streak, playerStats.energy]);

  // Handle MetaMask account changes and disconnections
  useEffect(() => {
    const provider = blockchainManager.current?.ethereumProvider || window.ethereum;
    if (provider && typeof provider.on === 'function') {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          // User disconnected
          setIsConnected(false);
          setModalContent('Wallet disconnected. Please reconnect to continue.');
          setShowModal(true);
          setTimeout(() => setShowModal(false), 3000);
        } else {
          // User switched accounts
          setIsConnected(true);
          updateRealTimeBalance();
        }
      };

      const handleChainChanged = (chainId) => {
        const ok = chainId === '0xA869';
        if (!ok) {
          setModalContent('Please switch to Avalanche Fuji Testnet (43113).');
          setShowModal(true);
          setTimeout(() => setShowModal(false), 5000);
        }
      };

      // Add event listeners
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged', handleChainChanged);

      // Cleanup
      return () => {
        if (typeof provider.removeListener === 'function') {
          provider.removeListener('accountsChanged', handleAccountsChanged);
          provider.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  const currentLevel = pointSystem.current?.getLevel?.() || 1;
  const currentExp = gamePoints?.experience || 0;
  const expBaseCurrentLevel = Math.max(0, (currentLevel - 1) * 1000);
  const expNextLevelTotal = currentLevel * 1000;
  const expIntoCurrentLevel = Math.max(0, currentExp - expBaseCurrentLevel);
  const expNeededThisLevel = Math.max(1, expNextLevelTotal - expBaseCurrentLevel);
  const levelProgressPercent = Math.min(100, Math.max(0, (expIntoCurrentLevel / expNeededThisLevel) * 100));

  const activeArea = gameMap.areas[gameMap.currentArea];
  const worldWidthPx = Math.max(1, (activeArea?.width || gameMap.width) * 8);
  const worldHeightPx = Math.max(1, (activeArea?.height || gameMap.height) * 8);

  return (
    <div className="app">
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />
      <div className="bg-noise" aria-hidden="true" />
      
      <div className="game-container">
        <canvas
          ref={canvasRef}
          width={computeViewportSize().width}
          height={computeViewportSize().height}
          className="game-canvas"
          tabIndex="0"
          style={{ outline: 'none' }}
        />
      </div>
      
      {hint && !dialogueData && !showPrologue && (gameState === 'playing' || gameState === 'paused') && (
        <div className="hint-bubble">{hint}</div>
      )}
      
      {/* ── Title screen click-capture (invisible, full-screen) ── */}
      {gameState === 'title' && (
        <div onClick={() => handleScreenAction('startGame')} role="button" aria-label="Start Game"
          style={{position:'fixed',inset:0,zIndex:1001,cursor:'pointer'}} />
      )}
      
      {/* ── Prologue / Cutscene Overlay ── */}
      {showPrologue && dialogueData && (
        <div className="cutscene-overlay" onClick={() => { const still = dialogueManager.current.advance(); setDialogueData(still ? dialogueManager.current.getCurrent() : null); }}>
          <div className="cutscene-bg" style={{
            background: dialogueData.bg === 'red'
              ? 'radial-gradient(ellipse at center, rgba(120,10,10,0.9), rgba(10,0,0,0.95))'
              : dialogueData.bg === 'gold'
              ? 'radial-gradient(ellipse at center, rgba(80,60,10,0.9), rgba(10,5,0,0.95))'
              : 'radial-gradient(ellipse at center, rgba(15,15,30,0.92), rgba(5,5,10,0.98))'
          }} />
          <div className="dialogue-box cutscene-dialogue">
            {dialogueData.speaker && <div className="dialogue-speaker">{dialogueData.speaker}</div>}
            <div className="dialogue-text">{dialogueData.text}</div>
            <div className="dialogue-continue">{dialogueData.showContinue ? 'Click or press ENTER to continue...' : ''}</div>
            <div className="dialogue-progress">{dialogueData.progress}</div>
          </div>
        </div>
      )}

      {/* ── In-game NPC Dialogue Box ── */}
      {!showPrologue && dialogueData && (gameState === 'playing' || gameState === 'paused') && (
        <div className="dialogue-box ingame-dialogue" onClick={() => { const still = dialogueManager.current.advance(); setDialogueData(still ? dialogueManager.current.getCurrent() : null); }}>
          {dialogueData.speaker && <div className="dialogue-speaker">{dialogueData.speaker}</div>}
          <div className="dialogue-text">{dialogueData.text}</div>
          <div className="dialogue-continue">{dialogueData.showContinue ? 'Click or ENTER...' : ''}</div>
        </div>
      )}

      {/* ── Tutorial Tip ── */}
      {tutorialStep && (gameState === 'playing') && !dialogueData && (
        <div className="tutorial-banner">
          <span className="tutorial-icon">TIP</span>
          <span className="tutorial-text">{tutorialStep.text}</span>
        </div>
      )}

      {/* Game ready indicator */}
      {gameState === 'playing' && (
        <div className="status-chip status-playing">
          Game Active
        </div>
      )}
      
      {/* Pause overlay */}
      {gameState === 'paused' && (
        <div className="pause-overlay">
          <div className="pause-box">
            <div className="pause-title">PAUSED</div>
            <button className="pause-btn pause-btn-resume" onClick={() => { setScreenState('playing'); }}>▶ Resume</button>
            <button className="pause-btn pause-btn-restart" onClick={() => { setScreenState('playing'); resetGame(); }}>↻ Restart</button>
            <button className="pause-btn pause-btn-save" onClick={() => { savePlayerProgress(true); setShowModal(true); setModalContent('Progress saved!'); setTimeout(() => setShowModal(false), 1500); }}>💾 Save Game</button>
            <button className="pause-btn pause-btn-exit" onClick={() => { savePlayerProgress(true); setScreenState('title'); screenManager.current.currentScreen = 'title'; musicManager.current.playTrack('title'); }}>🚪 Save & Exit to Menu</button>
            <div className="pause-hint">ESC to resume • Q to quit • R to restart</div>
          </div>
        </div>
      )}
      
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <p>{modalContent}</p>
          </div>
        </div>
      )}
      
      {/* Achievement Popup */}
      {showAchievement && (
        <div className="achievement-popup">
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>🏆 Achievement Unlocked!</div>
          <div style={{ fontSize: '14px', marginTop: '5px' }}>{showAchievement.title}</div>
          <div style={{ fontSize: '12px', marginTop: '3px', opacity: 0.8 }}>{showAchievement.description}</div>
        </div>
      )}
      
      {/* ── Compact HUD Panel ── */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <div className="hud-panel">
          <div className="hud-title">Devil's World</div>

          {gamePoints && (
            <>
              <div className="hud-level-row">
                <span className="hud-level-badge">Lv {currentLevel}</span>
                <div className="level-bar-wrap" style={{flex:1}}>
                  <div className="level-bar-fill" style={{ width: `${levelProgressPercent}%` }} />
                </div>
                <span className="hud-level-pct">{levelProgressPercent.toFixed(0)}%</span>
              </div>

              <div className="hud-stats-grid">
                <span>XP {gamePoints.experience}</span>
                <span>Gold {gamePoints.gold}</span>
                <span>Crystals {gamePoints.crystals}</span>
                <span>Mats {gamePoints.materials || 0}</span>
              </div>
            </>
          )}

          <div className="hud-row-compact">
            <span>{timeOfDay} {isNight ? '🌙' : '☀️'}</span>
            {walletConnected ? (
              <span className="hud-wallet-tag" onClick={disconnectWallet} title="Click to disconnect">
                {walletAddress.substring(0, 6)}...
              </span>
            ) : (
              <button onClick={connectWallet} className="hud-btn hud-btn-primary" style={{fontSize:10, padding:'3px 8px'}}>
                Connect Wallet
              </button>
            )}
          </div>

          <div className="hud-actions">
            <button onClick={() => setShowInventory(prev => !prev)} className="hud-action-btn" title="Inventory (I)">I</button>
            <button onClick={() => setShowBuildMenu(prev => !prev)} className="hud-action-btn" title="Build (B)">B</button>
            <button onClick={() => setShowWorldMap(prev => !prev)} className="hud-action-btn" title="World Map (N)">N</button>
            <button onClick={() => setShowWeb3Panel(prev => !prev)} className="hud-action-btn" title="Web3 Actions" style={{background: walletConnected ? '#22c55e33' : '#ef444433', color: walletConnected ? '#4ade80' : '#f87171'}}>⛓</button>
            <button onClick={() => { savePlayerProgress(true); setScreenState('paused'); }} className="hud-action-btn" title="Save & Pause" style={{background:'rgba(245,158,11,0.2)', color:'#fbbf24'}}>⏸</button>
          </div>

          {/* Network Status */}
          {walletConnected && (
            <div style={{display:'flex', alignItems:'center', gap:4, padding:'2px 6px', fontSize:9, color:'#86efac', background:'rgba(34,197,94,0.12)', borderRadius:4, marginTop:4}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#22c55e',display:'inline-block'}}></span>
              Avalanche Fuji • {walletAddress.substring(0,6)}...{walletAddress.slice(-4)}
            </div>
          )}
        </div>
      )}

      {/* ── Web3 Blockchain Action Panel ── */}
      {(gameState === 'playing' || gameState === 'paused') && showWeb3Panel && (
        <div className="overlay-panel web3-panel" style={{right:10,left:'auto',top:60,width:310,maxHeight:'calc(100vh - 80px)',overflowY:'auto',background:'rgba(10,10,20,0.95)',border:'1px solid rgba(139,92,246,0.3)',borderRadius:10,backdropFilter:'blur(12px)'}}>
          <div className="panel-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:'bold',color:'#e2e8f0',letterSpacing:0.5}}>⛓ Blockchain Hub</h3>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              {blockchainLoading && <span style={{fontSize:9,color:'#fbbf24',animation:'pulse 1s infinite'}}>⏳ {blockchainLoading}</span>}
              <button onClick={() => setShowWeb3Panel(false)} style={{background:'none',border:'none',color:'#94a3b8',fontSize:16,cursor:'pointer',padding:0,lineHeight:1}}>✕</button>
            </div>
          </div>

          {!walletConnected ? (
            <div style={{padding:16,textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:8}}>🦊</div>
              <p style={{color:'#94a3b8',fontSize:12,marginBottom:12}}>Connect MetaMask to interact with Avalanche Fuji Testnet</p>
              <button onClick={connectWallet} style={{background:'linear-gradient(135deg,#e44d26,#f97316)',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontSize:13,fontWeight:'bold',cursor:'pointer',width:'100%',boxShadow:'0 2px 12px rgba(249,115,22,0.3)'}}>Connect Wallet</button>
              <p style={{color:'#64748b',fontSize:9,marginTop:8}}>Avalanche Fuji Testnet • Chain ID 43113</p>
            </div>
          ) : (
            <div style={{padding:8,display:'flex',flexDirection:'column',gap:6}}>

              {/* ── Wallet & Balances ── */}
              <div style={{background:'linear-gradient(135deg,rgba(139,92,246,0.12),rgba(59,130,246,0.08))',borderRadius:8,padding:10,border:'1px solid rgba(139,92,246,0.2)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:9,color:'#a78bfa',textTransform:'uppercase',letterSpacing:1,fontWeight:'bold'}}>Wallet</span>
                  <span style={{fontSize:9,color:'#86efac',background:'rgba(34,197,94,0.15)',padding:'1px 6px',borderRadius:3}}>● Fuji Testnet</span>
                </div>
                <div style={{fontSize:10,color:'#94a3b8',marginBottom:6,fontFamily:'monospace'}}>{walletAddress}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
                  <div style={{background:'rgba(0,0,0,0.3)',borderRadius:6,padding:'6px 4px',textAlign:'center'}}>
                    <div style={{fontSize:13,fontWeight:'bold',color:'#f0d890'}}>{parseFloat(avaxBalance || 0).toFixed(3)}</div>
                    <div style={{fontSize:8,color:'#94a3b8',marginTop:1}}>AVAX</div>
                  </div>
                  <div style={{background:'rgba(0,0,0,0.3)',borderRadius:6,padding:'6px 4px',textAlign:'center'}}>
                    <div style={{fontSize:13,fontWeight:'bold',color:'#fbbf24'}}>{parseFloat(citBalance || 0).toFixed(1)}</div>
                    <div style={{fontSize:8,color:'#94a3b8',marginTop:1}}>CIT</div>
                  </div>
                  <div style={{background:'rgba(0,0,0,0.3)',borderRadius:6,padding:'6px 4px',textAlign:'center'}}>
                    <div style={{fontSize:13,fontWeight:'bold',color:'#c084fc'}}>{nftCount}</div>
                    <div style={{fontSize:8,color:'#94a3b8',marginTop:1}}>NFTs</div>
                  </div>
                </div>
                <button onClick={refreshBlockchainState} style={{width:'100%',marginTop:6,background:'rgba(255,255,255,0.06)',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.08)',borderRadius:4,padding:'3px 0',fontSize:9,cursor:'pointer'}}>↻ Refresh Balances</button>
              </div>

              {/* ── Game Gold → CIT Exchange ── */}
              <div style={{background:'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,88,12,0.08))',borderRadius:8,padding:10,border:'1px solid rgba(245,158,11,0.25)'}}>
                <div style={{fontSize:10,color:'#fbbf24',marginBottom:6,textTransform:'uppercase',letterSpacing:1,fontWeight:'bold'}}>💰 Gold → CIT Exchange</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:11,color:'#e2e8f0'}}>Your Gold: <b style={{color:'#fbbf24'}}>{gameStats.goldCollected}</b></span>
                  <span style={{fontSize:9,color:'#94a3b8'}}>Rate: {EXCHANGE_RATE} gold = 1 CIT</span>
                </div>
                <div style={{display:'flex',gap:4}}>
                  <button disabled={gameStats.goldCollected < EXCHANGE_RATE} onClick={() => exchangeGoldForCIT(EXCHANGE_RATE)} style={{flex:1,background:gameStats.goldCollected >= EXCHANGE_RATE ? '#d97706' : '#44403c',color:'#fff',border:'none',borderRadius:4,padding:'6px 0',fontSize:10,fontWeight:'bold',cursor:gameStats.goldCollected >= EXCHANGE_RATE ? 'pointer' : 'not-allowed',opacity:gameStats.goldCollected >= EXCHANGE_RATE ? 1 : 0.5}}>Exchange {EXCHANGE_RATE}g → 1 CIT</button>
                  <button disabled={gameStats.goldCollected < EXCHANGE_RATE * 5} onClick={() => exchangeGoldForCIT(EXCHANGE_RATE * 5)} style={{flex:1,background:gameStats.goldCollected >= EXCHANGE_RATE * 5 ? '#b45309' : '#44403c',color:'#fff',border:'none',borderRadius:4,padding:'6px 0',fontSize:10,fontWeight:'bold',cursor:gameStats.goldCollected >= EXCHANGE_RATE * 5 ? 'pointer' : 'not-allowed',opacity:gameStats.goldCollected >= EXCHANGE_RATE * 5 ? 1 : 0.5}}>Exchange {EXCHANGE_RATE*5}g → 5 CIT</button>
                </div>
                <div style={{fontSize:8,color:'#a3a3a3',marginTop:4,textAlign:'center'}}>Costs 0.001 AVAX per CIT (on-chain mint)</div>
              </div>

              {/* ── AVAX Staking ── */}
              <div style={{background:'rgba(59,130,246,0.08)',borderRadius:8,padding:10,border:'1px solid rgba(59,130,246,0.2)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:10,color:'#60a5fa',textTransform:'uppercase',letterSpacing:1,fontWeight:'bold'}}>⚡ AVAX Staking</span>
                  {avaxStakerInfo && avaxStakerInfo.isStaking && (() => {
                    const tier = avaxStakerInfo.tier || 'Bronze';
                    const badge = tier === 'Gold' ? '🥇' : tier === 'Silver' ? '🥈' : '🥉';
                    const color = tier === 'Gold' ? '#fbbf24' : tier === 'Silver' ? '#94a3b8' : '#b87333';
                    return <span style={{fontSize:9,color,background:'rgba(0,0,0,0.3)',padding:'2px 6px',borderRadius:4,fontWeight:'bold'}}>{badge} {tier}</span>;
                  })()}
                </div>
                {avaxStakerInfo && avaxStakerInfo.isStaking && (
                  <div style={{background:'rgba(0,0,0,0.25)',borderRadius:4,padding:'6px 8px',marginBottom:6,fontSize:9}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3}}>
                      <div style={{color:'#93c5fd'}}>Staked: <b style={{color:'#e2e8f0'}}>{parseFloat(avaxStakerInfo.stakedAmount||0).toFixed(4)} AVAX</b></div>
                      <div style={{color:'#86efac'}}>APY: <b style={{color:'#4ade80'}}>{avaxStakerInfo.currentAPY || 10}%</b></div>
                      <div style={{color:'#93c5fd'}}>Pending: <b style={{color:'#fde68a'}}>{parseFloat(avaxStakerInfo.pendingRewards||0).toFixed(6)} AVAX</b></div>
                      <div style={{color:'#f9a8d4'}}>Multiplier: <b style={{color:'#fb7185'}}>{((avaxStakerInfo.multiplierBps_||10000)/10000).toFixed(2)}x</b></div>
                    </div>
                  </div>
                )}
                <div style={{display:'flex',gap:4}}>
                  <button onClick={stakeCoins} style={{flex:1,background:'#2563eb',color:'#fff',border:'none',borderRadius:4,padding:'6px 0',fontSize:10,fontWeight:'bold',cursor:'pointer'}}>Stake 0.01</button>
                  <button onClick={unstakeCoins} style={{flex:1,background:'#1e40af',color:'#fff',border:'none',borderRadius:4,padding:'6px 0',fontSize:10,fontWeight:'bold',cursor:'pointer'}}>Unstake</button>
                  <button onClick={claimRewards} style={{flex:1,background:'#16a34a',color:'#fff',border:'none',borderRadius:4,padding:'6px 0',fontSize:10,fontWeight:'bold',cursor:'pointer'}}>Claim</button>
                </div>
                <div style={{fontSize:8,color:'#93c5fd',marginTop:4}}>🥉 Bronze 10% → 🥈 Silver 15% (7d) → 🥇 Gold 20% (30d)</div>
                <div style={{fontSize:7,color:'#64748b',marginTop:2}}>5% of rewards support game development • Score boosts multiplier</div>
              </div>

              {/* ── NFT Achievements ── */}
              <div style={{background:'rgba(168,85,247,0.08)',borderRadius:8,padding:10,border:'1px solid rgba(168,85,247,0.2)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:10,color:'#c084fc',textTransform:'uppercase',letterSpacing:1,fontWeight:'bold'}}>🎨 NFT Achievements</span>
                  <span style={{fontSize:9,color:'#a78bfa'}}>{nftCount} owned</span>
                </div>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={mintNFT} style={{flex:1,background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'#fff',border:'none',borderRadius:4,padding:'6px 0',fontSize:10,fontWeight:'bold',cursor:'pointer'}}>Mint NFT (0.0005)</button>
                  <button onClick={() => mintAchievementNFT(`${gameStats.enemiesKilled} enemies defeated`)} style={{flex:1,background:'linear-gradient(135deg,#6d28d9,#8b5cf6)',color:'#fff',border:'none',borderRadius:4,padding:'6px 0',fontSize:10,fontWeight:'bold',cursor:'pointer'}}>🏆 Achievement</button>
                </div>
                <div style={{fontSize:8,color:'#a78bfa',marginTop:4}}>Achievement NFTs: kill enemies, collect gold, explore!</div>
              </div>

              {/* ── CIT Token ── */}
              <div style={{background:'rgba(245,158,11,0.06)',borderRadius:8,padding:10,border:'1px solid rgba(245,158,11,0.15)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:10,color:'#fbbf24',textTransform:'uppercase',letterSpacing:1,fontWeight:'bold'}}>🪙 CIT Token</span>
                  <span style={{fontSize:9,color:'#fcd34d'}}>{parseFloat(citBalance || 0).toFixed(2)} CIT</span>
                </div>
                {citStakerInfo && citStakerInfo.isStaking && (
                  <div style={{background:'rgba(0,0,0,0.25)',borderRadius:4,padding:4,marginBottom:6,fontSize:9,color:'#94a3b8'}}>
                    Staked: {parseFloat(citStakerInfo.stakedAmount).toFixed(2)} CIT • Pending: {parseFloat(citStakerInfo.pendingRewards).toFixed(4)} CIT
                  </div>
                )}
                <div style={{display:'flex',gap:4,marginBottom:4}}>
                  <button onClick={() => mintCITTokens(10)} style={{flex:1,background:'#d97706',color:'#fff',border:'none',borderRadius:4,padding:'5px 0',fontSize:9,fontWeight:'bold',cursor:'pointer'}}>Mint 10 CIT</button>
                  <button onClick={() => stakeCITTokens(10)} style={{flex:1,background:'#b45309',color:'#fff',border:'none',borderRadius:4,padding:'5px 0',fontSize:9,fontWeight:'bold',cursor:'pointer'}}>Stake 10</button>
                </div>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={claimCITRewards} style={{flex:1,background:'#16a34a',color:'#fff',border:'none',borderRadius:4,padding:'5px 0',fontSize:9,fontWeight:'bold',cursor:'pointer'}}>Claim CIT</button>
                  <button onClick={unstakeCITTokens} style={{flex:1,background:'#991b1b',color:'#fff',border:'none',borderRadius:4,padding:'5px 0',fontSize:9,fontWeight:'bold',cursor:'pointer'}}>Unstake</button>
                </div>
              </div>

              {/* ── Game Stats (on-chain context) ── */}
              <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:10,border:'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{fontSize:10,color:'#94a3b8',marginBottom:6,textTransform:'uppercase',letterSpacing:1,fontWeight:'bold'}}>📊 Game Stats</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:10}}>
                  <div style={{color:'#e2e8f0'}}>⚔️ Kills: <b>{gameStats.enemiesKilled}</b></div>
                  <div style={{color:'#fbbf24'}}>💰 Gold: <b>{gameStats.goldCollected}</b></div>
                  <div style={{color:'#60a5fa'}}>📈 Points/s: <b>{realtimeStats.pointsPerSecond.toFixed(5)}</b></div>
                  <div style={{color:'#4ade80'}}>⚡ Streak: <b>{playerStats.streak}</b></div>
                </div>
              </div>

              {/* ── Transaction History ── */}
              {txHistory.length > 0 && (
                <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:10,border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div style={{fontSize:10,color:'#94a3b8',marginBottom:6,textTransform:'uppercase',letterSpacing:1,fontWeight:'bold'}}>📋 Transaction History</div>
                  <div style={{maxHeight:120,overflowY:'auto'}}>
                    {txHistory.slice(0, 8).map((tx, i) => (
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',fontSize:9}}>
                        <div>
                          <span style={{color:'#e2e8f0',fontWeight:'bold'}}>{tx.type}</span>
                          <span style={{color:'#64748b',marginLeft:4}}>{tx.amount}</span>
                        </div>
                        <a href={`https://testnet.snowtrace.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" style={{color:'#60a5fa',textDecoration:'none',fontFamily:'monospace',fontSize:8}}>{tx.hash.slice(0,8)}… ↗</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Contract Addresses (for judges) ── */}
              <div style={{background:'rgba(255,255,255,0.02)',borderRadius:8,padding:8,border:'1px solid rgba(255,255,255,0.04)'}}>
                <div style={{fontSize:9,color:'#64748b',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Deployed Contracts (Fuji)</div>
                <div style={{fontSize:8,fontFamily:'monospace',color:'#475569',lineHeight:1.6}}>
                  <div>Staking: <a href="https://testnet.snowtrace.io/address/0xC08f6E905C88Ae1252a78f3D6eCAb7CF7d27ac9f" target="_blank" rel="noopener noreferrer" style={{color:'#60a5fa'}}>0xC08f…ac9f</a></div>
                  <div>NFT: <a href="https://testnet.snowtrace.io/address/0xBd852B73011eb7937993b06F43891dD67C31BC10" target="_blank" rel="noopener noreferrer" style={{color:'#60a5fa'}}>0xBd85…BC10</a></div>
                  <div>CIT: <a href="https://testnet.snowtrace.io/address/0xCd5b54dBEa2bF1aE449361F5c35af1E4fbA8aCcC" target="_blank" rel="noopener noreferrer" style={{color:'#60a5fa'}}>0xCd5b…aCcC</a></div>
                </div>
              </div>

              {/* ── Explorer Links ── */}
              <div style={{display:'flex',gap:4,padding:'2px 0'}}>
                <a href={`https://testnet.snowtrace.io/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" style={{flex:1,textAlign:'center',color:'#60a5fa',fontSize:9,textDecoration:'none',background:'rgba(59,130,246,0.08)',borderRadius:4,padding:'4px 0'}}>My Wallet ↗</a>
                <a href="https://faucet.avax.network/" target="_blank" rel="noopener noreferrer" style={{flex:1,textAlign:'center',color:'#f97316',fontSize:9,textDecoration:'none',background:'rgba(249,115,22,0.08)',borderRadius:4,padding:'4px 0'}}>Get Test AVAX ↗</a>
              </div>
            </div>
          )}
        </div>
      )}

      {(gameState === 'playing' || gameState === 'paused') && showWorldMap && (
        <div className="overlay-panel worldmap-panel">
          <div className="panel-header">
            <h3 className="panel-title">World Map</h3>
            <button onClick={() => setShowWorldMap(false)} className="panel-close">✕</button>
          </div>
          <div className="worldmap-stage">
            <canvas
              ref={(cvs) => {
                if (!cvs) return;
                const wctx = cvs.getContext('2d');
                const mw = motherWorldRef.current;
                const mapTiles = mw?.tiles;
                if (!mapTiles || !mapTiles.length) return;
                const mapH = mapTiles.length;
                const mapW = mapTiles[0]?.length || 0;
                const cw = cvs.width;
                const ch = cvs.height;
                const scaleX = cw / mapW;
                const scaleY = ch / mapH;
                // Tile colors
                const tileColors = {
                  0: '#000', 1: '#8b5e3b', 2: '#e8c27a', 3: '#3a8e41',
                  5: '#6b6b6b', 6: '#0f2a4d', 7: '#2f74c0', 25: '#8a7f70',
                  26: '#2b80ff', 27: '#1f6b2a', 28: '#a56b2b'
                };
                // Draw terrain
                for (let r = 0; r < mapH; r++) {
                  for (let c = 0; c < mapW; c++) {
                    const t = mapTiles[r][c] || 0;
                    wctx.fillStyle = tileColors[t] || '#222';
                    wctx.fillRect(c * scaleX, r * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
                  }
                }
                // Draw treasures
                const area = gameMap.areas[gameMap.currentArea];
                (area?.treasures || []).forEach(tr => {
                  if (!tr.collected) {
                    const tx = (tr.x / 8) * scaleX;
                    const ty = (tr.y / 8) * scaleY;
                    wctx.fillStyle = '#fbbf24';
                    wctx.fillRect(tx - 3, ty - 3, 6, 6);
                    wctx.strokeStyle = '#000';
                    wctx.lineWidth = 0.5;
                    wctx.strokeRect(tx - 3, ty - 3, 6, 6);
                  }
                });
                // Draw NPCs/villages
                (area?.npcs || []).forEach(npc => {
                  const nx = (npc.x / 8) * scaleX;
                  const ny = (npc.y / 8) * scaleY;
                  wctx.fillStyle = '#fff';
                  wctx.fillRect(nx - 2, ny - 2, 4, 4);
                });
                // Draw player
                const pl = gameWorldState.current.player;
                const px = (pl.x / 8) * scaleX;
                const py = (pl.y / 8) * scaleY;
                wctx.fillStyle = '#ff3333';
                wctx.beginPath();
                wctx.arc(px, py, 4, 0, Math.PI * 2);
                wctx.fill();
                wctx.strokeStyle = '#fff';
                wctx.lineWidth = 1.5;
                wctx.stroke();
              }}
              width={480}
              height={360}
              style={{ width: '100%', borderRadius: '6px', imageRendering: 'pixelated', cursor: 'pointer' }}
              onClick={(e) => {
                const cvs = e.target;
                const rect = cvs.getBoundingClientRect();
                const clickX = (e.clientX - rect.left) / rect.width;
                const clickY = (e.clientY - rect.top) / rect.height;
                const mw = motherWorldRef.current;
                if (!mw?.tiles?.length) return;
                const mapW = mw.tiles[0].length;
                const mapH = mw.tiles.length;
                const destX = clickX * mapW * 8;
                const destY = clickY * mapH * 8;
                const player = gameWorldState.current.player;
                const camera = gameWorldState.current.camera;
                const viewport = computeViewportSize();
                const zoomScale = gameWorldState.current.zoomScale || 1.5;
                const vw = viewport.width / zoomScale;
                const vh = viewport.height / zoomScale;
                const wPx = mapW * 8;
                const hPx = mapH * 8;
                player.x = clamp(destX, 16, Math.max(16, wPx - 48));
                player.y = clamp(destY, 40, Math.max(40, hPx - 48));
                camera.x = clamp(player.x - vw / 2, 0, Math.max(0, wPx - vw));
                camera.y = clamp(player.y - vh / 2, 0, Math.max(0, hPx - vh));
                setShowWorldMap(false);
                if (canvasRef.current) canvasRef.current.focus();
              }}
            />
          </div>
          <div className="worldmap-help">Click map to teleport. Gold = Treasure, White = Village, Red = You</div>
        </div>
      )}
      
      {/* Inventory UI - Only show during active gameplay */}
      {gameState === 'playing' && showInventory && inventorySystem.current && (
        <div className="overlay-panel inventory-panel">
          <div className="panel-header">
            <h3 className="panel-title">Inventory</h3>
            <button onClick={() => setShowInventory(false)} className="panel-close">✕</button>
          </div>
          
          {Object.entries(inventorySystem.current.inventory).map(([category, items]) => (
            <div key={category} className="panel-block">
              <h4 className="panel-category">
                {category} ({items.length}/{inventorySystem.current.maxSlots[category]})
              </h4>
              <div className="item-grid">
                {items.map((item, index) => (
                  <div key={index} className={`item-card rarity-${item.rarity || 'common'}`}>
                    <div className="item-name">{item.name}</div>
                    {item.quantity > 1 && <div className="item-qty">x{item.quantity}</div>}
                    <div className="item-value">{item.value}g</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="panel-footer">
            Total Items: {inventorySystem.current.getTotalItems()}
          </div>
        </div>
      )}
      
      {/* Building Menu - Only show during active gameplay */}
      {gameState === 'playing' && showBuildMenu && infrastructureSystem.current && (
        <div className="overlay-panel build-panel">
          <div className="panel-header">
            <h3 className="panel-title">Build</h3>
            <button onClick={() => setShowBuildMenu(false)} className="panel-close">✕</button>
          </div>
          
          {Object.entries(infrastructureSystem.current.buildingTypes).map(([type, building]) => {
            const canAfford = infrastructureSystem.current.canAfford(type);
            return (
              <div key={type} className={`build-card ${canAfford.canAfford ? 'build-ok' : 'build-locked'}`}>
                <div className="build-name">{building.name}</div>
                <div className="build-desc">{building.description}</div>
                <div className="build-meta">
                  Cost: {Object.entries(building.cost).map(([resource, amount]) => 
                    `${amount} ${resource}`
                  ).join(', ')}
                </div>
                <div className="build-meta">
                  Build Time: {Math.floor(building.buildTime / 1000)}s
                </div>
                <button 
                  onClick={() => {
                    if (canAfford.canAfford) {
                      setSelectedBuildingType(type);
                      setBuildingMode(true);
                      setShowBuildMenu(false);
                    }
                  }}
                  disabled={!canAfford.canAfford}
                  className={`build-select ${canAfford.canAfford ? 'build-select-ok' : 'build-select-off'}`}
                >
                  {canAfford.canAfford ? 'Select' : `Need ${canAfford.missing}`}
                </button>
              </div>
            );
          })}
          
          <div className="panel-footer">
            Buildings: {infrastructureSystem.current.buildings.length}
          </div>
        </div>
      )}
      
      {/* Building Mode Indicator - Only show during active gameplay */}
      {gameState === 'playing' && buildingMode && selectedBuildingType && (
        <div className="build-indicator">
          Click to place {infrastructureSystem.current.buildingTypes[selectedBuildingType].name} | ESC to cancel
        </div>
      )}
    </div>
  );
}

export default App;
