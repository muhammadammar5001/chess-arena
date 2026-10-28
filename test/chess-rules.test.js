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
  console.log("✔ Initial board setup verified");
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
  console.log("✔ Standard pawn moves and turn progression verified");
}

// Test 3: Knight Moves (Jumping)
{
  const engine = new ChessEngine();
  const nf3 = engine.makeMove(7, 6, 5, 5); // g1 -> f3
  assert(nf3, "Ng1-f3 should be legal");
  assert.strictEqual(engine.getPiece(5, 5).type, "knight");
  console.log("✔ Knight jump move verified");
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
  console.log("✔ Kingside castling verified");
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
  console.log("✔ En passant capture verified");
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
  console.log("✔ Checkmate (Scholar's Mate) verified");
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
  console.log("✔ Freeze ability mechanics verified (0 legal moves)");
}

// Test 8: Abilities - Swap
{
  const engine = new ChessEngine();
  const swapRes = engine.validateAbility("swap", { row1: 7, col: 0, row2: 7, col: 7 }, "white");
  assert.strictEqual(swapRes, true, "Swap should validate for two friendly non-king pieces");
  assert.strictEqual(engine.getPiece(7, 0).type, "rook");
  assert.strictEqual(engine.getPiece(7, 7).type, "rook");
  console.log("✔ Swap ability mechanics verified");
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
  console.log("✔ Second chance (Undo) ability verified");
}

// Test 10: Abilities - Divine Shield
{
  const engine = new ChessEngine();
  // Shield white pawn at (6, 4)
  const shieldRes = engine.validateAbility("shield", { row: 6, col: 4 }, "white");
  assert.strictEqual(shieldRes, true, "Divine Shield should validate on friendly piece");
  assert.strictEqual(engine.isPieceShielded(6, 4), true, "Pawn at (6,4) should be shielded");

  // Enemy piece cannot capture shielded piece
  engine.board[5][3] = { type: "pawn", color: "black" };
  const blackMoves = engine.getPseudoLegalMoves(5, 3);
  const captureAttempt = blackMoves.find(m => m.row === 6 && m.col === 4);
  assert.strictEqual(captureAttempt, undefined, "Enemy piece must NOT be allowed to capture shielded piece");

  // Cannot shield enemy piece
  const enemyShieldRes = engine.validateAbility("shield", { row: 1, col: 0 }, "white");
  assert.strictEqual(enemyShieldRes, false, "Cannot shield opponent piece");

  // Cannot use shield a 2nd time (1-time use per match)
  const secondShieldRes = engine.validateAbility("shield", { row: 6, col: 0 }, "white");
  assert.strictEqual(secondShieldRes, false, "Cannot use Divine Shield twice in same match");

  console.log("✔ Divine Shield ability & capture immunity verified");
}

// Test 11: Abilities - Pegasus Jump (Pawn straight & Bishop diagonal jumps)
{
  const engine = new ChessEngine();
  // A. Straight pawn jump
  engine.board[5][4] = { type: "pawn", color: "black" };
  const jumpRes = engine.validateAbility("jump", { fromRow: 6, fromCol: 4, toRow: 4, toCol: 4 }, "white");
  assert.strictEqual(jumpRes, true, "Pegasus Jump should vault over front hurdle to empty square");
  assert.strictEqual(engine.board[4][4].type, "pawn", "Pawn successfully landed at (4,4)");
  assert.strictEqual(engine.board[6][4], null, "Original square (6,4) vacated");
  assert.strictEqual(engine.board[5][4].type, "pawn", "Hurdle at (5,4) remains in place");
  assert.strictEqual(engine.currentTurn, "black", "Pegasus Jump consumes turn");

  // B. Bishop diagonal jump
  const engine2 = new ChessEngine();
  // White Bishop at c1 (row 7, col 2).
  // Place hurdle pawn at d2 (row 6, col 3) and e3 (row 5, col 4) is empty.
  // Diagonal jump: (7, 2) -> hurdle (6, 3) -> landing (5, 4)
  assert.strictEqual(engine2.board[7][2].type, "bishop", "c1 has white bishop");
  engine2.board[6][3] = { type: "pawn", color: "black" }; // hurdle on d2
  engine2.board[5][4] = null; // landing e3 is empty
  const bishopJumpRes = engine2.validateAbility("jump", { fromRow: 7, fromCol: 2, toRow: 5, toCol: 4 }, "white");
  assert.strictEqual(bishopJumpRes, true, "Bishop must be able to perform forward diagonal Pegasus Jump over hurdle");
  assert.strictEqual(engine2.board[5][4].type, "bishop", "Bishop successfully landed at (5,4)");
  assert.strictEqual(engine2.board[7][2], null, "Original square (7,2) vacated");
  assert.strictEqual(engine2.board[6][3].type, "pawn", "Hurdle at (6,3) intact");

  // C. Bishop diagonal jump without hurdle must fail
  const engine3 = new ChessEngine();
  engine3.board[6][3] = null; // no hurdle
  const bishopNoHurdle = engine3.validateAbility("jump", { fromRow: 7, fromCol: 2, toRow: 5, toCol: 4 }, "white");
  assert.strictEqual(bishopNoHurdle, false, "Bishop jump without diagonal hurdle must fail");

  // D. Bishop straight jump must fail (Bishops must only jump diagonally)
  const engine4 = new ChessEngine();
  engine4.board[6][2] = { type: "pawn", color: "white" }; // hurdle straight ahead at c2
  engine4.board[5][2] = null; // empty landing straight ahead at c3
  const bishopStraightJump = engine4.validateAbility("jump", { fromRow: 7, fromCol: 2, toRow: 5, toCol: 2 }, "white");
  assert.strictEqual(bishopStraightJump, false, "Bishop straight jump must fail (strictly diagonal)");

  console.log("✔ Pegasus Jump (Pawn straight & Bishop diagonal) verified");
}

// Test 12: Divine Shield can target a king outside checkmate without throwing
{
  const engine = new ChessEngine();
  assert.strictEqual(engine.isCheckmate("white"), false, "Starting position is not checkmate");
  const kingShieldRes = engine.validateAbility("shield", { row: 7, col: 4 }, "white");
  assert.strictEqual(kingShieldRes, true, "Divine Shield should validate on the king when not checkmated");
  assert.strictEqual(engine.isPieceShielded(7, 4), true, "King at (7,4) should be shielded");
  console.log("✔ Divine Shield on king / checkmate helper verified");
}

// Test 13: Turn-based Freeze timing survives Second Chance
{
  const engine = new ChessEngine();
  assert.strictEqual(
    engine.validateAbility("freeze", { row: 1, col: 4 }, "white"),
    true,
    "Freeze should apply to the black e-pawn"
  );

  engine.makeMove(6, 4, 4, 4); // White completes a turn.
  assert.strictEqual(engine.isPieceFrozen(1, 4), true, "Frozen piece stays frozen on Black's turn");
  assert.strictEqual(
    engine.validateAbility("swap", { row1: 1, col1: 4, row2: 1, col2: 0 }, "black"),
    false,
    "A frozen piece cannot be moved with Tactical Swap"
  );
  engine.board[2][4] = { type: "pawn", color: "black" };
  assert.strictEqual(
    engine.validateAbility("jump", { fromRow: 1, fromCol: 4, toRow: 3, toCol: 4 }, "black"),
    false,
    "A frozen piece cannot use Pegasus Jump"
  );

  engine.makeMove(1, 0, 2, 0); // Black completes a turn with a different piece.
  assert.strictEqual(engine.isPieceFrozen(1, 4), false, "Freeze expires after the owner completes a turn");

  assert.strictEqual(engine.validateAbility("second", null, "black"), true, "Black can rewind its completed move");
  assert.strictEqual(engine.currentTurn, "black", "Second Chance restores Black's turn");
  assert.strictEqual(engine.isPieceFrozen(1, 4), true, "Undo restores the turn-based Freeze state");
  assert.strictEqual(engine.getLegalMoves(1, 4).length, 0, "Frozen piece is still locked after undo");
  assert.strictEqual(engine.makeMove(1, 4, 3, 4, null, true), null, "Strict redo cannot move the frozen piece");

  const clone = engine.clone();
  assert.strictEqual(clone.completedTurns, engine.completedTurns, "AI clone keeps completedTurns");
  assert.strictEqual(clone.isPieceFrozen(1, 4), true, "AI clone keeps the freeze active");

  engine.makeMove(1, 0, 2, 0); // Redo another move.
  assert.strictEqual(engine.isPieceFrozen(1, 4), false, "Freeze expires only after the redo turn completes");
  console.log("\u2714 Turn-based Freeze + Second Chance interaction verified");
}

// Test 14: Turn-based Shield timing ignores instant abilities and undo
{
  const engine = new ChessEngine();
  assert.strictEqual(engine.validateAbility("shield", { row: 6, col: 4 }, "white"), true);

  // Instant abilities must not consume the shield duration.
  assert.strictEqual(engine.validateAbility("freeze", { row: 1, col: 4 }, "white"), true);
  assert.strictEqual(engine.isPieceShielded(6, 4), true, "Instant ability must not expire the shield");

  engine.makeMove(6, 0, 5, 0); // White completes a turn.
  assert.strictEqual(engine.isPieceShielded(6, 4), true, "Shield stays active on the opponent's turn");

  assert.strictEqual(engine.validateAbility("freeze", { row: 6, col: 3 }, "black"), true);
  assert.strictEqual(engine.isPieceShielded(6, 4), true, "Opponent instant ability must not expire the shield");

  engine.makeMove(1, 0, 2, 0); // Black completes a turn.
  assert.strictEqual(engine.isPieceShielded(6, 4), false, "Shield expires after the opponent completes a turn");

  assert.strictEqual(engine.validateAbility("second", null, "black"), true);
  assert.strictEqual(engine.isPieceShielded(6, 4), true, "Undo restores the Shield state for the redo turn");
  console.log("\u2714 Turn-based Shield + instant ability + Second Chance verified");
}

console.log("--- ALL 14 CHARACTERIZATION TESTS PASSED SUCCESSFULLY! ---");
