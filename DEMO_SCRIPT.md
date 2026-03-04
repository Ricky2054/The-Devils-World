# Devil World — Live Demo Script
### Team1 Mini-Grants Interview — Step-by-Step Demo Runbook

---

## PRE-DEMO CHECKLIST (Do 10 min before interview)

- [ ] Open [the-devils-world.vercel.app](https://the-devils-world.vercel.app) in Chrome
- [ ] MetaMask installed and unlocked
- [ ] Fuji testnet selected in MetaMask
- [ ] Have at least **0.5 AVAX** in wallet (get from [faucet.avax.network](https://faucet.avax.network))
- [ ] Open [testnet.snowtrace.io](https://testnet.snowtrace.io) in a second tab (for proving transactions)
- [ ] Clear browser cache if any issues
- [ ] Test one transaction beforehand (small stake or CIT mint)

---

## DEMO FLOW (5-7 minutes total)

---

### PHASE 1: The Game Is Real (90 seconds)

**What to show:** This is a legitimate game, not a dashboard.

1. **Load the game** — show the loading screen with asset preloading
2. **Start playing immediately** — move with arrow keys, show the world
3. **Narrate while playing:**
   - *"This is Devil World — a 2D action-adventure built with HTML5 Canvas running at 60fps"*
   - *"Everything you see — the terrain, enemies, NPCs, day/night cycle — is rendered in real-time"*
4. **Find and fight an enemy:**
   - Press **Space** to attack
   - Show the combat system (hitboxes, damage numbers, enemy AI)
   - Kill 2-3 enemies
5. **Point out the HUD:**
   - Health bar (top-left)
   - Gold collected
   - Level & XP bar
   - Daily streak indicator
   - *"All this data feeds directly into what gets written to the blockchain"*

**Key talking point:** *"Unlike most Web3 games that are essentially clicker UIs, this has real gameplay depth — physics, AI, progression, bosses."*

---

### PHASE 2: Connect Wallet (30 seconds)

**What to show:** Seamless MetaMask integration.

1. **Click the wallet button** (top-right of screen)
2. MetaMask popup appears → approve connection
3. **If wrong network:** Show the auto-switch prompt to Fuji
4. Point out: *"The game auto-detects if you're on the wrong network and offers to switch to Avalanche Fuji"*
5. Show wallet address displayed in the header

---

### PHASE 3: Blockchain Features In-Game (120 seconds)

**What to show:** Blockchain is integrated INTO gameplay, not separate.

#### 3a. Stake AVAX (Press `1`)
- *"Players can stake AVAX directly from the game — no separate DeFi dashboard needed"*
- Enter amount (e.g., 0.01 AVAX)
- Show transaction in MetaMask → confirm
- *"This is a tiered staking system: Bronze at 10% APY, Silver at 15%, Gold at 20% — the longer you stake, the better your rewards"*
- *"There's also a 5% treasury fee that funds ongoing development"*

#### 3b. Mint CIT Tokens (Press `6`)
- *"CIT is our ERC-20 game token — players mint it at 0.001 AVAX per token"*
- Mint a small amount
- Show transaction confirm

#### 3c. Check Balances (Press `4`)
- Show the balance overlay displaying AVAX staked, CIT balance, NFTs owned
- *"All of this reads directly from the Avalanche Fuji chain"*

---

### PHASE 4: Achievement NFT + On-Chain Leaderboard (90 seconds)

**What to show:** The blockchain creates VERIFIABLE permanent records.

1. **Die in the game** (or trigger game over)
   - Show the game over screen with final stats: Score, Kills, Gold, Level
2. **Click "Mint Achievement NFT"** (Press `3`)
   - *"When a player mints their achievement, two things happen on-chain:"*
   - *"First, an ERC-721 NFT is minted with their stats embedded"*
   - *"Second, their score is submitted to our on-chain leaderboard contract"*
   - Confirm the transaction in MetaMask
3. **Open the Scoreboard**
   - Show the leaderboard with entries loaded FROM THE BLOCKCHAIN
   - *"Notice the subtitle — 'Avalanche Fuji Testnet (On-Chain)'"*
   - *"These scores aren't in a database. They're on Avalanche. Anyone with an RPC endpoint can read them."*
   - **If you have scores from another wallet:** *"See this entry? That's from a different machine, different browser, different wallet — but the scores appear together because they live on-chain."*

---

### PHASE 5: Prove It On Snowtrace (30 seconds)

**What to show:** Everything is verifiable.

1. Switch to the **Snowtrace tab**
2. Paste your wallet address
3. Show the transactions:
   - Staking deposit
   - NFT mint
   - Leaderboard submission
   - CIT mint
4. *"Every interaction is a real transaction on Avalanche Fuji. Judges can verify this independently."*

---

### PHASE 6: Why Avalanche Matters (30 seconds — verbal wrap)

Summarize while showing the game:

> *"Avalanche isn't decorative here. Remove the blockchain and:*
> - *The leaderboard becomes local-only — no cross-device competition*
> - *Achievements aren't ownable — they disappear when you close the tab*
> - *The staking economy doesn't exist — no DeFi integration*
> - *Nothing is verifiable — you have to trust our server*
>
> *Avalanche's sub-second finality means these transactions don't interrupt gameplay. Players stake, mint, and submit scores without leaving the game. That's only possible with a fast, low-cost chain."*

---

## KEYBOARD SHORTCUTS REFERENCE

| Key | Action |
|-----|--------|
| **Arrow Keys** | Move player |
| **Space** | Attack |
| **1** | Stake AVAX |
| **2** | Claim staking rewards |
| **3** | Mint Achievement NFT |
| **4** | Check balances |
| **5** | Unstake AVAX |
| **6** | Mint CIT tokens |
| **7** | Stake CIT tokens |

---

## FALLBACK PLANS

### Transaction fails / MetaMask error
- Stay calm: *"Testnet RPC can occasionally be slow — this is why we plan dedicated infrastructure for mainnet"*
- Show the Snowtrace tab with previous successful transactions as proof
- Retry once, then move on

### Game crashes
- Refresh the page — the game reloads quickly
- *"The beauty of a web-based game is instant recovery"*

### No AVAX in wallet
- Use the Avalanche Faucet: [faucet.avax.network](https://faucet.avax.network)
- Have a backup wallet pre-funded

### Leaderboard empty
- Submit a score before the demo
- Or explain: *"The contract is deployed and verified — I can show the deployment transaction on Snowtrace"*

### Internet issues
- Have screenshots/recordings as backup
- The game's canvas rendering works offline; only blockchain calls need internet

---

## JUDGE Q&A PREPARATION

### "How do you prevent score manipulation?"
*"Currently, scores are submitted client-side which is appropriate for a testnet MVP. For mainnet, we'll implement server-side validation where the game server verifies gameplay sessions before allowing score submission. The on-chain contract already enforces best-score-only — you can't inflate by submitting many times."*

### "Why not use a database instead of blockchain?"
*"A database requires trust. With Avalanche, any player can independently verify every score, every staking reward, every NFT mint. The leaderboard is readable via public RPC without even connecting a wallet. That's composability and trustlessness that no database provides."*

### "What's your revenue model?"
*"5% treasury fee on all staking rewards and NFT mints. As the player base grows, the treasury funds development and seasonal prize pools. CIT token minting also generates revenue at 0.001 AVAX per token."*

### "Why Avalanche specifically?"
*"Three reasons: (1) Sub-second finality means transactions don't interrupt gameplay. (2) Low gas costs on C-Chain make frequent transactions viable. (3) The Avalanche L1 architecture gives us a clear scaling path — when we need dedicated throughput for tournaments, we can deploy our own L1."*

### "When will this be on mainnet?"
*"With grant support, we target mainnet deployment within 6-8 weeks. The contracts are written and tested. We need security auditing, economy stress-testing, and gas optimization before production."*

### "What's your team?"
*"Small independent dev team passionate about bridging real game design with blockchain utility. We move fast — this entire MVP was built, deployed, and tested on Fuji as a functional product, not a mockup."*

### "How many users do you have?"
*"We're in active testing with multiple wallets across different machines — the on-chain leaderboard proves cross-device functionality works. Our focus has been getting the technology right before scaling user acquisition."*

---

## POST-DEMO

After the demo, share these links in chat:
```
🎮 Play: https://the-devils-world.vercel.app
📦 GitHub: https://github.com/Ricky2054/The-Devils-World
🔍 Staking: https://testnet.snowtrace.io/address/0xC08f6E905C88Ae1252a78f3D6eCAb7CF7d27ac9f
🎨 NFT: https://testnet.snowtrace.io/address/0xBd852B73011eb7937993b06F43891dD67C31BC10
🪙 CIT: https://testnet.snowtrace.io/address/0xCd5b54dBEa2bF1aE449361F5c35af1E4fbA8aCcC
🏆 Leaderboard: https://testnet.snowtrace.io/address/0x0b8c3C6F2a30c0C4B9Cbb9C03A2F1D14B2eC2155
```

---

*Good luck with the interview! 🎮⛰️*
