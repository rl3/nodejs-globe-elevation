# nodejs-globe-elevation
NodeJS module to retrieve elevation from "Global Land One-km Base Elevation Project"

# Requirements
You need to download elevation data of the "Global Land One-km Base Elevation Project".

Project's Homepage: http://www.ngdc.noaa.gov/mgg/topo/globe.html

Load GLOBE's data here: https://www.ngdc.noaa.gov/mgg/topo/gltiles.html

Please download and extract GLOBE's files to a directory.
This module searches for data files in the folowing paths:
```
/usr/share/GLOBE-elevation
/usr/share/local/GLOBE-elevation
[current project's directory]/GLOBE-elevation
[current project's directory]/elevation
```

You may provide any other directory on initializiation.

# Installation
Simply install this module with `npm`
```sh
npm install globe-elevation
```

To install it globally run
```sh
npm install -g globe-elevation
```


# Usage
```js
'use strict';
var elevation= require('globe-elevation');
elevation.init({
  dataPath: "path to GLOBE's data files",
  openFileTimout: 1000
});

console.log('Elevation [ 0, 0 ] =? 0:', elevation.getElevation([ 0, 0 ]));
console.log('Elevation at 51.7894(lat), 11.1416(lng) =? 123:', elevation.getElevation({ lat: 51.7894, lng: 11.1416}));
console.log('Elevation at (35.0(lat), -106.6(lng)), (35.1(lat), 106.5(lng)) =? 1624.2:', elevation.getElevation([ { lat: 35.0, lng: -106.6 }, [ () => -106.5, () => 35.1 ] ]));
```
## Initialization
Initialization is optional if your data files are located at one of the above mentioned directories. If not specify it with ```dataPath```.

Furthermore we've optimized file operation for multiple calculations. You may specify with ```openFileTimeout``` a timeout in ms, for which any file will be kept open after last access. You may specify ```0``` to disable this feature (default is 1 second). You should not use much higher values because nodejs waits on process exit for any pending timeout before exiting.

## ```getElevation( location [, onError] )```
You may specify a single location or an array of two locations (bounding box).

Any location may be in the format ```[ lng, lat ]``` or ```{ lng: lng, lat: lat }``` or a function returning such values. ```lat``` and ```lng``` may be functions itselfes returning the corresponding values.

**Attention:** Please note, that we chose ```[ lng, lat ]``` for arrays, because it's MongoDB's internal format for geo locations.

If you specify a bounding box, ```lng``` and ```lat``` will be iterated over every value inbetween in 1/120 grad steps. The result is the mean value of all elevations.

The optional ```onError``` function is called whenever an error occured. It's return value wil be the result of ```getElevation```
