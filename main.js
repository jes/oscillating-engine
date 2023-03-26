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

var torqueCurveChart;
var pressureCurveChart;

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
        portthrow2: 12,
        deadspace2: 2,
        inletportdiameter2: 4,
        exhaustportdiameter2: 4,
        cylinderportdiameter2: 4,
        inletportangle2: 18.4,
        exhaustportangle2: -18.4,
        url: "https://www.modelengineeringwebsite.com/Muncaster_double_oscillator.html",
    },
};

let double_acting_params = ['deadspace', 'portthrow', 'inletportdiameter', 'exhaustportdiameter', 'cylinderportdiameter', 'inletportangle', 'exhaustportangle'];
for (let engine in presets) {
    if (!presets[engine].doubleacting) {
        presets[engine].doubleacting = false;
        presets[engine].pistonlength = 5;
        presets[engine].roddiameter = 2;
        for (let param of double_acting_params) {
            presets[engine][param + "2"] = presets[engine][param];
        }
        presets[engine].inletportangle2 = -presets[engine].inletportangle2;
        presets[engine].exhaustportangle2 = -presets[engine].exhaustportangle2;
    }
}

function setup() {
    canvas = createCanvas(600, 400);
    canvas.parent('canvas');

    engine = new Engine();

    pvdiagram = new PVDiagram(2500);
    timingdiagram = new TimingDiagram(1000);

    loadPreset(txtval('preset'));
    update();

    let ctx = document.getElementById('chartcanvas');
    let ctx2 = document.getElementById('chartcanvas2');

    const plugin = {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart, args, options) => {
            const {ctx} = chart;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = options.color || '#99ffff';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        }
    };

    torqueCurveChart = new Chart(ctx, {
        type: 'line',
        data: [],
        options: {
            responsive: false,
            elements: {
                point: { radius: 2 },
                line: { borderWidth: 2 },
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#000',
                    },
                },
                title: {
                    display: true,
                    color: '#000',
                },
                customCanvasBackgroundColor: {
                    color: '#eee',
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
                y3: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Efficiency (%)',
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
        plugins: [plugin],
    });

    pressureCurveChart = new Chart(ctx2, {
        type: 'line',
        data: [],
        options: {
            responsive: false,
            elements: {
                point: { radius: 2 },
                line: { borderWidth: 2 },
            },
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    color: '#000',
                },
                customCanvasBackgroundColor: {
                    color: '#eee',
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Inlet pressure (kPa)',
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
                        text: 'RPM',
                        color: '#000',
                    },
                    position: 'left',
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
        plugins: [plugin],
    });
}

function draw() {
    anychanged = false;
    let eps = 0.00000001;
    for (let i = 0; i < floatfields.length; i++) {
        check(floatfields[i], Math.abs(engine[floatfields[i]] - val(floatfields[i])) < eps);
    }
    check('inletpressure', engine.inletpressure == val('inletpressure')+engine.atmosphericpressure);
    check('airflowmethod', engine.airflowmethod == txtval('airflowmethod'));
    check('straightports-div', engine.straightports == checkedval('straightports'));
    check('doubleacting-div', engine.doubleacting == checkedval('doubleacting'));

    if (checkedval('doubleacting')) {
        document.getElementById('doubleacting-params').style.display = 'block';
    } else {
        document.getElementById('doubleacting-params').style.display = 'none';
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
            if (pvcount++ == 4) {
                pvdiagram.add(engine.cylinderpressure, engine.cylindervolume);
                // TODO: if (engine.doubleacting) draw 2nd pv diagram
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
    pvdiagram.draw(canvas.width-engine_centre_px*2, canvas.height, paused || (timeFactor*engine.rpm<120)); // draw inside the reset of the canvas

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

    let totalheight_mm = engine.flywheeldiameter/2 + engine.stroke/2 + engine.rodlength + engine.deadspace; // mm
    let availableheight_px = canvas.height - 2*canvasmargin;
    px_per_mm = availableheight_px / totalheight_mm;
}

function loadPreset(p) {
    for (field in presets[p]) {
        let el = document.getElementById(field);
        if (el) {
            if (field == 'doubleacting' || field == 'straightports')
                el.checked = presets[p][field];
            else
                el.value = presets[p][field];
        }
    }
}

function setLoad(l) {
    engine.load = l;
    document.getElementById('load').value = Math.round(l*10000000)/10000000;
}

function toCSV(pts) {
    return "rpm,torque_Nm,power_W\n" + pts.map((el) => el.join(",")).join("\n");
}

function plotTorqueCurve(pts) {
    document.getElementById('chartcanvas').style.display = 'block';
    torqueCurveChart.options.plugins.title.text = txtval('charttitle');
    torqueCurveChart.config.data = {
        datasets: [
            {
                label: 'Torque',
                data: pts.map(function(el) { return {"x":el[0], "y":el[1]} }),
                yAxisID: 'y',
                borderColor: '#4a4',
                backgroundColor: '#4a4',
            }, {
                label: 'Power',
                data: pts.map(function(el) { return {"x":el[0], "y":el[2]} }),
                yAxisID: 'y2',
                borderColor: '#c71',
                backgroundColor: '#c71',
            }, {
                label: 'Efficiency',
                data: pts.map(function(el) { return {"x":el[0], "y":el[3]*100} }),
                yAxisID: 'y3',
                borderColor: '#17c',
                backgroundColor: '#17c',
            }
        ],
    };
    torqueCurveChart.update();
}

function plotPressureCurve(pts) {
    document.getElementById('chartcanvas2').style.display = 'block';
    pressureCurveChart.options.plugins.title.text = txtval('charttitle2');
    pressureCurveChart.config.data = {
        datasets: [
            {
                label: '',
                data: pts.map(function(el) { return {"x":el[0], "y":el[1]} }),
                borderColor: '#4a4',
                backgroundColor: '#4a4',
            }
        ],
    };
    pressureCurveChart.update();
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
btn('plottorquecurve', function() {
    let before = engine.load;
    setLoad(0);
    engine.reset();
    pvdiagram.clear();
    timingdiagram.clear();
    txt('torquestatus', 'Accelerating...');

    let datapoints = [];

    engine.onstable = function() {
        datapoints.unshift([engine.meanrpm, engine.torque, engine.power, engine.efficiency]);
        plotTorqueCurve(datapoints);
        txt('torquestatus', 'Plotting...');

        setLoad(engine.load + val('loadstep'));
    };
    engine.onstalled = function() {
        txt('torquestatus', 'Finished.');

        setLoad(before);

        engine.reset();
        pvdiagram.clear();
        timingdiagram.clear();
    };
});
btn('plotpressurecurve', function() {
    let before = engine.inletpressure;
    engine.inletpressure = val('maxpressure') + engine.atmosphericpressure;
    engine.reset();
    pvdiagram.clear();
    timingdiagram.clear();
    txt('pressurestatus', 'Accelerating...');

    let datapoints = [];

    engine.onstable = function() {
        datapoints.unshift([engine.inletpressure - engine.atmosphericpressure, engine.meanrpm]);
        plotPressureCurve(datapoints);
        txt('pressurestatus', 'Plotting...');

        engine.inletpressure = engine.inletpressure - val('pressurestep');
    };
    engine.onstalled = function() {
        txt('pressurestatus', 'Finished.');

        engine.inletpressure = before;

        engine.reset();
        pvdiagram.clear();
        timingdiagram.clear();
    };
});
