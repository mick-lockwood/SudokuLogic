import { State } from './GameState.js';
import { hasConflict, getCount, countSolutions } from './SudokuLogic.js';

export function initHighlighter() {
    const container = document.getElementById('highlighter-tools');
    if (!container) return;
    container.innerHTML = '';
    State.colors.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'color-btn'; 
        btn.style.backgroundColor = c;
        btn.onclick = () => window.applyColor(c); 
        container.appendChild(btn);
    });
}

export function updateUI() {
    const primaryActive = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
    const selVal = primaryActive !== null ? State.board[primaryActive].val : 0;
    const selR = primaryActive !== null ? Math.floor(primaryActive / State.size) : -1;
    const selC = primaryActive !== null ? primaryActive % State.size : -1;
    const selBlockR = selR !== -1 ? Math.floor(selR / State.bH) : -1;
    const selBlockC = selC !== -1 ? Math.floor(selC / State.bW) : -1;
    const showSeen = document.getElementById('toggle-seen')?.checked ?? true;

    State.board.forEach((data, i) => {
        const el = document.getElementById(`cell-${i}`);
        if (!el) return;

        el.innerHTML = '';
        el.className = el.className.split(' ').filter(c => !['selected', 'highlight', 'match', 'given', 'user', 'error'].includes(c)).join(' ');

        const r = Math.floor(i / State.size), c = i % State.size;
        const blockR = Math.floor(r / State.bH), blockC = Math.floor(c / State.bW);

        let tint = "rgba(255, 255, 255, 0)"; 
        
        if (State.selected.includes(i)) {
            el.classList.add('selected');
            tint = State.darkMode ? "rgba(56, 189, 248, 0.5)" : "rgba(52, 152, 219, 0.4)"; 
        } else if (showSeen && (r === selR || c === selC || (blockR === selBlockR && blockC === selBlockC))) {
            el.classList.add('highlight');
            tint = State.darkMode ? "rgba(56, 189, 248, 0.15)" : "rgba(52, 152, 219, 0.1)"; 
        } else if (selVal !== 0 && data.val === selVal) {
            el.classList.add('match');
            tint = State.darkMode ? "rgba(74, 222, 128, 0.4)" : "rgba(46, 204, 113, 0.3)"; 
        }

        let highlightBase = data.color || (State.darkMode ? "#1e293b" : "white");
        el.style.background = `linear-gradient(${tint}, ${tint}), ${highlightBase}`;

        if (data.val !== 0) {
            // Wrap the digit in a span and pull it above the SVG layer (z-index 20)
            el.innerHTML = `<span style="position: relative; z-index: 20;">${data.val}</span>`;
            el.classList.add(data.given ? 'given' : 'user');
            if (hasConflict(State.board, i, data.val)) el.classList.add('error');
        }
            
        else if (State.mode === 'create' && State.showGhost && State.solution && State.solution[i]) {
            const ghostColor = State.darkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(30, 41, 59, 0.2)";
            el.innerHTML = `<span style="position: relative; z-index: 20; color: ${ghostColor}; font-style: italic;">${State.solution[i]}</span>`;
        }
            
        else if (data.notes.length > 0) {
            const pGrid = document.createElement('div');
            pGrid.className = 'pencil-grid';
            pGrid.style.zIndex = '20'; // Ensure the grid container is pulled up
            
            for(let n = 1; n <= 9; n++) {
                const nDiv = document.createElement('div'); 
                nDiv.className = 'pencil-num';
                
                if (data.notes.includes(n)) {
                    // Wrap the pencil digit in the same relative span to pierce the SVG glass
                    nDiv.innerHTML = `<span style="position: relative; z-index: 20;">${n}</span>`;
                    if (hasConflict(State.board, i, n)) nDiv.classList.add('error');
                }
                pGrid.appendChild(nDiv);
            }
            el.appendChild(pGrid);
        }
    });
    
    if (State.mode === 'create') validateStatus();
    renderNumpad();
}

export function renderGrid() {
    const container = document.getElementById('grid');
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.width = 'fit-content'; 
    container.style.gridTemplateColumns = `repeat(${State.size}, var(--cell-size))`;
    
    const gridLine = State.darkMode ? "#ffffff" : "#1e293b";
    const wrapper = document.getElementById('grid-wrapper');
    
    wrapper.style.background = gridLine;
    wrapper.style.width = 'fit-content'; 
    wrapper.style.margin = '0 auto';     
    
    container.style.background = gridLine;

    State.board.forEach((cell, i) => {
        const div = document.createElement('div');
        div.className = 'cell'; 
        div.id = `cell-${i}`;
        div.style.border = `1px solid ${gridLine}`;
        
        const r = Math.floor(i / State.size), c = i % State.size;
        
        if ((c + 1) % State.bW === 0 && c < State.size - 1) div.style.borderRight = `3px solid ${gridLine}`;
        if ((r + 1) % State.bH === 0 && r < State.size - 1) div.style.borderBottom = `3px solid ${gridLine}`;
  
        div.addEventListener('pointerdown', (e) => {
            if (State.paused || State.isWon) return;
            e.target.releasePointerCapture(e.pointerId); 
            window.handleCellSelection(i, e.ctrlKey || e.metaKey, false);
        });

        div.addEventListener('pointerenter', (e) => {
            if (State.paused || State.isWon) return;
            if (e.buttons === 1) { 
                window.handleCellSelection(i, true, true); 
            }
        });

        div.addEventListener('contextmenu', (e) => e.preventDefault());
        container.appendChild(div);
    });
}

export function renderNumpad() {
    const pad = document.getElementById('numpad'); pad.innerHTML = '';
    const row1 = document.createElement('div'); row1.className = 'numpad-row';
    for (let i = 1; i <= State.size; i++) {
        const b = document.createElement('button'); b.className = 'n-btn'; b.textContent = i;
        if (getCount(i) >= State.size) b.disabled = true;
        b.onclick = () => window.handleInput(i); 
        row1.appendChild(b);
    }
    pad.appendChild(row1);

    const row2 = document.createElement('div'); row2.className = 'numpad-row';
    const btns = [
        { text: 'Undo\n(Z)', action: window.triggerUndo, disabled: State.undoStack.length === 0 },
        { text: 'Redo\n(Shift Z)', action: window.triggerRedo, disabled: State.redoStack.length === 0 },
        { text: State.pencil ? 'Pencil ON\n(N)' : 'Pencil OFF\n(N)', action: () => { State.pencil = !State.pencil; renderNumpad(); }, solveOnly: true, isPencil: true },
        { text: 'Erase\n(0)', action: () => window.handleInput(0), danger: true }
    ];

    btns.forEach(cfg => {
        if (cfg.solveOnly && State.mode !== 'solve') return;
        const b = document.createElement('button');
        b.className = 'n-btn'; b.style.width = '85px'; b.style.fontSize = '10px';
        b.innerText = cfg.text;
        if (cfg.disabled || State.isWon) b.disabled = true;
        if (cfg.danger) b.style.color = 'var(--danger)';
        if (cfg.isPencil && State.pencil) b.classList.add('pencil-active');
        b.onclick = cfg.action;
        row2.appendChild(b);
    });
    pad.appendChild(row2);
}

export function validateStatus() {
    const label = document.getElementById('status-label');
    const currentBoard = State.board.map(c => c.val);
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
        label.style.color = "#f1c40f"; 
    } else {
        label.textContent = "No Valid Solution";
        label.style.color = "var(--danger)";
    }
}

export function fireConfetti() {
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
    window.confettiActive = true;
    function draw() {
        if (!window.confettiActive) {
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

export function stopConfetti() {
    window.confettiActive = false;
    const canvas = document.getElementById('confetti');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// --- SVG DRAWING ENGINE ---
export function getCellCenter(index) {
    const el = document.getElementById(`cell-${index}`);
    const svg = document.getElementById('svg-layer');
    if (!el || !svg) return { x: 0, y: 0 };

    const cellRect = el.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    return {
        x: (cellRect.left - svgRect.left) + (cellRect.width / 2),
        y: (cellRect.top - svgRect.top) + (cellRect.height / 2)
    };
}
