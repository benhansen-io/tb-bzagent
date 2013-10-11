'use strict';

var pf = require('../lib/potential-fields');

function Field(location, radius, spread, type) {
	this.location = location;
	this.radius = radius;
	this.spread = spread;
	this.type = type;
}


var fields = [
    new Field([20, 20], 2, 3, 'seek'),
    new Field([40, 40], 2, 3, 'seek')
];

var g = [];
for (var x = 0; x < 50; x++) {
    for (var y = 0; y < 50; y++) {
//        g[x] = g[x] || [];
//        g[x][y] = gradient([x, y], fields);
        var _g = pf.gradient([x, y], fields);
        g.push({
            x: x, y: y,
            value: {
                x: _g[0],
                y: _g[1]
            }
        });
    }
}



var xscale = d3.scale.linear()
               .domain([0,50])
               .range([0,720]),
    yscale = d3.scale.linear()
               .domain([0,50])
               .range([0,487]),
    map = d3.floorplan().xScale(xscale).yScale(yscale),
    vectorfield = d3.floorplan.vectorfield(),
    mapdata = {};

map.addLayer(vectorfield);

var data = {
	'binSize': 2,
	'map': g
};

mapdata[vectorfield.id()] = data;
	
var svg = d3.select('#demo').append('svg')
    .attr('width',720)
    .attr('height', 487)
    .datum(mapdata).call(map);

svg.select('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('refX', 0)
    .attr('refY', 1)
    .attr('markerWidth', 3)
    .attr('markerHeight', 2)
    .attr('orient', 'auto')
    .append('path')
        .attr('d', 'M 0,0 V 2 L3,1 Z');
