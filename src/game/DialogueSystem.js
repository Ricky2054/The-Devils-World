// ── Devil's World: Dialogue & Storyline System ──────────────────────
// Handles NPC dialogues, story cutscenes, and the opening narrative.

export const STORY_CHAPTERS = [
  {
    id: 'prologue',
    title: 'The Fall',
    scenes: [
      {
        speaker: null,
        portrait: null,
        text: 'Long ago the world was whole — one land, one people, one peace.',
        bg: 'dark',
      },
      {
        speaker: null,
        portrait: null,
        text: 'Then the Devil King shattered the seals, and darkness consumed everything.',
        bg: 'red',
      },
      {
        speaker: null,
        portrait: null,
        text: 'Villages burned. Kingdoms fell. Hope was lost...',
        bg: 'dark',
      },
      {
        speaker: null,
        portrait: null,
        text: '...until a lone knight rose from the ashes.',
        bg: 'gold',
      },
      {
        speaker: 'You',
        portrait: 'knight',
        text: "I won't let this world fall. Not while I still draw breath.",
        bg: 'dark',
      },
      {
        speaker: 'Elder Sage',
        portrait: 'npc',
        text: 'The seals can be restored, brave knight. Find the five fragments scattered across the Mother World.',
        bg: 'dark',
      },
      {
        speaker: 'Elder Sage',
        portrait: 'npc',
        text: 'Defeat the guardians. Rebuild the villages. And perhaps... break the curse once and for all.',
        bg: 'dark',
      },
    ],
  },
];

export const TUTORIAL_STEPS = [
  {
    id: 'move',
    text: 'Use  W A S D  to move your knight around the world.',
    highlight: 'movement',
    condition: null,            // shown at game start
    completedWhen: 'playerMoved',
  },
  {
    id: 'attack',
    text: 'Press  J  to attack. Chain attacks for combos!',
    highlight: 'combat',
    condition: 'playerMoved',
    completedWhen: 'playerAttacked',
  },
  {
    id: 'defend',
    text: 'Press  K  to block and  L  to dodge-roll.',
    highlight: 'combat',
    condition: 'playerAttacked',
    completedWhen: 'playerDefended',
  },
  {
    id: 'explore',
    text: 'Walk into the yellow sparkle to collect treasure.',
    highlight: 'explore',
    condition: 'playerDefended',
    completedWhen: 'treasureCollected',
  },
  {
    id: 'talk',
    text: 'Approach a villager and press  E  to talk.',
    highlight: 'npc',
    condition: 'treasureCollected',
    completedWhen: 'playerTalked',
  },
  {
    id: 'inventory',
    text: 'Press  I  to open your inventory,  B  to build structures.',
    highlight: 'ui',
    condition: 'playerTalked',
    completedWhen: 'inventoryOpened',
  },
  {
    id: 'worldmap',
    text: 'Press  N  to open the world map and fast-travel.',
    highlight: 'map',
    condition: 'inventoryOpened',
    completedWhen: 'mapOpened',
  },
  {
    id: 'done',
    text: "You're ready, knight. The world awaits!",
    highlight: null,
    condition: 'mapOpened',
    completedWhen: null,        // stays briefly, then auto-dismiss
  },
];

export const NPC_DIALOGUES = {
  elder: [
    'The Devil King grows stronger. We must find the fragments before he does.',
    'The forest to the east hides many secrets — and many dangers.',
    'Build a House first. You will need somewhere to rest and store your gold.',
    'Each fragment is guarded by a powerful beast. Prepare yourself.',
  ],
  blacksmith: [
    'Bring me iron and I can forge you a better blade.',
    'A sharp sword is the difference between glory and a grave.',
    'I once served the old kingdom. Now I serve whoever can pay.',
  ],
  merchant: [
    'Fresh supplies, just carted in! ... well, mostly fresh.',
    'Gold for goods, goods for survival. Fair deal, eh?',
    'Word is the mine to the north has rare crystals. If you dare.',
  ],
  villager: [
    'The nights grow darker. I do not sleep well anymore.',
    'My family fled from the eastern mountains when the beasts came.',
    'Thank you for protecting our village, knight.',
    'Have you seen the strange lights in the forest at midnight?',
  ],
  guard: [
    'Stay sharp, traveller. Goblins have been seen near the road.',
    'The tower on the hill gives a clear view of surrounding threats.',
    'If you build a watchtower, I can help keep the area safe.',
  ],
};

/**
 * Manages dialogue state: which scene is showing, auto-advance timers, etc.
 */
export class DialogueManager {
  constructor() {
    this.active = false;
    this.scenes = [];
    this.sceneIndex = 0;
    this.typingText = '';
    this.typingIndex = 0;
    this.typingSpeed = 2;          // chars per frame
    this.showContinuePrompt = false;
    this.onComplete = null;
    this.autoAdvanceTimer = 0;
  }

  /** Start a scripted cutscene (array of scene objects). */
  startCutscene(scenes, onComplete) {
    this.active = true;
    this.scenes = scenes;
    this.sceneIndex = 0;
    this.typingIndex = 0;
    this.showContinuePrompt = false;
    this.onComplete = onComplete || null;
    this.autoAdvanceTimer = 0;
  }

  /** Advance to the next line / finish typing. Returns true while still active. */
  advance() {
    if (!this.active) return false;
    const scene = this.scenes[this.sceneIndex];
    if (!scene) { this.finish(); return false; }

    // If still typing, complete the line instantly
    if (this.typingIndex < scene.text.length) {
      this.typingIndex = scene.text.length;
      this.showContinuePrompt = true;
      return true;
    }

    // Move to next scene
    this.sceneIndex++;
    if (this.sceneIndex >= this.scenes.length) {
      this.finish();
      return false;
    }
    this.typingIndex = 0;
    this.showContinuePrompt = false;
    return true;
  }

  /** Tick every frame — handles typing animation. */
  tick() {
    if (!this.active) return;
    const scene = this.scenes[this.sceneIndex];
    if (!scene) return;
    if (this.typingIndex < scene.text.length) {
      this.typingIndex = Math.min(scene.text.length, this.typingIndex + this.typingSpeed);
    } else {
      this.showContinuePrompt = true;
    }
  }

  /** Get current display data. */
  getCurrent() {
    if (!this.active || this.sceneIndex >= this.scenes.length) return null;
    const scene = this.scenes[this.sceneIndex];
    return {
      speaker: scene.speaker,
      portrait: scene.portrait,
      text: scene.text.substring(0, Math.floor(this.typingIndex)),
      fullText: scene.text,
      bg: scene.bg || 'dark',
      showContinue: this.showContinuePrompt,
      progress: `${this.sceneIndex + 1}/${this.scenes.length}`,
    };
  }

  finish() {
    this.active = false;
    this.scenes = [];
    this.sceneIndex = 0;
    if (this.onComplete) {
      const cb = this.onComplete;
      this.onComplete = null;
      cb();
    }
  }

  isActive() { return this.active; }
}

/**
 * Tracks tutorial step progression.
 */
export class TutorialManager {
  constructor() {
    this.steps = TUTORIAL_STEPS;
    this.completedFlags = new Set();
    this.currentStepIndex = 0;
    this.dismissed = false;
    this.autoDismissTimer = 0;
    this.load();
  }

  /** Mark a flag as completed (e.g. 'playerMoved'). */
  complete(flag) {
    if (!flag) return;
    this.completedFlags.add(flag);
    this.save();
    this._advanceStep();
  }

  _advanceStep() {
    while (this.currentStepIndex < this.steps.length) {
      const step = this.steps[this.currentStepIndex];
      if (step.completedWhen && this.completedFlags.has(step.completedWhen)) {
        this.currentStepIndex++;
      } else {
        break;
      }
    }
    // If we reached the final "done" step, auto-dismiss after a few seconds
    if (this.currentStepIndex >= this.steps.length - 1) {
      this.autoDismissTimer = 180; // ~3s at 60fps
    }
  }

  /** Get the current step to display (or null if tutorial complete). */
  getCurrentStep() {
    if (this.dismissed) return null;
    if (this.currentStepIndex >= this.steps.length) return null;
    const step = this.steps[this.currentStepIndex];
    // Check if the condition is met to show this step
    if (step.condition && !this.completedFlags.has(step.condition)) return null;
    return step;
  }

  tick() {
    if (this.autoDismissTimer > 0) {
      this.autoDismissTimer--;
      if (this.autoDismissTimer <= 0) {
        this.dismissed = true;
        this.save();
      }
    }
  }

  isComplete() {
    return this.dismissed || this.currentStepIndex >= this.steps.length;
  }

  save() {
    try {
      localStorage.setItem('dw_tutorial', JSON.stringify({
        flags: Array.from(this.completedFlags),
        step: this.currentStepIndex,
        dismissed: this.dismissed,
      }));
    } catch (_) {}
  }

  load() {
    try {
      const raw = localStorage.getItem('dw_tutorial');
      if (!raw) return;
      const data = JSON.parse(raw);
      this.completedFlags = new Set(data.flags || []);
      this.currentStepIndex = data.step || 0;
      this.dismissed = data.dismissed || false;
    } catch (_) {}
  }

  /** Reset tutorial (for new game). */
  reset() {
    this.completedFlags.clear();
    this.currentStepIndex = 0;
    this.dismissed = false;
    this.autoDismissTimer = 0;
    localStorage.removeItem('dw_tutorial');
  }
}
