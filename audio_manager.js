const AudioManager = (() => {
    // 1. Initialize Audio Context (Handles the timing)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Base URL for guitar samples (Acoustic Nylon Guitar)
    // Source: gleitz/midi-js-soundfonts (MIT License)
    const BASE_URL = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3/";
    
    // Cache for loaded buffers so we don't fetch the same MP3 twice
    const bufferCache = {};

    // Note Names mapping (Flat naming convention matches the sound library)
    const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    
    // String Definitions (Standard Tuning E2 A2 D3 G3 B3 E4)
    // Indices 0=LowE to 5=HighE
    const OPEN_STRING_NOTES = [4, 9, 2, 7, 11, 4]; 
    const OPEN_STRING_OCTAVES = [2, 2, 3, 3, 3, 4]; 

    /* --- SETTINGS --- */
    // The delay between strings in seconds. 
    // 0.05s (50ms) is a fast, clean strum. 
    // 0.08s is slower/expressive.
    const STRUM_INTERVAL = 0.055; 

    /* --- CORE FUNCTIONS --- */

    /**
     * Plays a single note immediately.
     */
    async function playNote(stringIndex, fretNumber) {
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const noteName = getNoteFilename(stringIndex, fretNumber);
        const buffer = await loadSound(noteName);
        
        if (buffer) {
            // Play essentially "now"
            playSoundBuffer(buffer, audioCtx.currentTime); 
        } else {
            console.warn(`Missing audio file for: ${noteName}`);
        }
    }

    /**
     * Strums a full chord with precision timing.
     * @param {Array} activeNotes - Array of objects {stringIndex, fret}
     */
    async function strum(activeNotes) {
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        // 1. Sort strings Low to High (0 -> 5) for a "Downstroke"
        // Want an upstroke? Just reverse this sort!
        activeNotes.sort((a, b) => a.stringIndex - b.stringIndex);

        // 2. Pre-load ALL sounds first. 
        // We don't want to start strumming and then wait for a download in the middle.
        const buffers = await Promise.all(
            activeNotes.map(async (note) => {
                const name = getNoteFilename(note.stringIndex, note.fret);
                const buf = await loadSound(name);
                return buf;
            })
        );

        // 3. Schedule them on the timeline
        const now = audioCtx.currentTime;
        
        buffers.forEach((buffer, index) => {
            if (buffer) {
                // Precise math: Start Time + (Index * Interval)
                // e.g. 0s, 0.05s, 0.10s...
                const scheduledTime = now + (index * STRUM_INTERVAL);
                
                // Add a tiny bit of "Humanization" (random +/- 2ms jitter)
                // const jitter = (Math.random() * 0.004) - 0.002; 
                // playSoundBuffer(buffer, scheduledTime + jitter);
                
                // For "Smooth as Butter", we stick to strict math first:
                playSoundBuffer(buffer, scheduledTime);
            }
        });
    }

    /* --- HELPERS --- */

    function playSoundBuffer(buffer, absoluteTime) {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        
        // Create a Gain Node (Volume) to control fade-out
        const gainNode = audioCtx.createGain();
        
        // Connect Source -> Gain -> Speakers
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Schedule the start
        source.start(absoluteTime);
        
        // ENVELOPE: Clean start, long natural decay
        // This prevents "clicking" sounds at the start
        gainNode.gain.setValueAtTime(0, absoluteTime);
        gainNode.gain.linearRampToValueAtTime(1.0, absoluteTime + 0.01); // Quick fade-in (10ms)
        gainNode.gain.exponentialRampToValueAtTime(0.01, absoluteTime + 2.5); // 2.5s decay
    }

    function getNoteFilename(stringIndex, fret) {
        const openNoteVal = OPEN_STRING_NOTES[stringIndex];
        
        // Calculate Absolute Semitones to handle Octave jumps correctly
        // C2 = 24, C3 = 36, C4 = 48...
        const baseAbsPitch = (OPEN_STRING_OCTAVES[stringIndex] * 12) + openNoteVal;
        const currentAbsPitch = baseAbsPitch + fret;

        const finalOctave = Math.floor(currentAbsPitch / 12);
        const noteNameIdx = currentAbsPitch % 12;
        const name = NOTE_NAMES[noteNameIdx];

        return `${name}${finalOctave}`; 
    }

    async function loadSound(noteName) {
        // If already in memory, return immediately
        if (bufferCache[noteName]) return bufferCache[noteName];

        try {
            const response = await fetch(`${BASE_URL}${noteName}.mp3`);
            if (!response.ok) throw new Error(`404: ${noteName}`);
            
            const arrayBuffer = await response.arrayBuffer();
            
            // Decode asynchronously
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            
            // Save to cache
            bufferCache[noteName] = audioBuffer;
            return audioBuffer;
        } catch (error) {
            console.error(`Audio Load Error:`, error);
            return null;
        }
    }

    return {
        playNote: playNote,
        strum: strum
    };

})();