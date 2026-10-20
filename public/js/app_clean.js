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
    this.isAnimatingMove = false;
    this.matchType = 'standard';
    this.selectedAbilities = ['swap', 'freeze'];
    
    this.pieceSymbols = {
      white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
      black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };

    this.init();
  }

  setGameMode(mode) {
    this.matchType = mode;
    document.getElementById('btn-mode-standard').classList.toggle('active', mode === 'standard');
    document.getElementById('btn-mode-robin').classList.toggle('active', mode === 'robin');
    
    const container = document.querySelector('.mode-toggle-container');
    if (container) {
      container.setAttribute('data-mode', mode);
    }

    const loadoutBtn = document.getElementById('btn-home-loadout');
    if (loadoutBtn) {
      if (mode === 'robin') {
        loadoutBtn.classList.remove('hidden');
      } else {
        loadoutBtn.classList.add('hidden');
      }
    }
  }

      disconnectWallet() {
    this.walletAddress = null;
    
    // Reset Header Button
    const btn = document.getElementById('btn-connect-wallet');
    if (btn) {
      btn.style.background = '#ccff00';
      btn.style.color = '#101130';
      btn.onclick = () => this.connectWallet();
      document.getElementById('wallet-balance').innerHTML = '?? <span>Connect Wallet</span>';
    }
    
    // Hide Disconnect Button in Profile
    const disconnectBtn = document.getElementById('btn-disconnect-wallet');
    if (disconnectBtn) disconnectBtn.style.display = 'none';
    
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
          document.getElementById('wallet-balance').textContent = shortAddr;
        }
        
        this.showToast('Wallet Connected!');
        const disconnectBtn = document.getElementById('btn-disconnect-wallet');
        if (disconnectBtn) disconnectBtn.style.display = 'block';
        
        // Send to backend if socket is open
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

  init() {
    const activeMatchStr = localStorage.getItem('owl_active_match');
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    
    if (activeMatchStr && !roomFromUrl) {
      try {
        const activeMatch = JSON.parse(activeMatchStr);
        this.multiplayer = new MultiplayerClient();
        this.multiplayer.roomCode = activeMatch.roomCode;
        this.multiplayer.gameId = activeMatch.gameId;
        this.multiplayer.playerColor = activeMatch.color;
        this.setupMultiplayerCallbacks();
        this.showScreen('screen-matchmaking');
          this.showToast('Reconnecting...'); // Reconnecting
        this.multiplayer.attemptReconnect();
      } catch(e) {}
    }
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
        case 'chat': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.2);
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
    this.gameMode = 'ai';
    this.playerColor = this.selectedAIColor;
    this.boardFlipped = this.playerColor === 'black';
    this.engine = new ChessEngine();
    this.ai = new AIEngine(difficulty);
    this.lastMove = null;
    this.gameStartTime = Date.now();
    this.timers = { white: null, black: null };

    this.setupGameUI('You', `AI (${difficulty})`, false);
    this.showScreen('screen-game');
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
          setTimeout(() => this.showGameOver(null), 500);
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
    this.currentStake = 5;

    const titleEl = document.getElementById('stake-screen-title');
    const descEl = document.getElementById('stake-screen-desc');
    const confirmBtn = document.getElementById('btn-confirm-stake');

    if (action === 'create_room') {
      if (titleEl) titleEl.textContent = 'Room Stake';
      if (descEl) descEl.textContent = 'Choose the wager for your room. Your friend will match this stake.';
      if (confirmBtn) confirmBtn.textContent = 'Confirm & Create Room';
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
      const amt = parseInt(amtText.replace('$', ''));
      btn.classList.toggle('active', amt === this.currentStake);
    });
    const poolEl = document.getElementById('preview-prize-pool');
    if (poolEl) poolEl.textContent = '$' + (this.currentStake * 2);
  }

  