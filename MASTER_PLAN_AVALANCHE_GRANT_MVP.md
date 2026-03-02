# Devil World — Avalanche Fuji Grant MVP Master Plan

## 1) Mission and Outcome
Build and ship a **credible, demo-stable, blockchain-integrated game MVP** in ~36 hours that clearly proves:
1. Real player actions trigger real on-chain transactions on Avalanche Fuji.
2. The blockchain layer improves game design (ownership, rewards, progression), not just marketing.
3. The team can execute fast, ship cleanly, and present a scalable path to production.

---

## 2) Constraints (Accepted Up Front)
- Time budget: **1.5 days (~36 focused hours)**
- Budget: **$0 paid infrastructure**
- Chain: **Avalanche Fuji C-Chain (43113)**
- Wallet: **MetaMask**
- Deliverable: **Live prototype + architecture walkthrough + interview-ready demo script**

---

## 3) Product Strategy for Selection Odds

### Positioning
"Devil World is a skill-based action adventure where gameplay milestones convert into on-chain progress and collectible ownership, using Avalanche’s fast finality for seamless web3 game loops."

### What judges care about most (optimize for these)
1. **Reliability under demo pressure** (no broken wallet flow)
2. **Clear Avalanche relevance** (Fuji + contract interactions + explorer proof)
3. **Playable loop** (not just contract buttons)
4. **Execution discipline** (clean roadmap + milestones + measurable progress)

### What to avoid in this sprint
- Massive art rework
- New tokenomics complexity
- Multiplayer/netcode
- Custom L1/subnet claims without implementation proof

---

## 4) MVP Scope (Strict)

## In Scope (must ship)
- Wallet connect on Fuji with correct network gating.
- AVAX staking flow from game (stake/unstake/claim).
- NFT mint flow from game (mint + ownership check).
- ERC20 utility flow (mint/stake/claim rewards/unstake).
- One polished gameplay loop with clear HUD prompts.
- Demo operator shortcuts to run chain actions quickly.
- Public deploy (frontend) + reproducible deploy runbook.

## Out of Scope (defer)
- Mainnet launch
- Real-money economy balancing
- Full backend game server
- Complex anti-cheat

---

## 5) Technical Target Architecture

```text
[Player Browser]
  ├─ React Canvas Game (App + game systems)
  ├─ MetaMask Provider
  └─ Ethers.js Contract Service
       ├─ AVAXStaking.sol (native stake rewards)
       ├─ CryptoIslandNFT.sol (collectible ownership)
       └─ CryptoIslandToken.sol (CIT utility + token staking)

[Avalanche Fuji C-Chain]
  ├─ Contract state + events
  └─ Explorer proof (Snowtrace)

[Static Hosting (Free)]
  └─ Vercel/Netlify/GitHub Pages
```

### Why Avalanche fits this game
- EVM compatibility = fast build velocity (Solidity + ethers).
- Fuji gives low-cost realistic test environment.
- C-Chain transaction UX is good enough for frequent game interactions.

---

## 6) Build Plan by Workstream

## Workstream A — Blockchain Reliability (Highest Priority)
**Goal:** zero ambiguity in chain and contract interactions.

### A1. Chain enforcement
- Ensure only chainId `43113` accepted.
- Auto-switch/add Fuji network through wallet API.
- Human-readable errors when wrong network is detected.

### A2. Contract address source of truth
- Use env-based address overrides:
  - `REACT_APP_STAKING_ADDRESS`
  - `REACT_APP_NFT_ADDRESS`
  - `REACT_APP_TOKEN_ADDRESS`
- Fail gracefully if any address invalid.

### A3. Transaction robustness
- For each action: pending → success/failure modal.
- Parse and display transaction hash.
- Allow quick link to Snowtrace tx page.

### A4. Critical state checks
- Before stake/mint/claim: check connected wallet and balance.
- After tx success: refresh local player stats and on-chain reads.

**Definition of done:** every blockchain action is reproducible 2/2 times in live demo.

---

## Workstream B — Gameplay Quality (Second Priority)
**Goal:** judges feel this is a game, not a contract dashboard.

### B1. Tight gameplay loop (10–15 min retention loop)
- Move → fight/collect → earn points/resources → trigger blockchain action reward.
- Keep progression visible on HUD (XP, points, achievements, wallet state).

### B2. Moment-to-moment feedback
- Audio cues on successful interactions.
- Screen feedback for achievements and chain actions.
- Day/night + hazard variations to show world dynamics.

### B3. Player guidance
- On-screen command legend always visible in active play.
- Demo-safe shortcuts for blockchain actions (`1..9`) and account view.

### B4. Difficulty pacing (MVP level)
- Avoid frustrating spikes.
- Make first 3 minutes consistently successful for judges.

**Definition of done:** first-time user can perform 1 gameplay objective + 2 blockchain actions without external help.

---

## Workstream C — UX + Presentation Layer
**Goal:** confidence and clarity during interview.

### C1. In-game status clarity
- Wallet status (connected/disconnected + truncated address)
- AVAX display + on-chain asset summary
- Recent action success states

### C2. Error UX
- Friendly messages for:
  - wrong chain
  - rejected transaction
  - insufficient balance
  - contract not initialized

### C3. Demo mode posture
- Hide unnecessary debug logs where possible.
- Keep UI readable at 1080p screen share.

**Definition of done:** observer can understand what happened without reading code.

---

## Workstream D — Deployment and Proof
**Goal:** fully free, reproducible, publicly testable prototype.

### D1. Free hosting options
- Primary: **Vercel** (free)
- Backup: **Netlify** (free)
- Last resort: **GitHub Pages** (if static constraints fit)

### D2. Environment setup
- Add env vars in hosting dashboard for contract addresses.
- Build command: `npm run build`
- Publish directory: `build`

### D3. Public proof links
- Live URL (frontend)
- Snowtrace contract links
- 1-2 transaction links proving live interactions

**Definition of done:** new evaluator opens link, connects MetaMask Fuji, performs at least one transaction.

---

## 7) 36-Hour Execution Schedule (Detailed)

## Phase 0 (Hour 0–1) — Lock Scope
- Freeze feature list to MVP-only scope.
- Confirm contract addresses on Fuji.
- Confirm wallet has enough test AVAX buffer.

## Phase 1 (Hour 1–8) — Chain Reliability
- Validate all wallet flows on Fuji.
- Validate stake/mint/claim for AVAX + NFT + CIT.
- Patch all failing edge cases.
- Record each action + tx hash in a test log.

## Phase 2 (Hour 8–16) — Gameplay Polish
- Tighten HUD clarity and action prompts.
- Ensure first 3-minute player path is smooth.
- Tune rewards/messages so blockchain actions feel meaningful.

## Phase 3 (Hour 16–24) — Integration Stabilization
- Run repeatable end-to-end playtests (minimum 5 runs).
- Verify no critical regressions.
- Build production artifact.

## Phase 4 (Hour 24–30) — Deploy + Verify
- Deploy frontend on free host.
- Smoke test from clean browser profile.
- Verify all transaction paths on live URL.

## Phase 5 (Hour 30–34) — Interview Assets
- Finalize architecture diagram + flow narrative.
- Prepare 5–7 minute pitch script.
- Prepare fallback demo video capture (backup plan).

## Phase 6 (Hour 34–36) — Rehearsal
- 2 full timed rehearsals.
- One "failure simulation" rehearsal (wallet reject / wrong chain / tx delay).
- Final checklist freeze.

---

## 8) Acceptance Criteria (Non-Negotiable)

## Functional
- Connect wallet on Fuji successfully.
- Execute at least 4 chain actions from gameplay UI:
  1) Stake AVAX
  2) Claim AVAX rewards
  3) Mint NFT
  4) Mint/Stake/Claim CIT
- Display post-transaction status in game.

## Demo
- 7-minute script completes without code edits.
- All critical actions have fallback explanation and proof links.

## Deployment
- Public URL accessible.
- Build reproducible from repo using standard commands.

---

## 9) Free Deployment Runbook (Step-by-Step)

## Smart contracts (Fuji)
1. Set `.env` with deployer private key and API keys.
2. Run deployment script for Fuji.
3. Save deployed addresses and explorer links.
4. Verify contract source where possible.

## Frontend
1. Configure env vars (`REACT_APP_*_ADDRESS`).
2. Run local production build smoke test.
3. Push to GitHub.
4. Import repo into Vercel/Netlify.
5. Set build command and publish dir.
6. Test live URL with MetaMask Fuji.

## Post-deploy checks
- Wallet connect works.
- At least one transaction confirmed on Snowtrace from live app.
- Mobile viewport does not break primary UI (optional bonus).

---

## 10) Test Matrix (Fast but Effective)

## Wallet/Network
- MetaMask missing
- Wrong network then switch
- Account change event
- Disconnect/reconnect

## Transactions
- Happy path for each function
- User rejects transaction
- Insufficient balance
- Contract call reverts

## Gameplay
- Start → play → interact path
- Achievement popups and HUD updates
- Pause/resume and menu state integrity

## Build/Deploy
- `npm run build` clean
- Hosted app loads without console-blocking runtime errors

---

## 11) Risk Register + Mitigation

1. **Fuji RPC instability / slow confirmations**
   - Mitigation: Retry-safe UX, clear pending state, backup demo tx links.

2. **MetaMask edge-case during live call**
   - Mitigation: Pre-connect wallet, keep second browser profile ready.

3. **Address mismatch across environments**
   - Mitigation: Single env file + checklist verification before demo.

4. **Scope creep in final hours**
   - Mitigation: No new features after hour 24, bugfix-only policy.

5. **Faucet unavailability**
   - Mitigation: Maintain AVAX reserve in demo wallet and backup wallet.

---

## 12) Interview Execution Script (5–7 min pitch + technical)

## Opening (45s)
- Problem: web3 game demos are often non-playable or non-reproducible.
- Solution: playable action loop with provable on-chain ownership and rewards.
- Why Avalanche: EVM speed + UX suitable for frequent game interactions.

## Product demo (3 min)
1. Connect wallet (Fuji).
2. Play quick loop (movement/combat/resource feedback).
3. Trigger blockchain actions from gameplay controls.
4. Show transaction confirmation and updated game state.
5. Show Snowtrace proof.

## Architecture walkthrough (2 min)
- Frontend game systems + ethers service + 3 contracts.
- Event and state synchronization strategy.
- Error handling and chain gating.

## Roadmap (1 min)
- Week 1–2: telemetry + balancing
- Week 3–4: quest expansion + social loop
- Week 5–6: pre-mainnet hardening and economy tuning

---

## 13) What “Grant-Ready” Looks Like
You are grant-ready if all are true:
- Live URL works with MetaMask Fuji.
- Demo executes cleanly in one pass.
- Avalanche role is explicit and technically justified.
- You can answer: “What breaks if blockchain is removed?” with concrete product impact.

---

## 14) Immediate Next Actions (Today)
1. Run full Fuji action checklist in local app.
2. Capture 3 successful tx hashes for proof archive.
3. Deploy frontend to free host and retest.
4. Rehearse interview script twice on timer.
5. Freeze build and avoid last-minute architecture changes.

---

## 15) Final Principle
In this timeframe, **stability beats novelty**. A focused, reliable, demonstrably on-chain MVP with clear gameplay utility will outperform a larger but fragile prototype.
