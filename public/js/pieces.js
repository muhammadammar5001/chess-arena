/**
 * Hand-drawn Wood Inlay Chess Pieces (Ivory & Walnut Wood)
 * High-definition hand-crafted vector artwork
 */

const BASE_ART = `
  <path class="piece-base" d="M27.2 82H72.8C76.1 82 78.4 84 78.4 87.1V89.7C78.4 92.4 76.2 94 73 94H27C23.8 94 21.6 92.4 21.6 89.7V87.1C21.6 84 23.9 82 27.2 82Z"/>
  <path class="piece-shade" d="M23.8 87.2H76.2V89.4C76.2 91.9 74.1 93 71.5 93H28.5C25.9 93 23.8 91.9 23.8 89.4V87.2Z"/>
  <path class="piece-highlight" d="M27.6 83.2H72.4C73.7 83.2 74.7 83.7 75.4 84.5H24.6C25.3 83.7 26.3 83.2 27.6 83.2Z"/>
  <path class="piece-detail" d="M26.5 90.4H73.5"/>
`;

const PIECE_ART = {
  P: `
    <circle class="piece-body" cx="50" cy="31.5" r="14.3"/>
    <path class="piece-body" d="M43.8 43.5C44.2 47.8 42 49.9 42 53.2C42 56.5 45.4 58.8 50 58.8C54.6 58.8 58 56.5 58 53.2C58 49.9 55.8 47.8 56.2 43.5Z"/>
    <path class="piece-body" d="M42.6 53.3C37.9 58.9 35.1 68.6 34.4 81.9H65.6C64.9 68.6 62.1 58.9 57.4 53.3C55.7 56.2 53.2 57.7 50 57.7C46.8 57.7 44.3 56.2 42.6 53.3Z"/>
    <path class="piece-shade" d="M42.8 55.6C45.7 57.7 54.3 57.7 57.2 55.6C56.4 59.1 53.7 60.7 50 60.7C46.3 60.7 43.6 59.1 42.8 55.6Z"/>
    <path class="piece-highlight" d="M40.9 27.2C42.8 22.7 47.5 20 52.5 20.9C47.4 21.9 43.6 24.3 40.9 27.2Z"/>
    <path class="piece-detail" d="M43.5 72.3C46.7 73.7 53.3 73.7 56.5 72.3M38.2 80.7H61.8"/>
    ${BASE_ART}
  `,

  N: `
    <path class="piece-body" d="M26 82C26.8 71.5 29.4 63.2 36.2 55.9C39.1 52.9 39.8 50.1 38.4 47.3C36.7 44 34 43.2 30.1 44.9C27.2 46.2 24.4 44.9 23.4 41.9C22.2 38.3 24.7 33.3 31.1 29.2C37 25.4 42.7 22.5 46.3 19.4L48.5 14.1C49.3 12.2 51.7 12.5 52.3 14.5L54.4 22.3L60.1 14.6C61.4 12.9 63.8 14 63.8 16.1L63.5 27.3C68.2 31 72.2 37.5 74.1 45.3C75.5 51.2 75.7 63.6 75.3 82Z"/>
    <path class="piece-shade" d="M39.7 48.8C42.7 48.9 45.5 47.2 47.2 44.3C48.1 52.6 45.1 59.7 40.2 63.2C37 61.7 34 60.9 30.8 61.5C32.8 55.8 35.8 51.5 39.7 48.8Z"/>
    <path class="piece-highlight" d="M49.9 21.5C53 22.2 55.7 24.2 57.4 27.2C54.1 25.5 51.3 25.2 48.7 26.1Z"/>
    <path class="piece-detail" d="M50.7 25.3C56.7 30 58.6 36.1 56.1 42.5M42.1 42.6C45 45.1 48.7 45.6 52.4 43.8M26.6 41C29.2 43.8 32.7 44.9 36.2 43.1M30.1 51.4C33.6 52.3 37.1 51.7 40.4 49.9"/>
    <circle class="piece-eye" cx="44.2" cy="31.7" r="1.5"/>
    <path class="piece-detail" d="M25.9 40.1C27 41.6 29.1 42.3 31 41.6"/>
    ${BASE_ART}
  `,

  B: `
    <circle class="piece-body" cx="50" cy="16.8" r="5.4"/>
    <path class="piece-body" d="M50 22.9C42 29.4 34.2 38.8 34.5 49.1C34.8 58.8 41.4 64 50 64C58.6 64 65.2 58.8 65.5 49.1C65.8 38.8 58 29.4 50 22.9Z"/>
    <path class="piece-body" d="M43.3 61.6C39.2 66.6 36.8 73.4 36 81.9H64C63.2 73.4 60.8 66.6 56.7 61.6C54.5 63.7 52.4 64.8 50 64.8C47.6 64.8 45.5 63.7 43.3 61.6Z"/>
    <path class="piece-shade" d="M36.7 49.4C41.3 52.7 45.7 51.3 48.9 46.8C44.7 55.6 40.4 58.2 36.9 55.3Z"/>
    <path class="piece-highlight" d="M42.1 38.1C45.3 32.9 49.8 28.9 55.2 25.3C48.4 30.6 43.8 35.4 41.3 41.4Z"/>
    <path class="piece-detail" d="M51.2 30.2C46.7 36.7 47 43.2 53.4 47.5M37.4 49.5C44 54.3 56 54.3 62.6 49.5M43.1 65.2C46.2 67 53.8 67 56.9 65.2"/>
    ${BASE_ART}
  `,

  R: `
    <path class="piece-body" d="M29 17.5H39V25H44.8V17.5H55.2V25H61V17.5H71V39.2L65.5 45.2V81.9H34.5V45.2L29 39.2Z"/>
    <path class="piece-shade" d="M29.5 39.4L35 45.3V48.3H65V45.3L70.5 39.4V43.5H29.5Z"/>
    <path class="piece-highlight" d="M30.4 18.9H37.7V23.7H30.4ZM45.2 18.9H54.8V23.7H45.2ZM62.3 18.9H69.6V23.7H62.3Z"/>
    <path class="piece-detail" d="M34.7 52.7H65.3M34.7 67.8H65.3M40.1 45.3V81.9M59.9 45.3V81.9M45.3 54.9V65.5M54.7 54.9V65.5"/>
    ${BASE_ART}
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
    <path class="piece-highlight" d="M20.9 27C21.7 25 23.8 23.9 25.9 24.6C23.4 25.4 21.9 26.1 20.9 27ZM34.4 19.2C35.2 17.2 37.3 16.1 39.4 16.8C36.9 17.6 35.4 18.3 34.4 19.2ZM48.2 15.4C48.9 13.3 51.1 12.2 53.2 13C50.6 13.8 49.1 14.5 48.2 15.4Z"/>
    <path class="piece-detail" d="M42.5 58.3C46.6 60.3 53.4 60.3 57.5 58.3M38.8 74.4H61.2M45.1 67.1H54.9"/>
    ${BASE_ART}
  `,

  K: `
    <path class="piece-body" d="M46.5 7.5H53.5V15H61V22H53.5V29.5H46.5V22H39V15H46.5Z"/>
    <path class="piece-body" d="M31.8 35.2L38.8 56.2C39.4 58.6 41.5 60.2 44 60.2H56C58.5 60.2 60.6 58.6 61.2 56.2L68.2 35.2L57.3 44.4L50 34.4L42.7 44.4Z"/>
    <path class="piece-body" d="M38.3 59.5C36 66.2 34.7 73.5 34.2 81.9H65.8C65.3 73.5 64 66.2 61.7 59.5C58.5 61.4 54.4 62.4 50 62.4C45.6 62.4 41.5 61.4 38.3 59.5Z"/>
    <path class="piece-shade" d="M39.2 62.5C42.6 64.3 57.4 64.3 60.8 62.5C62.7 68.2 63.8 74.6 64.2 81.9H35.8C36.2 74.6 37.3 68.2 39.2 62.5Z"/>
    <path class="piece-highlight" d="M47.8 9.1H52.2V16.6H59.3V20H47.8Z"/>
    <path class="piece-detail" d="M42.4 57.6C46.4 59.6 53.6 59.6 57.6 57.6M38.8 74.4H61.2M50 39.2V49.2M45.5 44.2H54.5"/>
    ${BASE_ART}
  `
};

const PIECE_NAMES = {
  P: "pawn",
  N: "knight",
  B: "bishop",
  R: "rook",
  Q: "queen",
  K: "king"
};

const TYPE_TO_CODE = {
  pawn: 'P',
  knight: 'N',
  bishop: 'B',
  rook: 'R',
  queen: 'Q',
  king: 'K',
  P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K'
};

function pieceMarkup(piece) {
  if (!piece) return "";
  const color = piece[0];
  const type = piece[1];

  return `<svg
    class="chess-piece"
    data-color="${color}"
    viewBox="0 0 100 100"
    aria-hidden="true"
    focusable="false"
  >${PIECE_ART[type] || ""}</svg>`;
}

const PieceSVGs = {
  BASE_ART,
  PIECE_ART,
  PIECE_NAMES,
  pieceMarkup,
  getPiece(color, type) {
    const colCode = (color === 'white' || color === 'w') ? 'w' : 'b';
    const typeCode = TYPE_TO_CODE[type] || 'P';
    return pieceMarkup(colCode + typeCode);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PieceSVGs;
}