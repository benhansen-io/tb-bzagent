'use strict';

var express = require('express'),
    app = express(),
    browserify = require('browserify-middleware');

app.use(app.router);
app.use(express.static(__dirname));

app.get('/main.js', browserify('./main.js'));

app.listen(3080);
console.log('Listening on 3080');