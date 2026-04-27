# Sudoku Logic V1

A feature-rich, vanilla JavaScript Sudoku engine designed for both puzzle creation and solving. This tool allows users to generate unique puzzles with varying difficulties or manually build and validate their own Sudoku layouts.

## 🚀 Features

### 🧩 Game Engine
* **Dual Modes:**
   * **CREATE Mode:** Manually input digits to build a custom puzzle. Features real-time validation (Unique, Multiple Solutions, or No Solution).
   * **SOLVE Mode:** Play generated or custom-built puzzles with a timer and progress tracking.
* **Unique Puzzle Generation:** Recursive backtracking algorithm that ensures every generated puzzle has exactly one solution.
* **Multiple Grid Sizes:** Support for standard **9x9** (3x3 blocks) and **6x6** (2x3 blocks) layouts.
* **Difficulty Scaling:** Generate puzzles across three difficulty tiers: **Easy, Medium, and Hard**, with an active difficulty badge visible in both modes.

### 🛠 Tools & UX
* **Smart Pencil Marks:** Toggle pencil mode to note candidates. Features **Automatic Pencil Cleaning**—notes are removed from rows, columns, and blocks as you place correct digits.
* **Highlighter System:** 18-color palette to color-code cells for advanced solving techniques.
* **Conflict Detection:** Real-time red highlighting for rule violations.
* **Undo/Redo:** 50-state deep history stack for error correction.
* **Dark Mode:** Fully themed dark interface for low-light environments.
* **Win System:** Custom confetti animation and solve-time reporting upon completion.

### ⌨️ Keyboard Shortcuts
| Key | Action |
| :--- | :--- |
| **WASD / Arrows** | Navigate the grid |
| **1 - 9** | Input number |
| **0 / Backspace** | Erase cell |
| **N** | Toggle Pencil Mode (Solve Mode only) |
| **Z** | Undo |
| **Shift + Z** | Redo |

---

## 🛠 Technical Stack
* **HTML5** - Structured semantic layout.
* **CSS3** - Custom properties (variables) for theme switching and CSS Grid/Flexbox for the 3-column responsive layout.
* **JavaScript (ES6+)** - Pure Vanilla JS logic.

---

## 📥 Installation & Usage
No installation is required. This project runs entirely in the browser.

[https://mick-lockwood.github.io/SudokuLogic/]

or

1. Clone the repository.
2. Open `index.html` in any modern web browser.

---

## 📜 Development Baseline (V1.1.2)
- [x] Unique solution validator.
- [x] 6x6 and 9x9 geometry logic.
- [x] Persistent difficulty badge.
- [x] 3-column UI architecture.
- [x] Automatic pencil cleaning.
