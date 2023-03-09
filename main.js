var canvas;
var engine;
var pvdiagram;

var flywheeldiameter = 68; // mm

var piston_height_px = 10;

var canvasmargin = 20; // px
var px_per_mm;

var maxrpm = 0;

var validators = {};
var lastgoodvalue = {};

var engine_centre_px = 150;

function setup() {
    canvas = createCanvas(600, 400);
    canvas.parent('canvas');

    engine = new Engine();

    pvdiagram = new PVDiagram(5000);

    validate('bore', (x) => x > 0);
}

function draw() {
    engine.crankthrow = val('crankthrow');
    engine.portthrow = val('portthrow');
    engine.deadspace = val('deadspace');
    engine.bore = val('bore');
    engine.rodlength = val('rodlength');
    engine.inletportdiameter = val('inletportdiameter');
    engine.exhaustportdiameter = val('exhaustportdiameter');
    engine.cylinderportdiameter = val('cylinderportdiameter');
    engine.inletportangle = val('inletportangle');
    engine.exhaustportangle = val('exhaustportangle');
    engine.pivotseparation = val('pivotseparation');
    engine.flywheelmomentofinertia = val('flywheelmomentofinertia');

    engine.atmosphericpressure = val('atmosphericpressure');
    engine.inletpressure = val('inletpressure')+engine.atmosphericpressure;
    engine.frictiontorque = val('frictiontorque');
    engine.airflowrate = val('airflowrate');
    engine.airdensity = val('airdensity');

    pvdiagram.inletpressure = engine.inletpressure;
    pvdiagram.atmosphericpressure = engine.atmosphericpressure;

    let totalheight_mm = flywheeldiameter/2 + engine.crankthrow + engine.rodlength + engine.deadspace; // mm
    let availableheight_px = canvas.height - 2*canvasmargin;
    px_per_mm = availableheight_px / totalheight_mm;

    let secs = deltaTime / 1000.0;
    let timeFactor = val('timefactor')/100;
    txt('timefactorlabel', timeFactor);
    let stepTime = 0.0001;
    let steps = timeFactor * secs/stepTime;
    if (steps > 10000) steps = 10000;
    for (let i = 0; i < steps; i++) {
        engine.step(stepTime);
        pvdiagram.add(engine.cylinderpressure, engine.cylindervolume);
    }

    background(220);

    drawFlywheel();
    drawCylinder();
    drawPiston();
    drawPorts();
    drawPivot();

    translate(engine_centre_px*2,0); // offset to clear the engine
    pvdiagram.draw(canvas.width-engine_centre_px*2,canvas.height); // draw inside the reset of the canvas

    if (engine.rpm > maxrpm) maxrpm = engine.rpm;
    txt('rpm', round(engine.rpm, 2));
    txt('maxrpm', round(maxrpm, 2));
    txt('pressure', round(engine.cylinderpressure-engine.atmosphericpressure, 2));
    txt('torque', round(engine.torque, 5));
    txt('meanrpm', round(engine.meanrpm, 2));
    txt('power', round(engine.power, 3));
    txt('horsepower', round(engine.power/746, 5));
    txt('cc', round(PI * (engine.bore/20)*(engine.bore/20) * (engine.crankthrow*2/10), 2));
}

function drawFlywheel() {
    let diameter = flywheeldiameter * px_per_mm;

    let centre_px = canvas.height - canvasmargin - diameter/2;

    push();

    translate(engine_centre_px, centre_px);

    circle(0, 0, diameter); // flywheel

    pop();
}

function drawCylinder() {
    push();

    // height of pivot from top of cylinder
    let pivot_height_mm = engine.deadspace + engine.crankthrow + engine.rodlength - engine.pivotseparation;

    let diameter = flywheeldiameter * px_per_mm;
    let pivot_centre_px = canvas.height - canvasmargin - diameter/2 - engine.pivotseparation*px_per_mm;

    // cylinder dimensions
    let cylinder_height_mm = engine.deadspace + 2*engine.crankthrow;
    let cylinder_width_mm = engine.bore;
    let cylinder_height_px = cylinder_height_mm * px_per_mm + piston_height_px
    let cylinder_width_px = cylinder_width_mm * px_per_mm;

    translate(engine_centre_px, pivot_centre_px);
    rotate(engine.cylinderangle * PI/180);

    rect(-cylinder_width_px/2, -pivot_height_mm*px_per_mm, cylinder_width_px, cylinder_height_px); // main cylinder
    circle(0, -engine.portthrow * px_per_mm, engine.cylinderportdiameter * px_per_mm); // cylinder port

    noStroke();
    let atmospheric_colour = color(0,255,255);
    let inlet_colour = color(255,0,0);
    let gas_colour = lerpColor(atmospheric_colour, inlet_colour, (engine.cylinderpressure-engine.atmosphericpressure)/(engine.inletpressure-engine.atmosphericpressure));
    gas_colour.setAlpha(127);
    fill(gas_colour);
    rect(-cylinder_width_px/2, -pivot_height_mm*px_per_mm, cylinder_width_px, engine.pistonheight * px_per_mm); // cylinder gases

    pop();
}

function drawPiston() {
    let diameter = flywheeldiameter * px_per_mm;
    let centre_px = canvas.height - canvasmargin - diameter/2;

    push();

    translate(engine_centre_px, centre_px);
    rotate(engine.crankposition * PI/180);

    rect(-5, 0, 10, -engine.crankthrow * px_per_mm); // crank
    circle(0, 0, 10);

    translate(0, -engine.crankthrow * px_per_mm);
    rotate((-engine.crankposition + engine.cylinderangle) * PI/180);
    rect(-5, 0, 10, -engine.rodlength * px_per_mm); // rod
    circle(0, 0, 10);
    translate(0, -engine.rodlength * px_per_mm);
    let bore_mm = engine.bore * px_per_mm;
    rect(-bore_mm/2, 0, bore_mm, piston_height_px); // piston

    pop();
}

function drawPorts() {
    let diameter = flywheeldiameter * px_per_mm;
    let centre_px = canvas.height - canvasmargin - diameter/2 - engine.pivotseparation*px_per_mm;

    push();

    translate(engine_centre_px, centre_px);
    circle(engine.inletportx*px_per_mm, -engine.inletporty*px_per_mm, engine.inletportdiameter*px_per_mm);
    circle(engine.exhaustportx*px_per_mm, -engine.exhaustporty*px_per_mm, engine.exhaustportdiameter*px_per_mm);
    circle(engine.cylinderportx*px_per_mm, -engine.cylinderporty*px_per_mm, engine.cylinderportdiameter*px_per_mm);

    pop();
}

function drawPivot() {
    let diameter = flywheeldiameter * px_per_mm;
    let pivot_centre_px = canvas.height - canvasmargin - diameter/2 - engine.pivotseparation*px_per_mm;

    circle(engine_centre_px, pivot_centre_px, 2);
}

function btn(id, cb) {
    document.getElementById(id).onclick = cb;
}

function val(id) {
    let formvalue = parseFloat(document.getElementById(id).value);
    let vals = validators[id];
    if (vals) {
        for (let i = 0; i < vals.length; i++) {
            let cb = vals[i];
            if (!cb(formvalue)) {
                // validation failed
                document.getElementById(id).classList.add('error');
                return lastgoodvalue[id];
            }
        }
    }
    document.getElementById(id).classList.remove('error');
    lastgoodvalue[id] = formvalue;
    return formvalue;
}

function txt(id, val) {
    document.getElementById(id).innerText = val;
}

function round(num, places) {
    return Math.round(num * Math.pow(10,places))/Math.pow(10,places);
}

function validate(id, cb) {
    validators[id] ||= [];
    validators[id].push(cb);
}

btn('reset', function() { engine.reset(); pvdiagram.clear(); maxrpm = 0; });
