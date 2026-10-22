/**
 * Owl's Gambit Multi-Style Chess Pieces
 * Supports 3 completely distinct physical geometries & silhouettes:
 * 1. 'classic' - Traditional Staunton Hand-drawn Wood Inlay
 * 2. 'geometric' - Bauhaus / Neo-Gothic Minimalist Sculpted Angles
 * 3. 'royal' - Imperial Regal Crown & Mythic Winged Knight
 */

const BASE_ART_CLASSIC = `
  <path class="piece-base" d="M27.2 82H72.8C76.1 82 78.4 84 78.4 87.1V89.7C78.4 92.4 76.2 94 73 94H27C23.8 94 21.6 92.4 21.6 89.7V87.1C21.6 84 23.9 82 27.2 82Z"/>
  <path class="piece-shade" d="M23.8 87.2H76.2V89.4C76.2 91.9 74.1 93 71.5 93H28.5C25.9 93 23.8 91.9 23.8 89.4V87.2Z"/>
  <path class="piece-highlight" d="M27.6 83.2H72.4C73.7 83.2 74.7 83.7 75.4 84.5H24.6C25.3 83.7 26.3 83.2 27.6 83.2Z"/>
  <path class="piece-detail" d="M26.5 90.4H73.5"/>
`;

const PIECE_ART_CLASSIC = {
  P: `
    <circle class="piece-body" cx="50" cy="31.5" r="14.3"/>
    <path class="piece-body" d="M43.8 43.5C44.2 47.8 42 49.9 42 53.2C42 56.5 45.4 58.8 50 58.8C54.6 58.8 58 56.5 58 53.2C58 49.9 55.8 47.8 56.2 43.5Z"/>
    <path class="piece-body" d="M42.6 53.3C37.9 58.9 35.1 68.6 34.4 81.9H65.6C64.9 68.6 62.1 58.9 57.4 53.3C55.7 56.2 53.2 57.7 50 57.7C46.8 57.7 44.3 56.2 42.6 53.3Z"/>
    <path class="piece-shade" d="M42.8 55.6C45.7 57.7 54.3 57.7 57.2 55.6C56.4 59.1 53.7 60.7 50 60.7C46.3 60.7 43.6 59.1 42.8 55.6Z"/>
    <path class="piece-highlight" d="M40.9 27.2C42.8 22.7 47.5 20 52.5 20.9C47.4 21.9 43.6 24.3 40.9 27.2Z"/>
    <path class="piece-detail" d="M43.5 72.3C46.7 73.7 53.3 73.7 56.5 72.3M38.2 80.7H61.8"/>
    ${BASE_ART_CLASSIC}
  `,
  N: `
    <path class="piece-body" d="M26 82C26.8 71.5 29.4 63.2 36.2 55.9C39.1 52.9 39.8 50.1 38.4 47.3C36.7 44 34 43.2 30.1 44.9C27.2 46.2 24.4 44.9 23.4 41.9C22.2 38.3 24.7 33.3 31.1 29.2C37 25.4 42.7 22.5 46.3 19.4L48.5 14.1C49.3 12.2 51.7 12.5 52.3 14.5L54.4 22.3L60.1 14.6C61.4 12.9 63.8 14 63.8 16.1L63.5 27.3C68.2 31 72.2 37.5 74.1 45.3C75.5 51.2 75.7 63.6 75.3 82Z"/>
    <path class="piece-shade" d="M39.7 48.8C42.7 48.9 45.5 47.2 47.2 44.3C48.1 52.6 45.1 59.7 40.2 63.2C37 61.7 34 60.9 30.8 61.5C32.8 55.8 35.8 51.5 39.7 48.8Z"/>
    <path class="piece-highlight" d="M49.9 21.5C53 22.2 55.7 24.2 57.4 27.2C54.1 25.5 51.3 25.2 48.7 26.1Z"/>
    <path class="piece-detail" d="M50.7 25.3C56.7 30 58.6 36.1 56.1 42.5M42.1 42.6C45 45.1 48.7 45.6 52.4 43.8M26.6 41C29.2 43.8 32.7 44.9 36.2 43.1M30.1 51.4C33.6 52.3 37.1 51.7 40.4 49.9"/>
    <circle class="piece-eye" cx="44.2" cy="31.7" r="1.5"/>
    <path class="piece-detail" d="M25.9 40.1C27 41.6 29.1 42.3 31 41.6"/>
    ${BASE_ART_CLASSIC}
  `,
  B: `
    <circle class="piece-body" cx="50" cy="16.8" r="5.4"/>
    <path class="piece-body" d="M50 22.9C42 29.4 34.2 38.8 34.5 49.1C34.8 58.8 41.4 64 50 64C58.6 64 65.2 58.8 65.5 49.1C65.8 38.8 58 29.4 50 22.9Z"/>
    <path class="piece-body" d="M43.3 61.6C39.2 66.6 36.8 73.4 36 81.9H64C63.2 73.4 60.8 66.6 56.7 61.6C54.5 63.7 52.4 64.8 50 64.8C47.6 64.8 45.5 63.7 43.3 61.6Z"/>
    <path class="piece-shade" d="M36.7 49.4C41.3 52.7 45.7 51.3 48.9 46.8C44.7 55.6 40.4 58.2 36.9 55.3Z"/>
    <path class="piece-highlight" d="M42.1 38.1C45.3 32.9 49.8 28.9 55.2 25.3C48.4 30.6 43.8 35.4 41.3 41.4Z"/>
    <path class="piece-detail" d="M51.2 30.2C46.7 36.7 47 43.2 53.4 47.5M37.4 49.5C44 54.3 56 54.3 62.6 49.5M43.1 65.2C46.2 67 53.8 67 56.9 65.2"/>
    ${BASE_ART_CLASSIC}
  `,
  R: `
    <path class="piece-body" d="M29 17.5H39V25H44.8V17.5H55.2V25H61V17.5H71V39.2L65.5 45.2V81.9H34.5V45.2L29 39.2Z"/>
    <path class="piece-shade" d="M29.5 39.4L35 45.3V48.3H65V45.3L70.5 39.4V43.5H29.5Z"/>
    <path class="piece-highlight" d="M30.4 18.9H37.7V23.7H30.4ZM45.2 18.9H54.8V23.7H45.2ZM62.3 18.9H69.6V23.7H62.3Z"/>
    <path class="piece-detail" d="M34.7 52.7H65.3M34.7 67.8H65.3M40.1 45.3V81.9M59.9 45.3V81.9M45.3 54.9V65.5M54.7 54.9V65.5"/>
    ${BASE_ART_CLASSIC}
  `,
  Q: `
    <circle class="piece-body" cx="22.8" cy="29" r="4.3"/>
    <circle class="piece-body" cx="36.3" cy="21.2" r="4.3"/>
    <circle class="piece-body" cx="50" cy="17.4" r="4.5"/>
    <circle class="piece-body" cx="63.7" cy="21.2" r="4.3"/>
    <circle class="piece-body" cx="77.2" cy="29" r="4.3"/>
    <path class="piece-body" d="M23.4 31.8L30 57.1C30.7 59.9 33.1 61.8 36 61.8H64C66.9 61.8 69.3 59.9 70 57.1L76.6 31.8L64.2 43.5L56.3 29.1L50 43.1L43.7 29.1L35.8 43.5Z"/>
    <path class="piece-body" d="M37.2 61.1C35.4 67.2 34.4 74.2 34 81.9H66C65.6 74.2 64.6 67.2 62.8 61.1C58.7 63.3 53.9 64.2 50 64.2C46.1 64.2 41.3 63.3 37.2 61.1Z"/>
    <path class="piece-shade" d="M38.5 64.1C42.5 65.8 57.5 65.8 61.5 64.1C63.2 69.4 64.1 74.8 64.5 81.9H35.5C35.9 74.8 36.8 69.4 38.5 64.1Z"/>
    ${BASE_ART_CLASSIC}
  `,
  K: `
    <path class="piece-body" d="M46.5 7.5H53.5V15H61V22H53.5V29.5H46.5V22H39V15H46.5Z"/>
    <path class="piece-body" d="M31.8 35.2L38.8 56.2C39.4 58.6 41.5 60.2 44 60.2H56C58.5 60.2 60.6 58.6 61.2 56.2L68.2 35.2L57.3 44.4L50 34.4L42.7 44.4Z"/>
    <path class="piece-body" d="M38.3 59.5C36 66.2 34.7 73.5 34.2 81.9H65.8C65.3 73.5 64 66.2 61.7 59.5C58.5 61.4 54.4 62.4 50 62.4C45.6 62.4 41.5 61.4 38.3 59.5Z"/>
    <path class="piece-shade" d="M39.2 62.5C42.6 64.3 57.4 64.3 60.8 62.5C62.7 68.2 63.8 74.6 64.2 81.9H35.8C36.2 74.6 37.3 68.2 39.2 62.5Z"/>
    <path class="piece-highlight" d="M47.8 9.1H52.2V16.6H59.3V20H47.8Z"/>
    <path class="piece-detail" d="M42.4 57.6C46.4 59.6 53.6 59.6 57.6 57.6M38.8 74.4H61.2M50 39.2V49.2M45.5 44.2H54.5"/>
    ${BASE_ART_CLASSIC}
  `
};

/* --- STYLE 2: GEOMETRIC / MODERN ARCHITECTURAL SILHOUETTE --- */
const BASE_ART_GEOMETRIC = `
  <polygon class="piece-base" points="24,84 76,84 72,92 28,92"/>
  <line class="piece-detail" x1="26" y1="88" x2="74" y2="88"/>
`;

const PIECE_ART_GEOMETRIC = {
  P: `
    <polygon class="piece-body" points="50,22 64,46 50,42 36,46"/>
    <polygon class="piece-body" points="40,46 60,46 66,84 34,84"/>
    <line class="piece-detail" x1="50" y1="22" x2="50" y2="84"/>
    ${BASE_ART_GEOMETRIC}
  `,
  N: `
    <polygon class="piece-body" points="30,84 32,56 22,46 28,34 44,20 62,20 74,38 70,84 56,76 42,84"/>
    <polygon class="piece-highlight" points="44,20 58,20 68,36 50,50"/>
    <circle class="piece-eye" cx="38" cy="36" r="3"/>
    <line class="piece-detail" x1="42" y1="56" x2="64" y2="56"/>
    ${BASE_ART_GEOMETRIC}
  `,
  B: `
    <polygon class="piece-body" points="50,14 62,34 50,70 38,34"/>
    <polygon class="piece-body" points="40,70 60,70 65,84 35,84"/>
    <circle class="piece-highlight" cx="50" cy="14" r="3.5"/>
    <line class="piece-detail" x1="50" y1="22" x2="50" y2="64"/>
    <line class="piece-detail" x1="42" y1="42" x2="58" y2="42"/>
    ${BASE_ART_GEOMETRIC}
  `,
  R: `
    <polygon class="piece-body" points="28,20 72,20 72,34 64,42 64,84 36,84 36,42 28,34"/>
    <polygon class="piece-shade" points="36,20 44,20 44,28 36,28"/>
    <polygon class="piece-shade" points="56,20 64,20 64,28 56,28"/>
    <line class="piece-detail" x1="36" y1="42" x2="64" y2="42"/>
    <line class="piece-detail" x1="36" y1="64" x2="64" y2="64"/>
    ${BASE_ART_GEOMETRIC}
  `,
  Q: `
    <polygon class="piece-body" points="20,28 32,54 50,30 68,54 80,28 70,68 64,84 36,84 30,68"/>
    <polygon class="piece-highlight" points="50,30 58,48 50,60 42,48"/>
    <circle class="piece-body" cx="20" cy="24" r="3"/>
    <circle class="piece-body" cx="50" cy="24" r="3.5"/>
    <circle class="piece-body" cx="80" cy="24" r="3"/>
    <line class="piece-detail" x1="34" y1="70" x2="66" y2="70"/>
    ${BASE_ART_GEOMETRIC}
  `,
  K: `
    <polygon class="piece-body" points="47,12 53,12 53,18 59,18 59,24 53,24 53,30 47,30 47,24 41,24 41,18 47,18"/>
    <polygon class="piece-body" points="26,34 74,34 68,66 65,84 35,84 32,66"/>
    <polygon class="piece-highlight" points="50,34 62,54 50,68 38,54"/>
    <line class="piece-detail" x1="32" y1="64" x2="68" y2="64"/>
    <line class="piece-detail" x1="35" y1="74" x2="65" y2="74"/>
    ${BASE_ART_GEOMETRIC}
  `
};

/* --- STYLE 3: ROYAL / ORNATE IMPERIAL SILHOUETTE --- */
const BASE_ART_ROYAL = `
  <path class="piece-base" d="M22 84 C22 80, 78 80, 78 84 L75 92 C75 94, 25 94, 25 92 Z"/>
  <path class="piece-detail" d="M26 88 L74 88"/>
`;

const PIECE_ART_ROYAL = {
  P: `
    <circle class="piece-body" cx="50" cy="28" r="16"/>
    <circle class="piece-highlight" cx="46" cy="24" r="5"/>
    <path class="piece-body" d="M38 42 C36 58, 30 74, 32 84 L68 84 C70 74, 64 58, 62 42 Z"/>
    <path class="piece-detail" d="M40 56 Q50 62 60 56 M36 72 Q50 78 64 72"/>
    ${BASE_ART_ROYAL}
  `,
  N: `
    <path class="piece-body" d="M25 84 C24 64, 28 50, 24 38 C22 30, 30 18, 42 16 C54 14, 66 18, 72 28 C78 38, 74 58, 76 84 C66 80, 48 88, 38 84 Z"/>
    <path class="piece-highlight" d="M42 22 C52 24, 60 32, 60 44 C50 40, 44 32, 42 22 Z"/>
    <circle class="piece-eye" cx="36" cy="30" r="2.5"/>
    <path class="piece-detail" d="M44 48 C48 54, 56 54, 60 50 M40 62 C46 68, 58 68, 64 62"/>
    ${BASE_ART_ROYAL}
  `,
  B: `
    <circle class="piece-highlight" cx="50" cy="12" r="4"/>
    <path class="piece-body" d="M50 16 C34 26, 32 46, 36 62 C40 68, 42 74, 34 84 L66 84 C58 74, 60 68, 64 62 C68 46, 66 26, 50 16 Z"/>
    <path class="piece-detail" d="M44 34 L56 46 M56 34 L44 46 M38 66 Q50 72 62 66"/>
    ${BASE_ART_ROYAL}
  `,
  R: `
    <path class="piece-body" d="M26 18 L34 18 L34 26 L44 26 L44 18 L56 18 L56 26 L66 26 L66 18 L74 18 L72 38 C68 44, 66 58, 68 84 L32 84 C34 58, 32 44, 28 38 Z"/>
    <path class="piece-detail" d="M30 42 L70 42 M32 64 L68 64 M50 42 L50 84"/>
    ${BASE_ART_ROYAL}
  `,
  Q: `
    <circle class="piece-body" cx="24" cy="24" r="3.5"/>
    <circle class="piece-body" cx="37" cy="18" r="3.5"/>
    <circle class="piece-body" cx="50" cy="14" r="4"/>
    <circle class="piece-body" cx="63" cy="18" r="3.5"/>
    <circle class="piece-body" cx="76" cy="24" r="3.5"/>
    <path class="piece-body" d="M24 28 L32 54 L44 38 L50 48 L56 38 L68 54 L76 28 C74 48, 70 66, 68 84 L32 84 C30 66, 26 48, 24 28 Z"/>
    <path class="piece-highlight" d="M38 60 Q50 68 62 60"/>
    <path class="piece-detail" d="M32 72 Q50 78 68 72"/>
    ${BASE_ART_ROYAL}
  `,
  K: `
    <path class="piece-body" d="M47 8 L53 8 L53 14 L59 14 L59 20 L53 20 L53 26 L47 26 L47 20 L41 20 L41 14 L47 14 Z"/>
    <path class="piece-body" d="M28 30 C34 26, 66 26, 72 30 C76 46, 70 64, 68 84 L32 84 C30 64, 24 46, 28 30 Z"/>
    <path class="piece-highlight" d="M38 40 Q50 46 62 40"/>
    <path class="piece-detail" d="M34 56 Q50 64 66 56 M34 72 Q50 78 66 72"/>
    ${BASE_ART_ROYAL}
  `
};

const SHAPE_MAP = {
  'staunton-boxwood': 'classic',
  'carved-mahogany': 'royal',
  'royal-gold': 'royal',
  'obsidian-onyx': 'geometric',
  'ember': 'royal',
  'moonlit': 'geometric',
  'sakura': 'royal',
  'ebony-ivory': 'classic'
};

const TYPE_TO_CODE = {
  pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K',
  P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K'
};

function getActiveShapeKey() {
  const currentPieceTheme = (typeof document !== 'undefined' && document.body && document.body.dataset.pieceTheme) 
    || (typeof localStorage !== 'undefined' && localStorage.getItem('owl_piece_theme')) 
    || 'staunton-boxwood';
  return SHAPE_MAP[currentPieceTheme] || 'classic';
}

function pieceMarkup(piece, shapeKey) {
  if (!piece) return "";
  const color = piece[0];
  const type = piece[1];
  const activeShape = shapeKey || getActiveShapeKey();

  let art = PIECE_ART_CLASSIC[type];
  if (activeShape === 'geometric') art = PIECE_ART_GEOMETRIC[type] || art;
  else if (activeShape === 'royal') art = PIECE_ART_ROYAL[type] || art;

  return `<svg
    class="chess-piece"
    data-color="${color}"
    data-shape="${activeShape}"
    viewBox="0 0 100 100"
    aria-hidden="true"
    focusable="false"
  >${art || ""}</svg>`;
}

const PieceSVGs = {
  pieceMarkup,
  getPiece(color, type) {
    const colCode = (color === 'white' || color === 'w') ? 'w' : 'b';
    const typeCode = TYPE_TO_CODE[type] || 'P';
    return pieceMarkup(colCode + typeCode);
  },
  getShapePreview(shapeName, type, color = 'w') {
    return pieceMarkup(color + (TYPE_TO_CODE[type] || 'N'), shapeName);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PieceSVGs;
}
