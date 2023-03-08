
function Engine() {
    // parameters:
    this.crankthrow = 15; // mm
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
    this.flywheelmomentofinertia = 7.3e-8; // kg m^2
    this.atmosphericpressure = 101.325; // kPa
    this.inletpressure = this.atmosphericpressure + 20; // kPa
    this.frictiontorque = 0.006; // Nm, opposing the flywheel rotation
    this.airflowrate = 0.00001; // kg/(mm^2.kPa.sec) - TODO?
    this.airdensity = 1.204; // kg/m^3 at atmospheric pressure
    this.speedofsound = 343; // m/s

    // state:
    this.cylinderpressure = this.atmosphericpressure; // kPa
    this.crankposition = 0; // degrees - TDC=0
    this.rpm = 200; // rpm

    // computed state:
    this.cylinderangle = 0; // degrees
    this.pistonheight = 0; // mm from top of cylinder
    this.crankpinx = 0; // mm from crank centre
    this.crankpiny = 0; // mm from crank centre

    this.sumtorque = 0;
    this.sumrpm = 0;
    this.torquepoints = 0;
    this.torque = 0;
    this.meanrpm = 0;
    this.power = 0;

    this.computeCylinderPosition();
}

Engine.prototype.step = function(dt) {
    let pistonArea = Math.PI * (this.bore/2)*(this.bore/2);
    let stroke = this.crankthrow*2;
    let currentVolume = this.pistonheight * pistonArea; // mm^3
    let currentAirMass = (this.cylinderpressure/this.atmosphericpressure) * (currentVolume*1e-9) * this.airdensity; // kg

    // compute the effective port locations
    let inletPortX = sin(this.inletportangle * Math.PI/180) * this.portthrow;
    let inletPortY = cos(this.inletportangle * Math.PI/180) * this.portthrow;
    let exhaustPortX = sin(this.exhaustportangle * Math.PI/180) * this.portthrow;
    let exhaustPortY = cos(this.exhaustportangle * Math.PI/180) * this.portthrow;
    let cylinderPortX = sin(this.cylinderangle * Math.PI/180) * this.portthrow;
    let cylinderPortY = cos(this.cylinderangle * Math.PI/180) * this.portthrow;

    this.inletportx = inletPortX;
    this.inletporty = inletPortY;
    this.exhaustportx = exhaustPortX;
    this.exhaustporty = exhaustPortY;
    this.cylinderportx = cylinderPortX;
    this.cylinderporty = cylinderPortY;

    // compute port overlap areas
    // TODO: if the ports don't lie within the cylinder, or are
    // the wrong side of the piston surface, then we get less
    // area; want the are of intersection of the inlet port,
    // cylinder port, and area of cylinder above piston
    let inletPortArea = areaOfIntersection(inletPortX, inletPortY, this.inletportdiameter/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter/2); // mm^2
    let exhaustPortArea = areaOfIntersection(exhaustPortX, exhaustPortY, this.exhaustportdiameter/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter/2); // mm^2

    // TODO: problem is that when timestep is too high,
    // we let in so much air that the cylinder pressure
    // would exceed the inlet pressure! Because we just multiply
    // rate of change of pressure by dt

    // if inlet port is open, let some air in (proportional to pressure difference and port area)
    let inletAirMass = this.airFlow(this.inletpressure, this.cylinderpressure, inletPortArea) * dt; // kg

    // if exhaust port is open, let some air out (proportional to pressure difference and port area)
    let exhaustAirMass = this.airFlow(this.cylinderpressure, this.atmosphericpressure, exhaustPortArea) * dt; // kg

    // calculate torque from piston
    pistonForce = 1000 * this.cylinderpressure * pistonArea*1e-6; // Newtons
    pistonActingDistance = -Math.sin(this.cylinderangle * Math.PI/180) * this.pivotseparation; // mm
    crankTorque = pistonForce * (pistonActingDistance * 0.001); // Nm

    this.sumtorque += crankTorque;
    this.torquepoints++;

    // calculate flywheel angular velocity with piston torque
    let angularacceleration = crankTorque / this.flywheelmomentofinertia; // rad/s^2
    this.rpm += (angularacceleration / (120*Math.PI)) * dt;

    // apply friction torque
    let friction_angaccel = this.frictiontorque / this.flywheelmomentofinertia; // rad/s^2
    let friction_deltarpm = Math.abs((friction_angaccel / (120*Math.PI)) * dt);
    if (friction_deltarpm > Math.abs(this.rpm)) {
        this.rpm = 0;
    } else if (this.rpm > 0) {
        this.rpm -= friction_deltarpm;
    } else {
        this.rpm += friction_deltarpm;
    }

    //this.rpm -= this.rpm * 0.1*dt; // TODO: ???

    this.sumrpm += this.rpm;

    // update crank position (first pass)
    this.crankposition += (this.rpm * 360 / 60) * dt;
    if (this.crankposition > 360) {
        this.torque = this.sumtorque / this.torquepoints;
        this.meanrpm = this.sumrpm / this.torquepoints;
        this.power = this.torque * Math.PI * this.meanrpm / 30;
        this.sumtorque = 0;
        this.sumrpm = 0;
        this.torquepoints = 0;
    }
    this.crankposition %= 360.0; // XXX: modulo of float?

    this.computeCylinderPosition();

    // calculate updated cylinder pressure
    let newVolume = this.pistonheight * pistonArea; // mm^3
    let newAirMass = currentAirMass + inletAirMass - exhaustAirMass; // kg
    let pressureRatio = newAirMass / (newVolume*1e-9 * this.airdensity);
    this.cylinderpressure = pressureRatio * this.atmosphericpressure;
};

Engine.prototype.computeCylinderPosition = function() {
    // 1. find position of crank pin relative to crank centre
    this.crankpinx = Math.sin(this.crankposition * PI/180) * this.crankthrow;
    this.crankpiny = Math.cos(this.crankposition * PI/180) * this.crankthrow;

    // 2. find angle from crank pin to cylinder pivot
    let dx = this.crankpinx;
    let dy = this.pivotseparation - this.crankpiny;
    this.cylinderangle = Math.atan2(dy, dx) * 180/PI - 90;

    // 3. find height of piston
    let dist = Math.sqrt(dx*dx + dy*dy);
    this.pistonheight = this.deadspace + this.crankthrow + dist - this.pivotseparation;
};

// return the rate of air flow from pressure1 (kPa) to pressure2 (kPa) through the given area (mm^2), in kg/sec
Engine.prototype.airFlow = function(pressure1, pressure2, area) {
    // cap the pressure difference at a factor of 1.8
    // TODO: this should somehow relate to the speed of sound?
    //if (pressure1 > 1.8*pressure2) pressure1 = 1.8*pressure2;
    //if (pressure2 > 1.8*pressure1) pressure2 = 1.8*pressure1;

    let pressuredifference = pressure1 - pressure2;
    return pressuredifference * area * this.airflowrate;
};

// https://math.stackexchange.com/a/290526
function areaOfIntersection(x0, y0, r0, x1, y1, r1) {
  var rr0 = r0*r0;
  var rr1 = r1*r1;
  var c = Math.sqrt((x1-x0)*(x1-x0) + (y1-y0)*(y1-y0));
  if (c >= r0+r1) return 0; // no overlap: return 0 area
  if (c < r0 || c < r1) {
      // full overlap: return area of smallest circle
      if (r0 < r1) return Math.PI*r0*r0;
      else return Math.PI*r1*r1;
  }
  var phi = (Math.acos((rr0+(c*c)-rr1) / (2*r0*c)))*2;
  var theta = (Math.acos((rr1+(c*c)-rr0) / (2*r1*c)))*2;
  var area1 = 0.5*theta*rr1 - 0.5*rr1*Math.sin(theta);
  var area2 = 0.5*phi*rr0 - 0.5*rr0*Math.sin(phi);
  return area1 + area2;
}
