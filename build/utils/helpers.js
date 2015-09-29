(function() {
  var Promise, _, chalk, os;

  Promise = require('bluebird');

  _ = require('lodash');

  _.str = require('underscore.string');

  os = require('os');

  chalk = require('chalk');

  exports.getOperatingSystem = function() {
    var platform;
    platform = os.platform();
    if (platform === 'darwin') {
      platform = 'osx';
    }
    return platform;
  };

  exports.stateToString = function(state) {
    var percentage, result;
    percentage = _.str.lpad(state.percentage, 3, '0') + '%';
    result = (chalk.blue(percentage)) + " " + (chalk.cyan(state.operation.command));
    switch (state.operation.command) {
      case 'copy':
        return result + " " + state.operation.from.path + " -> " + state.operation.to.path;
      case 'replace':
        return result + " " + state.operation.file.path + ", " + state.operation.copy + " -> " + state.operation.replace;
      case 'run-script':
        return result + " " + state.operation.script;
      default:
        throw new Error("Unsupported operation: " + state.operation.type);
    }
  };

  exports.waitStream = function(stream) {
    return new Promise(function(resolve, reject) {
      stream.on('close', resolve);
      stream.on('end', resolve);
      return stream.on('error', reject);
    });
  };

}).call(this);
