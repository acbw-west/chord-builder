/* frontend/music_theory.js */

const MusicTheory = (() => {

    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // --- 1. CHORD FAMILIES & DEFINITIONS ---
    // The "Genealogy" of chords. Used for Detection and Generation.
    const CHORD_DEFINITIONS = [
        // 3-Note Chords
        { name: '',       family: 'Major',     intervals: [0, 4, 7],       priority: 10 },
        { name: 'm',      family: 'Minor',     intervals: [0, 3, 7],       priority: 10 },
        { name: 'dim',    family: 'Diminished',intervals: [0, 3, 6],       priority: 9 },
        { name: 'aug',    family: 'Augmented', intervals: [0, 4, 8],       priority: 8 },
        { name: 'sus2',   family: 'Suspended', intervals: [0, 2, 7],       priority: 9 },
        { name: 'sus4',   family: 'Suspended', intervals: [0, 5, 7],       priority: 9 },
        { name: '5',      family: 'Power',     intervals: [0, 7],          priority: 8 },

        // 4-Note Chords (7ths)
        { name: 'maj7',   family: 'Major',     intervals: [0, 4, 7, 11],   priority: 20 },
        { name: '7',      family: 'Dominant',  intervals: [0, 4, 7, 10],   priority: 20 },
        { name: 'm7',     family: 'Minor',     intervals: [0, 3, 7, 10],   priority: 20 },
        { name: 'm(maj7)',family: 'Minor',     intervals: [0, 3, 7, 11],   priority: 18 },
        { name: 'dim7',   family: 'Diminished',intervals: [0, 3, 6, 9],    priority: 19 }, // Full dim
        { name: 'm7b5',   family: 'Diminished',intervals: [0, 3, 6, 10],   priority: 19 }, // Half dim
        { name: '6',      family: 'Major',     intervals: [0, 4, 7, 9],    priority: 15 },
        { name: 'm6',     family: 'Minor',     intervals: [0, 3, 7, 9],    priority: 15 },

        // Extensions (9, 11, 13)
        { name: 'add9',   family: 'Major',     intervals: [0, 4, 7, 2],    priority: 15 },
        { name: '9',      family: 'Dominant',  intervals: [0, 4, 7, 10, 2],priority: 25 },
        { name: 'maj9',   family: 'Major',     intervals: [0, 4, 7, 11, 2],priority: 25 },
        { name: 'm9',     family: 'Minor',     intervals: [0, 3, 7, 10, 2],priority: 25 },
    ];

    // --- 2. SCALE FORMULAS ---
    const SCALES = {
        'Major': [0, 2, 4, 5, 7, 9, 11],
        'Minor': [0, 2, 3, 5, 7, 8, 10], // Natural Minor
        'Natural Minor': [0, 2, 3, 5, 7, 8, 10]
    };

    // NEW: Pentatonic Formulas
    const PENTATONIC_SCALES = {
        'Major': [0, 2, 4, 7, 9],      // 1, 2, 3, 5, 6
        'Minor': [0, 3, 5, 7, 10]      // 1, b3, 4, 5, b7
    };

    /* --- CORE FUNCTIONS --- */

    /**
     * DETECT CHORD: The 5-Stage Algorithm
     * @param {Array} notes - Array of integers (0-11) or note objects
     */
    function detectChord(inputNotes) {
        // Stage 1: Normalize inputs to simple pitch classes (0-11) unique and sorted
        const rawPitches = inputNotes.map(n => (typeof n === 'object' ? n.val : n));
        const pitches = [...new Set(rawPitches.map(p => p % 12))].sort((a,b)=>a-b);
        
        // Find bass note for slash chords (lowest physical note)
        let bassNote = null;
        if(inputNotes.length > 0 && typeof inputNotes[0] === 'object') {
            // Assuming inputNotes comes sorted by string index or we find the lowest frequency
            bassNote = inputNotes[0].val % 12; // Simple assumption for now
        }

        if (pitches.length < 2) return null;

        let candidates = [];

        // Stage 2: Test Every Note as Root
        pitches.forEach(root => {
            // Measure intervals relative to this root
            const intervals = pitches.map(p => (p - root + 12) % 12).sort((a,b)=>a-b);
            
            // Match against definitions
            CHORD_DEFINITIONS.forEach(def => {
                // Check if this definition is a subset of our intervals
                // (i.e., do we have all the required notes for this chord?)
                const hasAllNotes = def.intervals.every(i => intervals.includes(i));
                
                if (hasAllNotes) {
                    // Stage 3 & 5: Scoring System
                    let score = def.priority;
                    
                    // Bonus: Exact Match (No extra notes)
                    if (intervals.length === def.intervals.length) score += 10;
                    
                    // Penalty: Bass note is not Root (Inversion)
                    if (bassNote !== null && bassNote !== root) score -= 5;

                    candidates.push({
                        root: NOTES[root],
                        rootVal: root,
                        quality: def.name,
                        family: def.family,
                        name: NOTES[root] + def.name,
                        intervals: intervals,
                        score: score,
                        isSlash: bassNote !== null && bassNote !== root,
                        bass: bassNote !== null ? NOTES[bassNote] : ''
                    });
                }
            });
        });

        // Sort by Score (Desc)
        candidates.sort((a, b) => b.score - a.score);

        if (candidates.length === 0) return null;

        const primary = candidates[0];
        
        // Format Display Name
        let displayName = primary.name;
        if (primary.isSlash) displayName += `/${primary.bass}`;

        return {
            primary: { ...primary, displayName },
            alternatives: candidates.slice(1, 5) // Return top 4 alts
        };
    }


    /**
     * GENERATE DIATONIC PALETTE
     * Calculates which chords fit into a Key dynamically.
     */
    function getDiatonicChords(keyRootName, keyQuality) {
        const rootVal = NOTES.indexOf(keyRootName);
        const scaleIntervals = SCALES[keyQuality] || SCALES['Major'];
        
        // Get all notes in the key (0-11)
        const keyNotes = scaleIntervals.map(i => (rootVal + i) % 12);

        const palette = [];

        // For each degree in the scale (I, ii, iii...)
        scaleIntervals.forEach((interval, index) => {
            const degreeRoot = (rootVal + interval) % 12;
            const degreeRootName = NOTES[degreeRoot];
            
            // Find all chord definitions that fit strictly inside this key
            const validQualities = CHORD_DEFINITIONS.filter(def => {
                const chordNotes = def.intervals.map(i => (degreeRoot + i) % 12);
                return chordNotes.every(note => keyNotes.includes(note));
            });

            if (validQualities.length === 0) return;

            // --- UPDATED SORT LOGIC ---
            // Prioritize: Triads (3) > 7ths (4) > Power (2) > Extensions
            validQualities.sort((a, b) => {
                const lenA = a.intervals.length;
                const lenB = b.intervals.length;

                // Helper to assign "Rank" (Lower is better)
                const getRank = (len) => {
                    if (len === 3) return 1; // Triads (Winner)
                    if (len === 4) return 2; // 7ths (Runner up)
                    if (len === 2) return 3; // Power Chords (Niche)
                    return 4;                // Complex Extensions
                }

                const rankA = getRank(lenA);
                const rankB = getRank(lenB);

                // 1. Sort by Rank
                if (rankA !== rankB) return rankA - rankB;

                // 2. Tie-breaker: Sort by Priority defined in definitions
                return b.priority - a.priority; 
            });

            // Roman Numeral Label
            const roman = getRomanLabel(index + 1, validQualities[0].family);

            palette.push({
                degreeIndex: index,
                label: roman,
                root: degreeRootName,
                qualities: validQualities.map(q => q.name)
            });
        });

        return palette;
    }

    function getRomanLabel(degree, family) {
        const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        let num = numerals[degree - 1];
        if (family === 'Minor' || family === 'Diminished') num = num.toLowerCase();
        if (family === 'Diminished') num += '°';
        return num;
    }

    /* --- 3. EMOTIONAL LIBRARY --- */
    const EMOTIONS = {
        // --- MAJOR FAMILY ---
        '': { // Triad
            desc: "Bright, stable, open, resolved. Happiness and clarity.",
            context: {
                'I': "Emotional center. Feels like home.",
                'IV': "Warm and supportive.",
                'V': "Strong, triumphant, but less tense."
            }
        },
        '6': {
            desc: "Warm, gentle, nostalgic. A cozy, reflective mood.",
            context: { 'I': "Relaxed and intimate home." }
        },
        'maj7': {
            desc: "Dreamy, lush, sophisticated. Emotional depth without instability.",
            context: {
                'I': "Introspective and deep.",
                'IV': "Floating, cinematic lift."
            }
        },
        'add9': { desc: "Open, expressive, modern. Color without tension." },
        'maj9': { desc: "Expansive, jazzy, very lush. A rich sense of peace." },

        // --- MINOR FAMILY ---
        'm': { // Triad
            desc: "Sad, serious, introspective. Emotional weight.",
            context: {
                'i': "The grounding emotional center.",
                'vi': "Reflective grounding.",
                'ii': "Transitional and expressive."
            }
        },
        'm6': {
            desc: "Haunting, melancholic, slightly hopeful. Like a distant memory.",
            context: {}
        },
        'm7': {
            desc: "Smooth, relaxed, soulful. Sadness without heaviness.",
            context: {
                'ii': "Flowing and connective.",
                'i': "Reflective rather than final."
            }
        },
        'm9': { desc: "Deep, dark, and rich. A very soft, modern sorrow." },
        'm(maj7)': { desc: "The 'Bond' chord. Mysterious, tense, and noir-like." },

        // --- DOMINANT FAMILY ---
        '7': {
            desc: "Tense, restless, energetic. Demands to move forward.",
            context: {
                'V': "Strong pull toward resolution (Home).",
                'secondary': "A surprise twist pushing to a new chord."
            }
        },
        '9': { desc: "Rich, expressive tension. Confident bluesy sophistication." },
        '13': { desc: "Complex, colorful tension. Jazz-funk sophistication." },
        '7b9': { desc: "Anxious, spicy, dramatic. Maximum tension." },
        '7#9': { desc: "The 'Hendrix' chord. Aggressive, bluesy tension." },

        // --- SUSPENDED / POWER ---
        'sus2': { desc: "Open, airy, curious. Feels like a question.", context: {} },
        'sus4': { desc: "Tense but restrained. Anticipatory.", context: {} },
        '5':    { desc: "Strong, raw, aggressive. Context determines the mood.", context: {} },

        // --- DIMINISHED / AUGMENTED ---
        'dim':  { desc: "Unstable, dark, uneasy. Creates suspense.", context: {} },
        'dim7': { desc: "Highly tense, dramatic, disorienting. A pivot point.", context: {} },
        'm7b5': { desc: "Half-diminished. Tragic, romantic, darker than minor.", context: {} },
        'aug':  { desc: "Dreamlike, mysterious, surreal. Floating uncertainty.", context: {} }
    };

    /**
     * GET EMOTIONAL CONTEXT
     * Calculates the relationship between the chord and the current Key.
     */
    function getChordEmotion(chordRoot, chordQuality, currentKeyRoot) {
        // 1. Get Base Description
        const profile = EMOTIONS[chordQuality] || { desc: "Complex harmony.", context: {} };
        let text = profile.desc;

        // 2. Calculate Context (Roman Numeral)
        if (currentKeyRoot) {
            const keyIndex = NOTES.indexOf(currentKeyRoot);
            const chordIndex = NOTES.indexOf(chordRoot);
            
            // Interval distance (0-11)
            let interval = (chordIndex - keyIndex + 12) % 12;
            
            // Map interval to likely Degree (Simplified for major/minor)
            // 0=I, 2=II, 3=bIII, 4=III, 5=IV, 7=V, 8=bVI, 9=VI, 10=bVII, 11=VII
            const degreeMap = {
                0: 'I', 0: 'i', // Major/Minor share index 0
                2: 'ii', 2: 'II',
                3: 'bIII', // Major relative minor root
                4: 'iii', 4: 'III',
                5: 'IV', 5: 'iv',
                7: 'V', 7: 'v',
                9: 'vi', 9: 'VI', // Relative minor
                11: 'VII'
            };

            // Heuristic to match Roman Numeral string to the Dictionary keys
            // We check the chord definition to see if it matches a context key
            for (const [degreeKey, contextText] of Object.entries(profile.context || {})) {
                // Check if our calculated interval loosely matches the Degree Key
                // (This is a simplified check, a full theory engine would differ, but this works for UI)
                if (checkDegreeMatch(degreeKey, interval)) {
                    text += ` <span style="color:var(--aurora-teal); font-weight:bold;">(As ${degreeKey}: ${contextText})</span>`;
                    break;
                }
            }
        }

        return text;
    }

    function checkDegreeMatch(degreeStr, semitones) {
        const map = {
            'I':0, 'i':0, 
            'II':2, 'ii':2, 
            'III':4, 'iii':4, 'bIII':3,
            'IV':5, 'iv':5, 
            'V':7, 'v':7, 
            'VI':9, 'vi':9, 'bVI':8,
            'VII':11, 'vii':11
        };
        return map[degreeStr] === semitones;
    }

    function getScaleNotes(rootName, quality, scaleType) {
        const rootVal = NOTES.indexOf(rootName);
        if (rootVal === -1) return [];

        // 1. Determine which interval pattern to use
        // If scaleType is 'pentatonic', use PENTATONIC_SCALES
        // If scaleType is 'diatonic', use SCALES
        let intervals = [];

        // Normalize quality to just 'Major' or 'Minor' for scale lookup
        // (e.g. if key is "C-Major", quality is "Major")
        const keyQuality = quality.includes('Minor') ? 'Minor' : 'Major';

        if (scaleType === 'pentatonic') {
            intervals = PENTATONIC_SCALES[keyQuality];
        } else {
            intervals = SCALES[keyQuality];
        }

        if (!intervals) return [];

        // 2. Map intervals to actual pitch classes (0-11)
        return intervals.map(i => (rootVal + i) % 12);
    }

    // Expose functions
    return {
        detectChord,
        getDiatonicChords,
        getChordEmotion,
        getScaleNotes, // Export the new function
        CHORD_DEFINITIONS,
        NOTES
    };

})();

