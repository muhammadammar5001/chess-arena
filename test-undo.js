const ChessEngine = require('./public/js/chess-engine.js');
const engine = new ChessEngine();
engine.makeMove(6, 4, 4, 4, null);
console.log('After move:', engine.board[4][4]);
engine.validateAbility('second', null, 'white');
console.log('After undo:', engine.board[4][4]);
console.log('After undo 6,4:', engine.board[6][4]);
