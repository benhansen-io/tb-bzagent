var sylvester = require("sylvester");
var Matrix = sylvester.Matrix;

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

var centerPointToTopLeftPoint = function(point, worldsize) {
  return [point[0] + worldsize / 2, worldsize - (point[1] + worldsize / 2)];
};

var topLeftPointToCenterPoint = function(point, worldsize) {
  return [point[0] - worldsize / 2, worldsize / 2 - point[1]];
};

var muToXYPoint = function(mu, worldsize) {
  return centerPointToTopLeftPoint([Math.round(mu.e(1,1)),
                                   Math.round(mu.e(4,1))],
                                   worldsize);
};

var xYColToPoint = function(mu, worldsize) {
  return centerPointToTopLeftPoint([Math.round(mu.e(1,1)),
                                   Math.round(mu.e(2,1))],
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

module.exports = {
  F: F,
  muToXYCol: muToXYCol,
  xYColToPoint: xYColToPoint,
  pointToXYCol: pointToXYCol,
  getXYSigma: getXYSigma,
  normalDistrobution: normalDistrobution,
};
