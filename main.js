var canvas;
var engine;

var flywheeldiameter = 68; // mm

var piston_height_px = 10;

var canvasmargin = 20; // px
var px_per_mm;

var maxrpm = 0;

function setup() {
    canvas = createCanvas(400, 400);
    canvas.parent('canvas');

    engine = new Engine();

    let totalheight_mm = flywheeldiameter/2 + engine.crankthrow + engine.rodlength + engine.deadspace; // mm
    let availableheight_px = canvas.height - 2*canvasmargin;
    px_per_mm = availableheight_px / totalheight_mm;
}

function draw() {
    engine.step(0.1 * deltaTime / 1000.0);

    background(220);

    drawFlywheel();
    drawCylinder();
    drawPiston();
    drawPorts();
    drawPivot();

    if (engine.rpm > maxrpm) maxrpm = engine.rpm;
    document.getElementById('rpm').innerText = Math.round(engine.rpm*100)/100;
    document.getElementById('maxrpm').innerText = Math.round(maxrpm*100)/100;
    document.getElementById('pressure').innerText = Math.round(engine.cylinderpressure*100)/100;
}

function drawFlywheel() {
    let diameter = flywheeldiameter * px_per_mm;

    let centre_px = canvas.height - canvasmargin - diameter/2;

    push();

    translate(canvas.width/2, centre_px);

    circle(0, 0, diameter); // flywheel

    pop();
}

function drawCylinder() {
    push();

    // height of pivot from top of cylinder
    let pivot_height_mm = engine.deadspace + engine.crankthrow + engine.rodlength - engine.pivotseparation;
    let pivot_height_px = canvasmargin + pivot_height_mm * px_per_mm;

    // cylinder dimensions
    let cylinder_height_mm = engine.deadspace + 2*engine.crankthrow;
    let cylinder_width_mm = engine.bore;
    let cylinder_height_px = cylinder_height_mm * px_per_mm + piston_height_px
    let cylinder_width_px = cylinder_width_mm * px_per_mm;

    translate(canvas.width/2, pivot_height_px);
    rotate(engine.cylinderangle * PI/180);

    rect(-cylinder_width_px/2, -pivot_height_mm*px_per_mm, cylinder_width_px, cylinder_height_px); // main cylinder
    circle(0, -engine.portthrow * px_per_mm, engine.cylinderportdiameter * px_per_mm); // cylinder port

    noStroke();
    let atmospheric_colour = color(0,255,255);
    let inlet_colour = color(255,0,0);
    let gas_colour = lerpColor(atmospheric_colour, inlet_colour, engine.cylinderpressure/engine.inletpressure);
    gas_colour.setAlpha(127);
    fill(gas_colour);
    rect(-cylinder_width_px/2, -pivot_height_mm*px_per_mm, cylinder_width_px, engine.pistonheight * px_per_mm); // cylinder gases

    pop();
}

function drawPiston() {
    let diameter = flywheeldiameter * px_per_mm;
    let centre_px = canvas.height - canvasmargin - diameter/2;

    push();

    translate(canvas.width/2, centre_px);
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

    translate(canvas.width/2, centre_px);
    circle(engine.inletportx*px_per_mm, -engine.inletporty*px_per_mm, engine.inletportdiameter*px_per_mm);
    circle(engine.exhaustportx*px_per_mm, -engine.exhaustporty*px_per_mm, engine.exhaustportdiameter*px_per_mm);
    circle(engine.cylinderportx*px_per_mm, -engine.cylinderporty*px_per_mm, engine.cylinderportdiameter*px_per_mm);

    pop();
}

function drawPivot() {
    let diameter = flywheeldiameter * px_per_mm;

    let pivot_centre_px = canvas.height - canvasmargin - diameter/2 - engine.pivotseparation*px_per_mm;

    circle(canvas.width/2, pivot_centre_px, 2);
}

