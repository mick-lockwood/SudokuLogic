// src/variants/Killer.js
import { State } from '../GameState.js';

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
    if (variant.cells.length === 0) return;

    const svgRect = svgElement.getBoundingClientRect();
    const inset = 3; // How far the dashed line sits inside the cell border
    const strokeColor = State.darkMode ? "#cbd5e1" : "#475569";

    // 1. Draw the dashed perimeter
    variant.cells.forEach(cellIdx => {
        const el = document.getElementById(`cell-${cellIdx}`);
        if (!el) return;
        
        const cellRect = el.getBoundingClientRect();
        const x = cellRect.left - svgRect.left;
        const y = cellRect.top - svgRect.top;
        const w = cellRect.width;
        const h = cellRect.height;

        const r = Math.floor(cellIdx / State.size);
        const c = cellIdx % State.size;

        // Check if neighboring cells are also inside this cage
        const hasTop = r > 0 && variant.cells.includes(cellIdx - State.size);
        const hasBottom = r < State.size - 1 && variant.cells.includes(cellIdx + State.size);
        const hasLeft = c > 0 && variant.cells.includes(cellIdx - 1);
        const hasRight = c < State.size - 1 && variant.cells.includes(cellIdx + 1);

        const drawLine = (x1, y1, x2, y2) => {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1); line.setAttribute("y1", y1);
            line.setAttribute("x2", x2); line.setAttribute("y2", y2);
            line.setAttribute("stroke", strokeColor);
            line.setAttribute("stroke-width", "2");
            line.setAttribute("stroke-dasharray", "4 4");
            svgElement.appendChild(line);
        };

        if (!hasTop) drawLine(x + inset, y + inset, x + w - inset, y + inset);
        if (!hasBottom) drawLine(x + inset, y + h - inset, x + w - inset, y + h - inset);
        if (!hasLeft) drawLine(x + inset, y + inset, x + inset, y + h - inset);
        if (!hasRight) drawLine(x + w - inset, y + inset, x + w - inset, y + h - inset);
    });

    // 2. Draw the Sum Text in the top-left cell of the cage
    const sortedCells = [...variant.cells].sort((a, b) => a - b);
    const topLeftCell = sortedCells[0];
    
    const el = document.getElementById(`cell-${topLeftCell}`);
    if (el && variant.sum) {
        const cellRect = el.getBoundingClientRect();
        const x = cellRect.left - svgRect.left;
        const y = cellRect.top - svgRect.top;
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x + 5);
        text.setAttribute("y", y + 13);
        text.setAttribute("font-size", "11");
        text.setAttribute("font-weight", "800");
        text.setAttribute("fill", strokeColor);
        text.textContent = variant.sum;
        svgElement.appendChild(text);
    }
}
