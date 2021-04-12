'use strict';

class Notation {
    static VF = Vex.Flow;
    
    constructor(divID, width=500, height=120, paddingX=10, paddingY=5) {
        
        this.divID = divID;

        this.width = width;
        this.height = height;
        this.paddingX = paddingX;
        this.paddingY = paddingY;

        this.isShowText = true;
        
        let renderer = new Notation.VF.Renderer(document.getElementById(divID), Notation.VF.Renderer.Backends.SVG);
        renderer.resize(width, height);

        this.context = renderer.getContext();
    }

    setIqaa(iqaaStr) {

        this.context.clear();


        this.iqaaObj = parseIqaaString(iqaaStr);

        this.stave = new Notation.VF.Stave(this.paddingX, this.paddingY, this.width - this.paddingX*2);
        this.stave.options.line_config =[
            { visible: false },
            { visible: false },
            { visible: true }, // show middle
            { visible: false },
            { visible: false },
        ];
    
        this.stave.addClef("percussion").addTimeSignature(`${this.iqaaObj.key[0]}/${this.iqaaObj.key[1]}`, 0/* sets padding to 0*/);
    
        this.stave.setContext(this.context);
        this.stave.draw();

        let notes_texts_array = this._iqaaToNotes();
        this.notes = notes_texts_array[0];
        this.texts = notes_texts_array[1];
        this.beams = notes_texts_array[2];
        this.texts.forEach(i => i.setStave(this.stave));

        this.voiceNotes = new Notation.VF.Voice({num_beats: this.iqaaObj.key[0],  beat_value: this.iqaaObj.key[1]}).addTickables(this.notes);
        this.voiceText = new Notation.VF.Voice({num_beats: this.iqaaObj.key[0],  beat_value: this.iqaaObj.key[1]}).addTickables(this.texts);
        
        if (this.isShowText) {
            new Notation.VF.Formatter().joinVoices([this.voiceNotes, this.voiceText]).format([this.voiceNotes, this.voiceText], this.stave.end_x - this.stave.start_x);
        
            this.voiceNotes.draw(this.context, this.stave);
            this.voiceText.draw(this.context, this.stave);
        } else {
            new Notation.VF.Formatter().joinVoices([this.voiceNotes]).format([this.voiceNotes], this.stave.end_x - this.stave.start_x, 0);

            this.voiceNotes.draw(this.context, this.stave);
        }

        // Draw Beams
        for (let beam of this.beams) {
            beam.setContext(this.context).draw();
        }
        

        // Required for the dividers
        this.y0 = this.stave.getBottomLineBottomY();
        this.y1 = this.stave.getTopLineTopY();
        
        this.epsilon = Math.min(
            this.notes[0].getModifierStartXY().x - this.stave.getNoteStartX(),
            (this.notes[1].getModifierStartXY().x - this.notes[0].getModifierStartXY().x) / 8,
            12
        );

        // Required for the cursor
        this.noteValues = this.notes.map(i => i.intrinsicTicks);
        this.noteValuesSum = this.noteValues.reduce((a, b) => a + b, 0);

        this.noteXs = this.notes.map(i => i.getModifierStartXY().x - this.epsilon);
        this.noteXs.push(this.stave.end_x);

        this.cursorX = -1; // means hidden
        this._cursorT = -1;
        this.cursor = this.drawLineX(this.noteXs[0], this.y0, this.y1, 1.5, 'red', false, false);
        
        return this;
    }

    redraw() {

        this.context.clear();

        this.stave.draw();

        this.voiceNotes.draw(this.context, this.stave);
        if (this.isShowText)
            this.voiceText.draw(this.context, this.stave);

        for (let beam of this.beams) {
            beam.setContext(this.context).draw();
        }

        return this;
    }

    _iqaaToNotes() {

        let noteNotes = [];
        let textNotes = [];

        for (let [i, v] of this.iqaaObj.notes.entries()) {
            
            let noteValue;
            let isDotted = false;
            if (v[1] % 3 == 0) {
                noteValue = this.iqaaObj.unit / (v[1] * (2/3));
                noteValue += 'd';
                isDotted = true;
            }
            else
                noteValue = this.iqaaObj.unit / v[1];

            let text;
            if (v[0] == 's')
                text = 's';
            else if (v[0] == 'k')
                text = 'Ka';
            else
                text = v[0].toUpperCase();

            textNotes.push(
                new Notation.VF.TextNote({
                    text: text,  duration: String(noteValue),
                    font: {family: "Gonville", size: 15, weight: ""}
                }).setJustification(Notation.VF.TextNote.Justification.CENTER)
                  .setAttribute('id', `T${i}`)
            );
    
            switch (v[0]) {
                case 'd':
                    noteNotes.push(
                        new Notation.VF.StaveNote({
                            clef: "percussion", keys: ["b/4"], duration: String(noteValue),
                            stem_direction: Vex.Flow.StaveNote.STEM_UP
                        }).setAttribute('id', `N${i}`)
                    );
                    break;
                case 't':
                case 'k':
                    noteNotes.push(
                        new Notation.VF.StaveNote({
                            clef: "percussion", keys: ["b/4"], duration: String(noteValue),
                            stem_direction: Vex.Flow.StaveNote.STEM_DOWN
                        }).setAttribute('id', `N${i}`)
                    );
                    break;
                case 's':
                    noteNotes.push(
                        new Notation.VF.StaveNote({
                            clef: "percussion", keys: ["b/4"], duration: `${noteValue}r`
                        }).setAttribute('id', `N${i}`)
                    );
                    break;
                default:
                    // Tk, and other stuff
                    break;
            }

            if (isDotted) {
                noteNotes[noteNotes.length - 1].addDot(0);
            }
        }

        let beamGroups = [];
        for (let l of this.iqaaObj.beamIndices) {
            beamGroups.push(new Vex.Flow.Beam(noteNotes.slice(l[0], l[1] + 1)));
        }

        return [noteNotes, textNotes, beamGroups];
    }

    setTextVisibility(bool) {
        this.isShowText = bool;

        return this;
    }

    drawDividers(drawAllDividers=false) {

        for (let i = 0; i < this.notes.length; i++) {
            if (drawAllDividers || this.iqaaObj.barIndices.includes(i-1)) {
                this.drawLineX(
                    this.notes[i].getModifierStartXY().x - this.epsilon,
                    this.y0, this.y1
                );
            }
        } 

        return this;
    }

    drawLineX(x, y0, y1, width=1, color="#000", dashed=true, visible=true) {
        
        let newElement = document.createElementNS("http://www.w3.org/2000/svg", 'line');
        
        newElement.setAttribute("x1", x);
        newElement.setAttribute("y1", y0);
        newElement.setAttribute("x2", x);
        newElement.setAttribute("y2", y1);
    
        newElement.setAttribute("stroke-width", `${width}px`);
        newElement.setAttribute("stroke", color);
        if (dashed)
            newElement.setAttribute("stroke-dasharray", "4 2");
        if (visible)
            newElement.setAttribute('visibility', 'visible');
        else
            newElement.setAttribute('visibility', 'hidden');
            
    
        document.getElementById(this.divID).children[0].appendChild(newElement);

        return newElement;

    }

    tToX(t) {

        let temp = t * this.noteValuesSum;
        let i = 0;
        for (; i < this.notes.length && this.noteValues[i] < temp; i++) {
            temp -= this.noteValues[i];
        }
        
        return (this.noteXs[i+1] - this.noteXs[i]) * (temp/this.noteValues[i]) + this.noteXs[i];

    }

    get cursorT() {
        return this._cursorT;
    }

    set cursorT(t) {
        // 0 <= t <= 1 || t == -1

        if ((0 <= t && t <= 1) || t == -1) {
            this._cursorT = t;

            if (t == -1) {
                this.cursorX = -1;
                this.cursor.setAttribute('visibility', 'hidden');
    
            } else {
                this.cursorX = this.tToX(t);
                this.cursor.setAttribute('x1', this.cursorX);
                this.cursor.setAttribute('x2', this.cursorX);
                if (this.cursor.getAttribute('visibility') == 'hidden')
                    this.cursor.setAttribute('visibility', 'visible');
    
            }

        }
    }

    destruct() {
        this.context.svg.remove();
    }
}
