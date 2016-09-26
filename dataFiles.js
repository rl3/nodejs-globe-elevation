'use strict';
var path= require('path');
var fs= require('fs');

/**
 * Some constants
 */

/**
 * GLOBE Task Team and others (Hastings, David A., Paula K. Dunbar, Gerald M. Elphingstone, Mark Bootz,
 * Hiroshi Murakami, Hiroshi Maruyama, Hiroshi Masaharu, Peter Holland, John Payne, Nevin A. Bryant,
 * Thomas L. Logan, J.-P. Muller, Gunter Schreier, and John S. MacDonald), eds., 1999.
 * The Global Land One-kilometer Base Elevation (GLOBE) Digital Elevation Model, Version 1.0.
 * National Oceanic and Atmospheric Administration,
 * National Geophysical Data Center, 325 Broadway, Boulder, Colorado 80303, U.S.A.
 * Digital data base on the World Wide Web (URL: http://www.ngdc.noaa.gov/mgg/topo/globe.html) and CD-ROMs.
 */
var dataFiles= [
    { name: 'a10g', latMin:    50, latMax:     90, lngMin:   -180, lngMax:    -90, elMin:      1, elMax:    6098, columns:    10800, rows:   4800 },
    { name: 'b10g', latMin:    50, latMax:     90, lngMin:    -90, lngMax:      0, elMin:      1, elMax:    3940, columns:    10800, rows:   4800 },
    { name: 'c10g', latMin:    50, latMax:     90, lngMin:      0, lngMax:     90, elMin:    -30, elMax:    4010, columns:    10800, rows:   4800 },
    { name: 'd10g', latMin:    50, latMax:     90, lngMin:     90, lngMax:    180, elMin:      1, elMax:    4588, columns:    10800, rows:   4800 },
    { name: 'e10g', latMin:     0, latMax:     50, lngMin:   -180, lngMax:    -90, elMin:    -84, elMax:    5443, columns:    10800, rows:   6000 },
    { name: 'f10g', latMin:     0, latMax:     50, lngMin:    -90, lngMax:      0, elMin:    -40, elMax:    6085, columns:    10800, rows:   6000 },
    { name: 'g10g', latMin:     0, latMax:     50, lngMin:      0, lngMax:     90, elMin:   -407, elMax:    8752, columns:    10800, rows:   6000 },
    { name: 'h10g', latMin:     0, latMax:     50, lngMin:     90, lngMax:    180, elMin:    -63, elMax:    7491, columns:    10800, rows:   6000 },
    { name: 'i10g', latMin:   -50, latMax:      0, lngMin:   -180, lngMax:    -90, elMin:      1, elMax:    2732, columns:    10800, rows:   6000 },
    { name: 'j10g', latMin:   -50, latMax:      0, lngMin:    -90, lngMax:      0, elMin:   -127, elMax:    6798, columns:    10800, rows:   6000 },
    { name: 'k10g', latMin:   -50, latMax:      0, lngMin:      0, lngMax:     90, elMin:      1, elMax:    5825, columns:    10800, rows:   6000 },
    { name: 'l10g', latMin:   -50, latMax:      0, lngMin:     90, lngMax:    180, elMin:      1, elMax:    5179, columns:    10800, rows:   6000 },
    { name: 'm10g', latMin:   -90, latMax:    -50, lngMin:   -180, lngMax:    -90, elMin:      1, elMax:    4009, columns:    10800, rows:   4800 },
    { name: 'n10g', latMin:   -90, latMax:    -50, lngMin:    -90, lngMax:      0, elMin:      1, elMax:    4743, columns:    10800, rows:   4800 },
    { name: 'o10g', latMin:   -90, latMax:    -50, lngMin:      0, lngMax:     90, elMin:      1, elMax:    4039, columns:    10800, rows:   4800 },
    { name: 'p10g', latMin:   -90, latMax:    -50, lngMin:     90, lngMax:    180, elMin:      1, elMax:    4363, columns:    10800, rows:   4800 },
];

// resolution in 1 / degree
var resolution= 120;

/**
 *  End of constants
 */

/**
 * Base path for data files
 */
var dataPath;

/**
 * Opens file and executes given function
 * Keeps files open for given time to reduce overhead
 */
var openFile;


/**
 * Fixes given path
 * returns an Error if path does not exist
 */
var _fixDataPath= function( _path ) {
    // prepend path only if path does nit start with "/" and top level module is defined
    if ( !_path.match(/^\//) && require.main ) {
        _path= path.join(path.dirname(require.main.filename), _path);
    }

    // Test is data directory is executable
    try {
        fs.accessSync(_path, fs.constants.X_OK);
    }
    catch ( e ) {
        return new Error("Data directory '" + _path + "' does not exist. See README.md for instructions!");
    }

    // check for readability of data files
    try {
        dataFiles.forEach(function( dataFile ) {
            fs.accessSync(path.join(_path, dataFile.name), fs.constants.R_OK);
        });
    }
    catch ( e ) {
        return new Error("One or more data file in '" + _path + "' is missing. See README.md for instructions!");
    }

    return _path;
};

var openFiles= {};

var closeFile= function( name ) {
    if ( !(name in openFiles) ) return;

    clearTimeout(openFiles[name].timeout);
    fs.closeSync(openFiles[name].fd);
    delete openFiles[name];
};

var closeAllFiles= function() {
    Object.keys(openFiles).forEach(closeFile);
};

/**
 * (Re-)init
 */
var init= function( config ) {

    // close all open files
    closeAllFiles();

    var result= true;

    if ( config.dataPath ) {
        var paths= (Array.isArray(config.dataPath) ? config.dataPath : [ config.dataPath ]).map(_fixDataPath);

        // find first valid path
        var _path= paths.filter(function( path ) { return !(path instanceof Error); })[0];
        if ( _path ) {
            dataPath= _path;
        }
        else {
            result= paths[0];
        }
    }
    if ( config.fileOpenTimeout ) {
        var timeout= config.fileOpenTimeout;

        if ( timeout > 0 ) {
            openFile= function( name, fn ) {
                if ( !(name in openFiles) ) {
                    openFiles[name]= {
                        fd: fs.openSync(path.join(dataPath, name), 'r'),
                    };
                }

                if ( openFiles[name].timeout ) clearTimeout(openFiles[name].timeout);

                openFiles[name].timeout= setTimeout(closeFile.bind(undefined, name), timeout);

                return fn(openFiles[name].fd);
            };
        }
        else {
            openFile= function( name, fn ) {
                var fd= fs.openSync(path.join(dataPath, name), 'r');

                var result= fn(fd);

                fs.closeSync(fd);
                return result;
            };
        }
    }
    return result;
};

var finalize= closeAllFiles;

var fileIndex= function( lng, lat, fileEntry, resolution ) {
    var column= Math.floor(lng * resolution);
    var row= Math.floor(lat * resolution);

    var rowIndex= row - fileEntry.latMin * resolution;
    var columnIndex= column - fileEntry.lngMin * resolution;
    var index= ((fileEntry.rows - rowIndex - 1) * fileEntry.columns + columnIndex) * 2;
    return index;
};


var findFile= function( lng, lat ) {
    for ( var i in dataFiles ) {
        var df= dataFiles[i];
        if (df.latMin <= lat && df.latMax > lat && df.lngMin <= lng && df.lngMax > lng) {
            return df;
        }
    }
};

/**
 * Reads a number from given file
 */
var readNumberFromFile= (function() {
    var buffer= new Buffer(2);

    return function( name, position ) {

        return openFile(name, function( fd ) {
            if ( fs.readSync(fd, buffer, 0, 2, position) !== 2 ) return new Error('Could not fetch value from file');

            var int16= buffer.readInt16LE(0);

            // return 0 for oceans
            return int16 === -500 ? 0 : int16;
        });
    };
})();


/**
 *  Get elevation of a given lng/lat
 *  returns undefined (or result of onError) on error
 *  returns elevation otherwise
 */
var stdOnError= function( error ) { throw error; };

var getElevation= function( lng, lat, onError ) {
    if ( !onError ) onError= stdOnError;

    var fileEntry= findFile(lng, lat);

    if ( !fileEntry ) return onError('Could not determine data file');

    var result= readNumberFromFile(fileEntry.name, fileIndex(lng, lat, fileEntry, resolution));

    if ( result instanceof Error ) return onError(result);

    return result;
};


module.exports= {
    init: init,
    getElevation: getElevation,
    getResolution: function() { return resolution; },
    stdOnError: stdOnError,
    finalize: finalize
};

