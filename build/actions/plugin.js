(function() {
  var _, async, commandOptions, form, plugins, visuals;

  _ = require('lodash');

  visuals = require('resin-cli-visuals');

  commandOptions = require('./command-options');

  plugins = require('../plugins');

  form = require('resin-cli-form');

  async = require('async');

  exports.list = {
    signature: 'plugins',
    description: 'list all plugins',
    help: 'Use this command to list all the installed resin plugins.\n\nExamples:\n\n	$ resin plugins',
    permission: 'user',
    action: function(params, options, done) {
      return plugins.list(function(error, resinPlugins) {
        if (error != null) {
          return done(error);
        }
        if (_.isEmpty(resinPlugins)) {
          console.log('You don\'t have any plugins yet');
          return done();
        }
        console.log(visuals.table.horizontal(resinPlugins, ['name', 'version', 'description', 'license']));
        return done();
      });
    }
  };

  exports.install = {
    signature: 'plugin install <name>',
    description: 'install a plugin',
    help: 'Use this command to install a resin plugin\n\nUse `--quiet` to prevent information logging.\n\nExamples:\n\n	$ resin plugin install hello',
    permission: 'user',
    action: function(params, options, done) {
      return plugins.install(params.name, function(error) {
        if (error != null) {
          return done(error);
        }
        console.info("Plugin installed: " + params.name);
        return done();
      });
    }
  };

  exports.update = {
    signature: 'plugin update <name>',
    description: 'update a plugin',
    help: 'Use this command to update a resin plugin\n\nUse `--quiet` to prevent information logging.\n\nExamples:\n\n	$ resin plugin update hello',
    permission: 'user',
    action: function(params, options, done) {
      return plugins.update(params.name, function(error, version) {
        if (error != null) {
          return done(error);
        }
        console.info("Plugin updated: " + params.name + "@" + version);
        return done();
      });
    }
  };

  exports.remove = {
    signature: 'plugin rm <name>',
    description: 'remove a plugin',
    help: 'Use this command to remove a resin.io plugin.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n\n	$ resin plugin rm hello\n	$ resin plugin rm hello --yes',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      return async.waterfall([
        function(callback) {
          if (options.yes) {
            return callback(null, true);
          } else {
            return form.ask({
              message: 'Are you sure you want to delete the plugin?',
              type: 'confirm',
              "default": false
            }).nodeify(callback);
          }
        }, function(confirmed, callback) {
          if (!confirmed) {
            return callback();
          }
          return plugins.remove(params.name, callback);
        }, function(error) {
          if (error != null) {
            return done(error);
          }
          console.info("Plugin removed: " + params.name);
          return done();
        }
      ]);
    }
  };

}).call(this);
