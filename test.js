'use strict';

var elevation= require('./index');

elevation.init({
    dataPath: '/var/node/Sponge-JS/elevation',
});

console.log('Elevation [ 0, 0 ] =? 0:', elevation.getElevation([ 0, 0 ]));
console.log('Elevation at 51.7894(lat), 11.1416(lng) =? 123:', elevation.getElevation({ lat: 51.7894, lng: 11.1416}))
console.log('Elevation at (35.0(lat), -106.6(lng)), (35.1(lat), 106.5(lng)) =? 1624.2:', elevation.getElevation([ { lat: 35.0, lng: -106.6 }, [ () => -106.5, () => 35.1 ] ]));
console.log('Elevation at (35.0(lat), -106.6(lng)), (35.1(lat), 106.5(lng)) =? 1624.2:', elevation.getElevation([ [ () => -106.5, () => 35.1 ], { lat: 35.0, lng: -106.6 } ]));
