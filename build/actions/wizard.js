(function() {
  var Promise, _, async, capitano, form, mkdirp, path, resin, userHome, visuals;

  _ = require('lodash-contrib');

  Promise = require('bluebird');

  capitano = Promise.promisifyAll(require('capitano'));

  path = require('path');

  mkdirp = require('mkdirp');

  userHome = require('user-home');

  visuals = require('resin-cli-visuals');

  async = require('async');

  resin = require('resin-sdk');

  form = require('resin-cli-form');

  exports.wizard = {
    signature: 'quickstart [name]',
    description: 'getting started with resin.io',
    help: 'Use this command to run a friendly wizard to get started with resin.io.\n\nThe wizard will guide you through:\n\n	- Create an application.\n	- Initialise an SDCard with the resin.io operating system.\n	- Associate an existing project directory with your resin.io application.\n	- Push your project to your devices.\n\nExamples:\n\n	$ sudo resin quickstart\n	$ sudo resin quickstart MyApp',
    root: true,
    permission: 'user',
    action: function(params, options, done) {
      return async.waterfall([
        function(callback) {
          if (params.name != null) {
            return callback();
          }
          return async.waterfall([
            function(callback) {
              return resin.models.application.hasAny().nodeify(callback);
            }, function(hasAnyApplications, callback) {
              if (!hasAnyApplications) {
                return callback(null, null);
              }
              return async.waterfall([
                function(callback) {
                  return resin.models.application.getAll().nodeify(callback);
                }, function(applications, callback) {
                  applications = _.pluck(applications, 'app_name');
                  applications.unshift({
                    name: 'Create a new application',
                    value: null
                  });
                  return form.ask({
                    message: 'Select an application',
                    type: 'list',
                    choices: applications
                  }).nodeify(callback);
                }
              ], callback);
            }, function(application, callback) {
              if (application != null) {
                return callback(null, application);
              }
              return form.ask({
                message: 'Choose a Name for your new application',
                type: 'input'
              }).then(function(applicationName) {
                return capitano.runAsync("app create " + applicationName)["return"](applicationName);
              }).nodeify(callback);
            }, function(applicationName, callback) {
              params.name = applicationName;
              return callback();
            }
          ], callback);
        }, function(callback) {
          return capitano.run("device init --application " + params.name, callback);
        }, function(deviceUuid, callback) {
          params.uuid = deviceUuid;
          return resin.models.device.getName(params.uuid).then(function(deviceName) {
            params.deviceName = deviceName;
            console.log("Waiting for " + params.deviceName + " to connect to resin...");
            return capitano.runAsync("device await " + params.uuid)["return"](callback);
          }).nodeify(callback);
        }, function(callback) {
          console.log("The device " + params.deviceName + " successfully connected to resin!");
          console.log('');
          return capitano.run("device " + params.uuid, callback);
        }, function(callback) {
          console.log('Your device is ready, lets start pushing some code!');
          return form.ask({
            message: 'Please choose a directory for your code',
            type: 'input',
            "default": path.join(userHome, 'ResinProjects', params.name)
          }).nodeify(callback);
        }, function(directoryName, callback) {
          params.directory = directoryName;
          return mkdirp(directoryName, callback);
        }, function(made, callback) {
          console.log("Associating " + params.name + " with " + params.directory + "...");
          process.chdir(params.directory);
          return capitano.run("app associate " + params.name + " --project " + params.directory, callback);
        }, function(remoteUrl, callback) {
          console.log("Resin git remote added: " + remoteUrl);
          console.log('Please type "git push resin master" into your project directory now!');
          return callback();
        }
      ], done);
    }
  };

}).call(this);
