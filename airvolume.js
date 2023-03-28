var ATMOSPHERIC_PRESSURE = 101.325; // kPa
var AIR_DENSITY = 1.204; // kg/m^3 at atmospheric pressure

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

if (window.module !== undefined)
    module.exports = { AirVolume };
