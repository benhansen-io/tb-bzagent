'use strict';

var BZRClient = require('bzrflag-client'),
    async = require('async'),
    pf = require('../lib/potential-fields'),
    smallestCircle = require('../lib/smallest-circle');


/**
 * Note: This is just a sample team where all of the tanks on a team
 * are controlled with simple directions
 * 1. if there is an enemy flag that is not picked up, go get it.
 * 2. if you have a flag go back to your base
 * 3. otherwise go attack the closest enemy
 *
 * It should be a good starting point to see how the client is used.
 *
 * To use it just run:
 *    node agent.js <port>
 */

function Team(client){
    this.client = client;
    this.myTanks = {};
    this.init();
}

Team.prototype.init = function() {
    var me = this;
    this.client.getConstants(function(constants){
        me.constants = constants;
    });
    this.client.getBases(function(bases){
        me.bases = bases;
    });
    this.client.getMyTanks(function(myTanks, time){
        myTanks.forEach(function(tank){
            me.myTanks[tank.index] = tank;
            me.myTanks[tank.index].lastVelError = 0;
            me.myTanks[tank.index].lastAngleError = 0;
            me.myTanks[tank.index].vx = 0;
            me.myTanks[tank.index].vy = 0;
            me.lastUpdated = time;
        });
    });
    this.client.getObstacles(function(obstacles) {
        me.obstacles = obstacles;
    });
};

Team.prototype.getFields = function() {
    var me = this;

    var obstacles = this.obstacles.map(function(points) {
        var circle = smallestCircle(points);
        return {
            location: [circle.x, circle.y],
            radius: circle.r,
            spread: 5,
            type: 'avoid'
        };
    });

    var flags = this.flags.map(function(flag) {
        if (flag.color === me.constants.team)
            return null;

        return {
            location: [flag.loc.x, flag.loc.y],
            radius: 1,
            spread: 100,
            type: 'seek'
        };
    }).filter(function(field) { return field; });

    return obstacles.concat(flags);
};

Team.prototype.update = function(done) {
    var me = this;
    var client = this.client;
    var callsToMake = 4;
    var dt = 0;
    function received(){
        callsToMake--;
        if(callsToMake === 0)
            done(dt);
    }
    client.getMyTanks(function(myTanks, time){
        dt = time-me.lastUpdated;
        myTanks.forEach(function(tank){
            var lastVelError = me.myTanks[tank.index].lastVelError;
            var lastAngleError = me.myTanks[tank.index].lastAngleError;
            me.myTanks[tank.index] = tank;
            me.myTanks[tank.index].lastVelError = lastVelError;
            me.myTanks[tank.index].lastAngleError = lastAngleError;
        });

        me.lastUpdated = time;
        received();
    });
    client.getOtherTanks(function(otherTanks){
        me.otherTanks = otherTanks;
        me.enemies = otherTanks.filter(function(tank){
            return tank.color != me.constants.team;
        });
        received();
    });
    client.getFlags(function(flags){
        me.flags = flags;
        received();
    });
    client.getShots(function(shots){
        me.shots = shots;
        received();
    });
};

Team.prototype.start = function() {
    var me = this;

    async.whilst(function() {return true;},
                 function(callback) {
                     async.series([
                         me.tick.bind(me),
                         //function(callback) {setTimeout(callback, 10000);},
                     ],
                     callback);
                 });
};

Team.prototype.tick = function(callback) {
    var me = this;
    var origin = [0, 0];
    this.update(function(dt){
        console.log('World updated after ' + dt + ' seconds');
        if(dt === 0) {
            console.log('Zero dt, changing to small value');
            dt = 0.0001;
        }
        for(var tankIndex in me.myTanks) {
            console.log('Updating tank ' + tankIndex + ':');
            var tank = me.myTanks[tankIndex];
            var tankvxy = [tank.vx, tank.vy];
            console.log('\ttankvxy: ' + JSON.stringify(tankvxy));
            var pfdxy = pf.gradient([tank.loc.x, tank.loc.y], me.getFields());
            console.log('\tpfdxy: ' + JSON.stringify(pfdxy));

            // velocity pd
            var goalVel = pf.distance(pfdxy, origin);
            console.log('\tgoalVel: ' + goalVel);
            var actualVel = pf.distance(tankvxy, origin);
            console.log('\tactualVel: ' + actualVel);
            var velError = goalVel - actualVel;
            console.log('\tvelError: ' + velError + '; lastVelError: ' + tank.lastVelError);
            var newVel = pf.pdControllerError(velError, tank.lastVelError, dt);
            console.log('\tnewVel: ' + newVel);
            tank.lastVelError = velError;
            me.client.speed(tankIndex, newVel);

            // angle pd
            var goalAngle = pf.angle(pfdxy, origin);
            console.log('\tgoalAngle: ' + goalAngle);
            var actualAngle = pf.angle(tankvxy, origin);
            console.log('\tactualAngle: ' + actualAngle);
            var angleError = pf.normalizeAngle(goalAngle - actualAngle);
            console.log('\tangleError: ' + angleError + '; lastAngleError: ' + tank.lastAngleError);
            var newAngleVel = pf.pdControllerError(angleError, tank.lastAngleError, dt);
            console.log('\tnewAngleVel: ' + newAngleVel);
            tank.lastAngleError = angleError;
            me.client.angvel(tankIndex, newAngleVel);
        }
        callback();
    });
};


if(process.argv.length > 2){
    var port = process.argv[2];
    var team = new Team(new BZRClient(port));
    console.log('Starting');
    team.start();
}
