'use strict';
var dataFiles= require('./dataFiles');

var defaultDataPaths= [
    '/usr/share/GLOBE-elevation',
    '/usr/local/share/GLOBE-elevation',
    'GLOBE-elevation',
    'elevation',
];

var resolution= dataFiles.getResolution();
var resolutionStep= 1 / resolution;

// offset to middle of one raster pixel
var offset= resolutionStep / 2;

var autoFinalize= true;

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
 *  convert a coordinate to integer
 */
var coord2Int= function( c ) {
    return Math.round((c + offset) * resolution);
};

/**
 *  convert an integer to coordinate
 */
var int2Coord= function( i ) {
    return i / resolution - offset;
};


/**
 *  Lng/lat coordinate
 */
var Point= (function() {
    var _maxLat= 90 - resolutionStep / 2;
    var _round= function( l ) {
        return int2Coord(coord2Int(l));
    };

    return function( lng, lat ) {
        if ( Array.isArray(lng) ) {
            lat= lng[1];
            lng= lng[0];
        }
        lng= _round(lng);
        lat= _round(lat);

        if ( lat < -_maxLat ) lat= -_maxLat;
        if ( lat >  _maxLat ) lat=  _maxLat;
        if ( lng < -180) lng += 360;
        if ( lng >  180) lng -= 360;

        this.lng= function() { return lng; };
        this.lat= function() { return lat; };
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
        p2Lng= _mirrorLng(p2Lng);
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
};


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

        var p1= _fixSingleLocation(_resolveValue(location[0]));
        var p2= _fixSingleLocation(_resolveValue(location[1]));

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
var _getElevation= function( param, onError ) {
    if ( typeof onError !== 'function' ) onError= dataFile.stdOnError;

    param= _fixParam(param);
    if ( !param ) return onError('Could get location');

    if ( param instanceof Point ) {
        return dataFiles.getElevation(param.lng(), param.lat(), onError);
    }

    var minIlng= coord2Int(param.minLng());
    var maxIlng= coord2Int(param.maxLng());
    var minIlat= coord2Int(param.minLat());
    var maxIlat= coord2Int(param.maxLat());
    var sphereWrap= param.sphereWrap();

    var altSum= 0;
    var count= 0;

    var _error, _errorResult;
    var _onError= function() {
        _errorResult= onError.apply(undefined, arguments);
        _error= true;
        return 0;
    };

    for ( var iLng= minIlng; iLng <= maxIlng; iLng += 1 ) {
        var lng= int2Coord(iLng);
        if ( sphereWrap ) lng= _mirrorLng(lng);

        for ( var iLat= minIlat; iLat <= maxIlat; iLat += 1 ) {
            altSum += dataFiles.getElevation(lng, int2Coord(iLat), _onError);

            if ( _error ) return _errorResult;

            count++;
        }
    }

    return altSum / count;
};

var getElevation= function( param, onError ) {
    var result= _getElevation(param, onError);
    if ( autoFinalize ) dataFiles.finalize();
    return result;
};

var init= function( config ) {
    var result= dataFiles.init(config);

    if ( result instanceof Error ) throw result;

    if ( 'autoFinalize' in config ) autoFinalize= config.autoFinalize;

    return result;
};


module.exports= {
    init: init,
    getElevation: getElevation,
};

