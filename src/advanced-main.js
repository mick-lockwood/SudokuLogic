// src/advanced-main.js
import './classic-main.js'; 
import { State, saveState } from './GameState.js';
import * as Renderer from './Renderer.js';
import { Tooltips } from './TooltipDictionary.js';
import { resetGenSafety, cleanPencilsAfterMove, hasConflict } from './SudokuLogic.js';

// import variant rules
import { drawThermo } from './variants/Thermo.js';
import { drawWhisper } from './variants/Whisper.js';
import { drawKiller } from './variants/Killer.js';
import { drawKropki } from './variants/Kropki.js';

// --- AUTO-RESIZE SVGS ---
window.addEventListener('resize', () => {
    if (typeof window.renderSVGLayer === 'function') {
        window.renderSVGLayer();
    }
});

window.AdvancedState = {
    activeTool: 'pointer',
    isDrawing: false,
    currentLine: [],
    currentRegionId: null,
    variantUndoStack: [],
    variantRedoStack: []
};

// --- TOOL MANAGER ---
window.setTool = (tool) => {
    window.AdvancedState.activeTool = tool;
    window.AdvancedState.fogLinkSource = null; 
    
    document.querySelectorAll('.variant-tool-btn').forEach(btn => {
        btn.classList.remove('active-tool-pointer', 'active-tool-variant', 'active-tool-edit', 'active-tool-eraser');
    });

    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) {
        if (tool === 'pointer') {
            activeBtn.classList.add('active-tool-pointer');
        } else if (['edit', 'region', 'fog', 'fog-link'].includes(tool)) {
            activeBtn.classList.add('active-tool-edit'); 
        } else if (tool === 'eraser') {
            activeBtn.classList.add('active-tool-eraser');
        } else {
            activeBtn.classList.add('active-tool-variant');
        }
    }
    
    if (tool !== 'pointer') {
        State.selected = [];
    }
    
    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer(); 
    
    if (typeof Renderer !== 'undefined' && Renderer.updateUI) {
        Renderer.updateUI();
    } else if (typeof window.updateUI === 'function') {
        window.updateUI();
    }
};

window.clearVariantGraphics = () => {
    if (!confirm("Clear all drawn variant lines?")) return;
    State.variants = [];
    renderSVGLayer();
    Renderer.updateUI();
};

// --- INPUT HIJACKER ---
const originalHandleCellSelection = window.handleCellSelection;

window.handleCellSelection = (index, isMulti, isDragging) => {
    const isClueCell = typeof index === 'string';
    const tool = window.AdvancedState.activeTool;

    // --- 1. FOG PAINTER LOGIC ---
    if (tool === 'fog' && State.mode === 'create') {
        if (!isClueCell) { 
            if (!isDragging) window.AdvancedState.paintFogValue = !State.fogMap[index];
            State.fogMap[index] = window.AdvancedState.paintFogValue;
            if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI(); 
        }
        return; 
    }
    
    // --- 2. FOG LINKER LOGIC ---
    else if (tool === 'fog-link' && State.mode === 'create') {
        if (!isClueCell && !isDragging) {
            if (window.AdvancedState.fogLinkSource == null) {
                window.AdvancedState.fogLinkSource = index;
                if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
                
                setTimeout(() => {
                    if (!State.fogTriggers) State.fogTriggers = {};
                    const existing = State.fogTriggers[index] || "";
                    const triggerStr = prompt("Enter the digit (1-9) required to unlock this cell:\n(Leave blank to use the auto-generated solution)", existing);
                    
                    if (triggerStr !== null && triggerStr.trim() !== "") {
                        const triggerVal = parseInt(triggerStr);
                        if (!isNaN(triggerVal) && triggerVal >= 1 && triggerVal <= 9) {
                            State.fogTriggers[index] = triggerVal;
                        }
                    } else if (triggerStr !== null) {
                        delete State.fogTriggers[index]; 
                    }
                    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer(); 
                }, 10);
                
            } else if (window.AdvancedState.fogLinkSource === index) {
                window.AdvancedState.fogLinkSource = null; 
                if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
            } else {
                const sourceKey = String(window.AdvancedState.fogLinkSource);
                if (!State.fogLinks) State.fogLinks = {};
                if (!State.fogLinks[sourceKey]) State.fogLinks[sourceKey] = [];
                
                const targetIdx = State.fogLinks[sourceKey].indexOf(index);
                if (targetIdx > -1) {
                    State.fogLinks[sourceKey].splice(targetIdx, 1); 
                } else {
                    State.fogLinks[sourceKey].push(index); 
                }
                if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer(); 
                if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
            }
        }
        return;
    }

    // --- 3. VARIANT LINE DRAWING ---
    else if (['thermo', 'whisper','killer', 'kropki-white', 'kropki-black'].includes(tool)) {
        handleLineDrawing(index, isDragging);
    } 
        
    // --- 4. REGION PAINTER LOGIC ---
    else if (tool === 'region') {
        if (!isClueCell) { 
            if (!isDragging) {
                window.AdvancedState.currentRegionId = `jigsaw-${Date.now()}`;
                State.board[index].region = window.AdvancedState.currentRegionId;
            } else if (window.AdvancedState.currentRegionId) {
                State.board[index].region = window.AdvancedState.currentRegionId;
            }
            if (typeof Renderer.renderGrid === 'function') Renderer.renderGrid();
            if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI(); 
        }
    }
        
    // --- 5. EDIT LOGIC ---
    else if (tool === 'edit') {
        if (!isDragging) {
            const variantToEdit = State.variants.find(v => v.cells.includes(index));
            if (variantToEdit && variantToEdit.type === 'killer') {
                setTimeout(() => {
                    const sumInput = prompt("Enter new target sum for this cage:", variantToEdit.sum);
                    if (sumInput !== null) { 
                        const sumVal = parseInt(sumInput);
                        if (!isNaN(sumVal) && sumVal > 0) {
                            window.saveVariantState(); 
                            variantToEdit.sum = sumVal; 
                            renderSVGLayer();
                            if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
                        }
                    }
                }, 10);
            }
        }
    } 
        
    // --- 6. ERASER LOGIC ---
    else if (tool === 'eraser') {
        if (!isDragging) {
            const originalLength = State.variants.length;
            const newVariants = State.variants.filter(v => !v.cells.includes(index));
            if (newVariants.length < originalLength) {
                window.saveVariantState(); 
                State.variants = newVariants;
                renderSVGLayer();
                if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
            }
        }
    }
    // --- DEFAULT: NUMBER INPUT ---
    else {
        originalHandleCellSelection(index, isMulti, isDragging);
    }
};

// --- UNDO / REDO LOGIC ---
window.saveVariantState = () => {
    window.AdvancedState.variantRedoStack = [];
    window.AdvancedState.variantUndoStack.push(JSON.stringify(State.variants));
};

window.undoVariant = () => {
    if (window.AdvancedState.variantUndoStack.length > 0) {
        window.AdvancedState.variantRedoStack.push(JSON.stringify(State.variants));
        State.variants = JSON.parse(window.AdvancedState.variantUndoStack.pop());
        renderSVGLayer();
        Renderer.updateUI();
    }
};

window.redoVariant = () => {
    if (window.AdvancedState.variantRedoStack.length > 0) {
        window.AdvancedState.variantUndoStack.push(JSON.stringify(State.variants));
        State.variants = JSON.parse(window.AdvancedState.variantRedoStack.pop());
        renderSVGLayer();
        Renderer.updateUI();
    }
};

window.clearVariantGraphics = () => {
    if (!confirm("Clear all drawn variant lines?")) return;
    window.saveVariantState();
    State.variants = [];
    renderSVGLayer();
    Renderer.updateUI(); 
};

// --- AUTOFILL PENCIL MARKS ---
window.autoFillPencils = () => {
    if (State.isWon || State.paused) return;
    saveState();
    
    State.board.forEach((cell, i) => {
        if (cell.val === 0) {
            cell.notes = []; // Clear existing so we don't duplicate
            for (let n = 1; n <= State.size; n++) {
                // Only pencil it in if it doesn't break a rule!
                if (!hasConflict(State.board, i, n)) {
                    cell.notes.push(n);
                }
            }
        }
    });
    
    if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
};

// --- TOGGLE TIMER ---
window.toggleTimerVis = () => {
    const isVisible = document.getElementById('toggle-timer').checked;
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.style.visibility = isVisible ? 'visible' : 'hidden';
    }
};

// --- PERIMETER RULE SYNCING ---
window.togglePerimeterRule = () => {
    const isAnyRuleChecked = 
        document.getElementById('rule-sandwich').checked ||
        document.getElementById('rule-skyscraper').checked ||
        document.getElementById('rule-frames').checked ||
        document.getElementById('rule-rooms').checked;

    const outerCluesToggle = document.getElementById('toggle-outer-clues');
    
    if (isAnyRuleChecked && !outerCluesToggle.checked) {
        outerCluesToggle.checked = true;
        window.toggleOuterClues(); 
    } else {
        if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
        if (typeof window.updateUI === 'function') window.updateUI();
    }
};

const originalToggleOuterClues = window.toggleOuterClues;
window.toggleOuterClues = () => {
    const isChecked = document.getElementById('toggle-outer-clues').checked;
    
    if (!isChecked) {
        document.getElementById('rule-sandwich').checked = false;
        document.getElementById('rule-skyscraper').checked = false;
        document.getElementById('rule-frames').checked = false;
        document.getElementById('rule-rooms').checked = false;
    }
    
    if (originalToggleOuterClues) originalToggleOuterClues();
    
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI();
};

// --- THE MASTER INPUT HIJACKER ---
// Completely replaces the classic input to ensure absolute control over the assignment and win state
window.handleInput = (val) => {
    // 0. Safety Checks
    if (State.selected.length === 0 || State.paused || State.isWon) return;
    saveState();

    const primary = State.selected[State.selected.length - 1];
    
    // 1. OUTER CLUE MULTI-DIGIT LOGIC
    if (typeof primary === 'string' && primary.startsWith('clue')) {
        if (!State.clues) State.clues = {};
        if (val === 0 || val === '0') {
            State.clues[primary] = ""; 
        } else {
            const current = State.clues[primary] || "";
            State.clues[primary] = (current.length >= 2) ? val.toString() : current + val.toString();
        }
        if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
        return; 
    } 

    // 2. FOG INPUT BLOCKER
    if (State.mode === 'solve' && State.fogMode && primary !== null) {
        if (State.fogMap[primary] && !State.fogRevealed[primary]) {
            return; 
        }
    }
    
    // 3. FOG HYBRID REVEAL LOGIC
    if (State.mode === 'solve' && State.fogMode && !State.pencil && val != 0 && primary !== null) {
        const primaryKey = String(primary);
        let isCorrect = false;

        if (State.fogTriggers && State.fogTriggers[primaryKey] !== undefined) {
            isCorrect = (val == State.fogTriggers[primaryKey]);
        } else if (State.solution && State.solution[primary] !== undefined) {
            isCorrect = (val == State.solution[primary]);
        }

        if (isCorrect) {
            if (!State.fogRevealed) State.fogRevealed = Array(State.size * State.size).fill(false);
            if (!State.fogLinks) State.fogLinks = {};

            if (State.fogLinks[primaryKey] && State.fogLinks[primaryKey].length > 0) {
                State.fogLinks[primaryKey].forEach(targetIdx => { State.fogRevealed[targetIdx] = true; });
            } else {
                const r = Math.floor(primary / State.size), c = primary % State.size;
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        const nr = r + i, nc = c + j;
                        if (nr >= 0 && nr < State.size && nc >= 0 && nc < State.size) {
                            State.fogRevealed[nr * State.size + nc] = true;
                        }
                    }
                }
            }
            State.fogRevealed[primary] = true; 
        }
    }
    
    // 4. THE CORE CELL ASSIGNMENT (Bypassing Classic Engine)
    State.selected.forEach(idx => {
        if (typeof idx !== 'number') return;
        const cell = State.board[idx];
        
        if (State.mode === 'solve' && cell.given) return;
        
        if (State.pencil && State.mode === 'solve' && val !== 0) {
            if (cell.val !== 0) return;
            const pos = cell.notes.indexOf(val);
            if (pos > -1) cell.notes.splice(pos, 1); else cell.notes.push(val);
        } else {
            cell.val = val; 
            cell.notes = [];
            cell.given = (State.mode === 'create' && val !== 0);
            if (State.mode === 'solve' && val !== 0) cleanPencilsAfterMove(idx, val);
        }
    });
    
    // 5. RENDER UI
    if (typeof Renderer !== 'undefined' && Renderer.updateUI) {
        Renderer.updateUI();
    }
    
    // 6. CHECK WIN 
    window.checkAdvancedWin();
};

// --- UNIVERSAL WIN CHECKER ---
window.checkAdvancedWin = () => {
    if (State.mode !== 'solve' || State.isWon) return;

    const isFull = State.board.every(cell => cell.val !== 0);
    if (!isFull) return;

    // Wait a split second for the UI to finish rendering, then check for red text
    setTimeout(() => {
        // Prevents ghost wins if the user quickly swapped to create mode
        if (State.mode !== 'solve') return;
        
        const hasErrors = document.querySelector('.error') !== null;
        
        if (!hasErrors) {
            State.isWon = true;
            
            // --- THE PRISTINE BOARD FIX ---
            // Empties the array while preserving the memory reference
            State.selected.length = 0; 
            window.AdvancedState.activeTool = 'pointer';

            if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
            
            // Handle the Timer properly
            if (State.timerInt) clearInterval(State.timerInt);
            const timerEl = document.getElementById('timer');
            const finalTimeEl = document.getElementById('final-time');
            if (timerEl && finalTimeEl) {
                finalTimeEl.textContent = `Final Time: ${timerEl.textContent}`;
            }

            const winOverlay = document.getElementById('win-overlay');
            if (winOverlay) winOverlay.style.display = 'flex';
            
            if (typeof Renderer !== 'undefined' && Renderer.fireConfetti) {
                Renderer.fireConfetti();
            }
        }
    }, 50);
};

// --- GLOBAL RULE TOGGLES ---
window.toggleAntiKnight = () => {
    State.antiKnight = document.getElementById('toggle-anti-knight').checked;
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI();
};

window.toggleAntiKing = () => {
    State.antiKing = document.getElementById('toggle-anti-king').checked;
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI(); 
};

// --- FOG OF WAR LOGIC ---
window.toggleFogMode = () => {
    State.fogMode = document.getElementById('toggle-fog').checked;
    const fogBtn = document.getElementById('tool-fog');
    const fogLinkBtn = document.getElementById('tool-fog-link');
    const clearFogBtn = document.getElementById('btn-clear-fog'); 
    
    if (State.fogMode) {
        if (fogBtn) fogBtn.style.display = 'block';
        if (fogLinkBtn) fogLinkBtn.style.display = 'block';
        if (clearFogBtn) clearFogBtn.style.display = 'block'; 
        window.setTool('fog');
    } else {
        if (fogBtn) fogBtn.style.display = 'none';
        if (fogLinkBtn) fogLinkBtn.style.display = 'none';
        if (clearFogBtn) clearFogBtn.style.display = 'none'; 
        if (['fog', 'fog-link'].includes(window.AdvancedState.activeTool)) {
            window.setTool('pointer');
        }
    }
    if (typeof window.updateGameRules === 'function') window.updateGameRules();
    if (typeof window.updateUI === 'function') window.updateUI();
};

window.clearFogData = () => {
    if (!confirm("Are you sure you want to clear all painted fog, custom links, and trigger keys?")) return;
    State.fogMap = Array(State.size * State.size).fill(false);
    State.fogRevealed = Array(State.size * State.size).fill(false);
    State.fogLinks = {};
    State.fogTriggers = {};
    window.AdvancedState.fogLinkSource = null;

    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
    if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
};

// --- GRID MODIFICATION TOGGLES ---
window.toggleJigsawMode = () => {
    State.jigsawMode = document.getElementById('toggle-jigsaw').checked;
    if (State.jigsawMode) {
        document.getElementById('toggle-suguru').checked = false;
        State.suguruMode = false;
    }
    updateRegionPainterState();
};

window.toggleSuguruMode = () => {
    State.suguruMode = document.getElementById('toggle-suguru').checked;
    if (State.suguruMode) {
        document.getElementById('toggle-jigsaw').checked = false;
        State.jigsawMode = false;
    }
    updateRegionPainterState();
};

window.resetRegions = () => {
    if (!State.jigsawMode && !State.suguruMode) return; 
    State.board.forEach((cell, i) => {
        const r = Math.floor(i / State.size);
        const c = i % State.size;
        const boxIndex = Math.floor(r / State.bH) * (State.size / State.bW) + Math.floor(c / State.bW);
        cell.region = `box-${boxIndex}`;
    });

    if (typeof Renderer !== 'undefined' && Renderer.renderGrid) {
        Renderer.renderGrid();
        Renderer.updateUI();
    }
};

function updateRegionPainterState() {
    const regionToolBtn = document.getElementById('tool-region');
    const resetRegionsBtn = document.getElementById('btn-reset-regions'); 
    
    if (State.jigsawMode || State.suguruMode) {
        if (regionToolBtn) regionToolBtn.style.display = 'block';
        if (resetRegionsBtn) resetRegionsBtn.style.display = 'block'; 
        window.setTool('region'); 
    } else {
        if (regionToolBtn) regionToolBtn.style.display = 'none';
        if (resetRegionsBtn) resetRegionsBtn.style.display = 'none'; 
        if (window.AdvancedState.activeTool === 'region') window.setTool('pointer');
        
        State.board.forEach((cell, i) => {
            const r = Math.floor(i / State.size);
            const c = i % State.size;
            const boxIndex = Math.floor(r / State.bH) * (State.size / State.bW) + Math.floor(c / State.bW);
            cell.region = `box-${boxIndex}`;
        });
        if (typeof Renderer.renderGrid === 'function') Renderer.renderGrid();
    }
    
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI();
}

// --- DYNAMIC DRAWING (BACKTRACKING) ---
function handleLineDrawing(index, isDragging) {
    if (!isDragging) {
        window.AdvancedState.isDrawing = true;
        window.AdvancedState.currentLine = [index];
    } else if (window.AdvancedState.isDrawing) {
        const line = window.AdvancedState.currentLine;
        const lastCell = line[line.length - 1];
        const prevCell = line.length > 1 ? line[line.length - 2] : null;

        if (index === prevCell) {
            line.pop();
        } else if (lastCell !== index && !line.includes(index)) {
            line.push(index);
        }
    }
    renderSVGLayer();
}

window.addEventListener('pointerup', () => {
    const tool = window.AdvancedState.activeTool;
    
    if (tool === 'region') {
        const visited = new Set();
        const newRegions = Array(State.size * State.size).fill(null);
        let nextId = 0;
        
        for (let i = 0; i < State.size * State.size; i++) {
            if (visited.has(i)) continue;
            
            const originalId = State.board[i].region;
            const baseName = originalId.split('_chunk_')[0]; 
            const newAssignedId = `${baseName}_chunk_${nextId++}`;
            
            const queue = [i];
            visited.add(i);
            
            while(queue.length > 0) {
                const curr = queue.shift();
                newRegions[curr] = newAssignedId;
                
                const r = Math.floor(curr / State.size);
                const c = curr % State.size;
                
                const neighbors = [];
                if (r > 0) neighbors.push(curr - State.size);
                if (r < State.size - 1) neighbors.push(curr + State.size);
                if (c > 0) neighbors.push(curr - 1);
                if (c < State.size - 1) neighbors.push(curr + 1);
                
                for (let n of neighbors) {
                    if (!visited.has(n) && State.board[n].region === originalId) {
                        visited.add(n);
                        queue.push(n);
                    }
                }
            }
        }
        
        for (let i = 0; i < State.size * State.size; i++) {
            State.board[i].region = newRegions[i];
        }
        
        if (typeof Renderer !== 'undefined' && Renderer.renderGrid) {
            Renderer.renderGrid();
            Renderer.updateUI();
        }
    }
    
    if (['thermo', 'whisper', 'killer', 'kropki-white', 'kropki-black'].includes(tool) && window.AdvancedState.isDrawing) {
        window.AdvancedState.isDrawing = false;
        
        if (window.AdvancedState.currentLine.length > 0) {
            
            if (tool === 'killer') {
                setTimeout(() => {
                    const sumInput = prompt("Enter the target sum for this cage:");
                    const sumVal = parseInt(sumInput);
                    
                    if (!isNaN(sumVal) && sumVal > 0) {
                        window.saveVariantState(); 
                        State.variants.push({
                            type: tool,
                            cells: [...window.AdvancedState.currentLine],
                            sum: sumVal
                        });
                    }
                    window.AdvancedState.currentLine = [];
                    Renderer.updateUI(); 
                    renderSVGLayer();
                }, 10);
                return; 
                
            } else if (tool.startsWith('kropki') && window.AdvancedState.currentLine.length > 1) {
                window.saveVariantState(); 
                const line = window.AdvancedState.currentLine;
                
                for (let i = 0; i < line.length - 1; i++) {
                    State.variants.push({
                        type: tool,
                        cells: [line[i], line[i + 1]]
                    });
                }
                Renderer.updateUI(); 
                
            } else if (window.AdvancedState.currentLine.length > 1) {
                window.saveVariantState(); 
                State.variants.push({
                    type: tool,
                    cells: [...window.AdvancedState.currentLine]
                });
                Renderer.updateUI(); 
            }
        }
        
        window.AdvancedState.currentLine = [];
        renderSVGLayer();
    }
});

// --- GENERALIZED SVG RENDERER ---
window.renderSVGLayer = function renderSVGLayer() {
    const svg = document.getElementById('svg-layer');
    if (!svg) return;
    svg.innerHTML = ''; 
    
    State.variants.forEach(drawVariantLine); 
    
    if (window.AdvancedState.currentLine && window.AdvancedState.currentLine.length > 0) {
        drawVariantLine({
            type: window.AdvancedState.activeTool,
            cells: window.AdvancedState.currentLine
        });
    }
    
    // --- FOG LINK VISUALIZER ---
    if (State.mode === 'create' && window.AdvancedState.activeTool === 'fog-link' && State.fogLinks) {
        let defs = svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            svg.appendChild(defs);
        }
        if (!document.getElementById('fog-arrow')) {
            defs.innerHTML += `<marker id="fog-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ec4899" /></marker>`;
        }

        Object.keys(State.fogLinks).forEach(sourceIdx => {
            const s = parseInt(sourceIdx);
            if (isNaN(s)) return;
            const sourcePos = Renderer.getCellCenter(s); 
            
            State.fogLinks[sourceIdx].forEach(targetIdx => {
                const targetPos = Renderer.getCellCenter(targetIdx);
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", sourcePos.x); line.setAttribute("y1", sourcePos.y);
                line.setAttribute("x2", targetPos.x); line.setAttribute("y2", targetPos.y);
                line.setAttribute("stroke", "#ec4899"); line.setAttribute("stroke-width", "3");
                line.setAttribute("stroke-dasharray", "5,5"); line.setAttribute("marker-end", "url(#fog-arrow)");
                svg.appendChild(line);
            });

            if (State.fogTriggers && State.fogTriggers[sourceIdx]) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", sourcePos.x - 22);
                text.setAttribute("y", sourcePos.y - 12);
                text.setAttribute("fill", "#a855f7"); 
                text.setAttribute("font-size", "14px");
                text.setAttribute("font-weight", "900");
                text.style.pointerEvents = "none";
                text.textContent = `🔑 ${State.fogTriggers[sourceIdx]}`;
                svg.appendChild(text);
            }
        });
    }

    if (typeof window.updateDynamicTitle === 'function') {
        window.updateDynamicTitle();
    }
}

function drawVariantLine(variant) {
    const svg = document.getElementById('svg-layer');
    if (!svg) return;

    if (variant.type === 'thermo') drawThermo(variant, svg);
    if (variant.type === 'whisper') drawWhisper(variant, svg);
    if (variant.type === 'killer') drawKiller(variant, svg);
    if (variant.type.startsWith('kropki')) drawKropki(variant, svg);
}

// --- UX ENHANCEMENTS ---
window.addEventListener('keydown', (e) => {
    if (State.paused || State.isWon) return;
    
    const isZ = e.key.toLowerCase() === 'z';
    const isY = e.key.toLowerCase() === 'y';
    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl && (isZ || isY)) {
        e.preventDefault();
        e.stopImmediatePropagation(); 
        
        if (isY || (isZ && e.shiftKey)) {
            if (window.AdvancedState.activeTool !== 'pointer') {
                window.redoVariant();
            } else if (typeof window.triggerRedo === 'function') {
                window.triggerRedo();
            }
        } 
        else if (isZ && !e.shiftKey) {
            if (window.AdvancedState.activeTool !== 'pointer') {
                window.undoVariant();
            } else if (typeof window.triggerUndo === 'function') {
                window.triggerUndo();
            }
        }
        return;
    }

    if (!isCtrl && isZ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
    }

    if (e.key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation(); 
        
        const primary = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
        if (typeof primary === 'string' && primary.startsWith('clue')) {
            if (!State.clues) State.clues = {};
            const current = State.clues[primary] || "";
            
            if (current.length < 2 && current.length > 0) {
                State.clues[primary] = current + "0";
                if (typeof window.updateUI === 'function') window.updateUI();
            }
        }
        return; 
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        const primary = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
        
        if (typeof primary === 'string' && primary.startsWith('clue')) {
            if (!State.clues) State.clues = {};
            const current = State.clues[primary] || "";
            
            State.clues[primary] = current.slice(0, -1);
            if (typeof window.updateUI === 'function') window.updateUI();
        } else {
            if (typeof window.handleInput === 'function') window.handleInput(0);
        }
        return;
    }

    if (e.key === 'Tab') {
        e.preventDefault(); 
        e.stopImmediatePropagation();
        
        State.pencil = !State.pencil;
        
        if (typeof Renderer !== 'undefined' && Renderer.renderNumpad) {
            Renderer.renderNumpad();
        } else if (typeof window.updateUI === 'function') {
            window.updateUI(); 
        }
        return;
    }
    
    if (e.key === 'Escape' || e.key.toLowerCase() === 'v') {
        if (window.AdvancedState.activeTool !== 'pointer') {
            window.setTool('pointer');
        }
    }
}, true); 

// --- OVERRIDE MODE SWITCHER ---
const originalSetAppMode = window.setAppMode;

window.setAppMode = (m) => {
    State.isWon = false; 
    if (m === 'solve') {
        State.fogRevealed = Array(State.size * State.size).fill(false);
        const winOverlay = document.getElementById('win-overlay');
        if (winOverlay) winOverlay.style.display = 'none';
        if (typeof Renderer !== 'undefined' && Renderer.stopConfetti) Renderer.stopConfetti();
    }
    
    try {
        if (originalSetAppMode) originalSetAppMode(m);
    } catch(e) { console.error("Classic Engine Error:", e); }
    
    const variantPanel = document.getElementById('variant-tools-panel');
    if (variantPanel) variantPanel.style.display = (m === 'create') ? 'flex' : 'none';
    
    window.setTool('pointer');
    
    setTimeout(() => {
        const svg = document.getElementById('svg-layer');
        if (svg) svg.innerHTML = '';
        if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
        if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
    }, 15);
};

// --- GRID SIZE INTERCEPTOR ---
const originalSetGridSize = window.setGridSize;

window.setGridSize = (s) => {
    const hasNumbers = State.board && State.board.some(c => c.val !== 0);
    const hasVariants = State.variants && State.variants.length > 0;
    const hasFog = State.fogMap && State.fogMap.some(f => f === true); 

    if (hasNumbers || hasVariants || hasFog) {
        if (!confirm("Changing grid size will clear your current board, variant rules, and fog data. Continue?")) {
            return; 
        }
    }

    State.variants = [];
    window.AdvancedState.variantUndoStack = [];
    window.AdvancedState.variantRedoStack = [];

    if (originalSetGridSize) originalSetGridSize(s);
    
    State.fogMap = Array(s * s).fill(false);
    State.fogRevealed = Array(s * s).fill(false);
    State.fogLinks = {};
    State.fogTriggers = {};
    window.AdvancedState.fogLinkSource = null;

    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
    if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
};

// --- JIGSAW GENERATOR SAFETY INTERCEPTOR ---
const originalGenerateNew = window.generateNew;

const generateWithRetry = (attemptsLeft) => {
    if (attemptsLeft <= 0) {
        State.board.forEach(c => { c.val = 0; c.given = false; c.notes = []; });
        if (typeof window.updateUI === 'function') window.updateUI();
        
        const label = document.getElementById('status-label');
        if (label) {
            label.textContent = "Generation Failed";
            label.style.color = "var(--danger)";
        }
        alert("This specific Jigsaw layout is too highly constrained to generate quickly. Please adjust your regions to be slightly less intertwined and try again.");
        return;
    }

    try {
        resetGenSafety();
        if (originalGenerateNew) originalGenerateNew();
    } catch (e) {
        if (e.message === "JIGSAW_TIMEOUT") {
            console.log(`Jigsaw branch stuck. Restarting... (Attempt ${15 - attemptsLeft + 1}/15)`);
            setTimeout(() => generateWithRetry(attemptsLeft - 1), 10);
        } else {
            console.error("Generator Error:", e);
        }
    }
};

window.generateNew = () => {
    if (State.jigsawMode || State.suguruMode) {
        const regionCounts = {};
        State.board.forEach(c => {
            regionCounts[c.region] = (regionCounts[c.region] || 0) + 1;
        });

        if (State.jigsawMode) {
            const invalidRegions = Object.values(regionCounts).some(count => count !== State.size);
            if (invalidRegions) {
                alert(`Generation Failed: Jigsaw rules require every painted region to contain exactly ${State.size} cells.`);
                return; 
            }
        } else if (State.suguruMode) {
            const invalidRegions = Object.values(regionCounts).some(count => count > 9);
            if (invalidRegions) {
                alert(`Generation Failed: Suguru regions cannot exceed 9 cells!`);
                return; 
            }
        }

        const label = document.getElementById('status-label');
        if (label) {
            label.textContent = State.suguruMode ? "Generating Suguru..." : "Generating Jigsaw...";
            label.style.color = "var(--text-main)";
        }
        setTimeout(() => generateWithRetry(15), 10);
    } else {
        if (originalGenerateNew) originalGenerateNew();
    }
};

// --- INITIALIZE TOOLTIPS ---
Object.keys(Tooltips).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        const parentLabel = el.closest('label');
        if (parentLabel) {
            parentLabel.title = Tooltips[id];
        } else {
            el.title = Tooltips[id];
        }
    }
});

// --- INITIALIZE DEFAULT STATE ---
window.setTool('pointer');

window.isCustomTitle = false;

setTimeout(() => {
    const titleEl = document.getElementById('puzzle-title');
    if (titleEl) {
        titleEl.addEventListener('input', () => {
            window.isCustomTitle = true;
        });
    }
}, 200);

window.updateDynamicTitle = () => {
    if (window.isCustomTitle || State.isPlayOnly) return;

    const activeTypes = new Set();
    
    if (State.variants) {
        State.variants.forEach(v => {
            if (v.type === 'thermo') activeTypes.add('Thermo');
            if (v.type === 'whisper') activeTypes.add('German Whisper');
            if (v.type === 'killer') activeTypes.add('Killer');
            if (v.type.startsWith('kropki')) activeTypes.add('Kropki');
        });
    }
    
    if (State.jigsawMode) activeTypes.add('Jigsaw');
    if (State.suguruMode) activeTypes.add('Suguru');
    if (State.antiKnight) activeTypes.add('Anti-Knight');
    if (State.antiKing) activeTypes.add('Anti-King');
    if (document.getElementById('rule-sandwich')?.checked) activeTypes.add('Sandwich');
    if (document.getElementById('rule-skyscraper')?.checked) activeTypes.add('Skyscraper');
    if (document.getElementById('rule-frames')?.checked) activeTypes.add('Frames');
    if (document.getElementById('rule-rooms')?.checked) activeTypes.add('Rooms');
    
    const titleEl = document.getElementById('puzzle-title');
    if (titleEl) {
        if (activeTypes.size > 0) {
            titleEl.innerText = Array.from(activeTypes).join(' ') + ' Sudoku';
        } else {
            titleEl.innerText = 'Sudoku Logic'; 
        }
    }
};
