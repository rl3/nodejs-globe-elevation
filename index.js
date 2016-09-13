'use strict';
var util= require('util');
var path= require('path');
var fs= require('fs');
var config= require('./config');

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
    { name: 'a10g', latMin:    50, latMax:     90, lonMin:   -180, lonMax:    -90, elMin:      1, elMax:    6098, columns:    10800, rows:   4800 },
    { name: 'b10g', latMin:    50, latMax:     90, lonMin:    -90, lonMax:      0, elMin:      1, elMax:    3940, columns:    10800, rows:   4800 },
    { name: 'c10g', latMin:    50, latMax:     90, lonMin:      0, lonMax:     90, elMin:    -30, elMax:    4010, columns:    10800, rows:   4800 },
    { name: 'd10g', latMin:    50, latMax:     90, lonMin:     90, lonMax:    180, elMin:      1, elMax:    4588, columns:    10800, rows:   4800 },
    { name: 'e10g', latMin:     0, latMax:     50, lonMin:   -180, lonMax:    -90, elMin:    -84, elMax:    5443, columns:    10800, rows:   6000 },
    { name: 'f10g', latMin:     0, latMax:     50, lonMin:    -90, lonMax:      0, elMin:    -40, elMax:    6085, columns:    10800, rows:   6000 },
    { name: 'g10g', latMin:     0, latMax:     50, lonMin:      0, lonMax:     90, elMin:   -407, elMax:    8752, columns:    10800, rows:   6000 },
    { name: 'h10g', latMin:     0, latMax:     50, lonMin:     90, lonMax:    180, elMin:    -63, elMax:    7491, columns:    10800, rows:   6000 },
    { name: 'i10g', latMin:   -50, latMax:      0, lonMin:   -180, lonMax:    -90, elMin:      1, elMax:    2732, columns:    10800, rows:   6000 },
    { name: 'j10g', latMin:   -50, latMax:      0, lonMin:    -90, lonMax:      0, elMin:   -127, elMax:    6798, columns:    10800, rows:   6000 },
    { name: 'k10g', latMin:   -50, latMax:      0, lonMin:      0, lonMax:     90, elMin:      1, elMax:    5825, columns:    10800, rows:   6000 },
    { name: 'l10g', latMin:   -50, latMax:      0, lonMin:     90, lonMax:    180, elMin:      1, elMax:    5179, columns:    10800, rows:   6000 },
    { name: 'm10g', latMin:   -90, latMax:    -50, lonMin:   -180, lonMax:    -90, elMin:      1, elMax:    4009, columns:    10800, rows:   4800 },
    { name: 'n10g', latMin:   -90, latMax:    -50, lonMin:    -90, lonMax:      0, elMin:      1, elMax:    4743, columns:    10800, rows:   4800 },
    { name: 'o10g', latMin:   -90, latMax:    -50, lonMin:      0, lonMax:     90, elMin:      1, elMax:    4039, columns:    10800, rows:   4800 },
    { name: 'p10g', latMin:   -90, latMax:    -50, lonMin:     90, lonMax:    180, elMin:      1, elMax:    4363, columns:    10800, rows:   4800 },
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

// Build data path from config
var dataPath= config.dataPath || 'elevation';
if ( !dataPath.match(/^\//) ) {
    dataPath= path.join(__dirname, dataPath);
}

// Test is data directory is executable
try {
    fs.accessSync(dataPath, fs.constants.X_OK);
}
catch (e) {
    throw new Error("Data directory '" + dataPath + "' does not exist. See README.md for instructions!");
}

// check for readability of data files
try {
    dataFiles.forEach(function( dataFile ) {
        fs.accessSync(path.join(dataPath, dataFile.name), fs.constants.R_OK);
    });
}
catch (e) {
    throw new Error("One or more data file in '" + dataPath + "' is missing. See README.md for instructions!");
}


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
 * Opens file and executes given function
 * Keeps files open for given time to reduce overhead
 */
var openFile= (function() {
    var timeout= config.fileOpenTimeout || 3600000;

    if ( timeout > 0 ) {
        var openFiles= {};

        return function( name, fn ) {
            if ( !(name in openFiles) ) {
                openFiles[name]= {
                    fd: fs.openSync(path.join(dataPath, name), 'r'),
                    timeout: undefined,
                };
            }

            if ( openFiles[name].timeout ) clearTimeout(openFiles[name].timeout);

            openFiles[name].timeout= setTimeout(function() {
                fs.closeSync(openFiles[name].fd);
                delete openFiles[name];
            }, timeout);

            return fn(openFiles[name].fd);
        };
    }

    return function( name, fn ) {
        var fd= fs.openSync(path.join(dataPath, name), 'r');

        var result= fn(fd);
        
        fs.closeSync(fd);
        return result;
    };
})();
 
 
/**
 * Reads a number from given file
 */
var readNumberFromFile= (function() {
    var buffer= new Buffer(2);

    return function( name, position ) {
        return openFile(name, function( fd ) {
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


var fileIndex= function( location, fileEntry ) {
    var column= Math.floor(location[0] * resolution);
    var row= Math.floor(location[1] * resolution);

    var rowIndex= row - fileEntry.latMin * resolution;
    var columnIndex= column - fileEntry.lonMin * resolution;
    var index= ((fileEntry.rows - rowIndex - 1) * fileEntry.columns + columnIndex) * 2;
    return index;
};


var findFile= function( location ) {
    var rl= roundLocation(location);

    for ( var i in dataFiles ) {
        var df= dataFiles[i];
        if (df.latMin <= rl[1] && df.latMax >= rl[1] && df.lonMin <= rl[0] && df.lonMax >= rl[0]) {
            return df;
        }
    }
};


var getElevation= function( location ) {
    if ( !util.isArray(location) ) return;

    var locations;
    if ( util.isArray(location[0]) ) {
        var spherewrap= false;
        var ul= roundLocation(location[0]);
        var or= roundLocation(location[1]);

        if ( ul[0] * or[0] < 0 && Math.abs(ul[0] - or[0]) >= 180 ) {
            spherewrap= true;
            ul= mirrorPoint(ul);
            or= mirrorPoint(or);
        }

        locations= [];

        //boundingBox assumed -> build locations array
        for ( var lon= ul[0]; lon <= or[0]; lon += 1 / resolution ) {
            for ( var lat= ul[1]; lat <= or[1]; lat += 1 / resolution ) {
                locations.push([ lon, lat ]);

                //prevent system from lock up due to allocate a lot of memory
                if ( locations.length > pointLimit ) return;
            }
        }
        if ( spherewrap ) locations= mirrorPoints(locations);
    }
    else {
        locations= [ roundLocation(location) ];
    }

    if (!locations.length) return;

    var altSum= 0;
    for ( var i in locations ) {
        var li= locations[i];
        var fileEntry= findFile(li);

        if ( !fileEntry ) return;

        var alt= readNumberFromFile(fileEntry.name, fileIndex(li, fileEntry));

        if ( isNaN(alt) ) return;

        altSum += alt;
    }

    return altSum / locations.length;
};


module.exports.getElevation= getElevation;
