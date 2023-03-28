// "volume" should be an AirVolume
function Port(angle, swingradius, diameter, volume) {
    this.angle = angle;
    this.swingradius = swingradius;
    this.diameter = diameter;
    this.volume = volume;

    this.overlaparea = 0;
    this.x = 0;
    this.y = 0;

    this.update();
};

// update this.x, this.y
Port.prototype.update = function() {
    this.x = Math.sin(this.angle * Math.PI/180) * this.swingradius;
    this.y = Math.cos(this.angle * Math.PI/180) * this.swingradius;
};

// return the mass flowed into this port, grom the given port, using the given
// air flow method, over the given time;
// update this.overlaparea
Port.prototype.flow = function(port, method, dt) {
    // compute port overlap areas
    this.overlaparea = areaOfIntersection(this.x, this.y, this.diameter/2, port.x, port.y, port.diameter/2); // mm^2

    // TODO: how do we allow the piston to block the ports?
    //if (this.straightports) {
        // if port is not fully exposed, reduce areas accordingly
        //portarea = this.reducedPortArea(portarea, cylinderportdiameter); // mm^2
    //}

    return this.volume.getClampedFlow(method, port.volume.getPressure(), this.overlaparea, dt); // kg
};

if (window.module !== undefined)
    module.exports = { Engine };
