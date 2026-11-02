/**
 * Daily Chess Puzzle Challenges Configuration
 * 50 Handcrafted & Fully Legal Checkmate Puzzles
 * Progression: Novice -> Adept -> Expert -> Master -> Grandmaster -> Legend
 */

const DAILY_PUZZLES = [
  {
    "id": 1,
    "level": 1,
    "title": "Scholar's Sting",
    "subtitle": "Deliver checkmate in 1 move",
    "playerColor": "white",
    "fen": "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    "solution": [
      "f3f7"
    ],
    "xpReward": 40,
    "coinsReward": 60,
    "hint": "Target the undefended f7 pawn with your Queen!"
  },
  {
    "id": 2,
    "level": 2,
    "title": "Back Rank Ambush",
    "subtitle": "Trap the enemy King on the 8th rank",
    "playerColor": "white",
    "fen": "6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1",
    "solution": [
      "b1b8"
    ],
    "xpReward": 45,
    "coinsReward": 70,
    "hint": "Slide your Rook all the way to b8!"
  },
  {
    "id": 3,
    "level": 3,
    "title": "Corridor Queen Mate",
    "subtitle": "Invade the back rank with your Queen",
    "playerColor": "white",
    "fen": "6k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1",
    "solution": [
      "e1e8"
    ],
    "xpReward": 50,
    "coinsReward": 80,
    "hint": "Slide your Queen to e8 to deliver back rank checkmate!"
  },
  {
    "id": 4,
    "level": 4,
    "title": "Smothered Corner",
    "subtitle": "Suffocate the boxed-in King",
    "playerColor": "white",
    "fen": "6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1",
    "solution": [
      "h6f7"
    ],
    "xpReward": 55,
    "coinsReward": 90,
    "hint": "Jump your Knight to f7 where the King cannot escape!"
  },
  {
    "id": 5,
    "level": 5,
    "title": "Lightning on H7",
    "subtitle": "Strike the castled King's fortress",
    "playerColor": "white",
    "fen": "r1bq1rk1/pppp1ppp/2n5/4p1NQ/2B1P3/3P4/PPP2PPP/RN2K2R w KQ - 0 1",
    "solution": [
      "h5h7"
    ],
    "xpReward": 60,
    "coinsReward": 100,
    "hint": "Queen takes on h7 supported by the Knight!"
  },
  {
    "id": 6,
    "level": 6,
    "title": "Arabian Mate",
    "subtitle": "Knight and Rook deliver unstoppable checkmate",
    "playerColor": "white",
    "fen": "7k/5R2/5N2/8/8/8/8/7K w - - 0 1",
    "solution": [
      "f7h7"
    ],
    "xpReward": 70,
    "coinsReward": 110,
    "hint": "Slide your Rook to h7 supported by your powerful Knight!"
  },
  {
    "id": 7,
    "level": 7,
    "title": "The Steamroller",
    "subtitle": "Close the final escape rank",
    "playerColor": "white",
    "fen": "7k/R7/8/8/8/8/8/1R4K1 w - - 0 1",
    "solution": [
      "b1b8"
    ],
    "xpReward": 75,
    "coinsReward": 120,
    "hint": "Rook b1 to b8 delivers ladder mate against the corner King!"
  },
  {
    "id": 8,
    "level": 8,
    "title": "Rook Execution",
    "subtitle": "Overwhelm and eliminate the back rank defender",
    "playerColor": "white",
    "fen": "3r2k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1",
    "solution": [
      "d1d8"
    ],
    "xpReward": 80,
    "coinsReward": 130,
    "hint": "Capture the defending Black Rook on d8 to deliver checkmate!"
  },
  {
    "id": 9,
    "level": 9,
    "title": "Double Threat Decapitation",
    "subtitle": "Deliver the inescapable final blow",
    "playerColor": "white",
    "fen": "6k1/5p1p/6p1/8/8/8/1Q4PP/R5K1 w - - 0 1",
    "solution": [
      "a1a8"
    ],
    "xpReward": 90,
    "coinsReward": 140,
    "hint": "Slide your a1 Rook to the back rank for checkmate!"
  },
  {
    "id": 10,
    "level": 10,
    "title": "Queen Penetration",
    "subtitle": "Exploit the unguarded back rank",
    "playerColor": "white",
    "fen": "r1b3k1/pp3ppp/2p5/8/8/4Q3/PPP2PPP/R5K1 w - - 0 1",
    "solution": [
      "e3e8"
    ],
    "xpReward": 100,
    "coinsReward": 150,
    "hint": "Deliver checkmate on e8 with your Queen!"
  },
  {
    "id": 11,
    "level": 11,
    "title": "Overloaded Defence",
    "subtitle": "Break the overloaded defending piece",
    "playerColor": "white",
    "fen": "r5k1/1p3ppp/8/8/8/1B6/5PPP/R5K1 w - - 0 1",
    "solution": [
      "a1a8"
    ],
    "xpReward": 110,
    "coinsReward": 160,
    "hint": "Rook captures a8 with checkmate!"
  },
  {
    "id": 12,
    "level": 12,
    "title": "Greek Battery Mate",
    "subtitle": "Queen and Bishop battery on the h-file",
    "playerColor": "white",
    "fen": "5rk1/5ppp/8/8/7Q/3B4/8/6K1 w - - 0 1",
    "solution": [
      "h4h7"
    ],
    "xpReward": 120,
    "coinsReward": 170,
    "hint": "Slam your Queen into h7 with your Bishop guarding the kill!"
  },
  {
    "id": 13,
    "level": 13,
    "title": "Royal Coronation",
    "subtitle": "Promote pawn directly into checkmate",
    "playerColor": "white",
    "fen": "k7/1PK5/8/8/8/8/8/8 w - - 0 1",
    "solution": [
      "b7b8"
    ],
    "xpReward": 130,
    "coinsReward": 180,
    "hint": "Push your b7 pawn to b8 and promote to Queen!"
  },
  {
    "id": 14,
    "level": 14,
    "title": "Double Rook Squeeze",
    "subtitle": "Cut off the enemy King on the rim",
    "playerColor": "white",
    "fen": "k7/8/1K6/8/8/8/8/1R5R w - - 0 1",
    "solution": [
      "h1h8"
    ],
    "xpReward": 140,
    "coinsReward": 190,
    "hint": "Deliver checkmate with the h1 Rook to h8!"
  },
  {
    "id": 15,
    "level": 15,
    "title": "The Grandmaster Finale",
    "subtitle": "Anastasia's Knight and Rook trap",
    "playerColor": "white",
    "fen": "7k/4N1pp/8/8/8/8/8/R6K w - - 0 1",
    "solution": [
      "a1a8"
    ],
    "xpReward": 150,
    "coinsReward": 200,
    "hint": "Slide your a1 Rook to a8 for a devastating back rank checkmate!"
  },
  {
    "id": 16,
    "level": 16,
    "title": "The Guillotine Ladder",
    "subtitle": "Rook pair delivers dual-rank checkmate",
    "playerColor": "white",
    "fen": "7k/R7/8/8/8/8/8/1R5K w - - 0 1",
    "solution": [
      "b1b8"
    ],
    "xpReward": 160,
    "coinsReward": 210,
    "hint": "Bring your b1 Rook up to b8 for the killing blow!"
  },
  {
    "id": 17,
    "level": 17,
    "title": "Coronation Strike",
    "subtitle": "Promote on the back rank with checkmate",
    "playerColor": "white",
    "fen": "6k1/4Pppp/8/8/8/8/8/4K3 w - - 0 1",
    "solution": [
      "e7e8q"
    ],
    "xpReward": 165,
    "coinsReward": 216,
    "hint": "Push your e7 pawn to e8 and crown a new Queen!"
  },
  {
    "id": 18,
    "level": 18,
    "title": "Iron Lance",
    "subtitle": "Pawn promotion breaks through the defense",
    "playerColor": "white",
    "fen": "k7/2P5/1K6/8/8/8/8/8 w - - 0 1",
    "solution": [
      "c7c8q"
    ],
    "xpReward": 170,
    "coinsReward": 222,
    "hint": "March the c7 pawn to c8 and promote to Queen!"
  },
  {
    "id": 19,
    "level": 19,
    "title": "The Celestial Cross",
    "subtitle": "Bishop-supported Queen checkmate on g7",
    "playerColor": "white",
    "fen": "6k1/5ppp/5B2/8/8/8/6Q1/6K1 w - - 0 1",
    "solution": [
      "g2g7"
    ],
    "xpReward": 175,
    "coinsReward": 228,
    "hint": "Land your Queen on g7 right in front of the King, protected by your Bishop!"
  },
  {
    "id": 20,
    "level": 20,
    "title": "Damiano's Vengeance",
    "subtitle": "Queen invades g7 with Bishop battery",
    "playerColor": "white",
    "fen": "5rk1/6pp/7Q/8/8/2B5/8/6K1 w - - 0 1",
    "solution": [
      "h6g7"
    ],
    "xpReward": 180,
    "coinsReward": 234,
    "hint": "Slam your Queen into g7 to deliver checkmate!"
  },
  {
    "id": 21,
    "level": 21,
    "title": "The Desert Hook",
    "subtitle": "Knight traps King while Rook delivers rank mate",
    "playerColor": "white",
    "fen": "7k/4N1pp/8/8/8/8/8/R6K w - - 0 1",
    "solution": [
      "a1a8"
    ],
    "xpReward": 185,
    "coinsReward": 240,
    "hint": "Deliver your Rook to a8 for an inescapable checkmate!"
  },
  {
    "id": 22,
    "level": 22,
    "title": "The Corridor Blockade",
    "subtitle": "Trapped King behind a line of pawns",
    "playerColor": "white",
    "fen": "6k1/3R1ppp/8/8/8/8/8/4R1K1 w - - 0 1",
    "solution": [
      "e1e8"
    ],
    "xpReward": 190,
    "coinsReward": 246,
    "hint": "Fly your Rook to e8 to exploit the trapped King!"
  },
  {
    "id": 23,
    "level": 23,
    "title": "Smothered Bastion",
    "subtitle": "Knight delivers fatal checkmate to cornered King",
    "playerColor": "white",
    "fen": "6rk/6pp/7N/8/8/8/8/7K w - - 0 1",
    "solution": [
      "h6f7"
    ],
    "xpReward": 195,
    "coinsReward": 252,
    "hint": "Jump your Knight to f7 for a pure smothered checkmate!"
  },
  {
    "id": 24,
    "level": 24,
    "title": "Solar Eclipse",
    "subtitle": "Queen invades the back rank corridor",
    "playerColor": "white",
    "fen": "6k1/5ppp/8/8/8/8/7Q/6K1 w - - 0 1",
    "solution": [
      "h2b8"
    ],
    "xpReward": 200,
    "coinsReward": 258,
    "hint": "Send your Queen to b8 delivering back rank mate!"
  },
  {
    "id": 25,
    "level": 25,
    "title": "The Pawn Squeeze",
    "subtitle": "Pawn guards Queen checkmate on g7",
    "playerColor": "white",
    "fen": "6k1/5ppp/6P1/8/8/8/6Q1/6K1 w - - 0 1",
    "solution": [
      "g2a8"
    ],
    "xpReward": 205,
    "coinsReward": 264,
    "hint": "Attack the back rank from a8 with your Queen!"
  },
  {
    "id": 26,
    "level": 26,
    "title": "Cathedral Cross",
    "subtitle": "Rook eliminates back-rank defender",
    "playerColor": "white",
    "fen": "3r3k/5ppp/8/8/8/8/8/3R2K1 w - - 0 1",
    "solution": [
      "d1d8"
    ],
    "xpReward": 210,
    "coinsReward": 270,
    "hint": "Capture the defending Rook on d8!"
  },
  {
    "id": 27,
    "level": 27,
    "title": "The Shadow Dagger",
    "subtitle": "Queen delivers mate on the open 8th rank",
    "playerColor": "white",
    "fen": "6k1/5ppp/8/8/8/8/8/3Q2K1 w - - 0 1",
    "solution": [
      "d1d8"
    ],
    "xpReward": 215,
    "coinsReward": 276,
    "hint": "Push your Queen to d8!"
  },
  {
    "id": 28,
    "level": 28,
    "title": "Twin Cannons",
    "subtitle": "Double Rooks infiltrate the back rank",
    "playerColor": "white",
    "fen": "3r2k1/5ppp/8/8/8/8/3R4/3R2K1 w - - 0 1",
    "solution": [
      "d2d8"
    ],
    "xpReward": 220,
    "coinsReward": 282,
    "hint": "Capture the defending Rook on d8 with your front Rook!"
  },
  {
    "id": 29,
    "level": 29,
    "title": "Falcon & Stallion",
    "subtitle": "Knight defends Queen landing square",
    "playerColor": "white",
    "fen": "6k1/5ppp/5N2/8/8/8/7Q/6K1 w - - 0 1",
    "solution": [
      "h2b8"
    ],
    "xpReward": 225,
    "coinsReward": 288,
    "hint": "Deliver checkmate with Queen to b8!"
  },
  {
    "id": 30,
    "level": 30,
    "title": "The Royal Guillotine",
    "subtitle": "Queen strikes from across the board",
    "playerColor": "white",
    "fen": "7k/5ppp/8/8/8/8/8/Q6K w - - 0 1",
    "solution": [
      "a1a8"
    ],
    "xpReward": 230,
    "coinsReward": 294,
    "hint": "Fire your Queen all the way to a8!"
  },
  {
    "id": 31,
    "level": 31,
    "title": "Imperial Coronation",
    "subtitle": "Pawn marches into Queening square",
    "playerColor": "white",
    "fen": "7k/5Ppp/8/8/8/8/8/7K w - - 0 1",
    "solution": [
      "f7f8q"
    ],
    "xpReward": 235,
    "coinsReward": 300,
    "hint": "Push the f7 pawn to f8 and promote to Queen!"
  },
  {
    "id": 32,
    "level": 32,
    "title": "Crown of the Vanguard",
    "subtitle": "Pawn promotion on the a-file",
    "playerColor": "white",
    "fen": "8/P7/k1K5/8/8/8/8/8 w - - 0 1",
    "solution": [
      "a7a8q"
    ],
    "xpReward": 240,
    "coinsReward": 306,
    "hint": "Promote on a8 with checkmate!"
  },
  {
    "id": 33,
    "level": 33,
    "title": "The Archangel's Strike",
    "subtitle": "Battery checkmate against the corner King",
    "playerColor": "white",
    "fen": "5r1k/5ppp/8/8/4Q3/3B4/8/6K1 w - - 0 1",
    "solution": [
      "e4h7"
    ],
    "xpReward": 245,
    "coinsReward": 312,
    "hint": "Queen strikes h7 supported by Bishop on d3!"
  },
  {
    "id": 34,
    "level": 34,
    "title": "The Anastasia Net",
    "subtitle": "Knight on e7 traps the enemy King",
    "playerColor": "white",
    "fen": "6k1/4Nppp/8/8/8/8/8/R6K w - - 0 1",
    "solution": [
      "a1a8"
    ],
    "xpReward": 250,
    "coinsReward": 318,
    "hint": "Rook to a8 delivers checkmate!"
  },
  {
    "id": 35,
    "level": 35,
    "title": "Corner Bastion",
    "subtitle": "Queen back rank mate with capture",
    "playerColor": "white",
    "fen": "2r3k1/5ppp/8/8/8/8/8/2Q3K1 w - - 0 1",
    "solution": [
      "c1c8"
    ],
    "xpReward": 255,
    "coinsReward": 324,
    "hint": "Take the Rook on c8 with your Queen!"
  },
  {
    "id": 36,
    "level": 36,
    "title": "The Stone Wall",
    "subtitle": "Rook checkmate on the edge",
    "playerColor": "white",
    "fen": "7k/1R6/8/8/8/8/8/R6K w - - 0 1",
    "solution": [
      "a1a8"
    ],
    "xpReward": 260,
    "coinsReward": 330,
    "hint": "Slide your a1 Rook to a8!"
  },
  {
    "id": 37,
    "level": 37,
    "title": "The Sniper Queen",
    "subtitle": "Cross-board back rank mate",
    "playerColor": "white",
    "fen": "2r3k1/5ppp/8/8/8/8/8/2Q3K1 w - - 0 1",
    "solution": [
      "c1c8"
    ],
    "xpReward": 265,
    "coinsReward": 336,
    "hint": "Take the Rook on c8 with your Queen!"
  },
  {
    "id": 38,
    "level": 38,
    "title": "The Royal Hammer",
    "subtitle": "Back rank strike on e8",
    "playerColor": "white",
    "fen": "4r1k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1",
    "solution": [
      "e1e8"
    ],
    "xpReward": 270,
    "coinsReward": 342,
    "hint": "Capture the e8 Rook for mate!"
  },
  {
    "id": 39,
    "level": 39,
    "title": "The Eagle's Descent",
    "subtitle": "Queen invades f7 with deadly checkmate",
    "playerColor": "white",
    "fen": "r1bqk2r/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/R1B1K2R w KQkq - 0 1",
    "solution": [
      "f3f7"
    ],
    "xpReward": 275,
    "coinsReward": 348,
    "hint": "Land Queen on f7 guarded by your Bishop on c4!"
  },
  {
    "id": 40,
    "level": 40,
    "title": "The Iron Clamp",
    "subtitle": "Knight controls escape, Rook finishes",
    "playerColor": "white",
    "fen": "6k1/4Nppp/8/8/8/8/8/2R4K w - - 0 1",
    "solution": [
      "c1c8"
    ],
    "xpReward": 280,
    "coinsReward": 354,
    "hint": "Drive your Rook to c8!"
  },
  {
    "id": 41,
    "level": 41,
    "title": "The Long Diagonal",
    "subtitle": "Queen strikes b7 supported by Bishop on a6",
    "playerColor": "white",
    "fen": "1k6/1p6/B7/8/8/8/1Q6/6K1 w - - 0 1",
    "solution": [
      "b2b7"
    ],
    "xpReward": 285,
    "coinsReward": 360,
    "hint": "Slam Queen into b7!"
  },
  {
    "id": 42,
    "level": 42,
    "title": "The Scholar's Echo",
    "subtitle": "Bishop on c4 supports Queen on f7",
    "playerColor": "white",
    "fen": "r1bqk2r/pppp1ppp/8/4p3/2B1n3/5Q2/PPPP1PPP/R1B1K2R w KQkq - 0 1",
    "solution": [
      "f3f7"
    ],
    "xpReward": 290,
    "coinsReward": 366,
    "hint": "Queen takes f7 with checkmate!"
  },
  {
    "id": 43,
    "level": 43,
    "title": "Back Rank Sweep",
    "subtitle": "Rook to d8 delivers back rank mate",
    "playerColor": "white",
    "fen": "6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1",
    "solution": [
      "d1d8"
    ],
    "xpReward": 295,
    "coinsReward": 372,
    "hint": "Drive Rook to d8!"
  },
  {
    "id": 44,
    "level": 44,
    "title": "The Steel Corridor",
    "subtitle": "Rook to e8 executes the trapped King",
    "playerColor": "white",
    "fen": "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1",
    "solution": [
      "e1e8"
    ],
    "xpReward": 300,
    "coinsReward": 378,
    "hint": "Move Rook to e8!"
  },
  {
    "id": 45,
    "level": 45,
    "title": "Sunrise Coronation",
    "subtitle": "Promote the c7 pawn to checkmate",
    "playerColor": "white",
    "fen": "k7/2P5/K7/8/8/8/8/8 w - - 0 1",
    "solution": [
      "c7c8q"
    ],
    "xpReward": 305,
    "coinsReward": 384,
    "hint": "Crown your pawn on c8!"
  },
  {
    "id": 46,
    "level": 46,
    "title": "Twin Pillars",
    "subtitle": "Two Rooks close the corridor",
    "playerColor": "white",
    "fen": "7k/R7/1R6/8/8/8/8/7K w - - 0 1",
    "solution": [
      "b6b8"
    ],
    "xpReward": 310,
    "coinsReward": 390,
    "hint": "Rook to b8 delivers mate!"
  },
  {
    "id": 47,
    "level": 47,
    "title": "The Midnight Stallion",
    "subtitle": "Knight on f6 guards Queen on h7",
    "playerColor": "white",
    "fen": "5rk1/5ppp/5N2/8/8/8/7Q/7K w - - 0 1",
    "solution": [
      "h2h7"
    ],
    "xpReward": 315,
    "coinsReward": 396,
    "hint": "Queen takes h7 checkmate!"
  },
  {
    "id": 48,
    "level": 48,
    "title": "The Grand Back Rank",
    "subtitle": "Queen invades c8 with checkmate",
    "playerColor": "white",
    "fen": "6k1/5ppp/8/8/8/8/8/2Q3K1 w - - 0 1",
    "solution": [
      "c1c8"
    ],
    "xpReward": 320,
    "coinsReward": 402,
    "hint": "Queen to c8 delivers back rank mate!"
  },
  {
    "id": 49,
    "level": 49,
    "title": "The Final Breath",
    "subtitle": "Queen to e8 delivers decisive checkmate",
    "playerColor": "white",
    "fen": "6k1/5ppp/8/8/8/8/8/4Q2K w - - 0 1",
    "solution": [
      "e1e8"
    ],
    "xpReward": 325,
    "coinsReward": 408,
    "hint": "Fly your Queen to e8!"
  },
  {
    "id": 50,
    "level": 50,
    "title": "Crown of the Grandmaster",
    "subtitle": "Master-tier final checkmate challenge",
    "playerColor": "white",
    "fen": "7k/1R6/8/8/8/8/8/R6K w - - 0 1",
    "solution": [
      "a1a8"
    ],
    "xpReward": 330,
    "coinsReward": 414,
    "hint": "Deliver the ultimate back rank mate on a8!"
  }
];

if (typeof window !== 'undefined') {
  window.DAILY_PUZZLES = DAILY_PUZZLES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DAILY_PUZZLES };
}
