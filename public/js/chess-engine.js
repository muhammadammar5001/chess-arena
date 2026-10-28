/**
 * Chess Arena — Chess Engine
 * Complete chess rules implementation with all special moves.
 */

class ChessEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = this.createInitialBoard();
    this.currentTurn = 'white';
    this.moveHistory = [];
    this.capturedPieces = { white: [], black: [] };
    this.castlingRights = {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true }
    };
    this.enPassantTarget = null;
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    this.positionHistory = [];
    this.stateHistory = [];
    // Number of turns that have been fully completed. Timed ability effects
    // use this instead of moveHistory.length so instant abilities and undo do
    // not consume Freeze/Shield duration.
    this.completedTurns = 0;
    this.gameOver = false;
    this.gameResult = null;
    this.kingPositions = { white: { row: 7, col: 4 }, black: { row: 0, col: 4 } };
    this.positionHistory.push(this.getBoardHash());
    this.abilitiesUsed = { white: [], black: [] };
    this.frozenPieces = [];
  }

  createInitialBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

    for (let col = 0; col < 8; col++) {
      board[0][col] = { type: backRank[col], color: 'black' };
      board[1][col] = { type: 'pawn', color: 'black' };
      board[6][col] = { type: 'pawn', color: 'white' };
      board[7][col] = { type: backRank[col], color: 'white' };
    }

    return board;
  }

  getPiece(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return this.board[row][col];
  }

  isInBounds(row, col) {
    return row >= 0 && row <= 7 && col >= 0 && col <= 7;
  }

  /**
   * Get all pseudo-legal moves for a piece (ignoring check constraints).
   */
  
  validateAbility(abilityId, args, color) {
    if (this.abilitiesUsed[color].includes(abilityId)) return false; // Already used
    if (this.currentTurn !== color && abilityId !== 'second') return false; // Not their turn
    if (this.gameOver) return false;

    if (abilityId === 'freeze') {
      const piece = args && this.getPiece(args.row, args.col);
      if (!piece || piece.color === color || piece.type === 'king') return false;
      // The target stays frozen through the owner's next completed turn.
      // The +2 is: current turn completion, then the target owner's turn.
      piece.frozenUntilTurn = this.completedTurns + 2;
      this.moveHistory.push({ notation: 'USE_FREEZE', color: color, ability: 'freeze', args: args });
      if (this.abilitiesUsed && this.abilitiesUsed[color]) this.abilitiesUsed[color].push('freeze');
      const historyBackup = this.stateHistory; this.stateHistory = []; const stateSnapshot = JSON.stringify(this); this.stateHistory = historyBackup; this.stateHistory.push(stateSnapshot);
      return true;
    }
    
    if (abilityId === 'swap') {
      const p1 = this.board[args.row1][args.col1];
      const p2 = this.board[args.row2][args.col2];
      if (this.isPieceFrozen(args.row1, args.col1) || this.isPieceFrozen(args.row2, args.col2)) return false;
      this.board[args.row1][args.col1] = p2;
      this.board[args.row2][args.col2] = p1;
      
      if (args.promotion) {
          if (p1 && p1.type === 'pawn') {
              if (p1.color === 'white' && args.row2 === 0) this.board[args.row2][args.col2] = { type: args.promotion, color: 'white' };
              if (p1.color === 'black' && args.row2 === 7) this.board[args.row2][args.col2] = { type: args.promotion, color: 'black' };
          }
          if (p2 && p2.type === 'pawn') {
              if (p2.color === 'white' && args.row1 === 0) this.board[args.row1][args.col1] = { type: args.promotion, color: 'white' };
              if (p2.color === 'black' && args.row1 === 7) this.board[args.row1][args.col1] = { type: args.promotion, color: 'black' };
          }
      }
      
      this.moveHistory.push({ notation: 'USE_TACTICAL_SWAP', color: color, ability: 'swap', args: args });
      if (this.abilitiesUsed && this.abilitiesUsed[color]) this.abilitiesUsed[color].push('swap');
      
      // Swap consumes turn
      this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
      if (this.currentTurn === 'white') this.fullMoveNumber++;
      this.completedTurns++;
      this.enPassantTarget = null; // Fix: clear en passant state so opponent doesn't inherit it
      const historyBackup = this.stateHistory; this.stateHistory = []; const stateSnapshot = JSON.stringify(this); this.stateHistory = historyBackup; this.stateHistory.push(stateSnapshot);
      return true;
    }
    
    if (abilityId === 'second') {
      const lastMove = this.moveHistory[this.moveHistory.length - 1];
      const lastMoveColor = lastMove ? (lastMove.color || (lastMove.piece && lastMove.piece.color)) : null;
      if (lastMoveColor !== color) return false; // Can only undo your own move
      
      const success = this.undoLastMove();
      if (success) {
         this.moveHistory.push({ notation: 'USE_SECOND_CHANCE', color: color, ability: 'second', args: null });
         if (this.abilitiesUsed && this.abilitiesUsed[color]) this.abilitiesUsed[color].push('second');
         const historyBackup = this.stateHistory;
        this.stateHistory = [];
        const stateSnapshot = JSON.stringify(this);
        this.stateHistory = historyBackup;
        this.stateHistory.push(stateSnapshot);
      }
      return success;
    }
    
    if (abilityId === 'shield') {
      const piece = this.getPiece(args.row, args.col);
      if (!piece || piece.color !== color) return false;
      if (piece.type === 'king' && this.isCheckmate(color)) return false;

      // Shield survives the opponent's next completed turn. Instant abilities
      // and Second Chance do not advance this counter.
      piece.shieldedUntilTurn = this.completedTurns + 2;
      this.moveHistory.push({ notation: 'USE_DIVINE_SHIELD', color: color, ability: 'shield', args: args });
      if (this.abilitiesUsed && this.abilitiesUsed[color]) this.abilitiesUsed[color].push('shield');
      const historyBackup = this.stateHistory; this.stateHistory = []; const stateSnapshot = JSON.stringify(this); this.stateHistory = historyBackup; this.stateHistory.push(stateSnapshot);
      return true;
    }

    if (abilityId === 'jump') {
      const piece = this.getPiece(args.fromRow, args.fromCol);
      if (!piece || piece.color !== color) return false;
      if (this.isPieceFrozen(args.fromRow, args.fromCol)) return false;

      const dir = color === 'white' ? -1 : 1;
      const dRow = args.toRow - args.fromRow;
      const dCol = args.toCol - args.fromCol;

      // Must move forward exactly 2 ranks in piece's direction
      if (dRow !== 2 * dir) return false;

      // Allowed column deltas:
      // Bishop: forward diagonals (dCol = -2 or +2), or straight (0)
      // Queen / King / Knight: straight (0) or forward diagonals (-2 or +2)
      // Pawn / Rook: straight (0)
      let allowedDCols = [0];
      if (piece.type === 'bishop') {
        allowedDCols = [-2, 2];
      } else if (piece.type === 'queen') {
        allowedDCols = [0, -2, 2];
      }

      if (!allowedDCols.includes(dCol)) return false;
      if (!this.isInBounds(args.toRow, args.toCol)) return false;

      const hurdleRow = args.fromRow + dir;
      const hurdleCol = args.fromCol + dCol / 2;

      if (!this.getPiece(hurdleRow, hurdleCol)) return false; // Must hurdle over a piece
      if (this.getPiece(args.toRow, args.toCol)) return false; // Landing square must be empty

      if (piece.type === 'king' && this.isSquareAttacked(args.toRow, args.toCol, color)) return false;

      this.board[args.toRow][args.toCol] = piece;
      this.board[args.fromRow][args.fromCol] = null;

      if (piece.type === 'pawn') {
        if ((color === 'white' && args.toRow === 0) || (color === 'black' && args.toRow === 7)) {
          this.board[args.toRow][args.toCol] = { type: args.promotion || 'queen', color: color };
        }
      }

      if (piece.type === 'king') {
        this.kingPositions[color] = { row: args.toRow, col: args.toCol };
      }

      this.moveHistory.push({ notation: 'USE_PEGASUS_JUMP', color: color, ability: 'jump', args: args });
      if (this.abilitiesUsed && this.abilitiesUsed[color]) this.abilitiesUsed[color].push('jump');
      this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
      if (this.currentTurn === 'white') this.fullMoveNumber++;
      this.completedTurns++;
      this.enPassantTarget = null;
      const historyBackup = this.stateHistory; this.stateHistory = []; const stateSnapshot = JSON.stringify(this); this.stateHistory = historyBackup; this.stateHistory.push(stateSnapshot);
      return true;
    }

    return false;
  }
  undoLastMove() {
    if (this.stateHistory.length === 0) return false;
    
    const lastMove = this.moveHistory[this.moveHistory.length - 1];
    if (lastMove && lastMove.ability) return false; // Cannot undo abilities directly this way
    
    const previousStateJson = this.stateHistory.pop();
    const previousState = JSON.parse(previousStateJson);
    
    // Since previousState was parsed from JSON, all nested objects are new instances.
    // Shallow assign will safely replace our engine's properties with the restored ones.
    Object.assign(this, previousState);
    
    return true;
  }

  isPieceFrozen(row, col) {
    const piece = this.getPiece(row, col);
    if (!piece || !piece.frozenUntilTurn) return false;
    return this.completedTurns < piece.frozenUntilTurn;
  }

  isPieceShielded(row, col) {
    const piece = this.getPiece(row, col);
    if (!piece || !piece.shieldedUntilTurn) return false;
    return this.completedTurns < piece.shieldedUntilTurn;
  }

  getPseudoLegalMoves(row, col) {
    if (this.isPieceFrozen(row, col)) return [];
    const piece = this.getPiece(row, col);
    if (!piece) return [];

    switch (piece.type) {
      case 'pawn': return this.getPawnMoves(row, col, piece.color);
      case 'rook': return this.getRookMoves(row, col, piece.color);
      case 'knight': return this.getKnightMoves(row, col, piece.color);
      case 'bishop': return this.getBishopMoves(row, col, piece.color);
      case 'queen': return this.getQueenMoves(row, col, piece.color);
      case 'king': return this.getKingMoves(row, col, piece.color);
      default: return [];
    }
  }

  getPawnMoves(row, col, color) {
    const moves = [];
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    const promotionRow = color === 'white' ? 0 : 7;

    // Single push
    const newRow = row + direction;
    if (this.isInBounds(newRow, col) && !this.getPiece(newRow, col)) {
      if (newRow === promotionRow) {
        ['queen', 'rook', 'bishop', 'knight'].forEach(type => {
          moves.push({ row: newRow, col, promotion: type });
        });
      } else {
        moves.push({ row: newRow, col });
      }

      // Double push from starting position
      const doubleRow = row + direction * 2;
      if (row === startRow && !this.getPiece(doubleRow, col)) {
        moves.push({ row: doubleRow, col });
      }
    }

    // Captures
    for (const dc of [-1, 1]) {
      const captureCol = col + dc;
      if (!this.isInBounds(newRow, captureCol)) continue;

      const target = this.getPiece(newRow, captureCol);
      if (target && target.color !== color && !this.isPieceShielded(newRow, captureCol)) {
        if (newRow === promotionRow) {
          ['queen', 'rook', 'bishop', 'knight'].forEach(type => {
            moves.push({ row: newRow, col: captureCol, promotion: type });
          });
        } else {
          moves.push({ row: newRow, col: captureCol });
        }
      }

      // En passant
      if (this.enPassantTarget &&
        this.enPassantTarget.row === newRow &&
        this.enPassantTarget.col === captureCol) {
        moves.push({ row: newRow, col: captureCol, enPassant: true });
      }
    }

    return moves;
  }

  getSlidingMoves(row, col, color, directions) {
    const moves = [];
    for (const [dr, dc] of directions) {
      let r = row + dr, c = col + dc;
      while (this.isInBounds(r, c)) {
        const target = this.getPiece(r, c);
        if (!target) {
          moves.push({ row: r, col: c });
        } else {
          if (target.color !== color && !this.isPieceShielded(r, c)) moves.push({ row: r, col: c });
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  getRookMoves(row, col, color) {
    return this.getSlidingMoves(row, col, color, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
  }

  getBishopMoves(row, col, color) {
    return this.getSlidingMoves(row, col, color, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  }

  getQueenMoves(row, col, color) {
    return [
      ...this.getRookMoves(row, col, color),
      ...this.getBishopMoves(row, col, color)
    ];
  }

  getKnightMoves(row, col, color) {
    const moves = [];
    const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (const [dr, dc] of offsets) {
      const r = row + dr, c = col + dc;
      if (this.isInBounds(r, c)) {
        const target = this.getPiece(r, c);
        if (!target || (target.color !== color && !this.isPieceShielded(r, c))) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }

  getKingMoves(row, col, color) {
    const moves = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (this.isInBounds(r, c)) {
          const target = this.getPiece(r, c);
          if (!target || (target.color !== color && !this.isPieceShielded(r, c))) {
            moves.push({ row: r, col: c });
          }
        }
      }
    }

    // Castling
    const rights = this.castlingRights[color];
    const kingRow = color === 'white' ? 7 : 0;

    if (row === kingRow && col === 4 && !this.isKingInCheck(color)) {
      // King-side castling
      if (rights.kingSide) {
        const rook = this.getPiece(kingRow, 7);
        if (rook && rook.type === 'rook' && rook.color === color &&
          !this.getPiece(kingRow, 5) && !this.getPiece(kingRow, 6) &&
          !this.isSquareAttacked(kingRow, 5, color) &&
          !this.isSquareAttacked(kingRow, 6, color)) {
          moves.push({ row: kingRow, col: 6, castling: 'kingSide' });
        }
      }
      // Queen-side castling
      if (rights.queenSide) {
        const rook = this.getPiece(kingRow, 0);
        if (rook && rook.type === 'rook' && rook.color === color &&
          !this.getPiece(kingRow, 1) && !this.getPiece(kingRow, 2) &&
          !this.getPiece(kingRow, 3) &&
          !this.isSquareAttacked(kingRow, 3, color) &&
          !this.isSquareAttacked(kingRow, 2, color)) {
          moves.push({ row: kingRow, col: 2, castling: 'queenSide' });
        }
      }
    }

    return moves;
  }

  /**
   * Check if a square is attacked by the opponent of `color`.
   */
  isSquareAttacked(row, col, color) {
    const opponent = color === 'white' ? 'black' : 'white';

    // Pawn attacks
    const pawnDir = color === 'white' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const r = row + pawnDir, c = col + dc;
      if (this.isInBounds(r, c)) {
        const p = this.getPiece(r, c);
        if (p && p.type === 'pawn' && p.color === opponent) return true;
      }
    }

    // Knight attacks
    const knightOffsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (const [dr, dc] of knightOffsets) {
      const r = row + dr, c = col + dc;
      if (this.isInBounds(r, c)) {
        const p = this.getPiece(r, c);
        if (p && p.type === 'knight' && p.color === opponent) return true;
      }
    }

    // King attacks
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (this.isInBounds(r, c)) {
          const p = this.getPiece(r, c);
          if (p && p.type === 'king' && p.color === opponent) return true;
        }
      }
    }

    // Rook/Queen attacks (straight lines)
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      let r = row + dr, c = col + dc;
      while (this.isInBounds(r, c)) {
        const p = this.getPiece(r, c);
        if (p) {
          if (p.color === opponent && (p.type === 'rook' || p.type === 'queen')) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }

    // Bishop/Queen attacks (diagonals)
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      let r = row + dr, c = col + dc;
      while (this.isInBounds(r, c)) {
        const p = this.getPiece(r, c);
        if (p) {
          if (p.color === opponent && (p.type === 'bishop' || p.type === 'queen')) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }

    return false;
  }

  isKingInCheck(color) {
    const kp = this.kingPositions[color];
    return this.isSquareAttacked(kp.row, kp.col, color);
  }

  isCheckmate(color) {
    return this.isKingInCheck(color) && this.getAllLegalMoves(color).length === 0;
  }

  /**
   * Get all legal moves for a piece (filters out moves that leave king in check).
   */
  getLegalMoves(row, col) {
    const piece = this.getPiece(row, col);
    if (!piece || piece.color !== this.currentTurn) return [];

    const pseudoMoves = this.getPseudoLegalMoves(row, col);
    const legalMoves = [];

    for (const move of pseudoMoves) {
      if (this.isMoveLegal(row, col, move)) {
        legalMoves.push(move);
      }
    }

    return legalMoves;
  }

  /**
   * Test if a move is legal by simulating it.
   */
  isMoveLegal(fromRow, fromCol, move) {
    const piece = this.board[fromRow][fromCol];
    const color = piece.color;

    // Save state
    const savedBoard = this.board.map(r => r.slice());
    const savedKingPos = { ...this.kingPositions[color] };

    // Make move on board
    this.board[move.row][move.col] = piece;
    this.board[fromRow][fromCol] = null;

    // Handle en passant capture
    if (move.enPassant) {
      const capturedRow = color === 'white' ? move.row + 1 : move.row - 1;
      this.board[capturedRow][move.col] = null;
    }

    // Update king position if king moved
    if (piece.type === 'king') {
      this.kingPositions[color] = { row: move.row, col: move.col };
    }

    // Check if own king is in check after move
    const inCheck = this.isKingInCheck(color);

    // Restore state
    this.board = savedBoard;
    this.kingPositions[color] = savedKingPos;

    return !inCheck;
  }

  /**
   * Get all legal moves for a player.
   */
  getAllLegalMoves(color) {
    const moves = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.getPiece(row, col);
        if (piece && piece.color === color) {
          const savedTurn = this.currentTurn;
          this.currentTurn = color;
          const pieceMoves = this.getLegalMoves(row, col);
          this.currentTurn = savedTurn;
          for (const move of pieceMoves) {
            moves.push({ fromRow: row, fromCol: col, ...move });
          }
        }
      }
    }
    return moves;
  }

  /**
   * Execute a move. Returns move metadata for UI/network.
   */
  makeMove(fromRow, fromCol, toRow, toCol, promotionType = null, strict = false) {
      const piece = this.getPiece(fromRow, fromCol);
    if (!piece || piece.color !== this.currentTurn) return null;

    // Find matching legal move
    const legalMoves = this.getLegalMoves(fromRow, fromCol);
    let move = legalMoves.find(m => {
      if (m.row !== toRow || m.col !== toCol) return false;
      if (m.promotion && promotionType) return m.promotion === promotionType;
      if (m.promotion && !promotionType) return m.promotion === 'queen'; // default
      return true;
    });

    if (!move) {
      // The authoritative multiplayer server must reject illegal moves.
      // The force path is only a last-resort client recovery mechanism.
      if (strict) return null;
      console.warn("makeMove failed: move not in legalMoves. Forcing move for multiplayer sync.", { fromRow, fromCol, toRow, toCol });
      move = { row: toRow, col: toCol, promotion: promotionType };
      if (this.board[toRow][toCol]) move.captured = true;
    }

      const historyBackup = this.stateHistory;
      this.stateHistory = [];
      const stateSnapshot = JSON.stringify(this);
      this.stateHistory = historyBackup;
      this.stateHistory.push(stateSnapshot);

    const moveData = {
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece: { ...piece },
      captured: null,
      castling: move.castling || null,
      enPassant: move.enPassant || false,
      promotion: move.promotion || null,
      check: false,
      checkmate: false,
      notation: ''
    };

    // Handle capture
    const targetPiece = this.getPiece(toRow, toCol);
    if (targetPiece) {
      moveData.captured = { ...targetPiece };
      this.capturedPieces[targetPiece.color].push(targetPiece);
      this.halfMoveClock = 0;
    } else if (move.enPassant) {
      const capturedRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
      const capturedPawn = this.getPiece(capturedRow, toCol);
      moveData.captured = { ...capturedPawn };
      this.capturedPieces[capturedPawn.color].push(capturedPawn);
      this.board[capturedRow][toCol] = null;
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    // Reset half-move clock on pawn move
    if (piece.type === 'pawn') this.halfMoveClock = 0;

    // Move piece
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    // Handle promotion
    if (move.promotion) {
      this.board[toRow][toCol] = { type: move.promotion, color: piece.color };
    }

    // Handle castling — move the rook
    if (move.castling) {
      const rookRow = piece.color === 'white' ? 7 : 0;
      if (move.castling === 'kingSide') {
        this.board[rookRow][5] = this.board[rookRow][7];
        this.board[rookRow][7] = null;
      } else {
        this.board[rookRow][3] = this.board[rookRow][0];
        this.board[rookRow][0] = null;
      }
    }

    // Update en passant target
    if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
      this.enPassantTarget = {
        row: (fromRow + toRow) / 2,
        col: fromCol
      };
    } else {
      this.enPassantTarget = null;
    }

    // Update castling rights
    if (piece.type === 'king') {
      this.castlingRights[piece.color].kingSide = false;
      this.castlingRights[piece.color].queenSide = false;
      this.kingPositions[piece.color] = { row: toRow, col: toCol };
    }
    if (piece.type === 'rook') {
      const homeRow = piece.color === 'white' ? 7 : 0;
      if (fromRow === homeRow && fromCol === 0) this.castlingRights[piece.color].queenSide = false;
      if (fromRow === homeRow && fromCol === 7) this.castlingRights[piece.color].kingSide = false;
    }
    // If a rook is captured, remove castling rights
    if (targetPiece && targetPiece.type === 'rook') {
      const homeRow = targetPiece.color === 'white' ? 7 : 0;
      if (toRow === homeRow && toCol === 0) this.castlingRights[targetPiece.color].queenSide = false;
      if (toRow === homeRow && toCol === 7) this.castlingRights[targetPiece.color].kingSide = false;
    }

    // Switch turn
    const prevTurn = this.currentTurn;
    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
    if (prevTurn === 'black') this.fullMoveNumber++;
    this.completedTurns++;

    // Generate notation
    moveData.notation = this.generateNotation(moveData, move);

    // Check for check/checkmate/stalemate
    const opponentMoves = this.getAllLegalMoves(this.currentTurn);
    const inCheck = this.isKingInCheck(this.currentTurn);

    if (inCheck && opponentMoves.length === 0) {
      moveData.checkmate = true;
      moveData.check = true;
      moveData.notation += '#';
      this.gameOver = true;
      this.gameResult = { winner: prevTurn, reason: 'checkmate' };
    } else if (inCheck) {
      moveData.check = true;
      moveData.notation += '+';
    } else if (opponentMoves.length === 0) {
      this.gameOver = true;
      this.gameResult = { winner: null, reason: 'stalemate' };
    }

    // 50-move rule
    if (this.halfMoveClock >= 100) {
      this.gameOver = true;
      this.gameResult = { winner: null, reason: '50-move rule' };
    }

    // Threefold repetition
    const hash = this.getBoardHash();
    this.positionHistory.push(hash);
    const count = this.positionHistory.filter(h => h === hash).length;
    if (count >= 3) {
      this.gameOver = true;
      this.gameResult = { winner: null, reason: 'threefold repetition' };
    }

    // Insufficient material
    const insufficientReason = this.isInsufficientMaterial();
    if (insufficientReason) {
      this.gameOver = true;
      this.gameResult = { winner: null, reason: `insufficient material: ${insufficientReason}` };
    }

    this.moveHistory.push(moveData);
    return moveData;
  }

  generateNotation(moveData, move) {
    if (move.castling === 'kingSide') return 'O-O';
    if (move.castling === 'queenSide') return 'O-O-O';

    const colLetters = 'abcdefgh';
    let notation = '';

    if (moveData.piece.type !== 'pawn') {
      const symbols = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N' };
      notation += symbols[moveData.piece.type];

      // Disambiguation — find other pieces of same type that could reach the same square
      const samePieces = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (r === moveData.to.row && c === moveData.to.col) continue; // skip the moved piece
          const p = this.getPiece(r, c);
          if (p && p.type === moveData.piece.type && p.color === moveData.piece.color) {
            // Check if this piece could also legally move to the target
            const prevTurn = this.currentTurn;
            this.currentTurn = moveData.piece.color;
            const moves = this.getLegalMoves(r, c);
            this.currentTurn = prevTurn;
            if (moves.some(m => m.row === moveData.to.row && m.col === moveData.to.col)) {
              samePieces.push({ row: r, col: c });
            }
          }
        }
      }

      if (samePieces.length > 0) {
        const sameCol = samePieces.some(p => p.col === moveData.from.col);
        const sameRow = samePieces.some(p => p.row === moveData.from.row);
        if (!sameCol) {
          notation += colLetters[moveData.from.col];
        } else if (!sameRow) {
          notation += (8 - moveData.from.row);
        } else {
          notation += colLetters[moveData.from.col] + (8 - moveData.from.row);
        }
      }
    }

    if (moveData.captured) {
      if (moveData.piece.type === 'pawn') {
        notation += colLetters[moveData.from.col];
      }
      notation += 'x';
    }

    notation += colLetters[moveData.to.col] + (8 - moveData.to.row);

    if (moveData.promotion) {
      const symbols = { queen: 'Q', rook: 'R', bishop: 'B', knight: 'N' };
      notation += '=' + symbols[moveData.promotion];
    }

    return notation;
  }

  getBoardHash() {
    const pieceChars = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' };
    let hash = this.currentTurn;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p) {
          hash += `${r}${c}${pieceChars[p.type]}${p.color[0]}`;
        }
      }
    }
    hash += JSON.stringify(this.castlingRights);
    if (this.enPassantTarget) hash += `ep${this.enPassantTarget.row}${this.enPassantTarget.col}`;
    return hash;
  }

  isInsufficientMaterial() {
    const pieces = { white: [], black: [] };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type !== 'king') {
          pieces[p.color].push({ type: p.type, row: r, col: c });
        }
      }
    }

    const w = pieces.white, b = pieces.black;

    // King vs King
    if (w.length === 0 && b.length === 0) return 'King vs King';
    // King + Bishop vs King
    if (w.length === 0 && b.length === 1 && b[0].type === 'bishop') return 'King + Bishop vs King';
    if (b.length === 0 && w.length === 1 && w[0].type === 'bishop') return 'King + Bishop vs King';
    // King + Knight vs King
    if (w.length === 0 && b.length === 1 && b[0].type === 'knight') return 'King + Knight vs King';
    if (b.length === 0 && w.length === 1 && w[0].type === 'knight') return 'King + Knight vs King';
    // King + Bishop vs King + Bishop (same color bishops)
    if (w.length === 1 && b.length === 1 &&
      w[0].type === 'bishop' && b[0].type === 'bishop') {
      const wBishopColor = (w[0].row + w[0].col) % 2;
      const bBishopColor = (b[0].row + b[0].col) % 2;
      if (wBishopColor === bBishopColor) return 'King + Bishop vs King + Bishop (same color)';
    }

    return false;
  }

  /**
   * Check if a move needs promotion input from the user.
   */
  needsPromotion(fromRow, fromCol, toRow) {
    const piece = this.getPiece(fromRow, fromCol);
    if (!piece || piece.type !== 'pawn') return false;
    const promotionRow = piece.color === 'white' ? 0 : 7;
    return toRow === promotionRow;
  }

  /**
   * Clone the engine state (for AI).
   */
  clone() {
    const copy = new ChessEngine();
    copy.board = this.board.map(r => r.map(p => p ? { ...p } : null));
    copy.currentTurn = this.currentTurn;
    copy.castlingRights = JSON.parse(JSON.stringify(this.castlingRights));
    copy.enPassantTarget = this.enPassantTarget ? { ...this.enPassantTarget } : null;
    copy.halfMoveClock = this.halfMoveClock;
    copy.fullMoveNumber = this.fullMoveNumber;
    copy.kingPositions = {
      white: { ...this.kingPositions.white },
      black: { ...this.kingPositions.black }
    };
    copy.capturedPieces = {
      white: [...this.capturedPieces.white],
      black: [...this.capturedPieces.black]
    };
    copy.positionHistory = [...this.positionHistory];
    copy.moveHistory = [...this.moveHistory];
    copy.completedTurns = this.completedTurns;
    copy.gameOver = this.gameOver;
    copy.gameResult = this.gameResult ? { ...this.gameResult } : null;
    return copy;
  }

  /**
   * Convert position to algebraic notation.
   */
  static toAlgebraic(row, col) {
    return 'abcdefgh'[col] + (8 - row);
  }

  static fromAlgebraic(notation) {
    return {
      row: 8 - parseInt(notation[1]),
      col: 'abcdefgh'.indexOf(notation[0])
    };
  }
}

// Export for Node.js (server-side validation) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChessEngine;
}











