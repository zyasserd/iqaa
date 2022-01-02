'use strict';

// Deal with variants
// IqaaData.maqsum[0]

let N = new Notation('NotationDiv', 600)
            .setTextVisibility(false)
            // .setIqaa(IqaaData['samai thaqil'][0])
            // .setIqaa(IqaaData['wahda wi nuss'][0])
            .setIqaa(IqaaData['ciftetelli'][0])
            // .setIqaa("4/4:[D]T[T]|DT")
            // .setIqaa("4/4:(DD)sT|(Ds)(Ts)")
            .drawDividers(false);



var bpm = 80; // (30 <= bpm <= 400) <=> (150 <= ms/beat < 2000)
              // Note: 60000 = (bpm) * (ms/beat)
let refreshRate = 15; // in ms, 10ms is the minimum acceptable setInterval parameter in most browsers

function playSound(value) {
    value = value.toLowerCase(); // t in ['d', 't', 'k', 's']
    
    if (typeof(playSound.sounds) == 'undefined') {
        playSound.sounds = {
            'd' : new Audio('sounds/darbuka_dum.wav'),
            't' : new Audio('sounds/darbuka_tek.wav'),
            'k' : new Audio('sounds/darbuka_ka.wav'),
        };
        // playSound.sounds = {
        //     'd' : new Audio('sounds/riq_dum.wav'),
        //     't' : new Audio('sounds/riq_tek.wav'),
        //     's' : new Audio('sounds/riq_s.wav'),
        // };
    }


    if (playSound.sounds[value] == undefined)
        return;
    playSound.sounds[value].currentTime = 0; // why do we have to do that?
    playSound.sounds[value].play();
}

function betweenModulo(t, t0, t1) {
    // check if t0 < t <= t1 in modular (mod 1) fashion 0 <= t_i <= 1 for all t_i

    t0 = (t0+1) % 1;
    t1 = (t1+1) % 1;

    if (t0 <= t1) {
        return t0 < t && t <= t1;
    } else {
        return !betweenModulo(t, t1, t0);
    }
}

function changeNoteColor(index, color) {
    for (let c of document.getElementById(`vf-N${index}`).firstElementChild.children) {
        c.firstElementChild.setAttribute("fill", color);
        c.firstElementChild.setAttribute("stroke", color);
    }

    // ! change color of the beam stem
}

function theLoop() {
    console.assert(N.cursorT != -1);

    if (typeof(theLoop.lastExecuted) == 'undefined') {
        theLoop.lastExecuted = Date.now();
    }
    let now = Date.now();
    let dT = now - theLoop.lastExecuted;
    theLoop.lastExecuted = now;

    let barPerMs = bpm / (N.iqaaObj.key[0] * 60000);
    let dCursor = dT * barPerMs;

    let oldCursorT = N.cursorT;
    N.cursorT = (N.cursorT + dCursor)%1;

    let indexValueSum = Math.round(N.cursorT * N.iqaaObj.noteValuesSum) % N.iqaaObj.noteValuesSum;
    let [index, isFirstTickOfNote] = N.iqaaObj.indexFromValueSum[indexValueSum];
    let dx = 0.75 * refreshRate*barPerMs; // half refresh rate measured between [0, 1]
    let x = indexValueSum/N.iqaaObj.noteValuesSum;
        
    if (isFirstTickOfNote && // otherwise it'll play at every subdivision of the note
        !betweenModulo(oldCursorT, -dx + x, dx + x) && 
         betweenModulo(N.cursorT,  -dx + x, dx + x)) {

        new Promise(async () => {
            if (N.iqaaObj.notes[index][0] == 's')
                return;
            changeNoteColor(index, 'red');
            await new Promise(r => setTimeout(r, N.iqaaObj.notes[index][1] * (2 * barPerMs * N.iqaaObj.noteValuesSum)**-1));
            changeNoteColor(index, 'black');
        });

        playSound(N.iqaaObj.notes[index][0]);
        // LogT.push(T_1); // to log timestamps
        // [Analysis]
        // LogT.map((v, i) => LogT[i+1]-v)
        // ArrayDifferenceAverage(LogT)
    }
}

function PlayStop(play) {
    if (play) {
        delete theLoop.lastExecuted;
        //! note the first note won't be played as oldCursorT == N.cursorT as dT == 0
        N.cursorT = 0;
        PlayStop.intervalID = setInterval(theLoop, refreshRate);
    } else {
        N.cursorT = -1;
        if (PlayStop.intervalID != undefined)
            clearInterval(PlayStop.intervalID);
    }
}

// --------------------------------------------------------------------

function ArrayDifferenceAverage(arr) {
    return arr.map((v, i) => arr[i+1]-v).filter((x)=>x).reduce((a,b)=>a+b,0)/(arr.length-1);
}

function calculateBPM() {
    if (typeof(calculateBPM.T) == 'undefined') {
        calculateBPM.T = [];
    }

    let now = Date.now();
    if (now - calculateBPM.T[calculateBPM.T.length - 1] > 2000) {
        calculateBPM.T = [];
    }
    calculateBPM.T.push(now);


    if (calculateBPM.T.length == 1)
        return undefined
    else
        return 60000/ArrayDifferenceAverage(calculateBPM.T);
}
