(function() {
  var _, async, npm;

  npm = require('npm');

  async = require('async');

  _ = require('lodash-contrib');

  exports.getLatestVersion = function(name, callback) {
    return async.waterfall([
      function(callback) {
        var options;
        options = {
          loglevel: 'silent',
          global: true
        };
        return npm.load(options, _.unary(callback));
      }, function(callback) {
        return npm.commands.view([name], true, function(error, data) {
          var versions;
          versions = _.keys(data);
          return callback(error, _.first(versions));
        });
      }
    ], callback);
  };

  exports.isUpdated = function(name, currentVersion, callback) {
    return exports.getLatestVersion(name, function(error, latestVersion) {
      if (error != null) {
        return callback(error);
      }
      return callback(null, currentVersion === latestVersion);
    });
  };

}).call(this);
