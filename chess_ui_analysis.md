# 🎨 `@chess` Design System Analysis

Based on the [Behance project](https://www.behance.net/gallery/255415027/chess), here is a complete breakdown of how to achieve this specific UI style in code (Tailwind/CSS).

## 📸 Reference Screenshots
````carousel
![Mobile App Screens](C:/Users/muham/.gemini/antigravity-ide/brain/1e655e9c-be81-4240-ab5c-e8691100ff1a/behance_chess_10_1790383224899.png)
<!-- slide -->
![Game Board Detail](C:/Users/muham/.gemini/antigravity-ide/brain/1e655e9c-be81-4240-ab5c-e8691100ff1a/behance_chess_12_1790383276252.png)
<!-- slide -->
![Typography & Colors](C:/Users/muham/.gemini/antigravity-ide/brain/1e655e9c-be81-4240-ab5c-e8691100ff1a/behance_chess_8_1790383180306.png)
<!-- slide -->
![Board & Piece Themes](C:/Users/muham/.gemini/antigravity-ide/brain/1e655e9c-be81-4240-ab5c-e8691100ff1a/behance_chess_15_1790383374613.png)
````

---

## 1. Aesthetic Overview
- **Vibe:** Playful Modern Flat UI combined with 1930s "Rubber-Hose" Vintage cartoon mascots (like Cuphead).
- **Theme:** It's heavily inspired by modern Telegram Mini Apps / Web3 casual games. Soft rounded geometry, high legibility, soft pastel backgrounds with deep chocolate brown high-contrast elements.

## 2. Color Palette & Tokens
You can add these directly to your `tailwind.config.ts` to instantly match the vibe.

### Main Colors:
- **Blue (Accent):** `#64A1CC` *(Game timer pill, highlights)*
- **Dark Blue:** `#395D75` *(Primary typography & headers)*
- **Light Blue:** `#B1C7DB` *(Light board squares)*
- **Sky:** `#C2DCED` *(App screen backgrounds)*
- **Ice White:** `#ECF3F8` *(Canvas backgrounds & light cards)*
- **Bright White:** `#F9FBFD` *(Containers & white chess pieces)*

### Accent Colors:
- **Pink/Red:** `#D45C66` *(Resign button, alerts, losses)*
- **Orange:** `#D1725E` *(Primary Call-to-Action buttons, active tabs, draws)*
- **Yellow:** `#F5CA64` *(Star ratings, puzzle rewards)*
- **Gold:** `#B58E33` *(Trophies, rank highlights)*
- **Dark Brown:** `#3B2D27` *(Dark board squares, bottom nav bar, dark mode cards, body text)*
- **Green:** `#295E4E` *(Winrate charts, active status)*

## 3. Typography
- **Font Family:** `Alexandria` (Google Fonts). It's a geometric sans-serif that is highly readable but has a soft, approachable feel.
- **Weights:** Mostly uses `SemiBold` (600) for UI elements and buttons, `Bold` (700) for large display text, and `Regular` (400) for subtitles.

## 4. UI Elements & Tailwind Rules

> [!TIP]
> This design **does not** use heavy shadows or glassmorphism. It relies entirely on flat, solid colors with high contrast and extreme corner rounding.

- **Cards & Panels:** Use very soft, rounded corners. 
  - *Tailwind:* `rounded-2xl` or `rounded-[24px]`.
  - *Colors:* Either Ice White (`bg-[#ECF3F8]`) for normal panels, or Dark Brown (`bg-[#3B2D27]`) for premium/shop elements.
- **Buttons:** Fully rounded "pill" shapes. 
  - *Tailwind:* `rounded-full`.
  - *Primary Button:* `bg-[#D1725E] text-white font-semibold`.
  - *Secondary Button:* Outline style with `border-2 border-[#3B2D27] text-[#3B2D27]`.
- **Bottom Navigation:** A floating pill at the bottom (`rounded-full bg-[#3B2D27] text-white p-4`). The active tab uses a custom scalloped/starburst circle in Orange (`#D1725E`).

## 5. Chess Board & Pieces

- **The Board:**
  - **Flat 2D Grid:** Absolutely no 3D elements.
  - **Colors:** Light squares are `#B1C7DB` and Dark squares are `#3B2D27`.
  - **Coordinates:** Letters (a-h) and Numbers (1-8) are integrated directly inside the edge squares.
  - **Move Highlights:** Instead of coloring the whole square, it uses small solid white dots (`#F9FBFD`) in the center of the valid destination squares.
- **The Pieces:**
  - **Flat Vector Art:** Minimalist, recognizable silhouettes.
  - **White Pieces:** White fill (`#F9FBFD`) with a thick Dark Brown (`#3B2D27`) outer stroke/outline.
  - **Black Pieces:** Solid Dark Brown fill (`#3B2D27`) with thin white interior lines for detailing.
