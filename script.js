let size = 9, bW = 3, bH = 3;
let mode = 'create', pencil = false, paused = false, isWon = false, darkMode = false;
let board = []; 
let timerVal = 0;
let timerInt = null;
let undoStack = [], redoStack = [];
let confettiActive = false; // Controls the animation loop
let currentDifficulty = 'medium'; // Tracks the active difficulty level
let selected = [];

// Highlighter Color Palette 
// (Laid out in rows of 3 to match the UI grid)
const colors = [
    // Standard Colors
    '#f59896', '#9cdcf9', '#dee787', // Row 1: Red/LightBlue/LightGreen
    '#fdc689', '#c7bbdc', '#fff799', // Row 2: Orange/Lavender/Yellow
    '#f6adcd', '#e7e7e8', '#c0e2ca', // Row 3: Pink/Grey/SageGreen
    // Vibrant Colors
    '#f16865', '#64c9f6', '#c4d42a', // Row 4: Vibrant Red/LightBlue/LightGreen
    '#fca74a', '#a693c7', '#fff02f', // Row 5: Vibrant Orange/Lavender/Yellow
    '#f17fb0', '#bdbdbf', '#8cca9e'  // Row 6: Vibrant Pink/Grey/SageGreen
];

function toggleDarkMode() {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    renderGrid();
    updateUI();
}

function setGridSize(s) {
    size = s; bW = 3; bH = (s === 6) ? 2 : 3;
    document.getElementById('size6').className = (s === 6) ? 'active' : '';
    document.getElementById('size9').className = (s === 9) ? 'active' : '';
    initBoard();
}

function initBoard() {
    board = Array.from({ length: size * size }, () => ({ val: 0, given: false, notes: [], color: null }));
    undoStack = []; 
    redoStack = [];
    selected = []; 
    isWon = false; 
    paused = false;
    resetTimer();
    document.getElementById('difficulty-badge').style.display = 'none';
    document.getElementById('win-overlay').style.display = 'none';
    document.getElementById('pause-overlay').style.display = 'none';
    renderGrid();
    renderNumpad();
    updateUI();
}

function initHighlighter() {
    const container = document.getElementById('highlighter-tools');
    if (!container) return;
    container.innerHTML = '';
    colors.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'color-btn'; btn.style.backgroundColor = c;
        btn.onclick = () => applyColor(c); container.appendChild(btn);
    });
}

function applyColor(c) {
    if (selected.length === 0 || isWon || paused) return;
    saveState(); 
    selected.forEach(idx => board[idx].color = c); 
    updateUI();
}

function clearAllHighlights() {
    if (isWon || paused) return;
    if (!board.some(c => c.color !== null)) return;
    if (!confirm("Clear all highlights?")) return;
    saveState(); board.forEach(c => c.color = null); updateUI();
}

function saveState(isUndoAction = false) {
    if (!isUndoAction) redoStack = [];
    undoStack.push(JSON.stringify(board));
    if (undoStack.length > 50) undoStack.shift();
}

function undo() {
    if (undoStack.length === 0 || paused || isWon) return;
    redoStack.push(JSON.stringify(board));
    board = JSON.parse(undoStack.pop()); updateUI();
}

function redo() {
    if (redoStack.length === 0 || paused || isWon) return;
    undoStack.push(JSON.stringify(board));
    board = JSON.parse(redoStack.pop()); updateUI();
}

function updateUI() {
    // Set the "primary" active cell as the last one clicked/dragged over
    const primaryActive = selected.length > 0 ? selected[selected.length - 1] : null;
    const selVal = primaryActive !== null ? board[primaryActive].val : 0;
    const selR = primaryActive !== null ? Math.floor(primaryActive / size) : -1;
    const selC = primaryActive !== null ? primaryActive % size : -1;
    const selBlockR = selR !== -1 ? Math.floor(selR / bH) : -1;
    const selBlockC = selC !== -1 ? Math.floor(selC / bW) : -1;
    const showSeen = document.getElementById('toggle-seen')?.checked ?? true;

    board.forEach((data, i) => {
        const el = document.getElementById(`cell-${i}`);
        if (!el) return;

        el.innerHTML = '';
        el.className = el.className.split(' ').filter(c => !['selected', 'highlight', 'match', 'given', 'user', 'error'].includes(c)).join(' ');

        const r = Math.floor(i / size), c = i % size;
        const blockR = Math.floor(r / bH), blockC = Math.floor(c / bW);

        let tint = "rgba(255, 255, 255, 0)"; 
        
        // Changed to check if 'i' is inside the array
        if (selected.includes(i)) {
            el.classList.add('selected');
            tint = darkMode ? "rgba(56, 189, 248, 0.5)" : "rgba(52, 152, 219, 0.4)"; 
        } else if (showSeen && (r === selR || c === selC || (blockR === selBlockR && blockC === selBlockC))) {
            el.classList.add('highlight');
            tint = darkMode ? "rgba(56, 189, 248, 0.15)" : "rgba(52, 152, 219, 0.1)"; 
        } else if (selVal !== 0 && data.val === selVal) {
            el.classList.add('match');
            tint = darkMode ? "rgba(74, 222, 128, 0.4)" : "rgba(46, 204, 113, 0.3)"; 
        }

        let highlightBase = data.color || (darkMode ? "#1e293b" : "white");
        el.style.background = `linear-gradient(${tint}, ${tint}), ${highlightBase}`;

        if (data.val !== 0) {
            el.textContent = data.val;
            el.classList.add(data.given ? 'given' : 'user');
            if (hasConflict(board, i, data.val)) el.classList.add('error');
        } else if (data.notes.length > 0) {
            const pGrid = document.createElement('div');
            pGrid.className = 'pencil-grid';
            for(let n=1; n<=9; n++) {
                const nDiv = document.createElement('div'); nDiv.className = 'pencil-num';
                if (data.notes.includes(n)) {
                    nDiv.textContent = n;
                    if (hasConflict(board, i, n)) nDiv.classList.add('error');
                }
                pGrid.appendChild(nDiv);
            }
            el.appendChild(pGrid);
        }
    });
    if (mode === 'create') validateStatus();
    renderNumpad();
}

function renderGrid() {
    const container = document.getElementById('grid');
    container.innerHTML = '';
// SMART FIX: Force the container to only be as wide as the cells
    container.style.display = 'grid';
    container.style.width = 'fit-content'; 
    container.style.gridTemplateColumns = `repeat(${size}, var(--cell-size))`;
    
    const gridLine = darkMode ? "#ffffff" : "#1e293b";
    const wrapper = document.getElementById('grid-wrapper');
    
    wrapper.style.background = gridLine;
    wrapper.style.width = 'fit-content'; // Prevents the 'white wings' on the sides
    wrapper.style.margin = '0 auto';     // Centers it
    
    container.style.background = gridLine;

    board.forEach((cell, i) => {
        const div = document.createElement('div');
        div.className = 'cell'; 
        div.id = `cell-${i}`;

        // SET THE BASE INTERNAL LINE (Thin)
        // Using a solid color for precision, or rgba for a subtler look
        div.style.border = `1px solid ${gridLine}`;
        
        const r = Math.floor(i / size), c = i % size;
        
        // Visual logic for the thicker grid lines
        if ((c + 1) % bW === 0 && c < size - 1) div.style.borderRight = `3px solid ${gridLine}`;
        if ((r + 1) % bH === 0 && r < size - 1) div.style.borderBottom = `3px solid ${gridLine}`;
  
        // Pointer event listeners for selection and dragging
        div.addEventListener('pointerdown', (e) => {
            if (paused || isWon) return;
            // releasePointerCapture allows 'pointerenter' to fire on sibling elements while dragging
            e.target.releasePointerCapture(e.pointerId); 
            handleCellSelection(i, e.ctrlKey || e.metaKey, false);
        });

        div.addEventListener('pointerenter', (e) => {
            if (paused || isWon) return;
            // e.buttons === 1 ensures the primary button/finger is held down
            if (e.buttons === 1) { 
                handleCellSelection(i, true, true); 
            }
        });

        // Prevent default context menu if they try to right-click drag
        div.addEventListener('contextmenu', (e) => e.preventDefault());

        container.appendChild(div);
    });
}

function handleCellSelection(index, isMulti, isDragging) {
    if (isMulti) {
        if (!selected.includes(index)) {
            selected.push(index);
        } else if (!isDragging) {
            // If CTRL+clicking an already selected cell, deselect it
            selected = selected.filter(id => id !== index);
        }
    } else {
        selected = [index]; 
    }
    updateUI();
}

function renderNumpad() {
    const pad = document.getElementById('numpad'); pad.innerHTML = '';
    const row1 = document.createElement('div'); row1.className = 'numpad-row';
    for (let i = 1; i <= size; i++) {
        const b = document.createElement('button'); b.className = 'n-btn'; b.textContent = i;
        if (getCount(i) >= size) b.disabled = true;
        b.onclick = () => handleInput(i); row1.appendChild(b);
    }
    pad.appendChild(row1);

    const row2 = document.createElement('div'); row2.className = 'numpad-row';
    const btns = [
        { text: 'Undo\n(Z)', action: undo, disabled: undoStack.length === 0 },
        { text: 'Redo\n(Shift Z)', action: redo, disabled: redoStack.length === 0 },
        { text: pencil ? 'Pencil ON\n(N)' : 'Pencil OFF\n(N)', action: () => { pencil = !pencil; renderNumpad(); }, solveOnly: true, isPencil: true },
        { text: 'Erase\n(0)', action: () => handleInput(0), danger: true }
    ];

    btns.forEach(cfg => {
        if (cfg.solveOnly && mode !== 'solve') return;
        const b = document.createElement('button');
        b.className = 'n-btn'; b.style.width = '85px'; b.style.fontSize = '10px';
        b.innerText = cfg.text;
        if (cfg.disabled || isWon) b.disabled = true;
        if (cfg.danger) b.style.color = 'var(--danger)';
        if (cfg.isPencil && pencil) b.classList.add('pencil-active');
        b.onclick = cfg.action;
        row2.appendChild(b);
    });
    pad.appendChild(row2);
}

function handleInput(num) {
    if (selected.length === 0 || paused || isWon) return;
    
    saveState(); // Save state once for the entire multi-cell action
    
    selected.forEach(idx => {
        const cell = board[idx];
        if (mode === 'solve' && cell.given) return;
        
        if (pencil && mode === 'solve' && num !== 0) {
            if (cell.val !== 0) return;
            const pos = cell.notes.indexOf(num);
            if (pos > -1) cell.notes.splice(pos, 1); else cell.notes.push(num);
        } else {
            cell.val = num; 
            cell.notes = [];
            cell.given = (mode === 'create' && num !== 0);
            
            // FIX: Automatic Pencil Cleaning
            if (mode === 'solve' && num !== 0) {
                cleanPencilsAfterMove(idx, num);
            }
        }
    });

    updateUI();
    if (mode === 'solve') checkWin();
}

// Logic for auto-deleting pencils in the same row, col, and box
function cleanPencilsAfterMove(idx, val) {
    const r = Math.floor(idx / size), c = idx % size;
    const br = Math.floor(r / bH) * bH, bc = Math.floor(c / bW) * bW;

    board.forEach((cell, i) => {
        const tr = Math.floor(i / size), tc = i % size;
        if (tr === r || tc === c || (tr >= br && tr < br + bH && tc >= bc && tc < bc + bW)) {
            const noteIdx = cell.notes.indexOf(val);
            if (noteIdx > -1) cell.notes.splice(noteIdx, 1);
        }
    });
}

function handleClearBoard() {
    if (!confirm("Reset entire board?")) return;
    saveState();
    if (mode === 'create') initBoard();
    else { board.forEach(c => { if(!c.given) { c.val = 0; c.notes = []; c.color = null; } }); updateUI(); }
}

function clearUserInputs() {
    if (!confirm("Clear user inputs?")) return;
    saveState(); board.forEach(c => { if(!c.given) c.val = 0; }); updateUI();
}

function cleanAllPencils() {
    saveState(); board.forEach(c => c.notes = []); updateUI();
}

function getCount(num) { return board.filter((c, i) => c.val === num && !hasConflict(board, i, num)).length; }

function hasConflict(arr, idx, val) {
    if (val === 0) return false;
    const r = Math.floor(idx / size), c = idx % size, br = Math.floor(r / bH) * bH, bc = Math.floor(c / bW) * bW;
    for (let i = 0; i < size * size; i++) {
        if (i === idx || arr[i].val !== val) continue;
        const tr = Math.floor(i / size), tc = i % size;
        if (tr === r || tc === c || (tr >= br && tr < br+bH && tc >= bc && tc < bc+bW)) return true;
    }
    return false;
}

function setAppMode(m) {
    // 1. Guard Clause: Do nothing if already in this mode
    if (m === mode) return;
    
    // 2. Gatekeeper: Only show confirm if moving from Solve -> Create AND game isn't already won
    if (mode === 'solve' && m === 'create' && !isWon) {
        if (!confirm("Switching to Create Mode will reset the current puzzle and wipe your progress. Do you want to continue?")) {
            return; // User hit cancel, exit function here. Everything stays as is.
        }
    }

    // 3. Update State
    mode = m; 
    
    // 4. Update UI Buttons & Visibility
    document.getElementById('modeCreate').classList.toggle('active', m === 'create');
    document.getElementById('modeSolve').classList.toggle('active', m === 'solve');
    
    // Toggle visibility of various game elements
    const isCreate = (m === 'create');
    document.getElementById('gen-controls').style.display = isCreate ? 'flex' : 'none';
    document.getElementById('size-selector').style.display = isCreate ? 'flex' : 'none';
    document.getElementById('timer').style.display = isCreate ? 'none' : 'block';
    document.getElementById('pause-btn').style.display = isCreate ? 'none' : 'block';
    document.getElementById('clean-pencils-link').style.display = isCreate ? 'none' : 'inline';
    
    // 5. Manage Timer and Board State
    if (m === 'solve') {
        resetTimer(); 
        startTimer(); 
        // Note: We don't call initBoard here because usually you're 
        // entering solve mode with an existing puzzle from create mode.
    } else {
        resetTimer(); 
        initBoard(); // Only wipes the board if they actually move to Create mode
    }

    updateUI();
}

// Centralized Timer Management
function resetTimer() {
    if (timerInt) clearInterval(timerInt);
    timerInt = null;
    timerVal = 0;
    document.getElementById('timer').textContent = "00:00";
}

function startTimer() {
    // 1. Kill any existing interval to prevent "fighting" loops
    if (timerInt) clearInterval(timerInt);
    
    // 2. Immediate UI sync (don't wait 1s for the first tick)
    const updateDisplay = () => {
        const m = Math.floor(timerVal / 60).toString().padStart(2, '0');
        const s = (timerVal % 60).toString().padStart(2, '0');
        document.getElementById('timer').textContent = `${m}:${s}`;
    };
    
    updateDisplay();

    // 3. Start the single source of truth interval
    timerInt = setInterval(() => {
        if (!paused && !isWon) { // Only increment if the game is active
            timerVal++;
            updateDisplay();
        }
    }, 1000);
}

// FIX: Unique Puzzle Indicator Logic
function countSolutions(boardArray, count = 0) {
    let pos = boardArray.indexOf(0);
    if (pos === -1) return count + 1;

    // Use 'size' instead of '9'
    for (let n = 1; n <= size; n++) { 
        if (!hasConflictGen(boardArray, pos, n)) {
            boardArray[pos] = n;
            count = countSolutions(boardArray, count);
            boardArray[pos] = 0;
            if (count > 1) return count; 
        }
    }
    return count;
}

function togglePause() { paused = !paused; document.getElementById('pause-overlay').style.display = paused ? 'flex' : 'none'; if (!paused) startTimer(); else clearInterval(timerInt); }

function validateStatus() {
    const label = document.getElementById('status-label');
    const currentBoard = board.map(c => c.val);
    const filledCount = currentBoard.filter(v => v !== 0).length;

    if (filledCount === 0) {
        label.textContent = "Enter Digits...";
        label.style.color = "var(--text-main)";
        return;
    }

    const solutions = countSolutions([...currentBoard]);
    if (solutions === 1) {
        label.textContent = "Unique Puzzle";
        label.style.color = "var(--success)";
    } else if (solutions > 1) {
        label.textContent = "Multiple Solutions";
        label.style.color = "#f1c40f"; // Yellow warning
    } else {
        label.textContent = "No Valid Solution";
        label.style.color = "var(--danger)";
    }
}

// FIX: Improved Generate Logic with Uniqueness Check
function generateNew() {
    resetTimer(); // STOP and RESET before doing heavy generation logic
    initBoard();
    let flat = Array(size * size).fill(0);
    
    currentDifficulty = document.getElementById('diff').value;
    document.getElementById('difficulty-badge').textContent = currentDifficulty;
    document.getElementById('difficulty-badge').style.display = 'inline-block';
        
    // 1. Fill a complete valid board
    const fill = (idx) => {
        if (idx === size * size) return true;
        let nums = Array.from({length: size}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
        for (let n of nums) {
            if (!hasConflictGen(flat, idx, n)) {
                flat[idx] = n;
                if (fill(idx + 1)) return true;
                flat[idx] = 0;
            }
        }
        return false;
    };
    fill(0);

    // 2. Remove numbers based on difficulty while checking uniqueness
    const diff = document.getElementById('diff').value;
    const totalCells = size * size;

    // Easy: ~45% empty | Medium: ~55% empty | Hard: ~65% empty
    const percentage = diff === 'easy' ? 0.45 : (diff === 'medium' ? 0.55 : 0.65);
    const targetEmpty = Math.floor(totalCells * percentage);

    let removed = 0;
    let indices = Array.from({length: size * size}, (_, i) => i).sort(() => Math.random() - 0.5);

    for (let i of indices) {
        if (removed >= targetEmpty) break;
        let backup = flat[i];
        flat[i] = 0;
        
        // Count solutions to ensure it's still unique
        if (countSolutions([...flat]) !== 1) {
            flat[i] = backup; 
        } else {
            removed++;
        }
    }

    // Apply the generated flat array to the actual game board
    flat.forEach((v, i) => { 
        board[i].val = v; 
        board[i].given = (v !== 0); 
    });

    updateUI();

    // Start the timer ONLY if we are in solve mode and the board is ready
    if (mode === 'solve') {
        startTimer(); 
    }
}

function hasConflictGen(arr, idx, val) {
    const r = Math.floor(idx / size);
    const c = idx % size;

    // BOX DIMENSIONS: 9x9 uses 3x3, 6x6 uses 2x3
    const boxHeight = (size === 6) ? 2 : 3;
    const boxWidth = (size === 6) ? 3 : 3;

    const br = Math.floor(r / boxHeight) * boxHeight;
    const bc = Math.floor(c / boxWidth) * boxWidth;

    for (let i = 0; i < size; i++) {
        // 1. Check Row
        if (arr[r * size + i] === val) return true;
        // 2. Check Column
        if (arr[i * size + c] === val) return true;
        
        // 3. Check Box (Rectangular or Square)
        let boxRow = br + Math.floor(i / boxWidth);
        let boxCol = bc + (i % boxWidth);
        if (arr[boxRow * size + boxCol] === val) return true;
    }
    return false;
}

function checkWin() {
    if (board.every(c => c.val !== 0) && !board.some((_, i) => hasConflict(board, i, board[i].val))) {
        isWon = true; 
        if (timerInt) clearInterval(timerInt); // Cleanly stop the loop on win
        document.getElementById('final-time').textContent = `Final Time: ${document.getElementById('timer').textContent}`;
        document.getElementById('win-overlay').style.display = 'flex';
        fireConfetti(); // Ensure the animation starts
    }
}

function generateWithDiff(s, d) {
    size = s; 
    bW = 3; 
    bH = (s === 6) ? 2 : 3;
    document.getElementById('size6').className = (s === 6) ? 'active' : '';
    document.getElementById('size9').className = (s === 9) ? 'active' : '';
    document.getElementById('diff').value = d;
    
    if (mode !== 'solve') setAppMode('solve');
    generateNew();
}

function restartSameLevel() {
    board.forEach(c => { if (!c.given) { c.val = 0; c.notes = []; c.color = null; } });
    document.getElementById('win-overlay').style.display = 'none';
    isWon = false; 
    paused = false; 
    
    resetTimer(); // Clean the clock
    startTimer(); // Start fresh 
    
    updateUI();
}

function hideWinOverlay() {
    stopConfetti();
    document.getElementById('win-overlay').style.display = 'none';
    document.getElementById('return-win-btn').style.display = 'block';
}

function showWinOverlay() {
    document.getElementById('win-overlay').style.display = 'flex';
    document.getElementById('return-win-btn').style.display = 'none';
}

function exitToCreate() { 
       setAppMode('create'); 
}

window.addEventListener('keydown', (e) => {
    if (paused || isWon) return;
    const key = e.key.toLowerCase();
    
    if (['w','a','s','d'].includes(key) || key.includes('arrow')) {
        e.preventDefault();
        
        // Find the starting point based on the last selected cell
        let current = selected.length > 0 ? selected[selected.length - 1] : 0;
        let r = Math.floor(current / size), c = current % size;
        
        if ((key === 'w' || key === 'arrowup') && r > 0) r--;
        if ((key === 's' || key === 'arrowdown') && r < size - 1) r++;
        if ((key === 'a' || key === 'arrowleft') && c > 0) c--;
        if ((key === 'd' || key === 'arrowright') && c < size - 1) c++;
        
        // Reset to a single selection upon keyboard movement
        selected = [r * size + c];
        updateUI();
    }
    if (e.key >= '1' && e.key <= size.toString()) handleInput(parseInt(e.key));
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') handleInput(0);
    if (key === 'z') { if (e.shiftKey) redo(); else undo(); }
    if (key === 'n' && mode === 'solve') { pencil = !pencil; renderNumpad(); }
});

function fireConfetti() {
    const canvas = document.getElementById('confetti');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight;
    let particles = [];
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
    
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width, 
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4, 
            color: colors[Math.floor(Math.random() * colors.length)],
            velX: Math.random() * 4 - 2, 
            velY: Math.random() * 10 + 5, 
            angle: Math.random() * 360
        });
    }
    confettiActive = true;
    function draw() {
        if (!confettiActive) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p, i) => {
            p.y += p.velY; p.x += p.velX; p.angle += 5;
            ctx.save(); 
            ctx.translate(p.x, p.y); 
            ctx.rotate(p.angle * Math.PI / 180);
            ctx.fillStyle = p.color; 
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); 
            ctx.restore();
            if (p.y > canvas.height) particles[i].y = -20;
        });
        requestAnimationFrame(draw);
    }
    draw();
}

function stopConfetti() {
    confettiActive = false;
    const canvas = document.getElementById('confetti');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Start the app
window.onload = function() {
    console.log("App starting..."); // This will show in your console to confirm JS is running
    initHighlighter();
    setGridSize(9); 
    // Force a UI update to be sure
    updateUI();
};
