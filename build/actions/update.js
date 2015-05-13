(function() {
  var packageJSON, selfupdate;

  selfupdate = require('selfupdate');

  packageJSON = require('../../package.json');

  exports.update = {
    signature: 'update',
    description: 'update the resin cli',
    help: 'Use this command to update the Resin CLI\n\nThis command outputs information about the update process.\nUse `--quiet` to remove that output.\n\nThe Resin CLI checks for updates once per day.\n\nMajor updates require a manual update with this update command,\nwhile minor updates are applied automatically.\n\nExamples:\n\n	$ resin update',
    action: function(params, options, done) {
      return selfupdate.update(packageJSON, function(error, version) {
        if (error != null) {
          return done(error);
        }
        console.info("Updated " + packageJSON.name + " to version " + version + ".");
        return done();
      });
    }
  };

}).call(this);
