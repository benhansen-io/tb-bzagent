var physics = require('./lib/physics');
var sylvester = require('sylvester');
var Matrix = sylvester.Matrix;


var canvas = document.getElementById('grid');
var dataDiv = document.getElementById('data');
var refreshButton = document.getElementById('refresh');
var timePerStepField = document.getElementById('timePerStep');
var numStepsField = document.getElementById('numSteps');


var retrieveAndPaintData = function() {
  refreshButton.disabled = true;
  retrieveData(function(err, data) {
    data = JSON.parse(data);
    if(!err) {
      Object.keys(data.enemies).forEach(function(callsign) {
        data.enemies[callsign].mu = Matrix.create(data.enemies[callsign].mu);
        data.enemies[callsign].sigma = Matrix.create(data.enemies[callsign].sigma);
      });
      window._data = data;
      paintData(data);

      refreshButton.disabled = false;
      //console.log(data);
    }
  });
};

var retrieveData = function(callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/kalman_data.json', true);
  xhr.onload = function (e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(null, xhr.responseText);
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

var threshhold = 0.005;
var drawNormalDistrobution = function(ctx, xyCol, xySigma, worldsize) {
  // Make bigger and bigger squares around center until
  // no pixel was over the threshhold
  var distrobution = physics.normalDistrobution(xyCol, xySigma);
  var center = physics.xYColToPoint(xyCol, worldsize);

  var drawPoint = function(point) {
    var pointCol = physics.pointToXYCol(point, worldsize);
    var height = distrobution(pointCol);
    if(height > threshhold * maxHeight) {
      var shade = 255 - Math.round(height / maxHeight * 255);
      ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
      ctx.fillRect(point[0], point[1], 1, 1);
      return true;
    }
    return false;
  };

  for(var i = 0; true; i++) {
    var topLeft = [center[0] - i, center[1] - i];
    var bottomRight = [center[0] + i, center[1] + i];
    var aPixelOverThreshold = false;
    var maxHeight = distrobution(xyCol);
    for(var x = topLeft[0]; x <= bottomRight[0]; x++) {
      if(drawPoint([x, topLeft[1]])) {
        aPixelOverThreshold = true;
      }
      if(drawPoint([x, bottomRight[1]])) {
        aPixelOverThreshold = true;
      }
    }
    for(var y = topLeft[1] + 1; y < bottomRight[1]; y++) {
      if(drawPoint([topLeft[0], y])) {
        aPixelOverThreshold = true;
      }
      if(drawPoint([bottomRight[0], y])) {
        aPixelOverThreshold = true;
      }
    }
    if(!aPixelOverThreshold) {
      break;
    }
  }
};


var round = function(num, decPlaces) {
  var f = Math.pow(10, decPlaces);
  return Math.round(num * f) / f;
};

var oneDArrayToHTML = function(array) {
  return twoDArrayToHTML([array]);
};

var twoDArrayToHTML = function(array) {
  var html = '<table>';
  array.forEach(function(row) {
    html += '<tr>';
    row.forEach(function(col) {
      html += '<td>' + round(col, 5) + '</td>';
      //html += '<td>' + col + '</td>';
    });
    html += '</tr>';
  });
  html += '</table>';
  return html;
};

var matrixToHTML = function(matrix) {
  return twoDArrayToHTML(matrix.elements);
};

var paintData = function(data) {
  var ctx = canvas.getContext('2d');

  canvas.width = data.worldsize;
  canvas.height = data.worldsize;

  var timePerStep = timePerStepField.value;
  var numSteps = numStepsField.value;

  Object.keys(data.enemies).forEach(function(callsign) {
    var enemy = data.enemies[callsign];
    var centerXYCol = physics.muToXYCol(enemy.mu);
    var sigmaXY = physics.getXYSigma(enemy.sigma);
    drawNormalDistrobution(ctx,centerXYCol, sigmaXY, data.worldsize);

    ctx.fillStyle = 'blue';
    ctx.textBaseLine = 'middle';
    ctx.textAlign = 'center';
    for(var step = 0; step <= numSteps; step++) {
      var time = timePerStep * step / 1000;
      var newMu = physics.F(time).x(enemy.mu);
      var newXYCol = physics.muToXYCol(newMu);
      var point = physics.xYColToPoint(newXYCol, data.worldsize);
      ctx.fillText(step, point[0], point[1]);
    }
  });


  var dataHTML = '';
  Object.keys(data.enemies).forEach(function(callsign) {
    var centerXYCol = physics.muToXYCol(data.enemies[callsign].mu);
    //drawCircle(ctx, convertCenterToTopLeft(data.worldsize, center), 10);
    var sigmaXY = physics.getXYSigma(data.enemies[callsign].sigma);
    dataHTML += '<h2>' + callsign + '</h2>';
    dataHTML += 'Observation: ' + oneDArrayToHTML([data.enemies[callsign].loc.x, data.enemies[callsign].loc.y]);
    dataHTML += 'Mu: ' + matrixToHTML(data.enemies[callsign].mu);
    dataHTML += 'Sigma: ' + matrixToHTML(data.enemies[callsign].sigma);
  });
  dataDiv.innerHTML = dataHTML;
};

refreshButton.onclick = retrieveAndPaintData;
retrieveAndPaintData();
