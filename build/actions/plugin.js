(function() {
  var _, commandOptions, plugins, visuals;

  _ = require('lodash');

  visuals = require('resin-cli-visuals');

  commandOptions = require('./command-options');

  plugins = require('../plugins');

  exports.list = {
    signature: 'plugins',
    description: 'list all plugins',
    help: 'Use this command to list all the installed resin plugins.\n\nExamples:\n	$ resin plugins',
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
        console.log(visuals.widgets.table.horizontal(resinPlugins, ['name', 'version', 'description', 'license']));
        return done();
      });
    }
  };

  exports.install = {
    signature: 'plugin install <name>',
    description: 'install a plugin',
    help: 'Use this command to install a resin plugin\n\nExamples:\n	$ resin plugin install hello',
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

  exports.remove = {
    signature: 'plugin rm <name>',
    description: 'remove a plugin',
    help: 'Use this command to remove a resin.io plugin.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n	$ resin plugin rm hello\n	$ resin plugin rm hello --yes',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      return visuals.patterns.remove('plugin', options.yes, function(callback) {
        return plugins.remove(params.name, callback);
      }, function(error) {
        if (error != null) {
          return done(error);
        }
        console.info("Plugin removed: " + params.name);
        return done();
      });
    }
  };

}).call(this);
