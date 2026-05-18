// src/ShiftEngine.js
import { State, saveState } from './GameState.js';

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
window.shiftRow = (r, dir) => {
    if (State.paused || State.isWon) return;
    
    for (let c = 0; c < State.size; c++) {
        if (State.lockedMap[r * State.size + c]) return; 
    }

    saveState();
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
    
    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof window.checkAdvancedWin === 'function') window.checkAdvancedWin();
};

window.shiftCol = (c, dir) => {
    if (State.paused || State.isWon) return;
    
    for (let r = 0; r < State.size; r++) {
        if (State.lockedMap[r * State.size + c]) return; 
    }

    saveState();
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
    
    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof window.checkAdvancedWin === 'function') window.checkAdvancedWin();
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
