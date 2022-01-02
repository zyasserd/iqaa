'use strict';

const { inspect } = require('util');
const print = x => console.log(inspect(x, false, null, true));


class TreePrototype {
    apply(pattern) {
        return (pattern[this.constructor.name] ?? pattern['Default'] ?? error())(this);
    }

    map(f) {
        if (this instanceof TreeContainer)
            return new this.constructor(this.children.map(f));
        else if (this instanceof Leaf)
            return new Leaf(this.sound, f(this.duration));
        else if (this instanceof Barline)
            return new Barline();
    }

    flatMap(f) {
        if (this instanceof TreeContainer)
            return new this.constructor(this.children.flatMap(f));
        else if (this instanceof Leaf)
            return [new Leaf(this.sound, this.duration)];
        else if (this instanceof Barline)
            return [new Barline()];
    }

    match(f, defaultArgs) {
        return (function rec(node, args=defaultArgs) {
            return node.apply(f(rec, args));
        })(this);
    }
}

class TreeContainer extends TreePrototype {
    constructor(children) {
        super();
        this.children = children ?? [];
    }
}

class Root extends TreeContainer { }
class Combiner extends TreeContainer {
    get endTag() { return ')'; };
}
class Divider extends TreeContainer {
    get endTag() { return ']'; };
}
class Leaf extends TreePrototype {
    constructor(sound, duration) {
        super();
        this.sound = sound;
        this.duration = duration;
    }
}
class Barline extends TreePrototype { }


function isPowerOfTwo(x) {
    return (x != 0) && ((x & (x - 1)) == 0);
}

function parseIqaa(str) {

    // [STEP 0]   Preprocessing (Change format)
    str = str.toLowerCase().replaceAll(' ', '');

    // [STEP 0.5] Preprocessing (Dotted Notes)
    str = str.replaceAll(/([dtks])\./g, "[($1ss)]");


    // [STEP 1] Creating the parse tree
    // Throws:
    //      1. invalid char
    //      2. Bracket Mismatch
    //      3. invalid barline location
    let tree = new Root();
    let stack = [tree];
    stack.nestedPush = x => stack[stack.length - 1].children.push(x);
    for (const [i, c] of str.split('').entries()) {
        if ("dtks".includes(c)) {
            stack.nestedPush(new Leaf(c));

        } else if (c === '|'){
            if (stack.length === 1)
                stack.nestedPush(new Barline());
            else
                throw(`[Parse Error]: Unexpected Barline at ${i}`);

        } else if ("([".includes(c)) {
            let theNode = (c === '(') ? new Combiner() : new Divider();
            stack.nestedPush(theNode);
            stack.push(theNode);

        } else if (")]".includes(c)) {
            if ((c === ')' && stack[stack.length - 1] instanceof Combiner) ||
                (c === ']' && stack[stack.length - 1] instanceof Divider))
                stack.pop();
            else
                throw(`[Parse Error]: Unmatched "${c}" at ${i}`);

        } else {
            throw(`[Parse Error]: Unallowed character "${c}" at ${i}`);
        }
    }
    if (stack.length > 1) {
        throw(`[Parse Error]: Expected "${stack[stack.length - 1].endTag}"`);
    }


    // [STEP 2] Assign durations to leaves

    // set leaves duration to the number of Divider parents
    tree = tree.match((rec, i) => ({
        Leaf:    x => x.map(_ => i),
        Divider: x => x.map(y => rec(y, i+1)),
        Default: x => x.map(y => rec(y, i))
    }), 0);

    // Get the depth of the tree
    let treeList = tree.match(rec => ({
        Leaf:    x => [x.duration],
        Barline: _ => [],
        Default: x => x.children.flatMap(rec)
    }));
    let dividerDepth = Math.max(...treeList);

    // Assign the actual duration
    tree = tree.match(rec => ({
        Leaf:    x => x.map(v => 2**(dividerDepth-v)),
        Default: x => x.map(rec)
    }));
    
    // Remove Divider nodes
    tree = tree.match(rec => ({
        Divider:  x => x.children.flatMap(rec),
        Default:  x => x.flatMap(rec)
    }));



    // [STEP 3] Combiner (Maximizer)
    tree = tree.match(rec => ({
        Combiner: x => {
            if (x.children.length === 0) {
                // Removing empty Combiners
                // ex: ()
                return [];  

            } else if (x.children.length === 1) {
                // Removing one noded Combiners
                // ex: (((D))) => D
                return [x.children[0]];

            }else if (x.children.every(y => y instanceof Leaf) && 
                      x.children.map(y => y.sound).splice(1).every(y => y==='s')) {
                return [new Leaf(
                    x.children[0].sound, 
                    x.children.map(y => y.duration).reduce((a,b) => a+b, 0)
                )];

            } else {
                // flatMap twice to cover recursive cases
                // ex: ((Ds)Dss)
                return x.flatMap(rec).flatMap(rec);
                
            }
        },
        Root:    x => x.flatMap(rec).flatMap(rec),
        Default: x => x.flatMap(rec)
    }));


    // [STEP 4] Flatten nested Combiners
    // ex: ((DD)(DD(KK))) => (DDDDKK)
    tree = tree.match((rec, isNestedCombiner) => ({
        Combiner: x => {
            if (isNestedCombiner)
                return x.flatMap(y => rec(y, true)).children
            else
                return x.flatMap(y => rec(y, true))
        },
        Default: x => x.flatMap(y => rec(y, isNestedCombiner))
    }), false);


    // [STEP 5] Checking (Notes duration, Beams Homogeneity)
    // Throws:
    //      1. Beam Mix Error (D+T or D+K)
    //      2. Note value Error (Duration)
    tree.match(rec => ({
        Combiner: x => {
            // check that the Beam notes sounds are homogeneous
            let s = [...new Set(x.children.map(y => y.sound))];
            if (! (s.every(y =>  "d".includes(y)) ||
                   s.every(y => "tk".includes(y))) )
                throw(`[Parse Error]: A beam has a mix of (D) and (T, K): ${s}`);
            x.map(rec);
        },
        Leaf: x => {
            // check that durations of notes is allowed
            if (! (isPowerOfTwo(x.duration) ||
                   (x.duration % 3 == 0 && isPowerOfTwo(x.duration/3))))
                throw(`[Parse Error]: A note "${x.sound}" has an unsupported value of ${x.duration}`);
        },
        Default: x => x.map(rec)
    }));


    // [STEP 6] Extract Data

    return tree;

}


// let iqaa = "D[(((TK(TT))))](Ts)|DTTs(())|(D)([D])";
// let iqaa = "((Ds)ss)";
// let iqaa = "(((Ds)ss)sss)";
// let iqaa = "((((Ds)ss)sss)ssss)((()))";
// let iqaa = "(DT(DT))";
// let iqaa = "((DD)(DD(KK(TT))(TT)))";
// let iqaa = "((DD)TT)";


let iqaa = "([D] s)";
let tree = parseIqaa(iqaa);
print(tree);



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
