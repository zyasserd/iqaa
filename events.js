'use strict';



// You can do that!
document.getElementById('iqaaTextInput').value = '4/4:([[DDDD]])   [[((Dss)d)]]  ([D[DD]]) [[((Ds)D)s]]';

document.getElementById('bpmInput').onchange = (e) => {
    if (e.target.value > 400)
        e.target.value = 400;
    else if (e.target.value < 30)
        e.target.value = 30;
    bpm = e.target.value;
};

var isPlaying = false;
document.getElementById('playButton').addEventListener('click', (e) => {
    
    isPlaying ^= true;
    PlayStop(isPlaying);
    e.target.value = (isPlaying ? 'stop' : 'play');

});

document.getElementById('iqaaTextButton').addEventListener('click', (e) => {
    

    PlayStop(isPlaying=false);
    document.getElementById('playButton').value = 'play';

    N.setIqaa(document.getElementById('iqaaTextInput').value).drawDividers(false);

});


document.getElementById('bpmButton').addEventListener('click', () => {
    let t = calculateBPM();
    if (t != undefined) {
        document.getElementById('bpmInput').value = Math.round(t);
        document.getElementById('bpmInput').dispatchEvent(new Event('change'));
    }
    console.log(t);
});
document.onkeypress = function(e) {
    if (e.key == 'b') {
        let t = calculateBPM();
        if (t != undefined) {
            document.getElementById('bpmInput').value = Math.round(t);
            document.getElementById('bpmInput').dispatchEvent(new Event('change'));
        }
        console.log(t);
    } else if (e.key == ' ') {
        if (!(document.activeElement.tagName.toLowerCase() == 'input' && 
            document.activeElement.type.toLowerCase() != 'button')) {
            
            document.getElementById('playButton').focus();
            document.getElementById('playButton').click();

        }
    }
}
