var _ = require('underscore');
var BZRClient = require('bzrflag-client');
var async = require('async');
var pf = require('../lib/potential-fields');


/**
 * To use it just run:
 *    node agent.js <port>
 */

function Team(client){
    this.client = client;
    this.myTanks = {};
    this.init();
}

Team.prototype.init = function(callback) {
    var me = this;
    async.parallel([
        function(callback) {
            me.client.getConstants(function(constants) {
                me.constants = constants;
                me.constants.worldsize = parseInt(me.constants.worldsize, 10);
                me.constants.friction = 0.1;
                callback();
            });
        },
        function(callback) {
            me.client.getMyTanks(function(myTanks, time){
                myTanks.forEach(function(tank){
                    tank.turning = false;
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
                    me.myTanks[tank.index] = _.extend(me.myTanks[tank.index], tank);
                });
                me.lastUpdated = time;
                callback();
            });
        },
        function() {
            done(dt);
        }]);
};


Team.prototype.start = function() {
    var me = this;

    me.startTanks(function() {
        me.setRandomInitalAngle();
        async.whilst(function() {return true;},
                     function(callback) {
                         async.series([
                             function(callback) {setTimeout(callback, 1000);},
                             //me.stopTanks.bind(me),
                             me.tick.bind(me),
                         ],
                         callback);
                     });
    });
};

Team.prototype.startTanks = function(callback) {
    //console.log('Starting tanks');
    var me = this;
    this.update(function(){
        async.each(Object.keys(me.myTanks), function(tankIndex, callback) {
            me.client.speed(tankIndex, 1, function() {callback();});
        }, callback);
    });
};

Team.prototype.setRandomInitalAngle = function(callback) {
    //console.log('Setting random angle');
    var me = this;
    this.update(function(){
        async.each(Object.keys(me.myTanks), function(tankIndex, callback) {
            var randomAngle = getRandomArbitary(-Math.PI, Math.PI);
            me.myTanks[tankIndex].goalAngle = randomAngle;
            me.turnTank(tankIndex, randomAngle);
            callback();
        }, callback);
    });
};

var getRandomArbitary = function(min, max) {
    return Math.random() * (max - min) + min;
};

Team.prototype.tick = function(callback) {
    var me = this;
    me.update(function(dt) {
        async.each(Object.keys(me.myTanks), function(tankIndex, callback) {
            var tank = me.myTanks[tankIndex];
            //console.log("loc", tank.loc);
            me.bounceTankIfAtWall(tankIndex);
            if(tank.turning === false &&
               Math.abs(pf.normalizeAngle(tank.goalAngle - tank.angle)) > Math.PI / 8) {
                tank.turning = true;
                me.turnTank(tankIndex, tank.goalAngle, function() {
                    tank.turning = false;
                });
            }
            callback();
        }, callback);
    });
};

Team.prototype.bounceTankIfAtWall = function(tankIndex) {
    var me = this;
    var tank = me.myTanks[tankIndex];
    var size = me.constants.worldsize / 2;
    if(Math.abs(tank.loc.x) > size * 0.97) {
        var movingLeft = Math.abs(tank.goalAngle) > Math.PI / 2;
        var atLeftBorder = sign(tank.loc.x) === -1;
        if(movingLeft === atLeftBorder) {
            tank.goalAngle = sign(tank.goalAngle) * (Math.PI - Math.abs(tank.goalAngle));
        }
    } else if(Math.abs(tank.loc.y) > size * 0.97) {
        var movingUp = sign(tank.goalAngle) === 1;
        var atTop = sign(tank.loc.y) === 1;
        if(movingUp === atTop) {
            tank.goalAngle = -1 * tank.goalAngle;
        }
    }
};

var sign = function(number) {
    return number?number<0?-1:1:0;
};

Team.prototype.turnTank = function(tankIndex, goalAngle, callback, lastAngle) {
    var me = this;
    this.update(function(){
        var tank = me.myTanks[tankIndex];
        var actualAngle = tank.angle;
        if(Math.abs(actualAngle - goalAngle) < 0.1) {
            me.client.angvel(tankIndex, 0, function () {
                if(callback) {
                    callback();
                }
            });
        } else {
            var dt = 500;
            var angleError = pf.normalizeAngle(goalAngle - actualAngle);
            //console.log('\tangleError: ' + angleError + '; lastAngleError: ' + tank.lastAngleError);
            var newAngleVel = pf.pdControllerError(angleError, tank.lastAngleError, dt, 1, 0.01);
            //console.log('Turning tank ' + tankIndex + ' at rate of ' + newAngleVel + '. goalAngle: ' + goalAngle + ', actualAngle: ' + actualAngle + ', lastAngle: ' + lastAngle);
            //console.log('\tnewAngleVel: ' + newAngleVel);
            tank.lastAngleError = angleError;
            me.client.angvel(tankIndex, newAngleVel, function () {
                setTimeout(me.turnTank.bind(me, tankIndex, goalAngle, callback, actualAngle), dt);
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
