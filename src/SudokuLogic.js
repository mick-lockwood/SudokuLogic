import { State } from './GameState.js';

export function hasConflict(arr, idx, val) {
    if (val === 0) return false;
    const r = Math.floor(idx / State.size), c = idx % State.size;
    const br = Math.floor(r / State.bH) * State.bH, bc = Math.floor(c / State.bW) * State.bW;
    
    for (let i = 0; i < State.size * State.size; i++) {
        if (i === idx || arr[i].val !== val) continue;
        const tr = Math.floor(i / State.size), tc = i % State.size;
        if (tr === r || tc === c || (tr >= br && tr < br + State.bH && tc >= bc && tc < bc + State.bW)) return true;
    }
    return false;
}

export function hasConflictGen(arr, idx, val) {
    const r = Math.floor(idx / State.size), c = idx % State.size;
    const br = Math.floor(r / State.bH) * State.bH, bc = Math.floor(c / State.bW) * State.bW;

    for (let i = 0; i < State.size; i++) {
        if (arr[r * State.size + i] === val) return true;
        if (arr[i * State.size + c] === val) return true;
        
        let boxRow = br + Math.floor(i / State.bW);
        let boxCol = bc + (i % State.bW);
        if (arr[boxRow * State.size + boxCol] === val) return true;
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
