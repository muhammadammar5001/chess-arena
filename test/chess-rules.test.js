const assert = require("assert");
const ChessEngine = require("../public/js/chess-engine.js");

console.log("--- RUNNING CHESS ENGINE CHARACTERIZATION TESTS ---");

// Test 1: Board Reset and Initial Setup
{
  const engine = new ChessEngine();
  assert.strictEqual(engine.currentTurn, "white", "Initial turn should be white");
  assert.strictEqual(engine.getPiece(6, 4).type, "pawn", "White e-pawn at (6,4)");
  assert.strictEqual(engine.getPiece(1, 4).type, "pawn", "Black e-pawn at (1,4)");
  assert.strictEqual(engine.getPiece(7, 4).type, "king", "White king at (7,4)");
  assert.strictEqual(engine.getPiece(0, 4).type, "king", "Black king at (0,4)");
  console.log("? Initial board setup verified");
}

// Test 2: Standard Pawn Moves & Turn Switch
{
  const engine = new ChessEngine();
  const e4 = engine.makeMove(6, 4, 4, 4); // e2 -> e4
  assert(e4, "e2-e4 should be legal");
  assert.strictEqual(engine.currentTurn, "black", "Turn should advance to black");
  assert.strictEqual(engine.getPiece(4, 4).type, "pawn");
  assert.strictEqual(engine.getPiece(6, 4), null);

  const e5 = engine.makeMove(1, 4, 3, 4); // e7 -> e5
  assert(e5, "e7-e5 should be legal");
  assert.strictEqual(engine.currentTurn, "white", "Turn should advance to white");
  console.log("? Standard pawn moves and turn progression verified");
}

// Test 3: Knight Moves (Jumping)
{
  const engine = new ChessEngine();
  const nf3 = engine.makeMove(7, 6, 5, 5); // g1 -> f3
  assert(nf3, "Ng1-f3 should be legal");
  assert.strictEqual(engine.getPiece(5, 5).type, "knight");
  console.log("? Knight jump move verified");
}

// Test 4: Kingside Castling (White)
{
  const engine = new ChessEngine();
  engine.makeMove(6, 4, 4, 4); // 1. e4
  engine.makeMove(1, 4, 3, 4); // 1... e5
  engine.makeMove(7, 6, 5, 5); // 2. Nf3
  engine.makeMove(1, 1, 2, 1); // 2... b6
  engine.makeMove(7, 5, 4, 2); // 3. Bc4
  engine.makeMove(1, 0, 2, 0); // 3... a6
  const castle = engine.makeMove(7, 4, 7, 6); // 4. O-O (King to g1)
  assert(castle, "Kingside castling should be legal");
  assert.strictEqual(engine.getPiece(7, 6).type, "king", "King at g1");
  assert.strictEqual(engine.getPiece(7, 5).type, "rook", "Rook at f1");
  console.log("? Kingside castling verified");
}

// Test 5: En Passant
{
  const engine = new ChessEngine();
  engine.makeMove(6, 4, 4, 4); // 1. e4
  engine.makeMove(1, 0, 2, 0); // 1... a6
  engine.makeMove(4, 4, 3, 4); // 2. e5
  engine.makeMove(1, 3, 3, 3); // 2... d5 (double step next to e5)
  assert(engine.enPassantTarget, "En passant target must be set");
  const ep = engine.makeMove(3, 4, 2, 3); // 3. exd6 (capture en passant)
  assert(ep, "En passant capture should succeed");
  assert.strictEqual(engine.getPiece(3, 3), null, "Black d5 pawn should be captured");
  assert.strictEqual(engine.getPiece(2, 3).type, "pawn", "White pawn at d6");
  console.log("? En passant capture verified");
}

// Test 6: Checkmate (Scholar's Mate)
{
  const engine = new ChessEngine();
  engine.makeMove(6, 4, 4, 4); // 1. e4
  engine.makeMove(1, 4, 3, 4); // 1... e5
  engine.makeMove(7, 5, 4, 2); // 2. Bc4
  engine.makeMove(0, 1, 2, 2); // 2... Nc6
  engine.makeMove(7, 3, 3, 7); // 3. Qh5
  engine.makeMove(0, 6, 2, 5); // 3... Nf6??
  const mate = engine.makeMove(3, 7, 1, 5); // 4. Qxf7#
  assert(mate, "Qxf7# should be legal");
  assert(engine.gameOver, "Game should be over");
  assert(engine.gameResult, "Game result should exist");
  assert.strictEqual(engine.gameResult.winner, "white", "White should win by checkmate");
  assert.strictEqual(engine.gameResult.reason, "checkmate", "Reason should be checkmate");
  console.log("? Checkmate (Scholar's Mate) verified");
}

// Test 7: Abilities - Freeze
{
  const engine = new ChessEngine();
  const freezeRes = engine.validateAbility("freeze", { row: 1, col: 4 }, "white");
  assert.strictEqual(freezeRes, true, "Freeze should validate on opponent piece");
  assert.strictEqual(engine.isPieceFrozen(1, 4), true, "Piece at (1,4) should be frozen");
  
  // Verify frozen piece has 0 legal moves
  const legalMoves = engine.getLegalMoves(1, 4);
  assert.strictEqual(legalMoves.length, 0, "Frozen piece must have 0 legal moves");
  console.log("? Freeze ability mechanics verified (0 legal moves)");
}

// Test 8: Abilities - Swap
{
  const engine = new ChessEngine();
  const swapRes = engine.validateAbility("swap", { row1: 7, col: 0, row2: 7, col: 7 }, "white");
  assert.strictEqual(swapRes, true, "Swap should validate for two friendly non-king pieces");
  assert.strictEqual(engine.getPiece(7, 0).type, "rook");
  assert.strictEqual(engine.getPiece(7, 7).type, "rook");
  console.log("? Swap ability mechanics verified");
}

// Test 9: Abilities - Second Chance (Undo)
{
  const engine = new ChessEngine();
  engine.makeMove(6, 4, 4, 4); // e4
  assert.strictEqual(engine.board[4][4].type, "pawn");
  const undoRes = engine.validateAbility("second", null, "white");
  assert.strictEqual(undoRes, true, "Second chance undo should succeed");
  assert.strictEqual(engine.board[4][4], null, "e4 should be vacated after undo");
  assert.strictEqual(engine.board[6][4].type, "pawn", "Pawn returned to e2");
  console.log("? Second chance (Undo) ability verified");
}

console.log("--- ALL 9 CHARACTERIZATION TESTS PASSED SUCCESSFULLY! ---");
