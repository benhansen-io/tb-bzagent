'use strict';

var async = require('async');
var BZRClient = require('bzrflag-client');
var pf = require('../lib/potential-fields');
var graphsServer = require('../lib/graphsServer');


/**
 * To use it just run:
 *    node agent.js <port>
 */

function Team(client){
    this.client = client;
    this.myTanks = {};
}

Team.prototype.init = function(callback) {
    var me = this;
    async.parallel([
        function(callback) {
            me.client.getConstants(function(constants) {
                me.constants = constants;
                me.constants.worldsize = parseInt(me.constants.worldsize, 10);
                callback();
            });
        },
        function(callback) {
            me.client.getBases(function(bases){
                me.bases = bases;
                callback();
            });
        },
        function(callback) {
            me.client.getMyTanks(function(myTanks, time){
                myTanks.forEach(function(tank){
                    me.myTanks[tank.index] = tank;
                    me.lastUpdated = time;
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
                    var lastVelError = me.myTanks[tank.index].lastVelError;
                    var lastAngleError = me.myTanks[tank.index].lastAngleError;
                    var currentFieldIndex = me.myTanks[tank.index].currentFieldIndex;
                    var fieldRotationIncrement = me.myTanks[tank.index].fieldRotationIncrement;
                    me.myTanks[tank.index] = tank;
                    me.myTanks[tank.index].lastVelError = lastVelError;
                    me.myTanks[tank.index].lastAngleError = lastAngleError;
                    me.myTanks[tank.index].currentFieldIndex = currentFieldIndex;
                    me.myTanks[tank.index].fieldRotationIncrement = fieldRotationIncrement;
                });
                me.lastUpdated = time;
                callback();
            });
        },
        function(callback) {
            client.getOtherTanks(function(otherTanks){
                me.otherTanks = otherTanks;
                me.enemies = otherTanks.filter(function(tank){
                    return tank.color != me.constants.team;
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

    var tickSpeed = -1; // -1 means tick as fast as possible
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
                                     console.log("Missed tick by " + (elapsed - tickSpeed) + " milliseconds.");
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

var tickCount = 0;
Team.prototype.tick = function(callback) {
    var me = this;
    this.update(function(dt){
        tickCount++;
        //console.log('World updated after ' + dt + ' seconds');

        for(var tankIndex in me.myTanks) {
            //console.log('Updating tank ' + tankIndex + ':');
            var tank = me.myTanks[tankIndex];

            // angle pd
            var goalAngle = 100; //TODO
            //console.log('\tgoalAngle: ' + goalAngle);
            var actualAngle = 100; //TODO
            //console.log('\tactualAngle: ' + actualAngle);
            var angleError = pf.normalizeAngle(goalAngle - actualAngle);
            //console.log('\tangleError: ' + angleError + '; lastAngleError: ' + tank.lastAngleError);
            var newAngleVel = pf.pdControllerError(angleError, tank.lastAngleError, dt, 1, 0.01);
            //console.log('\tnewAngleVel: ' + newAngleVel);
            tank.lastAngleError = angleError;
            me.client.angvel(tankIndex, newAngleVel);

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
  console.log("Please specify port number to connect to.");
}
