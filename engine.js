
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
    this.frictiontorque = 0.01; // Nm, opposing the flywheel rotation
    this.airdensity = 1.204; // kg/m^3 at atmospheric pressure
    this.speedofsound = 343; // m/s
    this.airflowmethod = 'tlv'; // tlv/trident1/trident2/bernoulli/linear

    this.loadperrpm = 0;

    // state:
    this.cylinderpressure = 0; // kPa
    this.crankposition = 0; // degrees - TDC=0
    this.rpm = 0; // rpm

    // computed state:
    this.cylinderangle = 0; // degrees
    this.pistonheight = 0; // mm from top of cylinder
    this.crankpinx = 0; // mm from crank centre
    this.crankpiny = 0; // mm from crank centre
    this.cylindervolume = 0; // mm^3

    this.reset();
}

Engine.prototype.reset = function() {
    this.cylinderpressure = this.inletpressure;
    this.crankposition = 0;
    this.rpm = 200;
    this.computeCylinderPosition();

    this.sumtorque = 0;
    this.sumrpm = 0;
    this.torquepoints = 0;
    this.torque = 0;
    this.meanrpm = 0;
    this.power = 0;
};

Engine.prototype.step = function(dt) {
    let pistonArea = Math.PI * (this.bore/2)*(this.bore/2); // mm^2
    let currentAirMass = this.computeMass(this.cylinderpressure, this.cylindervolume); // kg

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
    let inletPortArea = areaOfIntersection(inletPortX, inletPortY, this.inletportdiameter/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter/2); // mm^2
    let exhaustPortArea = areaOfIntersection(exhaustPortX, exhaustPortY, this.exhaustportdiameter/2, cylinderPortX, cylinderPortY, this.cylinderportdiameter/2); // mm^2

    // if port is not fully exposed, reduce areas accordingly
    inletPortArea = this.reducedPortArea(inletPortArea, this.inletportdiameter, this.cylinderportdiameter); // mm^2
    exhaustPortArea = this.reducedPortArea(exhaustPortArea, this.exhaustportdiameter, this.cylinderportdiameter); // mm^2
    this.inletportarea = inletPortArea;
    this.exhaustportarea = exhaustPortArea;

    // if inlet port is open, let some air in (proportional to pressure difference and port area)
    let inletAirMass = this.airFlow(this.inletpressure, this.cylinderpressure, inletPortArea) * dt; // kg
    inletAirMass = this.clampAirFlow(inletAirMass, this.inletpressure, this.cylinderpressure, this.cylindervolume); // kg

    // if exhaust port is open, let some air out (proportional to pressure difference and port area)
    let exhaustAirMass = this.airFlow(this.cylinderpressure, this.atmosphericpressure, exhaustPortArea) * dt; // kg
    exhaustAirMass = -this.clampAirFlow(-exhaustAirMass, this.atmosphericpressure, this.cylinderpressure, this.cylindervolume); // kg

    // calculate torque from piston
    pistonForce = 1000 * (this.cylinderpressure-this.atmosphericpressure) * pistonArea*1e-6; // Newtons
    pistonActingDistance = -Math.sin(this.cylinderangle * Math.PI/180) * this.pivotseparation; // mm
    crankTorque = pistonForce * (pistonActingDistance * 0.001); // Nm

    this.sumtorque += crankTorque;
    this.torquepoints++;

    // calculate flywheel angular velocity with piston torque
    let angularacceleration = crankTorque / this.flywheelmomentofinertia; // rad/s^2
    this.rpm += (angularacceleration * 30/Math.PI) * dt;

    // apply friction torque
    let loadtorque = this.frictiontorque + (this.loadperrpm * this.rpm);
    let friction_angaccel = loadtorque / this.flywheelmomentofinertia; // rad/s^2
    let friction_deltarpm = Math.abs((friction_angaccel * 30/Math.PI) * dt);
    if (friction_deltarpm > Math.abs(this.rpm)) {
        this.rpm = 0;
    } else if (this.rpm > 0) {
        this.rpm -= friction_deltarpm;
    } else {
        this.rpm += friction_deltarpm;
    }

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
    this.cylinderpressure = this.computePressure(currentAirMass + inletAirMass - exhaustAirMass, this.cylindervolume);
};

Engine.prototype.computeCylinderPosition = function() {
    // 1. find position of crank pin relative to crank centre
    this.crankpinx = Math.sin(this.crankposition * PI/180) * this.stroke/2;
    this.crankpiny = Math.cos(this.crankposition * PI/180) * this.stroke/2;

    // 2. find angle from crank pin to cylinder pivot
    let dx = this.crankpinx;
    let dy = this.pivotseparation - this.crankpiny;
    this.cylinderangle = Math.atan2(dy, dx) * 180/PI - 90;

    // 3. find height of piston from top of cylinder
    let dist = Math.sqrt(dx*dx + dy*dy);
    this.pistonheight = this.deadspace + this.stroke/2 + dist - this.pivotseparation;

    // 4. find cylinder volume
    let pistonArea = Math.PI * (this.bore/2)*(this.bore/2);
    this.cylindervolume = this.pistonheight * pistonArea; // mm^3
};

// return the pressure (kPa) of a given mass (kg) of air in a given volume (mm^3)
Engine.prototype.computePressure = function(mass, volume) {
    let pressureRatio = mass / (volume*1e-9 * this.airdensity);
    return pressureRatio * this.atmosphericpressure;
};

// return the mass (kg) of a given pressure (kPa) of air in a given volume (mm^3)
Engine.prototype.computeMass = function(pressure, volume) {
    return (pressure/this.atmosphericpressure) * (volume*1e-9) * this.airdensity;
}

// return the rate of air flow from pressure1 (kPa) to pressure2 (kPa) through the given area (mm^2), in kg/sec
Engine.prototype.airFlow = function(pressure1, pressure2, area) {
    // is the air flowing the correct way?
    if (pressure2 > pressure1) return -this.airFlow(pressure2, pressure1, area);

    if (this.airflowmethod == 'trident1') {
        // derived from https://trident.on.ca/engineering-information/airvacuum-flow-orifice-table/
        let pressureDifference = pressure1 - pressure2;
        let kg_per_sec_mm2_kpa = 0.000035/Math.pow(pressureDifference,0.73)+0.00000154;
        let massFlow = kg_per_sec_mm2_kpa * area * pressureDifference;
        return massFlow;
    } else if (this.airflowmethod == 'trident2') {
        // derived from https://trident.on.ca/engineering-information/airvacuum-flow-orifice-table/
        let pressureDifference = pressure1 - pressure2;
        let kg_per_sec_mm2_kpa = 0.0000315/Math.pow(pressureDifference,0.71)+0.00000155;
        let massFlow = kg_per_sec_mm2_kpa * area * pressureDifference;
        return massFlow;
    } else if (this.airflowmethod == 'bernoulli') {
        // 1. compute flow velocity
        // https://physics.stackexchange.com/a/131068
        // pressure2 + 1/2 rho v^2 = pressure1
        // rho is density in pressure2
        // v^2 = 2(pressure1 - pressure2) / rho
        let rho = (pressure2/this.atmosphericpressure)*this.airdensity; // kg/m^3
        let velsqr = 2 * 1000*(pressure1 - pressure2) / rho;
        let vel = Math.sqrt(velsqr); // m/s

        // 2. cap flow at speed of sound
        if (vel > this.speedofsound) vel = this.speedofsound;

        // 3. compute mass flow
        let volumeFlow = vel * area * 1e-6; // m^3 / sec
        let massFlow = volumeFlow * rho; // kg / sec
        return massFlow;
    } else if (this.airflowmethod == 'tlv') {
        // derived from https://www.tlv.com/global/UK/calculator/air-flow-rate-through-orifice.html
        let pressureDifference = pressure1 - pressure2;
        let pressureRatio = pressureDifference / pressure1;
        let specificHeatRatio = 1.4;
        let F_gamma = specificHeatRatio/1.4; // "specific heat ratio factor"
        let x_T = 0.72; // "pressure differential ratio factor"
        let C = 0.63; // "discharge coefficient"
        let T_a = 20; // air temperature (deg. C)

        let Q_a; // Normal m^3/min
        if (pressureRatio < F_gamma*x_T) {
            Q_a = 0.0695 * C * (area/5.4143) * pressure1 * (1 - (pressureRatio / (3*F_gamma*x_T))) * Math.sqrt(pressureRatio / (T_a+273.15));
        } else {
            Q_a = 0.046333 * C * (area/5.4143) * pressure1 * Math.sqrt((F_gamma*x_T)/(T_a+273.15));
        }
        let massFlow = Q_a * this.airdensity / 60; // kg/sec
        return massFlow;
    } else { // this.airflowmethod == 'linear'
        let airFlowRate = 10; // kg/(m^2.kPa.sec)
        let pressureDifference = pressure1 - pressure2;
        return area * pressureDifference * airFlowRate * 1e-6;
    }
};

// limit the given airFlow (kg) from pressure1 (kPa) to pressure2 (kPa) so that the resultant pressure in the destination volume (mm^3) does not overshoot the supply pressure (pressure1)
// need to make sure that we *do* allow pressure to decrease when it is already
// above the supply pressure (i.e. only clamp airFlow in the direction of making
// things worse)
Engine.prototype.clampAirFlow = function(airFlow, pressure1, pressure2, volume) {
    let newMass = this.computeMass(pressure2, volume) + airFlow;
    let newPressure = this.computePressure(newMass, volume);
    let pressureDifference = pressure1 - pressure2;

    if (pressureDifference > 0) { // airFlow should be positive
        if (airFlow < 0) return 0;
        if (newPressure <= pressure1) return airFlow;
        return this.computeMass(pressure1, volume) - this.computeMass(pressure2, volume);
    } else { // airFlow should be negative
        if (airFlow > 0) return 0;
        if (newPressure >= pressure1) return airFlow;
        return this.computeMass(pressure1, volume) - this.computeMass(pressure2, volume);
    }
};

Engine.prototype.reducedPortArea = function(area, d1, d2) {
    let totalheight = this.stroke/2 + this.rodlength + this.deadspace;
    let portheight = totalheight - (this.pivotseparation + this.portthrow); // mm - height of port centres from top of cylinder

    // say that the effective diameter is the smaller of the two
    let d = (d1 < d2) ? d1 : d2;

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
