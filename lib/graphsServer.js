'use strict';

var http = require('http');
var fs = require('fs');

var start = function(team) {
    http.createServer(function (req, res) {
        if(req.url == '/fields.html') {
            console.log("HTML requested");
            fs.readFile('./visualize_fields.html', 'utf8', function (err,data) {
                if (err) {
                    return console.log(err);
                }
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(data);
                console.log("Delivered HTML");
            });
        } else if(req.url == '/fields_data.json') {
            //console.log("JSON requested");
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
            //console.log("Delivered JSON");
        } else if(req.url == '/occ.html') {
            console.log("HTML requested");
            fs.readFile('./visualize_grid_filter.html', 'utf8', function (err,data) {
                if (err) {
                    return console.log(err);
                }
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(data);
                console.log("Delivered HTML");
            });
        } else if(req.url == '/occ_data.json') {
            //console.log("JSON requested");
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(team.gridFilter));
            //console.log("Delivered JSON");
        } else {
            console.log("Unknown url requested: " + req.url);
        }
    }).listen(8080);
};

module.exports = {start: start};
