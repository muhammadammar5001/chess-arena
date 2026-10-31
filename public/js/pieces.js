/**
 * Chess Arena — Vector Chess Pieces (New Shape with Classic Handcrafted Colors)
 * Flat/solid handcrafted Boxwood & Ebony wood colors (zero gradients) with the new piece geometry.
 */

(function () {
  'use strict';

  const PIECE_NAMES = {
    P: 'pawn',
    N: 'knight',
    B: 'bishop',
    R: 'rook',
    Q: 'queen',
    K: 'king',
    pawn: 'pawn',
    knight: 'knight',
    bishop: 'bishop',
    rook: 'rook',
    queen: 'queen',
    king: 'king'
  };

  const TYPE_MAP = {
    p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
    P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king',
    pawn: 'pawn', knight: 'knight', bishop: 'bishop', rook: 'rook', queen: 'queen', king: 'king'
  };

  const LETTER_MAP = {
    pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K'
  };

  // Classic handcrafted solid wood palette (same colors as before, no gradients)
  const COLORS = {
    white: {
      body: '#F7EAD0',    // Classic boxwood / ivory wood
      stroke: '#8C6738',  // Handcrafted warm wood outline
      band: '#DEC29B',    // Accent wood inlay band
      eye: '#5A381E',     // Carved dark pupil
      shadow: 'rgba(0,0,0,0.22)'
    },
    black: {
      body: '#2B1D16',    // Classic dark ebony / walnut wood
      stroke: '#0D0704',  // Deep charred outline
      band: '#4A3428',    // Subtle darker ring inlay
      eye: '#EBD2A5',     // Luminous light pupil
      rim: 'rgba(255, 236, 200, 0.45)', // Clean silhouette contrast on dark squares
      shadow: 'rgba(0,0,0,0.32)'
    }
  };

  const PIECE_SHAPES = {
    pawn: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M33 77C36 66 41 59 44 52H56C59 59 64 66 67 77Z"/><rect x="35" y="50" width="30" height="7" rx="3.5"/><circle cx="50" cy="37" r="12"/>',
      bands: (bandColor, strokeColor) => `<rect x="33" y="74" width="34" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/>`,
      details: () => ''
    },
    rook: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M33 77L36 47H64L67 77Z"/><rect x="27" y="39" width="46" height="9" rx="2.5"/><path d="M30 40V20H40V26H45V20H55V26H60V20H70V40Z"/>',
      bands: (bandColor, strokeColor) => `<rect x="33" y="72" width="34" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/>`,
      details: (strokeColor) => `<path d="M36 33H64" fill="none" stroke="${strokeColor}" stroke-width="1.4" stroke-opacity=".35" stroke-linecap="round"/>`
    },
    knight: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M68 77C71 58 66 40 57 30L58 17L50 22C47 22 45 24 43 26L27 42C24 45 25 50 30 51L37 52C41 52 44 50 47 47C41 56 36 64 33 77Z"/>',
      bands: (bandColor, strokeColor) => `<rect x="32" y="71" width="37" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/>`,
      details: (strokeColor, eyeColor) => `<circle cx="46" cy="34" r="2.4" fill="${eyeColor}" stroke="none"/><circle cx="30" cy="45" r="1.3" fill="${eyeColor}" stroke="none"/><path d="M59 32C66 41 67 53 65 68" fill="none" stroke="${strokeColor}" stroke-width="1.4" stroke-opacity=".45" stroke-linecap="round"/><path d="M54 35C60 43 61 53 59 66" fill="none" stroke="${strokeColor}" stroke-width="1.4" stroke-opacity=".3" stroke-linecap="round"/><path d="M38 51C41 49 43 47 44 44" fill="none" stroke="${strokeColor}" stroke-width="1.4" stroke-opacity=".35" stroke-linecap="round"/>`
    },
    bishop: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M36 77C38 68 42 62 44 59H56C58 62 62 68 64 77Z"/><rect x="37" y="53" width="26" height="8" rx="4"/><path d="M50 14C61 23 67 34 63 44C61 49 57 51 57 54H43C43 51 39 49 37 44C33 34 39 23 50 14Z"/><circle cx="50" cy="12" r="5"/>',
      bands: (bandColor, strokeColor) => `<rect x="35" y="72" width="30" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/>`,
      details: (strokeColor) => `<path d="M46 29L56 39" fill="none" stroke="${strokeColor}" stroke-width="2.6" stroke-linecap="round"/>`
    },
    queen: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M34 77C36 68 40 62 42 58H58C60 62 64 68 66 77Z"/><rect x="35" y="52" width="30" height="8" rx="4"/><path d="M36 53L26 29L34 42L38 21L43 40L50 17L57 40L62 21L66 42L74 29L64 53Z"/><circle cx="26" cy="27" r="4.4"/><circle cx="38" cy="18" r="4.4"/><circle cx="50" cy="14" r="4.6"/><circle cx="62" cy="18" r="4.4"/><circle cx="74" cy="27" r="4.4"/>',
      bands: (bandColor, strokeColor) => `<rect x="34" y="72" width="32" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/>`,
      details: () => ''
    },
    king: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M34 77C36 68 40 62 42 58H58C60 62 64 68 66 77Z"/><rect x="35" y="52" width="30" height="8" rx="4"/><path d="M36 53C31 40 38 30 50 30C62 30 69 40 64 53Z"/><rect x="45.5" y="5" width="9" height="28" rx="3"/><rect x="38" y="12" width="24" height="9" rx="3"/>',
      bands: (bandColor, strokeColor) => `<rect x="34" y="72" width="32" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="${bandColor}" stroke="${strokeColor}" stroke-width=".8"/>`,
      details: () => ''
    }
  };

  const PieceSVGs = {
    PIECE_NAMES,
    COLORS,

    getPiece(color, type) {
      const isWhite = color === 'white' || color === 'w';
      const colorName = isWhite ? 'white' : 'black';
      const pieceType = TYPE_MAP[type] || 'pawn';
      const colCode = isWhite ? 'w' : 'b';

      const pal = isWhite ? COLORS.white : COLORS.black;
      const piece = PIECE_SHAPES[pieceType] || PIECE_SHAPES.pawn;

      const rim = !isWhite && pal.rim
        ? `<g fill="none" stroke="${pal.rim}" stroke-width="4.2" stroke-linejoin="round">${piece.geom}</g>`
        : '';

      return `
        <svg class="chess-piece new-style-piece ${colorName}-${pieceType}" data-color="${colCode}" viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="52" cy="91" rx="34" ry="4.5" fill="${pal.shadow}" />
          ${rim}
          <g fill="${pal.body}" stroke="${pal.stroke}" stroke-width="1.8" stroke-linejoin="round">
            ${piece.geom}
          </g>
          ${piece.details(pal.stroke, pal.eye)}
          ${piece.bands(pal.band, pal.stroke)}
        </svg>
      `;
    },

    pieceMarkup(pieceCode) {
      if (!pieceCode) return '';
      const color = pieceCode[0] === 'w' ? 'white' : 'black';
      const type = pieceCode[1];
      return this.getPiece(color, type);
    },

    getPieceUrl(color, type) {
      const isWhite = color === 'white' || color === 'w';
      const colCode = isWhite ? 'w' : 'b';
      const pieceType = TYPE_MAP[type] || 'pawn';
      const letter = LETTER_MAP[pieceType] || 'P';
      return `assets/pieces/${colCode}${letter}.svg`;
    }
  };

  if (typeof window !== 'undefined') {
    window.PieceSVGs = PieceSVGs;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PieceSVGs;
  }
})();
