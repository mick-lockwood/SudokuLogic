// src/ShiftEngine.js
import { State, saveState } from './GameState.js';
import { hasConflict } from './SudokuLogic.js';

window.AdvancedState = window.AdvancedState || {};

// Setup the internal drag state
window.AdvancedState.torusDrag = {
    active: false,
    startX: 0, startY: 0,
    axis: null, 
    index: null,
    accumulatedDelta: 0
};

// --- 1. ARRAY SHIFTING MATH ---
window.shiftRow = (r, dir, silent = false) => {
    if (State.paused || State.isWon) return false;
    for (let c = 0; c < State.size; c++) {
        if (State.lockedMap[r * State.size + c]) return false; // Abort if locked
    }

    if (!silent) saveState();
    let rowVals = [], rowGiven = [], rowNotes = [], rowColor = [];
    
    for (let c = 0; c < State.size; c++) {
        let idx = r * State.size + c;
        rowVals.push(State.board[idx].val);
        rowGiven.push(State.board[idx].given);
        rowNotes.push(State.board[idx].notes);
        rowColor.push(State.board[idx].color);
    }
    
    if (dir === 1) { 
        rowVals.unshift(rowVals.pop()); rowGiven.unshift(rowGiven.pop());
        rowNotes.unshift(rowNotes.pop()); rowColor.unshift(rowColor.pop());
    } else { 
        rowVals.push(rowVals.shift()); rowGiven.push(rowGiven.shift());
        rowNotes.push(rowNotes.shift()); rowColor.push(rowColor.shift());
    }
    
    for (let c = 0; c < State.size; c++) {
        let idx = r * State.size + c;
        State.board[idx].val = rowVals[c];
        State.board[idx].given = rowGiven[c];
        State.board[idx].notes = rowNotes[c];
        State.board[idx].color = rowColor[c];
    }
    
    // THE FIX: Only update the UI and check win if this is a real player move
    if (!silent) {
        if (typeof window.updateUI === 'function') window.updateUI();
        if (typeof window.checkAdvancedWin === 'function') window.checkAdvancedWin();
    }
    return true; // Report success to the scrambler
};

window.shiftCol = (c, dir, silent = false) => {
    if (State.paused || State.isWon) return false;
    for (let r = 0; r < State.size; r++) {
        if (State.lockedMap[r * State.size + c]) return false; 
    }

    if (!silent) saveState();
    let colVals = [], colGiven = [], colNotes = [], colColor = [];
    
    for (let r = 0; r < State.size; r++) {
        let idx = r * State.size + c;
        colVals.push(State.board[idx].val);
        colGiven.push(State.board[idx].given);
        colNotes.push(State.board[idx].notes);
        colColor.push(State.board[idx].color);
    }
    
    if (dir === 1) { 
        colVals.unshift(colVals.pop()); colGiven.unshift(colGiven.pop());
        colNotes.unshift(colNotes.pop()); colColor.unshift(colColor.pop());
    } else { 
        colVals.push(colVals.shift()); colGiven.push(colGiven.shift());
        colNotes.push(colNotes.shift()); colColor.push(colColor.shift());
    }
    
    for (let r = 0; r < State.size; r++) {
        let idx = r * State.size + c;
        State.board[idx].val = colVals[r];
        State.board[idx].given = colGiven[r];
        State.board[idx].notes = colNotes[r];
        State.board[idx].color = colColor[r];
    }
    
    if (!silent) {
        if (typeof window.updateUI === 'function') window.updateUI();
        if (typeof window.checkAdvancedWin === 'function') window.checkAdvancedWin();
    }
    return true;
};

// --- 2. DYNAMIC ARROW RENDERER ---
export const renderShiftArrows = () => {
    document.querySelectorAll('.shift-arrow').forEach(el => el.remove());
    if (!State.shiftMode) return;

    const wrapper = document.getElementById('grid-wrapper');
    const sampleCell = document.querySelector('.cell');
    if (!wrapper || !sampleCell) return;
    
    const cellSize = sampleCell.offsetWidth;
    const gap = 5; 

    for (let i = 0; i < State.size; i++) {
        let rowLocked = false, colLocked = false;
        for (let j = 0; j < State.size; j++) {
            if (State.lockedMap[i * State.size + j]) rowLocked = true;
            if (State.lockedMap[j * State.size + i]) colLocked = true;
        }

        // Row Arrows
        const topOffset = (i * cellSize) + (cellSize / 2) - 12; 
        const leftArr = document.createElement('div');
        leftArr.className = `shift-arrow ${rowLocked ? 'locked' : ''}`;
        leftArr.innerHTML = '◀';
        leftArr.style.left = `-${25 + gap}px`; leftArr.style.top = `${topOffset}px`;
        leftArr.style.width = '25px'; leftArr.style.height = '25px';
        if (!rowLocked) leftArr.onclick = () => window.shiftRow(i, -1);
        wrapper.appendChild(leftArr);

        const rightArr = document.createElement('div');
        rightArr.className = `shift-arrow ${rowLocked ? 'locked' : ''}`;
        rightArr.innerHTML = '▶';
        rightArr.style.right = `-${25 + gap}px`; rightArr.style.top = `${topOffset}px`;
        rightArr.style.width = '25px'; rightArr.style.height = '25px';
        if (!rowLocked) rightArr.onclick = () => window.shiftRow(i, 1);
        wrapper.appendChild(rightArr);

        // Column Arrows
        const leftOffset = (i * cellSize) + (cellSize / 2) - 12; 
        const upArr = document.createElement('div');
        upArr.className = `shift-arrow ${colLocked ? 'locked' : ''}`;
        upArr.innerHTML = '▲';
        upArr.style.top = `-${25 + gap}px`; upArr.style.left = `${leftOffset}px`;
        upArr.style.width = '25px'; upArr.style.height = '25px';
        if (!colLocked) upArr.onclick = () => window.shiftCol(i, -1);
        wrapper.appendChild(upArr);

        const downArr = document.createElement('div');
        downArr.className = `shift-arrow ${colLocked ? 'locked' : ''}`;
        downArr.innerHTML = '▼';
        downArr.style.bottom = `-${25 + gap}px`; downArr.style.left = `${leftOffset}px`;
        downArr.style.width = '25px'; downArr.style.height = '25px';
        if (!colLocked) downArr.onclick = () => window.shiftCol(i, 1);
        wrapper.appendChild(downArr);
    }
};

// --- 3. GESTURE TRACKER ---
window.addEventListener('pointerdown', (e) => {
    if (!State.shiftMode || State.paused || State.isWon) return;
    const target = e.target.closest('.cell');
    if (!target) return;

    const idStr = target.id.replace('cell-', '');
    const idx = parseInt(idStr);
    if (isNaN(idx)) return;

    window.AdvancedState.torusDrag = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        axis: null, 
        index: idx,
        r: Math.floor(idx / State.size),
        c: idx % State.size,
        accumulatedDelta: 0,
        cellSize: target.offsetWidth
    };
}, { passive: true });

window.addEventListener('pointermove', (e) => {
    const drag = window.AdvancedState.torusDrag;
    if (!drag.active) return;

    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;

    if (!drag.axis) {
        if (Math.abs(deltaX) > 10) drag.axis = 'row';
        else if (Math.abs(deltaY) > 10) drag.axis = 'col';
        else return; 
    }

    const threshold = drag.cellSize * 0.6; 

    if (drag.axis === 'row') {
        if (deltaX > threshold) {
            window.shiftRow(drag.r, 1);
            drag.startX = e.clientX; 
        } else if (deltaX < -threshold) {
            window.shiftRow(drag.r, -1);
            drag.startX = e.clientX;
        }
    } else if (drag.axis === 'col') {
        if (deltaY > threshold) {
            window.shiftCol(drag.c, 1);
            drag.startY = e.clientY;
        } else if (deltaY < -threshold) {
            window.shiftCol(drag.c, -1);
            drag.startY = e.clientY;
        }
    }
}, { passive: true });

window.addEventListener('pointerup', () => { window.AdvancedState.torusDrag.active = false; });
window.addEventListener('pointercancel', () => { window.AdvancedState.torusDrag.active = false; });

// --- 4. THE TORUS SCRAMBLER ---
window.generateTorusPuzzle = () => {
    const diffEl = document.getElementById('diff');
    const diff = diffEl ? diffEl.value : 'medium';
    
    // 1. Clear the board completely
    State.board.forEach(c => { c.val = 0; c.given = true; c.notes = []; c.color = null; });
    
    // 2. Backtracking Solver (Instantly builds a 100% valid, full grid)
    const solve = (idx) => {
        if (idx >= State.size * State.size) return true;
        if (State.board[idx].val !== 0) return solve(idx + 1);
        
        // Randomize digits to ensure unique puzzles every time
        let digits = [];
        for (let i = 1; i <= State.size; i++) digits.push(i);
        digits.sort(() => Math.random() - 0.5);
        
        for (let d of digits) {
            if (!hasConflict(State.board, idx, d)) {
                State.board[idx].val = d;
                if (solve(idx + 1)) return true;
            }
        }
        State.board[idx].val = 0;
        return false;
    };
    
    solve(0);
    
    // 3. Lock them as 'givens' so the player can't delete them, only shift them
    State.board.forEach(c => c.given = true);
    
    // 4. Scramble based on difficulty dropdown
    let targetShifts = 20; // easy
    if (diff === 'medium') targetShifts = 45;
    if (diff === 'hard') targetShifts = 100;
    
    let successfulShifts = 0;
    let attempts = 0; // Failsafe against infinite loops if the user locked too many cells
    
    // Invisibly fire the shift commands
    while (successfulShifts < targetShifts && attempts < 1000) {
        attempts++;
        const isRow = Math.random() > 0.5;
        const index = Math.floor(Math.random() * State.size);
        const dir = Math.random() > 0.5 ? 1 : -1;
        
        let success = false;
        // Notice the 'true' parameter! This tells the engine to shift silently.
        if (isRow) success = window.shiftRow(index, dir, true);
        else success = window.shiftCol(index, dir, true);
        
        if (success) successfulShifts++;
    }
    
    State.isWon = false;
    State.undoStack = []; 
    State.redoStack = [];
    
    // 5. Un-mute the UI and render the scrambled masterpiece!
    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof window.triggerAutosave === 'function') window.triggerAutosave();
};
