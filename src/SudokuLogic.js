// src/SudokuLogic.js
import { State } from './GameState.js';
import { thermoConflict } from './variants/Thermo.js';
import { whisperConflict } from './variants/Whisper.js';
import { killerConflict } from './variants/Killer.js';

export function hasConflict(arr, idx, val) {
    if (val === 0) return false;
    const r = Math.floor(idx / State.size), c = idx % State.size;
    const br = Math.floor(r / State.bH) * State.bH, bc = Math.floor(c / State.bW) * State.bW;
    
    // 1. Standard Rules
    for (let i = 0; i < State.size * State.size; i++) {
        if (i === idx || arr[i].val !== val) continue;
        const tr = Math.floor(i / State.size), tc = i % State.size;
        if (tr === r || tc === c || (tr >= br && tr < br + State.bH && tc >= bc && tc < bc + State.bW)) return true;
    }

    // 2. Variant Rules Loop
    if (State.variants && State.variants.length > 0) {
        for (let v of State.variants) {
            if (v.type === 'thermo' && thermoConflict(v, arr, idx, val, false)) return true;
            if (v.type === 'whisper' && whisperConflict(v, arr, idx, val, false)) return true;
            if (v.type === 'killer' && killerConflict(v, arr, idx, val, false)) return true;
        }
    }
    return false;
}

export function hasConflictGen(arr, idx, val) {
    const r = Math.floor(idx / State.size), c = idx % State.size;
    const br = Math.floor(r / State.bH) * State.bH, bc = Math.floor(c / State.bW) * State.bW;

    // 1. Standard Rules
    for (let i = 0; i < State.size; i++) {
        if (arr[r * State.size + i] === val) return true;
        if (arr[i * State.size + c] === val) return true;
        
        let boxRow = br + Math.floor(i / State.bW);
        let boxCol = bc + (i % State.bW);
        if (arr[boxRow * State.size + boxCol] === val) return true;
    }

    // 2. Variant Rules Loop
    if (State.variants && State.variants.length > 0) {
        for (let v of State.variants) {
            if (v.type === 'thermo' && thermoConflict(v, arr, idx, val, true)) return true;
            if (v.type === 'whisper' && whisperConflict(v, arr, idx, val, true)) return true;
            if (v.type === 'killer' && killerConflict(v, arr, idx, val, true)) return true;
        }
    }
    return false;
}

export function getCount(num) { 
    return State.board.filter((c, i) => c.val === num && !hasConflict(State.board, i, num)).length; 
}

export function cleanPencilsAfterMove(idx, val) {
    const r = Math.floor(idx / State.size), c = idx % State.size;
    const br = Math.floor(r / State.bH) * State.bH, bc = Math.floor(c / State.bW) * State.bW;

    State.board.forEach((cell, i) => {
        const tr = Math.floor(i / State.size), tc = i % State.size;
        if (tr === r || tc === c || (tr >= br && tr < br + State.bH && tc >= bc && tc < bc + State.bW)) {
            const noteIdx = cell.notes.indexOf(val);
            if (noteIdx > -1) cell.notes.splice(noteIdx, 1);
        }
    });
}

export function countSolutions(boardArray, count = 0) {
    let pos = boardArray.indexOf(0);
    if (pos === -1) return count + 1;

    for (let n = 1; n <= State.size; n++) { 
        if (!hasConflictGen(boardArray, pos, n)) {
            boardArray[pos] = n;
            count = countSolutions(boardArray, count);
            boardArray[pos] = 0;
            if (count > 1) return count; 
        }
    }
    return count;
}
