(function() {
  var _, async, commandOptions, resin, visuals;

  async = require('async');

  _ = require('lodash-contrib');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  commandOptions = require('./command-options');

  exports.list = {
    signature: 'envs',
    description: 'list all environment variables',
    help: 'Use this command to list all environment variables for\na particular application or device.\n\nThis command lists all custom environment variables.\nIf you want to see all environment variables, including private\nones used by resin, use the verbose option.\n\nExample:\n\n	$ resin envs --application MyApp\n	$ resin envs --application MyApp --verbose\n	$ resin envs --device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9',
    options: [
      commandOptions.optionalApplication, commandOptions.optionalDevice, {
        signature: 'verbose',
        description: 'show private environment variables',
        boolean: true,
        alias: 'v'
      }
    ],
    permission: 'user',
    action: function(params, options, done) {
      return async.waterfall([
        function(callback) {
          if (options.application != null) {
            return resin.models.environmentVariables.getAllByApplication(options.application).nodeify(callback);
          } else if (options.device != null) {
            return resin.models.environmentVariables.device.getAll(options.device).nodeify(callback);
          } else {
            return callback(new Error('You must specify an application or device'));
          }
        }, function(environmentVariables, callback) {
          var isSystemVariable;
          if (!options.verbose) {
            isSystemVariable = resin.models.environmentVariables.isSystemVariable;
            environmentVariables = _.reject(environmentVariables, isSystemVariable);
          }
          console.log(visuals.widgets.table.horizontal(environmentVariables, ['id', 'name', 'value']));
          return callback();
        }
      ], done);
    }
  };

  exports.remove = {
    signature: 'env rm <id>',
    description: 'remove an environment variable',
    help: 'Use this command to remove an environment variable from an application.\n\nDon\'t remove resin specific variables, as things might not work as expected.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nIf you want to eliminate a device environment variable, pass the `--device` boolean option.\n\nExamples:\n\n	$ resin env rm 215\n	$ resin env rm 215 --yes\n	$ resin env rm 215 --device',
    options: [commandOptions.yes, commandOptions.booleanDevice],
    permission: 'user',
    action: function(params, options, done) {
      return async.waterfall([
        function(callback) {
          if (options.yes) {
            return callback(null, true);
          } else {
            return form.ask({
              message: 'Are you sure you want to delete the environment variable?',
              type: 'confirm',
              "default": false
            }).nodeify(callback);
          }
        }, function(confirmed, callback) {
          if (!confirmed) {
            return callback();
          }
          if (options.device) {
            return resin.models.environmentVariables.device.remove(params.id).nodeify(callback);
          } else {
            return resin.models.environmentVariables.remove(params.id).nodeify(callback);
          }
        }
      ], done);
    }
  };

  exports.add = {
    signature: 'env add <key> [value]',
    description: 'add an environment variable',
    help: 'Use this command to add an enviroment variable to an application.\n\nIf value is omitted, the tool will attempt to use the variable\'s value\nas defined in your host machine.\n\nUse the `--device` option if you want to assign the environment variable\nto a specific device.\n\nIf the value is grabbed from the environment, a warning message will be printed.\nUse `--quiet` to remove it.\n\nExamples:\n\n	$ resin env add EDITOR vim --application MyApp\n	$ resin env add TERM --application MyApp\n	$ resin env add EDITOR vim --device MyDevice',
    options: [commandOptions.optionalApplication, commandOptions.optionalDevice],
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
      if (options.application != null) {
        return resin.models.environmentVariables.create(options.application, params.key, params.value).nodeify(done);
      } else if (options.device != null) {
        return resin.models.environmentVariables.device.create(options.device, params.key, params.value).nodeify(done);
      } else {
        return done(new Error('You must specify an application or device'));
      }
    }
  };

  exports.rename = {
    signature: 'env rename <id> <value>',
    description: 'rename an environment variable',
    help: 'Use this command to rename an enviroment variable from an application.\n\nPass the `--device` boolean option if you want to rename a device environment variable.\n\nExamples:\n\n	$ resin env rename 376 emacs\n	$ resin env rename 376 emacs --device',
    permission: 'user',
    options: [commandOptions.booleanDevice],
    action: function(params, options, done) {
      if (options.device) {
        return resin.models.environmentVariables.device.update(params.id, params.value).nodeify(done);
      } else {
        return resin.models.environmentVariables.update(params.id, params.value).nodeify(done);
      }
    }
  };

}).call(this);
