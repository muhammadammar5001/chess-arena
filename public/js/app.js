/**
 * Owl's Gambit — App Controller
 * Main application logic: screen management, board rendering, game flow.
 */

class App {
  constructor() {
    this.engine = null;
    this.ai = null;
    this.multiplayer = null;
    this.gameMode = null; // 'ai' or 'online'
    this.playerColor = 'white';
    this.selectedSquare = null;
    this.legalMoves = [];
    this.pendingPromotion = null;
    this.boardFlipped = false;
    this.timerInterval = null;
    this.timers = { white: null, black: null };
    this.lastMoveTime = null;
    this.timerMinutes = null;
    this.lastMove = null;
    this.audioCtx = null;
    this.selectedAIColor = 'white';
    this.activeStakeDeducted = 0;
    this.pendingJoinData = null;
    this.soundMuted = false;
    this.musicEnabled = true;
    this.bgMusicRunning = false;
    this.bgMusicNodes = [];
    this.bgMusicGain = null;
    this.isAnimatingMove = false;
    this.matchType = 'robin'; // 'standard' or 'robin'
    
    try {
      let saved = JSON.parse(localStorage.getItem('owl_selected_abilities'));
      if (Array.isArray(saved)) {
        saved = saved.filter(s => ['swap', 'freeze', 'second', 'shield', 'jump'].includes(s));
        if (saved.length > 2) saved = saved.slice(0, 2);
        this.selectedAbilities = (saved.length === 2) ? saved : ['swap', 'freeze'];
      } else {
        this.selectedAbilities = ['swap', 'freeze'];
      }
    } catch(e) {
      this.selectedAbilities = ['swap', 'freeze'];
    }
    
    this.setupDraggableChat();
    this.pieceSymbols = {
      white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
      black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };

    this.init();
  }

  setGameMode(mode) {
    this.matchType = 'robin';
    this.syncAbilitiesUI();
  }

  init() {
    if (!this.walletAddress) {
      this.walletAddress = localStorage.getItem('owl_guest_id') || ('guest_' + Math.floor(1000 + Math.random() * 9000));
      localStorage.setItem('owl_guest_id', this.walletAddress);
    }
    if (window.AdService) {
      window.AdService.init();
    }
    // Ensure abilities loaded from localStorage are displayed and synced on UI immediately
    this.syncAbilitiesUI();

    // Enter key on room code input
    const roomInput = document.getElementById('room-code-input');
    if (roomInput) {
      roomInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.joinRoom();
      });
    }

    // Join Room card click — expand/collapse the code input
    const joinCard = document.getElementById('join-room-card');
    const joinExpand = document.getElementById('join-room-expand');
    if (joinCard && joinExpand) {
      joinCard.addEventListener('click', () => {
        const open = joinExpand.classList.toggle('open');
        joinCard.classList.toggle('expanded', open);
        if (open && roomInput) setTimeout(() => roomInput.focus(), 150);
      });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setTimeout(() => {
        this.showScreen('screen-room');
        if (roomInput) roomInput.value = roomFromUrl.toUpperCase();
        this.joinRoom();
      }, 500);
    }

    // Enter key on chat input
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.sendChatMessage();
      });
    }

    // Prevent zoom on double tap
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - (this.lastTap || 0) < 300) {
        e.preventDefault();
      }
      this.lastTap = now;
    }, { passive: false });

    // ── Start ambient music on first user gesture (browser requires it) ──────
    const startMusicOnFirstGesture = () => {
      document.removeEventListener('click',     startMusicOnFirstGesture, true);
      document.removeEventListener('touchstart', startMusicOnFirstGesture, true);
      document.removeEventListener('keydown',   startMusicOnFirstGesture, true);
      if (this.musicEnabled && !this.bgMusicRunning) {
        this.startBgMusic();
      }
    };
    document.addEventListener('click',      startMusicOnFirstGesture, { capture: true, once: true });
    document.addEventListener('touchstart', startMusicOnFirstGesture, { capture: true, once: true });
    document.addEventListener('keydown',    startMusicOnFirstGesture, { capture: true, once: true });
  }

  // ─── Audio ─────────────────────────────────────────

  initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  playSound(type) {
    if (this.soundMuted) return;
    try {
      this.initAudio();
      const ctx = this.audioCtx;
      if (!ctx) return;

      switch (type) {

        case 'freeze': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
          break;
        }

          case 'tweet': {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.12);
            break;
          }
        case 'move': {
          // Satisfying wooden piece placement "tock"
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(460, ctx.currentTime);
          osc1.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.075);
          gain1.gain.setValueAtTime(0.18, ctx.currentTime);
          gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.075);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(ctx.currentTime);
          osc1.stop(ctx.currentTime + 0.075);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(280, ctx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.06);
          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.06);
          break;
        }

        case 'capture': {
          // Layer 1: Sub-bass punch (the heavy impact "THUMP")
          const subOsc = ctx.createOscillator();
          const subGain = ctx.createGain();
          subOsc.type = 'sine';
          subOsc.frequency.setValueAtTime(160, ctx.currentTime);
          subOsc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.2);
          subGain.gain.setValueAtTime(0.38, ctx.currentTime);
          subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          subOsc.connect(subGain);
          subGain.connect(ctx.destination);
          subOsc.start(ctx.currentTime);
          subOsc.stop(ctx.currentTime + 0.2);

          // Layer 2: Metallic sword blade slash / strike clash
          const metalOsc = ctx.createOscillator();
          const metalGain = ctx.createGain();
          metalOsc.type = 'triangle';
          metalOsc.frequency.setValueAtTime(820, ctx.currentTime);
          metalOsc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.15);
          metalGain.gain.setValueAtTime(0.25, ctx.currentTime);
          metalGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          metalOsc.connect(metalGain);
          metalGain.connect(ctx.destination);
          metalOsc.start(ctx.currentTime);
          metalOsc.stop(ctx.currentTime + 0.15);

          // Layer 3: High resonance strike ring (sword clink)
          const ringOsc = ctx.createOscillator();
          const ringGain = ctx.createGain();
          ringOsc.type = 'square';
          ringOsc.frequency.setValueAtTime(1240, ctx.currentTime);
          ringOsc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.1);
          ringGain.gain.setValueAtTime(0.09, ctx.currentTime);
          ringGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
          ringOsc.connect(ringGain);
          ringGain.connect(ctx.destination);
          ringOsc.start(ctx.currentTime);
          ringOsc.stop(ctx.currentTime + 0.1);

          // Layer 4: Impact noise burst (crunch/crack of physical impact)
          try {
            const bufferSize = Math.floor(ctx.sampleRate * 0.08);
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1400;
            filter.Q.value = 2.5;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.3, ctx.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(ctx.currentTime);
          } catch (e) {
            // Audio buffer fallback
          }
          break;
        }

        case 'check': {
          // Urgent double-tone warning
          [0, 0.08].forEach((delay, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(idx === 0 ? 540 : 820, ctx.currentTime + delay);
            gain.gain.setValueAtTime(0.12, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.18);
          });
          break;
        }

        case 'gameover': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 320;
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.6);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.6);
          break;
        }

        case 'your-turn': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.25);
          break;
        }
      }
    } catch {
      // Audio not available
    }
  }

  // ─── Screen Management ─────────────────────────────

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) {
      // Force reflow for animation
      target.offsetHeight;
      target.classList.add('active');
    }

    // Show/hide web3 header on home/stake screens
    const web3Header = document.getElementById('web3-header');
    if (web3Header) {
      if (screenId === 'screen-home' || screenId === 'screen-stake' || screenId === 'screen-ai-select' || screenId === 'screen-room') {
        web3Header.style.display = 'flex';
      } else {
        web3Header.style.display = 'none';
      }
    }
  }

  // ─── AI Game ───────────────────────────────────────

  showAIDifficultySelect() {
    this.showScreen('screen-ai-select');
  }

  selectColor(color) {
    this.selectedAIColor = color;
    document.getElementById('color-white').classList.toggle('active', color === 'white');
    document.getElementById('color-black').classList.toggle('active', color === 'black');
  }

  startAIGame(difficulty) {
    this.opponentAvatarSrc = null;
    this.gameMode = 'ai';
    this.playerColor = this.selectedAIColor;
    this.boardFlipped = this.playerColor === 'black';
    this.engine = new ChessEngine();
    this.ai = new AIEngine(difficulty);
    this.lastMove = null;
    this.gameStartTime = Date.now();
    this.timers = { white: null, black: null };

    this.setupGameUI('You', `AI (${difficulty})`, false);
    this.startBgMusic();
    this.showScreen('screen-game');
        setTimeout(() => this.startBgMusic(), 500);
    this.renderBoard();
    this.updatePlayerBars();

    // If player is black, AI moves first
    if (this.playerColor === 'black') {
      setTimeout(() => this.makeAIMove(), 500);
    }
  }

  makeAIMove() {
    if (this.engine.gameOver) return;

    const move = this.ai.getBestMove(this.engine);
    if (!move) return;

    const result = this.engine.makeMove(move.fromRow, move.fromCol, move.row, move.col, move.promotion || null);
    if (result) {
      this.animateMoveAndApply(result, () => {
        if (this.engine.gameOver) {
          this.playSound('gameover');
          setTimeout(() => this.showGameOver(), 500);
        }
      });
    }
  }

  // ─── Play with Friend & Staking Logic ───────────────

  showPlayFriendScreen() {
    this.showScreen('screen-room');
  }

  onCreateRoomClick() {
    const timerSelect = document.getElementById('timer-select');
    this.timerMinutes = timerSelect && timerSelect.value ? parseInt(timerSelect.value) : null;
    this.showStakeScreen('create_room');
  }

  showStakeScreen(action) {
    this.stakeAction = action;
    this.currentStake = 0;

    const titleEl = document.getElementById('stake-screen-title');
    const descEl = document.getElementById('stake-screen-desc');
    const confirmBtn = document.getElementById('btn-confirm-stake');

    if (action === 'create_room') {
      if (titleEl) titleEl.textContent = 'Room Stake';
      if (descEl) descEl.textContent = 'Choose the wager for your room. Your friend will match this stake.';
      if (confirmBtn) confirmBtn.textContent = 'Confirm & Create Room';
    } else if (action === 'invite') {
      if (titleEl) titleEl.textContent = `Invite ${this.pendingInviteTarget}`;
      if (descEl) descEl.textContent = `Choose the wager for your match against ${this.pendingInviteTarget}.`;
      if (confirmBtn) confirmBtn.textContent = 'Send Invite';
    } else {
      if (titleEl) titleEl.textContent = 'Stake to Play';
      if (descEl) descEl.textContent = 'Select the amount of USDT to wager. Winner takes the pool!';
      if (confirmBtn) confirmBtn.textContent = 'Confirm & Find Match';
    }

    this.updateStakeUI();
    this.showScreen('screen-stake');
  }

  onStakeBackClick() {
    if (this.stakeAction === 'create_room') {
      this.showScreen('screen-room');
    } else {
      this.showMatchmakingScreen();
    }
  }

  selectStake(amount) {
    this.currentStake = amount;
    this.updateStakeUI();
  }

  updateStakeUI() {
    const btns = document.querySelectorAll('.stake-btn');
    btns.forEach(btn => {
      const amtText = btn.querySelector('.stake-amount').textContent;
      const amt = parseInt(amtText.replace('$', '').trim());
      btn.classList.toggle('active', amt === this.currentStake);
    });
    const poolEl = document.getElementById('preview-prize-pool');
    if (poolEl) poolEl.textContent = this.currentStake > 0 ? ('$' + (this.currentStake * 2)) : '****';
  }

  confirmStake() {
    if (this.currentStake === 0) {
      this.showToast('Please select a stake amount first');
      return;
    }
    // Check balance
    const balanceEl = document.getElementById('profile-wallet-balance');
    let currentBalance = parseInt(balanceEl.textContent.replace(/,/g, ''));
    if (currentBalance < this.currentStake) {
      this.showToast('Insufficient $USDT balance!');
      return;
    }

    // Deduct from mock wallet
    currentBalance -= this.currentStake;
    balanceEl.textContent = currentBalance.toLocaleString();
    this.activeStakeDeducted = this.currentStake;

    // Show active prize pool in game
    document.getElementById('game-prize-amount').textContent = (this.currentStake * 2) + ' $USDT';
    document.getElementById('active-prize-pool').classList.remove('hidden');

    if (this.stakeAction === 'matchmaking') {
      this.findMatch();
    } else if (this.stakeAction === 'create_room') {
      this.createRoom();
    } else if (this.stakeAction === 'invite') {
      this.pendingInviteMode = this.matchType || 'standard';
      this.pendingInviteStake = this.currentStake;
      if (this.multiplayer) {
        this.multiplayer.createRoom(this.timerMinutes, this.currentStake, this.pendingInviteMode);
      }
      if (this.pendingInviteBtn) {
        const btn = this.pendingInviteBtn;
        btn.innerHTML = 'Invited ✓';
        btn.classList.add('invited');
        setTimeout(() => {
          if (btn) {
            btn.innerHTML = 'Invite';
            btn.classList.remove('invited');
          }
        }, 5000);
      }
      this.showToast(`Invitation sent to ${this.pendingInviteTarget}`);
    }
  }




  startSlotMachine() {
    const machine = document.getElementById('avatar-slot-machine');
    const animationEl = document.getElementById('matchmaking-animation');
    const waitingInfo = document.getElementById('waiting-room-info');
    const spinner = document.getElementById('waiting-spinner-container');
    const cancelBtn = document.getElementById('btn-cancel-waiting');

    // Show animation, hide room info
    if (animationEl) animationEl.classList.remove('hidden');
    if (waitingInfo) waitingInfo.classList.add('hidden');
    if (spinner) spinner.classList.add('hidden');

    const titleEl = document.getElementById('waiting-title');
    const subtitleEl = document.getElementById('waiting-subtitle');
    if (titleEl) titleEl.textContent = 'Finding opponent...';
    if (subtitleEl) subtitleEl.textContent = 'Searching for the best match for you';
    if (cancelBtn) cancelBtn.style.display = 'block';

    if (!machine) return;

    // Build avatar strip (40 avatars using DiceBear)
    const customBots = ['bot1.png.jpg', 'bot2.png.jpg', 'bot3.png.jpg', 'bot4.png.jpg', 'bot5.png.jpg', 'bot6.png.jpg'];
    const seeds = [];
    for (let i = 0; i < 40; i++) {
        seeds.push(customBots[i % customBots.length]);
    }

    machine.innerHTML = '';
    seeds.forEach((seed, index) => {
      const item = document.createElement('div');
      item.className = 'slot-avatar-item';
      item.innerHTML = `<img src="/assets/${seed}" alt="Bot ${index}" loading="lazy" style="object-fit:cover; border-radius:50%; width:100%; height:100%;">`;
      machine.appendChild(item);
    });

    // Rapid CSS-transition spinning: pick random index every 100ms
    const itemH = 88; // height of each slot item in px
    const total = seeds.length;
    let idx = 0;
    machine.style.transition = 'none';
    machine.style.transform = 'translateY(0px)';

    machine.classList.add('spinning');
    this.slotInterval = setInterval(() => {
      idx = Math.floor(Math.random() * (total - 1));
      machine.style.transition = 'transform 0.08s linear';
      machine.style.transform = `translateY(-${idx * itemH}px)`;
    }, 110);

    // Cycle status messages
    const messages = [
      'Scanning ranked players...',
      'Matching skill levels...',
      'Finding worthy opponent...',
      'Almost there...',
      'Locking in your match...'
    ];
    let msgIdx = 0;
    this.statusInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      const el = document.getElementById('roulette-status-text');
      if (el) el.textContent = messages[msgIdx];
    }, 2200);
  }

  stopSlotMachine(opponentName, callback) {
    if (this.slotInterval) {
      clearInterval(this.slotInterval);
      this.slotInterval = null;
    }
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    const machine = document.getElementById('avatar-slot-machine');
    if (machine) {
      // Slow decelerate to final avatar
      machine.classList.remove('spinning');
      machine.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      machine.style.transform = 'translateY(0px)';
      // Replace with opponent avatar
      setTimeout(() => {
        let botNum = Math.floor(Math.random() * 6) + 1;
        if (this.multiplayer && this.multiplayer.gameId) {
          let hash = 0;
          let seed = this.multiplayer.gameId;
          for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash = hash & hash;
          }
          botNum = (Math.abs(hash) % 6) + 1;
        }
        const finalBot = 'bot' + botNum + '.png.jpg';
        machine.innerHTML = `<div class="slot-avatar-item matched"><img src="/assets/${finalBot}" alt="${opponentName || 'Opponent'}" style="object-fit:cover; border-radius:50%; width:100%; height:100%;"></div>`;
        
        // Save the chosen bot avatar so we can use it in the game UI
        this.opponentAvatarSrc = '/assets/' + finalBot;
      }, 400);
    }

    const nameEl = document.getElementById('match-opponent-name');
    const ratingEl = document.getElementById('match-opponent-rating');
    if (nameEl) nameEl.textContent = opponentName || 'Opponent';
    if (ratingEl) ratingEl.textContent = Math.floor(Math.random() * 300 + 1100).toString();

    const titleEl = document.getElementById('waiting-title');
    const subtitleEl = document.getElementById('waiting-subtitle');
    if (titleEl) titleEl.textContent = 'Match Found!';
    if (subtitleEl) subtitleEl.textContent = 'Preparing your game...';

    const statusEl = document.getElementById('roulette-status-text');
    if (statusEl) statusEl.textContent = 'Match confirmed!';

    const cancelBtn = document.getElementById('btn-cancel-waiting');
    if (cancelBtn) cancelBtn.style.display = 'none';

    setTimeout(() => { if (callback) callback(); }, 1500);
  }

  // ─── Online Game ───────────────────────────────────

  async findMatch() {
    if (!this.multiplayer) {
      this.multiplayer = new MultiplayerClient();
      this.setupMultiplayerCallbacks();
    
    }

    const timerSelect = document.getElementById('timer-select');
    const timerValue = timerSelect && timerSelect.value ? parseInt(timerSelect.value) : null;
    this.timerMinutes = timerValue;

    // Show searching screen immediately for instant feedback
    this.showScreen('screen-waiting');
    this.startSlotMachine();

    try {
      await this.multiplayer.connect();
      this.multiplayer.findMatch(timerValue, this.currentStake, this.matchType, this.matchType === 'robin' ? (this.selectedAbilities || ['swap', 'freeze']) : []);
    } catch {
      if (this.slotInterval) clearInterval(this.slotInterval);
      if (this.statusInterval) clearInterval(this.statusInterval);
      this.showToast('Failed to connect to server');
      this.showScreen('screen-home');
    }
  }

  async createRoom() {
    if (!this.multiplayer) {
      this.multiplayer = new MultiplayerClient();
      this.setupMultiplayerCallbacks();
    }

    try {
      await this.multiplayer.connect();
      const timerSelect = document.getElementById('timer-select');
      const timerValue = timerSelect && timerSelect.value ? parseInt(timerSelect.value) : null;
      this.timerMinutes = timerValue;
      this.multiplayer.createRoom(timerValue, this.currentStake || 0, this.matchType, this.matchType === 'robin' ? (this.selectedAbilities || ['swap', 'freeze']) : []);
    } catch {
      if (this.activeStakeDeducted > 0) {
        const balanceEl = document.getElementById('profile-wallet-balance');
        if (balanceEl) {
          let currentBalance = parseInt(balanceEl.textContent.replace(/,/g, ''));
          currentBalance += this.activeStakeDeducted;
          balanceEl.textContent = currentBalance.toLocaleString();
        }
        this.activeStakeDeducted = 0;
      }
      this.showToast('Failed to connect to server');
    }
  }

  async joinRoom() {
    const input = document.getElementById('room-code-input');
    const code = input ? input.value.trim().toUpperCase() : '';

    if (code.length !== 6) {
      this.showToast('Enter a 6-character room code');
      return;
    }

    if (!this.multiplayer) {
      this.multiplayer = new MultiplayerClient();
      this.setupMultiplayerCallbacks();
    }

    try {
      await this.multiplayer.connect();
      this.showToast('Checking room...');
      this.multiplayer.checkRoom(code);
    } catch {
      this.showToast('Failed to connect to server');
    }
  }

  showJoinRoomConfirm(data) {
    const stake = data.stake || 0;
    const roomCode = data.roomCode;
    const timerMinutes = data.timerMinutes;
    const balanceEl = document.getElementById('profile-wallet-balance');
    const currentBalance = balanceEl ? parseInt(balanceEl.textContent.replace(/,/g, '')) : 0;

    if (stake > 0 && currentBalance < stake) {
      this.showToast('Insufficient $OWL balance to join this room!');
      return;
    }

    // Populate the styled Room Info modal
    const codeEl = document.getElementById('join-room-code-display');
    const timerEl = document.getElementById('join-room-timer-display');
    const stakeEl = document.getElementById('join-room-stake-display');
    const poolEl = document.getElementById('join-room-pool-display');
    const balEl = document.getElementById('join-user-balance-display');

    if (codeEl) codeEl.textContent = roomCode;
    if (timerEl) timerEl.textContent = timerMinutes ? timerMinutes + ' min' : 'No timer';
    if (stakeEl) stakeEl.textContent = stake > 0 ? stake + ' $USDT' : 'Free';
    if (poolEl) poolEl.textContent = stake > 0 ? (stake * 2) + ' $USDT' : 'No prize';
    if (balEl) balEl.textContent = currentBalance.toLocaleString() + ' $USDT';

    // Wire up the join button (override onclick to use pendingJoinData)
    const joinBtn = document.getElementById('btn-join-confirm');
    if (joinBtn) joinBtn.onclick = () => this.confirmJoinRoom();

    this.showModal('modal-join-confirm');
  }

  confirmJoinRoom() {
    if (!this.pendingJoinData) return;
    const { roomCode, stake } = this.pendingJoinData;

    if (stake > 0) {
      const balanceEl = document.getElementById('profile-wallet-balance');
      let currentBalance = balanceEl ? parseInt(balanceEl.textContent.replace(/,/g, '')) : 0;
      if (currentBalance < stake) {
        this.showToast('Insufficient $USDT balance!');
        return;
      }
      currentBalance -= stake;
      balanceEl.textContent = currentBalance.toLocaleString();
      this.activeStakeDeducted = stake;
      this.currentStake = stake;

      document.getElementById('game-prize-amount').textContent = (stake * 2) + ' $USDT';
      document.getElementById('active-prize-pool').classList.remove('hidden');
    }

    this.hideModal('modal-join-confirm');
    this.pendingJoinData = null;
    this.multiplayer.joinRoom(roomCode, this.selectedAbilities || ['swap', 'freeze']);
  }

  cancelJoinRoom() {
    this.hideModal('modal-join-confirm');
    this.pendingJoinData = null;
  }

  showSpectateModal() {
    this.showModal('modal-spectate');
    setTimeout(() => document.getElementById('spectate-code-input')?.focus(), 150);
  }

  async submitSpectateCode() {
    const input = document.getElementById('spectate-code-input');
    const code = input.value.trim().toUpperCase();

    if (code.length !== 6) {
      this.showToast('Enter a 6-character room code');
      return;
    }

    if (!this.multiplayer) {
      this.multiplayer = new MultiplayerClient();
      this.setupMultiplayerCallbacks();
    }

    try {
      this.hideModal('modal-spectate');
      await this.multiplayer.connect();
      this.multiplayer.spectateRoom(code);
    } catch {
      this.showToast('Failed to connect to server');
    }
  }

  sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !this.multiplayer) return;

    this.multiplayer.sendChatMessage(text);
    input.value = '';
  }

  setupMultiplayerCallbacks() {
    const mp = this.multiplayer;

    mp.onInviteRejected = () => {
      this.showToast("Your friend didn't accept the invite.");
      this.cancelWaiting();
    };

    mp.onRoomCreated = (code, color) => {
      document.getElementById('display-room-code').textContent = code;
      document.getElementById('waiting-title').textContent = 'Room Created! Waiting for opponent...';
      
      if (this.pendingInviteTarget) {
        console.log('[DEBUG] Emitting invite_friend for:', this.pendingInviteTarget);
        this.multiplayer.send({
          type: 'invite_friend',
          targetUsername: this.pendingInviteTarget,
          roomCode: code,
          stake: this.pendingInviteStake,
          mode: this.pendingInviteMode
        });
        document.getElementById('waiting-title').textContent = `Waiting for ${this.pendingInviteTarget}...`;
        this.pendingInviteTarget = null;
      }
      document.getElementById('waiting-room-info').style.display = 'block';
      document.getElementById('waiting-room-info').classList.remove('hidden');
      document.getElementById('waiting-spinner-container').classList.remove('hidden');
      
      const animContainer = document.getElementById('matchmaking-animation');
      if (animContainer) animContainer.classList.add('hidden');
      
      const cancelBtn = document.getElementById('btn-cancel-waiting');
      if (cancelBtn) cancelBtn.style.display = 'block';

      this.showScreen('screen-waiting');
    };

    mp.onWaitingForMatch = () => {
      this.showScreen('screen-waiting');
      this.startSlotMachine();
    };

    mp.onCheckRoomResult = (data) => {
      if (!data.success) {
        this.showToast(data.message || 'Room not found');
        return;
      }

      this.pendingJoinData = data;
      // Show join confirmation popup with stake info
      this.showJoinRoomConfirm(data);
    };

    mp.onGameStart = (color, opponent, timerMinutes, stake) => {
      try {
        console.log("onGameStart triggered with", color, opponent, timerMinutes, stake);
        this.gameMode = 'online';
        this.playerColor = color;
        this.boardFlipped = color === 'black';
        this.engine = new ChessEngine();
        this.lastMove = null;
        if (!this.gameStartTime) this.gameStartTime = Date.now();
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.innerHTML = ''; 

        if (stake) {
          this.currentStake = stake;
          const prizeEl = document.getElementById('game-prize-amount');
          if (prizeEl) prizeEl.textContent = (stake * 2) + ' $USDT';
          const poolEl = document.getElementById('active-prize-pool');
          if (poolEl) poolEl.classList.remove('hidden');
        }
        
        const resignBtn = document.getElementById('btn-ingame-resign');
        if (resignBtn) resignBtn.classList.remove('hidden');
        const drawBtn = document.getElementById('btn-ingame-draw');
        if (drawBtn) drawBtn.classList.remove('hidden');
        const undoBtn = document.getElementById('btn-ingame-undo');
        if (undoBtn) undoBtn.classList.remove('hidden');
        const hintBtn = document.getElementById('btn-ingame-hint');
        if (hintBtn) hintBtn.classList.remove('hidden');
        const spectateBtn = document.getElementById('btn-leave-spectate');
        if (spectateBtn) spectateBtn.classList.add('hidden');

        const youName = `You (${color === 'white' ? '♔' : '♚'})`;
        const oppName = `${opponent || 'Opponent'} (${color === 'white' ? '♚' : '♔'})`;

        if (timerMinutes) {
          this.timerMinutes = timerMinutes;
        }
        if (this.timerMinutes) {
          this.timers.white = this.timerMinutes * 60 * 1000;
          this.timers.black = this.timerMinutes * 60 * 1000;
        } else {
          this.timers.white = null;
          this.timers.black = null;
        }

        this.setupGameUI(youName, oppName, true);
        
        const startGame = () => {
          try {
            const topAvatar = document.getElementById('top-player-avatar');
            if (topAvatar) {
               let botNum = 4;
               if (this.multiplayer && this.multiplayer.gameId) {
                 let hash = 0;
                 let seed = this.multiplayer.gameId;
                 for (let i = 0; i < seed.length; i++) {
                   hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                   hash = hash & hash;
                 }
                 botNum = (Math.abs(hash) % 6) + 1;
               }
               topAvatar.src = this.opponentAvatarSrc || ('/assets/bot' + botNum + '.png.jpg');
            }
            this.showScreen('screen-game');
            setTimeout(() => this.startBgMusic(), 500);
            this.renderBoard();
            this.updatePlayerBars();
            this.startTimerTick();
          } catch(err) {
            console.error("startGame inner error:", err);
          }
        };

        const animContainer = document.getElementById('matchmaking-animation');
        if (animContainer && !animContainer.classList.contains('hidden') && typeof this.stopSlotMachine === 'function') {
            this.stopSlotMachine(); 
            setTimeout(() => {
                if (typeof this.showMatchmakingFound === 'function') {
                  this.showMatchmakingFound(opponent, '/assets/bot4.png.jpg');
                }
                setTimeout(startGame, 3000); 
            }, 1000);
        } else {
            if (animContainer) animContainer.classList.add('hidden');
            startGame();
        }
        
        if (typeof this.initAbilitiesPanel === 'function') {
          this.initAbilitiesPanel();
        }
      } catch (error) {
        console.error("onGameStart wrapper error:", error);
      }
    };

    
      mp.onAbilityUsed = (ability, args, color) => {
        if (this.engine.validateAbility(ability, args, color)) {
            let abilityName = ability;
            if (ability === 'second') abilityName = 'Second Chance';
            if (ability === 'freeze') abilityName = 'Piece Freeze';
            if (ability === 'swap') abilityName = 'Tactical Swap';
            if (ability === 'shield') abilityName = 'Divine Shield';
            if (ability === 'jump') abilityName = 'Pegasus Jump';
            
            this.showToast((color === this.playerColor ? 'You' : 'Opponent') + ' used ' + abilityName + '!');
            if (ability === 'freeze') {
                this.playSound('freeze');
            }
            
            if (ability === 'second' || ability === 'freeze' || ability === 'swap' || ability === 'jump' || ability === 'shield') {
                if (ability === 'second') this.lastMove = null;
                // Move history is rolled back inside engine
                this.updateMoveHistoryUI();
            this.updatePlayerBars();
            }
            this.hintCountInMatch = 0;
    this.setupAbilitiesUI(); // Re-render ability buttons (to gray them out if used)
            this.renderBoard();
            this.updatePlayerBars();
        }
      };
      
      mp.onOpponentMove = (from, to, promotion) => {
      const fromPos = ChessEngine.fromAlgebraic(from);
      const toPos = ChessEngine.fromAlgebraic(to);
      const result = this.engine.makeMove(fromPos.row, fromPos.col, toPos.row, toPos.col, promotion);

      if (result) {
        this.animateMoveAndApply(result, () => {
          if (this.engine.gameOver) {
            this.playSound('gameover');
            setTimeout(() => this.showGameOver(), 500);
          }
        });
      }
    };

    mp.onTimerSync = (white, black) => {
      this.timers.white = white;
      this.timers.black = black;
      this.lastMoveTime = Date.now();
      this.updateTimerDisplay();
    };

    mp.onOpponentDisconnected = () => {
      this.showConnectionStatus('disconnected');
      this.showToast('Opponent disconnected');
    };

    mp.onOpponentReconnected = () => {
      this.hideConnectionStatus();
      this.showToast('Opponent reconnected');
    };

    mp.onOpponentResigned = () => {
      // Handled by game_over event directly
    };

    // --- Friend System Callbacks ---
    mp.onFriendsList = (friends) => this.renderFriendsList(friends);
    
    mp.onGameInvite = (data) => {
      const popup = document.getElementById('game-invite-popup');
      if (!popup) return;
      document.getElementById('invite-sender-name').textContent = data.sender;
      document.getElementById('invite-amount').textContent = `${data.stake} $USDC`;
      document.getElementById('invite-mode').textContent = data.mode.charAt(0).toUpperCase() + data.mode.slice(1);
      
      this.pendingIncomingInviteRoom = data.roomCode;
      popup.classList.remove('hidden');
      
      if (this.inviteTimeout) clearTimeout(this.inviteTimeout);
      this.inviteTimeout = setTimeout(() => {
        this.rejectInvite();
        this.showToast('Invite expired');
      }, 10000);
    };
    mp.onFriendRequestsList = (requests) => this.renderFriendRequests(requests);
    mp.onFriendRequestReceived = (req) => {
      this.showToast(`New friend request from ${req.username}!`);
      const badge = document.getElementById('friend-requests-badge');
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = (parseInt(badge.textContent || '0') + 1).toString();
      }
    };
    mp.onFriendRequestSuccess = (msg) => this.showToast(msg);
    mp.onFriendRequestError = (msg) => this.showToast(msg);

    // Handle reconnection with full state recovery
    mp.onGameReconnect = (data) => {
      this.gameMode = 'online';
      this.playerColor = data.color;
      this.boardFlipped = data.color === 'black';
      this.engine = new ChessEngine();
        this.lastMove = null;
        if (!this.gameStartTime) this.gameStartTime = Date.now();
      
      // UI setup for players
      document.getElementById('btn-ingame-resign').classList.remove('hidden');
      document.getElementById('btn-ingame-draw').classList.remove('hidden');
      document.getElementById('btn-ingame-undo').classList.remove('hidden');
      document.getElementById('btn-ingame-hint').classList.remove('hidden');
      document.getElementById('btn-leave-spectate').classList.add('hidden');

      // Read timer from server
      if (data.timerMinutes) {
        this.timerMinutes = data.timerMinutes;
      }

      const youName = `You (${data.color === 'white' ? '♔' : '♚'})`;
      const oppName = `${data.opponent} (${data.color === 'white' ? '♚' : '♔'})`;

      this.setupGameUI(youName, oppName, true);
      this.showScreen('screen-game');
        setTimeout(() => this.startBgMusic(), 500);
      this.clearMoveHistory();
      this.clearCapturedPieces();

      // Replay all moves to restore board state
      if (data.state && data.state.abilitiesUsed) this.engine.abilitiesUsed = data.state.abilitiesUsed;
      if (data.moves && data.moves.length > 0) {
        for (const move of data.moves) {
          const from = ChessEngine.fromAlgebraic(move.from);
          const to = ChessEngine.fromAlgebraic(move.to);
          const result = this.engine.makeMove(from.row, from.col, to.row, to.col, move.promotion);
          if (result) {
            this.lastMove = { from: result.from, to: result.to };
            this.updateMoveHistory(result);
          }
        }
      }

      // Restore timers from server
      if (data.timers) {
        this.timers.white = data.timers.white;
        this.timers.black = data.timers.black;
      } else {
        this.timers.white = null;
        this.timers.black = null;
      }

      this.renderBoard();
      this.updateCapturedPieces();
      this.updatePlayerBars();
      this.startTimerTick();
      this.showToast('Reconnected!');
    };

    mp.onSpectatorJoined = (data) => {
      this.gameMode = 'online';
      this.playerColor = 'spectator';
      this.boardFlipped = false;
      this.engine = new ChessEngine();
        this.lastMove = null;
        if (!this.gameStartTime) this.gameStartTime = Date.now();
      document.getElementById('chat-messages').innerHTML = ''; // clear chat

      if (data.timerMinutes) this.timerMinutes = data.timerMinutes;

      this.setupGameUI("White (Player)", "Black (Player)", true);
      this.showScreen('screen-game');
        setTimeout(() => this.startBgMusic(), 500);
      this.clearMoveHistory();
      this.clearCapturedPieces();

      if (data.state && data.state.abilitiesUsed) this.engine.abilitiesUsed = data.state.abilitiesUsed;
      if (data.moves && data.moves.length > 0) {
        for (const move of data.moves) {
          const from = ChessEngine.fromAlgebraic(move.from);
          const to = ChessEngine.fromAlgebraic(move.to);
          const result = this.engine.makeMove(from.row, from.col, to.row, to.col, move.promotion);
          if (result) {
            this.lastMove = { from: result.from, to: result.to };
            this.updateMoveHistory(result);
          }
        }
      }

      if (data.timers) {
        this.timers.white = data.timers.white;
        this.timers.black = data.timers.black;
      } else {
        this.timers.white = null;
        this.timers.black = null;
      }

      this.renderBoard();
      this.updateCapturedPieces();
      this.updatePlayerBars();
      this.startTimerTick();
      
      // UI setup for spectator
      document.getElementById('btn-ingame-resign').classList.add('hidden');
      document.getElementById('btn-ingame-draw').classList.add('hidden');
      document.getElementById('btn-ingame-undo').classList.add('hidden');
      document.getElementById('btn-ingame-hint').classList.add('hidden');
      document.getElementById('btn-leave-spectate').classList.remove('hidden');
      const ab1 = document.getElementById('btn-ability-1');
      if (ab1) ab1.classList.add('hidden');
      const ab2 = document.getElementById('btn-ability-2');
      if (ab2) ab2.classList.add('hidden');

      this.showToast('You are spectating the match');
    };

    mp.onSpectatorCount = (count) => {
      const countEl = document.getElementById('spectator-count-text');
      const container = document.getElementById('spectator-count-container');
      if (countEl && container) {
        countEl.textContent = count;
        container.style.display = count > 0 ? 'flex' : 'none';
      }
    };

    mp.onChatMessage = (sender, senderName, text) => {
      const chatMessages = document.getElementById('chat-messages');
      if (!chatMessages) return;

      const msgDiv = document.createElement('div');
      msgDiv.className = 'chat-message';

      let displaySender = senderName;
      if (sender === this.playerColor) {
        displaySender = 'You';
      }

      msgDiv.innerHTML = `<span class="chat-sender ${sender}">${displaySender}:</span> <span class="chat-text">${text}</span>`;
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Play tweet notification for incoming messages (not own)
      if (sender !== this.playerColor) {
        this.playSound('tweet');
      }

      // Show chat bubble on correct player avatar
      // From THIS client's perspective:
      //   - "bottom" avatar = the player on THIS device (their own side)
      //   - "top" avatar = the opponent
      // So: if sender === my color → show on bottom bubble (MY bubble)
      //     if sender !== my color → show on top bubble (OPPONENT's bubble)
      if (sender === 'white' || sender === 'black') {
        let bubbleId;
        if (sender === this.playerColor) {
          // I sent this message — show on my avatar (bottom)
          bubbleId = 'bottom-chat-bubble';
        } else {
          // Opponent sent — show on their avatar (top)
          bubbleId = 'top-chat-bubble';
        }

        const bubble = document.getElementById(bubbleId);
        if (bubble) {
          bubble.textContent = text;
          if (bubble.hideTimeout) clearTimeout(bubble.hideTimeout);
          bubble.classList.remove('show');
          // Force reflow so animation replays
          void bubble.offsetWidth;
          bubble.classList.add('show');
          bubble.hideTimeout = setTimeout(() => {
            bubble.classList.remove('show');
          }, 4500);
        }
      }
    };

    mp.onGameOver = (reason, winner) => {
      if (this.engine) {
        this.engine.gameOver = true;
        this.engine.gameResult = { winner, reason };
      }
      // Force-hide any open modals that might block game over
      this.hideModal('modal-confirm');
      this.hideModal('modal-draw-offer');
      this.playSound('gameover');
      setTimeout(() => this.showGameOver(), 300);
    };

    mp.onDrawOffered = () => {
      // Force-hide any blocking modals first
      this.hideModal('modal-confirm');
      this.showModal('modal-draw-offer');
    };

    mp.onRematchRequested = () => {
      this.showConfirm('Rematch?', 'Your opponent wants a rematch.', () => {
        this.multiplayer.acceptRematch();
      });
    };

    mp.onRematchAccepted = (color) => {
      this.hideModal('modal-gameover');
      this.hideModal('modal-confirm');
      this.showScreen('screen-game');
      setTimeout(() => this.startBgMusic(), 500);
      this.playerColor = color;
      this.boardFlipped = color === 'black';
      this.engine = new ChessEngine();
        this.lastMove = null;
        if (!this.gameStartTime) this.gameStartTime = Date.now();

      if (this.timerMinutes) {
        this.timers.white = this.timerMinutes * 60 * 1000;
        this.timers.black = this.timerMinutes * 60 * 1000;
      }

      this.renderBoard();
      this.updatePlayerBars();
      this.clearMoveHistory();
      this.clearCapturedPieces();
      this.startTimerTick();
      this.showToast('Rematch started!');
    };

    mp.onError = (message) => {
      this.showToast(message);
    };

    mp.onConnectionChange = (status) => {
      if (status === 'connected') {
        this.hideConnectionStatus();
      } else {
        this.showConnectionStatus(status);
      }
    };
  }

  cancelWaiting() {
    if (this.multiplayer) {
      if (this.multiplayer.roomCode) {
        this.multiplayer.send({ type: 'leave_private_room' });
        this.multiplayer.roomCode = null;
      } else {
        this.multiplayer.cancelMatch();
      }
    }
    if (this.slotInterval) {
      clearInterval(this.slotInterval);
      this.slotInterval = null;
    }
    if (this.activeStakeDeducted > 0) {
      const balanceEl = document.getElementById('profile-wallet-balance');
      if (balanceEl) {
        let currentBalance = parseInt(balanceEl.textContent.replace(/,/g, ''));
        currentBalance += this.activeStakeDeducted;
        balanceEl.textContent = currentBalance.toLocaleString();
        this.showToast(`Stake of ${this.activeStakeDeducted} $OWL refunded`);
      }
      this.activeStakeDeducted = 0;
    }
    const prizePoolEl = document.getElementById('active-prize-pool');
    if (prizePoolEl) prizePoolEl.classList.add('hidden');

    this.showScreen('screen-home');
  }



  copyRoomCode() {
    const code = document.getElementById('display-room-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      this.showToast('Code copied!');
    }).catch(() => {
      this.showToast(code);
    });
  }

  // ─── Game UI Setup ─────────────────────────────────

    setupGameUI(playerName, opponentName, isOnline) {
    document.getElementById('bottom-player-name').textContent = playerName;
    document.getElementById('top-player-name').textContent = opponentName;
    
    const topAvatar = document.getElementById('top-player-avatar');
    if (topAvatar) {
       topAvatar.src = this.opponentAvatarSrc || '/assets/shadow_owl_avatar.gif';
    }

    // Show/hide online-only controls
    document.getElementById('btn-ingame-draw').style.display = isOnline ? '' : 'none';
    document.getElementById('btn-ingame-resign').style.display = isOnline ? '' : 'none';

    this.clearMoveHistory();
    this.clearCapturedPieces();
    
    this.setupAbilitiesUI();
  }

  setupAbilitiesUI() {
    const ab1Btn = document.getElementById('btn-ability-1');
    const ab2Btn = document.getElementById('btn-ability-2');
    const undoBtn = document.getElementById('btn-ingame-undo');
    const drawBtn = document.getElementById('btn-ingame-draw');
    const resignBtn = document.getElementById('btn-ingame-resign');

    const abs = (this.gameMode === 'online' && this.multiplayer && this.multiplayer.abilities && this.multiplayer.abilities.self && this.multiplayer.abilities.self.length > 0)
        ? this.multiplayer.abilities.self
        : (this.selectedAbilities || ['swap', 'freeze']);

    if (abs && abs.length > 0) {
      if (abs[0] && ab1Btn) {
        this.configureAbilityButton(ab1Btn, abs[0]);
        ab1Btn.style.display = '';
        ab1Btn.classList.remove('hidden');
      }
      if (abs[1] && ab2Btn) {
        this.configureAbilityButton(ab2Btn, abs[1]);
        ab2Btn.style.display = '';
        ab2Btn.classList.remove('hidden');
      } else if (ab2Btn) {
        ab2Btn.style.display = 'none';
      }
    }

    if (this.gameMode === 'online') {
      // In online PvP: Show Draw, Hide Undo (no coins undo in PvP)
      if (undoBtn) undoBtn.style.display = 'none';
      if (drawBtn) drawBtn.style.display = '';
    } else {
      // In AI / Practice Mode: Show Undo (5 Coins), Hide Draw
      if (undoBtn) {
        undoBtn.style.display = '';
        undoBtn.classList.remove('hidden');
        undoBtn.onclick = () => this.undoMove();
      }
      if (drawBtn) drawBtn.style.display = 'none';
    }

    if (resignBtn) resignBtn.style.display = '';
  }

  configureAbilityButton(btn, abilityId) {
    btn.style.display = '';
    btn.onclick = () => this.activateAbility(abilityId);
    
    if (abilityId === 'swap') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 42.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = 'Swap';
    } else if (abilityId === 'freeze') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 43.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = 'Freeze';
    } else if (abilityId === 'second') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 44.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = '2nd Chance';
    } else if (abilityId === 'shield') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 45.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = 'Shield';
    } else if (abilityId === 'jump') {
      btn.querySelector('.btn-icon').innerHTML = '<img src="/assets/Asset 46.png" style="width: 22px; height: 22px; object-fit: contain; transform: translateY(2px);">';
      btn.querySelector('.btn-label').textContent = 'Jump';
    }
    
    // Check if ability was used
    if (this.engine.abilitiesUsed && this.engine.abilitiesUsed.white && this.engine.abilitiesUsed.black) {
      const used = this.engine.abilitiesUsed[this.playerColor].includes(abilityId);
      if (used) {
        btn.classList.add('disabled');
        btn.style.opacity = '0.5';
        btn.onclick = null;
      } else {
        btn.classList.remove('disabled');
        btn.style.opacity = '1';
      }
    }
  }

  activateAbility(abilityId) {
      if (this.engine.gameOver || (this.engine.currentTurn !== this.playerColor && abilityId !== 'second')) {
        this.showToast('Not your turn!');
        return;
      }

      if (this.activeAbility === abilityId) {
        this.activeAbility = null;
        this.swapSelection = [];
        this.jumpPiece = null;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.showToast('Ability canceled');
        this.renderBoard();
        return;
      }
      
      this.selectedSquare = null;
      this.legalMoves = [];
      this.renderBoard();
    
    if (abilityId === 'second') {
      if (this.gameMode === 'online') {
        this.multiplayer.send({ type: 'use_ability', ability: 'second' });
      } else {
        const ok = this.engine.validateAbility('second', null, this.playerColor);
        if (ok) {
          this.showToast('Second Chance used!');
          this.setupAbilitiesUI();
          this.renderBoard();
        } else {
          this.showToast('Cannot undo');
        }
      }
    } else if (abilityId === 'freeze' || abilityId === 'swap' || abilityId === 'shield' || abilityId === 'jump') {
      this.activeAbility = abilityId;
      if (abilityId === 'swap') this.swapSelection = [];
      if (abilityId === 'jump') this.jumpPiece = null;
      const msg = abilityId === 'swap' ? 'Select 2 pieces to Swap' :
                  abilityId === 'freeze' ? 'Select opponent piece to Freeze' :
                  abilityId === 'shield' ? 'Select piece for Divine Shield' :
                  'Select piece to Pegasus Jump over hurdle';
      this.showToast(msg);
      this.renderBoard();
    }
  }

  // ─── Board Rendering ──────────────────────────────

  renderBoard() {
      const boardEl = document.getElementById('chess-board') || document.getElementById('board');
      if (!boardEl) return;
      boardEl.innerHTML = '';
      if (!this.engine) return;
      
      // If it's online and not our turn, clear selection so pieces don't get stuck hovering
      if ((this.gameMode === 'online' || this.gameMode === 'ai') && this.engine.currentTurn !== this.playerColor) {
        this.selectedSquare = null;
        this.legalMoves = [];
      }

    const files = 'abcdefgh';

    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const row = this.boardFlipped ? 7 - displayRow : displayRow;
        const col = this.boardFlipped ? 7 - displayCol : displayCol;

        const square = document.createElement('div');
        const isLight = (row + col) % 2 === 0;
        let squareClass = `square ${isLight ? 'light' : 'dark'}`;
        const squareIndex = displayRow * 8 + displayCol;
        if (((squareIndex * 13 + 5) % 17) < 4) {
          squareClass += ' tone-b';
        }
        square.className = squareClass;
        square.dataset.row = row;
        square.dataset.col = col;

        // Coordinate labels
        if (displayCol === 0) {
          const rank = document.createElement('span');
          rank.className = 'coord coord-rank coord-label';
          rank.textContent = 8 - row;
          square.appendChild(rank);
        }
        if (displayRow === 7) {
          const file = document.createElement('span');
          file.className = 'coord coord-file coord-label';
          file.textContent = files[col];
          square.appendChild(file);
        }

        // Last move highlight
        if (this.lastMove) {
          if ((row === this.lastMove.from.row && col === this.lastMove.from.col) ||
            (row === this.lastMove.to.row && col === this.lastMove.to.col)) {
            square.classList.add('last-move');
          }
        }

        // Selected square
        if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
          square.classList.add('selected', 'is-selected');
        }

        // Legal move indicators
        const legalMove = this.legalMoves.find(m => m.row === row && m.col === col);
        if (legalMove) {
          const targetPiece = this.engine.getPiece(row, col);
          if (targetPiece || legalMove.enPassant) {
            square.classList.add('legal-capture', 'capture-target');
          } else {
            square.classList.add('legal-move', 'move-target');
          }
        }

        // Check highlight
        if (this.engine) {
          const piece = this.engine.getPiece(row, col);
          if (piece && piece.type === 'king' && piece.color === this.engine.currentTurn) {
            if (this.engine.isKingInCheck(this.engine.currentTurn)) {
              square.classList.add('check', 'is-check');
            }
          }
        }

        // Piece
        const piece = this.engine.getPiece(row, col);

        // Ability highlights
        if (this.engine.isPieceFrozen(row, col)) {
           square.classList.add('frozen');
        }
        if (this.engine.isPieceShielded && this.engine.isPieceShielded(row, col)) {
           square.classList.add('shielded-square');
        }
        if (this.swapSelection && this.swapSelection.some(s => s.row === row && s.col === col)) {
           square.classList.add('swap-selected');
        }
        if (this.activeAbility === 'jump' && this.jumpPiece) {
           if (this.jumpPiece.fromRow === row && this.jumpPiece.fromCol === col) {
              square.classList.add('selected', 'is-selected');
           }
           if (this.jumpPiece.validTargets && this.jumpPiece.validTargets.some(t => t.row === row && t.col === col)) {
              square.classList.add('legal-move', 'move-target');
           }
        }

        if (piece) {
          const pieceEl = document.createElement('span');
          pieceEl.className = `piece ${piece.color}-piece`;
          if (typeof PieceSVGs !== 'undefined' && PieceSVGs.getPiece) {
            pieceEl.innerHTML = PieceSVGs.getPiece(piece.color, piece.type);
          } else {
            pieceEl.textContent = this.pieceSymbols[piece.color][piece.type];
          }
          square.appendChild(pieceEl);
        }

        // Click handler
        square.addEventListener('click', () => this.handleSquareClick(row, col));

        boardEl.appendChild(square);
      }
    }
  }

  // ─── Square Click Handling ─────────────────────────

    
  getValidJumpTargets(row, col) {
    if (!this.engine) return [];
    const piece = this.engine.getPiece(row, col);
    if (!piece || piece.color !== this.playerColor) return [];

    const dir = this.playerColor === 'white' ? -1 : 1;
    const targetRow = row + 2 * dir;
    if (targetRow < 0 || targetRow > 7) return [];

    let allowedDCols = [0];
    if (piece.type === 'bishop') {
      allowedDCols = [-2, 2];
    } else if (piece.type === 'queen') {
      allowedDCols = [0, -2, 2];
    }

    const targets = [];
    for (const dCol of allowedDCols) {
      const targetCol = col + dCol;
      const hurdleRow = row + dir;
      const hurdleCol = col + dCol / 2;

      if (!this.engine.isInBounds(targetRow, targetCol)) continue;
      if (!this.engine.getPiece(hurdleRow, hurdleCol)) continue; // Must have hurdle obstacle
      if (this.engine.getPiece(targetRow, targetCol)) continue; // Landing square must be empty
      if (piece.type === 'king' && this.engine.isSquareAttacked(targetRow, targetCol, this.playerColor)) continue;

      targets.push({ row: targetRow, col: targetCol, hurdleRow, hurdleCol });
    }
    return targets;
  }

  handleSquareClick(row, col) {
    if (this.isAnimatingMove) return;
    if (this.engine.gameOver || this.playerColor === 'spectator') return;

    if (this.activeAbility) {
        if (this.activeAbility === 'shield') {
            const piece = this.engine.getPiece(row, col);
            if (!piece || piece.color !== this.playerColor) {
                this.showToast('Must select your own piece');
                return;
            }
            if (this.gameMode === 'online') {
                this.multiplayer.send({ type: 'use_ability', ability: 'shield', args: { row, col } });
            } else {
                const ok = this.engine.validateAbility('shield', { row, col }, this.playerColor);
                if (ok) {
                    this.showToast('🛡️ Divine Shield active on ' + piece.type + '!');
                    this.setupAbilitiesUI();
                }
            }
            this.activeAbility = null;
            this.renderBoard();
            return;
        }

        if (this.activeAbility === 'jump') {
            if (!this.jumpPiece) {
                const piece = this.engine.getPiece(row, col);
                if (!piece || piece.color !== this.playerColor) {
                    this.showToast('Select your piece to jump');
                    return;
                }
                const targets = this.getValidJumpTargets(row, col);
                if (targets.length === 0) {
                    this.showToast('No obstacle in front for ' + piece.type + ' to jump!');
                    return;
                }
                this.jumpPiece = { fromRow: row, fromCol: col, validTargets: targets };
                this.showToast('Tap highlighted square to land');
                this.renderBoard();
                return;
            } else {
                const target = this.jumpPiece.validTargets && this.jumpPiece.validTargets.find(t => t.row === row && t.col === col);
                if (target) {
                    const jumpArgs = { fromRow: this.jumpPiece.fromRow, fromCol: this.jumpPiece.fromCol, toRow: row, toCol: col };
                    if (this.gameMode === 'online') {
                        this.multiplayer.send({ type: 'use_ability', ability: 'jump', args: jumpArgs });
                    } else {
                        const ok = this.engine.validateAbility('jump', jumpArgs, this.playerColor);
                        if (ok) {
                            this.showToast('🪽 Pegasus Jump executed!');
                            this.setupAbilitiesUI();
                            if (this.gameMode === 'ai' && this.engine.currentTurn !== this.playerColor) {
                                setTimeout(() => this.makeAIMove(), 500);
                            }
                        }
                    }
                    this.activeAbility = null;
                    this.jumpPiece = null;
                    this.selectedSquare = null;
                    this.legalMoves = [];
                    this.renderBoard();
                    return;
                } else {
                    // Check if player tapped another of their own pieces to switch jump piece
                    const clickedPiece = this.engine.getPiece(row, col);
                    if (clickedPiece && clickedPiece.color === this.playerColor) {
                        const newTargets = this.getValidJumpTargets(row, col);
                        if (newTargets.length > 0) {
                            this.jumpPiece = { fromRow: row, fromCol: col, validTargets: newTargets };
                            this.showToast('Tap highlighted square to land');
                            this.renderBoard();
                            return;
                        }
                    }
                    this.jumpPiece = null;
                    this.activeAbility = null;
                    this.selectedSquare = null;
                    this.legalMoves = [];
                    this.showToast('Jump canceled');
                    this.renderBoard();
                    return;
                }
            }
        }

        if (this.activeAbility === 'freeze') {
            const piece = this.engine.getPiece(row, col);
            if (!piece || piece.color === this.playerColor) {
                this.showToast('Must select an opponent piece');
                return;
            }
            if (piece.type === 'king') {
                this.showToast('Cannot freeze a King');
                return;
            }
            this.multiplayer.send({ type: 'use_ability', ability: 'freeze', args: { row, col } });
            this.activeAbility = null;
            this.renderBoard(); // Clear selection UI
            return;
        }
        if (this.activeAbility === 'swap') {
            const piece = this.engine.getPiece(row, col);
            if (!piece || piece.color !== this.playerColor) {
                this.showToast('Must select your own piece');
                return;
            }
            if (piece.type === 'king') {
                this.showToast('Cannot swap a King');
                return;
            }
            
            if (!this.swapSelection) this.swapSelection = [];
            
            // Check if clicking same piece
            if (this.swapSelection.length === 1 && this.swapSelection[0].row === row && this.swapSelection[0].col === col) {
                this.swapSelection = []; // Deselect
                this.renderBoard();
                return;
            }
            
            this.swapSelection.push({ row, col });
            
            if (this.swapSelection.length === 2) {
                const row1 = this.swapSelection[0].row;
                const col1 = this.swapSelection[0].col;
                const row2 = this.swapSelection[1].row;
                const col2 = this.swapSelection[1].col;
                
                const p1 = this.engine.board[row1][col1];
                const p2 = this.engine.board[row2][col2];
                
                const p1WillPromote = p1 && p1.type === 'pawn' && ((p1.color === 'white' && row2 === 0) || (p1.color === 'black' && row2 === 7));
                const p2WillPromote = p2 && p2.type === 'pawn' && ((p2.color === 'white' && row1 === 0) || (p2.color === 'black' && row1 === 7));
                
                if (p1WillPromote || p2WillPromote) {
                    this.pendingSwapPromotion = { row1, col1, row2, col2 };
                    this.showPromotionModal();
                    this.activeAbility = null;
                    this.swapSelection = [];
                    this.renderBoard();
                    return;
                }
                
                this.multiplayer.send({ 
                    type: 'use_ability', 
                    ability: 'swap', 
                    args: { row1, col1, row2, col2 } 
                });
                this.activeAbility = null;
                this.swapSelection = [];
            }
            this.renderBoard();
            return;
        }
    }

    // In online mode, only allow moves on your turn
    if (this.gameMode === 'online' && this.engine.currentTurn !== this.playerColor) return;

    // In AI mode, can only move on your turn
    if (this.gameMode === 'ai' && this.engine.currentTurn !== this.playerColor) return;

    const piece = this.engine.getPiece(row, col);

    // If clicking on own frozen piece, show toast and return
    if (piece && piece.color === this.engine.currentTurn) {
        if (this.engine.isPieceFrozen(row, col)) {
            this.showToast('This piece is frozen!');
            return;
        }
    }

    // If a square is already selected
    if (this.selectedSquare) {
      // Check if clicking on the same square (deselect)
      if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
        this.deselectSquare();
        return;
      }

      // Check if clicking on own piece (reselect)
      if (piece && piece.color === this.engine.currentTurn) {
        this.selectSquare(row, col);
        return;
      }

      // Try to move
      const isLegal = this.legalMoves.some(m => m.row === row && m.col === col);
      if (isLegal) {
        this.attemptMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
      } else {
        this.deselectSquare();
      }
      return;
    }

    // Select a piece
    if (piece && piece.color === this.engine.currentTurn) {
      this.selectSquare(row, col);
    }
  }

  selectSquare(row, col) {
    this.selectedSquare = { row, col };
    // Get unique legal target squares (deduplicate promotions)
    const allMoves = this.engine.getLegalMoves(row, col);
    const seen = new Set();
    this.legalMoves = allMoves.filter(m => {
      const key = `${m.row},${m.col}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    this.renderBoard();
  }

  deselectSquare() {
    this.selectedSquare = null;
    this.legalMoves = [];
    this.renderBoard();
  }

  attemptMove(fromRow, fromCol, toRow, toCol) {
    // Check if promotion is needed
    if (this.engine.needsPromotion(fromRow, fromCol, toRow)) {
      this.pendingPromotion = { fromRow, fromCol, toRow, toCol };
      this.showPromotionModal();
      return;
    }

    this.executeMove(fromRow, fromCol, toRow, toCol, null);
  }

  // ─── Combat Kill FX & Piece Move Animation ──────────

  createCombatKillEffect(toSq) {
    if (!toSq) return;
    const boardEl = document.getElementById('chess-board');
    if (!boardEl) return;

    // Trigger board micro-shake for physical combat impact
    boardEl.classList.remove('combat-shake');
    void boardEl.offsetWidth; // Force reflow
    boardEl.classList.add('combat-shake');
    setTimeout(() => {
      boardEl.classList.remove('combat-shake');
    }, 240);

    // Create combat kill overlay positioned over the target square
    const overlay = document.createElement('div');
    overlay.className = 'kill-combat-overlay';
    overlay.style.left = `${toSq.offsetLeft}px`;
    overlay.style.top = `${toSq.offsetTop}px`;
    overlay.style.width = `${toSq.offsetWidth}px`;
    overlay.style.height = `${toSq.offsetHeight}px`;

    // 1. Comic flash circle
    const flash = document.createElement('div');
    flash.className = 'kill-flash-circle';
    overlay.appendChild(flash);

    // 2. Comic slash cut line
    const slash = document.createElement('div');
    slash.className = 'kill-slash-line';
    overlay.appendChild(slash);

    // 3. Sharp triangular shards matching the reference image!
    const shards = [
      'shard-top-left',
      'shard-bottom',
      'shard-right',
      'shard-top-right'
    ];
    shards.forEach(cls => {
      const shard = document.createElement('div');
      shard.className = `kill-shard ${cls}`;
      overlay.appendChild(shard);
    });

    boardEl.appendChild(overlay);

    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 550);
  }

  animateMoveAndApply(result, onDone) {
    if (!result) {
      if (onDone) onDone();
      return;
    }

    const fromSq = document.querySelector(`.square[data-row="${result.from.row}"][data-col="${result.from.col}"]`);
    const toSq = document.querySelector(`.square[data-row="${result.to.row}"][data-col="${result.to.col}"]`);
    const movingPieceEl = fromSq ? fromSq.querySelector('.piece') : null;

    // Identify victim piece
    let victimPieceEl = null;
    let victimSq = toSq;
    if (result.captured) {
      if (result.enPassant) {
        const epRow = result.piece.color === 'white' ? result.to.row + 1 : result.to.row - 1;
        const epSq = document.querySelector(`.square[data-row="${epRow}"][data-col="${result.to.col}"]`);
        if (epSq) {
          victimSq = epSq;
          victimPieceEl = epSq.querySelector('.piece');
        }
      } else if (toSq) {
        victimPieceEl = toSq.querySelector('.piece');
      }
    }

    this.isAnimatingMove = true;

    // Play sound on move start
    if (result.captured) {
      this.playSound('capture');
    } else {
      this.playSound('move');
    }

    if (result.check) {
      setTimeout(() => this.playSound('check'), 180);
    }

    // Check if we can animate DOM pieces
    if (movingPieceEl && fromSq && toSq) {
      const dx = toSq.offsetLeft - fromSq.offsetLeft;
      const dy = toSq.offsetTop - fromSq.offsetTop;

      // Glide moving piece on top of all squares & overlays
      fromSq.classList.add('gliding-source');
      fromSq.style.zIndex = '1000';
      fromSq.style.overflow = 'visible';
      movingPieceEl.classList.add('piece-gliding');
      movingPieceEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`;

      // Animate castling rook if castling
      if (result.castling) {
        const rookRow = result.piece.color === 'white' ? 7 : 0;
        const rookFromCol = result.castling === 'kingSide' ? 7 : 0;
        const rookToCol = result.castling === 'kingSide' ? 5 : 3;
        const rookFromSq = document.querySelector(`.square[data-row="${rookRow}"][data-col="${rookFromCol}"]`);
        const rookToSq = document.querySelector(`.square[data-row="${rookRow}"][data-col="${rookToCol}"]`);
        const rookPiece = rookFromSq ? rookFromSq.querySelector('.piece') : null;
        if (rookPiece && rookFromSq && rookToSq) {
          const rdx = rookToSq.offsetLeft - rookFromSq.offsetLeft;
          const rdy = rookToSq.offsetTop - rookFromSq.offsetTop;
          rookFromSq.classList.add('gliding-source');
          rookFromSq.style.zIndex = '999';
          rookFromSq.style.overflow = 'visible';
          rookPiece.classList.add('piece-gliding');
          rookPiece.style.transform = `translate(${rdx}px, ${rdy}px) scale(1.12)`;
        }
      }

      // If capture, trigger victim kill recoil & combat shard burst
      if (result.captured) {
        if (victimPieceEl) {
          victimPieceEl.classList.add('piece-being-killed');
        }
        // At impact (~110ms): trigger triangular shard explosion
        setTimeout(() => {
          if (victimSq) this.createCombatKillEffect(victimSq);
        }, 110);
      }

      // After glide finishes (230ms): commit to engine rendering
      setTimeout(() => {
        this.lastMove = { from: result.from, to: result.to };
        this.renderBoard();
        this.updateMoveHistory(result);
        this.updateCapturedPieces();
        this.updatePlayerBars();
        this.isAnimatingMove = false;

        if (onDone) onDone();
      }, 230);
    } else {
      // Direct render fallback
      this.lastMove = { from: result.from, to: result.to };
      this.renderBoard();
      this.updateMoveHistory(result);
      this.updateCapturedPieces();
      this.updatePlayerBars();
      this.isAnimatingMove = false;

      if (result.captured && victimSq) {
        this.createCombatKillEffect(victimSq);
      }

      if (onDone) onDone();
    }
  }

  executeMove(fromRow, fromCol, toRow, toCol, promotion) {
    const result = this.engine.makeMove(fromRow, fromCol, toRow, toCol, promotion);
    if (!result) return;

    // Send to server if online
    if (this.gameMode === 'online') {
      const from = ChessEngine.toAlgebraic(fromRow, fromCol);
      const to = ChessEngine.toAlgebraic(toRow, toCol);
      this.multiplayer.sendMove(from, to, promotion);
    }

    // Clear selection indicators from DOM without destroying pieces
    this.selectedSquare = null;
    this.legalMoves = [];
    document.querySelectorAll('.square.selected, .square.legal-move, .square.legal-capture').forEach(sq => {
      sq.classList.remove('selected', 'legal-move', 'legal-capture');
    });

    this.animateMoveAndApply(result, () => {
      // Check game over
      if (this.engine.gameOver) {
        this.playSound('gameover');
        setTimeout(() => this.showGameOver(), 500);
        return;
      }

      // AI response
      if (this.gameMode === 'ai') {
        setTimeout(() => this.makeAIMove(), 320);
      }
    });
  }

  // ─── Promotion ─────────────────────────────────────

  showPromotionModal() {
    const modal = document.getElementById('modal-promotion');
    // Show correct color pieces
    const isWhite = this.engine.currentTurn === 'white';
    modal.querySelectorAll('.promo-white').forEach(el => el.style.display = isWhite ? 'inline' : 'none');
    modal.querySelectorAll('.promo-black').forEach(el => el.style.display = isWhite ? 'none' : 'inline');
    modal.classList.remove('hidden');
  }

  selectPromotion(type) {
    document.getElementById('modal-promotion').classList.add('hidden');
    if (this.pendingPromotion) {
      const { fromRow, fromCol, toRow, toCol } = this.pendingPromotion;
      this.pendingPromotion = null;
      this.executeMove(fromRow, fromCol, toRow, toCol, type);
    } else if (this.pendingSwapPromotion) {
      const { row1, col1, row2, col2 } = this.pendingSwapPromotion;
      this.pendingSwapPromotion = null;
      this.multiplayer.send({ 
        type: 'use_ability', 
        ability: 'swap', 
        args: { row1, col1, row2, col2, promotion: type } 
      });
    }
  }

  // ─── Timer ─────────────────────────────────────────

  startTimerTick() {
    this.stopTimerTick();
    if (!this.timers.white && !this.timers.black) return;
    this.lastMoveTime = Date.now();

    this.timerInterval = setInterval(() => {
      if (this.engine.gameOver) {
        this.stopTimerTick();
        return;
      }

      const now = Date.now();
      const elapsed = now - this.lastMoveTime;
      this.lastMoveTime = now;

      const currentTurn = this.engine.currentTurn;
      if (this.timers[currentTurn] !== null) {
        this.timers[currentTurn] = Math.max(0, this.timers[currentTurn] - elapsed);

        if (this.timers[currentTurn] <= 0) {
          this.stopTimerTick();
          // In AI mode, handle timeout locally
          if (this.gameMode === 'ai') {
            const winner = currentTurn === 'white' ? 'black' : 'white';
            this.engine.gameOver = true;
            this.engine.gameResult = { winner, reason: 'timeout' };
            this.playSound('gameover');
            this.showGameOver();
          }
        }
      }

      this.updateTimerDisplay();
    }, 100);
  }

  stopTimerTick() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay() {
    const formatTime = (ms) => {
      if (ms === null || ms === undefined) return '--:--';
      const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const topColor = this.boardFlipped ? 'white' : 'black';
    const bottomColor = this.boardFlipped ? 'black' : 'white';

    const topTimer = document.getElementById('top-timer');
    const bottomTimer = document.getElementById('bottom-timer');

    topTimer.textContent = formatTime(this.timers[topColor]);
    bottomTimer.textContent = formatTime(this.timers[bottomColor]);

    // Low time warning (under 30 seconds)
    topTimer.classList.toggle('low-time', this.timers[topColor] !== null && this.timers[topColor] < 30000);
    bottomTimer.classList.toggle('low-time', this.timers[bottomColor] !== null && this.timers[bottomColor] < 30000);
  }

  // ─── Player Bars ───────────────────────────────────

  updatePlayerBars() {
    if (!this.engine) return;

    const topColor = this.boardFlipped ? 'white' : 'black';
    const bottomColor = this.boardFlipped ? 'black' : 'white';

    const topBar = document.getElementById('player-top');
    const bottomBar = document.getElementById('player-bottom');

    const wasMyTurn = this.isMyTurn || false;
    this.isMyTurn = this.engine && this.playerColor !== 'spectator' ? this.engine.currentTurn === this.playerColor : false;

    if (topBar) topBar.classList.toggle('active-turn', this.engine && this.engine.currentTurn === topColor);
    if (bottomBar) bottomBar.classList.toggle('active-turn', this.engine && this.engine.currentTurn === bottomColor);

    // Update in-game Turn Status Badge
    const turnBadge = document.getElementById('turn-status-badge');
    if (turnBadge && this.engine) {
      if (this.playerColor === 'spectator') {
        turnBadge.classList.remove('your-turn');
        turnBadge.textContent = this.engine.currentTurn === 'white' ? "White's Turn" : "Black's Turn";
      } else {
        if (this.isMyTurn) {
          turnBadge.classList.add('your-turn');
          turnBadge.textContent = 'Your Turn';
        } else {
          turnBadge.classList.remove('your-turn');
          turnBadge.textContent = "Opponent's Turn";
        }
      }
    }

    // Play sound if it just became our turn
    if (this.isMyTurn && !wasMyTurn) {
      setTimeout(() => this.playSound('your-turn'), 100);
    }

    this.updateTimerDisplay();
  }

  // ─── Move History ──────────────────────────────────

  updateMoveHistory(moveData) {
    this.updateMoveHistoryUI();
  }

  
  updateMoveHistoryUI() {
    const list = document.getElementById('ticker-content');
    if (list) {
      list.innerHTML = '';
      this.engine.moveHistory.forEach((move, i) => {
        const item = document.createElement('div');
        item.className = 'ticker-item';
        item.textContent = (i % 2 === 0 ? ((Math.floor(i/2) + 1) + '. ') : '') + (move.notation || '?');
        list.appendChild(item);
      });
      list.scrollLeft = list.scrollWidth;
    }
  }

  clearMoveHistory() {
    const list = document.getElementById('ticker-content');
    if (list) list.innerHTML = '';
  }



  
  setupDraggableChat() {
    const chatBtn = document.getElementById('btn-toggle-chat');
    if (!chatBtn) return;
    
    let isDragging = false;
    let hasDragged = false;
    let startX, startY, startLeft, startTop;

    const onStart = (e) => {
        if (e.target !== chatBtn && !chatBtn.contains(e.target)) return;
        isDragging = true;
        hasDragged = false;
        
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        const rect = chatBtn.getBoundingClientRect();
        startX = clientX;
        startY = clientY;
        startLeft = rect.left;
        startTop = rect.top;
        
        // position fixed is set on move
        chatBtn.style.cursor = 'grabbing';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        const dx = clientX - startX;
        const dy = clientY - startY;
        
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasDragged = true;
        }
        
        if (hasDragged) {
            if(e.cancelable) e.preventDefault();
            chatBtn.style.position = 'fixed';
            chatBtn.style.zIndex = '9999';
            chatBtn.style.bottom = 'auto';
            chatBtn.style.right = 'auto';
            chatBtn.style.margin = '0';
            
            // Keep within window bounds
            let newLeft = startLeft + dx;
            let newTop = startTop + dy;
            
            const maxX = window.innerWidth - chatBtn.offsetWidth;
            const maxY = window.innerHeight - chatBtn.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            chatBtn.style.left = newLeft + 'px';
            chatBtn.style.top = newTop + 'px';
        }
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        chatBtn.style.cursor = 'grab';
    };

    chatBtn.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    
    chatBtn.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    
    chatBtn.addEventListener('click', (e) => {
        if (hasDragged) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    
    chatBtn.style.cursor = 'grab';
  }


  toggleChat() {
    const chat = document.querySelector('.chat-container');
    if (chat) {
      chat.classList.toggle('chat-open');
    }
  }

  // ─── Captured Pieces ──────────────────────────────

  updateCapturedPieces() {
    const topColor = this.boardFlipped ? 'white' : 'black';
    const bottomColor = this.boardFlipped ? 'black' : 'white';

    // Top shows pieces captured BY top player (which are bottom player's pieces)
    const topCaptured = document.getElementById('top-captured');
    const bottomCaptured = document.getElementById('bottom-captured');

    // Pieces captured by the top player (opponent from bottom's perspective)
    const topCaptures = this.engine.capturedPieces[bottomColor]; // bottom's lost pieces
    const bottomCaptures = this.engine.capturedPieces[topColor]; // top's lost pieces

    const pieceOrder = ['queen', 'rook', 'bishop', 'knight', 'pawn'];

    const renderCaptures = (captures, color) => {
      const sorted = [...captures].sort((a, b) =>
        pieceOrder.indexOf(a.type) - pieceOrder.indexOf(b.type)
      );
      return sorted.map(p => this.pieceSymbols[color][p.type]).join('');
    };

    topCaptured.textContent = renderCaptures(topCaptures, bottomColor);
    bottomCaptured.textContent = renderCaptures(bottomCaptures, topColor);
  }

  clearCapturedPieces() {
    document.getElementById('top-captured').textContent = '';
    document.getElementById('bottom-captured').textContent = '';
  }

  // ─── Game Over ─────────────────────────────────────

  // ─── Game Over & Victory Screen ─────────────────────

  // ══════════════════════════════════════════
  //  BACKGROUND MUSIC (Web Audio, procedural)
  // ══════════════════════════════════════════

  startBgMusic() {
    if (!this.musicEnabled) return;
    if (this.bgMusicRunning) return;

    // Ensure AudioContext (user-gesture already happened by game start)
    if (!this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) { return; }
    }
    const ctx = this.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    this.bgMusicRunning = true;

    // Master gain — fade in slowly
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 6);
    master.connect(ctx.destination);
    this.bgMusicGain = master;

    // Reverb impulse
    const conv = ctx.createConvolver();
    const irLen = ctx.sampleRate * 2.5;
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/irLen, 2.5);
    }
    conv.buffer = ir;
    conv.connect(master);

    const dry = ctx.createGain(); dry.gain.value = 0.5; dry.connect(master);
    const wet = ctx.createGain(); wet.gain.value = 0.5; wet.connect(conv);
    const out = (g) => { g.connect(dry); g.connect(wet); };

    // Drone layer: A1 + E2
    [[55.0, 0.15], [82.41, 0.10]].forEach(([freq, vol]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); out(g); o.start();
      this.bgMusicNodes.push(o);
    });

    // LFO tremolo
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.15; lg.gain.value = 0.03;
    lfo.connect(lg); lg.connect(dry.gain); lfo.start();
    this.bgMusicNodes.push(lfo);

    // Shimmer harmonics
    [440, 659.25, 880, 1318.5].forEach((freq, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0.006 - i * 0.001;
      o.connect(g); out(g); o.start();
      this.bgMusicNodes.push(o);
    });

    // Sparse pentatonic melody (A minor pent)
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
    const playNote = (t, freq, dur) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.04, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); out(g); o.start(t); o.stop(t + dur + 0.05);
    };
    const schedulePhrase = (t0) => {
      if (!this.bgMusicRunning) return;
      [0, 4, 7, 3, 5, 2, 6].forEach((idx, beat) => {
        if (beat % 2 !== 0) return;
        playNote(t0 + beat * 1.3, scale[idx % scale.length], 2.2);
      });
      this._melodyTimer = setTimeout(() => schedulePhrase(ctx.currentTime + 0.05), 8800);
    };
    this._melodyStart = setTimeout(() => schedulePhrase(ctx.currentTime + 0.05), 3000);
  }

  stopBgMusic() {
    this.bgMusicRunning = false;
    clearTimeout(this._melodyTimer);
    clearTimeout(this._melodyStart);
    if (this.bgMusicGain && this.audioCtx) {
      const ctx = this.audioCtx;
      this.bgMusicGain.gain.cancelScheduledValues(ctx.currentTime);
      this.bgMusicGain.gain.setValueAtTime(this.bgMusicGain.gain.value, ctx.currentTime);
      this.bgMusicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      setTimeout(() => {
        this.bgMusicNodes.forEach(n => { try { n.stop(); } catch(e){} });
        this.bgMusicNodes = []; this.bgMusicGain = null;
      }, 1600);
    } else {
      this.bgMusicNodes.forEach(n => { try { n.stop(); } catch(e){} });
      this.bgMusicNodes = []; this.bgMusicGain = null;
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    const btn = document.getElementById('btn-toggle-music');
    if (this.musicEnabled) {
      if (btn) btn.innerHTML = '🎵 Music: On';
      this.startBgMusic();
    } else {
      if (btn) btn.innerHTML = '🎵 Music: Off';
      this.stopBgMusic();
    }
    this.showToast(this.musicEnabled ? 'Music enabled' : 'Music muted');
  }


  showGameOver() {
    this.stopBgMusic();
    this.stopTimerTick();
    const result = (this.engine && this.engine.gameResult) ? this.engine.gameResult : { winner: null, reason: 'completed' };
    this.showVictoryScreen(result);
  }

  showVictoryScreen(result) {
    const isPlayerWin = result.winner ? (result.winner === this.playerColor) : false;
    const isDraw = !result.winner;

    // Manage stakes
    if (result.winner && isPlayerWin && this.activeStakeDeducted > 0) {
      const balanceEl = document.getElementById('profile-wallet-balance');
      if (balanceEl) {
        let currentBalance = parseInt(balanceEl.textContent.replace(/,/g, ''));
        const prizeWon = this.currentStake * 2;
        currentBalance += prizeWon;
        balanceEl.textContent = currentBalance.toLocaleString();
        this.showToast(`🏆 Won ${prizeWon} $OWL! Added to wallet.`);
      }
    } else if (isDraw && this.activeStakeDeducted > 0) {
      const balanceEl = document.getElementById('profile-wallet-balance');
      if (balanceEl) {
        let currentBalance = parseInt(balanceEl.textContent.replace(/,/g, ''));
        currentBalance += this.activeStakeDeducted;
        balanceEl.textContent = currentBalance.toLocaleString();
      }
    }
    this.activeStakeDeducted = 0;

    const titleEl = document.getElementById('victory-title-heading');
    const subheadingEl = document.getElementById('victory-subheading');
    const scoreEl = document.getElementById('victory-score-display');
    const oppNameEl = document.getElementById('victory-opp-name');
    const oppRatingEl = document.getElementById('victory-opp-rating');
    const modeEl = document.getElementById('victory-meta-mode');
    const durationEl = document.getElementById('victory-meta-duration');
    const movesEl = document.getElementById('victory-meta-moves');
    const ratingEl = document.getElementById('victory-meta-rating');

    const reasonMap = {
      'checkmate': 'Checkmate',
      'stalemate': 'Stalemate',
      'timeout': 'on Time',
      'resignation': 'by Resignation',
      'draw agreement': 'by Agreement',
      'draw agreed': 'by Agreement',
      '50-move rule': '50-Move Rule',
      'threefold repetition': 'Threefold Repetition'
    };

    let reasonDisplay = reasonMap[result.reason] || (result.reason || 'Checkmate');
    if (result.reason && result.reason.startsWith('insufficient material:')) {
      const details = result.reason.split(': ')[1];
      reasonDisplay = `Insufficient Material (${details})`;
    }

    const heroImg = document.getElementById('victory-hero-img');
    if (heroImg) {
      if (isPlayerWin) {
        heroImg.src = '/assets/owl_victory_crowned.png';
      } else if (isDraw) {
        heroImg.src = '/assets/Rival Owls Seal a Draw.png';
      } else {
        heroImg.src = '/assets/owl_defeat.jpg';
      }
    }

        if (titleEl) {
      if (isPlayerWin) {
        titleEl.textContent = 'VICTORY';
        titleEl.style.color = '#8F5F00';
      } else if (isDraw) {
        titleEl.textContent = 'DRAW';
        titleEl.style.color = '#20120B';
      } else {
        titleEl.textContent = 'DEFEAT';
        titleEl.style.color = '#8B1E1E';
      }
    }

    if (subheadingEl) {
      subheadingEl.textContent = reasonDisplay;
    }

    if (scoreEl) {
      if (isPlayerWin) scoreEl.textContent = '1 - 0';
      else if (isDraw) scoreEl.textContent = '½ - ½';
      else scoreEl.textContent = '0 - 1';
    }

    const rawOppName = document.getElementById('top-player-name')?.textContent || 'ShadowOwl';
    const cleanOppName = rawOppName.replace(/\s*\([♔♚]\)/, '');
    const currentOppRating = document.getElementById('top-player-rating')?.textContent || '1180';
    if (oppNameEl) oppNameEl.textContent = cleanOppName;
    if (oppRatingEl) oppRatingEl.textContent = currentOppRating;

    const addFriendBtn = document.getElementById('btn-add-friend-gameover');
    if (addFriendBtn) {
      if (this.gameMode === 'online' && cleanOppName !== 'ShadowOwl') {
        const isFriend = this.friendsList && this.friendsList.some(f => f.username === cleanOppName);
        if (isFriend) {
          addFriendBtn.style.display = 'none';
        } else {
          addFriendBtn.style.display = '';
        }
      } else {
        addFriendBtn.style.display = 'none';
      }
    }

    if (modeEl) {
      modeEl.textContent = this.matchType === 'robin' ? 'Robin Mode' : 'Standard';
    }

    let durationText = '12 min 34 sec';
    if (this.gameStartTime) {
      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - this.gameStartTime) / 1000));
      const mins = Math.floor(elapsedSeconds / 60);
      const secs = elapsedSeconds % 60;
      durationText = `${mins} min ${secs} sec`;
    }
    if (durationEl) durationEl.textContent = durationText;

    const moveCount = (this.engine && this.engine.moveHistory) ? this.engine.moveHistory.length : 0;
    if (movesEl) movesEl.textContent = moveCount;

    if (ratingEl) {
      if (isPlayerWin) {
        ratingEl.textContent = '+25';
        ratingEl.className = 'recap-meta-value highlight-green';
        ratingEl.style.color = '';
      } else if (isDraw) {
        ratingEl.textContent = '+0';
        ratingEl.className = 'recap-meta-value';
        ratingEl.style.color = '#94a3b8';
      } else {
        ratingEl.textContent = '-18';
        ratingEl.className = 'recap-meta-value';
        ratingEl.style.color = '#ef4444';
      }
    }

    
    
    
    // Show/Hide Rematch button based on game mode
    const rematchBtn = document.getElementById('victory-btn-rematch');
    const newMatchBtn = document.getElementById('victory-btn-playagain');
    if (rematchBtn) {
        if (this.gameMode === 'online') {
            rematchBtn.style.display = 'inline-block';
            rematchBtn.disabled = false;
            rematchBtn.innerHTML = '<span>Rematch</span>';
        } else {
            rematchBtn.style.display = 'none';
        }
    }
    if (newMatchBtn) {
        newMatchBtn.innerHTML = this.gameMode === 'online' ? '<span>New Opponent</span>' : '<span>Play Again</span>';
    }
    
    
    
    const playerNameEl = document.getElementById('victory-player-name');
    const playerRatingEl = document.getElementById('victory-player-rating');
    const rawPlayerName = document.getElementById('bottom-player-name')?.textContent || 'OwlRider';
    const currentPlayerName = rawPlayerName.replace(/\s*\([♔♚]\)/, '');
    const currentPlayerRating = document.getElementById('bottom-player-rating')?.textContent || '1240';
    if (playerNameEl) playerNameEl.textContent = currentPlayerName;
    if (playerRatingEl) playerRatingEl.textContent = currentPlayerRating;
    
    // Sync avatars from in-game UI to victory screen
    const victoryPlayerAvatar = document.getElementById('victory-player-avatar');
    const inGamePlayerAvatar = document.getElementById('bottom-player-avatar');
    if (victoryPlayerAvatar && inGamePlayerAvatar && inGamePlayerAvatar.src) {
        victoryPlayerAvatar.src = inGamePlayerAvatar.src;
    }

    const victoryOppAvatar2 = document.getElementById('victory-opp-avatar');
    const inGameOppAvatar = document.getElementById('top-player-avatar');
    if (victoryOppAvatar2) {
        if (inGameOppAvatar && inGameOppAvatar.src) {
            victoryOppAvatar2.src = inGameOppAvatar.src;
        } else if (this.opponentAvatarSrc) {
            victoryOppAvatar2.src = this.opponentAvatarSrc;
        }
    }
    
    this.showScreen('screen-victory');
  }

  addFriend(username) {
    if (!username || username === 'AI') {
      this.showToast('Cannot add AI as a friend');
      return;
    }
    const btn = document.getElementById('btn-add-friend-gameover');
    if (btn) {
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      btn.style.backgroundColor = '#22c55e';
      btn.style.borderColor = '#22c55e';
      btn.style.color = '#fff';
      btn.title = 'Friend Request Sent';
      btn.style.transform = 'scale(1)';
    }
    this.showToast('Friend Request Sent!');
    console.log(`Friend request sent to ${username}`);
  }

  restartGame() {
    if (this.gameMode === 'ai') {
      const difficulty = this.ai ? this.ai.difficulty : 'medium';
      this.startAIGame(difficulty);
    } else if (this.gameMode === 'online') {
      this.showMatchmakingScreen('matchmaking');
    } else {
      this.startMatchAgainstShadowOwl();
    }
  }

  // ─── In-Game 3-Action Controls (Undo, Hint, Resign) ──

  getHint() {
    if (!this.engine || this.engine.gameOver) {
      this.showToast('No active game for hints');
      return;
    }
    if (this.engine.currentTurn !== this.playerColor) {
      this.showToast('Wait for your turn to get a hint');
      return;
    }

    this.hintCountInMatch = (this.hintCountInMatch || 0) + 1;
    const hintCost = Math.pow(2, this.hintCountInMatch - 1) * 20;
    if ((this.coins || 0) < hintCost) {
      this.showToast(`Need ${hintCost} coins for hint! (You have ${this.coins || 0})`);
      this.hintCountInMatch--;
      return;
    }
    this.coins -= hintCost;
    try { localStorage.setItem('owl_coins', this.coins); } catch(e){}
    this.updateCoinDisplay();

    const hintAI = new AIEngine('hard');
    const bestMove = hintAI.getBestMove(this.engine);
    if (!bestMove) {
      this.showToast('No hints available right now');
      return;
    }

    // Clear previous hint highlights
    document.querySelectorAll('.square.hint-move').forEach(sq => {
      sq.classList.remove('hint-move');
    });

    const fromSquare = document.querySelector(`.square[data-row="${bestMove.fromRow}"][data-col="${bestMove.fromCol}"]`);
    const toSquare = document.querySelector(`.square[data-row="${bestMove.row}"][data-col="${bestMove.col}"]`);

    if (fromSquare) fromSquare.classList.add('hint-move');
    if (toSquare) toSquare.classList.add('hint-move');

    const files = 'abcdefgh';
    const fromCoord = `${files[bestMove.fromCol]}${8 - bestMove.fromRow}`;
    const toCoord = `${files[bestMove.col]}${8 - bestMove.row}`;
    this.showToast(`💡 Hint: Move ${fromCoord} → ${toCoord}`);

    setTimeout(() => {
      if (fromSquare) fromSquare.classList.remove('hint-move');
      if (toSquare) toSquare.classList.remove('hint-move');
    }, 3500);
  }

  getUserCoins() {
    let saved = localStorage.getItem('owl_coins');
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) return parsed;
    }
    const balanceEl = document.getElementById('profile-wallet-balance');
    if (balanceEl) {
      const parsed = parseInt(balanceEl.textContent.replace(/,/g, ''), 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 1000;
  }

  updateUserCoins(newAmount) {
    this.coins = newAmount;
    try {
      localStorage.setItem('owl_coins', newAmount);
    } catch(e) {}
    
    const profileEl = document.getElementById('profile-wallet-balance');
    if (profileEl) profileEl.textContent = newAmount.toLocaleString();

    const walletBalEl = document.getElementById('wallet-balance');
    if (walletBalEl && walletBalEl.textContent.includes('Coin')) {
      walletBalEl.textContent = newAmount.toLocaleString() + ' Coins';
    }

    const joinBalEl = document.getElementById('join-user-balance-display');
    if (joinBalEl) joinBalEl.textContent = newAmount.toLocaleString() + ' Coins';
  }

  undoMove() {
    if (this.gameMode === 'online') {
      this.showToast('Undo is disabled in competitive PvP');
      return;
    }
    if (!this.engine || this.engine.moveHistory.length === 0) {
      this.showToast('No moves to undo');
      return;
    }

    const cost = 5;
    const currentCoins = this.getUserCoins();
    if (currentCoins < cost) {
      this.showToast(`Need ${cost} coins to Undo! (You have ${currentCoins})`);
      return;
    }

    // Deduct 5 coins
    this.updateUserCoins(currentCoins - cost);

    // Rollback moves (AI move + Player move if both moved, else 1)
    let movesToPop = 1;
    if (this.engine.currentTurn === this.playerColor && this.engine.moveHistory.length >= 2) {
      movesToPop = 2;
    }

    const targetHistory = this.engine.moveHistory.slice(0, this.engine.moveHistory.length - movesToPop);

    // Replay history on fresh engine
    const freshEngine = new ChessEngine();
    for (const m of targetHistory) {
      freshEngine.makeMove(m.from.row, m.from.col, m.to.row, m.to.col, m.promotion || null);
    }

    this.engine = freshEngine;
    this.lastMove = targetHistory.length > 0 ? {
      from: targetHistory[targetHistory.length - 1].from,
      to: targetHistory[targetHistory.length - 1].to
    } : null;

    this.selectedSquare = null;
    this.legalMoves = [];

    this.renderBoard();
    this.updateCapturedPieces();
    this.rebuildMoveHistoryUI();
    this.updatePlayerBars();
    this.showToast(`Move undone ↺ (-${cost} coins)`);
  }

  rebuildMoveHistoryUI() {
    this.updateMoveHistoryUI();
  }

  // ─── Robin Owls Navigation & Features ───────────────

  updateBottomNav(tabName) {
    const tabIndices = { home: 0, rankings: 1, shop: 2, profile: 3, wallet: 3 };
    const targetIdx = tabIndices[tabName] !== undefined ? tabIndices[tabName] : 0;

    document.querySelectorAll('.fantasy-bottom-nav').forEach(nav => {
      nav.setAttribute('data-active-index', targetIdx);
      const tabs = nav.querySelectorAll('.nav-tab');
      tabs.forEach((tab, idx) => {
        tab.classList.toggle('active', idx === targetIdx);
      });
    });
  }

  showProfileScreen() {
    this.updateBottomNav('profile');
    this.showScreen('screen-profile');
  }

  showDiscoverScreen() {
    this.updateBottomNav('discover');
    this.showScreen('screen-discover');
  }

  syncAbilitiesUI() {
    const valid = ['swap', 'freeze', 'second', 'shield', 'jump'];
    if (!Array.isArray(this.selectedAbilities)) {
      this.selectedAbilities = ['swap', 'freeze'];
    }
    this.selectedAbilities = this.selectedAbilities.filter(a => valid.includes(a));
    if (this.selectedAbilities.length > 2) {
      this.selectedAbilities = this.selectedAbilities.slice(0, 2);
    }

    valid.forEach(id => {
      const card = document.getElementById(`ability-card-${id}`);
      if (card) {
        if (this.selectedAbilities.includes(id)) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      }

      const medallion = document.getElementById(`preview-medallion-${id}`);
      if (medallion) {
        if (this.selectedAbilities.includes(id)) {
          medallion.style.opacity = '1';
          medallion.style.borderColor = '#FFD54F';
          medallion.style.boxShadow = '0 0 12px rgba(255, 213, 79, 0.7)';
          medallion.style.transform = 'scale(1.1)';
        } else {
          medallion.style.opacity = '0.35';
          medallion.style.borderColor = '#5A351C';
          medallion.style.boxShadow = 'none';
          medallion.style.transform = 'scale(1)';
        }
      }
    });

    this.updateHomeAbilitiesDisplay();
  }

  showAbilitiesScreen() {
    try {
      let saved = JSON.parse(localStorage.getItem('owl_selected_abilities'));
      if (Array.isArray(saved) && saved.length === 2) {
        this.selectedAbilities = [...saved];
      }
    } catch(e) {}
    this.syncAbilitiesUI();
    this.showScreen('screen-abilities');
  }

  toggleAbility(abilityId) {
    const valid = ['swap', 'freeze', 'second', 'shield', 'jump'];
    if (!valid.includes(abilityId)) return;
    if (!Array.isArray(this.selectedAbilities)) {
      this.selectedAbilities = [];
    }
    const idx = this.selectedAbilities.indexOf(abilityId);
    if (idx !== -1) {
      // Already selected -> Deselect on click!
      this.selectedAbilities.splice(idx, 1);
    } else {
      // Not selected -> Select (if 2 already selected, replace the oldest one)
      if (this.selectedAbilities.length >= 2) {
        this.selectedAbilities.shift();
      }
      this.selectedAbilities.push(abilityId);
    }
    this.syncAbilitiesUI();
  }

  
    updateHomeAbilitiesDisplay() {
    const container = document.getElementById('home-selected-abilities');
    if (!container) return;
    
    const iconMap = {
      'swap': '/assets/Asset 42.png',
      'freeze': '/assets/Asset 43.png',
      'second': '/assets/Asset 44.png',
      'shield': '/assets/Asset 45.png',
      'jump': '/assets/Asset 46.png'
    };

    let html = '';
    const abilities = this.selectedAbilities || ['swap', 'freeze'];
    abilities.forEach(ab => {
      if (iconMap[ab]) {
        html += `<div style="width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #C99700; background: #2A170B; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"><img src="${iconMap[ab]}" style="width: 17px; height: 17px; object-fit: contain;"></div>`;
      } else if (emojiMap[ab]) {
        html += `<div style="width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #C99700; background: #2A170B; display: flex; align-items: center; justify-content: center; font-size: 13px; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">${emojiMap[ab]}</div>`;
      }
    });
    container.innerHTML = html;
  }

  confirmAbilities() {
    if (!this.selectedAbilities || this.selectedAbilities.length < 2) {
      this.showToast('Please select exactly 2 abilities to continue!');
      return;
    }
    try {
      localStorage.setItem('owl_selected_abilities', JSON.stringify(this.selectedAbilities));
    } catch(e) {}
    this.updateHomeAbilitiesDisplay();
    this.showToast('Abilities confirmed! Tactical loadout saved ⚡');
    this.goHome();
  }

  showMatchmakingScreen(mode = 'matchmaking') {
    this.updateBottomNav('play');
    this.showScreen('screen-matchmaking');
    

    const estWait = document.getElementById('matchmaking-wait-time');
    if (estWait) estWait.textContent = '~ 15 seconds';

    // Clear any previous auto-match timeout
    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }
  }

  cancelMatchmaking() {
    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }
    this.goHome();
  }

  setMatchmakingMode(mode) {
    this.currentMatchMode = mode;
    const standardBtn = document.getElementById('mode-btn-standard');
    const robinBtn = document.getElementById('mode-btn-robin');
    if (mode === 'standard') {
      if (standardBtn) standardBtn.classList.add('active');
      if (robinBtn) robinBtn.classList.remove('active');
      this.showToast('Standard mode selected');
    } else {
      if (robinBtn) robinBtn.classList.add('active');
      if (standardBtn) standardBtn.classList.remove('active');
      this.showToast('Robin Mode (NFT abilities enabled) 🔒');
    }
  }

  startMatchAgainstShadowOwl() {
    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }
    this.gameMode = 'ai';
    this.playerColor = 'white';
    this.boardFlipped = false;
    this.engine = new ChessEngine();
    this.ai = new AIEngine('medium');
    this.lastMove = null;
    this.gameStartTime = Date.now();
    this.timers = { white: 10 * 60 * 1000, black: 10 * 60 * 1000 };

    const topName = document.getElementById('top-player-name');
    const topRating = document.getElementById('top-player-rating');
    const topAvatar = document.getElementById('top-player-avatar');
    const bottomName = document.getElementById('bottom-player-name');
    const bottomRating = document.getElementById('bottom-player-rating');
    const bottomAvatar = document.getElementById('bottom-player-avatar');

    if (topName) topName.textContent = 'ShadowOwl';
    if (topRating) topRating.textContent = '1180';
    if (topAvatar) topAvatar.src = this.opponentAvatarSrc || '/assets/shadow_owl_avatar.gif';
    if (bottomName) bottomName.textContent = 'OwlRider';
    if (bottomRating) bottomRating.textContent = '1240';
    if (bottomAvatar) bottomAvatar.src = '/assets/owl_avatar.jpg';

    const drawBtn = document.getElementById('btn-ingame-draw');
    if (drawBtn) drawBtn.style.display = 'none';
    const resignBtn = document.getElementById('btn-ingame-resign');
    if (resignBtn) resignBtn.style.display = '';

    this.clearMoveHistory();
    this.clearCapturedPieces();
    this.showScreen('screen-game');
    this.renderBoard();
    this.updatePlayerBars();
    this.startTimerTick();
    this.showToast('Opponent Found: ShadowOwl (1180) ⚔️');
  }

  // ─── Controls ──────────────────────────────────────

  confirmResign() {
    this.showConfirm('Resign?', 'Are you sure you want to resign?', () => {
      if (this.gameMode === 'online') {
        this.multiplayer.resign();
      } else {
        const winner = this.playerColor === 'white' ? 'black' : 'white';
        this.engine.gameOver = true;
        this.engine.gameResult = { winner, reason: 'resignation' };
        this.playSound('gameover');
        this.showGameOver();
      }
    });
  }

  offerDraw() {
    if (this.gameMode !== 'online') {
      this.showToast('Draw offers are for online games');
      return;
    }
    this.showConfirm('Offer Draw?', 'Offer a draw to your opponent?', () => {
      this.multiplayer.offerDraw();
      this.showToast('Draw offered');
    });
  }

  acceptDraw() {
    this.hideModal('modal-draw-offer');
    if (this.multiplayer) this.multiplayer.acceptDraw();
  }

  declineDraw() {
    this.hideModal('modal-draw-offer');
    if (this.multiplayer) this.multiplayer.declineDraw();
    this.showToast('Draw declined');
  }

  requestRematch() {
    if (this.gameMode === 'online' && this.multiplayer) {
      this.multiplayer.requestRematch();
      this.showToast('Rematch requested');
      document.getElementById('btn-rematch').disabled = true;
      document.getElementById('btn-rematch').textContent = 'Waiting...';
    }
  }

  goHome() {
    this.stopBgMusic();
    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }
    this.stopTimerTick();
    if (this.multiplayer) {
      this.multiplayer.disconnect();
      this.multiplayer = null;
    }
    
    // Hide all possible open modals
    this.hideModal('modal-gameover');
    this.hideModal('modal-confirm');
    this.hideModal('modal-draw-offer');
    this.hideModal('modal-spectate');
    
    this.engine = null;
    this.ai = null;
    this.selectedSquare = null;
    this.legalMoves = [];
    this.lastMove = null;

    // Reset UI buttons safely
    try {
      const resignBtn = document.getElementById('btn-ingame-resign');
      if (resignBtn) resignBtn.classList.remove('hidden');
      const drawBtn = document.getElementById('btn-ingame-draw');
      if (drawBtn) drawBtn.classList.remove('hidden');
      const leaveBtn = document.getElementById('btn-leave-spectate');
      if (leaveBtn) leaveBtn.classList.add('hidden');
      
      // Hide spectator count
      const specCount = document.getElementById('spectator-count-container');
      if (specCount) specCount.style.display = 'none';
      
      // Hide connection status banner
      const connStatus = document.getElementById('connection-status');
      if (connStatus) connStatus.classList.add('hidden');
    } catch (e) {
      console.warn('goHome cleanup error:', e);
    }

    try {
      let saved = JSON.parse(localStorage.getItem('owl_selected_abilities'));
      if (Array.isArray(saved) && saved.length === 2) {
        this.selectedAbilities = saved;
      } else if (!this.selectedAbilities || this.selectedAbilities.length < 2) {
        this.selectedAbilities = ['swap', 'freeze'];
      }
    } catch(e) {
      if (!this.selectedAbilities || this.selectedAbilities.length < 2) {
        this.selectedAbilities = ['swap', 'freeze'];
      }
    }
    this.updateHomeAbilitiesDisplay();
    this.isMyTurn = false;
    this.updateBottomNav('home');
    this.showScreen('screen-home');
  }

  // ─── Connection Status ─────────────────────────────

  showConnectionStatus(status) {
    const el = document.getElementById('connection-status');
    el.classList.remove('hidden', 'connected', 'reconnecting', 'disconnected');
    el.classList.add(status);
    el.querySelector('.status-text').textContent =
      status === 'reconnecting' ? 'Reconnecting...' : 'Opponent disconnected';
  }

  hideConnectionStatus() {
    document.getElementById('connection-status').classList.add('hidden');
  }

  // ─── Modals ────────────────────────────────────────

  showModal(id) {
    if (id === 'modal-profile') {
      const balanceEl = document.getElementById('profile-wallet-balance');
      const profileBalEl = document.getElementById('profile-wallet-balance');
      if (balanceEl && profileBalEl) {
        profileBalEl.textContent = balanceEl.textContent;
      }
    }
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
  }



  toggleSound() {
    this.soundMuted = !this.soundMuted;
    const btn = document.getElementById('btn-toggle-sound');
    if (btn) btn.innerHTML = this.soundMuted ? '🔇 SFX: Off' : '🔊 SFX: On';
    this.showToast(this.soundMuted ? 'Sound effects muted' : 'Sound effects enabled');
  }

  hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
  }

  showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const yesBtn = document.getElementById('confirm-yes');
    yesBtn.onclick = () => {
      this.hideModal('modal-confirm');
      onConfirm();
    };
    this.showModal('modal-confirm');
  }

  // ─── Toast ─────────────────────────────────────────

  
  handleAuthRequireUsername(wallet) {
    const modal = document.getElementById('username-modal');
    const input = document.getElementById('username-input');
    const btn = document.getElementById('btn-submit-username');
    const cancelBtn = document.getElementById('btn-cancel-username');
    const title = document.getElementById('username-modal-title');
    const subtitle = document.getElementById('username-modal-subtitle');
    
    if (modal && input && btn) {
      // Differentiate between Create and Edit based on existing user profile
      if (this.userProfile && this.userProfile.username) {
        title.textContent = "Edit Profile";
        subtitle.textContent = "Change your username below.";
        input.value = this.userProfile.username;
        cancelBtn.style.display = 'block';
      } else {
        title.textContent = "Create Profile";
        subtitle.textContent = "Welcome! Please choose a unique username.";
        input.value = "";
        cancelBtn.style.display = 'none'; // Can't cancel initial creation
      }
      
      modal.classList.remove('hidden');
      input.focus();
      
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          modal.classList.add('hidden');
        };
      }
      
      btn.onclick = () => {
        const username = input.value.trim();
        if (username.length >= 3) {
          modal.classList.add('hidden');
          if (this.multiplayer && this.multiplayer.ws) {
            this.multiplayer.send({ type: 'set_username', walletAddress: wallet, username: username });
          }
        } else {
          this.showToast("Username must be at least 3 characters.");
        }
      };
    } else {
      this.showToast("Username is required to play online.");
    }
  }

  handleAuthSuccess(user) {
    this.userProfile = user;
    this.showToast(`Welcome back, ${user.username}!`);
    
    // Update all instances of the username in the DOM
    document.querySelectorAll('.fantasy-username').forEach(el => el.textContent = user.username);
    document.querySelectorAll('.profile-name').forEach(el => el.textContent = user.username);
    document.querySelectorAll('.profile-hero-name').forEach(el => el.textContent = user.username);
    document.querySelectorAll('.wallet-panel-name').forEach(el => el.textContent = user.username);
    
    const bottomPlayer = document.getElementById('bottom-player-name');
    if (bottomPlayer) bottomPlayer.textContent = user.username;
    
    const victoryPlayer = document.getElementById('victory-player-name');
    if (victoryPlayer) victoryPlayer.textContent = user.username;
    
    // Update Stats in Profile (keeping existing layout structure if possible, or basic stats)
    const profileStats = document.getElementById('profile-stats-content');
    // For now we'll just update the numeric values if they have specific IDs, but the HTML doesn't seem to have IDs for stats yet.
    // We'll replace the text content of the stat numbers using querySelector on the known DOM structure.
    
    // Let's just update the profile name which is what was requested:
    const mainProfileName = document.getElementById('main-profile-name');
    if (mainProfileName) mainProfileName.textContent = user.username;
  }

  sendEmote(text) {
    if (this.multiplayer && this.multiplayer.ws && this.roomCode) {
      this.multiplayer.send({ type: 'chat_message', roomCode: this.roomCode, message: text });
    }
    const msgBox = document.getElementById('chat-messages');
    if (msgBox) {
      const p = document.createElement('div');
      p.style.margin = '4px 0';
      p.style.color = '#FFD54F';
      p.textContent = `You: ${text}`;
      msgBox.appendChild(p);
      msgBox.scrollTop = msgBox.scrollHeight;
    }
    this.showToast(text);
  }

  toggleCoords() {
    this.showCoords = this.showCoords === false ? true : false;
    const labels = document.querySelectorAll('.coord-label');
    labels.forEach(l => l.style.display = this.showCoords ? '' : 'none');
    const btn = document.getElementById('btn-toggle-coords');
    if (btn) btn.textContent = this.showCoords ? '🔤 Coords: On' : '🔤 Coords: Off';
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }


  equipCosmetic(type, id) {
    if (type === 'board') {
      document.body.dataset.boardTheme = id;
      localStorage.setItem('owl_board_theme', id);
      this.showToast('Equipped ' + id + ' board!');
    } else if (type === 'table') {
      document.body.dataset.tableTheme = id;
      localStorage.setItem('owl_table_theme', id);
      this.showToast('Equipped ' + id + ' table!');
    }
  }

  showShopScreen() {
    this.updateBottomNav('shop');
    this.showScreen('screen-shop');
  }

  showLeaderboardScreen() {
    this.updateBottomNav('rankings');
    this.showScreen('screen-leaderboard');
    const list = document.getElementById('leaderboard-list');
    if (list && list.children.length === 0) {
      let html = '';
      const names = ['OwlMaster', 'NightWatcher', 'SilentWing', 'ShadowBeak', 'LunaTalons'];
      for (let i = 0; i < 100; i++) {
        let name = i < 5 ? names[i] : 'Player_' + (1000 + i);
        let rating = 2500 - (i * 12);
        let rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        html += `<div class="ranking-card" style="background: linear-gradient(180deg, #4A2E1B 0%, #2A170C 100%); border: 1.5px solid #8C6538; border-radius: 12px; padding: 12px 18px; margin-bottom: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 16px; flex: 1;">
            <div style="font-family: 'Georgia', serif; font-size: 20px; font-weight: 800; width: 32px; text-align: center; color: ${i === 0 ? '#FFD700' : i === 1 ? '#E0E0E0' : i === 2 ? '#CD7F32' : '#C99700'};">${i+1}</div>
            <div style="display: flex; flex-direction: column;">
              <div class="ranking-name" style="font-family: 'Georgia', serif; font-weight: 700; color: #FDF7EC; font-size: 16px; letter-spacing: 0.5px;">${name}</div>
              <div style="font-size: 13px; color: #D6BD9B; font-weight: 600; margin-top: 2px;">Rating: <span style="color: #FFD54F; font-weight: 800;">${rating}</span></div>
            </div>
          </div>
          <div style="font-size: 22px; filter: drop-shadow(0 0 6px rgba(201,151,0,0.5));">
            ${i < 3 ? '🏆' : ''}
          </div>
        </div>`;
      }
      list.innerHTML = html;
    }
  }

  disconnectWallet() {
    this.walletAddress = null;
    
    // Reset Header Button
    const btn = document.getElementById('btn-connect-wallet');
    if (btn) {
      btn.style.background = '#C99700';
      btn.style.color = '#20120B';
      btn.onclick = () => this.connectWallet();
      const bal = document.getElementById('wallet-balance');
      if(bal) bal.textContent = 'Connect';
    }
    
    // Hide Disconnect Button in Profile
    const disconnectBtn = document.getElementById('btn-disconnect-wallet');
    if (disconnectBtn) disconnectBtn.style.display = 'none';
    const profileWallet = document.getElementById('profile-wallet-address');
    if (profileWallet) {
      profileWallet.textContent = '';
      profileWallet.style.display = 'none';
    }
    
    this.showToast('Wallet Disconnected');
    this.goHome();
  }

  async connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        this.walletAddress = accounts[0];
        
        // Update UI
        const shortAddr = this.walletAddress.substring(0,6) + '...' + this.walletAddress.substring(38);
        const btn = document.getElementById('btn-connect-wallet');
        if (btn) {
          btn.style.background = 'rgba(181, 176, 255, 0.2)';
          btn.style.color = '#f1f0ff';
          btn.onclick = () => this.showProfileScreen(); // Change behavior to open profile after connect
          const bal = document.getElementById('wallet-balance');
          if(bal) bal.textContent = shortAddr;
        }
        
        const profileWallet = document.getElementById('profile-wallet-address');
        if (profileWallet) {
          profileWallet.textContent = shortAddr;
          profileWallet.style.display = 'inline-block';
        }
        
        this.showToast('Wallet Connected!');
        const disconnectBtn = document.getElementById('btn-disconnect-wallet');
        if (disconnectBtn) disconnectBtn.style.display = 'block';
        
        // Send to backend if socket is open
        // Ensure multiplayer is connected before authenticating
        if (!this.multiplayer) {
          this.multiplayer = new MultiplayerClient();
          this.setupMultiplayerCallbacks();
          await this.multiplayer.connect();
        } else if (this.multiplayer.ws && this.multiplayer.ws.readyState !== WebSocket.OPEN) {
          await this.multiplayer.connect();
        }
        
        if (this.multiplayer && this.multiplayer.ws && this.multiplayer.ws.readyState === WebSocket.OPEN) {
          this.multiplayer.send({ type: 'authenticate', walletAddress: this.walletAddress });
        }
      } catch (err) {
        console.error(err);
        this.showToast('Wallet connection failed.');
      }
    } else {
      this.showToast('Please install MetaMask or an EVM wallet.');
    }
  }



  toggleWalletPanel() {
    this.showProfileScreen();
    return;
    const panel = document.getElementById("wallet-panel");
    const backdrop = document.getElementById("wallet-panel-backdrop");
    if (!panel || !backdrop) return;

    const isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "block";
    if (!isOpen) this.updateBottomNav("wallet");
    backdrop.style.display = isOpen ? "none" : "block";

    if (!isOpen) {
      // Update address
      const addr = document.getElementById("wp-address");
      if (addr) {
        if (this.walletAddress) {
          const short = this.walletAddress.substring(0,6) + "..." + this.walletAddress.substring(38);
          addr.textContent = short;
        } else {
          addr.textContent = "Not Connected";
        }
      }
      const connectBtn = document.getElementById("wp-connect-btn");
      if (connectBtn) {
        connectBtn.style.display = this.walletAddress ? "none" : "flex";
      }

      // Random amounts: ETH between 0.05 and 3.5, USDT between 10 and 500
      const ethAmount = (Math.random() * 3.45 + 0.05).toFixed(4);
      const usdtAmount = (Math.random() * 490 + 10).toFixed(2);

      // Fetch live ETH price from CoinGecko public API
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
        .then(r => r.json())
        .then(data => {
          const ethPrice = data.ethereum.usd;
          const ethUSD = (parseFloat(ethAmount) * ethPrice).toFixed(2);
          const totalUSD = (parseFloat(ethUSD) + parseFloat(usdtAmount)).toFixed(2);

          // Balance card
          const balEl = document.getElementById("wp-balance");
          const usdEl = document.getElementById("wp-usd");
          if (balEl) balEl.textContent = ethAmount + " ETH";
          if (usdEl) usdEl.textContent = "≈ $" + Number(totalUSD).toLocaleString();

          // ETH asset row
          const ethAmtEl = document.getElementById("wp-eth-amount");
          const ethFiatEl = document.getElementById("wp-eth-fiat");
          if (ethAmtEl) ethAmtEl.textContent = ethAmount;
          if (ethFiatEl) ethFiatEl.textContent = "$" + Number(ethUSD).toLocaleString();

          // USDT asset row
          const usdtAmtEl = document.getElementById("wp-usdt-amount");
          const usdtFiatEl = document.getElementById("wp-usdt-fiat");
          if (usdtAmtEl) usdtAmtEl.textContent = usdtAmount;
          if (usdtFiatEl) usdtFiatEl.textContent = "$" + usdtAmount;
        })
        .catch(() => {
          // Fallback if no internet: use approximate ETH price
          const ethPrice = 2580;
          const ethUSD = (parseFloat(ethAmount) * ethPrice).toFixed(2);
          const totalUSD = (parseFloat(ethUSD) + parseFloat(usdtAmount)).toFixed(2);
          const balEl = document.getElementById("wp-balance");
          const usdEl = document.getElementById("wp-usd");
          if (balEl) balEl.textContent = ethAmount + " ETH";
          if (usdEl) usdEl.textContent = "≈ $" + Number(totalUSD).toLocaleString();
          const ethAmtEl = document.getElementById("wp-eth-amount");
          const ethFiatEl = document.getElementById("wp-eth-fiat");
          if (ethAmtEl) ethAmtEl.textContent = ethAmount;
          if (ethFiatEl) ethFiatEl.textContent = "$" + Number(ethUSD).toLocaleString();
          const usdtAmtEl = document.getElementById("wp-usdt-amount");
          const usdtFiatEl = document.getElementById("wp-usdt-fiat");
          if (usdtAmtEl) usdtAmtEl.textContent = usdtAmount;
          if (usdtFiatEl) usdtFiatEl.textContent = "$" + usdtAmount;
        });
    }
  }



  // ─── Friends & Invitations System ───────────────
  

  sendFriendRequest() {
    const input = document.getElementById('add-friend-input');
    if (!input || !input.value.trim()) return;
    if (!this.walletAddress) { this.showToast('Connect your wallet first!'); return; }
    if (this.multiplayer && this.multiplayer.ws) {
      this.multiplayer.send({ type: 'send_friend_request', targetUsername: input.value.trim(), walletAddress: this.walletAddress });
      input.value = '';
    }
  }

  showFriendRequests() {
    const modal = document.getElementById('friend-requests-modal');
    if (modal) {
      modal.classList.remove('hidden');
      if (this.multiplayer && this.multiplayer.ws) {
        this.multiplayer.send({ type: 'get_friend_requests', walletAddress: this.walletAddress });
      }
      const badge = document.getElementById('friend-requests-badge');
      if (badge) {
        badge.style.display = 'none';
        badge.textContent = '0';
      }
    }
  }

  respondFriendRequest(id, action) {
    if (this.multiplayer && this.multiplayer.ws) {
      this.multiplayer.send({ type: 'respond_friend_request', requestId: id, action: action, walletAddress: this.walletAddress });
    }
  }

  renderFriendRequests(requests) {
    const list = document.getElementById('friend-requests-list');
    if (!list) return;
    
    if (!requests || requests.length === 0) {
      list.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; margin: 20px 0;">No incoming requests.</p>';
      return;
    }
    
    let html = '';
    requests.forEach(req => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; border: 1px solid rgba(181, 176, 255, 0.2);">
          <span style="font-weight: bold; color: white;">${req.username}</span>
          <div style="display: flex; gap: 8px;">
            <button onclick="app.respondFriendRequest('${req.id}', 'declined')" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Reject</button>
            <button onclick="app.respondFriendRequest('${req.id}', 'accepted')" style="background: #F5D36C; color: #20120B; font-weight: bold; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Accept</button>
          </div>
        </div>
      `;
    });
    list.innerHTML = html;
  }

  loadFriends() {
    if (this.multiplayer && this.multiplayer.ws && this.multiplayer.ws.readyState === WebSocket.OPEN) {
      this.multiplayer.send({ type: 'get_friends', walletAddress: this.walletAddress });
    }
  }

  renderFriendsList(friends) {
    const container = document.querySelector('.friends-list');
    if (!container) return;

    if (!friends || friends.length === 0) {
      container.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px 0; font-size: 14px;">No friends yet. Add someone above!</p>';
      return;
    }

    let html = '';
    friends.forEach(f => {
      html += `
        <div class="friend-item">
          <div class="friend-avatar-wrap">
            <img src="/assets/owl_avatar.jpg" onerror="this.src='/assets/10.jpg'" />
            <div class="online-indicator"></div>
          </div>
          <div class="friend-info">
            <span class="friend-name">${f.username}</span>
            <span class="friend-rating">${f.elo || 1200}</span>
          </div>
          <button class="btn-invite-friend" onclick="app.inviteFriend('${f.username}', this)">Invite</button>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  toggleFriendsList() {
    const sidebar = document.getElementById('friends-sidebar');
    if (sidebar) {
      const isOpening = sidebar.classList.contains('closed');
      if (isOpening) {
        sidebar.classList.remove('closed');
        if (this.walletAddress) {
          this.loadFriends();
        }
      } else {
        sidebar.classList.add('closed');
      }
    }
  }

  inviteFriend(username, btn) {
    this.pendingInviteTarget = username;
    this.pendingInviteBtn = btn;
    this.timerMinutes = 10;
    
    const sidebar = document.getElementById('friends-sidebar');
    if (sidebar) sidebar.classList.add('closed');
    
    this.showStakeScreen('invite');
  }

  simulateIncomingInvite() {
    const popup = document.getElementById('game-invite-popup');
    if (popup) {
      document.getElementById('invite-sender-name').textContent = 'ShadowOwl';
      document.getElementById('invite-amount').textContent = '100 $OWL';
      document.getElementById('invite-mode').textContent = 'Robin';
      popup.classList.remove('hidden');
      
      const sidebar = document.getElementById('friends-sidebar');
      if (sidebar && !sidebar.classList.contains('closed')) {
        sidebar.classList.add('closed');
      }
      
      clearTimeout(this.inviteTimeout);
      this.inviteTimeout = setTimeout(() => {
        popup.classList.add('hidden');
      }, 15000);
    }
  }

  acceptInvite() {
    if (this.inviteTimeout) clearTimeout(this.inviteTimeout);
    const popup = document.getElementById('game-invite-popup');
    if (popup) popup.classList.add('hidden');
    
    this.showToast('Connecting to match...');
    
    if (this.pendingIncomingInviteRoom && this.multiplayer) {
      this.multiplayer.joinRoom(this.pendingIncomingInviteRoom);
      
      const animContainer = document.getElementById('matchmaking-animation');
      const waitingInfo = document.getElementById('waiting-room-info');
      const spinner = document.getElementById('waiting-spinner-container');
      const cancelBtn = document.getElementById('btn-cancel-waiting');
      if (animContainer) animContainer.classList.add('hidden');
      if (waitingInfo) waitingInfo.classList.remove('hidden');
      if (spinner) spinner.classList.remove('hidden');
      if (cancelBtn) cancelBtn.style.display = 'none';

      this.showScreen('screen-waiting');
      const waitingTitle = document.getElementById('waiting-title');
      if (waitingTitle) waitingTitle.textContent = 'Joining Room...';
    } else {
      this.showToast('Error: No room code found.');
    }
  }

  rejectInvite() {
    if (this.inviteTimeout) clearTimeout(this.inviteTimeout);
    const popup = document.getElementById('game-invite-popup');
    if (popup) popup.classList.add('hidden');
    
    if (this.pendingIncomingInviteRoom && this.multiplayer) {
      this.multiplayer.send({ type: 'invite_rejected', roomCode: this.pendingIncomingInviteRoom });
      this.pendingIncomingInviteRoom = null;
    }
    
    this.showToast('Invitation rejected or expired.');
  }
}

// Initialize app
const app = new App();