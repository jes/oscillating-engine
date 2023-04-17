// "airvolume" should be an AirVolume
function Port(angle, swingradius, diameter, airvolume) {
    this.angle = angle;
    this.swingradius = swingradius;
    this.diameter = diameter;
    this.airvolume = airvolume;

    this.overlaparea = 0;
    this.flowrate = 0;
    this.x = 0;
    this.y = 0;

    this.update();
};

// update the angle
Port.prototype.setAngle = function(a) {
    this.angle = a;
    this.update();
};

// update this.x, this.y
Port.prototype.update = function() {
    this.x = Math.sin(this.angle * Math.PI/180) * this.swingradius;
    this.y = Math.cos(this.angle * Math.PI/180) * this.swingradius;
};

// return the mass flowed into this port, from the given port, using the given
// air flow method, over the given time;
// update this.overlaparea, this.flowrate
Port.prototype.flow = function(port, method, dt) {
    // compute port overlap areas
    this.overlaparea = areaOfIntersection(this.x, this.y, this.diameter/2, port.x, port.y, port.diameter/2); // mm^2

    let mass = this.airvolume.getClampedFlow(method, port.airvolume, this.overlaparea, dt); // kg
    this.flowrate = mass / dt;
    return mass;
};

// return the mass flowed into this port, grom the given port, using the given
// air flow method, over the given time, with the overlap area reduced if it is blocked by the piston
// "pistonheight" is the cutoff face of the piston, in mm above the pivot point, swung by "port.angle", "above" says the volume is above the piston (true for the primary volume, false for secondary)
// update this.overlaparea, this.flowrate
Port.prototype.reducedFlow = function(port, pistonheight, above, method, dt) {
    // compute port overlap areas
    this.overlaparea = areaOfIntersection(this.x, this.y, this.diameter/2, port.x, port.y, port.diameter/2); // mm^2

    if (above) {
        if (pistonheight > port.swingradius+port.diameter/2) {
            // port is completely covered up
            this.overlaparea = 0;
        } else if (pistonheight > port.swingradius-port.diameter/2) {
            // port is partially covered up
            let start = port.swingradius-port.diameter/2;
            this.overlaparea *= 1 - ((pistonheight-start)/port.diameter);
        }
    } else {
        if (pistonheight < -(port.swingradius+port.diameter/2)) {
            // port is completely covered up
            this.overlaparea = 0;
        } else if (pistonheight < -(port.swingradius-port.diameter/2)) {
            // port is partially covered up
            let start = -(port.swingradius-port.diameter/2);
            this.overlaparea *= 1 - (-(pistonheight-start)/port.diameter);
        }
    }

    let mass = this.airvolume.getClampedFlow(method, port.airvolume, this.overlaparea, dt); // kg
    this.flowrate = mass / dt;
    return mass;
};

// https://math.stackexchange.com/a/290526
function areaOfIntersection(x0, y0, r0, x1, y1, r1) {
  if (r0 > r1) [r0,r1] = [r1,r0]; // without loss of generality, r0 is smaller
  var rr0 = r0*r0;
  var rr1 = r1*r1;
  var c = Math.sqrt((x1-x0)*(x1-x0) + (y1-y0)*(y1-y0));
  if (c >= r0+r1) return 0; // no overlap: return 0 area
  if (c+r0 <= r1) {
      // full overlap: return area of smallest circle
      return Math.PI*rr0;
  }
  var phi = (Math.acos((rr0+(c*c)-rr1) / (2*r0*c)))*2;
  var theta = (Math.acos((rr1+(c*c)-rr0) / (2*r1*c)))*2;
  var area1 = 0.5*theta*rr1 - 0.5*rr1*Math.sin(theta);
  var area2 = 0.5*phi*rr0 - 0.5*rr0*Math.sin(phi);
  return area1 + area2;
}

if (typeof module !== 'undefined')
    module.exports = { Port };
