(function() {
  var child_process, npm, packageJSON;

  child_process = require('child_process');

  npm = require('../npm');

  packageJSON = require('../../package.json');

  exports.update = {
    signature: 'update',
    description: 'update the resin cli',
    help: 'Use this command to update the Resin CLI\n\nThis command outputs information about the update process.\nUse `--quiet` to remove that output.\n\nThe Resin CLI checks for updates once per day.\n\nMajor updates require a manual update with this update command,\nwhile minor updates are applied automatically.\n\nExamples:\n\n	$ resin update',
    action: function(params, options, done) {
      return npm.isUpdated(packageJSON.name, packageJSON.version, function(error, isUpdated) {
        if (error != null) {
          return done(error);
        }
        if (isUpdated) {
          return done(new Error('You\'re already running the latest version.'));
        }
        return child_process.exec("npm install -g " + packageJSON.name, function(error, stdout, stderr) {
          if (error != null) {
            return done(error);
          }
          if (!_.isEmpty(stderr)) {
            return done(new Error(stderr));
          }
          console.info("Upgraded " + packageJSON.name + ".");
          return done();
        });
      });
    }
  };

}).call(this);
