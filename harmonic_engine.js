/* frontend/harmonic_engine.js */

const HarmonicEngine = (() => {

    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // 1. FAMILY MAP
    const FAMILY_MAP = {
        '': 'Major', 'maj7': 'Major', '6': 'Major', 'add9': 'Major', 'maj9': 'Major',
        'm': 'Minor', 'm7': 'Minor', 'm6': 'Minor', 'm9': 'Minor', 'm(maj7)': 'Minor',
        '7': 'Dominant', '9': 'Dominant', '13': 'Dominant', '7b9': 'Dominant', '7#9': 'Dominant', 'alt': 'Dominant',
        'sus2': 'Suspended', 'sus4': 'Suspended',
        'dim': 'Diminished', 'dim7': 'Diminished', 'm7b5': 'Diminished',
        'aug': 'Augmented',
        '5': 'Power'
    };

    /* --- HELPER MATH --- */
    function getInterval(root, target) {
        const rIdx = NOTES.indexOf(root);
        const tIdx = NOTES.indexOf(target);
        if (rIdx === -1 || tIdx === -1) return 0;
        return (tIdx - rIdx + 12) % 12;
    }

    function getNoteByInterval(root, interval) {
        const rIdx = NOTES.indexOf(root);
        if (rIdx === -1) return root;
        return NOTES[(rIdx + interval) % 12];
    }

    /* --- FUNCTIONAL ANALYSIS --- */
    // Classifies the CURRENT chord's role in the Key
    function analyzeFunction(interval, quality, keyQuality) {
        // Major Key Context
        if (keyQuality === 'Major') {
            if (interval === 0) return 'Tonic';          // I
            if (interval === 5 || interval === 2) return 'Predominant'; // IV, ii
            if (interval === 7 || interval === 11) return 'Dominant';   // V, vii
            if (interval === 9 || interval === 4) return 'TonicPar';    // vi, iii (Secondary Tonics)
        } 
        // Minor Key Context
        else {
            if (interval === 0) return 'Tonic';          // i
            if (interval === 5 || interval === 8 || interval === 2) return 'Predominant'; // iv, VI, ii
            if (interval === 7 || interval === 10 || interval === 11) return 'Dominant'; // v/V, VII, vii
        }
        return 'Chromatic'; // Non-diatonic
    }

    /* --- CORE RECOMMENDATION LOGIC --- */
    /* --- CORE RECOMMENDATION LOGIC (FIXED & ROBUST) --- */
    function getRecommendations(chordRoot, chordQuality, keyRoot, keyQuality) {
        const family = FAMILY_MAP[chordQuality] || 'Major';
        const intervalFromTonic = getInterval(keyRoot, chordRoot);
        const role = analyzeFunction(intervalFromTonic, family, keyQuality);
        
        let pool = []; 

        // --- 1. INTENT: "STAY & COLOR" (Stasis) ---
        if (family === 'Major') {
            pool.push(createRec(chordRoot, 'maj7', "Deepen Emotion", 'stasis', 1));
            pool.push(createRec(chordRoot, 'sus2', "Blur Clarity", 'stasis', 1));
        } else if (family === 'Minor') {
            pool.push(createRec(chordRoot, 'm9', "Darken Mood", 'stasis', 1));
        } else if (family === 'Dominant') {
            pool.push(createRec(chordRoot, 'sus4', "Delay Resolution", 'stasis', 1));
        } 
        // FIX: Add logic for Suspended Chords (Resolve to Self)
        else if (family === 'Suspended') {
            pool.push(createRec(chordRoot, '', "Resolve to Triad", 'resolution', 8));
            pool.push(createRec(chordRoot, 'm', "Resolve to Minor", 'resolution', 8));
        }

        // --- 2. INTENT: "RESOLVE / MOVE FORWARD" ---
        if (role === 'Dominant' || family === 'Dominant') {
            const targetI = getNoteByInterval(chordRoot, 5); 
            const qual = (keyQuality === 'Minor') ? 'm' : '';
            pool.push(createRec(targetI, qual, "Strong Resolution", 'resolution', 10));
        } 
        else if (role === 'Predominant') {
            const targetV = getNoteByInterval(keyRoot, 7);
            pool.push(createRec(targetV, '7', "Build Tension", 'motion', 8));
            if (intervalFromTonic === 5) {
                pool.push(createRec(keyRoot, '', "Warm Resolution", 'resolution', 7));
            }
        }
        else if (role === 'Tonic') {
            const targetV = getNoteByInterval(keyRoot, 7);
            pool.push(createRec(targetV, '', "Forward Motion", 'motion', 6));
            const targetIV = getNoteByInterval(keyRoot, 5);
            pool.push(createRec(targetIV, 'maj7', "Open / Lift", 'motion', 6));
        }

        // --- 3. INTENT: "EMOTIONAL CONTRAST" ---
        if (family === 'Major') {
            const targetVi = getNoteByInterval(chordRoot, 9);
            pool.push(createRec(targetVi, 'm7', "Emotional Turn (Sad)", 'contrast', 5));
        } 
        else if (family === 'Minor') {
            const targetRel = getNoteByInterval(chordRoot, 3);
            pool.push(createRec(targetRel, 'maj7', "Emotional Turn (Hope)", 'contrast', 5));
        }

        // --- 4. INTENT: "SPICE / SURPRISE" ---
        if (keyQuality === 'Major' && role === 'Tonic') {
            const targetIvMinor = getNoteByInterval(keyRoot, 5);
            pool.push(createRec(targetIvMinor, 'm6', "Nostalgic/Minor Plagal", 'spice', 4));
        }
        if (family === 'Major' && intervalFromTonic === 0) {
            const targetSecDom = getNoteByInterval(chordRoot, 4); 
            pool.push(createRec(targetSecDom, '7', "Push to Minor", 'spice', 4));
        }
        if (keyQuality === 'Minor' && (role === 'Tonic' || role === 'Predominant')) {
            const targetFlat2 = getNoteByInterval(keyRoot, 1);
            pool.push(createRec(targetFlat2, 'maj7', "Phrygian Dark Drama", 'spice', 4));
        }
        if (family === 'Dominant') {
            const targetFlat2 = getNoteByInterval(chordRoot, 1);
            pool.push(createRec(targetFlat2, 'maj7', "Chromatic Jazz Slide", 'spice', 4));
        }

        // --- 5. SAFETY NET (THE "LOST" FIX) ---
        // If the pool is empty (e.g., G#sus2 in C), we MUST provide generic options.
        if (pool.length < 2) {
            // Option A: Go Home (Tonic)
            pool.push(createRec(keyRoot, '', "Return Home", 'resolution', 2));
            
            // Option B: Go to V (Dominant)
            const targetV = getNoteByInterval(keyRoot, 7);
            pool.push(createRec(targetV, '7', "Reset to Dominant", 'motion', 2));
            
            // Option C: Circle of Fifths (Up 4th from current root)
            const target4th = getNoteByInterval(chordRoot, 5);
            pool.push(createRec(target4th, 'maj7', "Circle of Fifths Flow", 'flow', 2));
        }

        // --- 6. SELECTION & FILTERING ---
        
        // A. Remove EXACT duplicates of current chord (Prevent Loop)
        const currentName = chordRoot + chordQuality;
        pool = pool.filter(rec => rec.name !== currentName);

        // B. Sort by Priority
        pool.sort((a, b) => b.priority - a.priority);
        
        // C. Unique Names only
        const uniquePool = [];
        const seen = new Set();
        for (let r of pool) {
            if (!seen.has(r.name)) {
                seen.add(r.name);
                uniquePool.push(r);
            }
        }

        // D. Diversity Pick (Try to get 1 of each type)
        let finalRecs = [];
        const typesNeeded = ['resolution', 'motion', 'contrast', 'spice', 'stasis'];
        
        typesNeeded.forEach(type => {
            const bestOfType = uniquePool.find(r => r.type === type);
            if (bestOfType && finalRecs.length < 4) {
                finalRecs.push(bestOfType);
                const idx = uniquePool.indexOf(bestOfType);
                if (idx > -1) uniquePool.splice(idx, 1);
            }
        });

        finalRecs = finalRecs.filter(rec => rec.name !== currentName);

        // If we filtered too many, fill back up from the uniquePool
        while (finalRecs.length < 4 && uniquePool.length > 0) {
            const nextCandidate = uniquePool.shift();
            if (nextCandidate.name !== currentName) {
                finalRecs.push(nextCandidate);
            }
        }

        // Return Top 4
        return finalRecs.slice(0, 4);
    }

    // Helper Factory
    function createRec(root, quality, reason, type, priority) {
        return {
            root: root,
            quality: quality,
            name: root + quality,
            reason: reason,
            type: type,
            priority: priority // Higher = More standard/expected
        };
    }

    return {
        getRecommendations: getRecommendations
    };

})();