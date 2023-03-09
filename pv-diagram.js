function PVDiagram(npoints) {
    this.npoints = npoints;
    this.points = [];
}

PVDiagram.prototype.add = function(p,v) {
    this.points.push([p,v]);
    while (this.points.length > this.npoints)
        this.points.shift();
};

PVDiagram.prototype.clear = function() {
    this.points = [];
};

PVDiagram.prototype.draw = function(w,h) {
    if (this.points.length == 0) return;

    let minp = this.points[0][0];
    let minv = this.points[0][1];
    let maxp = 0;
    let maxv = 0;
    for (let i = 0; i < this.points.length; i++) {
        if (this.points[i][0] < minp) minp = this.points[i][0];
        if (this.points[i][1] < minv) minv = this.points[i][1];
        if (this.points[i][0] > maxp) maxp = this.points[i][0];
        if (this.points[i][1] > maxv) maxv = this.points[i][1];
    }

    w -= 20;
    h -= 20;

    for (let i = 1; i < this.points.length; i++) {
        let p0 = (this.points[i-1][0]-minp)*(h/(maxp-minp));
        let v0 = (this.points[i-1][1]-minv)*(w/(maxv-minv));
        let p1 = (this.points[i][0]-minp)*(h/(maxp-minp));
        let v1 = (this.points[i][1]-minv)*(w/(maxv-minv));
        stroke(200 - (i/this.points.length)*200);
        line(10+v0,10+h-p0, 10+v1,10+h-p1);
    }
};
