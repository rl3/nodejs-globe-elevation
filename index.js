'use strict';
var fs= require('fs');

var dataFiles= require('./dataFiles');

var defaultDataPaths= [
    '/usr/share/GLOBE-elevation',
    '/usr/local/share/GLOBE-elevation',
    'GLOBE-elevation',
    'elevation',
];

// resolution in 1 / degree
var resolution= 120;

// offset to middle of one raster pixel
var offset= 1 / (2 * resolution);

// limit of single points for bounding boxes
var pointLimit= 1000000;

/**
 * End of constants
 */

// First initialization with best guessed values
dataFiles.init({

    // find first existing path (if any)
    dataPath: defaultDataPaths,

    fileOpenTimeout: 1000,
});


/**
 * correct point for bounding boxes crossing date line
 */
var mirrorPoint= function( point ) {
    return [ point[0] + (point[0] < 0 ? 180 : -180), point[1] ];
};

/**
 * correct list of points for bounding boxes crossing date line
 */
var mirrorPoints= function( points ) {
    return points.map(mirrorPoint);
};


/**
 * Reads a number from given file
 */
var readNumberFromFile= (function() {
    var buffer= new Buffer(2);

    return function( name, position ) {
        return dataFiles.openFile(name, function( fd ) {
            if ( fs.readSync(fd, buffer, 0, 2, position) !== 2 ) return null;

            var int16= buffer.readInt16LE(0);

            // return 0 for oceans
            return int16 === -500 ? 0 : int16;
        });
    };
})();


var roundLocation= function( location ) {
    var rlon= Math.round((location[0] + offset) * resolution) / resolution - offset;
    var rlat= Math.round((location[1] + offset) * resolution) / resolution - offset;
    rlat= Math.max(-90 + offset, rlat);
    rlat= Math.min(90 - offset, rlat);
    if (rlon < -180) rlon += 360;
    if (rlon > 180) rlon -= 360;
    return [ rlon, rlat ];
};

var _resolveValue= function( value ) {
    if ( typeof value === 'function' ) return _resolveValue(value());

    return value;
}

var _fixObjectLocation= function( location ) {
    if ( typeof location === 'object' && 'lng' in location && 'lat' in location ) {
        var lng= +_resolveValue(location.lng);
        var lat= +_resolveValue(location.lat);

        if ( isNaN(lng) || isNaN(lat) ) return;

        return [ lng, lat ];
    }
}


var _fixSingleLocation= function( location ) {
    if ( Array.isArray(location) && location.length === 2 ) {
        var lng= +_resolveValue(location[0]);
        var lat= +_resolveValue(location[1]);

        if ( isNaN(lng) || isNaN(lat) ) return;

        return [ lng, lat ];
    }
    return _fixObjectLocation(location);
}

var _fixLocation= function( location ) {
    location= _resolveValue(location);

    var l= _fixSingleLocation(location);

    // location is a single location
    if ( l ) return l;

    if ( !Array.isArray(location) || location.length !== 2 ) return;

    var ul= _fixSingleLocation(location[0]);
    var or= _fixSingleLocation(location[1]);
    if ( ul && or ) return [ ul, or ];
}


var getElevation= function( location, onError ) {
    if ( typeof onError !== 'function' ) onError= function() {};

    location= _fixLocation(location);
    if ( !location ) return onError('Could get location');

    var locations;
    if ( Array.isArray(location[0]) ) {
        var spherewrap= false;
        var ul= roundLocation(location[0]);
        var or= roundLocation(location[1]);

        if ( ul[0] * or[0] < 0 && Math.abs(ul[0] - or[0]) >= 180 ) {
            spherewrap= true;
            ul= mirrorPoint(ul);
            or= mirrorPoint(or);
        }

        var lonMin= ul[0], lonMax= or[0];
        if ( ul[0] > or[0] ) {
            lonMin= or[0];
            lonMax= ul[0];
        }
        var latMin= ul[1], latMax= or[1];
        if ( ul[1] > or[1] ) {
            latMin= or[1];
            latMax= ul[1];
        }

        locations= [];

        // boundingBox assumed -> build locations array
        for ( var lon= lonMin; lon <= lonMax; lon += 1 / resolution ) {
            for ( var lat= latMin; lat <= latMax; lat += 1 / resolution ) {
                locations.push([ lon, lat ]);

                // prevent system from lock up due to allocate a lot of memory
                if ( locations.length > pointLimit ) return onError('Too many points');
            }
        }
        if ( spherewrap ) locations= mirrorPoints(locations);
    }
    else {
        locations= [ roundLocation(location) ];
    }

    if ( !locations.length ) return onError('No location given');

    var altSum= 0;
    for ( var i in locations ) {
        var li= locations[i];
        var fileEntry= dataFiles.findFile(roundLocation(li));

        if ( !fileEntry ) return onError('Could not determine data file');

        var alt= readNumberFromFile(fileEntry.name, dataFiles.fileIndex(li, fileEntry, resolution));

        if ( isNaN(alt) ) return onError('Could not fetch value from file');

        altSum += alt;
    }

    return altSum / locations.length;
};

var init= function( config ) {
    var result= dataFiles.init(config);
    if ( result instanceof Error ) throw result;
    return result;
}


module.exports= {
    init: init,
    getElevation: getElevation,
};

