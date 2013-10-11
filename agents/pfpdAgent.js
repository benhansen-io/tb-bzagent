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

Team.prototype.getFields = function(tank) {
    var me = this;
    var hasFlag = tank.flag != '-';

    var fields = [];

    var obstacles = this.obstacles.map(function(points) {
        var circle = smallestCircle(points);
        return {
            location: [circle.x, circle.y],
            radius: circle.r,
            spread: 50,
            type: 'avoid'
        };
    });
    fields = fields.concat(obstacles);

    var teamMatesWithFlags = [];
    for(var tankIndex in me.myTanks) {
        var otherTank = me.myTanks[tankIndex];
        if(tankIndex == tank.index) {
            continue;
        }
        if(otherTank.flag == '-') {
            continue;
        }
        teamMatesWithFlags.push({
            location: [otherTank.x, otherTank.y],
            radius: 2,
            spread: 10,
            type: 'avoid'
        });
    }
    fields = fields.concat(teamMatesWithFlags);


    if(!hasFlag) {
        var flags = this.flags.map(function(flag) {
            //console.log(JSON.stringify(flag));
            if (flag.color === me.constants.team ||
                flag.possessionColor === me.constants.team)
                return null;

            return {
                location: [flag.loc.x, flag.loc.y],
                radius: 1,
                spread: 100,
                type: 'seek'
            };
        }).filter(function(field) { return field; });
        fields = fields.concat(flags);
    }

    if(hasFlag) {
        var cornersToLocation = function(corners) {
            var sumX = 0;
            var sumY = 0;
            corners.forEach(function(corner) {
                sumX += corner.x;
                sumY += corner.y;
            });
            return [sumX / corners.length, sumY / corners.length];
        };

        var bases = this.bases.map(function(base) {
            //console.log(JSON.stringify(base));
            if (base.color === me.constants.team) {
                return {
                    location: cornersToLocation(base.corners),
                    radius: 1,
                    spread: 100,
                    type: 'seek'
                };
            } else {
                return null;
            }
        }).filter(function(field) { return field; });
        fields = fields.concat(bases);
    }

    return fields;
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
                         //function(callback) {setTimeout(callback, 2000);},
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
            //console.log(JSON.stringify(tank));
            var tankvxy = [tank.vx, tank.vy];
            console.log('\ttankvxy: ' + JSON.stringify(tankvxy));
            var tanksFields = me.getFields(tank);
            //console.log(JSON.stringify(tanksFields));
            var pfdxy = pf.gradient([tank.loc.x, tank.loc.y], tanksFields);
            console.log('\tpfdxy: ' + JSON.stringify(pfdxy));

            // velocity pd
            var goalVel = pf.distance(pfdxy, origin);
            console.log('\tgoalVel: ' + goalVel);
            var actualVel = pf.distance(tankvxy, origin);
            console.log('\tactualVel: ' + actualVel);
            var velError = goalVel - actualVel;
            console.log('\tvelError: ' + velError + '; lastVelError: ' + tank.lastVelError);
            var newVel = actualVel + pf.pdControllerError(velError, tank.lastVelError, dt, 0.3, 0.1);
            if(newVel < 0) {
                newVel = 0;
            }
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
            var newAngleVel = pf.pdControllerError(angleError, tank.lastAngleError, dt, 0.5, 0.01);
            console.log('\tnewAngleVel: ' + newAngleVel);
            tank.lastAngleError = angleError;
            me.client.angvel(tankIndex, newAngleVel);

            if(tank.shotsAvailable > 0) {
                me.client.shoot(tankIndex);
            }
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
