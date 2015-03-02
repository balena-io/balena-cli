(function() {
  var DESTINATION, NODE_VERSION, RESIN_BUNDLE, async, binary, bundle, bundles, fs, getNodeName, i, len, nodeDownload, path;

  async = require('async');

  binary = require('node-binary');

  fs = require('fs');

  path = require('path');

  DESTINATION = process.argv[2];

  if (DESTINATION == null) {
    console.error('Missing destination argument');
    process.exit(1);
  }

  NODE_VERSION = require('../package.json').bundled_engine;

  RESIN_BUNDLE = process.env.RESIN_BUNDLE;

  if ((RESIN_BUNDLE == null) || RESIN_BUNDLE === 'current') {
    bundles = [
      {
        os: process.platform,
        arch: process.arch,
        version: NODE_VERSION
      }
    ];
  } else if (RESIN_BUNDLE === 'darwin') {
    bundles = [
      {
        os: 'darwin',
        arch: 'x86',
        version: NODE_VERSION
      }, {
        os: 'darwin',
        arch: 'x64',
        version: NODE_VERSION
      }
    ];
  } else if (RESIN_BUNDLE === 'linux') {
    bundles = [
      {
        os: 'linux',
        arch: 'x86',
        version: NODE_VERSION
      }, {
        os: 'linux',
        arch: 'x64',
        version: NODE_VERSION
      }
    ];
  } else if (RESIN_BUNDLE === 'win32') {
    bundles = [
      {
        os: 'win32',
        arch: 'x86',
        version: NODE_VERSION
      }, {
        os: 'win32',
        arch: 'x64',
        version: NODE_VERSION
      }
    ];
  } else {
    console.error("Unknown RESIN_BUNDLE value: " + RESIN_BUNDLE);
    process.exit(1);
  }

  getNodeName = function(options) {
    var result;
    result = "node-" + options.os + "-" + options.arch;
    if (options.os === 'win32') {
      result += '.exe';
    }
    return result;
  };

  console.info('Installing the following NodeJS bundles:');

  for (i = 0, len = bundles.length; i < len; i++) {
    bundle = bundles[i];
    console.info("- " + (getNodeName(bundle)));
  }

  nodeDownload = function(destination, options, callback) {
    var error;
    try {
      return binary.download(options, destination, function(error, binaryPath) {
        var output;
        if (error != null) {
          return callback(error);
        }
        output = path.join(destination, getNodeName(options));
        return fs.rename(binaryPath, output, function(error) {
          if (error != null) {
            return callback(error);
          }
          return callback(null, output);
        });
      });
    } catch (_error) {
      error = _error;
      return callback(error);
    }
  };

  async.eachLimit(bundles, 2, function(bundle, callback) {
    console.info("Downloading: " + (getNodeName(bundle)) + " to " + DESTINATION);
    return nodeDownload(DESTINATION, bundle, function(error, output) {
      if (error != null) {
        return callback(error);
      }
      console.info("Downloaded: " + (getNodeName(bundle)) + " to " + output);
      return callback();
    });
  }, function(error) {
    if (error != null) {
      console.error(error.message);
      return console.error('Error: Couldn\'t get the required node bundle. Omitting.');
    } else {
      return console.info('All NodeJS bundles downloaded');
    }
  });

}).call(this);
