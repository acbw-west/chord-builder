/* frontend/harmonic_engine.js */

const HarmonicEngine = (() => {

    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    const FAMILY_MAP = {
        '': 'Major', 'maj7': 'Major', '6': 'Major', 'add9': 'Major', 'maj9': 'Major',
        'm': 'Minor', 'm7': 'Minor', 'm6': 'Minor', 'm9': 'Minor', 'm(maj7)': 'Minor',
        '7': 'Dominant', '9': 'Dominant', '13': 'Dominant', '7b9': 'Dominant', '7#9': 'Dominant', 'alt': 'Dominant',
        'sus2': 'Suspended', 'sus4': 'Suspended',
        'dim': 'Diminished', 'dim7': 'Diminished', 'm7b5': 'Diminished',
        'aug': 'Augmented', '5': 'Power'
    };

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

    function analyzeFunction(interval, quality, keyQuality) {
        if (keyQuality === 'Major') {
            if (interval === 0) return 'Tonic';          
            if (interval === 5 || interval === 2) return 'Predominant'; 
            if (interval === 7 || interval === 11) return 'Dominant';   
            if (interval === 9 || interval === 4) return 'TonicPar';    
        } else {
            if (interval === 0) return 'Tonic';          
            if (interval === 5 || interval === 8 || interval === 2) return 'Predominant'; 
            if (interval === 7 || interval === 10 || interval === 11) return 'Dominant'; 
        }
        return 'Chromatic'; 
    }

    // --- UPDATED SIGNATURE: Accepts Previous Chord ---
    function getRecommendations(chordRoot, chordQuality, keyRoot, keyQuality, prevRoot = null, prevQuality = null) {
        const family = FAMILY_MAP[chordQuality] || 'Major';
        const intervalFromTonic = getInterval(keyRoot, chordRoot);
        const role = analyzeFunction(intervalFromTonic, family, keyQuality);
        
        let pool = []; 

        // --- 1. GENERATE BASE SUGGESTIONS (Standard Theory) ---
        
        // Intent: Stasis
        if (family === 'Major') {
            pool.push(createRec(chordRoot, 'maj7', "Deepen Emotion", 'stasis', 1));
            pool.push(createRec(chordRoot, 'sus2', "Blur Clarity", 'stasis', 1));
        } else if (family === 'Minor') {
            pool.push(createRec(chordRoot, 'm9', "Darken Mood", 'stasis', 1));
        } else if (family === 'Dominant') {
            pool.push(createRec(chordRoot, 'sus4', "Delay Resolution", 'stasis', 1));
        } else if (family === 'Suspended') {
            pool.push(createRec(chordRoot, '', "Resolve to Triad", 'resolution', 8));
        }

        // Intent: Resolution/Motion
        if (role === 'Dominant' || family === 'Dominant') {
            const targetI = getNoteByInterval(chordRoot, 5); 
            const qual = (keyQuality === 'Minor') ? 'm' : '';
            pool.push(createRec(targetI, qual, "Strong Resolution", 'resolution', 10));
        } else if (role === 'Predominant') {
            const targetV = getNoteByInterval(keyRoot, 7);
            pool.push(createRec(targetV, '7', "Build Tension", 'motion', 8));
            if (intervalFromTonic === 5) pool.push(createRec(keyRoot, '', "Warm Resolution", 'resolution', 7));
        } else if (role === 'Tonic') {
            const targetV = getNoteByInterval(keyRoot, 7);
            pool.push(createRec(targetV, '', "Forward Motion", 'motion', 6));
            const targetIV = getNoteByInterval(keyRoot, 5);
            pool.push(createRec(targetIV, 'maj7', "Open / Lift", 'motion', 6));
        }

        // Intent: Contrast
        if (family === 'Major') {
            const targetVi = getNoteByInterval(chordRoot, 9);
            pool.push(createRec(targetVi, 'm7', "Emotional Turn (Sad)", 'contrast', 5));
        } else if (family === 'Minor') {
            const targetRel = getNoteByInterval(chordRoot, 3);
            pool.push(createRec(targetRel, 'maj7', "Emotional Turn (Hope)", 'contrast', 5));
        }

        // Intent: Spice
        if (keyQuality === 'Major' && role === 'Tonic') {
            const targetIvMinor = getNoteByInterval(keyRoot, 5);
            pool.push(createRec(targetIvMinor, 'm6', "Nostalgic/Minor Plagal", 'spice', 4));
        }
        if (family === 'Major' && intervalFromTonic === 0) {
            const targetSecDom = getNoteByInterval(chordRoot, 4); 
            pool.push(createRec(targetSecDom, '7', "Push to Minor", 'spice', 4));
        }
        if (family === 'Dominant') {
            const targetFlat2 = getNoteByInterval(chordRoot, 1);
            pool.push(createRec(targetFlat2, 'maj7', "Chromatic Jazz Slide", 'spice', 4));
        }

        // Safety Net
        if (pool.length < 2) {
            pool.push(createRec(keyRoot, '', "Return Home", 'resolution', 2));
            const target4th = getNoteByInterval(chordRoot, 5);
            pool.push(createRec(target4th, 'maj7', "Circle of Fifths Flow", 'flow', 2));
        }

        // --- 2. CONTEXTUAL MODIFIERS (The "Intelligence" Layer) ---
        // Adjust priorities based on where we just came from (prevRoot/prevQuality)

        if (prevRoot) {
            const prevFamily = FAMILY_MAP[prevQuality] || 'Major';
            
            // A. Anti-Looping: If we just came from X, don't rush back to X immediately.
            // Example: G -> C. Don't recommend G (Dominant) as the #1 choice immediately.
            pool.forEach(rec => {
                if (rec.root === prevRoot) {
                    rec.priority -= 3; // Penalize going backwards immediately
                }
            });

            // B. "Momentum": If we just Resolved (V -> I), encourage a new direction (IV or vi).
            // Detect: Previous was Dominant, Current is Tonic
            const prevRole = analyzeFunction(getInterval(keyRoot, prevRoot), prevFamily, keyQuality);
            
            if ((prevRole === 'Dominant' || prevFamily === 'Dominant') && role === 'Tonic') {
                // Boost "Motion" (IV) and "Contrast" (vi) to start a new phrase
                pool.forEach(rec => {
                    if (rec.type === 'motion' || rec.type === 'contrast') {
                        rec.priority += 2.5; 
                    }
                });
            }

            // C. "Tension Stacking": If Previous was Predominant (IV) and Current is Dominant (V),
            // Boost Resolution (I) massively.
            if (prevRole === 'Predominant' && role === 'Dominant') {
                pool.forEach(rec => {
                    if (rec.type === 'resolution') rec.priority += 4.0;
                });
            }
        }

        // --- 3. FILTER & JITTER (Randomness) ---
        
        // Remove self-loops
        const currentName = chordRoot + chordQuality;
        pool = pool.filter(rec => rec.name !== currentName);

        // Add Random Jitter (0.0 - 2.5) to break ties and add variety
        pool.forEach(rec => {
            rec.score = rec.priority + (Math.random() * 2.5);
        });

        // Sort by modified Score
        pool.sort((a, b) => b.score - a.score);
        
        // Dedup
        const uniquePool = [];
        const seen = new Set();
        for (let r of pool) {
            if (!seen.has(r.name)) {
                seen.add(r.name);
                uniquePool.push(r);
            }
        }

        // Diversity Pick
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

        while (finalRecs.length < 4 && uniquePool.length > 0) {
            finalRecs.push(uniquePool.shift());
        }

        return finalRecs;
    }

    function createRec(root, quality, reason, type, priority) {
        return {
            root: root, quality: quality, name: root + quality,
            reason: reason, type: type, priority: priority, score: 0
        };
    }

    return { getRecommendations: getRecommendations };

})();