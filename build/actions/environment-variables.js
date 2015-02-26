(function() {
  var _, commandOptions, resin, visuals;

  _ = require('lodash-contrib');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  commandOptions = require('./command-options');

  exports.list = {
    signature: 'envs',
    description: 'list all environment variables',
    help: 'Use this command to list all environment variables for a particular application.\nNotice we will support per-device environment variables soon.\n\nThis command lists all custom environment variables set on the devices running\nthe application. If you want to see all environment variables, including private\nones used by resin, use the verbose option.\n\nExample:\n	$ resin envs --application 91\n	$ resin envs --application 91 --verbose',
    options: [
      commandOptions.application, {
        signature: 'verbose',
        description: 'show private environment variables',
        boolean: true,
        alias: 'v'
      }
    ],
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.environmentVariables.getAllByApplication(options.application, function(error, environmentVariables) {
        if (error != null) {
          return done(error);
        }
        if (!options.verbose) {
          environmentVariables = _.reject(environmentVariables, resin.models.environmentVariables.isSystemVariable);
        }
        console.log(visuals.widgets.table.horizontal(environmentVariables, ['id', 'name', 'value']));
        return done();
      });
    }
  };

  exports.remove = {
    signature: 'env rm <id>',
    description: 'remove an environment variable',
    help: 'Use this command to remove an environment variable from an application.\n\nDon\'t remove resin specific variables, as things might not work as expected.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n	$ resin env rm 215\n	$ resin env rm 215 --yes',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      return visuals.patterns.remove('environment variable', options.yes, function(callback) {
        return resin.models.environmentVariables.remove(params.id, callback);
      }, done);
    }
  };

  exports.add = {
    signature: 'env add <key> [value]',
    description: 'add an environment variable',
    help: 'Use this command to add an enviroment variable to an application.\n\nYou need to pass the `--application` option.\n\nIf value is omitted, the tool will attempt to use the variable\'s value\nas defined in your host machine.\n\nIf the value is grabbed from the environment, a warning message will be printed.\nUse `--quiet` to remove it.\n\nExamples:\n	$ resin env add EDITOR vim -a 91\n	$ resin env add TERM -a 91',
    options: [commandOptions.application],
    permission: 'user',
    action: function(params, options, done) {
      if (params.value == null) {
        params.value = process.env[params.key];
        if (params.value == null) {
          return done(new Error("Environment value not found for key: " + params.key));
        } else {
          console.info("Warning: using " + params.key + "=" + params.value + " from host environment");
        }
      }
      return resin.models.environmentVariables.create(options.application, params.key, params.value, done);
    }
  };

  exports.rename = {
    signature: 'env rename <id> <value>',
    description: 'rename an environment variable',
    help: 'Use this command to rename an enviroment variable from an application.\n\nExamples:\n	$ resin env rename 376 emacs',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.environmentVariables.update(params.id, params.value, done);
    }
  };

}).call(this);
