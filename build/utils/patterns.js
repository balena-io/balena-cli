(function() {
  var Promise, _, form, helpers, manager, resin, visuals;

  _ = require('lodash');

  Promise = require('bluebird');

  form = require('resin-cli-form');

  visuals = require('resin-cli-visuals');

  resin = require('resin-sdk');

  manager = require('resin-image-manager');

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
    spinner = new visuals.Spinner("Awaiting device: " + uuid);
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

  exports.askDeviceOptions = function(deviceType) {
    return resin.models.config.getDeviceOptions(deviceType).then(form.run).then(function(answers) {
      if (answers.os == null) {
        answers.os = helpers.getOperatingSystem();
      }
      return answers;
    });
  };

  exports.download = function(deviceType) {
    return manager.get(deviceType).then(function(stream) {
      var bar, spinner;
      bar = new visuals.Progress('Downloading Device OS');
      spinner = new visuals.Spinner('Downloading Device OS (size unknown)');
      stream.on('progress', function(state) {
        if (state != null) {
          return bar.update(state);
        } else {
          return spinner.start();
        }
      });
      stream.on('end', function() {
        return spinner.stop();
      });
      return manager.pipeTemporal(stream);
    });
  };

}).call(this);
