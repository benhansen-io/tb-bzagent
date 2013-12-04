var sylvester = require("sylvester");
var Matrix = sylvester.Matrix;
var physics = require("./physics");

var sigmaX = function(dt) {
  var pos = 0 * dt;
  var vel = 5.0 * dt;
  var acc = 0.01 * dt;
  return Matrix.create([
    [pos, 0, 0, 0, 0, 0],
    [0, vel, 0, 0, 0, 0],
    [0, 0, acc, 0, 0, 0],
    [0, 0, 0, pos, 0, 0],
    [0, 0, 0, 0, vel, 0],
    [0, 0, 0, 0, 0, acc]]);
};

var H = Matrix.create([
  [1, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0]]);

var HTranspose = H.transpose();

var noise = 20;
var sigmaZ = Matrix.create([
  [Math.pow(noise, 2), 0],
  [0, Math.pow(noise, 2)]]);

var updateKalman = function(lastMu, lastSigma, observation, dt, frictionConstant) {
  var F = physics.F(dt, frictionConstant);
  var FTranspose = F.transpose();
  var sigmaPrediction = F.x(lastSigma).x(FTranspose).add(sigmaX(dt));

  var modelUncertainty = sigmaPrediction.x(HTranspose);
  var observationUncertainty = H.x(sigmaPrediction).x(HTranspose).add(sigmaZ);
  var K = modelUncertainty.x(observationUncertainty.inverse());

  var meanObservationAdjustment = K.x(observation.subtract(H.x(F).x(lastMu)));
  var nextMu = F.x(lastMu).add(meanObservationAdjustment);

  var nextSigma = (Matrix.I(6).subtract(K.x(H))).x(sigmaPrediction);

  return {
    mu: nextMu,
    sigma: nextSigma
  };
};

var initialMu = Matrix.create([
  [0],
  [0],
  [0],
  [0],
  [0],
  [0]]);

var initialSigma = Matrix.create([
  [100, 0, 0, 0, 0, 0],
  [0, 0.1, 0, 0, 0, 0],
  [0, 0, 0.1, 0, 0, 0],
  [0, 0, 0, 100, 0, 0],
  [0, 0, 0, 0, 0.1, 0],
  [0, 0, 0, 0, 0, 0.1]]);

module.exports = {
  updateKalman: updateKalman,
  initialMu: initialMu,
  initialSigma: initialSigma
};
