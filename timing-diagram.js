function TimingDiagram(npoints) {
    this.npoints = npoints;
    this.points = [];
    this.lastpos = 0;
    this.clear();
}

TimingDiagram.prototype.angle2index = function(angle) {
    return Math.floor(angle * (this.npoints-1) / 360.0);
};

TimingDiagram.prototype.index2angle = function(index) {
    return index * 360.0 / (this.npoints-1);
};

TimingDiagram.prototype.add = function(angle, inlet, exhaust) {
    angle %= 360.0;
    if (angle < 0) angle += 360.0;

    let i0 = this.angle2index(this.lastpos);
    let i1 = this.angle2index(angle);

    let diff = Math.abs(angle-this.lastpos);
    let di = 1;
    if (angle > this.lastpos && diff > 180 || angle < this.lastpos && diff <= 180) di = -1;

    if (i0 < 0 || i0 >= this.npoints || i1 < 0 || i1 >= this.npoints) {
        console.log([this.lastpos,angle,i0,i1,this.npoints,di]);
        return;
    }

    let i = i0;
    while (true) {
        this.points[i] = [inlet, exhaust];
        if (i == i1) break;
        i += di;
        if (i >= this.npoints) i = 0;
        if (i < 0) i = this.npoints-1;
    };

    this.lastpos = angle;
};

TimingDiagram.prototype.clear = function() {
    this.points = [];
    for (let i = 0; i < this.npoints; i++) {
        this.points.push([0,0]);
    }
};

TimingDiagram.prototype.draw = function(diameter) {
    let maxport = 0;

    for (let i = 0; i < this.points.length; i++) {
        if (this.points[i][0] > maxport) maxport = this.points[i][0];
        if (this.points[i][1] > maxport) maxport = this.points[i][1];
    }

    for (let i = 1; i < this.points.length; i++) {
        let angle = this.index2angle(i);
        push();
        rotate((180+angle) * PI/180);
        stroke(255,127,127,64);
        line(0, diameter/4 + (maxport-this.points[i][0])*(diameter/(4*maxport)), 0, diameter/2);
        stroke(127,255,255,64);
        line(0, diameter/4 + (maxport-this.points[i][1])*(diameter/(4*maxport)), 0, diameter/2);
        pop();
    }
};
