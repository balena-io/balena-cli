
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
  var Promise, _, chalk, form, messages, resin, validation, visuals;

  _ = require('lodash');

  Promise = require('bluebird');

  form = require('resin-cli-form');

  visuals = require('resin-cli-visuals');

  resin = require('resin-sdk');

  chalk = require('chalk');

  validation = require('./validation');

  messages = require('./messages');

  exports.authenticate = function(options) {
    return form.run([
      {
        message: 'Email:',
        name: 'email',
        type: 'input',
        validate: validation.validateEmail
      }, {
        message: 'Password:',
        name: 'password',
        type: 'password'
      }
    ], {
      override: options
    }).then(resin.auth.login).then(resin.auth.twoFactor.isPassed).then(function(isTwoFactorAuthPassed) {
      if (isTwoFactorAuthPassed) {
        return;
      }
      return form.ask({
        message: 'Two factor auth challenge:',
        name: 'code',
        type: 'input'
      }).then(resin.auth.twoFactor.challenge)["catch"](function(error) {
        return resin.auth.logout().then(function() {
          if (error.name === 'ResinRequestError' && error.statusCode === 401) {
            throw new Error('Invalid two factor authentication code');
          }
          throw error;
        });
      });
    });
  };

  exports.askLoginType = function() {
    return form.ask({
      message: 'How would you like to login?',
      name: 'loginType',
      type: 'list',
      choices: [
        {
          name: 'Web authorization (recommended)',
          value: 'web'
        }, {
          name: 'Credentials',
          value: 'credentials'
        }, {
          name: 'Authentication token',
          value: 'token'
        }, {
          name: 'I don\'t have a Resin account!',
          value: 'register'
        }
      ]
    });
  };

  exports.selectDeviceType = function() {
    return resin.models.device.getSupportedDeviceTypes().then(function(deviceTypes) {
      return form.ask({
        message: 'Device Type',
        type: 'list',
        choices: deviceTypes
      });
    });
  };

  exports.confirm = function(yesOption, message) {
    return Promise["try"](function() {
      if (yesOption) {
        return true;
      }
      return form.ask({
        message: message,
        type: 'confirm',
        "default": false
      });
    }).then(function(confirmed) {
      if (!confirmed) {
        throw new Error('Aborted');
      }
    });
  };

  exports.selectApplication = function(filter) {
    return resin.models.application.hasAny().then(function(hasAnyApplications) {
      if (!hasAnyApplications) {
        throw new Error('You don\'t have any applications');
      }
      return resin.models.application.getAll();
    }).filter(filter || _.constant(true)).then(function(applications) {
      return form.ask({
        message: 'Select an application',
        type: 'list',
        choices: _.map(applications, function(application) {
          return {
            name: application.app_name + " (" + application.device_type + ")",
            value: application.app_name
          };
        })
      });
    });
  };

  exports.selectOrCreateApplication = function() {
    return resin.models.application.hasAny().then(function(hasAnyApplications) {
      if (!hasAnyApplications) {
        return;
      }
      return resin.models.application.getAll().then(function(applications) {
        applications = _.map(applications, function(application) {
          return {
            name: application.app_name + " (" + application.device_type + ")",
            value: application.app_name
          };
        });
        applications.unshift({
          name: 'Create a new application',
          value: null
        });
        return form.ask({
          message: 'Select an application',
          type: 'list',
          choices: applications
        });
      });
    }).then(function(application) {
      if (application != null) {
        return application;
      }
      return form.ask({
        message: 'Choose a Name for your new application',
        type: 'input',
        validate: validation.validateApplicationName
      });
    });
  };

  exports.awaitDevice = function(uuid) {
    return resin.models.device.getName(uuid).then(function(deviceName) {
      var poll, spinner;
      spinner = new visuals.Spinner("Waiting for " + deviceName + " to come online");
      poll = function() {
        return resin.models.device.isOnline(uuid).then(function(isOnline) {
          if (isOnline) {
            spinner.stop();
            console.info("The device **" + deviceName + "** is online!");
          } else {
            spinner.start();
            return Promise.delay(3000).then(poll);
          }
        });
      };
      console.info("Waiting for " + deviceName + " to connect to resin...");
      return poll()["return"](uuid);
    });
  };

  exports.inferOrSelectDevice = function(applicationName) {
    return Promise["try"](function() {
      if (applicationName != null) {
        return resin.models.device.getAllByApplication(applicationName);
      }
      return resin.models.device.getAll();
    }).then(function(devices) {
      if (_.isEmpty(devices)) {
        throw new Error('You don\'t have any devices');
      }
      if (devices.length === 1) {
        return _.first(devices).uuid;
      }
      return form.ask({
        message: 'Select a device',
        type: 'list',
        choices: _.map(devices, function(device) {
          return {
            name: (device.name || 'Untitled') + " (" + (device.uuid.slice(0, 7)) + ")",
            value: device.uuid
          };
        })
      });
    });
  };

  exports.printErrorMessage = function(message) {
    console.error(chalk.red(message));
    return console.error(chalk.red("\n" + messages.getHelp + "\n"));
  };

}).call(this);
