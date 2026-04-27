// src/advanced-main.js
import './classic-main.js'; 
import { State } from './GameState.js';
import { getCellCenter } from './Renderer.js';

window.AdvancedState = {
    activeTool: 'pointer',
    isDrawing: false,
    currentLine: [], 
    thermos: []      
};

// --- NEW TOOL MANAGER ---
window.setTool = (tool) => {
    window.AdvancedState.activeTool = tool;
    
    const ptrBtn = document.getElementById('tool-pointer');
    const thmBtn = document.getElementById('tool-thermo');
    const ersBtn = document.getElementById('tool-eraser');
    
    // Reset all buttons
    [ptrBtn, thmBtn, ersBtn].forEach(btn => {
        if(!btn) return;
        btn.classList.remove('active');
        btn.style.background = '#e2e8f0'; 
        btn.style.color = 'var(--dark)';
    });

    // Style the active button
    const activeBtn = document.getElementById(`tool-${tool}`);
    if(activeBtn) {
        activeBtn.classList.add('active');
        if(tool === 'pointer') {
             activeBtn.style.background = ''; // Reverts to CSS default
             activeBtn.style.color = '';
        } else {
             activeBtn.style.background = (tool === 'eraser') ? '#e74c3c' : '#3498db';
             activeBtn.style.color = 'white';
        }
    }
    
    // Clear classic selection to avoid confusion when drawing/erasing
    if (tool !== 'pointer') {
        State.selected = [];
        window.updateUI();
    }
};

window.clearVariantGraphics = () => {
    if (!confirm("Clear all drawn variant lines?")) return;
    window.AdvancedState.thermos = [];
    renderSVGLayer();
};

// --- NEW UNDO LOGIC ---
window.undoLastVariantLine = () => {
    if (window.AdvancedState.thermos.length > 0) {
        window.AdvancedState.thermos.pop();
        renderSVGLayer();
    }
};

// --- UPDATED INPUT HIJACKER ---
const originalHandleCellSelection = window.handleCellSelection;

window.handleCellSelection = (index, isMulti, isDragging) => {
    if (window.AdvancedState.activeTool === 'thermo') {
        handleThermoDrawing(index, isDragging);
    } else if (window.AdvancedState.activeTool === 'eraser') {
        // ERASER LOGIC: If you click a cell, remove any thermo that passes through it
        if (!isDragging) {
            const originalLength = window.AdvancedState.thermos.length;
            window.AdvancedState.thermos = window.AdvancedState.thermos.filter(thermo => !thermo.includes(index));
            
            // Only re-render if we actually deleted something
            if (window.AdvancedState.thermos.length < originalLength) {
                renderSVGLayer();
            }
        }
    } else {
        originalHandleCellSelection(index, isMulti, isDragging);
    }
};

// 4. DRAWING LOGIC
function handleThermoDrawing(index, isDragging) {
    if (!isDragging) {
        // Start a new line on first click
        window.AdvancedState.isDrawing = true;
        window.AdvancedState.currentLine = [index];
    } else if (window.AdvancedState.isDrawing) {
        // Dragging into a new cell
        const lastCell = window.AdvancedState.currentLine[window.AdvancedState.currentLine.length - 1];
        
        // Only add the cell if it's not the one we are already on, and we haven't crossed it before
        if (lastCell !== index && !window.AdvancedState.currentLine.includes(index)) {
            window.AdvancedState.currentLine.push(index);
        }
    }
    renderSVGLayer();
}

// Listen for mouse/touch release anywhere on the screen to finish the line
window.addEventListener('pointerup', () => {
    if (window.AdvancedState.activeTool === 'thermo' && window.AdvancedState.isDrawing) {
        window.AdvancedState.isDrawing = false;
        
        // Only save it if it's more than just a single bulb
        if (window.AdvancedState.currentLine.length > 1) {
            window.AdvancedState.thermos.push([...window.AdvancedState.currentLine]);
        }
        window.AdvancedState.currentLine = [];
        renderSVGLayer();
    }
});

// 5. RENDER THE SVG GRAPHICS
function renderSVGLayer() {
    const svg = document.getElementById('svg-layer');
    if (!svg) return;
    svg.innerHTML = ''; // Clear canvas

    // Draw saved thermos
    window.AdvancedState.thermos.forEach(drawThermo);

    // Draw the one currently being dragged
    if (window.AdvancedState.currentLine.length > 0) {
        drawThermo(window.AdvancedState.currentLine);
    }
}

function drawThermo(cellIndices) {
    const svg = document.getElementById('svg-layer');
    if (cellIndices.length === 0) return;

    const bulbCenter = getCellCenter(cellIndices[0]);
    const thermoColor = "rgba(160, 174, 192, 0.6)"; // A nice glassy grey

    // Draw the Bulb (Starts at the first clicked cell)
    const bulb = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bulb.setAttribute("cx", bulbCenter.x);
    bulb.setAttribute("cy", bulbCenter.y);
    bulb.setAttribute("r", "18");
    bulb.setAttribute("fill", thermoColor);
    svg.appendChild(bulb);

    // Draw the Stem (Connects the rest of the cells)
    if (cellIndices.length > 1) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let d = `M ${bulbCenter.x} ${bulbCenter.y} `;
        
        for (let i = 1; i < cellIndices.length; i++) {
            const pt = getCellCenter(cellIndices[i]);
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
