var ATMOSPHERIC_PRESSURE = 101.325; // kPa
var AIR_DENSITY = 1.204; // kg/m^3 at atmospheric pressure
var SPEED_OF_SOUND = 343; // m/s

// return the mass (kg) of a given pressure (kPa) of air in a given volume (mm^3)
computeMass = function(pressure, volume) {
    return (pressure/ATMOSPHERIC_PRESSURE) * (volume*1e-9) * AIR_DENSITY;
}

// return the pressure (kPa) of a given mass (kg) of air in a given volume (mm^3)
computePressure = function(mass, volume) {
    let pressureRatio = mass / (volume*1e-9 * AIR_DENSITY);
    return pressureRatio * ATMOSPHERIC_PRESSURE;
};

// return the volume (mm^3) of the given mass (kg) of air at the given pressure (kPa)
computeVolume = function(mass, pressure) {
    let pressureRatio = pressure/ATMOSPHERIC_PRESSURE;
    let volumeDensity = mass / pressureRatio;
    return volumeDensity / (1e-9 * AIR_DENSITY);
};

// return the rate of air flow from pressure1 (kPa) to pressure2 (kPa) through the given area (mm^2), in kg/sec
airFlowRate = function(method, pressure1, pressure2, area) {
    // is the air flowing the correct way?
    if (pressure2 > pressure1) return -airFlowRate(method, pressure2, pressure1, area);

    if (pressure1 == pressure2) return 0;

    if (method == 'trident1') {
        // derived from https://trident.on.ca/engineering-information/airvacuum-flow-orifice-table/
        let pressureDifference = pressure1 - pressure2;
        let kg_per_sec_mm2_kpa = 0.000035/Math.pow(pressureDifference,0.73)+0.00000154;
        let massFlow = kg_per_sec_mm2_kpa * area * pressureDifference;
        return massFlow;
    } else if (method == 'trident2') {
        // derived from https://trident.on.ca/engineering-information/airvacuum-flow-orifice-table/
        let pressureDifference = pressure1 - pressure2;
        let kg_per_sec_mm2_kpa = 0.0000315/Math.pow(pressureDifference,0.71)+0.00000155;
        let massFlow = kg_per_sec_mm2_kpa * area * pressureDifference;
        return massFlow;
    } else if (method == 'bernoulli') {
        // 1. compute flow velocity
        // https://physics.stackexchange.com/a/131068
        // pressure2 + 1/2 rho v^2 = pressure1
        // rho is density in pressure2
        // v^2 = 2(pressure1 - pressure2) / rho
        let rho = (pressure2/ATMOSPHERIC_PRESSURE)*AIR_DENSITY; // kg/m^3
        let velsqr = 2 * 1000*(pressure1 - pressure2) / rho;
        let vel = Math.sqrt(velsqr); // m/s

        // 2. cap flow at speed of sound
        if (vel > SPEED_OF_SOUND) vel = SPEED_OF_SOUND;

        // 3. compute mass flow
        let volumeFlow = vel * area * 1e-6; // m^3 / sec
        let massFlow = volumeFlow * rho; // kg / sec
        return massFlow;
    } else if (method == 'tlv') {
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
        let massFlow = Q_a * AIR_DENSITY / 60; // kg/sec
        return massFlow;
    } else if (method == 'billhall') {
        // from a document written by Bill Hall about his "Perform.exe" program, sent to me by Duncan Webster
        let Cd = 0.8; // coefficient of discharge
        let Ai = area * 1e-6; // m^2
        let v0 = 1/AIR_DENSITY; // "specific volume"
        let p0 = pressure1 * 1e3; // Pa
        let p = pressure2 * 1e3; // Pa
        let n = 1.4; // heat capacity ratio of air
        let criticalPressureRatio =  Math.pow(2/(n+1), n/(n-1));
        let pc = p0 * criticalPressureRatio;
        let pprime = p > pc ? p : pc;
        let massFlow = Cd * Ai * (1/v0) * Math.pow(pprime/p0, 1/n) * Math.sqrt(2 * (n/(n-1)) * p0 * v0 * (1 - Math.pow((pprime/p0), (n-1)/n)));
        return massFlow;
    } else if (method == 'linear') {
        let airFlowRate = 10; // kg/(m^2.kPa.sec)
        let pressureDifference = pressure1 - pressure2;
        return area * pressureDifference * airFlowRate * 1e-6;
    }

    console.log("Illegal air flow method: " + method);
    return 0;
};

// limit the given airFlow (kg) from pressure1 (kPa) to pressure2 (kPa) so that the resultant pressure in the destination volume (mm^3) does not overshoot the supply pressure (pressure1)
// need to make sure that we *do* allow pressure to decrease when it is already
// above the supply pressure (i.e. only clamp airFlow in the direction of making
// things worse)
clampAirFlow = function(airFlow, pressure1, pressure2, volume) {
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

// volume in mm^3, pressure in kPa
//
// an infinite AirVolume has fields (pressure, is_infinite)
// a finite AirVolume has fields (mass, volume)
// an AirVolume can change between the two types using setVolume() or setMass()
function AirVolume(pressure, volume) {
    if (volume == null || volume == Infinity) {
        this.pressure = pressure;
        this.is_infinite = true;
    } else {
        this.mass = computeMass(pressure, volume);
        this.volume = volume;
        this.is_infinite = false;
    }
}

AirVolume.prototype.isInfinite = function() {
    return this.is_infinite;
};

// in kPa
AirVolume.prototype.getPressure = function() {
    if (this.is_infinite)
        return this.pressure;
    else
        return computePressure(this.mass, this.volume);
};

// in mm^3
AirVolume.prototype.getVolume = function() {
    if (this.is_infinite)
        return Infinity;
    else
        return this.volume;
};

// in kg
AirVolume.prototype.getMass = function() {
    if (this.is_infinite)
        return Infinity;
    else
        return this.mass;
};

// in kPa - changes air mass, leaves volume alone
AirVolume.prototype.setPressure = function(p) {
    if (this.is_infinite)
        this.pressure = p;
    else
        this.mass = computeMass(p, this.volume);
};

// in mm^3 - changes pressure, leaves air mass alone
AirVolume.prototype.setVolume = function(v) {
    if (v == null || v == Infinity) {
        this.pressure = this.getPressure();
        this.is_infinite = true;
    } else {
        this.mass = this.getMass();
        this.volume = v;
        this.is_infinite = false;
    }
};

// in kg - changes pressure, leaves volume alone (except where m is infinite, in which case volume also becomes infinite)
AirVolume.prototype.setMass = function(m) {
    if (m == null || m == Infinity) {
        this.pressure = Infinity;
        this.is_infinite = true;
    } else {
        this.volume = this.getVolume();
        this.mass = m;
        this.is_infinite = false;
    }
};

// return flow rate (kg/sec) in to this volume, from a volume of the given pressure (kPa),
// through an orifice of the given cross-sectional area (mm^2)
// using the given method (tlv/trident1/trident2/bernoulli/linear/billhall)
AirVolume.prototype.getFlowRate = function(method, pressure, area) {
    return airFlowRate(method, pressure, this.getPressure(), area);
};

// return the mass flowed (kg) in to this volume, from the other given airvolume,
// through an orifice of the given cross-sectional area (mm^2), over the given
// duration (dt, seconds), but clamped so that the resulting pressure does not exceed the
// supply pressure (e.g. if the timestep is too large)
// using the given method (tlv/trident1/trident2/bernoulli/linear/billhall)
AirVolume.prototype.getClampedFlow = function(method, airvolume, area, dt) {
    let flow = this.getFlowRate(method, airvolume.getPressure(), area) * dt;
    if (!this.is_infinite)
        flow = clampAirFlow(flow, airvolume.getPressure(), this.getPressure(), this.getVolume());
    if (!airvolume.is_infinite)
        flow = -clampAirFlow(-flow, this.getPressure(), airvolume.getPressure(), airvolume.getVolume());

    return flow;
};

if (typeof module !== 'undefined')
    module.exports = { AirVolume };
