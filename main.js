var canvas;
var engine;
var pvdiagram;
var timingdiagram;

var paused = false;

var piston_height_px = 10;

var canvasmargin = 20; // px
var px_per_mm;

var engine_centre_px = 150;

var floatfields = ['stroke', 'portthrow', 'deadspace', 'bore', 'rodlength', 'inletportdiameter', 'exhaustportdiameter', 'cylinderportdiameter', 'inletportangle', 'exhaustportangle', 'pivotseparation', 'flywheeldiameter', 'flywheelmomentofinertia', 'atmosphericpressure', 'frictiontorque', 'loadperrpm', 'load'];
var anychanged = false;

var defaults = {
    atmosphericpressure: "101.325",
    inletpressure: "50",
    frictiontorque: "0.001",
    loadperrpm: "0.000025",
    load: "0",
    airflowmethod: "tlv",
};

var pvcount = 0;

var torqueCurveChart;

var presets = {
    wigwag: {
        stroke: 30,
        portthrow: 12,
        deadspace: 4.75,
        bore: 15,
        rodlength: 63,
        inletportdiameter: 2.5,
        exhaustportdiameter: 2.5,
        cylinderportdiameter: 2.0,
        inletportangle: -14.5,
        exhaustportangle: 14.5,
        pivotseparation: 67.5,
        flywheeldiameter: 68,
        flywheelmomentofinertia: "0.000203",
        url: "https://wigwagengine.wixsite.com/wigwag",
    },

    stevesworkshop: {
        stroke: 16,
        portthrow: 10,
        deadspace: 1,
        bore: 12,
        rodlength: 40,
        inletportdiameter: 2,
        exhaustportdiameter: 2,
        cylinderportdiameter: 2,
        inletportangle: -14.5,
        exhaustportangle: 14.5,
        pivotseparation: 35,
        flywheeldiameter: 50,
        flywheelmomentofinertia: "0.0000723",
        url: "http://www.steves-workshop.co.uk/steammodels/simpleoscil/simpleoscil.htm",
    },

    wobler: {
        stroke: 20,
        portthrow: 10,
        deadspace: 3,
        bore: 10,
        rodlength: 45,
        inletportdiameter: 2.2,
        exhaustportdiameter: 2.2,
        cylinderportdiameter: 1.7,
        inletportangle: -12.7,
        exhaustportangle: 12.7,
        pivotseparation: 45,
        flywheeldiameter: 36,
        flywheelmomentofinertia: "0.0000139",
        url: "https://modelengineeringwebsite.com/Wobler_oscillator.html",
    },
};

function setup() {
    canvas = createCanvas(600, 400);
    canvas.parent('canvas');

    engine = new Engine();

    pvdiagram = new PVDiagram(2500);
    timingdiagram = new TimingDiagram(1000);

    loadPreset(txtval('preset'));
    update();

    let ctx = document.getElementById('chartcanvas');

    torqueCurveChart = new Chart(ctx, {
        type: 'line',
        data: [],
        options: {
            events: [],
            plugins: {
                legend: {
                    labels: {
                        color: '#000',
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'RPM',
                        color: '#000',
                    },
                    ticks: {
                        color: '#000',
                    },
                    position: 'bottom',
                    beginAtZero: true,
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Torque (Nm)',
                        color: '#000',
                    },
                    position: 'left',
                    beginAtZero: true,
                    ticks: {
                        color: '#000',
                    },
                },
                y2: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Power (W)',
                        color: '#000',
                    },
                    position: 'right',
                    beginAtZero: true,
                    ticks: {
                        color: '#000',
                    },
                },
            },
            animation: {
                duration: 0,
            },
        },
    });

}

function draw() {
    anychanged = false;
    for (let i = 0; i < floatfields.length; i++) {
        check(floatfields[i], engine[floatfields[i]] == val(floatfields[i]));
    }
    check('inletpressure', engine.inletpressure == val('inletpressure')+engine.atmosphericpressure);
    check('airflowmethod', engine.airflowmethod == txtval('airflowmethod'));

    document.getElementById('pendingchanges').style.visibility = anychanged ? 'visible' : 'hidden';

    let timeFactor = val('timefactor')/100;
    txt('timefactorlabel', timeFactor);

    if (!paused) {
        let secs = deltaTime / 1000.0;
        let stepTime = 0.00005;
        let steps = timeFactor * secs/stepTime;
        if (steps > 10000) steps = 10000;
        for (let i = 0; i < steps; i++) {
            engine.step(stepTime);
            if (pvcount++ == 4) {
                pvdiagram.add(engine.cylinderpressure, engine.cylindervolume);
                pvcount = 0;
            }
            timingdiagram.add(engine.crankposition, engine.inletportarea, engine.exhaustportarea);
        }
    }

    background(220);

    // draw the engine schematic
    drawFlywheel();

    push();
    let diameter = engine.flywheeldiameter * px_per_mm;
    let centre_px = canvas.height - canvasmargin - diameter/2;
    translate(engine_centre_px, centre_px);
    timingdiagram.draw(diameter-1);
    pop();

    drawCylinder();
    drawPiston();
    drawPorts();
    drawPivot();

    // draw the pressure-volume diagram
    translate(engine_centre_px*2,0); // offset to clear the engine
    pvdiagram.draw(canvas.width-engine_centre_px*2, canvas.height, paused || (timeFactor*engine.rpm<120)); // draw inside the reset of the canvas

    txt('rpm', round(engine.rpm, 2));
    txt('pressure', round(engine.cylinderpressure-engine.atmosphericpressure, 2));
    txt('torque', round(engine.torque, 5));
    txt('meanrpm', round(engine.meanrpm, 2));
    txt('power', round(engine.power, 3));
    txt('horsepower', round(engine.power/746, 5));
    txt('cc', round(PI * (engine.bore/20)*(engine.bore/20) * (engine.stroke/10), 2));
    txt('rawefficiency', round(engine.rawefficiency*100, 2));
    txt('efficiency', round(engine.efficiency*100, 2));
}

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

    // cylinder dimensions
    let cylinder_height_mm = engine.deadspace + engine.stroke;
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
    let diameter = engine.flywheeldiameter * px_per_mm;
    let centre_px = canvas.height - canvasmargin - diameter/2;

    push();

    translate(engine_centre_px, centre_px);
    rotate(engine.crankposition * PI/180);

    rect(-5, 0, 10, -engine.stroke/2 * px_per_mm); // crank
    circle(0, 0, 10);

    translate(0, -engine.stroke/2 * px_per_mm);
    rotate((-engine.crankposition + engine.cylinderangle) * PI/180);
    rect(-5, 0, 10, -engine.rodlength * px_per_mm); // rod
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

    translate(engine_centre_px, centre_px);
    circle(engine.inletportx*px_per_mm, -engine.inletporty*px_per_mm, engine.inletportdiameter*px_per_mm);
    circle(engine.exhaustportx*px_per_mm, -engine.exhaustporty*px_per_mm, engine.exhaustportdiameter*px_per_mm);
    circle(engine.cylinderportx*px_per_mm, -engine.cylinderporty*px_per_mm, engine.cylinderportdiameter*px_per_mm);

    pop();
}

function drawPivot() {
    let diameter = engine.flywheeldiameter * px_per_mm;
    let pivot_centre_px = canvas.height - canvasmargin - diameter/2 - engine.pivotseparation*px_per_mm;

    circle(engine_centre_px, pivot_centre_px, 2);
}

function btn(id, cb) {
    document.getElementById(id).onclick = cb;
}

function txtval(id) {
    return document.getElementById(id).value;
}

function val(id) {
    return parseFloat(document.getElementById(id).value);
}

function txt(id, val) {
    document.getElementById(id).innerText = val;
}

function round(num, places) {
    return Math.round(num * Math.pow(10,places))/Math.pow(10,places);
}

function check(id, ok) {
    if (!ok) {
        anychanged = true;
        document.getElementById(id).classList.add('changed');
    } else {
        document.getElementById(id).classList.remove('changed');
    }
}

function update() {
    for (let i = 0; i < floatfields.length; i++) {
        engine[floatfields[i]] = val(floatfields[i]);
    }
    engine.inletpressure = val('inletpressure')+engine.atmosphericpressure;
    engine.airflowmethod = txtval('airflowmethod');

    pvdiagram.inletpressure = engine.inletpressure;
    pvdiagram.atmosphericpressure = engine.atmosphericpressure;

    let totalheight_mm = engine.flywheeldiameter/2 + engine.stroke/2 + engine.rodlength + engine.deadspace; // mm
    let availableheight_px = canvas.height - 2*canvasmargin;
    px_per_mm = availableheight_px / totalheight_mm;
}

function loadPreset(p) {
    for (field in presets[p]) {
        let el = document.getElementById(field);
        if (el) el.value = presets[p][field];
    }
}

function setLoad(l) {
    engine.load = parseFloat(l);
    document.getElementById('load').value = l;
}

function toCSV(pts) {
    return "rpm,torque_Nm,power_W\n" + pts.map((el) => el.join(",")).join("\n");
}

function plotTorqueCurve(pts) {
    torqueCurveChart.config.data = {
        datasets: [
            {
                label: 'Torque',
                data: pts.map(function(el) { return {"x":parseFloat(el[0]), "y":parseFloat(el[1])} }),
                yAxisID: 'y',
                borderColor: '#4a4',
                backgroundColor: '#4a4',
            }, {
                label: 'Power',
                data: pts.map(function(el) { return {"x":parseFloat(el[0]), "y":parseFloat(el[2])} }),
                yAxisID: 'y2',
                borderColor: '#c71',
                backgroundColor: '#c71',
            },
        ],
    };
    torqueCurveChart.update();
}

btn('kick', function() { engine.reset(); pvdiagram.clear(); timingdiagram.clear(); });
document.getElementById('preset').onchange = function() {
    loadPreset(txtval('preset'));
};
btn('update', update);
btn('reset', function() {
    loadPreset(txtval('preset'));
    for (field in defaults) {
        document.getElementById(field).value = defaults[field];
    }
    update();
    engine.onstable = null;
    engine.onstalled = null;
    document.getElementById('chartcanvas').style.display = 'none';
    txt('torquestatus', '');
});
btn('pauseresume', function() {
    paused = !paused;
    if (paused) txt('pauseresume', 'Resume');
    else txt('pauseresume', 'Pause');
});
btn('plottorquecurve', function() {
    let before = txtval('load');
    setLoad(0);
    engine.reset();
    pvdiagram.clear();
    timingdiagram.clear();
    txt('torquestatus', 'Accelerating...');

    document.getElementById('chartcanvas').style.display = 'block';

    let loadStep = 0.0005; // Nm
    let datapoints = [];

    engine.onstable = function() {
        datapoints.unshift([engine.rpm.toFixed(1), engine.torque.toFixed(4), engine.power.toFixed(4)]);
        plotTorqueCurve(datapoints);
        txt('torquestatus', 'Plotting...');

        setLoad((engine.load + loadStep).toFixed(4));
    };
    engine.onstalled = function() {
        datapoints.unshift([0, engine.load, 0]);
        plotTorqueCurve(datapoints);
        txt('torquestatus', 'Finished.');

        setLoad(before);

        engine.reset();
        pvdiagram.clear();
        timingdiagram.clear();
    };
});
