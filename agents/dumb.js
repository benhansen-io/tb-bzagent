var BZRClient = require('bzrflag-client');
var async = require('async');
var pf = require('../lib/potential-fields');


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
            me.lastUpdated = time;
        });
    });
};

Team.prototype.update = function(done) {
    var me = this;
    var client = this.client;
    var callsToMake = 4;
    function received(){
        callsToMake--;
        if(callsToMake === 0)
            done();
    }
    client.getMyTanks(function(myTanks, time){
        var dt = time-me.lastUpdated;
        myTanks.forEach(function(tank){
            var dvx = (tank.vx - me.myTanks[tank.index].vx)/dt;
            var dvy = (tank.vy - me.myTanks[tank.index].vy)/dt;
            var dangvel = (tank.angvel - me.myTanks[tank.index].angvel)/dt;
            me.myTanks[tank.index] = tank;
            me.myTanks[tank.index].dvx = dvx;
            me.myTanks[tank.index].dvy = dvy;
            me.myTanks[tank.index].dangvel = dangvel;
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
                         me.haveTanksShootRandomly.bind(me),
                         me.startTanks.bind(me),
                         function(callback) {console.log('Waiting'); setTimeout(callback, 8000);},
                         me.stopTanks.bind(me),
                         me.turnTanks.bind(me),
                     ],
                     callback);
                 });
};

Team.prototype.startTanks = function(callback) {
    console.log('Starting tanks');
    var me = this;
    this.update(function(){
        async.each(Object.keys(me.myTanks), function(tankIndex, callback) {
            me.client.speed(tankIndex, 1, function() {callback();});
        }, callback);
    });
};

Team.prototype.haveTanksShootRandomly = function(callback) {
    var me = this;
    this.update(function(){
        for(var tankIndex in me.myTanks) {
            if (me.myTanks.hasOwnProperty(tankIndex)) {
                console.log('setting interval');
                setInterval(me.client.shoot.bind(me.client, tankIndex), Math.random() * 1000 + 1500);
            }
        }
        console.log('done setting intervals');
        if(callback) {
            callback();
        }
    });
};

Team.prototype.stopTanks = function(callback) {
    console.log('Stopping tanks');
    var me = this;
    this.update(function(){
        async.each(Object.keys(me.myTanks), function(tankIndex, callback) {
            me.client.speed(tankIndex, 0, function() {callback();});
        }, callback);
    });
};



Team.prototype.turnTanks = function(callback) {
    console.log('Turning tanks');
    var me = this;
    this.update(function(){
        async.each(Object.keys(me.myTanks), function(tankIndex, callback) {
            var tank = me.myTanks[tankIndex];
            var turnAmount = 3.14 / 3;
            var goalAngle = pf.normalizeAngle(turnAmount + tank.angle);
            me.turnTank(tankIndex, goalAngle, callback);
        }, callback);
    });
};

Team.prototype.turnTank = function(tankIndex, goalAngle, callback, lastAngle) {
    var me = this;
    this.update(function(){
        var actualAngle = me.myTanks[tankIndex].angle;
        if(Math.abs(actualAngle - goalAngle) < 0.1) {
            console.log('Tank ' + tankIndex + ' is done turning');
            me.client.angvel(tankIndex, 0, function () {
                if(callback) {
                    callback();
                }
            });
        } else {
            var acceleration = pf.pdController(goalAngle, actualAngle, goalAngle, lastAngle, 0.5);
            console.log('Turning tank ' + tankIndex + ' at rate of ' + acceleration + '. goalAngle: ' + goalAngle + ', actualAngle: ' + actualAngle + ', lastAngle: ' + lastAngle);
            me.client.angvel(tankIndex, acceleration, function () {
                setTimeout(me.turnTank.bind(me, tankIndex, goalAngle, callback, actualAngle), 500);
            });
        }
    });
};

if(process.argv.length > 2){
    var port = process.argv[2];
    var team = new Team(new BZRClient(port));
    console.log('Starting');
    team.start();
}
