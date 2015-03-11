(function() {
  var _, async, npm;

  npm = require('npm');

  async = require('async');

  _ = require('lodash-contrib');

  exports.update = function(name, callback) {
    return async.waterfall([
      function(callback) {
        var options;
        options = {
          loglevel: 'silent',
          global: true
        };
        return npm.load(options, _.unary(callback));
      }, function(callback) {
        return npm.commands.update([name], function(error, data) {
          return callback(error, data);
        });
      }, function(data, callback) {
        var error, newVersion;
        if (_.isEmpty(data)) {
          error = new Error('You are already running the latest version');
          return callback(error);
        }
        newVersion = _.last(_.first(_.last(data)).split('@'));
        return callback(null, newVersion);
      }
    ], callback);
  };

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
