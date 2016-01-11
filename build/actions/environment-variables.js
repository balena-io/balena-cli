
/*
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

(function() {
  var commandOptions;

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
      var Promise, _, resin, visuals;
      Promise = require('bluebird');
      _ = require('lodash');
      resin = require('resin-sdk');
      visuals = require('resin-cli-visuals');
      return Promise["try"](function() {
        if (options.application != null) {
          return resin.models.environmentVariables.getAllByApplication(options.application);
        } else if (options.device != null) {
          return resin.models.environmentVariables.device.getAll(options.device);
        } else {
          throw new Error('You must specify an application or device');
        }
      }).tap(function(environmentVariables) {
        var isSystemVariable;
        if (_.isEmpty(environmentVariables)) {
          throw new Error('No environment variables found');
        }
        if (!options.verbose) {
          isSystemVariable = resin.models.environmentVariables.isSystemVariable;
          environmentVariables = _.reject(environmentVariables, isSystemVariable);
        }
        return console.log(visuals.table.horizontal(environmentVariables, ['id', 'name', 'value']));
      }).nodeify(done);
    }
  };

  exports.remove = {
    signature: 'env rm <id>',
    description: 'remove an environment variable',
    help: 'Use this command to remove an environment variable from an application.\n\nDon\'t remove resin specific variables, as things might not work as expected.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nIf you want to eliminate a device environment variable, pass the `--device` boolean option.\n\nExamples:\n\n	$ resin env rm 215\n	$ resin env rm 215 --yes\n	$ resin env rm 215 --device',
    options: [commandOptions.yes, commandOptions.booleanDevice],
    permission: 'user',
    action: function(params, options, done) {
      var events, patterns, resin;
      resin = require('resin-sdk');
      events = require('resin-cli-events');
      patterns = require('../utils/patterns');
      return patterns.confirm(options.yes, 'Are you sure you want to delete the environment variable?').then(function() {
        if (options.device) {
          resin.models.environmentVariables.device.remove(params.id);
          return events.send('deviceEnvironmentVariable.delete', {
            id: params.id
          });
        } else {
          resin.models.environmentVariables.remove(params.id);
          return events.send('environmentVariable.delete', {
            id: params.id
          });
        }
      }).nodeify(done);
    }
  };

  exports.add = {
    signature: 'env add <key> [value]',
    description: 'add an environment variable',
    help: 'Use this command to add an enviroment variable to an application.\n\nIf value is omitted, the tool will attempt to use the variable\'s value\nas defined in your host machine.\n\nUse the `--device` option if you want to assign the environment variable\nto a specific device.\n\nIf the value is grabbed from the environment, a warning message will be printed.\nUse `--quiet` to remove it.\n\nExamples:\n\n	$ resin env add EDITOR vim --application MyApp\n	$ resin env add TERM --application MyApp\n	$ resin env add EDITOR vim --device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9',
    options: [commandOptions.optionalApplication, commandOptions.optionalDevice],
    permission: 'user',
    action: function(params, options, done) {
      var Promise, events, resin;
      Promise = require('bluebird');
      resin = require('resin-sdk');
      events = require('resin-cli-events');
      return Promise["try"](function() {
        if (params.value == null) {
          params.value = process.env[params.key];
          if (params.value == null) {
            throw new Error("Environment value not found for key: " + params.key);
          } else {
            console.info("Warning: using " + params.key + "=" + params.value + " from host environment");
          }
        }
        if (options.application != null) {
          return resin.models.environmentVariables.create(options.application, params.key, params.value).then(function() {
            return resin.models.application.get(options.application).then(function(application) {
              return events.send('environmentVariable.create', {
                application: application.id
              });
            });
          });
        } else if (options.device != null) {
          return resin.models.environmentVariables.device.create(options.device, params.key, params.value).then(function() {
            return events.send('deviceEnvironmentVariable.create', {
              device: options.device
            });
          });
        } else {
          throw new Error('You must specify an application or device');
        }
      }).nodeify(done);
    }
  };

  exports.rename = {
    signature: 'env rename <id> <value>',
    description: 'rename an environment variable',
    help: 'Use this command to rename an enviroment variable from an application.\n\nPass the `--device` boolean option if you want to rename a device environment variable.\n\nExamples:\n\n	$ resin env rename 376 emacs\n	$ resin env rename 376 emacs --device',
    permission: 'user',
    options: [commandOptions.booleanDevice],
    action: function(params, options, done) {
      var Promise, events, resin;
      Promise = require('bluebird');
      resin = require('resin-sdk');
      events = require('resin-cli-events');
      return Promise["try"](function() {
        if (options.device) {
          return resin.models.environmentVariables.device.update(params.id, params.value).then(function() {
            return events.send('deviceEnvironmentVariable.edit', {
              id: params.id
            });
          });
        } else {
          return resin.models.environmentVariables.update(params.id, params.value).then(function() {
            return events.send('environmentVariable.edit', {
              id: params.id
            });
          });
        }
      }).nodeify(done);
    }
  };

}).call(this);
