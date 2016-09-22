// jshint esversion: 6

'use strict';
var util= require('util');

var elevation= require('./index');


var round= function( value ) {
    return Math.round(value * 100) / 100;
};

var _test= function( description, expectedResult, result ) {
    var success= round(expectedResult) === round(result);
    if ( success ) {
        console.log('PASS:', description, 'got', result);
        return true;
    }
    console.error('FAIL:', description, 'expected', expectedResult, 'got', result);
};

var test= function( location, expectedResult ) {
    _test('Elevation @ ' + util.inspect(location, { colors: true, depth: 4 }), expectedResult, elevation.getElevation(location, console.error));
}

test([ 0, 0 ], 0);
test({ lat: 51.7894, lng: 11.1416 }, 123);

test([ { lat: 35.0, lng: -106.6 }, [ () => -106.5, () => 35.1 ] ], 1632.24);
test([ [ () => -106.5, () => 35.1 ], { lat: 35.0, lng: -106.6 } ], 1632.24);
test([ { lat: () => 35.0, lng: () => -106.6 }, [ () => () => -106.5, () => 35.1 ] ], 1632.24);
test([ () => { return { lat: () => 35.0, lng: () => -106.6 }; }, [ () => () => -106.5, () => 35.1 ] ], 1632.24);
test(() => [ () => { return { lat: () => 35.0, lng: () => -106.6 }; }, [ () => () => -106.5, () => 35.1 ] ], 1632.24);

test([ { lat: 67.5, lng: -179 }, [ 179, 68 ] ], 513.1);

test([ -68.00833333, -25.62500000 ], 5303);
test([ -68.00833334, -25.62500001 ], 5345);