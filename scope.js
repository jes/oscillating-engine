function Scope(engine, parentElement) {
    this.points = [];
    this.maxpoints = 2000;
    this.engine = engine;
    this.parentElement = parentElement;

    this.field = "cylinderpressure";

    let scope = this;

    let fieldnames = ['Reservoir pressure (kPa above atmospheric)', 'Supply port flow rate (kg/sec)', 'Cylinder pressure (kPa above atmospheric)', 'Cylinder volume (mm^3)', 'Inlet port flow rate (kg/sec)', 'Inlet port overlap area (mm^2)', 'Exhaust port flow rate (kg/sec)', 'Exhaust port overlap area (mm^2)', 'Instantaneous rpm'];
    let fieldvalues = ['reservoirpressure', 'reservoirflow', 'cylpressure', 'cylvolume', 'inletportflow', 'inletportarea', 'exhaustportflow', 'exhaustportarea', 'rpm'];

    this.div = document.createElement('div');
    this.div.style.border = "solid 1px black";
    this.fieldselect = document.createElement('select');
    for (let i in fieldnames) {
        let opt = document.createElement('option');
        opt.text = fieldnames[i];
        opt.value = fieldvalues[i];
        this.fieldselect.appendChild(opt);
    }
    this.fieldselect.onchange = function() { scope.points = [] };
    this.div.appendChild(this.fieldselect);
    let delbutton = document.createElement('button');
    delbutton.innerText = '- Remove scope';
    delbutton.onclick = function() { scope.remove() };
    this.div.appendChild(delbutton);
    let capturebutton = document.createElement('button');
    capturebutton.innerText = 'Capture...';
    capturebutton.onclick = function() { scope.capture() };
    this.div.appendChild(capturebutton);
    this.div.appendChild(document.createElement('br'));
    this.canvas = document.createElement('canvas');
    // TODO: variable size?
    this.canvas.width = 600;
    this.canvas.height = 300;
    this.div.appendChild(this.canvas);
    this.parentElement.appendChild(this.div);
};

Scope.prototype.capture = function() {
    let tsv = '';
    let t = 0;
    for (let i in this.points) {
        tsv += t + "\t" + this.points[i][1] + "\n";
        t += this.points[i][0];
    }

    let el = document.createElement('a');
    let blob = new Blob([tsv], { type: 'text/tsv' });
    el.href = URL.createObjectURL(blob);
    el.download = 'capture.tsv';
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
};

Scope.prototype.remove = function() {
    this.parentElement.removeChild(this.div);
};

Scope.prototype.draw = function() {
    let minval = this.points.length ? this.points[0][1] : 0;
    let maxval = this.points.length ? this.points[0][1] : 0;
    for (let v of this.points) {
        if (v[1] < minval) minval = v[1];
        if (v[1] > maxval) maxval = v[1];
    }

    // draw line in middle if range is 0
    if (minval == maxval) {
        minval -= 1;
        maxval += 1;
    }

    let ctx = this.canvas.getContext('2d');

    // background
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // horizontal grid lines
    ctx.strokeStyle = '#363';
    for (let y = 10; y <= this.canvas.height; y += (this.canvas.height-20)/10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.canvas.width, y);
        ctx.stroke();
    }

    // main curve
    if (this.points.length) {
        ctx.strokeStyle = '#3f3';
        ctx.beginPath();
        let iPlus = this.maxpoints - this.points.length;
        for (let i in this.points) {
            ctx.lineTo((iPlus+parseInt(i))*this.canvas.width/this.maxpoints, 10+(this.canvas.height-20)*(1-(this.points[i][1]-minval)/(maxval-minval)));
        }
        ctx.stroke();
    }

    // min/max text labels
    ctx.fillStyle = '#3f3';
    ctx.fillText(sigfigs(minval,5), 0, this.canvas.height);
    ctx.fillText(sigfigs(maxval,5), 0, 10);
};

Scope.prototype.getValue = function() {
    switch (this.fieldselect.value) {
        case 'reservoirpressure': return this.engine.reservoir.getPressure() - this.engine.atmosphericpressure;
        case 'reservoirflow': return this.engine.infinitevolume ? -this.engine.inletport.flowrate : this.engine.reservoirport.flowrate;
        case 'cylpressure': return this.engine.volumes[0].getPressure() - this.engine.atmosphericpressure;
        case 'cylvolume': return this.engine.volumes[0].getVolume();
        case 'inletportflow': return -this.engine.inletport.flowrate;
        case 'inletportarea': return this.engine.inletport.overlaparea;
        case 'exhaustportflow': return this.engine.exhaustport.flowrate;
        case 'exhaustportarea': return this.engine.exhaustport.overlaparea;
        case 'rpm': return this.engine.rpm;
    }
    console.log("unrecognised field name: " + this.fieldselect.value);
    return 0;
};

// dt says how long this value came after the previous one
Scope.prototype.update = function(dt) {
    let v = this.getValue();
    this.points.push([dt, v]);
    while (this.points.length > this.maxpoints)
        this.points.shift();
};
