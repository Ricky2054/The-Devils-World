# Devil_World x Avalanche Mini-Grant Master Plan (Fuji-First MVP)

## 1) Objective
Build a **stable, interview-ready MVP** on **Avalanche Fuji C-Chain** that demonstrates:
- Real on-chain game loops (stake, claim, mint NFT, mint/stake CIT)
- Playable and polished 2D action-adventure experience
- Clear roadmap from Fuji MVP to production launch and optional Avalanche L1 scaling phase

## 2) Hard Constraints (Now Enforced)
- Chain: **Avalanche Fuji C-Chain** only
- Chain ID: **43113 (0xA869)**
- RPC: `https://api.avax-test.network/ext/bc/C/rpc`
- Explorer: `https://testnet.snowtrace.io`

## 3) Current MVP Scope (Shippable)
### Gameplay
- Real-time action gameplay with movement/combat/season + day-night systems
- Inventory and infrastructure building
- Achievement + points progression
- Music and SFX systems

### Blockchain (live demo path)
- Wallet connect on Fuji
- AVAX stake / claim / unstake
- NFT mint
- ERC-20 CIT mint / stake / claim / unstake
- HUD-integrated Web3 quest progression for live walkthrough

## 4) Grant Interview Narrative (What to emphasize)
### Problem
Most Web3 games are either:
- blockchain-first but low gameplay quality, or
- gameplay-first with weak on-chain utility.

### Solution
Devil_World combines real gameplay systems with direct, visible on-chain progression loops on Avalanche Fuji.

### Why Avalanche
- EVM compatibility (fast implementation with Solidity + ethers)
- Low-fee testnet iteration for rapid game tuning
- Clean path to scale: Primary Network launch first, then Avalanche L1 if throughput/custom rules are needed

## 5) Architecture to Present
- **Frontend:** React canvas game loop + HUD + modal UX
- **Game systems:** combat, seasons, energy, inventory, infrastructure, screen manager
- **Blockchain service layer:** wallet + contract abstraction (`contractService`)
- **Contracts:**
  - AVAX staking (`AVAXStaking.sol`)
  - NFT minting (`CryptoIslandNFT.sol`)
  - ERC-20 + staking + game rewards (`CryptoIslandToken.sol`)

## 6) 7-Day Execution Plan
### Day 1-2 (Stability)
- Freeze Fuji config and contract addresses
- End-to-end smoke test wallet + all tx flows
- Capture and resolve all top runtime errors

### Day 3-4 (Gameplay polish)
- Improve onboarding text and tutorial pacing
- Tighten combat feel (attack/defend cooldown balancing)
- Improve reward feedback (audio/visual confirmations)

### Day 5 (Demo hardening)
- Build deterministic demo route (no dead ends)
- Add fallback plan if one transaction fails
- Prepare backup wallet and pre-funded account

### Day 6 (Interview prep)
- 5-7 minute pitch rehearsal
- 8-10 minute technical architecture walkthrough
- 5 minute live gameplay + on-chain transactions

### Day 7 (Submission readiness)
- Final QA pass
- Update docs and architecture diagram
- Final team rehearsal with timer

## 7) Demo Script (8-minute total)
1. Connect wallet (Fuji confirmation)
2. Start gameplay and show core mechanics
3. Trigger AVAX stake from in-game shortcut
4. Mint NFT and show confirmation
5. Mint/stake CIT and claim rewards
6. Show Web3 Quest completion on HUD
7. Close with scalability roadmap and milestones

## 8) KPIs for Evaluators
- Wallet-to-first-transaction time < 90s
- First playable action < 20s after load
- 4+ on-chain game actions demonstrated in one run
- No chain mismatch prompts during scripted demo

## 9) Post-Grant Milestones
- Mainnet production readiness + security review
- Asset and progression economy balancing
- Tournament/leaderboard season model
- Optional Avalanche L1 migration plan for high-throughput events

## 10) Risk Controls
- Keep fixed fallback wallet for demo
- Keep faucet reserve before interview day
- Keep static backup video demo in case of testnet hiccup
- Keep one-click environment instructions for judges
