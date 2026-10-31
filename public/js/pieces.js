/**
 * Chess Arena — Multi-Theme Vector Chess Pieces (New Artisan Set)
 *
 * Implements high-definition vector chess pieces paired for each board theme:
 *  - classic-oak: Warm Polished Boxwood & Aged Ebony Wood with Brass Rings
 *  - ember: Fiery Warm Amber & Charred Basalt with Magma Rim & Molten Rings
 *  - moonlit: Celestial Silver-Ivory & Midnight Sapphire with Starlight Rim
 *  - sakura: Mother-of-Pearl Blossom & Royal Rosewood with Rose Gold Rings
 *  - walnut-maple: Cream Canadian Maple & Rich Dark Walnut with Antique Brass
 *  - ebony-ivory: Sovereign Carrara Marble & Jet Obsidian with 24K Royal Gold
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

  const THEMES = {
    'classic-oak': {
      name: 'Classic Oak',
      white: {
        bodyStops: [
          { offset: '0%', color: '#8f6c38' },
          { offset: '26%', color: '#EBD8AB' },
          { offset: '40%', color: '#FFF7DE' },
          { offset: '68%', color: '#EBD8AB' },
          { offset: '100%', color: '#9a7740' }
        ],
        bandStops: [
          { offset: '0%', color: '#F6D77A' },
          { offset: '50%', color: '#D9A441' },
          { offset: '100%', color: '#8A5E16' }
        ],
        stroke: '#46300f',
        detailStroke: '#46300f',
        eyeFill: '#2b1a08',
        rimStroke: null
      },
      black: {
        bodyStops: [
          { offset: '0%', color: '#080402' },
          { offset: '26%', color: '#3b261a' },
          { offset: '40%', color: '#775340' },
          { offset: '68%', color: '#3b261a' },
          { offset: '100%', color: '#100804' }
        ],
        bandStops: [
          { offset: '0%', color: '#F6D77A' },
          { offset: '50%', color: '#D9A441' },
          { offset: '100%', color: '#8A5E16' }
        ],
        stroke: '#030100',
        detailStroke: '#030100',
        eyeFill: '#f1d9a8',
        rimStroke: 'rgba(255, 236, 200, 0.55)'
      }
    },

    'ember': {
      name: 'Emberwood',
      white: {
        bodyStops: [
          { offset: '0%', color: '#9E4416' },
          { offset: '26%', color: '#F7A74E' },
          { offset: '40%', color: '#FFF2D9' },
          { offset: '68%', color: '#F7A74E' },
          { offset: '100%', color: '#B34F1A' }
        ],
        bandStops: [
          { offset: '0%', color: '#FFA726' },
          { offset: '50%', color: '#E65100' },
          { offset: '100%', color: '#8C2200' }
        ],
        stroke: '#541C04',
        detailStroke: '#541C04',
        eyeFill: '#3E1200',
        rimStroke: null
      },
      black: {
        bodyStops: [
          { offset: '0%', color: '#0D0606' },
          { offset: '26%', color: '#2E120D' },
          { offset: '40%', color: '#5C241B' },
          { offset: '68%', color: '#2E120D' },
          { offset: '100%', color: '#120706' }
        ],
        bandStops: [
          { offset: '0%', color: '#FF7043' },
          { offset: '50%', color: '#D84315' },
          { offset: '100%', color: '#BF360C' }
        ],
        stroke: '#080202',
        detailStroke: '#080202',
        eyeFill: '#FF8A65',
        rimStroke: 'rgba(255, 120, 50, 0.82)'
      }
    },

    'moonlit': {
      name: 'Moonlit Grove',
      white: {
        bodyStops: [
          { offset: '0%', color: '#5C768D' },
          { offset: '26%', color: '#BDD5E7' },
          { offset: '40%', color: '#F4FAFF' },
          { offset: '68%', color: '#BDD5E7' },
          { offset: '100%', color: '#688299' }
        ],
        bandStops: [
          { offset: '0%', color: '#E0F2FE' },
          { offset: '50%', color: '#90CDF4' },
          { offset: '100%', color: '#3182CE' }
        ],
        stroke: '#1E3A5F',
        detailStroke: '#1E3A5F',
        eyeFill: '#1A365D',
        rimStroke: null
      },
      black: {
        bodyStops: [
          { offset: '0%', color: '#050B14' },
          { offset: '26%', color: '#142238' },
          { offset: '40%', color: '#2D486F' },
          { offset: '68%', color: '#142238' },
          { offset: '100%', color: '#080F1C' }
        ],
        bandStops: [
          { offset: '0%', color: '#93C5FD' },
          { offset: '50%', color: '#3B82F6' },
          { offset: '100%', color: '#1D4ED8' }
        ],
        stroke: '#02050A',
        detailStroke: '#02050A',
        eyeFill: '#BFDBFE',
        rimStroke: 'rgba(147, 197, 253, 0.75)'
      }
    },

    'sakura': {
      name: 'Sakurawood',
      white: {
        bodyStops: [
          { offset: '0%', color: '#96606E' },
          { offset: '26%', color: '#F2CED8' },
          { offset: '40%', color: '#FFF5F8' },
          { offset: '68%', color: '#F2CED8' },
          { offset: '100%', color: '#A66B7A' }
        ],
        bandStops: [
          { offset: '0%', color: '#FBCFE8' },
          { offset: '50%', color: '#F472B6' },
          { offset: '100%', color: '#9D174D' }
        ],
        stroke: '#5E2B38',
        detailStroke: '#5E2B38',
        eyeFill: '#4A1D27',
        rimStroke: null
      },
      black: {
        bodyStops: [
          { offset: '0%', color: '#14070B' },
          { offset: '26%', color: '#3B1522' },
          { offset: '40%', color: '#6B283F' },
          { offset: '68%', color: '#3B1522' },
          { offset: '100%', color: '#1A090F' }
        ],
        bandStops: [
          { offset: '0%', color: '#F472B6' },
          { offset: '50%', color: '#BE185D' },
          { offset: '100%', color: '#831843' }
        ],
        stroke: '#0D0306',
        detailStroke: '#0D0306',
        eyeFill: '#FBCFE8',
        rimStroke: 'rgba(254, 205, 211, 0.7)'
      }
    },

    'walnut-maple': {
      name: 'Walnut & Maple',
      white: {
        bodyStops: [
          { offset: '0%', color: '#9C7744' },
          { offset: '26%', color: '#F0DEBA' },
          { offset: '40%', color: '#FDF6E9' },
          { offset: '68%', color: '#F0DEBA' },
          { offset: '100%', color: '#A8824C' }
        ],
        bandStops: [
          { offset: '0%', color: '#FDE047' },
          { offset: '50%', color: '#CA8A04' },
          { offset: '100%', color: '#854D0E' }
        ],
        stroke: '#4D3315',
        detailStroke: '#4D3315',
        eyeFill: '#3B250C',
        rimStroke: null
      },
      black: {
        bodyStops: [
          { offset: '0%', color: '#0C0704' },
          { offset: '26%', color: '#331B10' },
          { offset: '40%', color: '#5E3522' },
          { offset: '68%', color: '#331B10' },
          { offset: '100%', color: '#140A06' }
        ],
        bandStops: [
          { offset: '0%', color: '#FDE047' },
          { offset: '50%', color: '#CA8A04' },
          { offset: '100%', color: '#854D0E' }
        ],
        stroke: '#070402',
        detailStroke: '#070402',
        eyeFill: '#F0DEBA',
        rimStroke: 'rgba(240, 222, 186, 0.65)'
      }
    },

    'ebony-ivory': {
      name: 'Royal Ebony & Ivory',
      white: {
        bodyStops: [
          { offset: '0%', color: '#71717A' },
          { offset: '26%', color: '#E4E4E7' },
          { offset: '40%', color: '#FFFFFF' },
          { offset: '68%', color: '#E4E4E7' },
          { offset: '100%', color: '#797984' }
        ],
        bandStops: [
          { offset: '0%', color: '#FEF08A' },
          { offset: '50%', color: '#EAB308' },
          { offset: '100%', color: '#A16207' }
        ],
        stroke: '#27272A',
        detailStroke: '#27272A',
        eyeFill: '#18181B',
        rimStroke: null
      },
      black: {
        bodyStops: [
          { offset: '0%', color: '#000000' },
          { offset: '26%', color: '#18181B' },
          { offset: '40%', color: '#3F3F46' },
          { offset: '68%', color: '#18181B' },
          { offset: '100%', color: '#050506' }
        ],
        bandStops: [
          { offset: '0%', color: '#FEF08A' },
          { offset: '50%', color: '#EAB308' },
          { offset: '100%', color: '#A16207' }
        ],
        stroke: '#000000',
        detailStroke: '#000000',
        eyeFill: '#FEF08A',
        rimStroke: 'rgba(254, 240, 138, 0.85)'
      }
    }
  };

  // Support theme aliases
  THEMES['cherry-rosewood'] = THEMES['sakura'];

  const PIECE_GEOMS = {
    pawn: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M33 77C36 66 41 59 44 52H56C59 59 64 66 67 77Z"/><rect x="35" y="50" width="30" height="7" rx="3.5"/><circle cx="50" cy="37" r="12"/>',
      bands: (bGrad, sCol) => `<rect x="33" y="74" width="34" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/>`,
      details: () => ''
    },
    rook: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M33 77L36 47H64L67 77Z"/><rect x="27" y="39" width="46" height="9" rx="2.5"/><path d="M30 40V20H40V26H45V20H55V26H60V20H70V40Z"/>',
      bands: (bGrad, sCol) => `<rect x="33" y="72" width="34" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/>`,
      details: (sCol) => `<g fill="none" stroke="${sCol}" stroke-width="1.4" stroke-linecap="round"><path d="M36 33H64" stroke-opacity=".35"/></g>`
    },
    knight: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M68 77C71 58 66 40 57 30L58 17L50 22C47 22 45 24 43 26L27 42C24 45 25 50 30 51L37 52C41 52 44 50 47 47C41 56 36 64 33 77Z"/>',
      bands: (bGrad, sCol) => `<rect x="32" y="71" width="37" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/>`,
      details: (sCol, eyeFill) => `<g fill="none" stroke="${sCol}" stroke-width="1.4" stroke-linecap="round"><circle cx="46" cy="34" r="2.4" fill="${eyeFill}" stroke="none"/><circle cx="30" cy="45" r="1.3" fill="${eyeFill}" stroke="none"/><path d="M59 32C66 41 67 53 65 68" stroke-opacity=".45"/><path d="M54 35C60 43 61 53 59 66" stroke-opacity=".3"/><path d="M38 51C41 49 43 47 44 44" stroke-opacity=".35"/></g>`
    },
    bishop: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M36 77C38 68 42 62 44 59H56C58 62 62 68 64 77Z"/><rect x="37" y="53" width="26" height="8" rx="4"/><path d="M50 14C61 23 67 34 63 44C61 49 57 51 57 54H43C43 51 39 49 37 44C33 34 39 23 50 14Z"/><circle cx="50" cy="12" r="5"/>',
      bands: (bGrad, sCol) => `<rect x="35" y="72" width="30" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/>`,
      details: (sCol) => `<g fill="none" stroke="${sCol}" stroke-width="1.4" stroke-linecap="round"><path d="M46 29L56 39" stroke-width="2.6"/></g>`
    },
    queen: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M34 77C36 68 40 62 42 58H58C60 62 64 68 66 77Z"/><rect x="35" y="52" width="30" height="8" rx="4"/><path d="M36 53L26 29L34 42L38 21L43 40L50 17L57 40L62 21L66 42L74 29L64 53Z"/><circle cx="26" cy="27" r="4.4"/><circle cx="38" cy="18" r="4.4"/><circle cx="50" cy="14" r="4.6"/><circle cx="62" cy="18" r="4.4"/><circle cx="74" cy="27" r="4.4"/>',
      bands: (bGrad, sCol) => `<rect x="34" y="72" width="32" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/>`,
      details: () => ''
    },
    king: {
      geom: '<path d="M18 91C18 86 21 83 26 83H74C79 83 82 86 82 91Z"/><path d="M25 83C25 79 28 77 32 77H68C72 77 75 79 75 83Z"/><path d="M34 77C36 68 40 62 42 58H58C60 62 64 68 66 77Z"/><rect x="35" y="52" width="30" height="8" rx="4"/><path d="M36 53C31 40 38 30 50 30C62 30 69 40 64 53Z"/><rect x="45.5" y="5" width="9" height="28" rx="3"/><rect x="38" y="12" width="24" height="9" rx="3"/>',
      bands: (bGrad, sCol) => `<rect x="34" y="72" width="32" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/><rect x="24" y="80" width="52" height="3.2" rx="1.6" fill="url(#${bGrad})" stroke="${sCol}" stroke-width=".8"/>`,
      details: () => ''
    }
  };

  let currentBoardTheme = 'classic-oak';

  const PieceSVGs = {
    PIECE_NAMES,
    THEMES,

    setBoardTheme(theme) {
      if (theme && THEMES[theme]) currentBoardTheme = theme;
    },

    getActiveTheme(explicitTheme) {
      if (explicitTheme && THEMES[explicitTheme]) return explicitTheme;
      if (typeof document !== 'undefined' && document.body && document.body.dataset && document.body.dataset.boardTheme) {
        const docTheme = document.body.dataset.boardTheme;
        if (THEMES[docTheme]) return docTheme;
      }
      return currentBoardTheme || 'classic-oak';
    },

    getPiece(color, type, boardTheme) {
      const isWhite = color === 'white' || color === 'w';
      const colCode = isWhite ? 'w' : 'b';
      const pieceType = TYPE_MAP[type] || 'pawn';
      const letter = LETTER_MAP[pieceType] || 'P';
      const themeId = this.getActiveTheme(boardTheme);

      const theme = THEMES[themeId] || THEMES['classic-oak'];
      const palette = isWhite ? theme.white : theme.black;
      const piece = PIECE_GEOMS[pieceType] || PIECE_GEOMS.pawn;

      const pfx = `${themeId}_${colCode}${letter}`;
      const gId = `g_${pfx}`;
      const vId = `v_${pfx}`;
      const brId = `br_${pfx}`;
      const blId = `bl_${pfx}`;
      const sId = `s_${pfx}`;

      const bodyStops = palette.bodyStops.map(s => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
      const bandStops = palette.bandStops.map(s => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');

      const rimUse = palette.rimStroke
        ? `<use href="#${sId}" fill="none" stroke="${palette.rimStroke}" stroke-width="4.2"/>`
        : '';

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" class="chess-piece new-style-piece ${isWhite ? 'white' : 'black'}-piece ${isWhite ? 'white' : 'black'}-${pieceType}" data-color="${colCode}" data-theme="${themeId}">
          <defs>
            <linearGradient id="${gId}" x1="0" x2="1" y1="0" y2="0">${bodyStops}</linearGradient>
            <linearGradient id="${vId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
            <linearGradient id="${brId}" x1="0" x2="0" y1="0" y2="1">${bandStops}</linearGradient>
            <filter id="${blId}" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter>
            <g id="${sId}" stroke-linejoin="round">${piece.geom}</g>
          </defs>
          <ellipse cx="52" cy="91" rx="34" ry="4.5" fill="#000" opacity=".4" filter="url(#${blId})"/>
          ${rimUse}
          <use href="#${sId}" fill="url(#${gId})" stroke="${palette.stroke}" stroke-width="1.8"/>
          <use href="#${sId}" fill="url(#${vId})" stroke="none"/>
          ${piece.details(palette.detailStroke, palette.eyeFill)}
          ${piece.bands(brId, palette.stroke)}
        </svg>
      `;
    },

    pieceMarkup(pieceCode, boardTheme) {
      if (!pieceCode) return '';
      const color = pieceCode[0] === 'w' ? 'white' : 'black';
      const type = pieceCode[1];
      return this.getPiece(color, type, boardTheme);
    },

    getPieceUrl(color, type, boardTheme) {
      const isWhite = color === 'white' || color === 'w';
      const colCode = isWhite ? 'w' : 'b';
      const pieceType = TYPE_MAP[type] || 'pawn';
      const letter = LETTER_MAP[pieceType] || 'P';
      const themeId = this.getActiveTheme(boardTheme);
      return `assets/pieces/${themeId}/${colCode}${letter}.svg`;
    }
  };

  if (typeof window !== 'undefined') {
    window.PieceSVGs = PieceSVGs;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PieceSVGs;
  }
})();
