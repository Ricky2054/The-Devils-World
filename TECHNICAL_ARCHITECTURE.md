# Devil World — Technical Architecture Walkthrough
### For Team1 Mini-Grants Interview

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18 + Canvas)                │
│                         Deployed on Vercel                         │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  App.js      │  │  GameScreens │  │  Components              │  │
│  │  (~5600 LOC) │  │  (.js)       │  │  GameCanvas, GameHeader  │  │
│  │  Core game   │  │  Menus/HUD   │  │  LoadingScreen, Modals   │  │
│  │  loop + RAF  │  │  Leaderboard │  │  SidePanel               │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                 │                      │                  │
│         ▼                 ▼                      ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              CONTRACT SERVICE (contractService.js)          │   │
│  │  • Singleton pattern                                        │   │
│  │  • ethers v6 BrowserProvider + JsonRpcProvider              │   │
│  │  • All contract read/write operations                       │   │
│  │  • Fallback to public RPC for read-only (no wallet needed)  │   │
│  └────────────────────────────┬────────────────────────────────┘   │
│                               │                                    │
└───────────────────────────────┼────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    MetaMask Wallet    │
                    │   (ethers v6 Signer) │
                    └───────────┬───────────┘
                                │
          ┌─────────────────────▼─────────────────────┐
          │        AVALANCHE FUJI C-CHAIN (43113)      │
          │                                            │
          │  ┌────────────────┐  ┌──────────────────┐  │
          │  │  AVAXStaking   │  │ CryptoIslandNFT  │  │
          │  │  0xC08f...ac9f │  │ 0xBd85...BC10    │  │
          │  │                │  │                   │  │
          │  │ • Tiered APY   │  │ • ERC-721         │  │
          │  │ • Treasury fee │  │ • Achievement mint│  │
          │  │ • Multiplier   │  │ • Rarity system   │  │
          │  └────────────────┘  └──────────────────┘  │
          │                                            │
          │  ┌────────────────┐  ┌──────────────────┐  │
          │  │ CryptoIsland   │  │ DevilWorld       │  │
          │  │ Token (CIT)    │  │ Leaderboard      │  │
          │  │ 0xCd5b...aCcC  │  │ 0x0b8c...2155    │  │
          │  │                │  │                   │  │
          │  │ • ERC-20       │  │ • submitScore()   │  │
          │  │ • 10M max      │  │ • getAllScores()   │  │
          │  │ • Game rewards │  │ • Per-wallet best  │  │
          │  └────────────────┘  └──────────────────┘  │
          └────────────────────────────────────────────┘
```

---

## 2. Game Engine Architecture

### Core Loop (requestAnimationFrame)

```javascript
// App.js — ~5600 lines, single-file game engine pattern

const gameLoop = useCallback(() => {
    // 1. Read input state (keyboard/touch)
    // 2. Update physics (player movement, collision detection)
    // 3. Update game world (enemies, NPCs, treasures, particles)
    // 4. Handle combat (attack hitboxes, damage, enemy AI)
    // 5. Render everything to canvas
    // 6. Update HUD (health bar, gold, XP, level, streaks)
    // 7. requestAnimationFrame(gameLoop)  ← 60fps target
}, []);
```

### State Management Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    STATE ARCHITECTURE                         │
│                                                              │
│  React State (useState)         Mutable Refs (useRef)        │
│  ─────────────────────         ──────────────────────        │
│  • UI components               • gameWorldState              │
│  • Modal visibility            • keysRef (keyboard input)     │
│  • Wallet connection           • pendingRewardRef (kills/gold)│
│  • gameStats (displayed)       • blockchainScoresRef          │
│  • Screen state                • gameLoopRef (RAF handle)     │
│                                • gameStateRef (synced mirror) │
│                                                              │
│  WHY: React useState causes re-renders.                      │
│  RAF at 60fps can't trigger re-renders per frame.            │
│  Refs provide O(1) reads without render cycles.              │
│  gameStateRef mirrors React state for RAF access.            │
└──────────────────────────────────────────────────────────────┘
```

### Key Pattern: pendingRewardRef

```javascript
// Problem: RAF callback captures stale React state (closure trap)
// Solution: Track mutable data in refs, flush to React state on game events

const pendingRewardRef = useRef({ kills: 0, gold: 0, xp: 0 });

// Inside RAF (60fps):
pendingRewardRef.current.kills += 1;  // Always current

// On game over:
const stats = pendingRewardRef.current;  // Read latest values
triggerGameOver(stats.kills, stats.gold); // Pass to React world
```

---

## 3. Smart Contract Architecture

### 3.1 AVAXStaking.sol (Solidity 0.8.19)

```
Purpose: Lock AVAX to earn yield + in-game score multiplier

Tiered APY System:
├── Bronze: 0-6 days staked    → 10% APY
├── Silver: 7-29 days staked   → 15% APY
└── Gold:   30+ days staked    → 20% APY

Treasury Fee: 5% on all rewards
Score Multiplier: Up to 2× based on stake duration

Security:
├── ReentrancyGuard (OpenZeppelin)
├── Ownable (access control)
├── Pausable (emergency stop)
└── receive() for AVAX deposits
```

### 3.2 CryptoIslandNFT.sol (ERC-721)

```
Purpose: Permanent on-chain achievements

Mint Price: 0.0005 AVAX
Max Supply: 10,000 NFTs
Treasury Fee: 5% on every mint

Features:
├── Rarity system (Common → Legendary)
├── Score + kills + gold stored in metadata
├── Player stats written at mint time
└── Achievement gateway to leaderboard submission
```

### 3.3 CryptoIslandToken.sol (ERC-20 "CIT")

```
Purpose: In-game currency with DeFi properties

Supply: 1,000,000 initial / 10,000,000 maximum
Mint Price: 0.001 AVAX per CIT
Staking: Same tiered APY as AVAX staking

Game Integration:
├── Earned through gameplay milestones
├── Stakeable for yield
├── Future: Marketplace currency for NFT trading
└── Future: Governance token for seasonal events
```

### 3.4 DevilWorldLeaderboard.sol (Custom)

```
Purpose: Verifiable global highscore system

Data Structure:
struct PlayerScore {
    address player;     // wallet address
    uint256 score;      // final game score
    uint256 kills;      // total enemies killed
    uint256 gold;       // gold collected
    uint256 level;      // level reached
    uint256 timestamp;  // block.timestamp
}

Functions:
├── submitScore(score, kills, gold, level)  → write (requires tx)
├── getAllScores()                           → read (free, public RPC)
├── getScoresPage(offset, limit)            → paginated read
└── playerScores[address]                   → per-wallet best score

Key Design Decision:
  Stores BEST score per wallet (updates only if new score > old score)
  Readable via public Avalanche RPC — no wallet needed to VIEW
  Only wallet-connected players appear (no anonymous entries)
```

---

## 4. Data Flow: Gameplay → Blockchain

### Flow 1: Playing the Game (No Blockchain Required)

```
Player Input → Canvas Render → Enemy AI → Combat → Gold/XP Updates
     ↓              ↓              ↓          ↓           ↓
  keysRef    requestAnimationFrame  gameWorldState   pendingRewardRef
                                                          │
                                                    ┌─────▼──────┐
                                                    │ Local State │
                                                    │ (in memory) │
                                                    └────────────┘
```

### Flow 2: NFT Mint + On-Chain Score (Blockchain Integration)

```
Player clicks "Mint Achievement NFT"
     │
     ▼
contractService.mintNFT()
     │
     ├── Calls CryptoIslandNFT.mint() → 0.0005 AVAX
     │   └── Returns tokenId
     │
     └── Then calls contractService.submitScore(score, kills, gold, level)
         │
         └── Calls DevilWorldLeaderboard.submitScore()
             └── Stores stats on-chain (if new best)
```

### Flow 3: Reading Leaderboard (Public RPC, No Wallet)

```
Player opens Scoreboard screen
     │
     ▼
contractService.getAllScores()
     │
     ├── Uses JsonRpcProvider (public Fuji RPC)
     │   └── No MetaMask needed!
     │
     └── Returns PlayerScore[] array
         │
         ▼
     blockchainScoresRef.current = scores
         │
         ▼
     GameScreens.drawScoreboard() renders ranked list
         └── Shows: Rank, Wallet (truncated), Score, Kills, Gold, Level
```

---

## 5. Wallet Integration Flow

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│ User clicks  │────▶│ Check if     │────▶│ Request accounts  │
│ "Connect"   │     │ MetaMask     │ yes │ ethereum.request() │
└─────────────┘     │ installed?   │     └────────┬──────────┘
                    └──────┬───────┘              │
                      no   │                      ▼
                           ▼              ┌───────────────────┐
                    ┌──────────────┐      │ Check chainId     │
                    │ Show install │      │ === 43113 (Fuji)? │
                    │ prompt       │      └────────┬──────────┘
                    └──────────────┘           no   │  yes
                                                   │   │
                                          ┌────────▼┐  │
                                          │ Auto-add│  │
                                          │ Fuji    │  │
                                          │ network │  │
                                          └────┬────┘  │
                                               │       │
                                               ▼       ▼
                                        ┌─────────────────┐
                                        │ Initialize all   │
                                        │ 4 contracts with │
                                        │ signer           │
                                        └─────────────────┘
```

---

## 6. Security Model

| Layer | Protection | Implementation |
|-------|-----------|----------------|
| **Smart Contract** | ReentrancyGuard | OpenZeppelin on all state-changing functions |
| **Smart Contract** | Pausable | Owner can pause contracts in emergency |
| **Smart Contract** | Access Control | Ownable — only deployer can admin |
| **Smart Contract** | Supply Caps | NFT: 10K max, CIT: 10M max supply |
| **Smart Contract** | Treasury Fees | 5% on staking rewards + NFT mints |
| **Frontend** | Input Validation | All contract calls wrapped in try/catch |
| **Frontend** | Network Enforcement | Auto-switch to Fuji if wrong network |
| **Game State** | Anti-cheat (basic) | Server-side validation planned for mainnet |
| **Leaderboard** | Best-score-only | Can't inflate by submitting many times |

---

## 7. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Game Engine** | HTML5 Canvas + RequestAnimationFrame | Custom |
| **Frontend Framework** | React | 18.x |
| **Blockchain Library** | ethers.js | v6 |
| **Smart Contracts** | Solidity | 0.8.19/0.8.23 |
| **Contract Standards** | OpenZeppelin | ERC-20, ERC-721 |
| **Build Tool** | Hardhat | 3.x |
| **Network** | Avalanche Fuji C-Chain | Chain 43113 |
| **Hosting** | Vercel | Production |
| **Source Control** | GitHub | Public repo |
| **Wallet** | MetaMask | Browser ext |

---

## 8. Performance Considerations

| Consideration | Current Approach | Mainnet Plan |
|---------------|-----------------|-------------|
| **60fps game loop** | Canvas + RAF, no React re-renders in loop | Same |
| **Blockchain reads** | Public RPC fallback, no wallet needed | Dedicated RPC node |
| **Transaction frequency** | Only on mint/stake/claim (not per frame) | Same — batch if needed |
| **Gas costs** | Fuji testnet (free faucet AVAX) | Optimize calldata, consider L1 |
| **Asset loading** | Sprite sheets, pre-loaded at start | CDN + lazy loading |
| **State sync** | useRef for RAF, useState for UI only | Same architecture |

---

## 9. Scaling Path: C-Chain → Avalanche L1

```
CURRENT STATE:                    FUTURE STATE:
C-Chain (shared)                  Custom Avalanche L1
├── 4 contracts                   ├── All contracts migrated
├── Shared block space            ├── Dedicated validators
├── ~2s finality                  ├── Sub-second finality
└── Standard gas pricing          ├── Custom gas token (CIT?)
                                  ├── Tournament-grade throughput
                                  └── Cross-chain bridge to C-Chain

Trigger: When concurrent players exceed C-Chain comfort zone
         or tournament events require guaranteed block times.
```

---

*Document prepared for Team1 Mini-Grants Technical Architecture Review*
*All contracts verifiable on [Snowtrace Fuji Explorer](https://testnet.snowtrace.io)*
