'use strict';

/*
    var field = {
        location: [12, 12],
        radius: 20,
        spread: 15,
        type: 'seek' // or 'avoid' or 'tangent'
    }
*/

function sq(x) { return x*x; }
function addArrays(a, b) {
    return a.map(function(n, i) {
        return n + b[i];
    });
}
function sign(n) { return (n >= 0) ? 1 : -1; }
function distance(l1, l2) {
    return Math.sqrt(sq(l1[0] - l2[0]) + sq(l1[1] - l2[1]));
}
function angle(l1, l2) {
    return Math.atan2(l2[1] - l1[1], l2[0] - l1[0]);
}

var fieldFunction = {
    seek: function(location, goal) {
        var d = distance(location, goal.location);
        if (d < goal.radius) return [0, 0];

        var reach = goal.radius + goal.spread,
            theta = angle(location, goal.location);

        if (d <= reach) {
            return [
                0.1234 * (d-goal.radius) * Math.cos(theta),
                0.1234 * (d-goal.radius) * Math.sin(theta)
            ];
        } else {
            return [
                0.1234 * goal.spread * Math.cos(theta),
                0.1234 * goal.spread * Math.sin(theta)
            ];
        }
    },

    avoid: function(location, obstacle) {
        var d = distance(location, obstacle.location),
            theta = angle(location, obstacle.location);

        if (d < obstacle.radius)
            return [
                -1 * sign(Math.cos(theta)) * Infinity,
                -1 * sign(Math.sin(theta)) * Infinity
            ];

        var reach = obstacle.radius + obstacle.spread;

        if (d <= reach) {
            return [
                -1 * 0.4321 * (obstacle.spread + obstacle.radius - d) * Math.cos(theta),
                -1 * 0.4321 * (obstacle.spread + obstacle.radius - d) * Math.sin(theta)
            ];
        } else {
            return [0, 0];
        }
    },

    tangent: function(location, field) {
        return [0, 0];
    }
};

module.exports = function gradient(location, fields) {
    return fields.reduce(function(g, field) {
        var _g = fieldFunction[field.type](location, field);
        return addArrays(g, _g);
    }, [0, 0]);
};