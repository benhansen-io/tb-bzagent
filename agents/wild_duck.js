var _ = require('underscore');
var BZRClient = require('bzrflag-client');
var async = require('async');
var pf = require('../lib/potential-fields');
var readline = require('readline');


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
      me.kp = 1;
      me.kd = 0.1;
      callback();
    });
  },
  function(callback) {
    me.client.getMyTanks(function(myTanks, time){
      myTanks.forEach(function(tank){
        tank.turning = false;
        tank.wasDead = true;
        tank.lastAngleError = Math.PI;
        me.myTanks[tank.index] = tank;
      });
      me.lastUpdated = time;
      callback();
    });
  },
  function intializeUserInput(callback) {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    async.whilst(function() {return true;},
                 function(callback) {
                   rl.question("", function(answer) {
                     eval(answer);
                     callback();
                   });
                 });
     callback();
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

  console.log('Starting 2');
  console.log(Object.keys(me.myTanks));
  async.each(Object.keys(me.myTanks), function(tankIndex, callback) {
    console.log('Inside');
    setInterval(me.setRandomInitalAngle.bind(me, tankIndex), 5000);
    setInterval(me.setRandomSpeed.bind(me, tankIndex), 4000);
  });

  async.whilst(function() {return true;},
               function(callback) {
                 async.series([
                   function(callback) {setTimeout(callback, 1000);},
                   //me.stopTanks.bind(me),
                   me.tick.bind(me),
                 ],
                 callback);
               });
};

Team.prototype.startTank = function(tankIndex, callback) {
  var me = this;
  me.client.speed(tankIndex, 1, function() {if(callback) callback();});
};

Team.prototype.setRandomSpeed = function(tankIndex, callback) {
  var me = this;
  var randomSpeed = getRandomArbitary(0, 1);
  console.log('Setting random speed: ' + randomSpeed);
  me.client.speed(tankIndex, randomSpeed, function() {if(callback) callback();});
};

Team.prototype.setRandomInitalAngle = function(tankIndex, callback) {
  var me = this;
  var randomAngle = getRandomArbitary(-Math.PI, Math.PI);
  me.myTanks[tankIndex].goalAngle = randomAngle;
  me.turnTank(tankIndex, randomAngle, callback);
};

var getRandomArbitary = function(min, max) {
  return Math.random() * (max - min) + min;
};

Team.prototype.tick = function(callback) {
  var me = this;
  me.update(function(dt) {
    async.each(Object.keys(me.myTanks), function(tankIndex, callback) {
      var tank = me.myTanks[tankIndex];
      if(tank.status != 'alive') {
        console.log(tankIndex + ' died.');
        tank.wasDead = true;
      } else {
        if(tank.wasDead) {
          console.log(tankIndex + ' reborn.');
          me.setRandomInitalAngle(tankIndex);
          me.startTank(tankIndex);
          tank.wasDead = false;
        }
      }

      //console.log(tank.goalAngle);
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

Team.prototype.turnTank = function(tankIndex, goalAngle, callback) {
  var me = this;
  this.update(function(){
    var tank = me.myTanks[tankIndex];
    //console.log(tank);
    var actualAngle = tank.angle;
    var angleError = pf.normalizeAngle(goalAngle - actualAngle);
    if(Math.abs(angleError) < 0.05 && Math.abs(tank.angvel) < 0.05) {
      me.client.angvel(tankIndex, 0, function () {
        if(callback) {
          callback();
        }
      });
    } else {
      var dt = 500;
      var newAngleVel = pf.pdControllerError(angleError, tank.lastAngleError, dt, me.kp, me.kd);
      //console.log('newAngleVel: ' + newAngleVel);
      tank.lastAngleError = angleError;
      me.client.angvel(tankIndex, newAngleVel, function () {
        setTimeout(me.turnTank.bind(me, tankIndex, goalAngle, callback), dt);
      });
    }
  });
};

if(process.argv.length > 2){
  var port = process.argv[2];
  console.log('Starting');
  new Team(new BZRClient(port)).init(function(team) {
    team.start();
  });
}
