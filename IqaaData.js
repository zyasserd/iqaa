// Depreciated and Replaced by (IqaaStringParsing.js)
// Why? Using Regex and Grammars for parsing was
// too strict and prevented parsing of perfectly
// valid string.
// EX: ([Dss]),  ([D] [ss]),  ([D] s)
//     first two would parse but the third won't


// TODO: use grammar instead for parsing.

'use strict';

// ** FORMAT SPECIFICATIONS **
// [#] case insensitive
// [#] spaces can be everywhere for readability
// [#] "|" could be anywhere but a [BEAM] or a [MAXIMIZER]
// s.replace(' ', '').replace('|', '') should be in the following format
// "n/m:[EXPR]" where
// [#] n should divide sum(values of the notes)
// [#] m: a power of two
// [ACTION]           ->  D | T | K | s
// [EXPR]             ->  ( [ACTION] | [MAXIMIZER] | [DIVIDER] | [BEAM] )+
// [EXPR_NO_BEAM]     ->  ( [ACTION] | [MAXIMIZER] | [DIVIDER_NO_BEAM] )+
// [MAXIMIZER]        ->  "(" [ACTION] s* ")"
//      USAGE: combine the value of one note value and zero or rests into one note
//      EXAMPLE: "2/8:(Ds)"  => 1 quarter note
//               "3/8:(Dss)" => 1 dotted quarter note
// [DIVIDER_NO_BEAM]  ->  "[" [EXPR_NO_BEAM] "]"
// [DIVIDER]          ->  "[" [EXPR] "]"
//      USAGE: notes inside have half their value
// [BEAM]             ->  "(" [EXPR_NO_BEAM] ")"
//      USAGE: to beam notes together
//      [#]: notes inside have to be of same direction (D), or (T, K)
//      [#]: (s) is not allowed
//      [#]: note values <= a quarter


function splitButParen(s) {
    // returns s.split('') but if it's inside parenthesis then it's one unit
    // 'a(aa)'       => [a, aa]
    // 'ab(c(d))(e)' => [a, b, c(d), e]

    let depth = 0;
    let result = []; 
    let temp = '';

    for (let c of s) {
        if (c == '(') {
            if (depth++ == 0)
                continue;
        } else if (c == ')') {
            if (depth-- == 1) {
                result.push(temp);
                temp = '';
                continue 
            }
        }
        
        if (depth == 0)
            result.push(c);
        else
            temp += c;
    }

    return result;
}

function parseDumTakPart(input){

    // EXAMPLE:
    // input:           'D[(TK)](TT)|DTTs'
    // noDividerFormat: '(Ds)(TK)((Ts)(Ts))|(Ds)(Ts)(Ts)(ss)'


    // [Variable Declaration]
    const maximizer_regex = /^(d|t|k|s)s*$/;

    let _noDivider_regex_string = String.raw`
        (?:
            (?: d|t|k|s) |              # a comment
            \( (?: d|t|k|s) s* \) |
            \(
                (?: 
                    (?:
                        \(ds*\) | 
                        d
                    ){2,} |
                    (?:
                        \(ts*\) | t |
                        \(ks*\) | k
                    ){2,}
                )
            \)
        )+

    `.replaceAll(/\#.*$/gm, '') // remove comments
    .replaceAll(/\s/g,''); // remove whitespace

    // USAGE NOTES: noDivider_regex.test(s.replaceAll('|', ''))
    const noDivider_regex = new RegExp('^'+_noDivider_regex_string+'$');

    

    // [STEP 0]: Change format
    input = input.toLowerCase().replaceAll(' ', '');


    // [STEP 0.5]: Preprocessing (Dotted Notes)
    input = input.replaceAll(/([dtks])\./g, "[($1ss)]");


    // [STEP 1]: check that all characters are allowed
    let allowedCharacters = '|dtks()[]';
    if (!new Array(...new Set(input))
        .every(i => allowedCharacters.includes(i)))
        throw Error('parseDumTakPart: unallowed characters');


    // [STEP 2]:
    // check that brackets match && "()"" doen't exceed max depth (2)
    // find max depth of "[]"
    let squareBracketsLevel = 0;
    let roundBracketsLevel = 0;
    let maxDiv = 0;

    for (let c of input) {
        if (c == '(')
            roundBracketsLevel++;
        else if (c == ')')
            roundBracketsLevel--;
        else if (c == '[')
            squareBracketsLevel++;
        else if (c == ']')
            squareBracketsLevel--;

        if (roundBracketsLevel > 2)
            throw Error();
        if (roundBracketsLevel < 0 || squareBracketsLevel < 0)
            throw Error('parseDumTakPart: Bracket Mismatch');

        maxDiv = Math.max(maxDiv, squareBracketsLevel);
    }


    // [STEP 3]: Produce noDivider Format
    // noDivider Format: an equivalent iqaa without any []
    roundBracketsLevel = 0;
    let noDividerFormat = '';

    for (let c of input) {
        if (c == '[')
            squareBracketsLevel++;
        else if (c == ']')
            squareBracketsLevel--;
        else {
            if ('dtks'.includes(c)) {
                let rep = 2**(maxDiv-squareBracketsLevel);
                if (rep == 1)
                    noDividerFormat += c;
                else
                    noDividerFormat += '(' + c + 's'.repeat(rep - 1) + ')';
            } else {
                noDividerFormat += c;
            }
        }
    }

    // [STEP 3.5]: Fixing side effects of STEP 3
    // Example: (Ds) => ((Ds)(ss))    => (Dsss)
    //               ^ previous step  ^ this step
    noDividerFormat = noDividerFormat.replaceAll(
        /\(\((?:t|d|k|s)s*\)(?:\(s*\))+\)/g,
        m => '(' + m.replaceAll('(', '').replaceAll(')', '') + ')'
    )

    //? could return noDividerFormat
    // console.log(noDividerFormat);


    // [STEP 4]: Final Parsing
    // [STEP 4.1]: regex checking first
    if (!noDivider_regex.test(noDividerFormat.replaceAll('|', '')))
        throw Error('parseDumTakPart: Failed noDivider-format Regex Checking');
    
    // [STEP 4.2]: parsing
    let notes = [];
    let beamIndices = []; // x in beamIndices <=> x = [start, end]
    let barIndices = []; //  i in barIndices  <=> bar after index (i) [EX.] "0|" => [ 0 ]

    for (let v of splitButParen(noDividerFormat)) {
        if (v == '|') {
            if (notes.length == 0)
                throw Error("parseDumTakPart: Bar mark can't be placed in the beginning of the string");
            barIndices.push(notes.length - 1);
        } else if (v.length == 1) {
            notes.push([v, 1]);
        } else {
            if (v.includes('|'))
                throw Error("parseDumTakPart: Bar mark can't be placed inside a MAXIMIZER/BEAM");

            if(maximizer_regex.test(v)) {
                // Inside a MAXIMIZER ex. (Ds)
                notes.push([v[0], v.length]);
            } else { 
                // Inside a beam ex. (DD)
                let beamIndex = notes.length;

                for (let w of splitButParen(v)) {
                    if (w.length == 1)
                        notes.push([w, 1]);
                    else {
                        notes.push([w[0], w.length]);
                    }
                }
                beamIndices.push([beamIndex, notes.length-1]);
            }
        }
    }

    // [STEP 5]: check that durations of notes is allowed
    // either (2^n) OR 3*(2^n)
    for (let v of notes) {
        if (!(isPowerOfTwo(v[1]) ||
            (v[1] % 3 == 0 && isPowerOfTwo(v[1]/3))
            ))
            throw Error('parseDumTakPart: a note has invalid duration value');
    }


    return {
        notes,
        beamIndices,
        barIndices,
        noteValuesSum: notes.map(i => i[1]).reduce((a, b) => a+b, 0)
    };
}

function isPowerOfTwo(x) {
    return (x != 0) && ((x & (x - 1)) == 0);
}

function parseIqaaString(str) {
    
    /*  [EXAMPLE INPUTS]
    *   "10/8:Dss|Ts|(DD)|Tss" =>
    *   {
    *       key: [10, 8], unit: 8,
    *       notes: [ ['d', 1], ['s', 1], ['s', 1], ['t', 1], ['s', 1], ['d', 1], ['d', 1], ['t', 1], ['s', 1], ['s', 1] ],
    *       beamIndices: [ [ 5, 6 ] ],
    *       barIndices: [ 2, 4, 6 ],
    *       noteValuesSum: 10
    *   }
    * 
    *   "4/4:[(Dss)][(Tss)]D|DsTs" =>
    *   {
    *       key: [4, 4],
    *       unit: 16,
    *       notes: [ ['d', 3], ['t', 3], ['d', 2], ['d', 2], ['s', 2], ['t', 2], ['s', 2] ],
    *       beamIndices: [],
    *       barIndices: [ 2 ],
    *       noteValuesSum: 16
    *   }
    *   "4/4:D[(TK)](TT)|DTTs" =>
    *   {
    *       unit: 16,
    *       notes: [ ['d', 2], ['t', 1], ['k', 1], ['t', 2], ['t', 2], ['d', 2], ['t', 2], ['t', 2], ['s', 2] ],
    *       beamIndices: [ [ 1, 2 ], [ 3, 4 ] ],
    *       barIndices: [ 4 ],
    *       noteValuesSum: 16
    *   }
    */


    let _parts = str.split(':');
    let _keyStr = _parts[0].split('/');

    let key = [Number(_keyStr[0]), Number(_keyStr[1])];
    if (!isPowerOfTwo(key[1]))
        throw("parseIqaaString: the key signature denominator should be a power of two"); 
    let parseObj = parseDumTakPart(_parts[1]);
    let unit = key[1] * parseObj.noteValuesSum / key[0]
    if (!isPowerOfTwo(unit))
        throw("parseIqaaString: noteValuesSum doesn't match with the meter");


    let indexFromValueSum = {};
    let _n = 0;
    for (let [i, c] of parseObj.notes.entries()) {
        for (let j = 0; j < c[1]; j++) {
            indexFromValueSum[_n] = [i, j == 0]; // [index, isFirstTickOfNote]
            _n++;
        }
    }

    return {key, unit, ...parseObj, indexFromValueSum};

}

const IqaaData = {
    "maqsum": ["4/4:DTsT|DsTs"],
    "samai thaqil": ["10/8:Dss|Ts|(DD)|Tss"],
    "fox": ["2/4:DTDT"],
    "aqsaq": ["9/8:Ds|Ts|Ds|TsT", "9/8:Ds|Ts|DD|TsT"],
    "dawr hindi": ["7/8:DTT|DsTs"],
    "wahda wi nuss": ["4/4:[(Dss)][(Tss)]t|DsTs"],
    "ciftetelli": ["8/4: D [T]T [T]T | DDTs"],
    "zaffa": ["4/4:D[(TK)](TT)|DTTs"]

};
