/**
 * Owl's Gambit — AI Engine
 * Minimax with alpha-beta pruning and configurable difficulty.
 */

class AIEngine {
  constructor(difficulty = 'medium') {
    this.setDifficulty(difficulty);

    // Piece values
    this.pieceValues = {
      pawn: 100,
      knight: 320,
      bishop: 330,
      rook: 500,
      queen: 900,
      king: 20000
    };

    // Piece-square tables (from white's perspective, flipped for black)
    this.pst = {
      pawn: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5, 5, 10, 25, 25, 10, 5, 5],
        [0, 0, 0, 20, 20, 0, 0, 0],
        [5, -5, -10, 0, 0, -10, -5, 5],
        [5, 10, 10, -20, -20, 10, 10, 5],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ],
      knight: [
        [-50, -40, -30, -30, -30, -30, -40, -50],
        [-40, -20, 0, 0, 0, 0, -20, -40],
        [-30, 0, 10, 15, 15, 10, 0, -30],
        [-30, 5, 15, 20, 20, 15, 5, -30],
        [-30, 0, 15, 20, 20, 15, 0, -30],
        [-30, 5, 10, 15, 15, 10, 5, -30],
        [-40, -20, 0, 5, 5, 0, -20, -40],
        [-50, -40, -30, -30, -30, -30, -40, -50]
      ],
      bishop: [
        [-20, -10, -10, -10, -10, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 10, 10, 5, 0, -10],
        [-10, 5, 5, 10, 10, 5, 5, -10],
        [-10, 0, 10, 10, 10, 10, 0, -10],
        [-10, 10, 10, 10, 10, 10, 10, -10],
        [-10, 5, 0, 0, 0, 0, 5, -10],
        [-20, -10, -10, -10, -10, -10, -10, -20]
      ],
      rook: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [5, 10, 10, 10, 10, 10, 10, 5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [0, 0, 0, 5, 5, 0, 0, 0]
      ],
      queen: [
        [-20, -10, -10, -5, -5, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 5, 5, 5, 0, -10],
        [-5, 0, 5, 5, 5, 5, 0, -5],
        [0, 0, 5, 5, 5, 5, 0, -5],
        [-10, 5, 5, 5, 5, 5, 0, -10],
        [-10, 0, 5, 0, 0, 0, 0, -10],
        [-20, -10, -10, -5, -5, -10, -10, -20]
      ],
      king: [
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-20, -30, -30, -40, -40, -30, -30, -20],
        [-10, -20, -20, -20, -20, -20, -20, -10],
        [20, 20, 0, 0, 0, 0, 20, 20],
        [20, 30, 10, 0, 0, 10, 30, 20]
      ],
      kingEndgame: [
        [-50, -40, -30, -20, -20, -30, -40, -50],
        [-30, -20, -10, 0, 0, -10, -20, -30],
        [-30, -10, 20, 30, 30, 20, -10, -30],
        [-30, -10, 30, 40, 40, 30, -10, -30],
        [-30, -10, 30, 40, 40, 30, -10, -30],
        [-30, -10, 20, 30, 30, 20, -10, -30],
        [-30, -30, 0, 0, 0, 0, -30, -30],
        [-50, -30, -30, -30, -30, -30, -30, -50]
      ]
    };
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    switch (difficulty) {
      case 'easy':
        this.maxDepth = 1;
        this.randomFactor = 50;
        break;
      case 'medium':
        this.maxDepth = 3;
        this.randomFactor = 10;
        break;
      case 'hard':
        this.maxDepth = 4;
        this.randomFactor = 0;
        break;
      default:
        this.maxDepth = 3;
        this.randomFactor = 10;
    }
  }

  /**
   * Get the best move for the AI.
   */
  getBestMove(engine) {
    const moves = engine.getAllLegalMoves(engine.currentTurn);
    if (moves.length === 0) return null;

    // Fast-path immediate win (checkmate) or free queen capture
    for (const m of moves) {
      const c = engine.clone();
      const r = c.makeMove(m.fromRow, m.fromCol, m.row, m.col, m.promotion || null);
      if (r && c.gameOver && c.gameResult && c.gameResult.winner === engine.currentTurn) {
        return m; // Instant win found
      }
    }

    const aiColor = engine.currentTurn;
    let bestScore = -Infinity;
    let bestMoves = [];

    // Order moves for better pruning (captures & checks first)
    const orderedMoves = this.orderMoves(moves, engine);

    // Limit moves searched per turn if position has massive branching to prevent thread-lock
    const maxMovesToSearch = this.difficulty === 'easy' ? Math.min(18, orderedMoves.length) :
                             this.difficulty === 'medium' ? Math.min(28, orderedMoves.length) :
                             Math.min(38, orderedMoves.length);

    this.startTime = Date.now();
    this.timeBudgetMs = this.difficulty === 'easy' ? 300 : this.difficulty === 'medium' ? 700 : 1400;

    for (let i = 0; i < maxMovesToSearch; i++) {
      const move = orderedMoves[i];
      
      // Stop searching if exceeding time budget to keep browser 100% fluid
      if (i > 0 && (Date.now() - this.startTime) > this.timeBudgetMs) {
        break;
      }

      const clone = engine.clone();
      clone.makeMove(move.fromRow, move.fromCol, move.row, move.col, move.promotion || null);

      const score = this.minimax(clone, this.maxDepth - 1, -Infinity, Infinity, false, aiColor);

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }

    // Add randomness for lower difficulties
    if (this.randomFactor > 0 && moves.length > 1) {
      if (Math.random() * 100 < this.randomFactor) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
    }

    // If search produced candidates, pick one, else fallback to top ordered move
    if (bestMoves.length > 0) {
      return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }
    return orderedMoves[0] || moves[0];
  }

  minimax(engine, depth, alpha, beta, isMaximizing, aiColor) {
    // Time cutoff inside recursive tree to avoid frozen loop
    if (this.startTime && (Date.now() - this.startTime) > (this.timeBudgetMs + 200)) {
      return this.evaluate(engine, aiColor);
    }
    if (depth === 0 || engine.gameOver) {
      return this.evaluate(engine, aiColor);
    }

    const color = engine.currentTurn;
    const moves = engine.getAllLegalMoves(color);

    if (moves.length === 0) {
      if (engine.isKingInCheck(color)) {
        // Checkmate — maximize penalty/reward by depth
        return isMaximizing ? -100000 + (this.maxDepth - depth) : 100000 - (this.maxDepth - depth);
      }
      return 0; // Stalemate
    }

    const orderedMoves = this.orderMoves(moves, engine);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of orderedMoves) {
        const clone = engine.clone();
        clone.makeMove(move.fromRow, move.fromCol, move.row, move.col, move.promotion || null);
        const evalScore = this.minimax(clone, depth - 1, alpha, beta, false, aiColor);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of orderedMoves) {
        const clone = engine.clone();
        clone.makeMove(move.fromRow, move.fromCol, move.row, move.col, move.promotion || null);
        const evalScore = this.minimax(clone, depth - 1, alpha, beta, true, aiColor);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /**
   * Order moves for better alpha-beta pruning (captures first).
   */
  orderMoves(moves, engine) {
    return [...moves].sort((a, b) => {
      const aTarget = engine.getPiece(a.row, a.col);
      const bTarget = engine.getPiece(b.row, b.col);

      // Captures first (MVV-LVA ordering)
      const aCapture = aTarget ? this.pieceValues[aTarget.type] : 0;
      const bCapture = bTarget ? this.pieceValues[bTarget.type] : 0;

      if (aCapture !== bCapture) return bCapture - aCapture;

      // Promotions next
      if (a.promotion && !b.promotion) return -1;
      if (!a.promotion && b.promotion) return 1;

      return 0;
    });
  }

  /**
   * Evaluate board position from AI's perspective.
   */
  evaluate(engine, aiColor) {
    if (engine.gameOver) {
      if (engine.gameResult.winner === aiColor) return 100000;
      if (engine.gameResult.winner) return -100000;
      return 0; // Draw
    }

    let score = 0;
    const isEndgame = this.isEndgame(engine);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = engine.getPiece(row, col);
        if (!piece) continue;

        let pieceScore = this.pieceValues[piece.type];

        // Add positional bonus
        let pstRow = piece.color === 'white' ? row : 7 - row;
        let pstKey = piece.type;
        if (piece.type === 'king' && isEndgame) pstKey = 'kingEndgame';
        pieceScore += this.pst[pstKey][pstRow][col];

        if (piece.color === aiColor) {
          score += pieceScore;
        } else {
          score -= pieceScore;
        }
      }
    }

    // Mobility bonus
    const aiMoves = engine.getAllLegalMoves(aiColor).length;
    const opponentColor = aiColor === 'white' ? 'black' : 'white';
    const opponentMoves = engine.getAllLegalMoves(opponentColor).length;
    score += (aiMoves - opponentMoves) * 5;

    return score;
  }

  isEndgame(engine) {
    let queens = 0;
    let minorPieces = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.getPiece(r, c);
        if (p) {
          if (p.type === 'queen') queens++;
          if (p.type === 'rook' || p.type === 'bishop' || p.type === 'knight') minorPieces++;
        }
      }
    }
    return queens === 0 || (queens <= 2 && minorPieces <= 2);
  }
}
