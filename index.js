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
var resolutionStep= 1 / resolution;

// offset to middle of one raster pixel
var offset= resolutionStep / 2;

// limit of single points for bounding boxes
var pointLimit= 1e6;

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
 *  mirror a Longitude
 */
var _mirrorLng= function( lng ) {
    return lng + (lng < 0 ? 180 : -180);
};

/**
 *  Lng/lat coordinate
 */
var Point= (function() {
    var _maxLat= 90 - offset;
    var _round= function( l ) {
        return Math.round((l + offset) * resolution) / resolution - offset;
    };

    return function( lng, lat ) {
        if ( Array.isArray(lng) ) {
            lat= lng[1];
            lng= lng[0];
        }

        if ( lat < -_maxLat ) lat= -_maxLat;
        if ( lat >  _maxLat ) lat=  _maxLat;
        if ( lng < -180) lng += 360;
        if ( lng >  180) lg -= 360;

        this.lng= function() { return lng; };
        this.lat= function() { return lat; };
        this.round= function() { return new Point(_round(lng), _round(lat)); };
    };
})();

/**
 *  Bounding box representation
 */
var BoundingBox= function( p1, p2 ) {
    var p1Lng= p1.lng(), p1Lat= p1.lat(),
        p2Lng= p2.lng(), p2Lat= p2.lat();

    var sphereWrap= p1Lng * p2Lng < 0 && Math.abs(p1Lng - p2Lng) >= 180;
    if ( sphereWrap ) {
        p1Lng= _mirrorLng(p1Lng);
        p12ng= _mirrorLng(p2Lng);
    }

    var minLng= Math.min(p1Lng, p2Lng);
    var maxLng= Math.max(p1Lng, p2Lng);
    var minLat= Math.min(p1Lat, p2Lat);
    var maxLat= Math.max(p1Lat, p2Lat);

    this.minLng= function() { return minLng; };
    this.maxLng= function() { return maxLng; };
    this.minLat= function() { return minLat; };
    this.maxLat= function() { return maxLat; };
    this.sphereWrap= function() { return sphereWrap; };
}


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


/**
 *  parse parameters
 *  returns Point, BoundingBox or undefined on error
 */
var _fixParam= (function() {
    var _resolveValue= function( value ) {
        if ( typeof value === 'function' ) return _resolveValue(value());

        return value;
    };

    var _fixObjectLocation= function( location ) {
        if ( typeof location === 'object' && 'lng' in location && 'lat' in location ) {
            var lng= +_resolveValue(location.lng);
            var lat= +_resolveValue(location.lat);

            if ( isNaN(lng) || isNaN(lat) ) return;

            return new Point(lng, lat);
        }
    };

    var _fixSingleLocation= function( location ) {
        if ( Array.isArray(location) && location.length === 2 ) {
            var lng= +_resolveValue(location[0]);
            var lat= +_resolveValue(location[1]);

            if ( isNaN(lng) || isNaN(lat) ) return;

            return new Point(lng, lat);
        }
        return _fixObjectLocation(location);
    };

    return function( location ) {
        location= _resolveValue(location);

        var p= _fixSingleLocation(location);

        // location is a single location
        if ( p ) return p;

        if ( !Array.isArray(location) || location.length !== 2 ) return;

        var p1= _fixSingleLocation(location[0]);
        var p2= _fixSingleLocation(location[1]);

        if ( p1 && p2 ) return new BoundingBox(p1, p2);
    };
})();


/**
 *  get elevation
 *  param may be a single location of either [lng, lat] or {lng: lng, lat: lat}
 *      or to locations of the above form, defining a bounding box
 *  onError is optional and is called on error
 *
 *  returns result of onError or elevation
 */
var getElevation= function( param, onError ) {
    if ( typeof onError !== 'function' ) onError= function() {};

    param= _fixParam(param);
    if ( !param ) return onError('Could get location');

    var locations;
    if ( param instanceof BoundingBox ) {
        locations= [];

        var maxLng= param.maxLng();
        var maxLat= param.maxLat();
        var sphereWrap= param.sphereWrap();

        // boundingBox assumed -> build locations array
        for ( var lng= param.minLng(); lng <= maxLng; lng += resolutionStep ) {
            for ( var lat= param.minLat(); lat <= maxLat; lat += resolutionStep ) {
                locations.push([ sphereWrap ? _mirrorLng(lng) : lng, lat ]);

                // prevent system from lock up due to allocate a lot of memory
                if ( locations.length > pointLimit ) return onError('Too many points');
            }
        }
    }
    else {
        locations= [ param.lng(), param.lat() ];
    }


    var altSum= 0;
    for ( var i in locations ) {
        var li= locations[i];
        var fileEntry= dataFiles.findFile(li);

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
};


module.exports= {
    init: init,
    getElevation: getElevation,
};

