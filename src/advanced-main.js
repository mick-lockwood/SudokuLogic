// src/advanced-main.js
import './classic-main.js'; 
import { State } from './GameState.js';
import * as Renderer from './Renderer.js';
import { Tooltips } from './TooltipDictionary.js';
import { resetGenSafety } from './SudokuLogic.js';

// import variant rules
import { drawThermo } from './variants/Thermo.js';
import { drawWhisper } from './variants/Whisper.js';
import { drawKiller } from './variants/Killer.js';
import { drawKropki } from './variants/Kropki.js';

// --- AUTO-RESIZE SVGS ---
// Forces the variant lines to redraw and snap to the correct cells if the screen rotates or resizes
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
    window.AdvancedState.fogLinkSource = null; // Clears active linker selection when changing tools
    
    // 1. Strip ALL active classes from ALL variant buttons
    document.querySelectorAll('.variant-tool-btn').forEach(btn => {
        btn.classList.remove('active-tool-pointer', 'active-tool-variant', 'active-tool-edit', 'active-tool-eraser');
    });

    // 2. Find the clicked button and apply the correct category class
    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) {
        if (tool === 'pointer') {
            activeBtn.classList.add('active-tool-pointer');
        } else if (tool === 'edit' || tool === 'region' || tool === 'fog' || tool === 'fog-link') {
            activeBtn.classList.add('active-tool-edit'); // Added fog tools to the blue styling!
        } else if (tool === 'eraser') {
            activeBtn.classList.add('active-tool-eraser');
        } else {
            activeBtn.classList.add('active-tool-variant');
        }
    }
    
    // 3. Clear the classic grid selection if we switch to drawing/erasing
    if (tool !== 'pointer') {
        State.selected = [];
    }
    
    // 4. FORCE VISUALS TO UPDATE
    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer(); // <-- THE FIX: Shows/hides arrows!
    
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
            
            // THE FIX: Correctly call the imported Renderer
            if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI(); 
        }
        return; 
    }
    
    // --- 2. FOG LINKER LOGIC ---
    else if (tool === 'fog-link' && State.mode === 'create') {
        if (!isClueCell && !isDragging) {
            if (window.AdvancedState.fogLinkSource == null) {
                // Select the source cell FIRST
                window.AdvancedState.fogLinkSource = index;
                if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
                
                // Prompt the setter for the Trigger Digit
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
                        delete State.fogTriggers[index]; // Erase key if left blank
                    }
                    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer(); 
                }, 10);
                
            } else if (window.AdvancedState.fogLinkSource === index) {
                window.AdvancedState.fogLinkSource = null; // Deselect
                if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
            } else {
                // Add/Remove Target Cells
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
    // Clear the redo stack and save a stringified snapshot of the current variants
    window.AdvancedState.variantRedoStack = [];
    window.AdvancedState.variantUndoStack.push(JSON.stringify(State.variants));
};

window.undoVariant = () => {
    if (window.AdvancedState.variantUndoStack.length > 0) {
        // Push the current state to the redo stack, then load the last undo snapshot
        window.AdvancedState.variantRedoStack.push(JSON.stringify(State.variants));
        State.variants = JSON.parse(window.AdvancedState.variantUndoStack.pop());
        renderSVGLayer();
        Renderer.updateUI();
    }
};

window.redoVariant = () => {
    if (window.AdvancedState.variantRedoStack.length > 0) {
        // Push the current state to the undo stack, then load the last redo snapshot
        window.AdvancedState.variantUndoStack.push(JSON.stringify(State.variants));
        State.variants = JSON.parse(window.AdvancedState.variantRedoStack.pop());
        renderSVGLayer();
        Renderer.updateUI();
    }
};

window.clearVariantGraphics = () => {
    if (!confirm("Clear all drawn variant lines?")) return;
    window.saveVariantState(); // Take a snapshot before wiping!
    State.variants = [];
    renderSVGLayer();
    Renderer.updateUI(); 
};

// --- PERIMETER RULE SYNCING ---
window.togglePerimeterRule = () => {
    const isAnyRuleChecked = 
        document.getElementById('rule-sandwich').checked ||
        document.getElementById('rule-skyscraper').checked ||
        document.getElementById('rule-frames').checked ||
        document.getElementById('rule-rooms').checked;

    const outerCluesToggle = document.getElementById('toggle-outer-clues');
    
    // If a rule is turned on, but the grid is hidden, force the grid to show!
    if (isAnyRuleChecked && !outerCluesToggle.checked) {
        outerCluesToggle.checked = true;
        window.toggleOuterClues(); 
    } else {
        if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
        if (typeof window.updateUI === 'function') window.updateUI();
    }
};

// Intercept the master toggle: If it gets turned off, wipe out the child checkboxes!
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

// --- MASTER INPUT HIJACKER (Multi-Digit + Fog Reveal) ---
const originalHandleInput = window.handleInput;

window.handleInput = (val) => {
    const primary = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
    
    // --- 1. OUTER CLUE MULTI-DIGIT LOGIC ---
    if (typeof primary === 'string' && primary.startsWith('clue')) {
        if (!State.clues) State.clues = {};
        if (val === 0 || val === '0') {
            State.clues[primary] = ""; 
        } else {
            const current = State.clues[primary] || "";
            State.clues[primary] = (current.length >= 2) ? val.toString() : current + val.toString();
        }
        if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
        return; // Stop here!
    } 

    // --- 2. INNER CELL LOGIC ---
    else {
        // --- NEW: FOG INPUT BLOCKER ---
        // Prevents the user from guessing digits or leaving pencil marks inside active fog
        if (State.mode === 'solve' && State.fogMode && primary !== null) {
            if (State.fogMap[primary] && !State.fogRevealed[primary]) {
                return; // Kills the input instantly!
            }
        }
        
        // --- 2. FOG HYBRID REVEAL LOGIC (RUNS FIRST!) ---
        if (State.mode === 'solve' && State.fogMode && !State.pencil && val != 0 && primary !== null) {
            
            const primaryKey = String(primary);
            let isCorrect = false;

            // CHECK 1: Did the setter explicitly demand a specific digit here?
            if (State.fogTriggers && State.fogTriggers[primaryKey] !== undefined) {
                isCorrect = (val == State.fogTriggers[primaryKey]);
            } 
            // CHECK 2: Fallback to the auto-generated math solution
            else if (State.solution && State.solution[primary] !== undefined) {
                isCorrect = (val == State.solution[primary]);
            }

            // If either condition passes, push back the clouds!
            if (isCorrect) {
                if (!State.fogRevealed) State.fogRevealed = Array(State.size * State.size).fill(false);
                if (!State.fogLinks) State.fogLinks = {};

                // HYBRID LOGIC: Follow custom paths or default 3x3
                if (State.fogLinks[primaryKey] && State.fogLinks[primaryKey].length > 0) {
                    State.fogLinks[primaryKey].forEach(targetIdx => {
                        State.fogRevealed[targetIdx] = true;
                    });
                } else {
                    const r = Math.floor(primary / State.size);
                    const c = primary % State.size;
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
        
        // --- 3. CLASSIC INNER CELL LOGIC ---
        // Run the standard 1-9 logic safely
        try {
            if (originalHandleInput) originalHandleInput(val);
        } catch(e) { console.error("Classic Input Error:", e); }
        
        // --- 4. FORCE UI UPDATE ---
        if (typeof Renderer !== 'undefined' && Renderer.updateUI) {
            Renderer.updateUI();
        }
    }
};

// --- GLOBAL RULE TOGGLES ---
window.toggleAntiKnight = () => {
    State.antiKnight = document.getElementById('toggle-anti-knight').checked;
    console.log("Anti-Knight Rule is now:", State.antiKnight);
    
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI();
};

window.toggleAntiKing = () => {
    State.antiKing = document.getElementById('toggle-anti-king').checked;
    console.log("Anti-King Rule is now:", State.antiKing);
    
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI(); 
};

// --- FOG OF WAR LOGIC ---

window.toggleFogMode = () => {
    State.fogMode = document.getElementById('toggle-fog').checked;
    const fogBtn = document.getElementById('tool-fog');
    const fogLinkBtn = document.getElementById('tool-fog-link');
    const clearFogBtn = document.getElementById('btn-clear-fog'); // <-- Grab the new button
    
    if (State.fogMode) {
        if (fogBtn) fogBtn.style.display = 'block';
        if (fogLinkBtn) fogLinkBtn.style.display = 'block';
        if (clearFogBtn) clearFogBtn.style.display = 'block'; // <-- Show it
        window.setTool('fog');
    } else {
        if (fogBtn) fogBtn.style.display = 'none';
        if (fogLinkBtn) fogLinkBtn.style.display = 'none';
        if (clearFogBtn) clearFogBtn.style.display = 'none'; // <-- Hide it
        if (['fog', 'fog-link'].includes(window.AdvancedState.activeTool)) {
            window.setTool('pointer');
        }
    }
    if (typeof window.updateGameRules === 'function') window.updateGameRules();
    if (typeof window.updateUI === 'function') window.updateUI();
};

window.clearFogData = () => {
    if (!confirm("Are you sure you want to clear all painted fog, custom links, and trigger keys?")) return;

    // 1. Wipe the memory arrays and objects clean
    State.fogMap = Array(State.size * State.size).fill(false);
    State.fogRevealed = Array(State.size * State.size).fill(false);
    State.fogLinks = {};
    State.fogTriggers = {};

    // 2. Drop the linker focus so you don't have a ghost cell selected
    window.AdvancedState.fogLinkSource = null;

    // 3. Force the SVG layer and main UI to redraw instantly
    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
    if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
};

// --- GRID MODIFICATION TOGGLES ---

window.toggleJigsawMode = () => {
    State.jigsawMode = document.getElementById('toggle-jigsaw').checked;
    
    // --- MUTUAL EXCLUSIVITY ---
    if (State.jigsawMode) {
        document.getElementById('toggle-suguru').checked = false;
        State.suguruMode = false;
    }

    updateRegionPainterState();
};

window.toggleSuguruMode = () => {
    State.suguruMode = document.getElementById('toggle-suguru').checked;
    
    // --- MUTUAL EXCLUSIVITY ---
    if (State.suguruMode) {
        document.getElementById('toggle-jigsaw').checked = false;
        State.jigsawMode = false;
    }

    updateRegionPainterState();
};

// --- RESET REGIONS BUTTON ---
window.resetRegions = () => {
    // Failsafe: Only run if we are actually in an irregular mode
    if (!State.jigsawMode && !State.suguruMode) return; 

    // Loop through all 81 cells and mathematically snap them back to their classic boxes
    State.board.forEach((cell, i) => {
        const r = Math.floor(i / State.size);
        const c = i % State.size;
        const boxIndex = Math.floor(r / State.bH) * (State.size / State.bW) + Math.floor(c / State.bW);
        cell.region = `box-${boxIndex}`;
    });

    // Force the physical borders and UI overlays to update instantly
    if (typeof Renderer !== 'undefined' && Renderer.renderGrid) {
        Renderer.renderGrid();
        Renderer.updateUI();
    }
};

// --- SHARED PAINTER LOGIC ---
function updateRegionPainterState() {
    const regionToolBtn = document.getElementById('tool-region');
    const resetRegionsBtn = document.getElementById('btn-reset-regions'); // <-- Grab the new button
    
    if (State.jigsawMode || State.suguruMode) {
        if (regionToolBtn) regionToolBtn.style.display = 'block';
        if (resetRegionsBtn) resetRegionsBtn.style.display = 'block'; // <-- Show it
        window.setTool('region'); 
    } else {
        if (regionToolBtn) regionToolBtn.style.display = 'none';
        if (resetRegionsBtn) resetRegionsBtn.style.display = 'none'; // <-- Hide it
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

        // If the user drags back over the previous cell, "pop" the mistake off the line
        if (index === prevCell) {
            line.pop();
        } 
        // Otherwise, if it's a new cell, add it to the line
        else if (lastCell !== index && !line.includes(index)) {
            line.push(index);
        }
    }
    renderSVGLayer();
}

window.addEventListener('pointerup', () => {
    const tool = window.AdvancedState.activeTool;
    
    // --- NEW: SANITIZE SEVERED JIGSAW REGIONS ---
    // Runs the flood-fill to find disjoint pieces and renames them so the engine doesn't break!
    if (tool === 'region') {
        const visited = new Set();
        const newRegions = Array(State.size * State.size).fill(null);
        let nextId = 0;
        
        for (let i = 0; i < State.size * State.size; i++) {
            if (visited.has(i)) continue;
            
            const originalId = State.board[i].region;
            const baseName = originalId.split('_chunk_')[0]; // Prevents names from getting infinitely long
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
        
        // Permanently apply the clean, disjoint IDs
        for (let i = 0; i < State.size * State.size; i++) {
            State.board[i].region = newRegions[i];
        }
        
        // Force the physical borders to snap into place
        if (typeof Renderer !== 'undefined' && Renderer.renderGrid) {
            Renderer.renderGrid();
            Renderer.updateUI();
        }
    }
    // ----------------------------------------------
    
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
                // KROPKI LOGIC: Create a separate dot for every pair of adjacent cells you dragged across
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
                // THERMO & WHISPER LOGIC
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
    
    // Draw the active line being dragged
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
            
            // Draw Arrows
            State.fogLinks[sourceIdx].forEach(targetIdx => {
                const targetPos = Renderer.getCellCenter(targetIdx);
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", sourcePos.x); line.setAttribute("y1", sourcePos.y);
                line.setAttribute("x2", targetPos.x); line.setAttribute("y2", targetPos.y);
                line.setAttribute("stroke", "#ec4899"); line.setAttribute("stroke-width", "3");
                line.setAttribute("stroke-dasharray", "5,5"); line.setAttribute("marker-end", "url(#fog-arrow)");
                svg.appendChild(line);
            });

            // Draw the Setter's Trigger Key!
            if (State.fogTriggers && State.fogTriggers[sourceIdx]) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", sourcePos.x - 22);
                text.setAttribute("y", sourcePos.y - 12);
                text.setAttribute("fill", "#a855f7"); // Purple to match the source box
                text.setAttribute("font-size", "14px");
                text.setAttribute("font-weight", "900");
                text.style.pointerEvents = "none";
                text.textContent = `🔑 ${State.fogTriggers[sourceIdx]}`;
                svg.appendChild(text);
            }
        });
    }
    // ---------------------------------

    // Update the title every time the SVG layer redraws!
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

// 1. Unified Keyboard Shortcuts (Undo, Redo, Esc, Delete, Zero)
// We use `true` for the capture phase to intercept keys BEFORE classic-main.js processes them!
window.addEventListener('keydown', (e) => {
    if (State.paused || State.isWon) return;
    
    const isZ = e.key.toLowerCase() === 'z';
    const isY = e.key.toLowerCase() === 'y';
    const isCtrl = e.ctrlKey || e.metaKey;

    // --- A. UNDO & REDO (CTRL + Z / CTRL + Y) ---
    if (isCtrl && (isZ || isY)) {
        e.preventDefault();
        e.stopImmediatePropagation(); // Block classic-main's old undo/redo logic
        
        // REDO: Ctrl+Y or Ctrl+Shift+Z
        if (isY || (isZ && e.shiftKey)) {
            if (window.AdvancedState.activeTool !== 'pointer') {
                window.redoVariant();
            } else if (typeof window.triggerRedo === 'function') {
                window.triggerRedo();
            }
        } 
        // UNDO: Ctrl+Z
        else if (isZ && !e.shiftKey) {
            if (window.AdvancedState.activeTool !== 'pointer') {
                window.undoVariant();
            } else if (typeof window.triggerUndo === 'function') {
                window.triggerUndo();
            }
        }
        return;
    }

    // --- B. BLOCK CLASSIC'S OLD 'Z' KEY ---
    // If the user presses just 'z' (without Ctrl), we swallow it so it doesn't fire classic's old undo
    if (!isCtrl && isZ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
    }

    // --- C. THE '0' KEY FIX ---
    if (e.key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation(); // Stop classic from treating '0' as an erase command!
        
        const primary = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
        if (typeof primary === 'string' && primary.startsWith('clue')) {
            if (!State.clues) State.clues = {};
            const current = State.clues[primary] || "";
            
            // Allow appending '0' to make 10, 20, 30, etc.
            if (current.length < 2 && current.length > 0) {
                State.clues[primary] = current + "0";
                if (typeof window.updateUI === 'function') window.updateUI();
            }
        }
        return; // If it's a standard grid cell, '0' is ignored natively
    }

    // --- D. BACKSPACE / DELETE ---
    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        const primary = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
        
        if (typeof primary === 'string' && primary.startsWith('clue')) {
            if (!State.clues) State.clues = {};
            const current = State.clues[primary] || "";
            
            // UX Bonus: Backspace removes 1 digit at a time instead of wiping the whole thing
            State.clues[primary] = current.slice(0, -1);
            if (typeof window.updateUI === 'function') window.updateUI();
        } else {
            // If it's a standard 9x9 cell, tell the engine to run the standard erase logic
            if (typeof window.handleInput === 'function') window.handleInput(0);
        }
        return;
    }

    // --- NEW: PENCIL TOGGLE (Tab) ---
    if (e.key === 'Tab') {
        e.preventDefault(); // Crucial: Stops the browser from changing focus!
        e.stopImmediatePropagation();
        
        State.pencil = !State.pencil;
        
        // Re-render the numpad to update the button highlight
        if (typeof Renderer !== 'undefined' && Renderer.renderNumpad) {
            Renderer.renderNumpad();
        } else if (typeof window.updateUI === 'function') {
            window.updateUI(); 
        }
        return;
    }
    
    // --- E. DROP TOOL (Esc / V) ---
    if (e.key === 'Escape' || e.key.toLowerCase() === 'v') {
        if (window.AdvancedState.activeTool !== 'pointer') {
            window.setTool('pointer');
        }
    }
}, true); // <-- 'true' enables the Capture Phase!

// 2. Intercept Mode Switching to hide tools and reset to pointer
const originalSetAppMode = window.setAppMode;

window.setAppMode = (m) => {
    // --- FOG PLAYTEST RESET ---
    if (m === 'solve') {
        State.fogRevealed = Array(State.size * State.size).fill(false);
    }
    
    // Run classic mode switch safely
    try {
        if (originalSetAppMode) originalSetAppMode(m);
    } catch(e) { console.error("Classic Engine Error:", e); }
    
    // Hide Variant Tools in solve mode
    const variantPanel = document.getElementById('variant-tools-panel');
    if (variantPanel) variantPanel.style.display = (m === 'create') ? 'flex' : 'none';
    
    // Drop the linker tool
    window.setTool('pointer');
    
    // --- THE FIX: DELAYED ABSOLUTE WIPE ---
    // Guarantees the SVG layer is scrubbed clean AFTER the classic engine finishes loading!
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
    // 1. Check if there is currently any data that would be lost
    const hasNumbers = State.board && State.board.some(c => c.val !== 0);
    const hasVariants = State.variants && State.variants.length > 0;
    const hasFog = State.fogMap && State.fogMap.some(f => f === true); // Did they paint any fog?

    if (hasNumbers || hasVariants || hasFog) {
        if (!confirm("Changing grid size will clear your current board, variant rules, and fog data. Continue?")) {
            return; // Abort if the user clicks 'Cancel'
        }
    }

    // 2. Clear variants data before the swap
    State.variants = [];
    window.AdvancedState.variantUndoStack = [];
    window.AdvancedState.variantRedoStack = [];

    // 3. Run the original classic grid swap logic
    if (originalSetGridSize) originalSetGridSize(s);
    
    // --- 4. NEW: WIPE & RESIZE FOG DATA ---
    // Mathematically scale the new arrays to the new board size (e.g., 6x6 = 36, 9x9 = 81)
    State.fogMap = Array(s * s).fill(false);
    State.fogRevealed = Array(s * s).fill(false);
    State.fogLinks = {};
    State.fogTriggers = {};
    window.AdvancedState.fogLinkSource = null;

    // 5. Force the UI to clear its visuals
    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
    if (typeof Renderer !== 'undefined' && Renderer.updateUI) Renderer.updateUI();
};

// --- JIGSAW GENERATOR SAFETY INTERCEPTOR ---
const originalGenerateNew = window.generateNew;

const generateWithRetry = (attemptsLeft) => {
    if (attemptsLeft <= 0) {
        // If it fails 15 times, the shape is mathematically impossible to fill. Clean up.
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
        // If it finishes without throwing an error, we are successfully done!
    } catch (e) {
        if (e.message === "JIGSAW_TIMEOUT") {
            console.log(`Jigsaw branch stuck. Restarting... (Attempt ${15 - attemptsLeft + 1}/15)`);
            
            // Wait 10 milliseconds before retrying so the browser doesn't freeze
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
            // Suguru only cares that a region isn't mathematically impossible (> 9 cells)
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
// Loops through the dictionary and applies the text to the matching HTML elements
Object.keys(Tooltips).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        // If the element is wrapped in a <label>, apply the tooltip to the whole row!
        const parentLabel = el.closest('label');
        if (parentLabel) {
            parentLabel.title = Tooltips[id];
        } else {
            el.title = Tooltips[id];
        }
    }
});

// --- INITIALIZE DEFAULT STATE ---
// Force the UI and internal state to sync on page load
window.setTool('pointer');

// --- AUTO-TITLE GENERATOR ---
window.isCustomTitle = false;

// Listen for manual user edits to lock the title
setTimeout(() => {
    const titleEl = document.getElementById('puzzle-title');
    if (titleEl) {
        titleEl.addEventListener('input', () => {
            window.isCustomTitle = true;
        });
    }
}, 200);

window.updateDynamicTitle = () => {
    // Don't overwrite if the user typed something manually or if playing a loaded puzzle
    if (window.isCustomTitle || State.isPlayOnly) return;

    const activeTypes = new Set();
    
    // 1. Check drawn variants
    if (State.variants) {
        State.variants.forEach(v => {
            if (v.type === 'thermo') activeTypes.add('Thermo');
            if (v.type === 'whisper') activeTypes.add('German Whisper');
            if (v.type === 'killer') activeTypes.add('Killer');
            if (v.type.startsWith('kropki')) activeTypes.add('Kropki');
        });
    }
    
    // 2. Check global rules
    if (State.jigsawMode) activeTypes.add('Jigsaw');
    if (State.suguruMode) activeTypes.add('Suguru');
    if (State.antiKnight) activeTypes.add('Anti-Knight');
    if (State.antiKing) activeTypes.add('Anti-King');
    if (document.getElementById('rule-sandwich')?.checked) activeTypes.add('Sandwich');
    if (document.getElementById('rule-skyscraper')?.checked) activeTypes.add('Skyscraper');
    if (document.getElementById('rule-frames')?.checked) activeTypes.add('Frames');
    if (document.getElementById('rule-rooms')?.checked) activeTypes.add('Rooms');
    
    // 3. Update the HTML
    const titleEl = document.getElementById('puzzle-title');
    if (titleEl) {
        if (activeTypes.size > 0) {
            // Joins the unique names together (e.g., "German Whisper Anti-Knight Sudoku")
            titleEl.innerText = Array.from(activeTypes).join(' ') + ' Sudoku';
        } else {
            titleEl.innerText = 'Sudoku Logic'; // Reverts to default if everything is erased
        }
    }
};
