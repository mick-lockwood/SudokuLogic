// src/variants/Killer.js
import { State } from '../GameState.js';
import { getCellData } from '../Renderer.js';

export function killerConflict(variant, arr, idx, val, isFlatArray = false) {
    if (!variant.cells.includes(idx)) return false;

    let currentSum = 0;
    let filledCount = 0;
    let hasDuplicate = false;
    let seen = new Set();

    for (let cellIdx of variant.cells) {
        let cellVal = 0;
        
        // If this is the cell we are currently testing, use the injected test value
        if (cellIdx === idx) {
            cellVal = val;
        } else {
            cellVal = isFlatArray ? arr[cellIdx] : arr[cellIdx].val;
        }

        if (cellVal !== 0) {
            currentSum += cellVal;
            filledCount++;
            if (seen.has(cellVal)) hasDuplicate = true;
            seen.add(cellVal);
        }
    }

    // Rule 1: No repeating digits inside a cage
    if (hasDuplicate) return true;

    // Rule 2: The sum of digits cannot exceed the target sum
    if (currentSum > variant.sum) return true;

    // Rule 3: If the cage is completely filled, the sum MUST exactly equal the target
    if (filledCount === variant.cells.length && currentSum !== variant.sum) return true;

    return false;
}

export function drawKiller(variant, svgElement) {
    if (!variant.cells || variant.cells.length === 0) return;

    // STEP 1: Translate the chaotic mix of strings/numbers into pure (r, c) objects
    const parsedCells = variant.cells.map(idx => getCellData(idx));

    // STEP 2: Find the TRUE top-left cell for the label
    // We sort by Row (r) first, then by Column (c). This guarantees the top-left is always first.
    const sortedCells = [...parsedCells].sort((a, b) => {
        if (a.r !== b.r) return a.r - b.r;
        return a.c - b.c;
    });
    
    const topLeftData = sortedCells[0];
    const topLeftEl = document.getElementById(topLeftData.id);

    // Draw the Sum Label
    if (topLeftEl) {
        const svgRect = svgElement.getBoundingClientRect();
        const cellRect = topLeftEl.getBoundingClientRect();
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        // Add a tiny bit of padding so it sits nicely in the top left corner
        text.setAttribute("x", (cellRect.left - svgRect.left) + 3);
        text.setAttribute("y", (cellRect.top - svgRect.top) + 12); 
        text.setAttribute("font-size", "11px");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", State.darkMode ? "#94a3b8" : "#64748b");
        text.setAttribute("style", "pointer-events: none;"); // Prevents text from blocking clicks
        text.textContent = variant.sum;
        svgElement.appendChild(text);
    }

    // STEP 3: Draw the Contiguous Borders
    parsedCells.forEach(cellData => {
        const el = document.getElementById(cellData.id);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const svgRect = svgElement.getBoundingClientRect();
        const x = rect.left - svgRect.left;
        const y = rect.top - svgRect.top;
        const w = rect.width;
        const h = rect.height;

        // SMART NEIGHBOR CHECKING: 
        // Instead of doing math on IDs, we look through our parsed list to see if a neighbor exists at (r, c)
        const hasTop = parsedCells.some(p => p.r === cellData.r - 1 && p.c === cellData.c);
        const hasBottom = parsedCells.some(p => p.r === cellData.r + 1 && p.c === cellData.c);
        const hasLeft = parsedCells.some(p => p.r === cellData.r && p.c === cellData.c - 1);
        const hasRight = parsedCells.some(p => p.r === cellData.r && p.c === cellData.c + 1);

        const strokeColor = State.darkMode ? "#94a3b8" : "#64748b";
        const strokeWidth = "2";
        const dashArray = "4 4";
        const offset = 2; // Pulls the border inside the cell slightly

        // Draw top border
        if (!hasTop) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x + offset); line.setAttribute("y1", y + offset);
            line.setAttribute("x2", x + w - offset); line.setAttribute("y2", y + offset);
            applyStyles(line, strokeColor, strokeWidth, dashArray);
            svgElement.appendChild(line);
        }
        // Draw bottom border
        if (!hasBottom) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x + offset); line.setAttribute("y1", y + h - offset);
            line.setAttribute("x2", x + w - offset); line.setAttribute("y2", y + h - offset);
            applyStyles(line, strokeColor, strokeWidth, dashArray);
            svgElement.appendChild(line);
        }
        // Draw left border
        if (!hasLeft) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x + offset); line.setAttribute("y1", y + offset);
            line.setAttribute("x2", x + offset); line.setAttribute("y2", y + h - offset);
            applyStyles(line, strokeColor, strokeWidth, dashArray);
            svgElement.appendChild(line);
        }
        // Draw right border
        if (!hasRight) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x + w - offset); line.setAttribute("y1", y + offset);
            line.setAttribute("x2", x + w - offset); line.setAttribute("y2", y + h - offset);
            applyStyles(line, strokeColor, strokeWidth, dashArray);
            svgElement.appendChild(line);
        }
    });
}

// Quick helper to keep the drawing code clean
function applyStyles(el, color, width, dash) {
    el.setAttribute("stroke", color);
    el.setAttribute("stroke-width", width);
    el.setAttribute("stroke-dasharray", dash);
    el.setAttribute("stroke-linecap", "round");
}
