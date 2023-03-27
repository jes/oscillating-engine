let fields = ['material', 'density', 'h1', 'd1', 'h2', 'd2', 'h3', 'd3'];

for (let f of fields) {
    document.getElementById(f).onchange = update;
    document.getElementById(f).onkeyup = update;
}

update();

function update() {
    if (val('material') != 'custom') {
        document.getElementById('density').value = val('material');
        document.getElementById('density').disabled = true;
    } else {
        document.getElementById('density').disabled = false;
    }

    let density = parseFloat(val('density'));

    // get values in metres
    let h1 = parseFloat(val('h1')) / 1000.0;
    let d1 = parseFloat(val('d1')) / 1000.0;
    let r1 = d1/2;
    let h2 = parseFloat(val('h2')) / 1000.0;
    let d2 = parseFloat(val('d2')) / 1000.0;
    let r2 = d2/2;
    let h3 = parseFloat(val('h3')) / 1000.0;
    let d3 = parseFloat(val('d3')) / 1000.0;
    let r3 = d3/2;

    // compute volumes in cubic metres
    let volume1 = Math.PI * r1*r1 * h1;
    let volume2 = Math.PI * (r2*r2 - r1*r1) * h2;
    let volume3 = Math.PI * (r3*r3 - r2*r2) * h3;

    // compute masses in kg
    let mass1 = volume1 * density;
    let mass2 = volume2 * density;
    let mass3 = volume3 * density;
    lbl('mass1', mass1);
    lbl('mass2', mass2);
    lbl('mass3', mass3);
    lbl('mass', mass1+mass2+mass3);

    // compute moments of inertia in kg.m^2
    let moi1 = 0.5 * mass1 * r1*r1;
    let moi2 = 0.5 * mass2 * (r2*r2 + r1*r1);
    let moi3 = 0.5 * mass3 * (r3*r3 + r2*r2);
    lbl('moi1', moi1);
    lbl('moi2', moi2);
    lbl('moi3', moi3);
    lbl('moi', moi1+moi2+moi3);
}

function val(id) {
    return document.getElementById(id).value;
}

function lbl(id, v) {
    document.getElementById(id).innerText = sigfigs(v, 3);
}
