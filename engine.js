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
    let inletPortX = Math.sin(this.inletportangle * Math.PI/180) * this.portthrow;
    let inletPortY = Math.cos(this.inletportangle * Math.PI/180) * this.portthrow;
    let exhaustPortX = Math.sin(this.exhaustportangle * Math.PI/180) * this.portthrow;
    let exhaustPortY = Math.cos(this.exhaustportangle * Math.PI/180) * this.portthrow;
    let cylinderPortX = Math.sin(this.cylinderangle * Math.PI/180) * this.portthrow;
    let cylinderPortY = Math.cos(this.cylinderangle * Math.PI/180) * this.portthrow;

    this.inletportx = inletPortX;
    this.inletporty = inletPortY;
    this.exhaustportx = exhaustPortX;
    this.exhaustporty = exhaustPortY;
    this.cylinderportx = cylinderPortX;
    this.cylinderporty = cylinderPortY;

    // compute port overlap areas
    let inletPortArea = areaOfIntersection(inletPortX, inletPortY, this.inletportdiameter/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter/2); // mm^2
    let exhaustPortArea = areaOfIntersection(exhaustPortX, exhaustPortY, this.exhaustportdiameter/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter/2); // mm^2

    if (this.straightports) {
        // if port is not fully exposed, reduce areas accordingly
        inletPortArea = this.reducedPortArea(inletPortArea, this.cylinderportdiameter); // mm^2
        exhaustPortArea = this.reducedPortArea(exhaustPortArea, this.cylinderportdiameter); // mm^2
    }
    this.inletportarea = inletPortArea;
    this.exhaustportarea = exhaustPortArea;

    // let air through ports
    let inletAirMass = this.volumes[0].getClampedFlow(this.airflowmethod, this.inletpressure, inletPortArea, dt); // kg
    let exhaustAirMass = -this.volumes[0].getClampedFlow(this.airflowmethod, this.atmosphericpressure, exhaustPortArea, dt); // kg

    // TODO: what happens when the primary volume is exposed to the secondary ports, or vice versa? do we need to implement that? maybe we want (for each cylinder port, for each port, for each volume, compute air flow and limit to the "reducedPortArea")

    let inletAirMass2;
    let exhaustAirMass2;
    // TODO: refactor, so that we're generic about the number of volumes
    if (this.doubleacting) {
        let inletPortX = Math.sin((180 + this.inletportangle2) * Math.PI/180) * this.portthrow2;
        let inletPortY = Math.cos((180 + this.inletportangle2) * Math.PI/180) * this.portthrow2;
        let exhaustPortX = Math.sin((180 + this.exhaustportangle2) * Math.PI/180) * this.portthrow2;
        let exhaustPortY = Math.cos((180 + this.exhaustportangle2) * Math.PI/180) * this.portthrow2;
        let cylinderPortX = Math.sin((180 + this.cylinderangle) * Math.PI/180) * this.portthrow2;
        let cylinderPortY = Math.cos((180 + this.cylinderangle) * Math.PI/180) * this.portthrow2;

        this.inletportx2 = inletPortX;
        this.inletporty2 = inletPortY;
        this.exhaustportx2 = exhaustPortX;
        this.exhaustporty2 = exhaustPortY;
        this.cylinderportx2 = cylinderPortX;
        this.cylinderporty2 = cylinderPortY;

        // compute port overlap areas
        let inletPortArea = areaOfIntersection(inletPortX, inletPortY, this.inletportdiameter2/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter2/2); // mm^2
        let exhaustPortArea = areaOfIntersection(exhaustPortX, exhaustPortY, this.exhaustportdiameter2/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter2/2); // mm^2

        if (this.straightports) {
            // if port is not fully exposed, reduce areas accordingly
            // TODO: inletPortArea = this.reducedPortArea(inletPortArea, this.cylinderportdiameter2); // mm^2
            // TODO: exhaustPortArea = this.reducedPortArea(exhaustPortArea, this.cylinderportdiameter2); // mm^2
        }
        this.inletportarea2 = inletPortArea;
        this.exhaustportarea2 = exhaustPortArea;

        // let air through ports
        inletAirMass2 = this.volumes[1].getClampedFlow(this.airflowmethod, this.inletpressure, inletPortArea, dt); // kg
        exhaustAirMass2 = -this.volumes[1].getClampedFlow(this.airflowmethod, this.atmosphericpressure, exhaustPortArea, dt); // kg
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
    this.sumairmass += inletAirMass + (this.doubleacting ? inletAirMass2 : 0);

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

    // calculate updated cylinder pressure
    this.volumes[0].setMass(this.volumes[0].getMass() + inletAirMass - exhaustAirMass);
    if (this.doubleacting)
        this.volumes[1].setMass(this.volumes[1].getMass() + inletAirMass2 - exhaustAirMass2);

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

// return the pressure (kPa) of a given mass (kg) of air in a given volume (mm^3)
// TODO: delete, move to AirVolume
Engine.prototype.computePressure = function(mass, volume) {
    let pressureRatio = mass / (volume*1e-9 * this.airdensity);
    return pressureRatio * this.atmosphericpressure;
};

// return the mass (kg) of a given pressure (kPa) of air in a given volume (mm^3)
// TODO: delete, move to AirVolume
Engine.prototype.computeMass = function(pressure, volume) {
    return (pressure/this.atmosphericpressure) * (volume*1e-9) * this.airdensity;
}

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
