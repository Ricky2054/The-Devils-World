// Retro-style game screens for Devil's World Adventure
export class GameScreenManager {
  constructor() {
    this.currentScreen = 'title'; // title, playing, gameOver, scoreboard
    this.titleAnimationTime = 0;
    this.gameOverAnimationTime = 0;
    this.scoreboardData = [];
    this.playerName = '';
    this.finalScore = 0;
    this.retryCount = 0;
    // Cache title-screen knight idle sprite for animation
    this._titleKnight = null;
    this._titleKnightLoaded = false;
    this._loadTitleKnight();
    // Stars — layered for depth
    this._stars = Array.from({length: 180}, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.3 + Math.random() * 1.2,
      twinkleSpeed: 1.5 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
      layer: Math.floor(Math.random() * 3),       // 0=far 1=mid 2=near
    }));
    // Embers — rise from below with drift
    this._embers = Array.from({length: 60}, () => this._newEmber());
    // Fireflies — gentle floating orbs
    this._fireflies = Array.from({length: 14}, () => ({
      x: 0.1 + Math.random() * 0.8,
      y: 0.3 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.0002,
      vy: (Math.random() - 0.5) * 0.0002,
      r: 2 + Math.random() * 3,
      hue: 30 + Math.random() * 30,     // warm gold-orange
      phase: Math.random() * Math.PI * 2,
    }));
    // Menu hover state
    this._menuHover = -1;
  }

  _newEmber() {
    return {
      x: Math.random(),
      y: 1 + Math.random() * 0.2,
      size: 0.6 + Math.random() * 2,
      speed: 0.001 + Math.random() * 0.002,
      drift: (Math.random() - 0.5) * 0.0008,
      wobbleAmp: 4 + Math.random() * 8,
      wobbleFreq: 0.02 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
      life: 0,
      maxLife: 300 + Math.random() * 400,
      r: 255,
      g: 80 + Math.floor(Math.random() * 100),
      b: 20 + Math.floor(Math.random() * 30),
    };
  }

  _loadTitleKnight() {
    const img = new Image();
    img.onload = () => { this._titleKnight = img; this._titleKnightLoaded = true; };
    img.onerror = () => { this._titleKnightLoaded = false; };
    img.src = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL ? process.env.PUBLIC_URL : '') + '/assets/external/knight/idle.png';
  }

  // ─── Cinematic Title Screen ────────────────────────────────
  drawTitleScreen(ctx, canvas) {
    const W = canvas.width;
    const H = canvas.height;
    const t = this.titleAnimationTime;
    const sec = t / 60;          // approximate seconds

    // ╔══════════════════════════════════════════════════╗
    // ║  LAYER 0 — Deep sky gradient                     ║
    // ╚══════════════════════════════════════════════════╝
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#020510');
    sky.addColorStop(0.20, '#07112a');
    sky.addColorStop(0.45, '#0e1a3d');
    sky.addColorStop(0.65, '#1c0a2e');
    sky.addColorStop(0.85, '#180418');
    sky.addColorStop(1, '#0a0205');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // ╔══════════════════════════════════════════════════╗
    // ║  LAYER 1 — Star field with twinkling              ║
    // ╚══════════════════════════════════════════════════╝
    ctx.save();
    this._stars.forEach(s => {
      const twinkle = 0.3 + 0.7 * Math.pow(Math.sin(sec * s.twinkleSpeed + s.phase), 2);
      const parallax = 1 + s.layer * 0.5;
      const sy = ((s.y + sec * 0.002 * parallax) % 1.05);
      const brightness = s.layer === 2 ? 255 : s.layer === 1 ? 220 : 180;
      ctx.fillStyle = `rgba(${brightness},${brightness},255,${(twinkle * (0.4 + s.layer * 0.25)).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x * W, sy * H, s.r * (0.8 + 0.2 * twinkle), 0, Math.PI * 2);
      ctx.fill();
      // Glow halo on bright near-stars
      if (s.layer === 2 && twinkle > 0.8) {
        ctx.fillStyle = `rgba(180,200,255,${(twinkle * 0.08).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x * W, sy * H, s.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();

    // ╔══════════════════════════════════════════════════╗
    // ║  LAYER 2 — Distant mountain silhouettes           ║
    // ╚══════════════════════════════════════════════════╝
    this._drawMountains(ctx, W, H, sec);

    // ╔══════════════════════════════════════════════════╗
    // ║  LAYER 3 — Atmospheric fog                        ║
    // ╚══════════════════════════════════════════════════╝
    // Mid-level mist
    const mist1 = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.8);
    mist1.addColorStop(0, 'rgba(30,15,50,0)');
    mist1.addColorStop(0.5, `rgba(20,12,40,${(0.15 + 0.05 * Math.sin(sec * 0.5)).toFixed(3)})`);
    mist1.addColorStop(1, 'rgba(30,15,50,0)');
    ctx.fillStyle = mist1;
    ctx.fillRect(0, H * 0.55, W, H * 0.25);

    // Ground fog
    const fogGrad = ctx.createLinearGradient(0, H * 0.82, 0, H);
    fogGrad.addColorStop(0, 'rgba(15,8,30,0)');
    fogGrad.addColorStop(0.3, 'rgba(20,10,35,0.35)');
    fogGrad.addColorStop(1, 'rgba(10,5,18,0.85)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, H * 0.82, W, H * 0.18);

    // ╔══════════════════════════════════════════════════╗
    // ║  LAYER 4 — Ember particles                        ║
    // ╚══════════════════════════════════════════════════╝
    ctx.save();
    this._embers.forEach((e, i) => {
      e.y -= e.speed;
      e.x += e.drift;
      e.life++;
      e.phase += e.wobbleFreq;
      if (e.life > e.maxLife || e.y < -0.05) {
        Object.assign(this._embers[i], this._newEmber());
        return;
      }
      const lifeRatio = e.life / e.maxLife;
      const fadeIn = Math.min(1, e.life / 40);
      const fadeOut = Math.max(0, 1 - Math.pow(lifeRatio, 2));
      const alpha = fadeIn * fadeOut * 0.85;
      const px = e.x * W + Math.sin(e.phase) * e.wobbleAmp;
      const py = e.y * H;
      // Core
      ctx.fillStyle = `rgba(${e.r},${e.g},${e.b},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, e.size, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      if (e.size > 1) {
        ctx.fillStyle = `rgba(${e.r},${Math.min(255, e.g + 40)},${e.b},${(alpha * 0.2).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, e.size * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();

    // ╔══════════════════════════════════════════════════╗
    // ║  LAYER 5 — Firefly orbs                           ║
    // ╚══════════════════════════════════════════════════╝
    ctx.save();
    this._fireflies.forEach(f => {
      f.x += f.vx + Math.sin(sec * 0.7 + f.phase) * 0.00015;
      f.y += f.vy + Math.cos(sec * 0.5 + f.phase) * 0.0001;
      if (f.x < 0.05 || f.x > 0.95) f.vx *= -1;
      if (f.y < 0.25 || f.y > 0.75) f.vy *= -1;
      const glow = 0.4 + 0.6 * Math.pow(Math.sin(sec * 1.5 + f.phase), 2);
      const px = f.x * W;
      const py = f.y * H;
      // Outer glow
      const g1 = ctx.createRadialGradient(px, py, 0, px, py, f.r * 8);
      g1.addColorStop(0, `hsla(${f.hue},90%,70%,${(glow * 0.15).toFixed(3)})`);
      g1.addColorStop(1, `hsla(${f.hue},90%,70%,0)`);
      ctx.fillStyle = g1;
      ctx.fillRect(px - f.r * 8, py - f.r * 8, f.r * 16, f.r * 16);
      // Core
      ctx.fillStyle = `hsla(${f.hue},95%,80%,${(glow * 0.9).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, f.r * glow, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // ╔══════════════════════════════════════════════════╗
    // ║  LAYER 6 — God-ray light beams                    ║
    // ╚══════════════════════════════════════════════════╝
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const rayAlpha = 0.03 + 0.02 * Math.sin(sec * 0.3);
    for (let r = 0; r < 5; r++) {
      const angle = -0.35 + r * 0.18 + Math.sin(sec * 0.15 + r) * 0.05;
      const originX = W * 0.5;
      const originY = -H * 0.1;
      ctx.save();
      ctx.translate(originX, originY);
      ctx.rotate(angle);
      const rayGrad = ctx.createLinearGradient(0, 0, 0, H * 1.3);
      rayGrad.addColorStop(0, `rgba(255,200,100,${(rayAlpha * 1.5).toFixed(3)})`);
      rayGrad.addColorStop(0.5, `rgba(255,180,80,${rayAlpha.toFixed(3)})`);
      rayGrad.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = rayGrad;
      ctx.fillRect(-15, 0, 30 + r * 8, H * 1.3);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // ╔══════════════════════════════════════════════════╗
    // ║  LAYER 7 — Vignette                               ║
    // ╚══════════════════════════════════════════════════╝
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.7, 'rgba(0,0,0,0.15)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // ╔══════════════════════════════════════════════════╗
    // ║  TEXT — Title with animated glow                   ║
    // ╚══════════════════════════════════════════════════╝
    ctx.save();
    ctx.textAlign = 'center';
    const titleY = H * 0.16;
    const titleSize = Math.min(86, W * 0.11);

    // Entrance fade
    const titleFade = Math.min(1, t / 90);
    ctx.globalAlpha = titleFade;

    // Title pulsing glow radius
    const glowPulse = 22 + 12 * Math.sin(sec * 1.2);

    // Very deep shadow
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = `bold ${titleSize}px "Dracutaz", "Courier New", fantasy`;
    ctx.fillText("DEVIL'S WORLD", W / 2 + 4, titleY + 5);

    // Red under-glow
    ctx.shadowColor = '#ff2d00';
    ctx.shadowBlur = glowPulse + 22;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#cc1100';
    ctx.fillText("DEVIL'S WORLD", W / 2, titleY);

    // Gold main text
    ctx.shadowColor = '#ffc800';
    ctx.shadowBlur = glowPulse + 6;
    const titleGrad = ctx.createLinearGradient(W / 2 - 200, titleY - 30, W / 2 + 200, titleY + 10);
    titleGrad.addColorStop(0, '#ffe066');
    titleGrad.addColorStop(0.22, '#fff7bf');
    titleGrad.addColorStop(0.5, '#ffe066');
    titleGrad.addColorStop(0.74, '#ff9f1c');
    titleGrad.addColorStop(1, '#ffd166');
    ctx.fillStyle = titleGrad;
    ctx.fillText("DEVIL'S WORLD", W / 2, titleY);
    ctx.shadowBlur = 0;

    // Thin highlight stroke
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.4;
    ctx.strokeText("DEVIL'S WORLD", W / 2, titleY);

    // Pixel offset duplicate for chunky 8-bit retro vibe
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ff3b30';
    ctx.fillText("DEVIL'S WORLD", W / 2 + 2, titleY + 2);
    ctx.globalAlpha = 1;

    // ── Decorative line under title ──
    const lineW = Math.min(430, W * 0.48);
    const lineY = titleY + 18;
    const lineGrad = ctx.createLinearGradient(W / 2 - lineW / 2, 0, W / 2 + lineW / 2, 0);
    lineGrad.addColorStop(0, 'rgba(255,200,80,0)');
    lineGrad.addColorStop(0.2, 'rgba(255,200,80,0.5)');
    lineGrad.addColorStop(0.5, 'rgba(255,220,120,0.8)');
    lineGrad.addColorStop(0.8, 'rgba(255,200,80,0.5)');
    lineGrad.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(W / 2 - lineW / 2, lineY, lineW, 2);
    // Diamond center ornament
    ctx.fillStyle = 'rgba(255,220,130,0.9)';
    ctx.save();
    ctx.translate(W / 2, lineY + 1);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();

    // ── Subtitle ──
    const subFade = Math.min(1, Math.max(0, (t - 40) / 60));
    ctx.globalAlpha = subFade * 0.9;
    ctx.font = `bold ${Math.min(22, W * 0.028)}px "Courier New", monospace`;
    ctx.letterSpacing = '4px';
    ctx.fillStyle = '#c8a87c';
    ctx.fillText('A   K N I G H T \'S   J O U R N E Y', W / 2, titleY + 46);
    ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;

    // ── Story tagline with typewriter effect ──
    const tagline = 'The seals have broken.  Darkness rises.  Only you can restore the light.';
    const typeDelay = 70;  // frames before typing starts
    const charsTicked = Math.max(0, Math.floor((t - typeDelay) * 0.45));
    const visibleChars = Math.min(tagline.length, charsTicked);
    if (visibleChars > 0) {
      const tagFade = Math.min(1, (t - typeDelay) / 40);
      ctx.globalAlpha = tagFade * 0.85;
      ctx.font = `italic ${Math.min(16, W * 0.02)}px "Courier New", monospace`;
      ctx.fillStyle = '#a8917a';
      const shown = tagline.substring(0, visibleChars);
      const cursor = visibleChars < tagline.length ? '▎' : '';
      ctx.fillText(shown + cursor, W / 2, titleY + 78);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ╔══════════════════════════════════════════════════╗
    // ║  KNIGHT — animated idle, larger, with platform    ║
    // ╚══════════════════════════════════════════════════╝
    if (this._titleKnight && this._titleKnightLoaded) {
      const frameW = 120, frameH = 80;
      const totalFrames = Math.max(1, Math.floor(this._titleKnight.width / frameW));
      const frame = Math.floor(t / 10) % totalFrames;
      const drawSize = Math.min(250, W * 0.3);
      const ratio = frameH / frameW;
      const kx = W / 2 - drawSize / 2;
      const ky = H * 0.35;
      const bobY = Math.sin(sec * 2) * 3;  // gentle float

      // Platform glow beneath knight
      const platGrad = ctx.createRadialGradient(W / 2, ky + drawSize * ratio + 8, 2, W / 2, ky + drawSize * ratio + 8, drawSize * 0.6);
      platGrad.addColorStop(0, 'rgba(255,180,60,0.18)');
      platGrad.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = platGrad;
      ctx.fillRect(W / 2 - drawSize * 0.6, ky + drawSize * ratio - 4, drawSize * 1.2, 24);

      ctx.drawImage(
        this._titleKnight,
        frame * frameW, 0, frameW, frameH,
        kx, ky + bobY, drawSize, drawSize * ratio
      );
    }

    // ╔══════════════════════════════════════════════════╗
    // ║  MENU PANEL — glassy, with polish                 ║
    // ╚══════════════════════════════════════════════════╝
    const menuFade = Math.min(1, Math.max(0, (t - 60) / 50));
    ctx.save();
    ctx.globalAlpha = menuFade;
    const menuCX = W / 2;
    const panelW = Math.min(460, W * 0.58);
    const menuItems = [
      { key: 'ENTER', label: 'Start Adventure', icon: '\u2694' },
      { key: 'S',     label: 'Scoreboard',      icon: '\u265F' },
      { key: 'H',     label: 'How to Play',     icon: '\u2637' },
      { key: 'C',     label: 'Connect Wallet',  icon: '\u26D3' },
      { key: 'M',     label: 'Toggle Music',    icon: '\u266B' },
    ];
    const itemH = 36;
    const panelPad = 14;
    const panelH = menuItems.length * itemH + panelPad * 2;
    const panelX = menuCX - panelW / 2;
    const panelYStart = H * 0.62;

    // Glass panel bg
    const panelBg = ctx.createLinearGradient(panelX, panelYStart, panelX, panelYStart + panelH);
    panelBg.addColorStop(0, 'rgba(8,6,18,0.78)');
    panelBg.addColorStop(1, 'rgba(18,12,30,0.85)');
    this._roundRect(ctx, panelX, panelYStart, panelW, panelH, 10);
    ctx.fillStyle = panelBg;
    ctx.fill();
    // Border
    const borderGrad = ctx.createLinearGradient(panelX, panelYStart, panelX + panelW, panelYStart + panelH);
    borderGrad.addColorStop(0, 'rgba(200,160,80,0.5)');
    borderGrad.addColorStop(0.5, 'rgba(200,160,80,0.25)');
    borderGrad.addColorStop(1, 'rgba(200,160,80,0.5)');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner highlight line at top
    const hl = ctx.createLinearGradient(panelX + 20, 0, panelX + panelW - 20, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)');
    hl.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(panelX + 20, panelYStart + 1, panelW - 40, 1);

    // Draw menu items
    ctx.textBaseline = 'middle';
    menuItems.forEach((item, i) => {
      const iy = panelYStart + panelPad + i * itemH + itemH / 2;
      const stagger = Math.min(1, Math.max(0, (t - 70 - i * 8) / 30));
      ctx.globalAlpha = menuFade * stagger;

      // Hover-like pulse on current item (cycling)
      const isHighlight = (Math.floor(t / 120) % menuItems.length) === i && t > 100;

      // Key badge
      const badgeW = item.key.length * 9 + 18;
      const badgeX = menuCX - panelW * 0.40;
      const badgeR = 4;

      // Badge bg
      ctx.fillStyle = isHighlight ? 'rgba(250,200,80,0.25)' : 'rgba(120,100,60,0.22)';
      this._roundRect(ctx, badgeX, iy - 11, badgeW, 22, badgeR);
      ctx.fill();
      ctx.strokeStyle = isHighlight ? 'rgba(250,200,80,0.6)' : 'rgba(180,150,90,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Badge text
      ctx.fillStyle = isHighlight ? '#ffe8a0' : '#e8dcc8';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(item.key, badgeX + badgeW / 2, iy + 1);

      // Label with icon
      ctx.textAlign = 'left';
      ctx.fillStyle = isHighlight ? '#fff5d8' : '#d0c4b0';
      ctx.font = `${isHighlight ? 'bold ' : ''}15px "Courier New", monospace`;
      ctx.fillText(`${item.icon}  ${item.label}`, badgeX + badgeW + 16, iy + 1);

      // Animated arrow for highlighted
      if (isHighlight) {
        const arrowBob = Math.sin(sec * 6) * 3;
        ctx.fillStyle = '#ffd080';
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.textAlign = 'right';
        ctx.fillText('\u25B6', badgeX - 8 + arrowBob, iy + 1);
      }
    });
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.globalAlpha = menuFade;

    // ── Pulsing call-to-action ──
    const ctaPulse = 0.4 + 0.6 * Math.sin(sec * 2.5);
    ctx.globalAlpha = menuFade * ctaPulse;
    ctx.fillStyle = '#ffd080';
    ctx.font = `bold ${Math.min(16, W * 0.02)}px "Courier New", monospace`;
    ctx.fillText('\u2014  click anywhere or press ENTER to begin  \u2014', W / 2, H * 0.91);
    ctx.globalAlpha = 1;

    // ── Footer ──
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#887766';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('Devil\'s World v1.0   \u2022   Avalanche Blockchain   \u2022   2026', W / 2, H - 12);

    ctx.restore();
    this.titleAnimationTime++;
  }

  // ─── Mountain silhouette helper ──────────────────────────
  _drawMountains(ctx, W, H, sec) {
    // Far range (dark, slow parallax)
    ctx.fillStyle = '#0a0618';
    ctx.beginPath();
    ctx.moveTo(0, H);
    const farY = H * 0.68;
    const farPeaks = [0, 0.08, 0.18, 0.28, 0.38, 0.48, 0.55, 0.65, 0.75, 0.85, 0.95, 1.0];
    const farH =    [0.06, 0.14, 0.22, 0.10, 0.28, 0.16, 0.24, 0.12, 0.20, 0.26, 0.08, 0.05];
    farPeaks.forEach((px, i) => {
      ctx.lineTo(px * W + Math.sin(sec * 0.05 + i) * 2, farY - farH[i] * H * 0.35);
    });
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Near range (slightly brighter, more detail)
    const nearGrad = ctx.createLinearGradient(0, H * 0.78, 0, H);
    nearGrad.addColorStop(0, '#100820');
    nearGrad.addColorStop(1, '#0a0510');
    ctx.fillStyle = nearGrad;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const nearY = H * 0.78;
    const nearPeaks = [0, 0.06, 0.14, 0.24, 0.32, 0.42, 0.52, 0.60, 0.70, 0.80, 0.88, 0.96, 1.0];
    const nearH =     [0.03, 0.09, 0.15, 0.07, 0.18, 0.10, 0.14, 0.08, 0.16, 0.06, 0.12, 0.04, 0.02];
    nearPeaks.forEach((px, i) => {
      ctx.lineTo(px * W + Math.sin(sec * 0.08 + i * 1.3) * 3, nearY - nearH[i] * H * 0.3);
    });
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  // ─── Rounded rect helper ─────────────────────────────────
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // Draw SNES-style pixel-art game over screen
  drawGameOverScreen(ctx, canvas, gameStats) {
    const t = this.gameOverAnimationTime;
    const cx = canvas.width / 2;

    // --- Phase 1: Screen fades to black (first 60 frames) ---
    const fadeIn = Math.min(1, t / 60);

    // Background: deep blood-red vignette
    const bg = ctx.createRadialGradient(cx, canvas.height * 0.38, 40, cx, canvas.height * 0.38, canvas.height * 0.7);
    bg.addColorStop(0, '#4a0000');
    bg.addColorStop(0.6, '#1a0000');
    bg.addColorStop(1, '#000000');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Animated scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let y = 0; y < canvas.height; y += 4) {
      ctx.fillRect(0, y, canvas.width, 2);
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = fadeIn;

    // --- Pixel skull icon (drawn with rects) ---
    const skullY = canvas.height * 0.08;
    const skullSize = 4;
    const skullCx = cx;
    const skullPixels = [
      // Row 0-1: top of skull
      [-2,0],[-1,0],[0,0],[1,0],[2,0],
      [-3,1],[-2,1],[-1,1],[0,1],[1,1],[2,1],[3,1],
      // Row 2-3: eyes
      [-3,2],[-2,2],[0,2],[2,2],[3,2],
      [-3,3],[-2,3],[0,3],[2,3],[3,3],
      // Row 4: nose
      [-3,4],[-2,4],[-1,4],[0,4],[1,4],[2,4],[3,4],
      // Row 5-6: teeth
      [-3,5],[-1,5],[1,5],[3,5],
      [-2,6],[0,6],[2,6],
    ];
    const skullFlicker = 0.85 + 0.15 * Math.sin(t * 0.12);
    ctx.globalAlpha = fadeIn * skullFlicker;
    ctx.fillStyle = '#cccccc';
    skullPixels.forEach(([px, py]) => {
      ctx.fillRect(skullCx + px * skullSize - skullSize / 2, skullY + py * skullSize, skullSize, skullSize);
    });
    // Eye glow
    ctx.fillStyle = '#ff0000';
    [[-1,2],[1,2],[-1,3],[1,3]].forEach(([px,py]) => {
      ctx.fillRect(skullCx + px * skullSize - skullSize / 2, skullY + py * skullSize, skullSize, skullSize);
    });

    ctx.globalAlpha = fadeIn;

    // --- "GAME OVER" title with heavy shadow + letter-by-letter reveal ---
    const titleY = canvas.height * 0.22;
    const titleText = "GAME  OVER";
    const revealedChars = Math.min(titleText.length, Math.floor(t / 6));

    ctx.font = 'bold 52px "Courier New", monospace';
    // Shadow layers for depth
    for (let s = 4; s >= 1; s--) {
      ctx.fillStyle = `rgba(80,0,0,${0.3 / s})`;
      ctx.fillText(titleText.substring(0, revealedChars), cx + s * 2, titleY + s * 2);
    }
    // Main text with blood-red glow
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20 + 8 * Math.sin(t * 0.06);
    ctx.fillStyle = '#ff2222';
    ctx.fillText(titleText.substring(0, revealedChars), cx, titleY);
    ctx.shadowBlur = 0;

    // --- Dramatic subtitle (fades in after title reveal) ---
    const subAlpha = Math.max(0, Math.min(1, (t - 70) / 30));
    if (subAlpha > 0) {
      ctx.globalAlpha = fadeIn * subAlpha;
      ctx.fillStyle = '#bb6600';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText('The darkness has claimed another soul...', cx, titleY + 50);
    }

    // --- Stats panel with retro border (slides up) ---
    const panelSlide = Math.max(0, Math.min(1, (t - 90) / 40));
    if (panelSlide > 0) {
      ctx.globalAlpha = fadeIn * panelSlide;

      const panelW = Math.min(420, canvas.width - 60);
      const panelH = 190;
      const panelX = cx - panelW / 2;
      const panelY = canvas.height * 0.38 + (1 - panelSlide) * 30;

      // Panel background
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(panelX, panelY, panelW, panelH);
      // Pixel border (double-line retro style)
      ctx.strokeStyle = '#882200';
      ctx.lineWidth = 3;
      ctx.strokeRect(panelX + 1, panelY + 1, panelW - 2, panelH - 2);
      ctx.strokeStyle = '#cc4400';
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX + 5, panelY + 5, panelW - 10, panelH - 10);

      // "FINAL STATS" header
      ctx.fillStyle = '#ff6600';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillText('- FINAL STATS -', cx, panelY + 26);

      // Stat rows
      const stats = [
        { label: 'SCORE',    value: String(gameStats.totalScore || 0),       color: '#ffdd44' },
        { label: 'LEVEL',    value: String(gameStats.level || 1),            color: '#44ddff' },
        { label: 'ENEMIES',  value: String(gameStats.enemiesKilled || 0),    color: '#ff6666' },
        { label: 'GOLD',     value: String(gameStats.goldCollected || 0),    color: '#ffaa00' },
        { label: 'BUILT',    value: String(gameStats.buildingsBuilt || 0),   color: '#88ff88' },
        { label: 'TIME',     value: this.formatTime(gameStats.timePlayed || 0), color: '#ccccff' },
      ];

      ctx.font = 'bold 14px "Courier New", monospace';
      const colLeft = panelX + 30;
      const colRight = panelX + panelW - 30;
      stats.forEach((s, i) => {
        const rowY = panelY + 50 + i * 23;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#999999';
        ctx.fillText(s.label, colLeft, rowY);
        ctx.textAlign = 'right';
        ctx.fillStyle = s.color;
        ctx.fillText(s.value, colRight, rowY);
      });
      ctx.textAlign = 'center';
    }

    // --- Action prompts (pulse in after stats) ---
    const promptAlpha = Math.max(0, Math.min(1, (t - 150) / 30));
    if (promptAlpha > 0) {
      const btnY = canvas.height * 0.82;
      const pulse = 0.55 + 0.45 * Math.sin(t * 0.08);

      ctx.globalAlpha = fadeIn * promptAlpha * pulse;
      ctx.fillStyle = '#00ff66';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillText('[ R ]  RETRY', cx, btnY);

      ctx.globalAlpha = fadeIn * promptAlpha * 0.75;
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText('[ S ]  SCOREBOARD', cx, btnY + 30);

      ctx.fillStyle = '#ff6633';
      ctx.fillText('[ ESC ]  MAIN MENU', cx, btnY + 55);
    }

    // --- Floating particles (embers rising) ---
    ctx.globalAlpha = fadeIn * 0.6;
    for (let i = 0; i < 18; i++) {
      const seed = i * 137.5;
      const px = (seed * 7.3 + t * 0.4) % canvas.width;
      const py = canvas.height - ((seed * 3.1 + t * 1.2) % (canvas.height + 40));
      const size = 1 + (i % 3);
      const flick = 0.5 + 0.5 * Math.sin(t * 0.1 + i);
      ctx.fillStyle = i % 3 === 0 ? `rgba(255,100,0,${flick * 0.8})` : `rgba(255,200,50,${flick * 0.5})`;
      ctx.fillRect(Math.floor(px), Math.floor(py), size, size);
    }

    ctx.restore();
    this.gameOverAnimationTime++;
  }

  // Draw retro-style scoreboard
  drawScoreboard(ctx, canvas, scores) {
    const W = canvas.width;
    const H = canvas.height;

    // Dark purple gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#0d001a');
    gradient.addColorStop(0.5, '#1a003a');
    gradient.addColorStop(1, '#000010');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    this.drawRetroGrid(ctx, canvas);

    ctx.save();
    ctx.textAlign = 'center';

    // Title
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffff00';
    ctx.font = `bold ${Math.min(36, W * 0.05)}px "Courier New", monospace`;
    ctx.fillText('🏆  LEADERBOARD  🏆', W / 2, 62);
    ctx.shadowBlur = 0;

    // Subtitle: on-chain indicator
    ctx.fillStyle = '#66ffaa';
    ctx.font = `bold ${Math.min(12, W * 0.015)}px "Courier New", monospace`;
    ctx.fillText('⛓️  Avalanche Fuji Testnet (On-Chain)  ⛓️', W / 2, 82);

    // Column layout
    const pad  = W * 0.04;
    const cols = {
      rank:  pad,
      wallet: pad + 50,
      score: pad + 220,
      kills: pad + 350,
      gold:  pad + 430,
      level: pad + 510,
      date:  pad + 570,
    };
    const headerY = 106;
    const rowH = 34;

    // Header row
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aad4ff';
    ctx.font = `bold ${Math.min(13, W * 0.017)}px "Courier New", monospace`;
    ctx.fillText('#',      cols.rank,   headerY);
    ctx.fillText('WALLET', cols.wallet, headerY);
    ctx.fillText('SCORE',  cols.score,  headerY);
    ctx.fillText('KILLS',  cols.kills,  headerY);
    ctx.fillText('GOLD',   cols.gold,   headerY);
    ctx.fillText('LVL',    cols.level,  headerY);
    ctx.fillText('DATE',   cols.date,   headerY);

    // Divider
    ctx.strokeStyle = 'rgba(150,180,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, headerY + 8);
    ctx.lineTo(W - pad, headerY + 8);
    ctx.stroke();

    // Rows
    const topN = scores.slice(0, 10);
    if (topN.length === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#999';
      ctx.font = `bold 16px "Courier New", monospace`;
      ctx.fillText('Loading from Avalanche Fuji blockchain...', W / 2, H / 2 - 15);
      ctx.fillStyle = '#666';
      ctx.font = `14px "Courier New", monospace`;
      ctx.fillText('Mint an Achievement NFT to appear here!', W / 2, H / 2 + 15);
    } else {
      topN.forEach((s, i) => {
        const y = headerY + rowH + i * rowH;
        const rank = i + 1;

        // Row highlight for current session (top 3 medals)
        let rowColor = '#dde8f5';
        if (rank === 1) rowColor = '#ffe94d';
        else if (rank === 2) rowColor = '#d0d8e8';
        else if (rank === 3) rowColor = '#e8a87c';

        // Subtle row bg
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(pad - 4, y - rowH + 8, W - pad * 2 + 8, rowH);

        ctx.fillStyle = rowColor;
        ctx.font = `bold ${Math.min(13, W * 0.016)}px "Courier New", monospace`;
        ctx.textAlign = 'left';

        const medal = rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
        ctx.fillText(medal,                            cols.rank,   y);
        ctx.fillText(s.playerName || 'Anon',           cols.wallet, y);
        ctx.fillText((s.score || 0).toLocaleString(),  cols.score,  y);
        ctx.fillText(String(s.kills  || 0),            cols.kills,  y);
        ctx.fillText(String(s.gold   || 0),            cols.gold,   y);
        ctx.fillText(String(s.level  || 1),            cols.level,  y);
        ctx.fillText(s.date || '—',                    cols.date,   y);
      });
    }

    // Footer
    ctx.textAlign = 'center';
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.005);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#00ff88';
    ctx.font = `bold ${Math.min(16, W * 0.02)}px "Courier New", monospace`;
    ctx.fillText('Press ESC to return', W / 2, H - 30);
    ctx.restore();
  }

  // Draw help screen
  drawHelpScreen(ctx, canvas) {
    const W = canvas.width;
    const H = canvas.height;
    // Dark gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#060d1a');
    gradient.addColorStop(0.5, '#0f1e3a');
    gradient.addColorStop(1, '#05080f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.textAlign = 'center';

    // Title
    ctx.shadowColor = '#66ccff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#7dd3fc';
    ctx.font = `bold ${Math.min(34, W * 0.04)}px "Courier New", monospace`;
    ctx.fillText('HOW  TO  PLAY', W / 2, 54);
    ctx.shadowBlur = 0;

    // Two-column layout
    ctx.textAlign = 'left';
    const colW = Math.min(320, (W - 80) / 2);
    const col1X = W / 2 - colW - 20;
    const col2X = W / 2 + 20;
    const startY = 100;
    const lineH = 22;
    const fs = Math.min(13, W * 0.016);

    const drawSection = (x, y, title, lines) => {
      ctx.fillStyle = '#ffd700';
      ctx.font = `bold ${fs + 1}px "Courier New", monospace`;
      ctx.fillText(title, x, y);
      ctx.fillStyle = '#d4cfc0';
      ctx.font = `${fs}px "Courier New", monospace`;
      lines.forEach((line, i) => {
        ctx.fillText(line, x + 8, y + lineH * (i + 1));
      });
      return y + lineH * (lines.length + 1.5);
    };

    let y1 = startY;
    y1 = drawSection(col1X, y1, '🎮  MOVEMENT', ['W A S D — Move knight', 'Arrow keys also work']);
    y1 = drawSection(col1X, y1, '⚔️  COMBAT', ['J — Attack  (chain for combos)', 'K — Block / Defend', 'L — Dodge Roll']);
    y1 = drawSection(col1X, y1, '🎒  INTERACTION', ['E — Talk to villagers', 'F — Eat food / Heal', 'I — Open inventory', 'B — Build menu']);

    let y2 = startY;
    y2 = drawSection(col2X, y2, '🗺️  NAVIGATION', ['N — World map & fast-travel', 'ESC — Pause / Menu']);
    y2 = drawSection(col2X, y2, '🏗️  BUILDINGS', ['House — Health + gold', 'Blacksmith — Upgrades', 'Farm — Food', 'Mine — Materials', 'Tower — Map reveal', 'Portal — Fast travel + AVAX']);
    y2 = drawSection(col2X, y2, '🔗  BLOCKCHAIN', ['1-5 — AVAX actions', '6-9 — CIT token actions', 'C — Connect wallet']);

    // Back
    ctx.textAlign = 'center';
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.004);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#80ffa0';
    ctx.font = `bold ${Math.min(16, W * 0.02)}px "Courier New", monospace`;
    ctx.fillText('Press ESC to return', W / 2, H - 28);
    ctx.restore();
  }

  // Draw animated star field
  drawStarField(ctx, canvas, count = 100) {
    const time = Date.now() * 0.001;
    const n = count; // configurable density
    for (let i = 0; i < n; i++) {
      const x = (i * 123.456) % canvas.width;
      const y = (i * 234.567 + time * 20) % canvas.height;
      // Reduce per-frame alpha math to prevent heavy sin calls
      const alpha = 0.5 + 0.5 * Math.sin((i * 0.2) + (Math.floor(time * 2) * 0.5));
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Draw retro grid pattern
  drawRetroGrid(ctx, canvas) {
    const time = Date.now() * 0.001;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(time + x * 0.01) * 5, 0);
      ctx.lineTo(x + Math.sin(time + x * 0.01) * 5, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.cos(time + y * 0.01) * 3);
      ctx.lineTo(canvas.width, y + Math.cos(time + y * 0.01) * 3);
      ctx.stroke();
    }
  }

  // Format time in MM:SS format
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Calculate final score
  calculateFinalScore(gameStats) {
    const score = 
      (gameStats.experience || 0) * 1 +
      (gameStats.goldCollected || gameStats.gold || 0) * 2 +
      (gameStats.crystals || 0) * 100 +
      (gameStats.enemiesKilled || 0) * 50 +
      (gameStats.buildingsBuilt || 0) * 200 +
      (gameStats.achievementsUnlocked || 0) * 500;
    
    return Math.floor(score);
  }

  // Save score to localStorage — keeps only best score per wallet address
  // Only wallet-connected players are saved; Anonymous entries are excluded
  saveScore(playerName, score, level, timePlayed, gameStats) {
    // Do not save if no wallet connected
    if (!playerName || playerName === 'Anonymous') {
      return this.loadScores();
    }

    const wallet = playerName;
    const shortWallet = wallet.length > 12
      ? wallet.slice(0, 6) + '...' + wallet.slice(-4)
      : wallet;

    const scoreEntry = {
      playerName: shortWallet,
      fullAddress: wallet,
      score,
      level,
      timePlayed,
      date: new Date().toLocaleDateString(),
      kills: gameStats.enemiesKilled || 0,
      gold:  gameStats.goldCollected  || 0,
    };

    // Load & wipe any old-format or anonymous entries
    let scores = JSON.parse(localStorage.getItem('fantasyKnightScores') || '[]');
    scores = scores.filter(s => s.fullAddress && s.fullAddress !== undefined && s.fullAddress !== 'Anonymous');

    // Wallet user: one best-score entry per wallet
    const existingIdx = scores.findIndex(s => s.fullAddress === wallet);
    if (existingIdx !== -1) {
      if (score > scores[existingIdx].score) scores[existingIdx] = scoreEntry;
    } else {
      scores.push(scoreEntry);
    }

    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 50);
    localStorage.setItem('fantasyKnightScores', JSON.stringify(scores));
    return scores;
  }

  // Load scores from localStorage (strips legacy and anonymous entries)
  loadScores() {
    const raw = JSON.parse(localStorage.getItem('fantasyKnightScores') || '[]');
    const cleaned = raw.filter(s => s.fullAddress && s.fullAddress !== undefined && s.fullAddress !== 'Anonymous');
    if (cleaned.length !== raw.length) {
      localStorage.setItem('fantasyKnightScores', JSON.stringify(cleaned));
    }
    return cleaned;
  }

  // Handle keyboard input for screens
  handleInput(key) {
    switch (this.currentScreen) {
      case 'title':
        if (key === 'Enter') {
          this.currentScreen = 'playing';
          return 'startGame';
        } else if (key === 's' || key === 'S') {
          this.currentScreen = 'scoreboard';
          return 'showScoreboard';
        } else if (key === 'c' || key === 'C') {
          return 'connectWallet';
        } else if (key === 'h' || key === 'H') {
          this.currentScreen = 'help';
          return 'showHelp';
        }
        break;
        
      case 'gameOver':
        if (key === 'r' || key === 'R') {
          this.currentScreen = 'playing';
          this.retryCount++;
          return 'restartGame';
        } else if (key === 's' || key === 'S') {
          this.currentScreen = 'scoreboard';
          return 'showScoreboard';
        } else if (key === 'Escape') {
          this.currentScreen = 'title';
          return 'showTitle';
        }
        break;
        
      case 'scoreboard':
      case 'help':
        if (key === 'Escape') {
          this.currentScreen = 'title';
          return 'showTitle';
        }
        break;
    }
    return null;
  }

  // Trigger game over
  gameOver(gameStats, walletAddress) {
    this.currentScreen = 'gameOver';
    this.cachedGameStats = gameStats; // cache so draw always has correct data
    this.finalScore = this.calculateFinalScore(gameStats);
    this.gameOverAnimationTime = 0;
    
    // Save the score keyed by wallet
    this.saveScore(
      walletAddress || this.playerName || 'Anonymous',
      this.finalScore,
      gameStats.level || 1,
      gameStats.timePlayed || 0,
      gameStats
    );
  }

  // Reset for new game
  resetForNewGame() {
    this.gameOverAnimationTime = 0;
    this.finalScore = 0;
  }
}
