var canvas;
var engine;
var pvdiagram;
var timingdiagram;

var paused = false;

var default_piston_height_px = 10;

var canvasmargin = 20; // px
var px_per_mm;

var engine_centre_px = 150;

var floatfields = ['stroke', 'portthrow', 'deadspace', 'bore', 'rodlength', 'inletportdiameter', 'exhaustportdiameter', 'cylinderportdiameter', 'inletportangle', 'exhaustportangle', 'pivotseparation', 'flywheeldiameter', 'flywheelmomentofinertia', 'atmosphericpressure', 'frictiontorque', 'loadperrpm', 'load', 'deadspace2', 'pistonlength', 'roddiameter', 'portthrow2', 'inletportdiameter2', 'exhaustportdiameter2', 'cylinderportdiameter2', 'inletportangle2', 'exhaustportangle2'];
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
        straightports: true,
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
        straightports: true,
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
        straightports: true,
        url: "https://modelengineeringwebsite.com/Wobler_oscillator.html",
    },

    muncasterdouble: {
        stroke: 40,
        portthrow: 12,
        deadspace: 2,
        bore: 24,
        rodlength: 90,
        inletportdiameter: 4,
        exhaustportdiameter: 4,
        cylinderportdiameter: 4,
        inletportangle: -18.4,
        exhaustportangle: 18.4,
        pivotseparation: 86,
        flywheeldiameter: 100,
        flywheelmomentofinertia: "0.000765",
        straightports: false,
        doubleacting: true,
        pistonlength: 8,
        roddiameter: 5,
        symmetrical: true,
        url: "https://www.modelengineeringwebsite.com/Muncaster_double_oscillator.html",
    },
};

for (let engine in presets) {
    if (!presets[engine].doubleacting) {
        presets[engine].doubleacting = false;
        presets[engine].deadspace2 = presets[engine].deadspace;
        presets[engine].pistonlength = 5;
        presets[engine].roddiameter = 2;
        presets[engine].symmetrical = true;
    }
}

function setup() {
    canvas = createCanvas(600, 400);
    canvas.parent('canvas');

    engine = new Engine();

    pvdiagram = new PVDiagram(2500);
    timingdiagram = new TimingDiagram(1000);

    setupPlots();

    loadPreset(txtval('preset'));
    update();
}

function draw() {
    anychanged = false;
    let eps = 0.00000001;
    for (let i = 0; i < floatfields.length; i++) {
        check(floatfields[i], Math.abs(engine[floatfields[i]] - val(floatfields[i])) < eps);
    }
    check('inletpressure', Math.abs(engine.inletpressure - (val('inletpressure')+engine.atmosphericpressure)) < eps);
    check('airflowmethod', engine.airflowmethod == txtval('airflowmethod'));
    check('straightports-div', engine.straightports == checkedval('straightports'));
    check('doubleacting-div', engine.doubleacting == checkedval('doubleacting'));

    if (checkedval('doubleacting')) {
        document.getElementById('doubleacting-params').style.display = 'block';
    } else {
        document.getElementById('doubleacting-params').style.display = 'none';
    }

    if (checkedval('symmetrical')) {
        document.getElementById('2ndport-params').style.display = 'none';
    } else {
        document.getElementById('2ndport-params').style.display = 'block';
    }

    if (engine.doubleacting) {
        document.getElementById('pressure2-span').style.display = 'inline';
        document.getElementById('cc2-span').style.display = 'inline';
    } else {
        document.getElementById('pressure2-span').style.display = 'none';
        document.getElementById('cc2-span').style.display = 'none';
    }

    document.getElementById('pendingchanges').style.visibility = anychanged ? 'visible' : 'hidden';

    let timescales = [
        0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10
    ];
    let timeFactor = timescales[parseInt(val('timefactor'))];
    txt('timefactorlabel', timeFactor);

    pvdiagram.inletpressure = engine.inletpressure;
    pvdiagram.atmosphericpressure = engine.atmosphericpressure;

    if (!paused) {
        let secs = deltaTime / 1000.0;
        let stepTime = 0.00001;
        let steps = timeFactor * secs/stepTime;

        let maxRuntime = 33; // ms (~30 fps)
        let start = new Date();
        txt('tooslow', '');
        for (let i = 0; i < steps; i++) {
            engine.step(stepTime);
            if (pvcount++ == 20) {
                pvdiagram.add(engine.cylinderpressure, engine.cylindervolume, engine.cylinderpressure2, engine.cylindervolume2);
                pvcount = 0;
            }
            timingdiagram.add(engine.crankposition, engine.inletportarea, engine.exhaustportarea);
            // TODO: how to draw secondary timing diagram?
            if ((new Date()) - start > maxRuntime) {
                txt('tooslow', '(!)');
                break;
            }
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
    pvdiagram.draw(canvas.width-engine_centre_px*2, canvas.height, paused || (timeFactor*engine.rpm<120), engine.doubleacting); // draw inside the rest of the canvas

    txt('rpm', round(engine.rpm, 2));
    txt('pressure', round(engine.cylinderpressure-engine.atmosphericpressure, 2));
    txt('pressure2', round(engine.cylinderpressure2-engine.atmosphericpressure, 2));
    txt('torque', round(engine.torque, 5));
    txt('meanrpm', round(engine.meanrpm, 2));
    txt('power', round(engine.power, 3));
    txt('horsepower', round(engine.power/746, 5));
    txt('cc', round(PI * (engine.bore/20)*(engine.bore/20) * (engine.stroke/10), 2));
    txt('cc2', round(PI * ((engine.bore/20)*(engine.bore/20) - (engine.roddiameter/20)*(engine.roddiameter/20)) * (engine.stroke/10), 2));
    txt('rawefficiency', round(engine.rawefficiency*100, 2));
    txt('efficiency', round(engine.efficiency*100, 2));
    let secs_per_rev = 60 / engine.meanrpm;
    txt('airconsumption', round(engine.airmass / secs_per_rev, 5));
}

function btn(id, cb) {
    document.getElementById(id).onclick = cb;
}

function checkedval(id) {
    return document.getElementById(id).checked;
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
    engine.straightports = checkedval('straightports');
    engine.doubleacting = checkedval('doubleacting');
    engine.inletpressure = val('inletpressure')+engine.atmosphericpressure;
    engine.airflowmethod = txtval('airflowmethod');

    if (checkedval('symmetrical')) {
        let port_params = ['portthrow', 'inletportdiameter', 'exhaustportdiameter', 'cylinderportdiameter', 'inletportangle', 'exhaustportangle'];
        for (let field of port_params) {
            engine[field + "2"] = engine[field];
        }
        engine.inletportangle2 = -engine.inletportangle2;
        engine.exhaustportangle2 = -engine.exhaustportangle2;
        for (let field of port_params) {
            document.getElementById(field+"2").value = engine[field+"2"];
        }
    }

    let totalheight_mm = engine.flywheeldiameter/2 + engine.stroke/2 + engine.rodlength + engine.deadspace; // mm
    let availableheight_px = canvas.height - 2*canvasmargin;
    px_per_mm = availableheight_px / totalheight_mm;
}

function loadPreset(p) {
    for (field in presets[p]) {
        let el = document.getElementById(field);
        if (el) {
            if (field == 'doubleacting' || field == 'straightports' || field == 'symmetrical')
                el.checked = presets[p][field];
            else
                el.value = presets[p][field];
        }
    }
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
    document.getElementById('chartcanvas2').style.display = 'none';
    txt('torquestatus', '');
});
btn('pauseresume', function() {
    paused = !paused;
    if (paused) txt('pauseresume', 'Resume');
    else txt('pauseresume', 'Pause');
});
