var torqueCurveChart;
var pressureCurveChart;

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

function setLoad(l) {
    engine.load = l;
    document.getElementById('load').value = Math.round(l*10000000)/10000000;
}

function setPressure(p) {
    engine.inletpressure = p;
    document.getElementById('inletpressure').value = Math.round((p-engine.atmosphericpressure)*10000000)/10000000;
}

function setupPlots() {
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
        setPressure(val('maxpressure') + engine.atmosphericpressure);
        engine.reset();
        pvdiagram.clear();
        timingdiagram.clear();
        txt('pressurestatus', 'Accelerating...');

        let datapoints = [];

        engine.onstable = function() {
            datapoints.unshift([engine.inletpressure - engine.atmosphericpressure, engine.meanrpm]);
            plotPressureCurve(datapoints);
            txt('pressurestatus', 'Plotting...');

            setPressure(engine.inletpressure - val('pressurestep'));
        };
        engine.onstalled = function() {
            txt('pressurestatus', 'Finished.');

            setPressure(before);

            engine.reset();
            pvdiagram.clear();
            timingdiagram.clear();
        };
    });
}
