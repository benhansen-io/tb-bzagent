var sylvester = require("sylvester");
var Matrix = sylvester.Matrix;
var pf = require('./potential-fields');

// dt is in seconds (or fractions thereof)
var F = function(dt, frictionConstant) {
  var c = frictionConstant;
  return Matrix.create([
    [1, dt, Math.pow(dt,2) / 2, 0, 0, 0],
    [0, 1, dt, 0, 0, 0],
    [0, -c, 1, 0 ,0, 0],
    [0, 0, 0, 1, dt, Math.pow(dt,2) / 2],
    [0, 0, 0, 0, 1, dt],
    [0, 0, 0, 0, -c, 1]]);
};

// Points are based on TopLeft on less prefixed with Center

var centerPointToTopLeftPoint = function(point, worldsize) {
  return [point[0] + worldsize / 2, worldsize - (point[1] + worldsize / 2)];
};

var topLeftPointToCenterPoint = function(point, worldsize) {
  return [point[0] - worldsize / 2, worldsize / 2 - point[1]];
};

var muToPoint = function(mu, worldsize) {
  return centerPointToTopLeftPoint(muToCenterPoint(mu),
                                   worldsize);
};

var muToCenterPoint = function(mu) {
  return [Math.round(mu.e(1,1)),
    Math.round(mu.e(4,1))];
};

var xYColToPoint = function(xYCol, worldsize) {
  return centerPointToTopLeftPoint([Math.round(xYCol.e(1,1)),
                                   Math.round(xYCol.e(2,1))],
                                   worldsize);
};

var pointToXYCol = function(point, worldsize) {
  var centerPoint = topLeftPointToCenterPoint(point, worldsize);
  return Matrix.create([
    [centerPoint[0]],
    [centerPoint[1]]]);
};

var muToXYCol = function(mu) {
  return Matrix.create([
    [mu.e(1, 1)],
    [mu.e(4, 1)]]);
};


// Turn a 6x6 sigma into a 2x2 sigma (I am decently confident this is the way to do it).
var getXYSigma = function(sigma) {
  return Matrix.create([
    [sigma.e(1, 1), sigma.e(1, 4)],
    [sigma.e(4, 1), sigma.e(4, 4)]]);
};

var normalDistrobution = function(mu, sigma) {
  var normalizer = Math.pow(Math.pow(2*Math.PI, mu.rows()) * sigma.determinant(), -0.5);
  var sigmaInverse = sigma.inverse();

  return function(x) {
    var diff = x.subtract(mu);
    return normalizer * Math.exp(diff.transpose().x(sigmaInverse).x(diff).x(-0.5).e(1,1));
  };

};

// Returns in seconds the amount of time for a butllet to cross the distance.
var toToBulletImpact = function(distance, shotspeed) {
  return distance / shotspeed;
};

// returns the number of seconds the bullet arrived before (positive) or after (negative)
// the enemies location at time in the future if shot there now.
// myLocPoint: [x, y] (origin at center)
var calculateMissTimeDifference = function(enemyMu, myLocPoint, time, shotspeed, frictionConstant) {
  var enemiesFutureLocation = muToCenterPoint(F(time, frictionConstant).x(enemyMu));
  var distance = pf.distance(enemiesFutureLocation, myLocPoint);
  var timeRequired = toToBulletImpact(distance, shotspeed);
  return time - timeRequired;
};

// Including this because NPM's binary search packages index into arrays
// F must return a real value, if it is negative, we look lower, positive, higher
// until we reach a value within accuracy
// low and high are exclusive (as they will never be reached exactly but can be reached arbitrarily close to)
var binarySearchFunction = function(fn, low, high, matchAccuracy, giveUpAccuracy) {
  var mid = (high + low) / 2;
  var value = fn(mid);
  if(high - low < giveUpAccuracy) {
    console.log('Giving up on finding result within matchAccuracy. Found value of ' + value);
    // This might be a problem if the result is unreasonable
    return mid;
  }
  if(Math.abs(value) < matchAccuracy) {
    return mid;
  } else if(value > 0) {
    return binarySearchFunction(fn, mid, high, matchAccuracy, giveUpAccuracy);
  } else {
    return binarySearchFunction(fn, low, mid, matchAccuracy, giveUpAccuracy);
  }
};

var findAngleForImpact = function(enemyMu, myLocPoint, shotspeed, frictionConstant) {
  //console.log('enemyMu:', enemyMu);
  //console.log('myLoc:', myLocPoint);
  var searchMe = function(time) {
    return -1 * calculateMissTimeDifference(enemyMu, myLocPoint, time, shotspeed, frictionConstant);
  };
  var giveUpAccuracy = 0.000000000000000000001;
  var matchAccuracy = 0.01;
  var impactTime = binarySearchFunction(searchMe, 0, 10, matchAccuracy, giveUpAccuracy);
  //console.log('impactTime: ', impactTime);
  if(impactTime === undefined || impactTime < 0) {
    //debugger;
    throw 'Could not find a time for impact';
  }
  var impactLocation = muToCenterPoint(F(impactTime, frictionConstant).x(enemyMu));
  //console.log('impactLocation: ', impactLocation);
  return pf.angle(myLocPoint, impactLocation);
};

module.exports = {
  F: F,
  muToXYCol: muToXYCol,
  muToCenterPoint: muToCenterPoint,
  xYColToPoint: xYColToPoint,
  pointToXYCol: pointToXYCol,
  getXYSigma: getXYSigma,
  normalDistrobution: normalDistrobution,
  toToBulletImpact: toToBulletImpact,
  binarySearchFunction: binarySearchFunction,
  findAngleForImpact: findAngleForImpact,
};
