const { Engine } = require('./engine.js');

let engine = new Engine();

let cantweak = [
    'deadspace', 'pivotseparation', 'portthrow', 'inletportdiameter',
    'exhaustportdiameter', 'cylinderportdiameter', 'inletportangle',
    'exhaustportangle',
];

let best = {
    inletportangle: -11.99,
    exhaustportangle: 12.06,
    inletportdiameter: 4.69,
    exhaustportdiameter: 5.84,
    cylinderportdiameter: 5.89,
    portthrow: 21.68,
    pivotseparation: 58.09,
    deadspace: 0.62,
};

for (let f of cantweak) {
    engine[f] = best[f];
}
engine.makePorts();

let bestengine = engine;
let bestscore = score(engine);

console.log("best score = " + bestscore);

while (true) {
    let field = cantweak[Math.floor(Math.random() * cantweak.length)];
    let factor = 1 - (Math.random() * 0.05);
    engine = bestengine.clone();
    engine[field] *= factor;
    engine.makePorts();
    console.log("Set " + field + " to " + engine[field]);
    let s = score(engine);
    if (s > bestscore) {
        bestengine = engine;
        bestscore = s;
        dumpbest();
    } else { // go the other way
        engine = bestengine.clone();
        engine[field] /= factor;
        engine.makePorts();
        console.log("Set " + field + " to " + engine[field]);
        let s = score(engine);
        if (s > bestscore) {
            bestengine = engine;
            bestscore = s;
            dumpbest();
        }
    }
}

function score(engine) {
    let r = 0;
    engine.onstable = function() {
        r = engine.meanrpm;
        engine.stop();
    };
    engine.run();
    return r;
}

function dumpbest() {
    console.log("bestscore = " + bestscore);
    let str = "";
    for (let f of cantweak) {
        str += f + "=" + bestengine[f] + " ";
    }
    console.log(str);
}
