'use strict';

var BZRClient = require('bzrflag-client'),
    async = require('async'),
    pf = require('../lib/potential-fields'),
    smallestCircle = require('../lib/smallest-circle'),
    http = require('http'),
    fs = require('fs');


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
                //console.log(constants);
                me.constants.worldsize = parseInt(me.constants.worldsize, 10);
                me.coveringFields = pf.generateCoveringFields(me.constants.worldsize, 100);
                me.gridFilter = createArray(me.constants.worldsize, me.constants.worldsize);
                fillArray(me.gridFilter, 0.5);
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
                    me.myTanks[tank.index].lastVelError = 0;
                    me.myTanks[tank.index].lastAngleError = 0;
                    me.myTanks[tank.index].vx = 0;
                    me.myTanks[tank.index].vy = 0;
                    me.myTanks[tank.index].currentFieldIndex = 1;
                    me.myTanks[tank.index].fieldRotationIncrement = 1;
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

Team.prototype.getFields = function(tank) {
    var me = this;
    var hasFlag = tank.flag != '-';

    var fields = [];

    fields.push(this.coveringFields[tank.currentFieldIndex]);


    return fields;
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
            async.each(Object.keys(me.myTanks),
                            function(tankIndex, callback) {
                                client.getOccgrid(tankIndex, function(occGrid, time) {
                                    me.myTanks[tankIndex].occGrid = occGrid;
                                    callback();
                                });
                            },
                            function() {
                                callback();
                            });
        }],
        function() {
            done(dt);
        });
};

Team.prototype.start = function() {
    var me = this;

    var tickSpeed = 500; // -1 means tick as fast as possible
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

function createArray(length) {
    var arr = new Array(length || 0),
    i = length;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length-1 - i] = createArray.apply(this, args);
    }

    return arr;
}

function fillArray(arr, fill) {
    for(var i = 0; i < arr.length; i++) {
        var type = typeof(arr[i]);
        if(type === 'undefined') {
            arr[i] = fill;
        } else if(type === 'object') {
            fillArray(arr[i], fill);
        }
    }
}

Team.prototype.measurementProbability = function(observation, state) {
    if(state === 1) {
        if(observation === 1) {
            return this.constants.truepositive;
        } else {
            return 1 - this.constants.truepositive;
        }
    } else {
        if(observation === 0) {
            return this.constants.truenegative;
        } else {
            return 1- this.constants.truenegative;
        }
    }
};


Team.prototype.processOccgrid = function(occGrid) {
    //console.log(occGrid.pos);
    //console.log(occGrid.size);
    for(var x = 0; x < occGrid.size.x; x++) {
        for(var y = 0; y < occGrid.size.y; y++) {
            var gridX = occGrid.pos.x + x + 400;
            var gridY = occGrid.pos.y + y + 400;
            var observation = occGrid.grid[y][x];
            // Our state doesn't change so we don't have a state transition
            // I will just use the probability as the prodiction
            var belief_true = this.measurementProbability(observation, 1) * this.gridFilter[gridX][gridY];
            var belief_false = this.measurementProbability(observation, 0) * (1 - this.gridFilter[gridX][gridY]);
            var normalizer = 1 / (belief_true + belief_false);
            this.gridFilter[gridX][gridY] = belief_true * normalizer;
        }
    }
};


Team.prototype.tick = function(callback) {
    var me = this;
    var origin = [0, 0];
    this.update(function(dt){
        //console.log('World updated after ' + dt + ' seconds');
        if(dt === 0) {
            console.log('Zero dt, changing to small value');
            dt = 0.0001;
        }

        for(var tankIndex in me.myTanks) {
            //console.log('Updating tank ' + tankIndex + ':');
            var tank = me.myTanks[tankIndex];
            //console.log(JSON.stringify(tank));
            //console.log(tank.loc);
            var tankvxy = [tank.vx, tank.vy];
            //console.log('\ttankvxy: ' + JSON.stringify(tankvxy));
            var tanksFields = me.getFields(tank);
            //console.log(JSON.stringify(tanksFields));
            var tankLoc = [tank.loc.x, tank.loc.y];
            var pfdxy = pf.gradient(tankLoc, tanksFields);
            //console.log('\tpfdxy: ' + JSON.stringify(pfdxy));

            if(tankvxy[0] === 0 && tankvxy[1] === 0) {
                me.client.speed(tankIndex, 1);
            }

            // angle pd
            var goalAngle = pf.angle(pfdxy, origin);
            //console.log('\tgoalAngle: ' + goalAngle);
            var actualAngle = pf.angle(tankvxy, origin);
            //console.log('\tactualAngle: ' + actualAngle);
            var angleError = pf.normalizeAngle(goalAngle - actualAngle);
            //console.log('\tangleError: ' + angleError + '; lastAngleError: ' + tank.lastAngleError);
            var newAngleVel = pf.pdControllerError(angleError, tank.lastAngleError, dt, 0.5, 0.01);
            //console.log('\tnewAngleVel: ' + newAngleVel);
            tank.lastAngleError = angleError;
            me.client.angvel(tankIndex, newAngleVel);

            // Update Field if we have reached field
            var currentField = me.coveringFields[tank.currentFieldIndex];
            var distanceToField = pf.distance(tankLoc, currentField.location);
            //console.log("Distance to goal field: " + distanceToField);
            if(distanceToField < 50) {
                tank.currentFieldIndex += tank.fieldRotationIncrement;
            }


            me.processOccgrid(tank.occGrid);

            if(tank.shotsAvailable > 0) {
                me.client.shoot(tankIndex);
            }
        }
        callback();
    });
};


if(process.argv.length > 2) {
    var port = process.argv[2];
    console.log('Starting');
    new Team(new BZRClient(port)).init(function(team) {
        team.start();
        http.createServer(function (req, res) {
            if(req.url == '/') {
                console.log("HTML requested");
                fs.readFile('./visualize_grid_filter.html', 'utf8', function (err,data) {
                    if (err) {
                        return console.log(err);
                    }
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    res.end(data);
                    console.log("Delivered HTML");
                });
            } else if(req.url == '/data.json') {
                console.log("JSON requested");
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(team.gridFilter));
                console.log("Delivered JSON");
            } else {
                console.log("Unknown url requested: " + req.url);
            }
        }).listen(8080);
    });
} else {
  console.log("Please specify port number to connect to.");
}
