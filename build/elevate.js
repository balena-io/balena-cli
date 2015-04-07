(function() {
  var isWindows, os, path;

  os = require('os');

  path = require('path');

  isWindows = function() {
    return os.platform() === 'win32';
  };

  exports.shouldElevate = function(error) {
    return _.all([isWindows(), error.code === 'EPERM' || error.code === 'EACCES']);
  };

  exports.run = function(command) {
    if (!isWindows()) {
      return;
    }
    return require('windosu').exec(command);
  };

}).call(this);
