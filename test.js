// jshint esversion: 6

'use strict';

var elevation= require('./index');
var util= require('util');

elevation.init({
    dataPath: '/var/node/Sponge-JS/elevation',
});

var round= function( value ) {
    return Math.round(value * 100) / 100;
}

var test= function( description, expectedResult, result ) {
    var success= round(expectedResult) === round(result);
    if ( success ) {
        console.log('PASS:', description, 'got', result);
        return true;
    }
    console.error('FAIL:', description, 'expected', expectedResult, 'got', result);
}




test('Elevation at [ 0, 0 ]', 0, elevation.getElevation([ 0, 0 ], console.error));
test('Elevation at 51.7894(lat), 11.1416(lng)', 123, elevation.getElevation({ lat: 51.7894, lng: 11.1416}, console.error));

test('Elevation at (35.0(lat), -106.6(lng)), (35.1(lat), -106.5(lng))', 1632.24, elevation.getElevation([ { lat: 35.0, lng: -106.6 }, [ () => -106.5, () => 35.1 ] ], console.error));
test('Elevation at (35.0(lat), -106.6(lng)), (35.1(lat), -106.5(lng))', 1632.24, elevation.getElevation([ [ () => -106.5, () => 35.1 ], { lat: 35.0, lng: -106.6 } ], console.error));

test('Elevation at (67.5(lat), 179(lng)), (68(lat), -179(lng)):', 513.1, elevation.getElevation([ { lat: 67.5, lng: 179 }, [ () => -179, () => 68 ] ], console.error));
