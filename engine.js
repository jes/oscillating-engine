
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
    this.flywheelmomentofinertia = 1.7e-4; // kg m^2
    this.inletpressure = 20; // kPa
    this.frictiontorque = 0.0005; // Nm, opposing the flywheel rotation
    this.airflowrate = 100000; // TODO: units??? this is something to do with how quickly air will flow through a given diameter at a given pressure difference

    // state:
    this.cylinderpressure = 0; // kPa
    this.crankposition = 0; // degrees - TDC=0
    this.rpm = 50; // rpm

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
    let currentVolume = this.pistonheight * pistonArea;
    let currentAirParticles = this.cylinderpressure * currentVolume;
    let pressuredifference = this.inletpressure - this.cylinderpressure;

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
    let inletPortArea = areaOfIntersection(inletPortX, inletPortY, this.inletportdiameter/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter/2);
    let exhaustPortArea = areaOfIntersection(exhaustPortX, exhaustPortY, this.exhaustportdiameter/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter/2);

    // if inlet port is open, let some air in (proportional to pressure difference and port area)
    let inletAirParticles = pressuredifference * inletPortArea * this.airflowrate * dt;

    // if exhaust port is open, let some air out (proportional to pressure difference and port area)
    let exhaustAirParticles = this.cylinderpressure * exhaustPortArea * this.airflowrate * dt;

    // calculate torque from piston
    pistonForce = 1000 * this.cylinderpressure * (pistonArea * 0.000001); // Newtons
    pistonActingDistance = -Math.sin(this.cylinderangle * Math.PI/180) * this.pivotseparation;
    crankTorque = pistonForce * (pistonActingDistance * 0.001); // Nm

    this.sumtorque += crankTorque;
    this.torquepoints++;

    // calculate flywheel angular velocity with piston torque
    let oldrpm = this.rpm;
    this.rpm += crankTorque / this.flywheelmomentofinertia * dt;

    // apply friction torque
    let friction_deltarpm = this.frictiontorque / this.flywheelmomentofinertia * dt;
    if (Math.abs(friction_deltarpm) > Math.abs(this.rpm)) {
        this.rpm = 0;
    } else if (this.rpm > 0) {
        this.rpm -= friction_deltarpm;
    } else {
        this.rpm += friction_deltarpm;
    }

    this.rpm -= this.rpm * 0.1*dt; // TODO: ???

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
    while (this.crankposition > 360) this.crankposition -= 360;

    this.computeCylinderPosition();

    // calculate updated cylinder pressure
    let newVolume = this.pistonheight * pistonArea;
    this.cylinderpressure = (currentAirParticles + inletAirParticles - exhaustAirParticles) / newVolume;
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
}

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
