// frontend/app.js

/* --- CONFIGURATION & STATE --- */

// REPLACE THIS URL with the one you just copied from API Gateway
const API_URL = "https://st8il6uayb.execute-api.us-east-1.amazonaws.com/dev";

const CONFIG = {
    strings: ['E', 'A', 'D', 'G', 'B', 'e'], 
    colors: { default: '-' }
};

const STATE = {
    userId: null,
    selectedCell: null,
    currentChord: null, // Stores Display Name (e.g. "Cmaj7")
    currentKey: 'C',
    currentQuality: 'Major',
    activeDegreeIdx: null,
    lastDetectedQuality: '', 
    
    // NEW HISTORY TRACKING
    prevRoot: null,
    prevQuality: null,
    currentRoot: null // Explicitly track root for comparison
};

// 1. Add Visualizer State
const VIZ_STATE = {
    showChord: true,
    showPenta: false,
    showDiatonic: false
};

/* --- PLAYBACK STATE --- */
const PLAYBACK = {
    isPlaying: false,
    timerId: null,
    currentStep: 0,
    cells: [] // To store the list of DOM elements we will iterate over
};

const PALETTE_STATE = [
    { qIdx: 0, sIdx: 0 }, { qIdx: 0, sIdx: 0 }, { qIdx: 0, sIdx: 0 },
    { qIdx: 0, sIdx: 0 }, { qIdx: 0, sIdx: 0 }, { qIdx: 0, sIdx: 0 }, { qIdx: 0, sIdx: 0 }
];

const UNIVERSAL_QUALITIES = [
    '', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', 'dim', 'aug', 'm7b5', '6', 'm6', '9'
];

const EXPLORER_STATE = {
    qIdx: 0, 
    sIdx: 0,
    lastRoot: null
};

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/* --- SCALES & RULES --- */
const SCALE_FORMULAS = {
    'Major': [0, 2, 4, 5, 7, 9, 11],
    'Minor': [0, 2, 3, 5, 7, 8, 10]
};

// Defines the default chord quality for each degree in the scale
const DIATONIC_PATTERNS = {
    'Major': [
        { type: '',     label: 'I' },
        { type: 'm',    label: 'ii' },
        { type: 'm',    label: 'iii' },
        { type: '',     label: 'IV' },
        { type: '',     label: 'V' },
        { type: 'm',    label: 'vi' },
        { type: 'dim',  label: 'vii°' }
    ],
    'Minor': [
        { type: 'm',    label: 'i' },
        { type: 'dim',  label: 'ii°' },
        { type: '',     label: 'III' },
        { type: 'm',    label: 'iv' },
        { type: 'm',    label: 'v' },
        { type: '',     label: 'VI' },
        { type: '',     label: 'VII' }
    ]
};

// Defines the ALLOWED extensions/variations for the Palette
const DEGREE_RULES = {
    'Major': [
        { label: 'I',   qualities: ['', 'maj7', 'maj9', 'add9'] },
        { label: 'ii',  qualities: ['m', 'm7', 'm9', 'm11'] },
        { label: 'iii', qualities: ['m', 'm7', 'm11'] }, 
        { label: 'IV',  qualities: ['', 'maj7', 'maj9', 'add9'] },
        { label: 'V',   qualities: ['', '7', '9', '13'] }, 
        { label: 'vi',  qualities: ['m', 'm7', 'm9', 'm11'] },
        { label: 'vii°',qualities: ['dim', 'm7b5'] } 
    ],
    'Minor': [
        { label: 'i',   qualities: ['m', 'm7', 'm9', 'm11'] },
        { label: 'ii°', qualities: ['dim', 'm7b5'] },
        { label: 'III', qualities: ['', 'maj7', 'maj9', 'add9'] },
        { label: 'iv',  qualities: ['m', 'm7', 'm9', 'm11'] },
        { label: 'v',   qualities: ['m', 'm7', 'm9', 'm11'] }, // Natural minor v is minor
        { label: 'VI',  qualities: ['', 'maj7', 'maj9', 'add9'] },
        { label: 'VII', qualities: ['', '7', '9', '13'] } // VII acts as dominant-like in natural minor
    ]
};

/* --- EXPANDED CHORD FORMULAS (v3 - Shell Voicings) --- */
const CHORD_FORMULAS_MAP = {
    // --- DYADS ---
    '5':          { intervals: [0, 7] },
    '(no5)':      { intervals: [0, 4] },
    'm(no5)':     { intervals: [0, 3] },
    '(b5)':       { intervals: [0, 6] },

    // --- TRIADS ---
    '':           { intervals: [0, 4, 7] },      // Major
    'm':          { intervals: [0, 3, 7] },      // Minor
    'dim':        { intervals: [0, 3, 6] },
    'aug':        { intervals: [0, 4, 8] },
    'sus2':       { intervals: [0, 2, 7] },
    'sus4':       { intervals: [0, 5, 7] },

    // --- 7th CHORDS ---
    'maj7':       { intervals: [0, 4, 7, 11] },
    'maj7(no5)':  { intervals: [0, 4, 11] },
    'm7':         { intervals: [0, 3, 7, 10] },
    // Note: We use a unique key for the shell version so it exists in the map
    'm7(no5)':    { intervals: [0, 3, 10], name: "m7" }, 
    '7':          { intervals: [0, 4, 7, 10] },
    '7(no5)':     { intervals: [0, 4, 10] },
    'dim7':       { intervals: [0, 3, 6, 9] },
    'm7b5':       { intervals: [0, 3, 6, 10] },
    'm(maj7)':    { intervals: [0, 3, 7, 11] },
    '6':          { intervals: [0, 4, 7, 9] },
    'm6':         { intervals: [0, 3, 7, 9] },

    // --- 9th CHORDS ---
    'add9':       { intervals: [0, 2, 4, 7] },
    '9':          { intervals: [0, 2, 4, 7, 10] },
    '9(no5)':     { intervals: [0, 2, 4, 10] },
    'maj9':       { intervals: [0, 2, 4, 7, 11] },
    'maj9(no5)':  { intervals: [0, 2, 4, 11] },
    'm9':         { intervals: [0, 2, 3, 7, 10] },
    'm9(no5)':    { intervals: [0, 2, 3, 10], name: "m9" },
    
    // --- ALTERED 9s ---
    '7b9':        { intervals: [0, 1, 4, 7, 10] },
    '7b9(no5)':   { intervals: [0, 1, 4, 10] },
    '7#9':        { intervals: [0, 3, 4, 7, 10] },
    '7#9(no5)':   { intervals: [0, 3, 4, 10] },

    // --- 11th & 13th ---
    '11':         { intervals: [0, 2, 4, 5, 7, 10] },
    'm11':        { intervals: [0, 2, 3, 5, 7, 10] },
    'm11(no5)':   { intervals: [0, 2, 3, 5, 10] },
    'maj7#11':    { intervals: [0, 4, 6, 7, 11] },
    '13':         { intervals: [0, 2, 4, 7, 9, 10] },
    '13(no5)':    { intervals: [0, 2, 4, 9, 10] }
};

// Convert Map to Array for the Detection Algorithm to iterate over
const CHORD_FORMULAS_ARRAY = Object.keys(CHORD_FORMULAS_MAP).map(key => {
    return { 
        name: CHORD_FORMULAS_MAP[key].name || key, // Use override name if exists (e.g. m7 shell), else key
        intervals: CHORD_FORMULAS_MAP[key].intervals 
    };
});

/* --- HELPER CONSTANT FOR COLORS --- */
const CATEGORY_CLASSES = ['cat-major', 'cat-minor', 'cat-dominant', 'cat-dim', 'cat-aug', 'cat-sus'];

/* --- INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
    initSession();
    initFretboard();
    initVisualizerFretboard(); 
    initTimeline();
    setupEventListeners();
    
    // Manually trigger the key logic so the Palette and Diatonic scales load immediately
    generateKeyPalette(); 
    // Force the visualizer to calculate the diatonic scale for C Major immediately
    updateVisualizerBoard(null); 
});

/* --- 1. KEY PALETTE LOGIC (Using ChordGenerator) --- */
function generateKeyPalette() {
    const keySelect = document.getElementById('keySelect');
    // Value format: "C-Major" or "A-Minor"
    const [keyRoot, keyQuality] = keySelect.value.split('-'); 
    
    // Update State
    STATE.currentKey = keyRoot;
    STATE.currentQuality = keyQuality;

    const container = document.getElementById('keyChordPalette');
    if (!container) return;
    container.innerHTML = ''; 

    // Ask The Brain for valid chords
    const paletteData = MusicTheory.getDiatonicChords(keyRoot, keyQuality);

    paletteData.forEach((data, degreeIdx) => {
        // Ensure state exists
        if (!PALETTE_STATE[degreeIdx]) PALETTE_STATE[degreeIdx] = { qIdx: 0, sIdx: 0 };
        const state = PALETTE_STATE[degreeIdx];

        // Safety wrap
        if (state.qIdx >= data.qualities.length) state.qIdx = 0;
        
        const currentQuality = data.qualities[state.qIdx];
        
        // Generate Shapes
        const generatedShapes = ChordGenerator.generate(data.root, currentQuality);
        
        // Safety wrap shape index
        if (state.sIdx >= generatedShapes.length) state.sIdx = 0;

        // --- RENDER CARD ---
        const card = document.createElement('div');
        const isActive = (STATE.activeDegreeIdx === degreeIdx);
        card.className = isActive ? 'chord-control-card selected' : 'chord-control-card';
        
        card.innerHTML = `
            <div class="card-degree">${data.label}</div>
            <div class="card-main">
                <div class="card-arrow vert up" data-dir="up">▲</div>
                <div class="card-mid-row">
                    <div class="card-arrow horz left" data-dir="left">◀</div>
                    <div class="card-chord-name">
                        <span class="root">${data.root}</span><span class="qual">${currentQuality}</span>
                    </div>
                    <div class="card-arrow horz right" data-dir="right">▶</div>
                </div>
                <div class="card-arrow vert down" data-dir="down">▼</div>
            </div>
            <div class="card-shape-name">Var ${state.sIdx + 1}/${Math.max(1, generatedShapes.length)}</div>
        `;

        // Arrow Listeners (Type vs Variation)
        card.querySelectorAll('.card-arrow').forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                STATE.activeDegreeIdx = degreeIdx;
                const dir = arrow.dataset.dir;

                if (dir === 'up' || dir === 'down') {
                    // CYCLE CHORD TYPES (e.g. maj -> maj7 -> add9)
                    if (dir === 'up') state.qIdx = (state.qIdx + 1) % data.qualities.length;
                    else state.qIdx = (state.qIdx - 1 + data.qualities.length) % data.qualities.length;
                    state.sIdx = 0; // Reset shape when type changes
                } else {
                    // CYCLE VARIATIONS (Fretboard shapes)
                    // We need to re-generate to know length
                    const tempShapes = ChordGenerator.generate(data.root, data.qualities[state.qIdx]);
                    if (tempShapes.length > 0) {
                        if (dir === 'right') state.sIdx = (state.sIdx + 1) % tempShapes.length;
                        else state.sIdx = (state.sIdx - 1 + tempShapes.length) % tempShapes.length;
                    }
                }
                
                // Draw immediately
                const newQ = data.qualities[state.qIdx];
                const newShapes = ChordGenerator.generate(data.root, newQ);
                if (newShapes[state.sIdx]) drawGeneratedShape(newShapes[state.sIdx]);
                
                generateKeyPalette(); // Re-render UI
            });
        });

        // Card Click Listener
        card.addEventListener('click', () => {
            STATE.activeDegreeIdx = degreeIdx;
            const shape = generatedShapes[state.sIdx];
            if(shape) drawGeneratedShape(shape);
            generateKeyPalette();
        });

        container.appendChild(card);
    });
}

// Draw Function for the Generator's Array Output
function drawGeneratedShape(shapeArray) {
    // shapeArray is [Str6Fret, Str5Fret, ... Str1Fret] (Low E to High e)
    // DOM Rows are [High e ... Low E] (Index 0 to 5)
    
    // 1. Clear Board
    document.querySelectorAll('.fret-cell.active').forEach(c => c.classList.remove('active'));

    if (!shapeArray) return;

    const fretboardRows = document.querySelectorAll('.string-row'); 
    
    // We must reverse the shape array to match the DOM rows
    const visualFrets = [...shapeArray].reverse();

    visualFrets.forEach((fret, rIndex) => {
        if (fret === null) return; // Mute

        const row = fretboardRows[rIndex];
        // nth-child logic: Nut is child 1. Fret 1 is child 2.
        // So fret X is child X+1.
        const cell = row.children[fret]; // 0 is Nut
        
        if (cell) cell.classList.add('active');
    });

    if(typeof updateDetectedChord === 'function') updateDetectedChord();
}

/* --- 2. ALGORITHMIC CHORD DETECTION (FINAL VERSION) --- */
function updateDetectedChord() {
    const activeCells = document.querySelectorAll('.fret-cell.active');
    const primaryDisplay = document.getElementById('primaryChord');
    const primaryDetails = document.getElementById('primaryDetails');
    const secondaryList = document.getElementById('secondaryChords');
    const emotionDisplay = document.getElementById('chordEmotion');
    const emotionBox = document.querySelector('.emotion-box');
    const recsBox = document.querySelector('.recs-box'); 

    secondaryList.innerHTML = '';
    primaryDisplay.style.color = ""; 

    // --- CASE 1: NO NOTES SELECTED ---
    if (activeCells.length === 0) {
        primaryDisplay.textContent = "-";
        primaryDetails.textContent = "Select notes on the fretboard";
        secondaryList.innerHTML = '<span class="empty-state">...</span>';
        emotionDisplay.textContent = "Play a chord to hear its story.";
        recsBox.innerHTML = `<div class="empty-state">Select a chord to see recommended movements.</div>`;
        emotionBox.className = 'emotion-box'; 
        
        // Reset CURRENT 
        STATE.currentChord = null;
        STATE.lastDetectedQuality = ''; 
        
        // Clear Visualizer & Explorer
        if (typeof updateVisualizerBoard === 'function') updateVisualizerBoard(null);
        if (typeof updateExplorerCard === 'function') updateExplorerCard(null, null);
        
        return;
    }

    // --- 1. GATHER NOTES & PRELOAD AUDIO ---
    let noteObjects = [];
    let audioPreloadData = []; 

    activeCells.forEach(cell => {
        // Data for Theory Engine
        noteObjects.push({
            val: parseInt(cell.dataset.noteValue),
            stringIndex: parseInt(cell.dataset.stringIndex)
        });
        
        // Data for Audio Engine (String Index 0-5 Logic)
        audioPreloadData.push({
            stringIndex: 5 - parseInt(cell.dataset.stringIndex), 
            fret: parseInt(cell.dataset.fret)
        });
    });
    
    // Sort logic data
    noteObjects.sort((a, b) => b.stringIndex - a.stringIndex);

    // TRIGGER PRELOAD: Start downloading audio immediately
    if (audioPreloadData.length > 0) {
        AudioManager.preload(audioPreloadData);
    }

    // --- 2. DETECT CHORD ---
    const result = MusicTheory.detectChord(noteObjects);

    // --- CASE 2: UNKNOWN SHAPE ---
    if (!result) {
        primaryDisplay.textContent = "?";
        primaryDetails.textContent = "Unknown Shape";
        emotionDisplay.textContent = "...";
        recsBox.innerHTML = '<div class="empty-state">No Recs</div>';
        
        STATE.currentChord = null;
        
        // Clear Visualizer & Explorer
        if (typeof updateVisualizerBoard === 'function') updateVisualizerBoard(null);
        if (typeof updateExplorerCard === 'function') updateExplorerCard(null, null);
        return;
    }

    // --- 3. MANAGE HISTORY ---
    const { primary, alternatives } = result;

    // Only update history if the chord ACTUALLY changed
    if (STATE.currentRoot !== primary.root || STATE.lastDetectedQuality !== primary.quality) {
        // The old "Current" becomes the "Previous"
        STATE.prevRoot = STATE.currentRoot;
        STATE.prevQuality = STATE.lastDetectedQuality;
        
        // Update Current
        STATE.currentRoot = primary.root;
        STATE.lastDetectedQuality = primary.quality;
        STATE.currentChord = primary.displayName;
    }

    // --- 4. UPDATE UI ---
    primaryDisplay.textContent = primary.displayName;
    primaryDetails.textContent = primary.family + " Family"; 
    
    // Emotion & Color
    const emotionText = MusicTheory.getChordEmotion(primary.root, primary.quality, STATE.currentKey);
    emotionDisplay.innerHTML = emotionText;
    emotionBox.className = 'emotion-box'; 
    emotionBox.classList.add(getChordColorClass(primary.quality));

    // Update Visualizer (Bottom Fretboard)
    if (typeof updateVisualizerBoard === 'function') updateVisualizerBoard(primary);
    
    // Update Explorer Card (Top Left Active Control)
    if (typeof updateExplorerCard === 'function') updateExplorerCard(primary.root, primary.quality);

    // Alternatives
    if (alternatives.length === 0) {
        secondaryList.innerHTML = '<span class="empty-state">No alternatives</span>';
    } else {
        alternatives.forEach(alt => {
            let name = alt.name;
            if (alt.isSlash) name += `/${alt.bass}`;
            const tag = document.createElement('div');
            tag.className = 'alt-chord-tag';
            tag.textContent = name;
            tag.addEventListener('click', () => {
                primaryDisplay.textContent = name;
                primaryDetails.textContent = "Alt: " + alt.family;
                STATE.currentChord = name;
            });
            secondaryList.appendChild(tag);
        });
    }

    // --- 5. GET RECOMMENDATIONS (WITH HISTORY) ---
    try {
        const suggestions = HarmonicEngine.getRecommendations(
            primary.root,
            primary.quality,
            STATE.currentKey,     
            STATE.currentQuality,
            STATE.prevRoot,      // Pass Previous Root
            STATE.prevQuality    // Pass Previous Quality
        );
        
        renderRecommendations(suggestions, true);
        
    } catch (e) {
        console.error("Harmonic Engine Error:", e);
    }
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/* --- 3. SESSION & HELPER LOGIC --- */
function initSession() {
    const userIdDisplay = document.getElementById('userIdDisplay');
    let savedId = localStorage.getItem('cloud_guitar_user');
    if (!savedId) {
        savedId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('cloud_guitar_user', savedId);
    }
    STATE.userId = savedId;
    userIdDisplay.textContent = `User: ${STATE.userId}`;
}

// --- FRETBOARD INIT (Standard logic) ---
const STRING_START_INDICES = {
    'e': 4, 'B': 11, 'G': 7, 'D': 2, 'A': 9, 'E': 4
};

function initFretboard() {
    const fretboardContainer = document.getElementById('fretboard');
    fretboardContainer.innerHTML = ''; 
    fretboardContainer.className = 'fretboard-container'; 

    const numberRow = document.createElement('div');
    numberRow.className = 'fret-numbers';
    for (let i = 1; i <= 12; i++) {
        const numDiv = document.createElement('div');
        numDiv.className = 'fret-number';
        numDiv.textContent = i;
        numberRow.appendChild(numDiv);
    }
    fretboardContainer.appendChild(numberRow);

    const neckWrapper = document.createElement('div');
    neckWrapper.className = 'neck-wrapper';

    const labelCol = document.createElement('div');
    labelCol.className = 'string-labels';
    const displayStrings = [...CONFIG.strings].reverse();
    displayStrings.forEach(note => {
        const label = document.createElement('div');
        label.className = 'string-name';
        label.textContent = note;
        labelCol.appendChild(label);
    });
    neckWrapper.appendChild(labelCol);

    const grid = document.createElement('div');
    grid.className = 'fret-grid';

    displayStrings.forEach((stringName, sIndex) => {
        const row = document.createElement('div');
        row.className = 'string-row';
        const baseIndex = STRING_START_INDICES[stringName];

        const clearStringSelection = () => {
            row.querySelectorAll('.fret-cell.active').forEach(fret => fret.classList.remove('active'));
        };

        const nutCell = document.createElement('div');
        nutCell.className = 'fret-cell nut';
        nutCell.dataset.noteValue = (baseIndex + 0) % 12; 
        nutCell.dataset.stringIndex = sIndex; 
        nutCell.dataset.fret = 0;
        const nutMarker = document.createElement('div');
        nutMarker.className = 'note-marker';
        nutMarker.textContent = CHROMATIC_SCALE[nutCell.dataset.noteValue]; 
        nutCell.appendChild(nutMarker);

        // Inside initFretboard -> Nut Listener
        nutCell.addEventListener('click', () => {
            if (!nutCell.classList.contains('active')) clearStringSelection();
            nutCell.classList.toggle('active');
            
            // PLAY SOUND
            if (nutCell.classList.contains('active')) {
                // FLIP: DOM index 0 (High e) -> Audio index 5
                // FLIP: DOM index 5 (Low E) -> Audio index 0
                const audioStringIndex = 5 - sIndex; 
                AudioManager.playNote(audioStringIndex, 0);
            }
            
            updateDetectedChord();
        });
        row.appendChild(nutCell);

        for (let fret = 1; fret <= 12; fret++) {
            const cell = document.createElement('div');
            cell.className = 'fret-cell regular';
            cell.dataset.noteValue = (baseIndex + fret) % 12;
            cell.dataset.stringIndex = sIndex; 
            cell.dataset.fret = fret;
            const noteName = CHROMATIC_SCALE[cell.dataset.noteValue];
            const marker = document.createElement('div');
            marker.className = 'note-marker';
            marker.textContent = noteName; 
            cell.appendChild(marker);

            const isMiddle = (sIndex === 2);
            const isFlanking = (sIndex === 1 || sIndex === 3);
            if (fret === 12 && isFlanking) {
                 cell.appendChild(createInlay());
            } else if ([3, 5, 7, 9].includes(fret) && isMiddle) {
                 const dot = createInlay();
                 dot.style.top = '100%'; 
                 cell.appendChild(dot);
            }

            // Inside initFretboard -> Regular Fret Listener
            cell.addEventListener('click', () => {
                if (!cell.classList.contains('active')) clearStringSelection();
                cell.classList.toggle('active');

                // PLAY SOUND
                if (cell.classList.contains('active')) {
                    const audioStringIndex = 5 - sIndex;
                    AudioManager.playNote(audioStringIndex, fret);
                }

                updateDetectedChord();
            });

            row.appendChild(cell);
        }
        grid.appendChild(row);
    });

    neckWrapper.appendChild(grid);
    fretboardContainer.appendChild(neckWrapper);
}

function createInlay() {
    const div = document.createElement('div');
    div.className = 'inlay-dot';
    return div;
}

/* --- NEW: VISUALIZER LOGIC --- */

// 1. Initialize the Visualizer Board (Run once on load)
function initVisualizerFretboard() {
    const container = document.getElementById('fretboardVisualizer');
    if(!container) return;
    container.innerHTML = ''; 

    // --- 1. ADD NUMBER ROW (NEW) ---
    // We reuse the 'fret-numbers' class so it aligns perfectly with the main board
    const numberRow = document.createElement('div');
    numberRow.className = 'fret-numbers';
    
    for (let i = 1; i <= 12; i++) {
        const numDiv = document.createElement('div');
        numDiv.className = 'fret-number';
        numDiv.textContent = i;
        // Optional: Make them slightly more transparent/distinct if desired
        numDiv.style.opacity = "0.7"; 
        numberRow.appendChild(numDiv);
    }
    container.appendChild(numberRow);
    // -------------------------------

    // 2. Reuse neck wrapper structure
    const neckWrapper = document.createElement('div');
    neckWrapper.className = 'neck-wrapper';

    // Labels
    const labelCol = document.createElement('div');
    labelCol.className = 'string-labels';
    [...CONFIG.strings].reverse().forEach(note => {
        const label = document.createElement('div');
        label.className = 'string-name';
        label.textContent = note;
        labelCol.appendChild(label);
    });
    neckWrapper.appendChild(labelCol);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'fret-grid';

    [...CONFIG.strings].reverse().forEach((stringName, sIndex) => {
        const row = document.createElement('div');
        row.className = 'string-row';
        const baseIndex = STRING_START_INDICES[stringName];

        // Create Nut + 12 Frets
        for (let fret = 0; fret <= 12; fret++) {
            const isNut = (fret === 0);
            const cell = document.createElement('div');
            cell.className = isNut ? 'fret-cell nut' : 'fret-cell regular';
            
            // Store data for lookup
            const noteValue = (baseIndex + fret) % 12;
            cell.dataset.vizNote = noteValue; // Unique ID for finding this note

            // Add Inlays (Visual only)
            if (!isNut) {
                const isMiddle = (sIndex === 2);
                const isFlanking = (sIndex === 1 || sIndex === 3);
                if (fret === 12 && isFlanking) cell.appendChild(createInlay());
                else if ([3, 5, 7, 9].includes(fret) && isMiddle) {
                    const dot = createInlay();
                    dot.style.top = '100%';
                    cell.appendChild(dot);
                }
            }

            // Marker (Hidden by default, shown via CSS .active)
            const marker = document.createElement('div');
            marker.className = 'note-marker';
            marker.textContent = CHROMATIC_SCALE[noteValue];
            cell.appendChild(marker);

            row.appendChild(cell);
        }
        grid.appendChild(row);
    });

    neckWrapper.appendChild(grid);
    container.appendChild(neckWrapper);
}

// 3. Rewrite updateVisualizerBoard (The Heavy Lifter)
function updateVisualizerBoard(primaryChord) {
    const container = document.getElementById('fretboardVisualizer');
    if (!container) return;

    // A. Reset all cells (Remove all layer classes)
    const allCells = container.querySelectorAll('.fret-cell');
    allCells.forEach(cell => {
        cell.classList.remove('layer-chord', 'layer-penta', 'layer-diatonic');
        // Reset marker style overrides we did in CSS
        const marker = cell.querySelector('.note-marker');
        if(marker) marker.style = ""; 
    });

    // B. Get Context Data
    // 1. Current Key Data
    const keySelectVal = document.getElementById('keySelect').value; // "C-Major"
    const [keyRoot, keyQuality] = keySelectVal.split('-');

    // 2. Calculate Scale Arrays (Integers 0-11)
    let chordNotes = [];
    let pentaNotes = [];
    let diatonicNotes = [];

    // CHORD NOTES: From the specific chord detected/selected
    // We use the chord object passed in, OR fallback to current detected
    const targetChordObj = primaryChord || (STATE.currentChord ? { 
        rootVal: MusicTheory.NOTES.indexOf(STATE.currentRoot),
        intervals: MusicTheory.CHORD_DEFINITIONS.find(d => d.name === STATE.lastDetectedQuality)?.intervals || []
    } : null);

    if (targetChordObj && targetChordObj.rootVal !== undefined) {
         chordNotes = targetChordObj.intervals.map(iv => (targetChordObj.rootVal + iv) % 12);
    }

    // PENTATONIC NOTES: Based on KEY
    if (VIZ_STATE.showPenta) {
        pentaNotes = MusicTheory.getScaleNotes(keyRoot, keyQuality, 'pentatonic');
    }

    // DIATONIC NOTES: Based on KEY
    if (VIZ_STATE.showDiatonic) {
        diatonicNotes = MusicTheory.getScaleNotes(keyRoot, keyQuality, 'diatonic');
    }

    // C. Apply Layers to Board
    // Iterate over every cell to check membership
    allCells.forEach(cell => {
        // Skip Nut if it's purely decorative, but usually we map nut too
        if (!cell.dataset.vizNote) return; 

        const noteVal = parseInt(cell.dataset.vizNote);

        // 1. Diatonic Check
        if (VIZ_STATE.showDiatonic && diatonicNotes.includes(noteVal)) {
            cell.classList.add('layer-diatonic');
        }

        // 2. Pentatonic Check
        if (VIZ_STATE.showPenta && pentaNotes.includes(noteVal)) {
            cell.classList.add('layer-penta');
        }

        // 3. Chord Check
        if (VIZ_STATE.showChord && chordNotes.includes(noteVal)) {
            cell.classList.add('layer-chord');
        }
    });
}

/* --- 5. TIMELINE LOGIC (UPDATED WITH DRAG & DROP) --- */
function initTimeline() {
    const timelineRow = document.getElementById('timelineRow');
    const barInput = document.getElementById('barCount');
    const timeSelect = document.getElementById('timeSelect');
    
    timelineRow.innerHTML = ''; 
    STATE.selectedCell = null;

    const bars = parseInt(barInput.value) || 4;
    const beatsPerBar = parseInt(timeSelect.value.split('/')[0]);

    for (let b = 1; b <= bars; b++) {
        const barGroup = document.createElement('div');
        barGroup.className = 'bar-group';
        
        const barTag = document.createElement('span');
        barTag.className = 'bar-label-tag';
        barTag.textContent = `Bar ${b}`;
        barGroup.appendChild(barTag);

        for (let beat = 1; beat <= beatsPerBar; beat++) {
            const cell = document.createElement('div');
            cell.className = 'beat-cell';
            
            // Enable Dragging
            cell.setAttribute('draggable', 'true');

            const label = document.createElement('span');
            label.className = 'cell-label';
            label.textContent = `${b}.${beat}`;
            
            const chordDisplay = document.createElement('span');
            chordDisplay.className = 'cell-chord';
            chordDisplay.textContent = CONFIG.colors.default; 
            
            cell.appendChild(label);
            cell.appendChild(chordDisplay);

            // CLICK LISTENER (Selection & Playback)
            cell.addEventListener('click', () => {
                selectCell(cell);
                if (cell.dataset.voicing) {
                    try {
                        const savedVoicing = JSON.parse(cell.dataset.voicing);
                        loadVoicingToBoard(savedVoicing);
                    } catch (e) { console.error(e); }
                }
            });

            // --- DRAG & DROP LISTENERS ---
            cell.addEventListener('dragstart', handleDragStart);
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);
            cell.addEventListener('dragend', handleDragEnd);
            
            barGroup.appendChild(cell);
        }
        timelineRow.appendChild(barGroup);
    }
}

function selectCell(cellElement) {
    if (STATE.selectedCell) STATE.selectedCell.classList.remove('selected');
    STATE.selectedCell = cellElement;
    STATE.selectedCell.classList.add('selected');
}

// NEW: Loads a saved voicing array back onto the fretboard
function loadVoicingToBoard(voicing) {
    // 1. Clear Board
    document.querySelectorAll('.fret-cell.active').forEach(c => c.classList.remove('active'));

    const fretboardRows = document.querySelectorAll('.string-row'); 
    
    // 2. Repaint Notes
    voicing.forEach(note => {
        const row = fretboardRows[note.sIdx]; // Visual Index
        // Row children: 0=Nut, 1=Fret1 ...
        // Our 'note.fret' is 0 for Nut, 1 for Fret 1.
        // So row.children[note.fret] maps correctly.
        const cell = row.children[note.fret];
        if (cell) cell.classList.add('active');
    });

    // 3. Update Dashboard Text
    updateDetectedChord();
    
    // 4. AUTO-STRUM (The "Play in timeline" feature)
    // We need to convert our saved visual indices to Audio indices (Flip them)
    const audioNotes = voicing.map(n => ({
        stringIndex: 5 - n.sIdx, // Flip visual (0=High) to audio (0=Low)
        fret: n.fret
    }));
    AudioManager.strum(audioNotes);
}

/* --- DRAG AND DROP HANDLERS --- */

let dragSrcEl = null; // Stores the element being dragged

function handleDragStart(e) {
    // Only allow dragging if there is actually a chord in the cell
    const chordText = this.querySelector('.cell-chord').textContent;
    if (chordText === CONFIG.colors.default) {
        e.preventDefault(); // Stop drag if empty
        return;
    }

    dragSrcEl = this;
    
    // Visual: Make it look like it's being lifted
    this.classList.add('dragging');

    // Data: We don't strictly need to transfer data via e.dataTransfer for internal moves,
    // but it's good practice.
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    // Necessary to allow dropping
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    // Visual: Add highlight to the target
    this.classList.add('drag-over');
    return false;
}

function handleDragLeave(e) {
    // Visual: Remove highlight when leaving a box
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation(); 
    }

    if (dragSrcEl !== this) {
        // 1. Capture Data
        const srcData = getCellData(dragSrcEl);
        const targetData = getCellData(this);

        // 2. Swap Content (Text & Voicing)
        setCellData(this, srcData);
        setCellData(dragSrcEl, targetData);

        // 3. Swap Colors (Crucial Fix)
        // First, strip old colors from both
        removeColorClasses(this);
        removeColorClasses(dragSrcEl);

        // Then apply new colors (if they exist in the data we just swapped)
        if (srcData.category) this.classList.add(srcData.category);
        if (targetData.category) dragSrcEl.classList.add(targetData.category);
        
        // Update visual selection highlights
        if(STATE.selectedCell === dragSrcEl) selectCell(this);
    }

    return false;
}

function handleDragEnd(e) {
    // Cleanup visuals on ALL cells
    this.classList.remove('dragging');
    
    document.querySelectorAll('.beat-cell').forEach(cell => {
        cell.classList.remove('drag-over');
    });
}

/* --- HELPERS FOR SWAPPING DATA --- */

// Extracts the musical data (NOT the label like "1.1") from a cell
function getCellData(cell) {
    const chordSpan = cell.querySelector('.cell-chord');
    
    // Find the color class (starts with 'color-')
    let colorClass = null;
    cell.classList.forEach(cls => {
        if (cls.startsWith('color-')) colorClass = cls;
    });

    return {
        chordName: chordSpan.textContent,
        voicing: cell.dataset.voicing || null,
        category: colorClass // This now captures the specific color class
    };
}

// Applies data to a cell
function setCellData(cell, data) {
    const chordSpan = cell.querySelector('.cell-chord');
    
    // 1. Text
    chordSpan.textContent = data.chordName;

    // 2. Voicing Data
    if (data.voicing) {
        cell.dataset.voicing = data.voicing;
    } else {
        delete cell.dataset.voicing;
    }

    // 3. Colors/Classes
    // Reset to base state (keeping selection if applicable)
    const isSelected = cell.classList.contains('selected');
    cell.className = 'beat-cell'; 
    if (isSelected) cell.classList.add('selected');
    
    cell.setAttribute('draggable', 'true');

    // Add the category/color class if it exists
    if (data.chordName !== CONFIG.colors.default && data.category) {
        cell.classList.add(data.category);
    }
}


/* --- 6. EVENT LISTENERS (UPDATED) --- */
function setupEventListeners() {
    // 1. Settings Changes
    document.getElementById('barCount').addEventListener('change', initTimeline);
    document.getElementById('timeSelect').addEventListener('change', initTimeline);
    
    document.getElementById('keySelect').addEventListener('change', () => {
        // Reset Palette state
        PALETTE_STATE.forEach(s => { s.qIdx = 0; s.sIdx = 0; });
        STATE.activeDegreeIdx = null; 
        
        generateKeyPalette();
        
        // FIX: Update visualizer (pass null to force recalculation from State)
        updateVisualizerBoard(null);
    });

    // 2. Add Chord to Timeline
    document.getElementById('addChordBtn').addEventListener('click', () => {
        if (!STATE.currentChord) {
            alert("Select a valid chord first!"); return;
        }
        if (!STATE.selectedCell) {
            alert("Select a timeline cell!"); return;
        }
        
        // Update Text
        const displaySpan = STATE.selectedCell.querySelector('.cell-chord');
        displaySpan.textContent = STATE.currentChord;
        
        // Update Classes & Colors
        STATE.selectedCell.className = 'beat-cell selected'; 
        STATE.selectedCell.setAttribute('draggable', 'true');

        const colorClass = getChordColorClass(STATE.lastDetectedQuality || '');
        STATE.selectedCell.classList.add(colorClass);

        // CAPTURE VOICING (Scoped to Main Fretboard ONLY)
        const activeCells = document.getElementById('fretboard').querySelectorAll('.fret-cell.active');
        const currentVoicing = [];
        
        activeCells.forEach(cell => {
            currentVoicing.push({
                sIdx: parseInt(cell.dataset.stringIndex),
                fret: parseInt(cell.dataset.fret)
            });
        });

        STATE.selectedCell.dataset.voicing = JSON.stringify(currentVoicing);
    });

    // 3. Timeline Management
    document.getElementById('removeChordBtn').addEventListener('click', () => {
        if (!STATE.selectedCell) return;
        
        STATE.selectedCell.querySelector('.cell-chord').textContent = CONFIG.colors.default;
        removeColorClasses(STATE.selectedCell);
        delete STATE.selectedCell.dataset.voicing;
    });

    document.getElementById('clearTimelineBtn').addEventListener('click', () => {
        const confirmClear = confirm("Are you sure you want to clear the entire timeline?");
        if (!confirmClear) return;

        document.querySelectorAll('.beat-cell').forEach(cell => {
            cell.querySelector('.cell-chord').textContent = CONFIG.colors.default;
            removeColorClasses(cell);
            delete cell.dataset.voicing;
        });
    });

    // 4. Fretboard Actions (Moved Buttons)
    document.getElementById('strumBtn').addEventListener('click', () => {
        // Scope to Main Fretboard to avoid playing Visualizer notes
        const activeCells = document.getElementById('fretboard').querySelectorAll('.fret-cell.active');
        
        const notesToPlay = [];
        activeCells.forEach(cell => {
            const visualIndex = parseInt(cell.dataset.stringIndex);
            const logicalIndex = 5 - visualIndex; 
            notesToPlay.push({
                stringIndex: logicalIndex,
                fret: parseInt(cell.dataset.fret)
            });
        });
        
        if (notesToPlay.length > 0) {
            AudioManager.strum(notesToPlay);
        } else {
            alert("Select notes on the fretboard first!");
        }
    });
    
    document.getElementById('clearBoardBtn').addEventListener('click', () => {
        // Only clear main board active states
        document.getElementById('fretboard').querySelectorAll('.fret-cell.active').forEach(c => c.classList.remove('active'));
        updateDetectedChord(); 
    });

    // 5. Visualizer Toggles (The Fix)
    // We pass 'null' to force the function to look at global State variables
    document.getElementById('vizToggleChord').addEventListener('change', (e) => {
        VIZ_STATE.showChord = e.target.checked;
        updateVisualizerBoard(null); 
    });

    document.getElementById('vizTogglePenta').addEventListener('change', (e) => {
        VIZ_STATE.showPenta = e.target.checked;
        updateVisualizerBoard(null);
    });

    document.getElementById('vizToggleDiatonic').addEventListener('change', (e) => {
        VIZ_STATE.showDiatonic = e.target.checked;
        updateVisualizerBoard(null);
    });

    // 6. Persistence & Playback
    document.getElementById('saveBtn').addEventListener('click', handleSave);
    document.getElementById('loadBtn').addEventListener('click', handleLoad);

    document.getElementById('playBtn').addEventListener('click', startPlayback);
    document.getElementById('stopBtn').addEventListener('click', stopPlayback);
    
    // Safety: Stop playback on settings change
    document.getElementById('barCount').addEventListener('change', stopPlayback);
    document.getElementById('timeSelect').addEventListener('change', stopPlayback);
}


// frontend/app.js - Replace existing handleSave

function handleSave() {
    // 1. Capture Global Settings
    const barCount = document.getElementById('barCount').value;
    const timeSig = document.getElementById('timeSelect').value;
    const bpm = document.getElementById('bpmInput').value;
    const key = document.getElementById('keySelect').value;

    // 2. Capture Timeline Data (Including Voicings!)
    const cells = document.querySelectorAll('.beat-cell');
    const timelineData = [];

    cells.forEach(cell => {
        const chordName = cell.querySelector('.cell-chord').textContent;
        const voicingData = cell.dataset.voicing || null; // Get the hidden JSON string
        
        timelineData.push({
            chord: chordName,
            voicing: voicingData // This is the crucial missing piece
        });
    });

    const projectData = {
        progressionId: 'proj_' + Date.now(),
        userId: STATE.userId,
        timestamp: new Date().toISOString(),
        settings: {
            key: key,
            bars: barCount,
            timeSig: timeSig,
            bpm: bpm
        },
        timeline: timelineData
    };

    // UI Feedback
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving...";

    fetch(`${API_URL}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        alert(`Saved successfully!`);
        saveBtn.textContent = originalText;
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Save failed!");
        saveBtn.textContent = originalText;
    });
}

function handleLoad() {
    const userId = STATE.userId;
    const loadBtn = document.getElementById('loadBtn');
    loadBtn.textContent = "Loading...";

    // Fetch projects for this user
    fetch(`${API_URL}/load?userId=${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
        loadBtn.textContent = "📂 Load Project";
        if (data.projects && data.projects.length > 0) {
            showProjectSelectionModal(data.projects);
        } else {
            alert("No saved projects found for this User ID.");
        }
    })
    .catch(err => {
        console.error(err);
        loadBtn.textContent = "📂 Load Project";
    });
}

function showProjectSelectionModal(projects) {
    // Simple prompt for now (You can make a fancy UI modal later)
    // Create a string list of projects
    let list = "Enter the number of the project to load:\n";
    
    // Sort by date (newest first)
    projects.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    projects.forEach((p, index) => {
        const date = new Date(p.timestamp).toLocaleString();
        const key = p.settings ? p.settings.key : "Unknown Key";
        list += `${index + 1}. ${date} - ${key} (${p.progressionId})\n`;
    });

    const selection = prompt(list);
    if (selection) {
        const idx = parseInt(selection) - 1;
        if (projects[idx]) {
            reconstructProject(projects[idx]);
        }
    }
}

function reconstructProject(project) {
    // 1. Restore Settings
    if (project.settings) {
        document.getElementById('keySelect').value = project.settings.key;
        document.getElementById('barCount').value = project.settings.bars;
        document.getElementById('timeSelect').value = project.settings.timeSig;
        document.getElementById('bpmInput').value = project.settings.bpm;
        
        // Trigger changes to update internal state/UI
        document.getElementById('keySelect').dispatchEvent(new Event('change'));
    }

    // 2. Re-Initialize Timeline (Clears the board and sets correct bar count)
    initTimeline(); 

    // 3. Populate Cells
    const timelineCells = document.querySelectorAll('.beat-cell');
    
    // Safety check: ensure saved length matches current grid
    const loopLimit = Math.min(timelineCells.length, project.timeline.length);

    for (let i = 0; i < loopLimit; i++) {
        const savedData = project.timeline[i];
        const cell = timelineCells[i];
        const displaySpan = cell.querySelector('.cell-chord');

        // Restore text
        if (savedData.chord !== CONFIG.colors.default) {
            displaySpan.textContent = savedData.chord;
            
            // Restore Colors
            const category = getChordCategory(savedData.chord);
            cell.classList.add(category);

            // Restore Voicing Data (The magic part)
            if (savedData.voicing) {
                cell.dataset.voicing = savedData.voicing;
            }
        }
    }
    
    alert("Project Loaded Successfully!");
}

/* --- CLOUD RECOMMENDATIONS --- */
function getHarmonicSuggestions() {
    // Get the current Key context
    const [keyRoot, keyQuality] = document.getElementById('keySelect').value.split('-');
    
    // Logic: Let's ask for suggestions based on the LAST chord in the timeline, 
    // or the currently selected chord if the timeline is empty.
    let targetChord = STATE.currentChord;
    
    // If a timeline cell is selected and has a chord, use that as context
    if (STATE.selectedCell) {
        const cellChord = STATE.selectedCell.querySelector('.cell-chord').textContent;
        if (cellChord !== CONFIG.colors.default) {
            targetChord = cellChord;
        }
    }

    if (!targetChord) {
        alert("Please select a chord first to get recommendations.");
        return;
    }

    // Extract the roman numeral logic (Simple parser for now)
    // In a real app, you'd want to map 'C' in 'C Major' to 'I'. 
    // For this demo, let's just ask the API using the Degree Label from your Palette if possible.
    // LIMITATION: Since we detect chords by name (C Major), mapping back to "I" is tricky without more logic.
    // SHORTCUT: We will assume the user clicked a Palette Card recently.
    
    // Let's grab the active degree index from state if available, or default to I
    let degreeLabel = "I"; 
    // (You might want to improve this logic later to strictly map Chord Name -> Degree)

    console.log(`Asking cloud for suggestions after: ${degreeLabel} in ${keyQuality}...`);

    fetch(`${API_URL}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            keyQuality: keyQuality, // "Major" or "Minor"
            degreeLabel: degreeLabel // "I", "V", etc.
        })
    })
    .then(res => res.json())
    .then(data => {
        if(data.suggestions) {
            alert(`Harmonic Suggestions:\nTry moving to: ${data.suggestions.join(', ')}`);
        } else {
            alert("No suggestions found.");
        }
    })
    .catch(err => console.error(err));
}

/* --- HELPER: GET CHORD COLOR CLASS --- */
function getChordColorClass(quality) {
    // QUALITY comes from MusicTheory definitions (e.g., 'm', 'maj7', '7#9')
    
    // 1. Major Family
    if (quality === '' || quality === 'add9') return 'color-major-triad';
    if (quality === 'maj7' || quality === 'maj9') return 'color-major-7';
    if (quality === '6') return 'color-major-6';

    // 2. Minor Family
    if (quality === 'm') return 'color-minor-triad';
    if (quality === 'm7' || quality === 'm9' || quality === 'm6') return 'color-minor-7';
    if (quality === 'm(maj7)') return 'color-minor-dark';

    // 3. Dominant Family
    if (quality === '7') return 'color-dom-7';
    if (quality === '9' || quality === '13') return 'color-dom-9';
    if (quality.includes('b9') || quality.includes('#9') || quality.includes('alt')) return 'color-dom-alt';

    // 4. Suspended / Power
    if (quality.includes('sus')) return 'color-sus';
    if (quality === '5') return 'color-power';

    // 5. Unstable
    if (quality.includes('dim') || quality.includes('m7b5')) return 'color-dim';
    if (quality.includes('aug')) return 'color-aug';

    return 'color-major-triad'; // Fallback
}

/* --- PLAYBACK ENGINE --- */

function startPlayback() {
    if (PLAYBACK.isPlaying) stopPlayback(); // Reset if already playing

    // 1. Gather all cells
    PLAYBACK.cells = Array.from(document.querySelectorAll('.beat-cell'));
    if (PLAYBACK.cells.length === 0) return;

    PLAYBACK.isPlaying = true;
    PLAYBACK.currentStep = 0;

    // 2. Get Speed
    const bpmInput = document.getElementById('bpmInput');
    const bpm = parseInt(bpmInput.value) || 100;
    // Calculate Milliseconds per Beat (60000 / BPM)
    const msPerBeat = 60000 / bpm;

    // 3. Start Loop
    scheduleNextStep(msPerBeat);
}

function stopPlayback() {
    PLAYBACK.isPlaying = false;
    clearTimeout(PLAYBACK.timerId);
    
    // Remove visual "playing" class from all cells
    if (PLAYBACK.cells) {
        PLAYBACK.cells.forEach(cell => cell.classList.remove('playing'));
    }
}

/* --- UPDATED PLAYBACK ENGINE (LOOPING) --- */

function scheduleNextStep(interval) {
    if (!PLAYBACK.isPlaying) return;

    // LOOPING LOGIC:
    // If we reached the end, loop back to start (Step 0)
    if (PLAYBACK.currentStep >= PLAYBACK.cells.length) {
        PLAYBACK.currentStep = 0;
    }

    // --- EXECUTE CURRENT STEP ---
    const cell = PLAYBACK.cells[PLAYBACK.currentStep];
    
    // 1. Visual Cleanup
    // We need to remove 'playing' from the PREVIOUS cell.
    // If currentStep is 0, the "previous" cell was the LAST cell in the array.
    let prevIndex = PLAYBACK.currentStep - 1;
    if (prevIndex < 0) {
        prevIndex = PLAYBACK.cells.length - 1;
    }
    
    // Remove highlight from previous step
    if (PLAYBACK.cells[prevIndex]) {
        PLAYBACK.cells[prevIndex].classList.remove('playing');
    }

    // Highlight Current
    cell.classList.add('playing');
    
    // Scroll into view if needed
    cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    // 2. Play Sound (if voicing exists)
    if (cell.dataset.voicing) {
        try {
            const voicing = JSON.parse(cell.dataset.voicing);
            
            // Convert Visual Index to Audio Index (Flip)
            const audioNotes = voicing.map(n => ({
                stringIndex: 5 - n.sIdx,
                fret: n.fret
            }));
            
            // Strum!
            AudioManager.strum(audioNotes);
            
        } catch (e) {
            console.error("Playback parse error", e);
        }
    }

    // 3. Increment and Schedule Next
    PLAYBACK.currentStep++;
    
    // Check if we are stopped before scheduling next to prevent zombie loops
    if (PLAYBACK.isPlaying) {
        PLAYBACK.timerId = setTimeout(() => scheduleNextStep(interval), interval);
    }
}

/* --- RENDER RECOMMENDATIONS (UPDATED) --- */
function renderRecommendations(suggestions, showHeader = false) {
    const recsBox = document.querySelector('.recs-box');
    recsBox.innerHTML = '';
    
    if (!suggestions || suggestions.length === 0) {
        recsBox.innerHTML = '<div class="empty-state">No standard movements found.</div>';
        return;
    }

    // NEW: ADD HEADER
    if (showHeader) {
        const header = document.createElement('div');
        header.className = 'recs-header';
        header.textContent = "Recommended Movements:";
        header.style.cssText = "position:absolute; top:5px; left:10px; font-size:10px; color:#aaa; text-transform:uppercase; font-weight:bold;";
        recsBox.appendChild(header);
    }

    // Create a container for the cards so they don't overlap the header
    const cardContainer = document.createElement('div');
    cardContainer.className = 'recs-card-container';
    // Style handled in CSS below
    
    suggestions.forEach(rec => {
        // ... (Same Card Creation Logic as before) ...
        const card = document.createElement('div');
        card.className = 'rec-card';
        if(rec.type === 'resolution') card.classList.add('rec-res');
        if(rec.type === 'motion') card.classList.add('rec-motion');
        if(rec.type === 'contrast') card.classList.add('rec-contrast');
        if(rec.type === 'flow') card.classList.add('rec-flow');
        if(rec.type === 'spice') card.classList.add('rec-spice');
        if(rec.type === 'stasis') card.classList.add('rec-stasis');
        
        card.innerHTML = `
            <div class="rec-chord">${rec.name}</div>
            <div class="rec-reason">${rec.reason}</div>
        `;
        
        // ... (Same Click Listener) ...
        card.addEventListener('click', () => {
             const shapes = ChordGenerator.generate(rec.root, rec.quality);
             if(shapes.length > 0) {
                 drawGeneratedShape(shapes[0]);
                 STATE.currentChord = rec.name; 
                 // STATE.currentKey = rec.root; // Keep original key for context!
                 document.getElementById('primaryChord').textContent = rec.name;
                 document.getElementById('primaryDetails').textContent = "Loaded from Suggestion";
                 updateDetectedChord(); 
             }
        });

        cardContainer.appendChild(card);
    });

    recsBox.appendChild(cardContainer);
}

/* --- NEW: ACTIVE EXPLORER CARD --- */
function updateExplorerCard(root, quality) {
    const container = document.getElementById('activeChordContainer');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    if (!root) {
        container.innerHTML = '<div class="empty-state" style="font-size:10px;">Play a chord...</div>';
        return;
    }

    // 1. Sync State (If this is a new chord detection)
    // We try to find the current detected quality in our list to sync the index
    if (root !== EXPLORER_STATE.lastRoot || quality !== UNIVERSAL_QUALITIES[EXPLORER_STATE.qIdx]) {
        EXPLORER_STATE.lastRoot = root;
        const foundIdx = UNIVERSAL_QUALITIES.indexOf(quality);
        EXPLORER_STATE.qIdx = foundIdx !== -1 ? foundIdx : 0; 
        EXPLORER_STATE.sIdx = 0; // Reset variation on new chord
    }

    // 2. Generate Shapes (To know how many variations exist)
    const currentQ = UNIVERSAL_QUALITIES[EXPLORER_STATE.qIdx];
    // Use the *current state* quality for shapes, unless we just detected a mismatch
    // Actually, to keep it simple: We use the DETECTED root/quality for the display,
    // but the ARROWS will use the UNIVERSAL list.
    
    // Check generated shapes count for the label
    const generatedShapes = ChordGenerator.generate(root, quality);
    const varCount = Math.max(1, generatedShapes.length);

    // 3. Render Card
    const card = document.createElement('div');
    card.className = 'chord-control-card explorer';
    
    card.innerHTML = `
        <div class="card-degree">CURRENT</div>
        <div class="card-main">
            <div class="card-arrow vert up" data-dir="up">▲</div>
            <div class="card-mid-row">
                <div class="card-arrow horz left" data-dir="left">◀</div>
                <div class="card-chord-name">
                    <span class="root">${root}</span><span class="qual">${quality}</span>
                </div>
                <div class="card-arrow horz right" data-dir="right">▶</div>
            </div>
            <div class="card-arrow vert down" data-dir="down">▼</div>
        </div>
        <div class="card-shape-name">Var ${EXPLORER_STATE.sIdx + 1}/${varCount}</div>
    `;

    // 4. Attach Listeners
    card.querySelectorAll('.card-arrow').forEach(arrow => {
        arrow.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling
            const dir = arrow.dataset.dir;

            if (dir === 'up' || dir === 'down') {
                // CYCLE QUALITY
                if (dir === 'up') {
                    EXPLORER_STATE.qIdx = (EXPLORER_STATE.qIdx + 1) % UNIVERSAL_QUALITIES.length;
                } else {
                    EXPLORER_STATE.qIdx = (EXPLORER_STATE.qIdx - 1 + UNIVERSAL_QUALITIES.length) % UNIVERSAL_QUALITIES.length;
                }
                EXPLORER_STATE.sIdx = 0; // Reset variation
            } 
            else {
                // CYCLE VARIATION
                // Re-generate to get count
                const shapes = ChordGenerator.generate(root, UNIVERSAL_QUALITIES[EXPLORER_STATE.qIdx]);
                if (shapes.length > 0) {
                    if (dir === 'right') {
                        EXPLORER_STATE.sIdx = (EXPLORER_STATE.sIdx + 1) % shapes.length;
                    } else {
                        EXPLORER_STATE.sIdx = (EXPLORER_STATE.sIdx - 1 + shapes.length) % shapes.length;
                    }
                }
            }

            // 5. TRIGGER UPDATE
            // We calculate the new target chord and draw it. 
            // This will trigger 'updateDetectedChord', which will re-render THIS card.
            const targetQuality = UNIVERSAL_QUALITIES[EXPLORER_STATE.qIdx];
            const targetShapes = ChordGenerator.generate(root, targetQuality);
            
            if (targetShapes[EXPLORER_STATE.sIdx]) {
                drawGeneratedShape(targetShapes[EXPLORER_STATE.sIdx]);
                // Force update manually if needed, but drawGeneratedShape usually calls it
            }
        });
    });

    container.appendChild(card);
}

/* Helper: Finds and removes any class starting with "color-" */
function removeColorClasses(element) {
    const classesToRemove = [];
    element.classList.forEach(cls => {
        if (cls.startsWith('color-')) classesToRemove.push(cls);
    });
    classesToRemove.forEach(cls => element.classList.remove(cls));
}
