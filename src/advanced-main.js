// src/advanced-main.js
import './classic-main.js'; 
import { State } from './GameState.js';
import * as Renderer from './Renderer.js';
import { Tooltips } from './TooltipDictionary.js';

// import variant rules
import { drawThermo } from './variants/Thermo.js';
import { drawWhisper } from './variants/Whisper.js';
import { drawKiller } from './variants/Killer.js';
import { drawKropki } from './variants/Kropki.js';


window.AdvancedState = {
    activeTool: 'pointer',
    isDrawing: false,
    currentLine: [],
    variantUndoStack: [],
    variantRedoStack: []
};

// --- TOOL MANAGER ---
window.setTool = (tool) => {
    window.AdvancedState.activeTool = tool;
    
    // 1. Strip ALL active classes from ALL variant buttons
    document.querySelectorAll('.variant-tool-btn').forEach(btn => {
        btn.classList.remove('active-tool-pointer', 'active-tool-variant', 'active-tool-eraser');
    });

    // 2. Find the clicked button and apply the correct category class
    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) {
        if (tool === 'pointer') {
            activeBtn.classList.add('active-tool-pointer');
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
    // If the tool is any drawing tool (thermo, whisper, etc), route to drawing logic
    if (['thermo', 'whisper','killer', 'kropki-white', 'kropki-black'].includes(window.AdvancedState.activeTool)) {
    handleLineDrawing(index, isDragging);
        
    } else if (window.AdvancedState.activeTool === 'eraser') {
        if (!isDragging) {
            const originalLength = State.variants.length;
            // Calculate the new array without modifying the actual state yet
            const newVariants = State.variants.filter(v => !v.cells.includes(index));
            
            if (newVariants.length < originalLength) {
                // Save a snapshot of the old state, THEN apply the new erased state
                window.saveVariantState(); 
                State.variants = newVariants;
                renderSVGLayer();
                Renderer.updateUI();
            }
        }
    } else {
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

// 1. Keyboard Shortcuts (Esc/V, Undo, Redo)
window.addEventListener('keydown', (e) => {
    if (State.paused || State.isWon) return;
    
    // Drop tool (Escape or V)
    if (e.key === 'Escape' || e.key.toLowerCase() === 'v') {
        if (window.AdvancedState.activeTool !== 'pointer') {
            window.setTool('pointer');
        }
    }

    // Only intercept Undo/Redo if a VARIANT tool is currently selected
    if (window.AdvancedState.activeTool !== 'pointer') {
        
        // Undo: Ctrl + Z (or Cmd + Z)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault(); // Stop standard grid undo
            window.undoVariant();
        }
        
        // Redo: Ctrl + Y OR Ctrl + Shift + Z
        if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || 
            ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault(); // Stop standard grid redo
            window.redoVariant();
        }
    }
});

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

// --- INITIALIZE TOOLTIPS ---
// Loops through the dictionary and applies the text to the matching HTML elements
Object.keys(Tooltips).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.title = Tooltips[id];
}); // <-- CLOSE THE LOOP HERE

// --- INITIALIZE DEFAULT STATE ---
// Force the UI and internal state to sync on page load
window.setTool('pointer');
