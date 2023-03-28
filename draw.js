function drawFlywheel() {
    let diameter = engine.flywheeldiameter * px_per_mm;
    let centre_px = canvas.height - canvasmargin - diameter/2;

    push();

    translate(engine_centre_px, centre_px);
    rotate((180+engine.crankposition) * PI/180);

    circle(0, 0, diameter); // flywheel
    line(0, 0, 0, diameter/2);

    pop();
}

function drawCylinder() {
    push();

    // height of pivot from top of cylinder
    let pivot_height_mm = engine.deadspace + engine.stroke/2 + engine.rodlength - engine.pivotseparation;

    let diameter = engine.flywheeldiameter * px_per_mm;
    let pivot_centre_px = canvas.height - canvasmargin - diameter/2 - engine.pivotseparation*px_per_mm;

    let piston_height_px = engine.doubleacting ? (engine.pistonlength * px_per_mm) : default_piston_height_px;

    // cylinder dimensions
    let cylinder_height_mm = engine.deadspace + engine.stroke + (engine.doubleacting ? engine.deadspace2 : 0);
    let cylinder_width_mm = engine.bore;
    let cylinder_height_px = cylinder_height_mm * px_per_mm + piston_height_px;
    let cylinder_width_px = cylinder_width_mm * px_per_mm;

    translate(engine_centre_px, pivot_centre_px);
    rotate(engine.cylinderangle * PI/180);

    rect(-cylinder_width_px/2, -pivot_height_mm*px_per_mm, cylinder_width_px, cylinder_height_px); // main cylinder
    circle(0, -engine.portthrow * px_per_mm, engine.cylinderportdiameter * px_per_mm); // cylinder port

    noStroke();
    let atmospheric_colour = color(0,255,255);
    let inlet_colour = color(255,0,0);
    let gas_colour = lerpColor(atmospheric_colour, inlet_colour, (engine.volumes[0].getPressure()-engine.atmosphericpressure)/(engine.inletpressure-engine.atmosphericpressure));
    gas_colour.setAlpha(127);
    fill(gas_colour);
    rect(-cylinder_width_px/2, -pivot_height_mm*px_per_mm, cylinder_width_px, engine.pistonheight * px_per_mm); // cylinder gases

    if (engine.doubleacting) {
        // height of pivot from bottom of cylinder
        let pivot_height_mm2 = cylinder_height_mm + engine.pistonlength - pivot_height_mm;

        let gas_colour = lerpColor(atmospheric_colour, inlet_colour, (engine.volumes[1].getPressure()-engine.atmosphericpressure)/(engine.inletpressure-engine.atmosphericpressure));
        gas_colour.setAlpha(127);
        fill(gas_colour);
        rect(-cylinder_width_px/2, pivot_height_mm2*px_per_mm, cylinder_width_px, -engine.pistonheight2 * px_per_mm); // cylinder gases
    }

    pop();
}

function drawPiston() {
    let diameter = engine.flywheeldiameter * px_per_mm;
    let centre_px = canvas.height - canvasmargin - diameter/2;

    let piston_height_px = engine.doubleacting ? (engine.pistonlength * px_per_mm) : default_piston_height_px;

    push();

    translate(engine_centre_px, centre_px);
    rotate(engine.crankposition * PI/180);

    rect(-5, 0, 10, -engine.stroke/2 * px_per_mm); // crank
    circle(0, 0, 10);

    let rod_diameter_px = engine.doubleacting ? (engine.roddiameter * px_per_mm) : 10;

    translate(0, -engine.stroke/2 * px_per_mm);
    rotate((-engine.crankposition + engine.cylinderangle) * PI/180);
    rect(-rod_diameter_px/2, 0, rod_diameter_px, -engine.rodlength * px_per_mm); // rod
    circle(0, 0, 10);
    translate(0, -engine.rodlength * px_per_mm);
    let bore_mm = engine.bore * px_per_mm;
    rect(-bore_mm/2, 0, bore_mm, piston_height_px); // piston

    pop();
}

function drawPorts() {
    let diameter = engine.flywheeldiameter * px_per_mm;
    let centre_px = canvas.height - canvasmargin - diameter/2 - engine.pivotseparation*px_per_mm;

    push();

    let inletportx = sin(engine.inletportangle * Math.PI/180) * engine.portthrow;
    let inletporty = cos(engine.inletportangle * Math.PI/180) * engine.portthrow;
    let exhaustportx = sin(engine.exhaustportangle * Math.PI/180) * engine.portthrow;
    let exhaustporty = cos(engine.exhaustportangle * Math.PI/180) * engine.portthrow;
    let cylinderportx = sin(engine.cylinderangle * Math.PI/180) * engine.portthrow;
    let cylinderporty = cos(engine.cylinderangle * Math.PI/180) * engine.portthrow;

    translate(engine_centre_px, centre_px);
    circle(inletportx*px_per_mm, -inletporty*px_per_mm, engine.inletportdiameter*px_per_mm);
    circle(exhaustportx*px_per_mm, -exhaustporty*px_per_mm, engine.exhaustportdiameter*px_per_mm);
    circle(cylinderportx*px_per_mm, -cylinderporty*px_per_mm, engine.cylinderportdiameter*px_per_mm);

    if (engine.doubleacting) {
        let inletportx = sin((engine.inletportangle2 + 180) * Math.PI/180) * engine.portthrow2;
        let inletporty = cos((engine.inletportangle2 + 180) * Math.PI/180) * engine.portthrow2;
        let exhaustportx = sin((engine.exhaustportangle2 + 180) * Math.PI/180) * engine.portthrow2;
        let exhaustporty = cos((engine.exhaustportangle2 + 180) * Math.PI/180) * engine.portthrow2;
        let cylinderportx = sin((engine.cylinderangle + 180) * Math.PI/180) * engine.portthrow2;
        let cylinderporty = cos((engine.cylinderangle + 180) * Math.PI/180) * engine.portthrow2;

        circle(inletportx*px_per_mm, -inletporty*px_per_mm, engine.inletportdiameter2*px_per_mm);
        circle(exhaustportx*px_per_mm, -exhaustporty*px_per_mm, engine.exhaustportdiameter2*px_per_mm);
        circle(cylinderportx*px_per_mm, -cylinderporty*px_per_mm, engine.cylinderportdiameter2*px_per_mm);
    }

    pop();
}

function drawPivot() {
    let diameter = engine.flywheeldiameter * px_per_mm;
    let pivot_centre_px = canvas.height - canvasmargin - diameter/2 - engine.pivotseparation*px_per_mm;

    circle(engine_centre_px, pivot_centre_px, 2);
}
