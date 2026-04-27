import { State, initBoardState, saveState, undo, redo } from './GameState.js';
import { hasConflict, cleanPencilsAfterMove, countSolutions, hasConflictGen } from './SudokuLogic.js';
import * as Renderer from './Renderer.js';

window.confettiActive = false;

// --- EXPOSE FUNCTIONS TO WINDOW FOR HTML INLINE ONCLICKS ---
window.updateUI = Renderer.updateUI;
window.applyColor = applyColor;
window.triggerUndo = () => { if(undo()) Renderer.updateUI(); };
window.triggerRedo = () => { if(redo()) Renderer.updateUI(); };
window.handleInput = handleInput;
window.handleCellSelection = handleCellSelection;

window.toggleDarkMode = () => {
    State.darkMode = !State.darkMode;
    document.body.classList.toggle('dark-mode', State.darkMode);
    Renderer.renderGrid();
    Renderer.updateUI();
};

window.setGridSize = (s) => {
    initBoardState(s);
    document.getElementById('size6').className = (s === 6) ? 'active' : '';
    document.getElementById('size9').className = (s === 9) ? 'active' : '';
    initAppBoard();
};

window.setAppMode = (m) => {
    if (m === State.mode) return;
    if (State.isPlayOnly && m === 'create') return;

    State.mode = m;
    document.getElementById('modeCreate').classList.toggle('active', m === 'create');
    document.getElementById('modeSolve').classList.toggle('active', m === 'solve');
    
    const isCreate = (m === 'create');
    document.getElementById('gen-controls').style.display = isCreate ? 'flex' : 'none';
    document.getElementById('size-selector').style.display = isCreate ? 'flex' : 'none';
    document.getElementById('timer').style.display = isCreate ? 'none' : 'block';
    document.getElementById('pause-btn').style.display = isCreate ? 'none' : 'block';
    document.getElementById('clean-pencils-link').style.display = isCreate ? 'none' : 'inline';
    
    if (m === 'solve') {
        startTimer(); 
    } else {
        // --- NEW CLEANUP FOR CREATE MODE ---
        State.isWon = false; // Unlock inputs
        document.getElementById('win-overlay').style.display = 'none'; // Hide the win menu
        Renderer.stopConfetti(); // Stop any active celebration
        
        if (State.timerInt) clearInterval(State.timerInt);
        resetTimer();
    }

    Renderer.updateUI();
};

window.togglePause = () => {
    State.paused = !State.paused; 
    document.getElementById('pause-overlay').style.display = State.paused ? 'flex' : 'none'; 
    if (!State.paused) startTimer(); else clearInterval(State.timerInt);
};

window.generateNew = generateNew;
window.generateWithDiff = (s, d) => {
    window.setGridSize(s);
    document.getElementById('diff').value = d;
    if (State.mode !== 'solve') window.setAppMode('solve');
    generateNew();
};

window.toggleGhost = () => {
    if (State.mode !== 'create') return;
    State.showGhost = !State.showGhost;
    Renderer.updateUI();
};

window.handleClearBoard = () => {
    if (!confirm("Reset entire board?")) return;
    saveState();
    if (State.mode === 'create') initAppBoard();
    else { State.board.forEach(c => { if(!c.given) { c.val = 0; c.notes = []; c.color = null; } }); Renderer.updateUI(); }
};

window.clearUserInputs = () => {
    if (!confirm("Clear user inputs?")) return;
    saveState(); State.board.forEach(c => { if(!c.given) c.val = 0; }); Renderer.updateUI();
};

window.cleanAllPencils = () => {
    saveState(); State.board.forEach(c => c.notes = []); Renderer.updateUI();
};

window.clearAllHighlights = () => {
    if (State.isWon || State.paused) return;
    if (!State.board.some(c => c.color !== null)) return;
    if (!confirm("Clear all highlights?")) return;
    saveState(); State.board.forEach(c => c.color = null); Renderer.updateUI();
};

window.restartSameLevel = () => {
    State.board.forEach(c => { if (!c.given) { c.val = 0; c.notes = []; c.color = null; } });
    document.getElementById('win-overlay').style.display = 'none';
    State.isWon = false; 
    State.paused = false; 
    resetTimer();
    startTimer(); 
    Renderer.updateUI();
};

window.hideWinOverlay = () => {
    Renderer.stopConfetti();
    document.getElementById('win-overlay').style.display = 'none';
    document.getElementById('return-win-btn').style.display = 'block';
};

window.showWinOverlay = () => {
    document.getElementById('win-overlay').style.display = 'flex';
    document.getElementById('return-win-btn').style.display = 'none';
};

window.exitToCreate = () => window.setAppMode('create');

window.exportPuzzleLink = () => {
    // 1. Package only the essential data (grid size, given numbers, and drawn variants)
    const puzzleData = {
        size: State.size,
        board: State.board.map(c => c.given ? c.val : 0), 
        variants: State.variants || []
    };
    
    // 2. Encode to a URL-safe Base64 string
    const encodedData = btoa(JSON.stringify(puzzleData));
    
    // --- NEW SMART URL GENERATOR ---
    // Grab the full exact URL you are on right now, ignoring any old parameters
    let currentUrl = window.location.href.split('?')[0];
    
    // If we have variants, ensure the link explicitly points to logic.html
    if (State.variants && State.variants.length > 0 && !currentUrl.includes('logic.html')) {
        if (currentUrl.endsWith('index.html')) {
            currentUrl = currentUrl.replace('index.html', 'logic.html');
        } else if (currentUrl.endsWith('/')) {
            currentUrl += 'logic.html';
        } else {
            currentUrl += '/logic.html';
        }
    }
    
    const shareUrl = `${currentUrl}?puzzle=${encodedData}`;
    // -------------------------------
    
    // 3. Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert("Puzzle Link Copied to Clipboard!\n\nAnyone who opens this link will play your exact puzzle without any creator tools.");
    }).catch(err => {
        console.error("Failed to copy link: ", err);
        prompt("Copy this link to share:", shareUrl); // Fallback for older browsers
    });
};

// --- APP LOGIC & INPUT CONTROLLER ---

function initAppBoard() {
    initBoardState(State.size);
    document.getElementById('difficulty-badge').style.display = 'none';
    document.getElementById('win-overlay').style.display = 'none';
    document.getElementById('pause-overlay').style.display = 'none';
    resetTimer();
    Renderer.renderGrid();
    Renderer.updateUI();
}

function handleCellSelection(index, isMulti, isDragging) {
    if (isMulti) {
        if (!State.selected.includes(index)) {
            State.selected.push(index);
        } else if (!isDragging) {
            State.selected = State.selected.filter(id => id !== index);
        }
    } else {
        State.selected = [index]; 
    }
    Renderer.updateUI();
}

function applyColor(c) {
    if (State.selected.length === 0 || State.isWon || State.paused) return;
    saveState(); 
    State.selected.forEach(idx => State.board[idx].color = c); 
    Renderer.updateUI();
}

function handleInput(num) {
    if (State.selected.length === 0 || State.paused || State.isWon) return;
    saveState(); 
    
    State.selected.forEach(idx => {
        const cell = State.board[idx];
        if (State.mode === 'solve' && cell.given) return;
        
        if (State.pencil && State.mode === 'solve' && num !== 0) {
            if (cell.val !== 0) return;
            const pos = cell.notes.indexOf(num);
            if (pos > -1) cell.notes.splice(pos, 1); else cell.notes.push(num);
        } else {
            cell.val = num; 
            cell.notes = [];
            cell.given = (State.mode === 'create' && num !== 0);
            if (State.mode === 'solve' && num !== 0) cleanPencilsAfterMove(idx, num);
        }
    });

    Renderer.updateUI();
    if (State.mode === 'solve') checkWin();
}

function checkWin() {
    if (State.board.every(c => c.val !== 0) && !State.board.some((_, i) => hasConflict(State.board, i, State.board[i].val))) {
        State.isWon = true; 
        if (State.timerInt) clearInterval(State.timerInt); 
        document.getElementById('final-time').textContent = `Final Time: ${document.getElementById('timer').textContent}`;
        document.getElementById('win-overlay').style.display = 'flex';
        Renderer.fireConfetti(); 
    }
}

// --- GENERATOR LOGIC ---

function generateNew() {
    resetTimer(); 
    initAppBoard();
    let flat = Array(State.size * State.size).fill(0);
    
    State.currentDifficulty = document.getElementById('diff').value;
    document.getElementById('difficulty-badge').textContent = State.currentDifficulty;
    document.getElementById('difficulty-badge').style.display = 'inline-block';
        
    const fill = (idx) => {
        if (idx === State.size * State.size) return true;
        let nums = Array.from({length: State.size}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
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
    State.solution = [...flat];

    const diff = document.getElementById('diff').value;
    const totalCells = State.size * State.size;
    const percentage = diff === 'easy' ? 0.45 : (diff === 'medium' ? 0.55 : 0.65);
    const targetEmpty = Math.floor(totalCells * percentage);

    let removed = 0;
    let indices = Array.from({length: State.size * State.size}, (_, i) => i).sort(() => Math.random() - 0.5);

    for (let i of indices) {
        if (removed >= targetEmpty) break;
        let backup = flat[i];
        flat[i] = 0;
        
        if (countSolutions([...flat]) !== 1) {
            flat[i] = backup; 
        } else {
            removed++;
        }
    }

    flat.forEach((v, i) => { 
        State.board[i].val = v; 
        State.board[i].given = (v !== 0); 
    });

    Renderer.updateUI();
    if (State.mode === 'solve') startTimer(); 
}

// --- TIMER LOGIC ---

function resetTimer() {
    if (State.timerInt) clearInterval(State.timerInt);
    State.timerInt = null;
    State.timerVal = 0;
    document.getElementById('timer').textContent = "00:00";
}

function startTimer() {
    if (State.timerInt) clearInterval(State.timerInt);
    
    const updateDisplay = () => {
        const m = Math.floor(State.timerVal / 60).toString().padStart(2, '0');
        const s = (State.timerVal % 60).toString().padStart(2, '0');
        document.getElementById('timer').textContent = `${m}:${s}`;
    };
    
    updateDisplay();
    State.timerInt = setInterval(() => {
        if (!State.paused && !State.isWon) { 
            State.timerVal++;
            updateDisplay();
        }
    }, 1000);
}

// --- KEYBOARD EVENT LISTENER ---

window.addEventListener('keydown', (e) => {
    if (State.paused || State.isWon) return;
    const key = e.key.toLowerCase();
    
    if (['w','a','s','d'].includes(key) || key.includes('arrow')) {
        e.preventDefault();
        let current = State.selected.length > 0 ? State.selected[State.selected.length - 1] : 0;
        let r = Math.floor(current / State.size), c = current % State.size;
        
        if ((key === 'w' || key === 'arrowup') && r > 0) r--;
        if ((key === 's' || key === 'arrowdown') && r < State.size - 1) r++;
        if ((key === 'a' || key === 'arrowleft') && c > 0) c--;
        if ((key === 'd' || key === 'arrowright') && c < State.size - 1) c++;
        
        State.selected = [r * State.size + c];
        Renderer.updateUI();
    }
    if (e.key >= '1' && e.key <= State.size.toString()) window.handleInput(parseInt(e.key));
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') window.handleInput(0);
    if (key === 'z') { if (e.shiftKey) window.triggerRedo(); else window.triggerUndo(); }
    if (key === 'n' && State.mode === 'solve') { State.pencil = !State.pencil; Renderer.renderNumpad(); }
});

// --- BOOTSTRAP ---

// --- BOOTSTRAP ---
window.onload = function() {
    console.log("App starting with ES6 Modules..."); 
    Renderer.initHighlighter();
    
    // Check if there is a ?puzzle= parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const puzzleString = urlParams.get('puzzle');
    
    if (puzzleString) {
        try {
            // 1. Decode the puzzle data
            const decodedData = JSON.parse(atob(puzzleString));
            
            // 2. Initialize the correct grid size
            window.setGridSize(decodedData.size);
            
            // 3. Apply the numbers and variants to the State
            State.variants = decodedData.variants || [];
            decodedData.board.forEach((val, i) => {
                State.board[i].val = val;
                State.board[i].given = (val !== 0);
            });
            
            // 4. Lock the UI into Play-Only mode
            State.isPlayOnly = true;
            window.setAppMode('solve');
            
            // Hide the Create/Solve toggle buttons
            const modeToggleGroup = document.getElementById('modeCreate').parentElement;
            if (modeToggleGroup) modeToggleGroup.style.display = 'none';
            
            // Hide the "Back to Create Mode" button in the win screen
            const backToCreateBtn = document.querySelector('.btn-secondary[onclick="exitToCreate()"]');
            if (backToCreateBtn) backToCreateBtn.style.display = 'none';

            // If we are on the advanced page, trigger the SVG renderer
            if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
            Renderer.updateUI();
            
        } catch(e) {
            console.error("Invalid puzzle link detected.", e);
            window.setGridSize(9);
        }
    } else {
        window.setGridSize(9); 
    }
};
