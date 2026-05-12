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
    
    // 1. Strip ALL active classes from ALL variant buttons
    document.querySelectorAll('.variant-tool-btn').forEach(btn => {
        btn.classList.remove('active-tool-pointer', 'active-tool-variant', 'active-tool-edit', 'active-tool-eraser');
    });

    // 2. Find the clicked button and apply the correct category class
    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) {
        if (tool === 'pointer') {
            activeBtn.classList.add('active-tool-pointer');
        } else if (tool === 'edit' || tool === 'region') {
            activeBtn.classList.add('active-tool-edit');
        } else if (tool === 'eraser') {
            activeBtn.classList.add('active-tool-eraser');
        } else {
            // Catch-all: Thermos, Whispers, and any future variants become purple
            activeBtn.classList.add('active-tool-variant');
        }
    }
    
    // 3. Clear the classic grid selection if we switch to drawing/erasing
    if (tool !== 'pointer') {
        State.selected = [];
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

    if (['thermo', 'whisper','killer', 'kropki-white', 'kropki-black'].includes(window.AdvancedState.activeTool)) {
        handleLineDrawing(index, isDragging);
    } 
        
    // --- NEW: REGION PAINTER LOGIC ---
    else if (window.AdvancedState.activeTool === 'region') {
        if (!isClueCell) { // Prevent painting outer perimeter clues
            if (!isDragging) {
                // Clicking a new cell starts a brand new region!
                window.AdvancedState.currentRegionId = `jigsaw-${Date.now()}`;
                State.board[index].region = window.AdvancedState.currentRegionId;
            } else if (window.AdvancedState.currentRegionId) {
                // Dragging continues applying the same region ID
                State.board[index].region = window.AdvancedState.currentRegionId;
            }
            
            // We must force a grid re-render so the thick borders update instantly
            if (typeof Renderer.renderGrid === 'function') Renderer.renderGrid();
            Renderer.updateUI(); 
        }
    }
        
    // --- EDIT LOGIC ---
    else if (window.AdvancedState.activeTool === 'edit') {
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
                            Renderer.updateUI();
                        }
                    }
                }, 10);
            }
        }
    } 
    // --------------------
        
    // --- ERASER LOGIC ---
    else if (window.AdvancedState.activeTool === 'eraser') {
        if (!isDragging) {
            const originalLength = State.variants.length;
            const newVariants = State.variants.filter(v => !v.cells.includes(index));
            if (newVariants.length < originalLength) {
                window.saveVariantState(); 
                State.variants = newVariants;
                renderSVGLayer();
                Renderer.updateUI();
            }
        }
    }
    // --------------------
    else {
        // This will now handle both regular cell selection AND our new clue selection
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

// --- MULTI-DIGIT INPUT HIJACKER ---
// Allows typing "4" then "5" to make "45" in the outer cells
const originalHandleInput = window.handleInput;
window.handleInput = (val) => {
    const primary = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
    
    // Check if the user is currently focused on an outer clue cell
    if (typeof primary === 'string' && primary.startsWith('clue')) {
        if (!State.clues) State.clues = {};
        
        if (val === 0) {
            State.clues[primary] = ""; // Erase on pressing 0 or Delete
        } else {
            const current = State.clues[primary] || "";
            // If it's already 2 digits long, start over. Otherwise, append the number!
            if (current.length >= 2) {
                State.clues[primary] = val.toString(); 
            } else {
                State.clues[primary] = current + val.toString();
            }
        }
        if (typeof window.updateUI === 'function') window.updateUI();
    } else {
        // If it's a normal inner cell, run the standard 1-9 logic
        if (originalHandleInput) originalHandleInput(val);
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

// --- GRID MODIFICATION TOGGLES ---
window.toggleJigsawMode = () => {
    State.jigsawMode = document.getElementById('toggle-jigsaw').checked;
    
    const regionToolBtn = document.getElementById('tool-region');
    
    if (State.jigsawMode) {
        // Show the Region Painter tool
        if (regionToolBtn) regionToolBtn.style.display = 'block';
    } else {
        // Hide the Region Painter tool
        if (regionToolBtn) regionToolBtn.style.display = 'none';
        
        // If the user was holding the painter tool, force them back to the pointer
        if (window.AdvancedState.activeTool === 'region') {
            window.setTool('pointer');
        }
        
        // --- THE RESET SWITCH ---
        // Instantly revert all cells back to classic 3x3 box regions
        State.board.forEach((cell, i) => {
            const r = Math.floor(i / State.size);
            const c = i % State.size;
            const boxIndex = Math.floor(r / State.bH) * (State.size / State.bW) + Math.floor(c / State.bW);
            cell.region = `box-${boxIndex}`;
        });
        
        // Force the grid to redraw its standard borders
        if (typeof Renderer.renderGrid === 'function') Renderer.renderGrid();
    }
    
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI();
};

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
    if (window.AdvancedState.currentLine.length > 0) {
        drawVariantLine({
            type: window.AdvancedState.activeTool,
            cells: window.AdvancedState.currentLine
        });
    }
    
    // Update the title every time the SVG layer redraws! ---
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
    // Run the classic mode switching logic first
    originalSetAppMode(m);
    
    // Hide or show the Variant Tools panel based on the mode
    const variantPanel = document.getElementById('variant-tools-panel');
    if (variantPanel) {
        variantPanel.style.display = (m === 'create') ? 'flex' : 'none';
    }
    
    // Always default back to the Number Input tool when switching modes
    window.setTool('pointer');
};

// --- GRID SIZE INTERCEPTOR ---
const originalSetGridSize = window.setGridSize;

window.setGridSize = (s) => {
    // 1. Check if there is currently any data that would be lost
    const hasNumbers = State.board.some(c => c.val !== 0);
    const hasVariants = State.variants.length > 0;

    if (hasNumbers || hasVariants) {
        if (!confirm("Changing grid size will clear your current board and variant rules. Continue?")) {
            return; // Abort if the user clicks 'Cancel'
        }
    }

    // 2. Clear variants data before the swap
    State.variants = [];
    window.AdvancedState.variantUndoStack = [];
    window.AdvancedState.variantRedoStack = [];

    // 3. Run the original classic grid swap logic
    originalSetGridSize(s);
    
    // 4. Force the SVG layer to clear its visuals
    renderSVGLayer();
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
    if (State.jigsawMode) {
        // 1. Count how many cells are in each region
        const regionCounts = {};
        State.board.forEach(c => {
            regionCounts[c.region] = (regionCounts[c.region] || 0) + 1;
        });

        // 2. Check if ANY region has too many or too few cells
        const invalidRegions = Object.values(regionCounts).some(count => count !== State.size);

        if (invalidRegions) {
            alert(`Generation Failed: Jigsaw rules require every painted region to contain exactly ${State.size} cells. Please adjust your regions and try again!`);
            return; 
        }

        // 3. Start the asynchronous retry loop for Jigsaw
        const label = document.getElementById('status-label');
        if (label) {
            label.textContent = "Generating Jigsaw...";
            label.style.color = "var(--text-main)";
        }
        setTimeout(() => generateWithRetry(15), 10); // Give it 15 chances to succeed
    } else {
        // Classic mode runs the original generator flawlessly
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
