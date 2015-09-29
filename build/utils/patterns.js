(function() {
  var Promise, _, form, helpers, resin, visuals;

  _ = require('lodash');

  Promise = require('bluebird');

  form = require('resin-cli-form');

  visuals = require('resin-cli-visuals');

  resin = require('resin-sdk');

  helpers = require('./helpers');

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

  exports.selectApplication = function() {
    return resin.models.application.hasAny().then(function(hasAnyApplications) {
      if (!hasAnyApplications) {
        throw new Error('You don\'t have any applications');
      }
      return resin.models.application.getAll().then(function(applications) {
        return form.ask({
          message: 'Select an application',
          type: 'list',
          choices: _.pluck(applications, 'app_name')
        });
      });
    });
  };

  exports.selectOrCreateApplication = function() {
    return resin.models.application.hasAny().then(function(hasAnyApplications) {
      if (!hasAnyApplications) {
        return;
      }
      return resin.models.application.getAll().then(function(applications) {
        applications = _.pluck(applications, 'app_name');
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
        type: 'input'
      });
    });
  };

  exports.selectProjectDirectory = function() {
    return resin.settings.get('projectsDirectory').then(function(projectsDirectory) {
      return form.ask({
        message: 'Please choose a directory for your code',
        type: 'input',
        "default": projectsDirectory
      });
    });
  };

  exports.awaitDevice = function(uuid) {
    var poll, spinner;
    spinner = new visuals.Spinner("Waiting for your device to come online: " + uuid);
    poll = function() {
      return resin.models.device.isOnline(uuid).then(function(isOnline) {
        if (isOnline) {
          spinner.stop();
          console.info("Device became online: " + uuid);
        } else {
          spinner.start();
          return Promise.delay(3000).then(poll);
        }
      });
    };
    return resin.models.device.getName(uuid).then(function(deviceName) {
      console.info("Waiting for " + deviceName + " to connect to resin...");
      return poll()["return"](uuid);
    });
  };

}).call(this);
