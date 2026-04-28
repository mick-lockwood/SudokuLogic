// src/GameState.js

export const State = {
    size: 9, bW: 3, bH: 3,
    mode: 'create', 
    pencil: false, paused: false, isWon: false, darkMode: false,
    isPlayOnly: false,
    board: [], 
    timerVal: 0, timerInt: null,
    undoStack: [], redoStack: [], selected: [],
    currentDifficulty: 'medium',
    variants: [],
    solution: [],
    showGhost: false,
    antiKnight: false,

    // Highlighter Color Palette 
    // (Laid out in rows of 3 to match the UI grid)
        colors: [
        // Standard Colors
        '#f59896', '#9cdcf9', '#dee787', // Row 1: Red/LightBlue/LightGreen
        '#fdc689', '#c7bbdc', '#fff799', // Row 2: Orange/Lavender/Yellow
        '#f6adcd', '#e7e7e8', '#c0e2ca', // Row 3: Pink/Grey/SageGreen
        
        'divider', // Special keyword for the UI renderer
        
        // Vibrant Colors
        '#f16865', '#64c9f6', '#c4d42a', // Row 4: Vibrant Red/LightBlue/LightGreen
        '#fca74a', '#a693c7', '#fff02f', // Row 5: Vibrant Orange/Lavender/Yellow
        '#f17fb0', '#bdbdbf', '#8cca9e'  // Row 6: Vibrant Pink/Grey/SageGreen
    ]
};

export function initBoardState(sizeParam) {
    State.size = sizeParam;
    State.bW = 3;
    State.bH = (sizeParam === 6) ? 2 : 3;
    State.isPlayOnly = false;
    State.board = Array.from({ length: State.size * State.size }, () => ({ val: 0, given: false, notes: [], color: null }));
    State.undoStack = []; 
    State.redoStack = [];
    State.selected = []; 
    State.isWon = false; 
    State.paused = false;
    State.solution = [];
    State.showGhost = false;
    State.antiKnight = false;
    
}

export function saveState(isUndoAction = false) {
    if (!isUndoAction) State.redoStack = [];
    State.undoStack.push(JSON.stringify(State.board));
    if (State.undoStack.length > 50) State.undoStack.shift();
}

export function undo() {
    if (State.undoStack.length === 0 || State.paused || State.isWon) return false;
    State.redoStack.push(JSON.stringify(State.board));
    State.board = JSON.parse(State.undoStack.pop());
    return true; // Returns true so the UI knows it needs to re-render
}

export function redo() {
    if (State.redoStack.length === 0 || State.paused || State.isWon) return false;
    State.undoStack.push(JSON.stringify(State.board));
    State.board = JSON.parse(State.redoStack.pop());
    return true;
}
