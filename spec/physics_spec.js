var physics = require('../lib/physics');
var sylvester = require("sylvester");
var Matrix = sylvester.Matrix;

describe('pointToXYCol', function() {
    it('should translate the middle', function() {
        expect(physics.pointToXYCol([400, 400], 800)).toEqual(Matrix.create([[0],[0]]));
    });
    it('should translate the top left', function() {
        expect(physics.pointToXYCol([0, 0], 800)).toEqual(Matrix.create([[-400],[400]]));
    });
    it('should translate the bottom right', function() {
        expect(physics.pointToXYCol([800, 800], 800)).toEqual(Matrix.create([[400],[-400]]));
    });
});

describe('normalDistrobution', function() {
    it('should handle a single variable standard distrobution', function() {
        var mu = Matrix.create([[0]]);
        var sigma = Matrix.create([[1]]);
        var distrobution = physics.normalDistrobution(mu, sigma);
        expect(distrobution(Matrix.create([[0]]))).toBeCloseTo(0.3989, 2);
        expect(distrobution(Matrix.create([[1]]))).toBeCloseTo(0.2419, 2);
    });
    it('should handle a bi-variate standard distrobution', function() {
        var mu = Matrix.create([[0], [0]]);
        var sigma = Matrix.create([[1, 0], [0, 1]]);
        var distrobution = physics.normalDistrobution(mu, sigma);
        expect(distrobution(Matrix.create([[0], [0]]))).toBeCloseTo(0.1592, 3);
        expect(distrobution(Matrix.create([[1], [1]]))).toBeCloseTo(0.0585, 3);
        expect(distrobution(Matrix.create([[-1], [-1]]))).toBeCloseTo(0.0585, 3);
        expect(distrobution(Matrix.create([[1], [-1]]))).toBeCloseTo(0.0585, 3);
        expect(distrobution(Matrix.create([[-1], [1]]))).toBeCloseTo(0.0585, 3);
    });
});
