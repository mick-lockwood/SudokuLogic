// src/variants/Kropki.js
import { getCellCenter } from '../Renderer.js';
import { State } from '../GameState.js';

export function kropkiConflict(variant, arr, idx, val, isFlatArray = false) {
    const pos = variant.cells.indexOf(idx);
    if (pos === -1) return false;

    // Find the value of the other cell connected to this dot
    const otherPos = pos === 0 ? 1 : 0;
    const otherCell = variant.cells[otherPos];
    const otherVal = isFlatArray ? arr[otherCell] : arr[otherCell].val;

    // If the other cell is empty, no conflict can occur yet
    if (otherVal === 0) return false;

    if (variant.type === 'kropki-white') {
        // White dots: Values must be consecutive (difference of exactly 1)
        if (Math.abs(val - otherVal) !== 1) return true;
    } else if (variant.type === 'kropki-black') {
        // Black dots: One value must be exactly double the other
        if (val !== 2 * otherVal && otherVal !== 2 * val) return true;
    }
    return false;
}

export function drawKropki(variant, svgElement) {
    if (variant.cells.length < 2) return;
    
    // Find the exact midpoint between the two connected cells
    const pt1 = getCellCenter(variant.cells[0]);
    const pt2 = getCellCenter(variant.cells[1]);
    const midX = (pt1.x + pt2.x) / 2;
    const midY = (pt1.y + pt2.y) / 2;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", midX);
    circle.setAttribute("cy", midY);
    circle.setAttribute("r", "8"); // Size of the dot
    circle.setAttribute("stroke-width", "2");

    if (variant.type === 'kropki-white') {
        circle.setAttribute("fill", "#ffffff");
        circle.setAttribute("stroke", "#1e293b"); // Dark border
    } else if (variant.type === 'kropki-black') {
        circle.setAttribute("fill", "#1e293b"); // Dark fill
        // Give it a white border in dark mode so it doesn't vanish
        circle.setAttribute("stroke", State.darkMode ? "#ffffff" : "#1e293b"); 
    }
    
    svgElement.appendChild(circle);
}
