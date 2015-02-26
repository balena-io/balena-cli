(function() {
  var _, async, drivelist, visuals;

  _ = require('lodash');

  async = require('async');

  visuals = require('resin-cli-visuals');

  drivelist = require('drivelist');

  exports.list = {
    signature: 'drives',
    description: 'list available drives',
    help: 'Use this command to list all drives that are connected to your machine.\n\nExamples:\n	$ resin drives',
    permission: 'user',
    action: function(params, options, done) {
      return drivelist.list(function(error, drives) {
        if (error != null) {
          return done(error);
        }
        return async.reject(drives, drivelist.isSystem, function(removableDrives) {
          if (_.isEmpty(removableDrives)) {
            return done(new Error('No removable devices available'));
          }
          console.log(visuals.widgets.table.horizontal(removableDrives, ['device', 'description', 'size']));
          return done();
        });
      });
    }
  };

}).call(this);
