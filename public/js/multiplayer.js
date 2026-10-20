/**
 * Owl's Gambit — Multiplayer Client
 * WebSocket-based real-time multiplayer with room codes.
 */

class MultiplayerClient {
  constructor() {
    this.ws = null;
    this.roomCode = null;
    this.playerColor = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.gameId = null;
    this.keepAliveInterval = null;
    this.intentionalClose = false;

    // Event callbacks
    this.onRoomCreated = null;
    this.onWaitingForMatch = null;
    this.onGameStart = null;
    this.onOpponentMove = null;
    this.onOpponentDisconnected = null;
    this.onOpponentReconnected = null;
    this.onGameOver = null;
    this.onGameReconnect = null;
    this.onDrawOffered = null;
    this.onError = null;
    this.onConnectionChange = null;
    this.onOpponentResigned = null;
    this.onRematchRequested = null;
    this.onRematchAccepted = null;
    this.onTimerSync = null;
    this.onSpectatorJoined = null;
    this.onFriendsList = null;
    this.onFriendRequestsList = null;
    this.onFriendRequestReceived = null;
    this.onFriendRequestSuccess = null;
    this.onFriendRequestError = null;
    this.onChatMessage = null;
    this.onCheckRoomResult = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (window.app && window.app.walletAddress) { this.send({ type: 'authenticate', walletAddress: window.app.walletAddress }); }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.intentionalClose = false;
        if (this.onConnectionChange) this.onConnectionChange('connected');
        
        // Start client-side keepalive — sends ping every 25s to survive proxies/tunnels
        this.startKeepAlive();
        resolve();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopKeepAlive();
        if (this.onConnectionChange) this.onConnectionChange('disconnected');
        // Only auto-reconnect if we didn't close on purpose
        if (this.roomCode && !this.intentionalClose) this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        if (this.onError) this.onError('Connection error');
        reject(error);
      };
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.onError) this.onError('Failed to reconnect');
      return;
    }

    this.reconnectAttempts++;
    if (this.onConnectionChange) this.onConnectionChange('reconnecting');

    setTimeout(async () => {
      try {
        await this.connect();
        if (this.roomCode && this.gameId) {
          
          this.send({
            type: 'reconnect',
            roomCode: this.roomCode,
            gameId: this.gameId,
            color: this.playerColor
          });
        }
      } catch {
        this.attemptReconnect();
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  handleMessage(data) {
    console.log('[Multiplayer] received event:', data.type);
    switch (data.type) {
      
      case 'auth_require_username':
        if (app && app.handleAuthRequireUsername) app.handleAuthRequireUsername(data.walletAddress);
        break;
      case 'auth_success':
        if (app && app.handleAuthSuccess) app.handleAuthSuccess(data.user);
        break;
      case 'game_invite':
        if (this.onGameInvite) this.onGameInvite(data);
        break;
      case 'invite_rejected_by_target':
        if (this.onInviteRejected) this.onInviteRejected();
        break;
      case 'friends_list':
        if (this.onFriendsList) this.onFriendsList(data.friends);
        break;
      case 'friend_requests_list':
        if (this.onFriendRequestsList) this.onFriendRequestsList(data.requests);
        break;
      case 'friend_request_received':
        if (this.onFriendRequestReceived) this.onFriendRequestReceived(data.request);
        break;
      case 'friend_request_success':
        if (this.onFriendRequestSuccess) this.onFriendRequestSuccess(data.message);
        break;
      case 'friend_request_error':
        if (this.onFriendRequestError) this.onFriendRequestError(data.message);
        break;

      case 'room_created':
        this.roomCode = data.roomCode;
        this.playerColor = data.color;
        this.gameId = data.gameId;
        this.abilities = data.abilities || { self: [], opponent: [] };
          localStorage.setItem('owl_active_match', JSON.stringify({ roomCode: data.roomCode, gameId: data.gameId, color: data.color }));
          if (this.onRoomCreated) this.onRoomCreated(data.roomCode, data.color, data.stake);
        break;

      case 'check_room_result':
        if (this.onCheckRoomResult) this.onCheckRoomResult(data);
        break;

      case 'waiting_for_match':
        if (this.onWaitingForMatch) this.onWaitingForMatch();
        break;

      case 'game_start':
        if (data.roomCode) this.roomCode = data.roomCode;
        this.playerColor = data.color;
        this.gameId = data.gameId;
        this.abilities = data.abilities || { self: [], opponent: [] };
        localStorage.setItem('owl_active_match', JSON.stringify({ roomCode: this.roomCode, gameId: data.gameId, color: data.color }));
          if (this.onGameStart) this.onGameStart(data.color, data.opponent, data.timerMinutes, data.stake, data.mode);
        break;

      case 'ability_used':
          if (this.onAbilityUsed) this.onAbilityUsed(data.ability, data.args, data.color);
          break;

        case 'opponent_move':
        if (this.onOpponentMove) {
          this.onOpponentMove(data.from, data.to, data.promotion);
        }
        break;

      case 'opponent_disconnected':
        if (this.onOpponentDisconnected) this.onOpponentDisconnected();
        break;

      case 'opponent_reconnected':
        if (this.onOpponentReconnected) this.onOpponentReconnected();
        break;

      case 'game_over':
          localStorage.removeItem('owl_active_match');
          if (this.onGameOver) this.onGameOver(data.reason, data.winner, data.settlement);
        break;

      case 'draw_offered':
        if (this.onDrawOffered) this.onDrawOffered();
        break;

      case 'opponent_resigned':
        // Handled via game_over event
        break;

      case 'game_reconnect':
        this.playerColor = data.color;
        this.gameId = data.gameId;
        if (this.onGameReconnect) this.onGameReconnect(data);
        break;

      case 'rematch_requested':
        if (this.onRematchRequested) this.onRematchRequested();
        break;

      case 'rematch_accepted':
        this.playerColor = data.color;
        this.gameId = data.gameId;
        if (this.onRematchAccepted) this.onRematchAccepted(data.color);
        break;

      case 'timer_sync':
        if (this.onTimerSync) this.onTimerSync(data.white, data.black);
        break;

      case 'spectator_joined':
        this.playerColor = 'spectator';
        this.gameId = data.gameId;
        if (this.onSpectatorJoined) this.onSpectatorJoined(data);
        break;

      case 'chat_message':
        if (this.onChatMessage) this.onChatMessage(data.sender, data.senderName, data.text);
        break;

      case 'error':
        if (this.onError) this.onError(data.message);
        break;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  createRoom(timerMinutes = null, stake = 50, mode = 'standard', abilities = []) {
    this.send({ type: 'create_room', timer: timerMinutes, stake: stake, mode: mode, abilities: abilities });
  }

  checkRoom(roomCode) {
    this.send({ type: 'check_room', roomCode: roomCode.toUpperCase() });
  }

  joinRoom(roomCode, abilities = []) {
    this.roomCode = roomCode.toUpperCase();
    this.send({ type: 'join_room', roomCode: this.roomCode, abilities: abilities });
  }

  spectateRoom(roomCode, spectatorName) {
    this.roomCode = roomCode.toUpperCase();
    this.send({ type: 'spectate_room', roomCode: this.roomCode, spectatorName });
  }

  sendChatMessage(text) {
    this.send({ type: 'chat_message', text: text });
  }

  findMatch(timerMinutes = null, stakeAmount = 50, mode = 'standard', abilities = []) {
    this.send({ type: 'find_match', timer: timerMinutes, stake: stakeAmount, mode: mode, abilities: abilities });
  }

  cancelMatch() {
    this.send({ type: 'cancel_match' });
  }

  sendMove(from, to, promotion = null) {
    this.send({
      type: 'move',
      from: from,
      to: to,
      promotion: promotion
    });
  }

  resign() {
    this.send({ type: 'resign' });
  }

  offerDraw() {
    this.send({ type: 'offer_draw' });
  }

  acceptDraw() {
    this.send({ type: 'accept_draw' });
  }

  declineDraw() {
    this.send({ type: 'decline_draw' });
  }

  requestRematch() {
    this.send({ type: 'request_rematch' });
  }

  acceptRematch() {
    this.send({ type: 'accept_rematch' });
  }

  disconnect() {
    this.intentionalClose = true;
    this.roomCode = null;
    this.gameId = null;
    this.stopKeepAlive();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 25000);
  }

  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}





