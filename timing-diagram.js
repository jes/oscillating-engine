function TimingDiagram(npoints) {
    this.npoints = npoints;
    this.points = [];
    this.lastpos = 0;
    this.clear();
}

TimingDiagram.prototype.angle2index = function(angle) {
    return Math.floor(angle * this.npoints / 360.0);
};

TimingDiagram.prototype.index2angle = function(index) {
    return index * 360.0 / this.npoints;
};

TimingDiagram.prototype.add = function(angle, inlet, exhaust) {
    // XXX: do nothing if we crossed 0 (TODO: fill in the points either side of 0?)
    if (Math.abs(angle-this.lastpos) > 180) {
        this.lastpos = angle;
        return;
    }

    let i0 = this.angle2index(this.lastpos);
    let i1 = this.angle2index(angle);

    if (i0 > i1) [i0,i1] = [i1,i0];

    for (let i = i0; i <= i1; i++)
        this.points[i] = [inlet, exhaust];
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
