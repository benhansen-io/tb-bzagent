var physics = require('./lib/physics');
var sylvester = require('sylvester');
var Matrix = sylvester.Matrix;
var _ = require('underscore');


var canvas = document.getElementById('chart');
var ctx = canvas.getContext('2d');


var retrieveData = function(callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/kalman_data.json', true);
  xhr.onload = function (e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        data = JSON.parse(xhr.responseText);
        Object.keys(data.enemies).forEach(function(callsign) {
          data.enemies[callsign].mu = Matrix.create(data.enemies[callsign].mu);
          data.enemies[callsign].sigma = Matrix.create(data.enemies[callsign].sigma);
        });
        callback(null, data);
      } else {
        console.error(xhr.statusText);
        callback(xhr.statusText);
      }
    }
  };
  xhr.onerror = function (e) {
    console.error(xhr.statusText);
  };
  xhr.send(null);
};

var dataPoints = [];

var updateData = function() {
  console.log('Updating data');
  retrieveData(function(err, data) {
    if(err) {
      console.log(err);
      return;
    }
    dataPoints.push(data);
  });
};

var range = function(len) {
  var arr = [];
  for(var i = 1; i <= len; i++) {
    arr.push(i);
  }
  return arr;
};

var trackingEnemy = 'red0';
var updateGraph = function() {
  console.log('Updating graph');
  var xData = _.map(dataPoints, function(dataPoint) {
    console.log(dataPoint);
    return dataPoint.enemies[trackingEnemy].mu.e(1,1);
  });
  var yData = _.map(dataPoints, function(dataPoint) {
    return dataPoint.enemies[trackingEnemy].mu.e(4,1);
  });
  console.log(xData);
  var graphData = {

    labels : range(dataPoints.length),
    datasets : [
      {
      fillColor : "rgba(220,220,220,0.5)",
      strokeColor : "rgba(220,220,220,1)",
      pointColor : "rgba(220,220,220,1)",
      pointStrokeColor : "#fff",
      data : xData,
    },
    {
      fillColor : "rgba(151,187,205,0.5)",
      strokeColor : "rgba(151,187,205,1)",
      pointColor : "rgba(151,187,205,1)",
      pointStrokeColor : "#fff",
      data : yData,
    }
    ]
  };
  new Chart(ctx).Line(graphData,{animation : false,});
};

setInterval(function() {updateData(); updateGraph();}, 1000);
updateGraph();
