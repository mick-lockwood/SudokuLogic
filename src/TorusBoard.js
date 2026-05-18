// src/TorusBoard.js
import { State } from './GameState.js';
import { shiftRow, shiftCol } from './ShiftEngine.js';
import { hasConflict } from './SudokuLogic.js';

window.TorusState = {
    dragActive: false,
    startX: 0, startY: 0,
    axis: null,
    index: null,
    elements: [],
    ghosts: [],
    cellSize: 52
};

export const renderTorusBoard = () => {
    const container = document.getElementById('torus-grid');
    if (!container || !State.shiftMode) return;

    // We still need the raw cell size for the drag/swipe threshold physics
    const sampleCell = document.querySelector('.cell');
    window.TorusState.cellSize = sampleCell ? sampleCell.offsetWidth : 52;

    const showErrors = document.getElementById('toggle-errors')?.checked ?? true;

    container.innerHTML = '';

    for (let i = 0; i < State.size * State.size; i++) {
        const r = Math.floor(i / State.size);
        const c = i % State.size;
        const cellData = State.board[i];

        const tile = document.createElement('div');
        tile.className = 'torus-tile';
        tile.id = `torus-tile-${i}`;
        
        // --- THE MAGNETIC ALIGNMENT FIX ---
        // Tiles instantly snap to the exact coordinates of the classic grid, 
        // completely eliminating alignment bugs when perimeter clues or 6x6 are toggled!
        const classicCell = document.getElementById(`cell-${i}`);
        if (classicCell) {
            tile.style.top = `${classicCell.offsetTop}px`;
            tile.style.left = `${classicCell.offsetLeft}px`;
            tile.style.width = `${classicCell.offsetWidth}px`;
            tile.style.height = `${classicCell.offsetHeight}px`;
        }
        // ----------------------------------

        if (c % State.bW === State.bW - 1 && c !== State.size - 1) tile.classList.add('thick-right');
        if (r % State.bH === State.bH - 1 && r !== State.size - 1) tile.classList.add('thick-bottom');
        if (c === 0) tile.classList.add('thick-left');
        if (r === 0) tile.classList.add('thick-top');

        if (cellData.given) tile.classList.add('given');
        else if (cellData.val !== 0) tile.classList.add('user');

        if (cellData.val !== 0) {
            tile.innerText = cellData.val;
            if (showErrors && hasConflict(State.board, i, cellData.val)) {
                tile.classList.add('error');
            }
        }

        // Restore Tile Selection Highlights
        let tint = "transparent";
        if (State.selected.includes(i)) {
            tint = State.darkMode ? "rgba(56, 189, 248, 0.5)" : "rgba(52, 152, 219, 0.4)"; 
            const selBorder = State.darkMode ? "#74b9ff" : "#3498db";
            tile.style.boxShadow = `inset 0 0 0 2px ${selBorder}`;
        }
        
        if (cellData.color) {
            const base = cellData.color;
            tile.style.background = `linear-gradient(${tint}, ${tint}), ${base}`;
        } else {
            tile.style.background = `linear-gradient(${tint}, ${tint}), var(--card-bg)`;
        }

        if (State.lockedMap && State.lockedMap[i]) {
            tile.style.boxShadow = `inset 0 0 0 3px rgba(255, 255, 255, 0.4), inset 0 0 10px rgba(0,0,0,0.5)`;
            tile.innerHTML += `<div style="position: absolute; top: 2px; right: 4px; font-size: 10px; opacity: 0.5; pointer-events: none;">🔒</div>`;
        }

        tile.addEventListener('pointerdown', (e) => {
            if (State.paused || State.isWon) return;
            e.target.releasePointerCapture(e.pointerId); 
            if (typeof window.handleCellSelection === 'function') {
                window.handleCellSelection(i, e.ctrlKey || e.metaKey, false);
            }
        });

        tile.addEventListener('pointerenter', (e) => {
            if (State.paused || State.isWon) return;
            if (e.buttons === 1 && typeof window.handleCellSelection === 'function') { 
                window.handleCellSelection(i, true, true); 
            }
        });

        tile.addEventListener('contextmenu', (e) => e.preventDefault());

        container.appendChild(tile);
    }
};

// --- GESTURE PHYSICS & GHOST TILES ---

const getDragElements = (axis, index) => {
    const els = [];
    for (let i = 0; i < State.size; i++) {
        const idx = axis === 'row' ? (index * State.size + i) : (i * State.size + index);
        els.push(document.getElementById(`torus-tile-${idx}`));
    }
    return els;
};

// Creates a visual clone of a tile to wrap around the edges
const createGhost = (originalEl, axis, direction, cs) => {
    const ghost = originalEl.cloneNode(true);
    ghost.id = ''; 
    ghost.style.zIndex = '15'; 
    
    const currentLeft = parseFloat(originalEl.style.left);
    const currentTop = parseFloat(originalEl.style.top);
    
    if (axis === 'row') {
        ghost.style.left = direction === 1 ? `${currentLeft - (State.size * cs)}px` : `${currentLeft + (State.size * cs)}px`;
    } else {
        ghost.style.top = direction === 1 ? `${currentTop - (State.size * cs)}px` : `${currentTop + (State.size * cs)}px`;
    }
    
    document.getElementById('torus-grid').appendChild(ghost);
    return ghost;
};

document.addEventListener('pointerdown', (e) => {
    if (!State.shiftMode || State.paused || State.isWon) return;
    
    // --- THE FIX: DISABLE SLIDING IN CREATE MODE ---
    if (State.mode === 'create') return;
    // ----------------------------------------------
    
    const target = e.target.closest('.torus-tile');
    if (!target) return;

    const idx = parseInt(target.id.replace('torus-tile-', ''));
    if (isNaN(idx)) return;

    window.TorusState = {
        dragActive: true,
        startX: e.clientX, startY: e.clientY,
        axis: null, index: idx,
        r: Math.floor(idx / State.size), c: idx % State.size,
        elements: [], ghosts: [],
        cellSize: window.TorusState.cellSize
    };
}, { passive: true });

document.addEventListener('pointermove', (e) => {
    const drag = window.TorusState;
    if (!drag.dragActive) return;

    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;

    // 1. Lock into an Axis
    if (!drag.axis) {
        if (Math.abs(deltaX) > 10) {
            drag.axis = 'row'; drag.elements = getDragElements('row', drag.r);
        } else if (Math.abs(deltaY) > 10) {
            drag.axis = 'col'; drag.elements = getDragElements('col', drag.c);
        } else return; 

        // Abort if locked
        let isLocked = false;
        for (let i = 0; i < State.size; i++) {
            if (drag.axis === 'row' && State.lockedMap[drag.r * State.size + i]) isLocked = true;
            if (drag.axis === 'col' && State.lockedMap[i * State.size + drag.c]) isLocked = true;
        }
        if (isLocked) { drag.dragActive = false; return; }

        drag.elements.forEach(el => el.style.zIndex = '20');
    }

    const cs = drag.cellSize;
    const threshold = cs; 

    // 2. Generate Ghosts on the fly
    if (drag.ghosts.length === 0) {
        const dir = (drag.axis === 'row' ? deltaX : deltaY) > 0 ? 1 : -1;
        drag.elements.forEach(el => drag.ghosts.push(createGhost(el, drag.axis, dir, cs)));
    }

    // 3. Move Elements & Ghosts
    if (drag.axis === 'row') {
        drag.elements.forEach(el => el.style.transform = `translateX(${deltaX}px)`);
        drag.ghosts.forEach(el => el.style.transform = `translateX(${deltaX}px)`);

        if (Math.abs(deltaX) >= threshold) {
            const dir = deltaX > 0 ? 1 : -1;
            
            drag.elements.forEach(el => { el.style.transform = 'translate(0, 0)'; el.style.zIndex = ''; });
            drag.ghosts.forEach(ghost => ghost.remove());
            drag.ghosts = [];

            shiftRow(drag.r, dir); 
            
            drag.startX += (dir * threshold); 
            drag.elements = getDragElements('row', drag.r); 
            drag.elements.forEach(el => { el.style.zIndex = '20'; el.style.transform = `translateX(${e.clientX - drag.startX}px)`; });
        }
    } else {
        drag.elements.forEach(el => el.style.transform = `translateY(${deltaY}px)`);
        drag.ghosts.forEach(el => el.style.transform = `translateY(${deltaY}px)`);

        if (Math.abs(deltaY) >= threshold) {
            const dir = deltaY > 0 ? 1 : -1;
            
            drag.elements.forEach(el => { el.style.transform = 'translate(0, 0)'; el.style.zIndex = ''; });
            drag.ghosts.forEach(ghost => ghost.remove());
            drag.ghosts = [];

            shiftCol(drag.c, dir);
            
            drag.startY += (dir * threshold);
            drag.elements = getDragElements('col', drag.c);
            drag.elements.forEach(el => { el.style.zIndex = '20'; el.style.transform = `translateY(${e.clientY - drag.startY}px)`; });
        }
    }
}, { passive: true });

// 4. Spring Back Physics
const endDrag = () => {
    const drag = window.TorusState;
    if (drag.dragActive && drag.elements) {
        drag.elements.forEach(el => {
            el.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
            el.style.transform = 'translate(0px, 0px)';
            setTimeout(() => { el.style.transition = ''; el.style.zIndex = ''; }, 150);
        });
        drag.ghosts.forEach(ghost => {
            ghost.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
            ghost.style.transform = 'translate(0px, 0px)';
            setTimeout(() => ghost.remove(), 150);
        });
    }
    drag.dragActive = false;
    drag.ghosts = [];
};

document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
