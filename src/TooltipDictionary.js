// src/TooltipDictionary.js

export const Tooltips = {
    // Core Tools
    'tool-pointer':
`Select cells and input numbers.\n
Shortcut: Esc or V`,
    
    'tool-eraser':
`Click any drawn variant graphic to delete it.`,
    
    // Variant Tools
    'tool-thermo':
`Numbers must strictly increase
from the bulb to the tip.\n
Click and drag on cells to draw.\n
Line starts with the bulb when drawing.`,
    
    'tool-whisper':
`9x9 puzzle: Adjacent numbers along the line
must have a difference of 5 or more\n
6x6 puzzle: Adjacent numbers along the line
must have a difference of 3 or more\n
Click and drag on cells to draw.`,

    'tool-killer': 
`Digits in a cage must not repeat.
They must exactly sum to the number in the corner.\n
Click and drag on cells to draw cage.\n
Enter target cage sum.`,
    
    'tool-kropki-white': 
`Adjacent cells must have consecutive values.\n
Example: 3 and 4.\n
Click and drag between cells to place.`,
    
    'tool-kropki-black': 
`One cell must be double the value of the other.\n
Example: 3 and 6.\n
Click and drag between cells to place.`,
    
    // Actions    
    'btn-undo-variant': 
`Undo the last drawn variant.\n
Shortcut: Ctrl+Z (While variant tool active)`,
    
    'btn-redo-variant': 
`Redo the last undone variant.\n
Shortcut: Ctrl+Y (While variant tool active)`,
    
    'btn-clear-variants': 
`Instantly clear all variant lines from the board.`
    
};
