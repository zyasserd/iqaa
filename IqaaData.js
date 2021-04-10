// ** FORMAT SPECIFICATIONS **
// [#] spaces can be everywhere for readability
// [#] "|" could be anywhere but a [BEAM] or a [MAXIMIZER]
// s.replace(' ', '').replace('|', '') should be in the following format
// "n/m:[EXPR]" where
// [#] n should divide sum(values of the notes)
// [#] m: a power of two
// [ACTION]        ->  D | T | K | s
// [EXPR]          ->  ( [ACTION] | [MAXIMIZER] | [DIVIDER] | [BEAM] )+
// [EXPR_NO_BEAM]  ->  ( [ACTION] | [MAXIMIZER] | [DIVIDER] )+
// [MAXIMIZER]     ->  "(" [ACTION] s* ")"
//      USAGE: combine the value of one note value and zero or rests into one note
//      EXAMPLE: "2/8:(Ds)"  => 1 quarter note
//               "3/8:(Dss)" => 1 dotted quarter note
// [DIVIDER]       ->  "[" [EXPR] "]"
//      USAGE: notes inside have half their value
// [BEAM]          ->  "(" [EXPR_NO_BEAM] ")"
//      USAGE: to beam notes together
//      [#]: notes inside have to be of same kind (D, T, K)
//      [#]: (s) is not allowed
//      [#]: note values <= a quarter

var IqaaData = {
    "maqsum": ["4/4:DTsT|DsTs"],
    "samai thaqil": ["10/8:Dss|Ts|DD|Tss"],
    "fox": ["2/4:DTDT"],
    "aqsaq": ["9/8:Ds|Ts|Ds|TsT", "9/8:Ds|Ts|DD|TsT"],
    "dawr hindi": ["7/8:DTT|DsTs"]
};
