'use strict';

var _ = require('underscore');
var async = require('async');
var sylvester = require("sylvester");
var Matrix = sylvester.Matrix;
var BZRClient = require('bzrflag-client');
var pf = require('../lib/potential-fields');
var physics = require('../lib/physics');
var kalman = require('../lib/kalman_filter');
var graphsServer = require('../lib/graphsServer');


/**
 * To use it just run:
 *    node agent.js <port>
 */

function Team(client){
  this.client = client;
  this.myTanks = {};
}

var constants;

Team.prototype.init = function(callback) {
  var me = this;
  async.parallel([
    function(callback) {
    me.client.getConstants(function(constants) {
      me.constants = constants;
      me.constants.worldsize = parseInt(me.constants.worldsize, 10);
      me.constants.friction = 0.0;
      callback();
    });
  },
  function(callback) {
    me.client.getMyTanks(function(myTanks, time){
      myTanks.forEach(function(tank){
        tank.lastAngleError = 0;
        me.myTanks[tank.index] = tank;
      });
      me.lastUpdated = time;
      callback();
    });
  },
  function(callback) {
    me.client.getOtherTanks(function(otherTanks){
      var enemies = otherTanks.filter(function(tank){
        return tank.color != me.constants.team;
      });
      me.enemies = {};
      enemies.forEach(function(enemy) {
        var callsign = enemy.callsign;
        enemy.mu = kalman.initialMu;
        enemy.sigma = kalman.initialSigma;
        me.enemies[callsign] = enemy;
      });
      callback();
    });
  }],
  function() {
    if(callback) {
      callback(me);
    }
  });
};

Team.prototype.update = function(done) {
  var me = this;
  var client = this.client;
  var dt = 0;
  async.series([
    function(callback) {
    client.getMyTanks(function(myTanks, time){
      dt = time - me.lastUpdated;
      myTanks.forEach(function(tank){
        me.myTanks[tank.index] = _.extend(me.myTanks[tank.index], tank);
      });
      me.lastUpdated = time;
      callback();
    });
  },
  function(callback) {
    client.getOtherTanks(function(otherTanks){
      me.otherTanks = otherTanks;
      var enemies = otherTanks.filter(function(tank){
        return tank.color != me.constants.team;
      });

      enemies.forEach(function(updatedEnemy) {
        var callsign = updatedEnemy.callsign;
        var outofdateEnemy = me.enemies[callsign];
        me.enemies[callsign] =
          _.extend(outofdateEnemy, updatedEnemy);
      });

      callback();
    });
  }],
  function() {
    done(dt);
  });
};


Team.prototype.start = function() {
  var me = this;

  var tickSpeed = 100; // -1 means tick as fast as possible
  var start = 0;

  async.whilst(function() {return true;},
               function(callback) {
                 async.series([
                   function(callback) { start = new Date().getTime(); callback();},
                   me.tick.bind(me),
                   function(callback) {
                     var elapsed = new Date().getTime() - start;
                     if(elapsed > tickSpeed) {
                       if(tickSpeed != -1) {
                         console.log('Missed tick by ' + (elapsed - tickSpeed) + ' milliseconds.');
                       }
                       callback();
                     } else {
                       setTimeout(callback, tickSpeed - elapsed);
                     }
                   },
                 ],
                 callback);
               });
};

function sign(number) {
    return number < 0 ? -1 : 1;
}

var tickCount = 0;
Team.prototype.tick = function(callback) {
  tickCount++;
  var me = this;
  this.update(function(dt){
    //console.log('World updated after ' + dt + ' seconds');

    for(var callsign in me.enemies) {
      var otherTank = me.enemies[callsign];
      if(otherTank.status != 'alive') {
        otherTank.mu = kalman.initialMu;
        otherTank.sigma = kalman.initialSigma;
        continue;
      }
      var observation = Matrix.create([
        [otherTank.loc.x],
        [otherTank.loc.y]]);
        var updatedVals = kalman.updateKalman(otherTank.mu,
                                              otherTank.sigma,
                                              observation,
                                              dt,
                                              me.constants.friction);
                                              otherTank.mu = updatedVals.mu;
                                              otherTank.sigma = updatedVals.sigma;
    }

    for(var tankIndex in me.myTanks) {
      //console.log('Updating tank ' + tankIndex + ':');
      var tank = me.myTanks[tankIndex];
      var tankLoc = [tank.loc.x, tank.loc.y];
      var targetEnemy = me.enemies[Object.keys(me.enemies)[0]];

      // angle pd
      var goalAngle = physics.findAngleForImpact(targetEnemy.mu,
                                                 tankLoc,
                                                 me.constants.shotspeed,
                                                 me.constants.friction);

       var actualAngle = tank.angle;
       var angleError = pf.normalizeAngle(goalAngle - actualAngle);
       var pdAngVel = pf.pdControllerError(angleError, tank.lastAngleError, dt, 1, 0.05);
       tank.lastAngleError = angleError;

       // We might want to change the angular velocity based on the expected movement of tank
       var timeInFutureToPredict = 0.3;
       var radiansPerSecondToAngVel = 1 / (Math.PI * 2 / 8); // 8 seconds for a rotation
       var currentPoint = physics.muToCenterPoint(targetEnemy.mu);
       var currentAngle = pf.angle(tankLoc, currentPoint);
       var futurePoint = physics.muToCenterPoint(physics.F(timeInFutureToPredict, me.constants.friction).x(targetEnemy.mu));
       var futureAngle = pf.angle(tankLoc, futurePoint);

       var angleDiff = pf.normalizeAngle(futureAngle - currentAngle);
       var neededTankMatchAngVel = angleDiff / timeInFutureToPredict * radiansPerSecondToAngVel;
       var newAngVel = pdAngVel;
       if(sign(pdAngVel) === sign(neededTankMatchAngVel)) {
         if(Math.abs(neededTankMatchAngVel) > Math.abs(pdAngVel)) {
           console.log('using tankMatch difference of ' + (neededTankMatchAngVel - pdAngVel));
           newAngVel = neededTankMatchAngVel;
         }
       }



       me.client.angvel(tankIndex, newAngVel);

       if(angleError < 0.05) {
         if(tank.shotsAvailable > 0) {
           me.client.shoot(tankIndex);
         }
       }

                                                 //me.client.shoot(tankIndex);
    }
    callback();
  });
};


if(process.argv.length > 2) {
  var port = process.argv[2];
  console.log('Starting');
  new Team(new BZRClient(port)).init(function(team) {
    team.start();
    graphsServer.start(team);
  });
} else {
  console.log('Please specify port number to connect to.');
}
