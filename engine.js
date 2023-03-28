function Engine() {
    // parameters:
    this.stroke = 30; // mm
    this.portthrow = 12; // mm
    this.deadspace = 4.75; // mm, between top of piston and top of cylinder
    this.bore = 15; // mm
    this.rodlength = 63; // mm
    this.inletportdiameter = 2.5; // mm
    this.exhaustportdiameter = 2.5; // mm
    this.cylinderportdiameter = 2.0; // mm
    this.inletportangle = -14.5; // degrees
    this.exhaustportangle = 14.5; // degrees
    this.pivotseparation = 67.5; // mm
    this.flywheeldiameter = 68; // mm (no effect on simulation)
    this.flywheelmomentofinertia = 0.000203; // kg m^2
    this.atmosphericpressure = 101.325; // kPa
    this.inletpressure = this.atmosphericpressure + 50; // kPa
    this.frictiontorque = 0.001; // Nm, opposing the flywheel rotation
    this.loadperrpm = 0.000025; // Nm/rpm, opposing flywheel rotation
    this.load = 0; // Nm
    this.airdensity = 1.204; // kg/m^3 at atmospheric pressure
    this.speedofsound = 343; // m/s
    this.airflowmethod = 'tlv'; // tlv/trident1/trident2/bernoulli/linear/billhall
    this.straightports = true; // can the piston block off the ports?

    // double-acting parameters:
    this.doubleacting = false;
    this.deadspace2 = 0;
    this.pistonlength = 5;
    this.roddiameter = 0;

    // state:
    this.volumes = [ new AirVolume(0, 0), new AirVolume(0, 0) ]; // cylinder air volumes (primary and secondary)
    this.crankposition = 0; // degrees - TDC=0
    this.rpm = 0; // rpm

    // computed state:
    this.cylinderangle = 0; // degrees
    this.pistonheight = 0; // mm from top of cylinder
    this.crankpinx = 0; // mm from crank centre
    this.crankpiny = 0; // mm from crank centre

    this.reset();
}

Engine.prototype.reset = function() {
    this.volumes[0].setPressure(this.inletpressure);
    this.volumes[1].setPressure(this.inletpressure);
    this.crankposition = 0;
    this.rpm = 200;
    this.computeCylinderPosition();

    this.sumrawtorque = 0;
    this.sumtorque = 0;
    this.sumrpm = 0;
    this.torquepoints = 0;
    this.rawtorque = 0;
    this.torque = 0;
    this.meanrpm = 0;
    this.power = 0;
    this.sumairmass = 0;
    this.airmass = 0;
    this.rawefficiency = 0;
    this.efficiency = 0;

    this.stable = false;
    this.onstable = null;
    this.stalled = false;
    this.onstalled = null;
};

Engine.prototype.step = function(dt) {
    let pistonArea = Math.PI * (this.bore/2)*(this.bore/2); // mm^2

    // compute the effective port locations
    this.inletportx = Math.sin(this.inletportangle * Math.PI/180) * this.portthrow;
    this.inletporty = Math.cos(this.inletportangle * Math.PI/180) * this.portthrow;
    this.exhaustportx = Math.sin(this.exhaustportangle * Math.PI/180) * this.portthrow;
    this.exhaustporty = Math.cos(this.exhaustportangle * Math.PI/180) * this.portthrow;
    this.cylinderportx = Math.sin(this.cylinderangle * Math.PI/180) * this.portthrow;
    this.cylinderporty = Math.cos(this.cylinderangle * Math.PI/180) * this.portthrow;

    // compute port overlap areas
    this.inletportarea = areaOfIntersection(this.inletportx, this.inletporty, this.inletportdiameter/2, this.cylinderportx, this.cylinderporty, this.cylinderportdiameter/2); // mm^2
    this.exhaustportarea= areaOfIntersection(this.exhaustportx, this.exhaustporty, this.exhaustportdiameter/2, this.cylinderportx, this.cylinderporty, this.cylinderportdiameter/2); // mm^2

    if (this.straightports) {
        // if port is not fully exposed, reduce areas accordingly
        this.inletportarea = this.reducedPortArea(this.inletportarea, this.cylinderportdiameter); // mm^2
        this.exhaustportarea = this.reducedPortArea(this.exhaustportarea, this.cylinderportdiameter); // mm^2
    }

    // let air through ports
    let inletAirMass = this.volumes[0].getClampedFlow(this.airflowmethod, this.inletpressure, this.inletportarea, dt); // kg
    let exhaustAirMass = -this.volumes[0].getClampedFlow(this.airflowmethod, this.atmosphericpressure, this.exhaustportarea, dt); // kg

    this.volumes[0].setMass(this.volumes[0].getMass() + inletAirMass - exhaustAirMass);
    this.sumairmass += inletAirMass;

    // TODO: what happens when the primary volume is exposed to the secondary ports, or vice versa? do we need to implement that? maybe we want (for each cylinder port, for each port, for each volume, compute air flow and limit to the "reducedPortArea")

    // TODO: refactor, so that we're generic about the number of volumes
    if (this.doubleacting) {
        this.inletportx2 = Math.sin((180 + this.inletportangle2) * Math.PI/180) * this.portthrow2;
        this.inletporty2 = Math.cos((180 + this.inletportangle2) * Math.PI/180) * this.portthrow2;
        this.exhaustportx2 = Math.sin((180 + this.exhaustportangle2) * Math.PI/180) * this.portthrow2;
        this.exhaustporty2 = Math.cos((180 + this.exhaustportangle2) * Math.PI/180) * this.portthrow2;
        this.cylinderportx2 = Math.sin((180 + this.cylinderangle) * Math.PI/180) * this.portthrow2;
        this.cylinderporty2 = Math.cos((180 + this.cylinderangle) * Math.PI/180) * this.portthrow2;

        // compute port overlap areas
        this.inletportarea2 = areaOfIntersection(this.inletportx2, this.inletporty2, this.inletportdiameter2/2, this.cylinderportx2, this.cylinderporty2, this.cylinderportdiameter2/2); // mm^2
        this.exhaustportarea2 = areaOfIntersection(this.exhaustportx2, this.exhaustporty2, this.exhaustportdiameter2/2, this.cylinderportx2, this.cylinderporty2, this.cylinderportdiameter2/2); // mm^2

        if (this.straightports) {
            // if port is not fully exposed, reduce areas accordingly
            // TODO: this.inletportarea2 = this.reducedPortArea(this.inletportarea2, this.cylinderportdiameter2); // mm^2
            // TODO: this.exhaustportarea2 = this.reducedPortArea(this.exhaustportarea2, this.cylinderportdiameter2); // mm^2
        }

        // let air through ports
        let inletAirMass = this.volumes[1].getClampedFlow(this.airflowmethod, this.inletpressure, this.inletportarea2, dt); // kg
        let exhaustAirMass = -this.volumes[1].getClampedFlow(this.airflowmethod, this.atmosphericpressure, this.exhaustportarea2, dt); // kg

        this.volumes[1].setMass(this.volumes[1].getMass() + inletAirMass - exhaustAirMass);
        this.sumairmass += inletAirMass;
    }

    // calculate torque from piston
    let rodArea = Math.PI * (this.roddiameter/2)*(this.roddiameter/2);
    pistonForce = 1000 * this.volumes[0].getPressure() * pistonArea*1e-6; // Newtons
    let opposingForce = 1000 * (this.doubleacting ? (this.volumes[1].getPressure() * (pistonArea-rodArea)*1e-6 + this.atmosphericpressure*rodArea*1e-6) : (this.atmosphericpressure * pistonArea*1e-6)); // Newtons
    pistonActingDistance = -Math.sin(this.cylinderangle * Math.PI/180) * this.pivotseparation; // mm
    crankTorque = (pistonForce-opposingForce) * (pistonActingDistance * 0.001); // Nm

    // calculate flywheel angular velocity with piston torque
    let angularacceleration = (crankTorque - this.load) / this.flywheelmomentofinertia; // rad/s^2
    let oldrpm = this.rpm;
    this.rpm += (angularacceleration * 30/Math.PI) * dt;

    // apply friction torque
    let lossTorque = this.frictiontorque + (this.loadperrpm * Math.abs(this.rpm));
    let friction_angaccel = lossTorque / this.flywheelmomentofinertia; // rad/s^2
    let friction_deltarpm = Math.abs((friction_angaccel * 30/Math.PI) * dt);
    if (friction_deltarpm > Math.abs(this.rpm)) {
        this.rpm = 0;
    } else if (this.rpm > 0) {
        this.rpm -= friction_deltarpm;
    } else {
        this.rpm += friction_deltarpm;
    }

    this.sumrawtorque += crankTorque;
    this.sumtorque += crankTorque - lossTorque;
    this.torquepoints++;
    this.sumrpm += this.rpm;

    // engine stalled/reversed if the product of new and old rpm is <= 0
    let wasstalled = this.stalled;
    this.stalled = (this.rpm * oldrpm) <= 0;
    if (this.stalled && !wasstalled && this.onstalled) this.onstalled();

    // update crank position
    this.crankposition += (this.rpm * 360 / 60) * dt;
    if (this.crankposition > 360 || this.crankposition < 0) {
        let oldmeanrpm = this.meanrpm;

        this.rawtorque = this.sumrawtorque / this.torquepoints;
        this.torque = this.sumtorque / this.torquepoints;
        this.meanrpm = this.sumrpm / this.torquepoints;
        this.airmass = this.sumairmass;
        this.rawpower = this.rawtorque * Math.PI * this.meanrpm / 30;
        this.power = this.torque * Math.PI * this.meanrpm / 30;
        this.sumrawtorque = 0;
        this.sumtorque = 0;
        this.sumrpm = 0;
        this.torquepoints = 0;
        this.sumairmass = 0;

        this.stable = Math.abs(this.meanrpm-oldmeanrpm) < this.meanrpm*0.0001;
        if (this.stable && this.onstable) this.onstable();
    }
    this.crankposition %= 360.0;
    if (this.crankposition < 0) this.crankposition += 360.0;

    this.computeCylinderPosition();

    // calculate updated efficiency
    let energy = this.power / (this.meanrpm/ 60);
    let rawenergy = this.rawpower / (this.meanrpm/ 60);
    let airenergy = (this.inletpressure-this.atmosphericpressure) * 1000 * this.airmass * (this.inletpressure/this.atmosphericpressure) * this.airdensity;
    this.efficiency = energy / airenergy;
    this.rawefficiency = rawenergy / airenergy;
};

Engine.prototype.computeCylinderPosition = function() {
    // 1. find position of crank pin relative to crank centre
    this.crankpinx = Math.sin(this.crankposition * Math.PI/180) * this.stroke/2;
    this.crankpiny = Math.cos(this.crankposition * Math.PI/180) * this.stroke/2;

    // 2. find angle from crank pin to cylinder pivot
    let dx = this.crankpinx;
    let dy = this.pivotseparation - this.crankpiny;
    this.cylinderangle = Math.atan2(dy, dx) * 180/Math.PI - 90;

    // 3. find height of piston from top of cylinder
    let dist = Math.sqrt(dx*dx + dy*dy); // distance from crank pin to oscillation pivot
    this.pistonheight = this.deadspace + this.stroke/2 + dist - this.pivotseparation;

    // 4. find cylinder volume
    let pistonArea = Math.PI * (this.bore/2)*(this.bore/2);
    this.volumes[0].setVolume(this.pistonheight * pistonArea); // mm^3

    // find height of piston from bottom of cylinder
    this.pistonheight2 = this.deadspace2 + this.stroke/2 + this.pivotseparation - dist;
    let rodArea = Math.PI * (this.roddiameter/2)*(this.roddiameter/2);
    this.volumes[1].setVolume(this.pistonheight2 * (pistonArea - rodArea)); // mm^3
};

Engine.prototype.reducedPortArea = function(area, d) {
    let totalheight = this.stroke/2 + this.rodlength + this.deadspace;
    let portheight = totalheight - (this.pivotseparation + this.portthrow); // mm - height of port centres from top of cylinder

    // TODO: what about the secondary volume?

    if (this.pistonheight < portheight-d/2) {
        // port is completely covered up
        return 0;
    } else if (this.pistonheight < portheight+d/2) {
        // port is partially covered up
        // TODO: this assumes area changes linearly with height, this is not correct
        let start = portheight-d/2;
        return area * (this.pistonheight-start)/d;
    } else {
        // port is completely exposed
        return area;
    }
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

if (window.module !== undefined)
    module.exports = { Engine };
