var canvas;
var engine;
var pvdiagram;
var timingdiagram;

var was_double_acting = false;

var paused = false;

var default_piston_height_px = 10;

var canvasmargin = 20; // px
var px_per_mm;

var engine_centre_px = 150;

var floatfields = ['stroke', 'portthrow', 'deadspace', 'bore', 'rodlength', 'inletportdiameter', 'exhaustportdiameter', 'cylinderportdiameter', 'inletportangle', 'exhaustportangle', 'pivotseparation', 'flywheeldiameter', 'flywheelmomentofinertia', 'atmosphericpressure', 'frictiontorque', 'loadperrpm', 'loadperrpm2', 'load', 'deadspace2', 'pistonlength', 'roddiameter', 'portthrow2', 'inletportdiameter2', 'exhaustportdiameter2', 'cylinderportdiameter2', 'inletportangle2', 'exhaustportangle2', 'reservoirvolume', 'reservoirportdiameter'];
var anychanged = false;

var scopes = [];

var defaults = {
    atmosphericpressure: "101.325",
    inletpressure: "50",
    reservoirvolume: "12000",
    reservoirportdiameter: "0.7",
    frictiontorque: "0.0136",
    loadperrpm: "-0.00003347",
    loadperrpm2: "0.0000000588",
    load: "0",
    airflowmethod: "tlv",
};

var pvcount = 0;
var scopecount = 0;
var scopedt = 0;

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

    jeswigwag: {
        stroke: 30,
        portthrow: 12,
        deadspace: 8,
        bore: 15.2,
        rodlength: 61,
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
        infinitevolume: true,
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
    addScope();

    loadPreset(txtval('preset'));
    update();
    populateTimingDiagramSelect();
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
    check('infinitevolume-div', engine.infinitevolume == checkedval('infinitevolume'));

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

    if (checkedval('infinitevolume')) {
        document.getElementById('reservoir-params').style.display = 'none';
    } else  {
        document.getElementById('reservoir-params').style.display = 'block';
    }

    if (engine.doubleacting) {
        document.getElementById('cc2-span').style.display = 'inline';
    } else {
        document.getElementById('cc2-span').style.display = 'none';
    }
    if (engine.doubleacting != was_double_acting) {
        populateTimingDiagramSelect();
    }
    was_double_acting = engine.doubleacting;

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
        let stepTime = val("timestep") / 1000.0;
        let steps = timeFactor * secs/stepTime;

        let pvcountperiod = 0.0002; // secs
        let pvcountsteps = Math.floor(pvcountperiod / stepTime);
        let scopecountperiod = 0.02; // secs
        let scopecountsteps = Math.floor(pvcountperiod / stepTime);

        let maxRuntime = 33; // ms (~30 fps)
        let start = new Date();
        txt('tooslow', '');
        for (let i = 0; i < steps; i++) {
            engine.step(stepTime);
            if (pvcount++ >= pvcountsteps) {
                pvdiagram.add(engine.volumes[0].getPressure(), engine.volumes[0].getVolume(), engine.volumes[1].getPressure(), engine.volumes[1].getVolume());
                pvcount = 0;
            }
            scopedt += stepTime;
            if (scopecount++ >= scopecountsteps) {
                // update scopes
                for (let scope of scopes) {
                    scope.update(scopedt);
                }
                scopedt = 0;
                scopecount = 0;
            }
            if (txtval('diagramselect') == 'area1')
                timingdiagram.add(engine.crankposition, engine.inletport.overlaparea, engine.exhaustport.overlaparea);
            else if (txtval('diagramselect') == 'flow1')
                timingdiagram.add(engine.crankposition, -engine.inletport.flowrate, engine.exhaustport.flowrate);
            else if (txtval('diagramselect') == 'area2')
                timingdiagram.add(engine.crankposition, engine.inletport2.overlaparea, engine.exhaustport2.overlaparea);
            else if (txtval('diagramselect') == 'flow2')
                timingdiagram.add(engine.crankposition, -engine.inletport2.flowrate, engine.exhaustport2.flowrate);
            if ((new Date()) - start > maxRuntime) {
                txt('tooslow', '(!)');
                break;
            }
        }
    }

    // draw scopes
    for (let scope of scopes) {
        scope.draw();
    }

    background(220);
    stroke(0);

    // draw the engine schematic
    drawFlywheel();

    push();
    let diameter = engine.flywheeldiameter * px_per_mm;
    let centre_px = canvas.height - canvasmargin - diameter/2;
    translate(engine_centre_px, centre_px);
    timingdiagram.draw(diameter-1);
    pop();

    if (!engine.infinitevolume) drawReservoir();
    drawCylinder();
    drawPiston();
    drawPorts();
    drawPivot();

    // draw the pressure-volume diagram
    translate(engine_centre_px*2,0); // offset to clear the engine
    pvdiagram.draw(canvas.width-engine_centre_px*2, canvas.height, paused || (timeFactor*engine.rpm<120), engine.doubleacting); // draw inside the rest of the canvas

    txt('torque', sigfigs(engine.torque, 4));
    txt('meanrpm', sigfigs(engine.meanrpm, 4));
    txt('power', sigfigs(engine.power, 4));
    txt('horsepower', sigfigs(engine.power/746, 3));
    txt('cc', sigfigs(PI * (engine.bore/20)*(engine.bore/20) * (engine.stroke/10), 4));
    txt('cc2', sigfigs(PI * ((engine.bore/20)*(engine.bore/20) - (engine.roddiameter/20)*(engine.roddiameter/20)) * (engine.stroke/10), 4));
    txt('rawefficiency', sigfigs(engine.rawefficiency*100, 3));
    txt('efficiency', sigfigs(engine.efficiency*100, 3));
    let secs_per_rev = 60 / engine.meanrpm;
    txt('airconsumption', sigfigs(engine.airmass / secs_per_rev, 3));
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

    engine.infinitevolume = checkedval('infinitevolume');
    engine.reservoirvolume = val('reservoirvolume');
    engine.reservoirportdiameter = val('reservoirportdiameter');

    engine.makePorts();

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

function populateTimingDiagramSelect() {
    let select = document.getElementById('diagramselect');
    select.innerHTML = '';
    let names = ['Port area', 'Air flow rate'];
    let suffixes = [' primary', ' secondary'];
    let values = ['area', 'flow'];
    for (let v = 0; v < (engine.doubleacting ? 2 : 1); v++) {
        for (let i = 0; i < names.length; i++) {
            let opt = document.createElement('option');
            opt.value = values[i] + (v+1);
            opt.innerHTML = names[i] + (engine.doubleacting ? suffixes[v] : '');
            select.appendChild(opt);
        }
    }
}

function addScope() {
    scopes.push(new Scope(engine, document.getElementById('scopes')));
}

btn('kick', function() { engine.reset(); pvdiagram.clear(); timingdiagram.clear(); });
document.getElementById('preset').onchange = function() {
    loadPreset(txtval('preset'));
};
btn('update', update);
btn('reset', function() {
    loadPreset(txtval('preset'));
    document.getElementById('infinitevolume').checked = false;
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
btn('add-scope', addScope);

document.getElementById('diagramselect').onchange = function() {
    timingdiagram.clear();
};
