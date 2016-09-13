'use strict';

/**
 * Path containing GLOBE project files.
 * If path starts with a slash (/) it's treated as a relative path to your project's directory
 * Download GLOBE project data here: https://www.ngdc.noaa.gov/mgg/topo/DATATILES/elev/all10g.tgz
 * and place all files in the 'dataPath' directory
 */
var dataPath= 'elevation';

/**
 * Timeout to keep data files open to reduce overhead
 * Set to negative value to disable this feature
 * default: 3600000
 */
var fileOpenTimeout= 3600000;

exports= {
    dataPath: dataPath,
    fileOpenTimeout: fileOpenTimeout,
};

