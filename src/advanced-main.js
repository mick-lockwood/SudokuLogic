// src/advanced-main.js
import './classic-main.js'; 
import { State } from './GameState.js';
import * as Renderer from './Renderer.js';

window.AdvancedState = {
    activeTool: 'pointer',
    isDrawing: false,
    currentLine: []
};

// --- TOOL MANAGER ---
window.setTool = (tool) => {
    window.AdvancedState.activeTool = tool;
    
    const ptrBtn = document.getElementById('tool-pointer');
    const thmBtn = document.getElementById('tool-thermo');
    const ersBtn = document.getElementById('tool-eraser');
    
    if(!ptrBtn || !thmBtn || !ersBtn) return;

    ptrBtn.classList.remove('active-tool-pointer');
    thmBtn.classList.remove('active-tool-thermo');
    ersBtn.classList.remove('active-tool-eraser');

    if (tool === 'pointer') ptrBtn.classList.add('active-tool-pointer');
    if (tool === 'thermo') thmBtn.classList.add('active-tool-thermo');
    if (tool === 'eraser') ersBtn.classList.add('active-tool-eraser');
    
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
    if (['thermo'].includes(window.AdvancedState.activeTool)) {
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
    if (['thermo'].includes(window.AdvancedState.activeTool) && window.AdvancedState.isDrawing) {
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
    const cellIndices = variant.cells;
    if (cellIndices.length === 0) return;

    const startCenter = Renderer.getCellCenter(cellIndices[0]);

    if (variant.type === 'thermo') {
        const thermoColor = "rgba(160, 174, 192, 0.6)"; 

        const bulb = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bulb.setAttribute("cx", startCenter.x);
        bulb.setAttribute("cy", startCenter.y);
        bulb.setAttribute("r", "18");
        bulb.setAttribute("fill", thermoColor);
        svg.appendChild(bulb);

        if (cellIndices.length > 1) {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            let d = `M ${startCenter.x} ${startCenter.y} `;
            
            for (let i = 1; i < cellIndices.length; i++) {
                const pt = Renderer.getCellCenter(cellIndices[i]);
                d += `L ${pt.x} ${pt.y} `;
            }
            
            path.setAttribute("d", d);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", thermoColor);
            path.setAttribute("stroke-width", "14");
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-linejoin", "round");
            svg.appendChild(path);
        }
    }
}
