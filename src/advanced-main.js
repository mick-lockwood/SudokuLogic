// src/advanced-main.js
import './classic-main.js'; 
import { State } from './GameState.js';
import * as Renderer from './Renderer.js';
import { drawThermo } from './variants/Thermo.js';
import { drawWhisper } from './variants/Whisper.js';

window.AdvancedState = {
    activeTool: 'pointer',
    isDrawing: false,
    currentLine: []
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

window.undoLastVariantLine = () => {
    if (State.variants.length > 0) {
        State.variants.pop();
        renderSVGLayer();
        Renderer.updateUI();
    }
};

// --- INPUT HIJACKER ---
const originalHandleCellSelection = window.handleCellSelection;

window.handleCellSelection = (index, isMulti, isDragging) => {
    // If the tool is any drawing tool (thermo, whisper, etc), route to drawing logic
    if (['thermo', 'whisper'].includes(window.AdvancedState.activeTool)) {
    handleLineDrawing(index, isDragging);
        
    } else if (window.AdvancedState.activeTool === 'eraser') {
        if (!isDragging) {
            const originalLength = State.variants.length;
            // Delete any variant object whose cells array includes the clicked index
            State.variants = State.variants.filter(v => !v.cells.includes(index));
            
            if (State.variants.length < originalLength) {
                renderSVGLayer();
                Renderer.updateUI();
            }
        }
    } else {
        originalHandleCellSelection(index, isMulti, isDragging);
    }
};

// Generalized to handle any line drawing
function handleLineDrawing(index, isDragging) {
    if (!isDragging) {
        window.AdvancedState.isDrawing = true;
        window.AdvancedState.currentLine = [index];
    } else if (window.AdvancedState.isDrawing) {
        const lastCell = window.AdvancedState.currentLine[window.AdvancedState.currentLine.length - 1];
        if (lastCell !== index && !window.AdvancedState.currentLine.includes(index)) {
            window.AdvancedState.currentLine.push(index);
        }
    }
    renderSVGLayer();
}

window.addEventListener('pointerup', () => {
    if (['thermo', 'whisper'].includes(window.AdvancedState.activeTool) && window.AdvancedState.isDrawing) {
        window.AdvancedState.isDrawing = false;
        
        if (window.AdvancedState.currentLine.length > 1) {
            // Push an OBJECT containing the tool type and the line data
            State.variants.push({
                type: window.AdvancedState.activeTool,
                cells: [...window.AdvancedState.currentLine]
            });
            Renderer.updateUI(); 
        }
        window.AdvancedState.currentLine = [];
        renderSVGLayer();
    }
});

// --- GENERALIZED SVG RENDERER ---
function renderSVGLayer() {
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
}
