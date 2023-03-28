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
    this.makePorts();
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

Engine.prototype.makePorts = function() {
    this.inletport = new Port(this.inletportangle, this.portthrow, this.inletportdiameter, new AirVolume(this.inletpressure));
    this.exhaustport = new Port(this.exhaustportangle, this.portthrow, this.exhaustportdiameter, new AirVolume(this.atmosphericpressure));
    this.cylinderport = new Port(this.cylinderangle, this.portthrow, this.cylinderportdiameter, this.volumes[0]);

    this.inletport2 = new Port(180+this.inletportangle2, this.portthrow2, this.inletportdiameter2, new AirVolume(this.inletpressure));
    this.exhaustport2 = new Port(180+this.exhaustportangle2, this.portthrow2, this.exhaustportdiameter2, new AirVolume(this.atmosphericpressure));
    this.cylinderport2 = new Port(180+this.cylinderangle, this.portthrow2, this.cylinderportdiameter2, this.volumes[1]);
};

Engine.prototype.step = function(dt) {
    let pistonArea = Math.PI * (this.bore/2)*(this.bore/2); // mm^2
    let rodArea = Math.PI * (this.roddiameter/2)*(this.roddiameter/2);

    // compute the flow through the ports
    let piston_height_above_pivot = -(this.pistonheight - (this.stroke/2 + this.rodlength + this.deadspace) + this.pivotseparation);
    let inletAirMass; let exhaustAirMass;
    if (this.straightports) {
        inletAirMass = -this.inletport.reducedFlow(this.cylinderport, piston_height_above_pivot, true, this.airflowmethod, dt); // kg
        exhaustAirMass = this.exhaustport.reducedFlow(this.cylinderport, piston_height_above_pivot, true, this.airflowmethod, dt); // kg
    } else {
        inletAirMass = -this.inletport.flow(this.cylinderport, this.airflowmethod, dt); // kg
        exhaustAirMass = this.exhaustport.flow(this.cylinderport, this.airflowmethod, dt); // kg
    }

    this.volumes[0].setMass(this.volumes[0].getMass() + inletAirMass - exhaustAirMass);
    this.sumairmass += inletAirMass;

    // TODO: what happens when the primary volume is exposed to the secondary ports, or vice versa? do we need to implement that? maybe we want (for each cylinder port, for each port, for each volume, compute air flow and limit to the "reducedPortArea")

    if (this.doubleacting) {
        let inletAirMass; let exhaustAirMass;
        if (this.straightports) {
            inletAirMass = -this.inletport2.reducedFlow(this.cylinderport2, piston_height_above_pivot-this.pistonlength, false, this.airflowmethod, dt); // kg
            exhaustAirMass = this.exhaustport2.reducedFlow(this.cylinderport2, piston_height_above_pivot-this.pistonlength, false, this.airflowmethod, dt); // kg
        } else {
            inletAirMass = -this.inletport2.flow(this.cylinderport2, this.airflowmethod, dt); // kg
            exhaustAirMass = this.exhaustport2.flow(this.cylinderport2, this.airflowmethod, dt); // kg
        }

        this.volumes[1].setMass(this.volumes[1].getMass() + inletAirMass - exhaustAirMass);
        this.sumairmass += inletAirMass;
    }

    // calculate torque from piston
    let pistonForce = 1000 * this.volumes[0].getPressure() * pistonArea*1e-6; // Newtons
    let opposingForce = 1000 * (this.doubleacting ? (this.volumes[1].getPressure() * (pistonArea-rodArea)*1e-6 + this.atmosphericpressure*rodArea*1e-6) : (this.atmosphericpressure * pistonArea*1e-6)); // Newtons
    let pistonActingDistance = -Math.sin(this.cylinderangle * Math.PI/180) * this.pivotseparation; // mm
    let crankTorque = (pistonForce-opposingForce) * (pistonActingDistance * 0.001); // Nm

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

    // update port locations
    this.cylinderport.setAngle(this.cylinderangle);
    this.cylinderport2.setAngle(180+this.cylinderangle);
};

if (window.module !== undefined)
    module.exports = { Engine };
