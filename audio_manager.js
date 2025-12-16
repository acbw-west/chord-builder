/* frontend/audio_manager.js */

const AudioManager = (() => {
    
    /* --- 1. INITIALIZATION & ROUTING --- */
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();

    // MASTER CHAIN
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    let activeSources = [];
    let currentStrumId = 0; 

    // Unlock Audio Context
    const unlockAudio = () => {
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => console.log("Audio Engine Unlocked"));
        }
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    /* --- 2. ASSETS --- */
    const BASE_URL = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3/";
    const bufferCache = {};
    const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const OPEN_STRING_NOTES = [4, 9, 2, 7, 11, 4]; 
    const OPEN_STRING_OCTAVES = [2, 2, 3, 3, 3, 4]; 
    const STRUM_INTERVAL = 0.06; 

    /* --- 3. CORE FUNCTIONS --- */

    function stopAllSounds() {
        // Immediate cleanup of all active sources
        activeSources.forEach(source => {
            try {
                // 1. Instant fade to prevent click
                source.gainNode.gain.cancelScheduledValues(ctx.currentTime);
                source.gainNode.gain.setValueAtTime(source.gainNode.gain.value, ctx.currentTime);
                source.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
                
                // 2. Stop and Disconnect (The Nuclear Option)
                source.sourceNode.stop(ctx.currentTime + 0.06);
                setTimeout(() => {
                    source.sourceNode.disconnect();
                    source.gainNode.disconnect();
                }, 100);
            } catch (e) { }
        });
        activeSources = [];
    }

    async function preload(activeNotes) {
        if (ctx.state === 'suspended') ctx.resume();
        activeNotes.forEach(async (note) => {
            const name = getNoteFilename(note.stringIndex, note.fret);
            await loadSound(name); 
        });
    }

    async function strum(activeNotes) {
        const myId = ++currentStrumId;

        if (ctx.state === 'suspended') await ctx.resume();

        // Stop previous sounds
        stopAllSounds();

        // Sort notes
        activeNotes.sort((a, b) => a.stringIndex - b.stringIndex);

        // Load buffers
        const buffers = await Promise.all(
            activeNotes.map(async (note) => {
                const name = getNoteFilename(note.stringIndex, note.fret);
                return await loadSound(name);
            })
        );

        if (myId !== currentStrumId) return;

        const now = ctx.currentTime;
        
        buffers.forEach((buffer, index) => {
            if (buffer) {
                const scheduledTime = now + (index * STRUM_INTERVAL);
                playSoundBuffer(buffer, scheduledTime);
            }
        });
    }

    async function playNote(stringIndex, fretNumber) {
        if (ctx.state === 'suspended') await ctx.resume();
        const noteName = getNoteFilename(stringIndex, fretNumber);
        const buffer = await loadSound(noteName);
        if (buffer) playSoundBuffer(buffer, ctx.currentTime);
    }

    /* --- 4. HELPERS --- */

    function playSoundBuffer(buffer, absoluteTime) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = ctx.createGain();
        source.connect(gainNode);
        gainNode.connect(masterGain);

        gainNode.gain.setValueAtTime(0, absoluteTime);
        gainNode.gain.linearRampToValueAtTime(1.0, absoluteTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, absoluteTime + 3.5);

        source.start(absoluteTime);

        activeSources.push({ sourceNode: source, gainNode: gainNode });
        
        source.onended = () => {
            // Remove this source from the active list
            const index = activeSources.findIndex(s => s.sourceNode === source);
            if (index > -1) {
                activeSources.splice(index, 1);
            }
        };
    }

    function getNoteFilename(stringIndex, fret) {
        const openNoteVal = OPEN_STRING_NOTES[stringIndex];
        const baseAbsPitch = (OPEN_STRING_OCTAVES[stringIndex] * 12) + openNoteVal;
        const currentAbsPitch = baseAbsPitch + fret;
        const finalOctave = Math.floor(currentAbsPitch / 12);
        const noteNameIdx = currentAbsPitch % 12;
        return `${NOTE_NAMES[noteNameIdx]}${finalOctave}`; 
    }

    async function loadSound(noteName) {
        if (bufferCache[noteName]) return bufferCache[noteName];
        try {
            const response = await fetch(`${BASE_URL}${noteName}.mp3`);
            if (!response.ok) throw new Error(`404: ${noteName}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            bufferCache[noteName] = audioBuffer;
            return audioBuffer;
        } catch (error) {
            console.warn(`Audio Missing: ${noteName}`);
            return null;
        }
    }

    return {
        playNote: playNote,
        strum: strum,
        preload: preload 
    };

})();
