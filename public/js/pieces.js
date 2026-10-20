/**
 * Staunton Wooden Chess Pieces (High-Definition 2D with 3D Depth)
 * Designed for YouTube Playables / Playgama
 */

const PieceSVGs = {
  getPiece(color, type) {
    const isWhite = color === 'white';
    const gradId = isWhite ? 'whiteWoodGrad' : 'blackWoodGrad';
    const highlightGrad = isWhite ? 'whiteHighlightGrad' : 'blackHighlightGrad';
    const rimColor = isWhite ? '#B08D57' : '#140B07';
    const strokeColor = isWhite ? '#8C6738' : '#0D0704';

    let paths = '';

    switch (type) {
      case 'pawn':
        paths = `
          <!-- Pawn Base & Torso -->
          <ellipse cx="22" cy="40" rx="14" ry="3.5" fill="rgba(0,0,0,0.3)" />
          <path d="M12 39 C12 37 15 36 22 36 C29 36 32 37 32 39 C32 41 12 41 12 39 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <path d="M14 36 C16 30 18 24 19 20 C19 19 25 19 25 20 C26 24 28 30 30 36 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Collar Ring -->
          <ellipse cx="22" cy="19.5" rx="6.5" ry="2" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Head Ball -->
          <circle cx="22" cy="12.5" r="7.5" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <ellipse cx="19.5" cy="10" rx="2.5" ry="2" fill="url(#${highlightGrad})" opacity="0.6" />
        `;
        break;

      case 'rook':
        paths = `
          <!-- Rook Base -->
          <ellipse cx="22" cy="40.5" rx="15" ry="3.5" fill="rgba(0,0,0,0.3)" />
          <path d="M10 40 C10 38 13 36 22 36 C31 36 34 38 34 40 C34 42 10 42 10 40 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Tower Body -->
          <path d="M13 36 L15 19 L29 19 L31 36 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Parapet Base Ring -->
          <rect x="13" y="17" width="18" height="3" rx="1" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Crenellations (Castles) -->
          <path d="M12 17 L12 9 L16 9 L16 13 L20 13 L20 9 L24 9 L24 13 L28 13 L28 9 L32 9 L32 17 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
        `;
        break;

      case 'knight':
        paths = `
          <!-- Knight Base -->
          <ellipse cx="22" cy="40.5" rx="15" ry="3.5" fill="rgba(0,0,0,0.3)" />
          <path d="M10 40 C10 38 13 36 22 36 C31 36 34 38 34 40 C34 42 10 42 10 40 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Horse Head & Mane -->
          <path d="M12 36 C13 28 12 21 15 15 C17 12 20 8 23 7 C24 7 24 10 24 11 C26 9 29 8 31 10 C33 12 32 17 31 20 C29 20 28 18 26 19 C25 21 27 25 28 29 C29 32 30 35 31 36 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Muzzle & Chest -->
          <path d="M15 15 C13 16 9 18 8 21 C7 23 10 26 13 24 C16 22 17 25 17 28 C17 31 15 34 13 36 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Eye & Nostril -->
          <circle cx="14" cy="18" r="1.2" fill="${isWhite ? '#5A381E' : '#EBD2A5'}" />
          <!-- Mane Highlights -->
          <path d="M23 11 C21 16 20 22 21 28" stroke="${isWhite ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}" stroke-width="1.5" stroke-linecap="round" fill="none" />
        `;
        break;

      case 'bishop':
        paths = `
          <!-- Bishop Base -->
          <ellipse cx="22" cy="40.5" rx="14.5" ry="3.5" fill="rgba(0,0,0,0.3)" />
          <path d="M11 40 C11 38 14 36 22 36 C30 36 33 38 33 40 C33 42 11 42 11 40 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <path d="M14 36 C16 30 18 24 19 21 L25 21 C26 24 28 30 30 36 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Collar -->
          <ellipse cx="22" cy="20.5" rx="7.5" ry="2" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Mitre Body -->
          <path d="M15 20 C14 14 16 8 22 6 C28 8 30 14 29 20 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Mitre Slit Cut -->
          <path d="M21 9 L17 15" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" />
          <!-- Finial Cross/Ball -->
          <circle cx="22" cy="5" r="2.2" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="0.8" />
        `;
        break;

      case 'queen':
        paths = `
          <!-- Queen Base -->
          <ellipse cx="22" cy="41" rx="16" ry="3.5" fill="rgba(0,0,0,0.3)" />
          <path d="M9 40 C9 38 13 36 22 36 C31 36 35 38 35 40 C35 42 9 42 9 40 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Flared Waist -->
          <path d="M13 36 C16 28 17 22 18 19 L26 19 C27 22 28 28 31 36 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Waist Ring -->
          <ellipse cx="22" cy="18.5" rx="8" ry="2" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Coronet (Crown with 5 pearls) -->
          <path d="M14 18 L11 9 L16 13 L22 7 L28 13 L33 9 L30 18 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <circle cx="11" cy="8" r="1.5" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="0.7" />
          <circle cx="16.5" cy="12" r="1.5" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="0.7" />
          <circle cx="22" cy="6" r="1.8" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="0.7" />
          <circle cx="27.5" cy="12" r="1.5" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="0.7" />
          <circle cx="33" cy="8" r="1.5" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="0.7" />
        `;
        break;

      case 'king':
        paths = `
          <!-- King Base -->
          <ellipse cx="22" cy="41" rx="16.5" ry="3.5" fill="rgba(0,0,0,0.3)" />
          <path d="M8.5 40 C8.5 38 12.5 36 22 36 C31.5 36 35.5 38 35.5 40 C35.5 42 8.5 42 8.5 40 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Torso -->
          <path d="M12.5 36 C15.5 28 16.5 22 17.5 19 L26.5 19 C27.5 22 28.5 28 31.5 36 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Waist Ring -->
          <ellipse cx="22" cy="18.5" rx="8.5" ry="2.2" fill="url(#${highlightGrad})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Imperial Arched Crown -->
          <path d="M13.5 18 C12.5 11 16 8 22 8 C28 8 31.5 11 30.5 18 Z" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="1" />
          <!-- Royal Finial Cross -->
          <path d="M22 2 L22 8 M19.5 4.5 L24.5 4.5" stroke="url(#${highlightGrad})" stroke-width="2" stroke-linecap="square" />
        `;
        break;
    }

    return `
      <svg class="staunton-piece ${color}-${type}" viewBox="0 0 44 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Boxwood White Piece Gradient -->
          <linearGradient id="whiteWoodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFF8EC" />
            <stop offset="35%" stop-color="#EED9B7" />
            <stop offset="80%" stop-color="#CBB18B" />
            <stop offset="100%" stop-color="#A98A62" />
          </linearGradient>
          <linearGradient id="whiteHighlightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="100%" stop-color="#EAD6B8" />
          </linearGradient>

          <!-- Ebony Black Piece Gradient -->
          <linearGradient id="blackWoodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4A3428" />
            <stop offset="30%" stop-color="#2D1C13" />
            <stop offset="85%" stop-color="#190F09" />
            <stop offset="100%" stop-color="#0E0704" />
          </linearGradient>
          <linearGradient id="blackHighlightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#6B4F3E" />
            <stop offset="100%" stop-color="#281A12" />
          </linearGradient>
        </defs>
        ${paths}
      </svg>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PieceSVGs;
}
