/* frontend/chord_generator.js */

const ChordGenerator = (() => {

    // Standard Tuning: E A D G B e
    const STRING_TUNING = [40, 45, 50, 55, 59, 64]; 
    const MAX_FRET = 12;

    /**
     * Generate Shapes based on Theory Definitions
     * @param {String} rootName - "C", "F#"
     * @param {String} quality - "", "m", "maj7" (Must match CHORD_DEFINITIONS)
     */
    function generateShapes(rootName, quality) {
        // 1. Lookup Formula from MusicTheory
        const def = MusicTheory.CHORD_DEFINITIONS.find(d => d.name === quality);
        if (!def) {
            console.error("Unknown Chord Quality:", quality);
            return [];
        }

        const rootVal = MusicTheory.NOTES.indexOf(rootName);
        
        // 2. Calculate Required Pitch Classes (0-11)
        const targetPitchClasses = def.intervals.map(i => (rootVal + i) % 12);
        
        let rawShapes = [];

        // 3. Iterate Bass Strings (6, 5, 4) to find Root Anchors
        for (let stringIdx = 0; stringIdx < 3; stringIdx++) {
            const openPitch = STRING_TUNING[stringIdx];
            
            for (let fret = 0; fret <= MAX_FRET; fret++) {
                const currentPitch = openPitch + fret;
                
                // Requirement #3: Inversions could be added here later.
                // For now, strict Root position in Bass.
                if (currentPitch % 12 === rootVal) {
                    
                    // Fret Window (Reach)
                    const minReach = Math.max(0, fret - 1);
                    const maxReach = Math.min(MAX_FRET, fret + 3);

                    const partialShape = [null, null, null, null, null, null];
                    partialShape[stringIdx] = fret; 

                    // Solve remaining strings
                    const solutions = solveUpperStrings(
                        stringIdx + 1, 
                        partialShape,
                        minReach, maxReach,
                        targetPitchClasses,
                        [rootVal] 
                    );
                    
                    rawShapes.push(...solutions);
                }
            }
        }

        // 4. Filter & Sort
        let filteredShapes = rawShapes.filter(checkPlayability);
        
        // Sort: Prefer lower frets and more complete voicings
        filteredShapes.sort((a, b) => {
            const avgA = getAverageFret(a);
            const avgB = getAverageFret(b);
            if (Math.abs(avgA - avgB) > 2) return avgA - avgB;
            return countNotes(b) - countNotes(a); // More notes = better
        });
        
        return uniqueShapes(filteredShapes);
    }

    /* --- SOLVER LOGIC (Unchanged, just cleaner) --- */
    function solveUpperStrings(stringIdx, currentShape, minFret, maxFret, targets, collectedNotes) {
        if (stringIdx > 5) {
            // Valid if we have all required pitch classes
            const hasAll = targets.every(t => collectedNotes.includes(t));
            return hasAll ? [ [...currentShape] ] : [];
        }

        let results = [];
        const openPitch = STRING_TUNING[stringIdx];

        // Option A: Mute
        results.push(...solveUpperStrings(stringIdx + 1, [...currentShape], minFret, maxFret, targets, collectedNotes));

        // Option B: Play
        const candidates = [];
        if (0 >= 0) candidates.push(0); // Open string check
        for (let f = minFret; f <= maxFret; f++) {
            if (f > 0) candidates.push(f);
        }

        for (let fret of candidates) {
            const pitch = openPitch + fret;
            const pitchClass = pitch % 12;

            if (targets.includes(pitchClass)) {
                const newShape = [...currentShape];
                newShape[stringIdx] = fret;
                
                const newCollected = [...collectedNotes];
                if (!newCollected.includes(pitchClass)) newCollected.push(pitchClass);

                results.push(...solveUpperStrings(stringIdx + 1, newShape, minFret, maxFret, targets, newCollected));
            }
        }
        return results;
    }

    /* --- FILTERS --- */
    function checkPlayability(shape) {
        let played = [];
        shape.forEach((f, i) => { if (f !== null) played.push(i); });
        if (played.length < 3) return false; // Require at least 3 notes for full chords
        
        // Check stretch
        let frets = shape.filter(f => f !== null && f > 0);
        if (frets.length > 0) {
            let min = Math.min(...frets);
            let max = Math.max(...frets);
            if ((max - min) > 4) return false; // Max reach 4 frets
        }
        return true;
    }

    function getAverageFret(shape) {
        let sum = 0, count = 0;
        shape.forEach(f => { if (f !== null && f > 0) { sum += f; count++; } });
        return count === 0 ? 0 : sum / count;
    }

    function countNotes(shape) { return shape.filter(f => f !== null).length; }

    function uniqueShapes(shapes) {
        const seen = new Set();
        return shapes.filter(s => {
            const key = JSON.stringify(s);
            return seen.has(key) ? false : seen.add(key);
        });
    }

    return { generate: generateShapes };
})();
