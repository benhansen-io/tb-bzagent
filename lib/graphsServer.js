'use strict';

var http = require('http');
var fs = require('fs');
var pf = require('../lib/potential-fields');
var browserify = require('browserify');

var start = function(team) {
    http.createServer(function (req, res) {
        var extension = req.url.substring(req.url.lastIndexOf('.') + 1);
        if(extension === "html") {
            fs.readFile('.' + req.url, 'utf8', function (err,data) {
                if (err) {
                    res.end(err);
                    console.log(err);
                    return;
                }
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(data);
            });
        } else if(extension === "js") {
            res.writeHead(200, {'Content-Type': 'application/javascript'});
            var b = browserify();
            b.add('.' + req.url);
            b.bundle({debug: true}).pipe(res);
        } else if(req.url == '/fields_data.json') {
            deliverFieldsData(req, team);
        } else if(req.url == '/occ_data.json') {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(team.gridFilter));
        } else if(req.url == '/kalman_data.json') {
            deliverKalmanData(res, team);
        } else {
            console.log("Unknown url requested: " + req.url);
        }
    }).listen(8901);
};

var deliverFieldsData = function(res, team) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    var fields = team.getFields(team.myTanks[0]);
    //console.log(fields);
    var fieldData = [];
    var granularity = 30;
    for(var x = 0; x < team.constants.worldsize / granularity; x++) {
        var rowArray = [];
        for(var y = 0; y < team.constants.worldsize / granularity; y++) {
            var tlPosition = [x * granularity + granularity / 2, y * granularity + granularity / 2];
            var mmPosition = team.convertTopLeftToCenter(tlPosition);
            var pfdxy = pf.gradient(mmPosition, fields);
            rowArray.push(pfdxy);
        }
        fieldData.push(rowArray);
    }
    res.end(JSON.stringify(fieldData));
};

var deliverKalmanData = function(res, team) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    var data = {};
    data.worldsize = team.constants.worldsize;
    data.enemies = team.enemies;

    res.end(JSON.stringify(data));
};

module.exports = {start: start};
