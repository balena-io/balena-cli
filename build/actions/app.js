(function() {
  var _, commandOptions, events, helpers, patterns, resin, vcs, visuals;

  _ = require('lodash');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  commandOptions = require('./command-options');

  vcs = require('resin-vcs');

  events = require('resin-cli-events');

  helpers = require('../utils/helpers');

  patterns = require('../utils/patterns');

  exports.create = {
    signature: 'app create <name>',
    description: 'create an application',
    help: 'Use this command to create a new resin.io application.\n\nYou can specify the application type with the `--type` option.\nOtherwise, an interactive dropdown will be shown for you to select from.\n\nYou can see a list of supported device types with\n\n	$ resin devices supported\n\nExamples:\n\n	$ resin app create MyApp\n	$ resin app create MyApp --type raspberry-pi',
    options: [
      {
        signature: 'type',
        parameter: 'type',
        description: 'application type',
        alias: 't'
      }
    ],
    permission: 'user',
    primary: true,
    action: function(params, options, done) {
      return resin.models.application.has(params.name).then(function(hasApplication) {
        if (hasApplication) {
          throw new Error('You already have an application with that name!');
        }
      }).then(patterns.selectDeviceType).then(function(deviceType) {
        return resin.models.application.create(params.name, deviceType);
      }).then(function(application) {
        console.info("Application created: " + application.app_name + " (" + application.device_type + ", id " + application.id + ")");
        return events.send('application.create', {
          application: application.id
        });
      }).nodeify(done);
    }
  };

  exports.list = {
    signature: 'apps',
    description: 'list all applications',
    help: 'Use this command to list all your applications.\n\nNotice this command only shows the most important bits of information for each app.\nIf you want detailed information, use resin app <name> instead.\n\nExamples:\n\n	$ resin apps',
    permission: 'user',
    primary: true,
    action: function(params, options, done) {
      return resin.models.application.getAll().then(function(applications) {
        return console.log(visuals.table.horizontal(applications, ['id', 'app_name', 'device_type', 'online_devices', 'devices_length']));
      }).nodeify(done);
    }
  };

  exports.info = {
    signature: 'app <name>',
    description: 'list a single application',
    help: 'Use this command to show detailed information for a single application.\n\nExamples:\n\n	$ resin app MyApp',
    permission: 'user',
    primary: true,
    action: function(params, options, done) {
      return resin.models.application.get(params.name).then(function(application) {
        console.log(visuals.table.vertical(application, ["$" + application.app_name + "$", 'id', 'device_type', 'git_repository', 'commit']));
        return events.send('application.open', {
          application: application.id
        });
      }).nodeify(done);
    }
  };

  exports.restart = {
    signature: 'app restart <name>',
    description: 'restart an application',
    help: 'Use this command to restart all devices that belongs to a certain application.\n\nExamples:\n\n	$ resin app restart MyApp',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.application.restart(params.name).nodeify(done);
    }
  };

  exports.remove = {
    signature: 'app rm <name>',
    description: 'remove an application',
    help: 'Use this command to remove a resin.io application.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n\n	$ resin app rm MyApp\n	$ resin app rm MyApp --yes',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      return patterns.confirm(options.yes, 'Are you sure you want to delete the application?').then(function() {
        return resin.models.application.remove(params.name);
      }).tap(function() {
        return resin.models.application.get(params.name).then(function(application) {
          return events.send('application.delete', {
            application: application.id
          });
        });
      }).nodeify(done);
    }
  };

  exports.associate = {
    signature: 'app associate <name>',
    description: 'associate a resin project',
    help: 'Use this command to associate a project directory with a resin application.\n\nThis command adds a \'resin\' git remote to the directory and runs git init if necessary.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n\n	$ resin app associate MyApp',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      var currentDirectory;
      currentDirectory = process.cwd();
      console.info("Associating " + params.name + " with " + currentDirectory);
      return resin.models.application.has(params.name).then(function(hasApplication) {
        if (!hasApplication) {
          throw new Error("Invalid application: " + params.name);
        }
      }).then(function() {
        var message;
        message = "Are you sure you want to associate " + currentDirectory + " with " + params.name + "?";
        return patterns.confirm(options.yes, message);
      }).then(function() {
        return resin.models.application.get(params.name).get('git_repository').then(function(gitRepository) {
          return vcs.initialize(currentDirectory).then(function() {
            return vcs.associate(currentDirectory, gitRepository);
          }).then(function() {
            console.info("git repository added: " + gitRepository);
            return gitRepository;
          });
        });
      }).nodeify(done);
    }
  };

}).call(this);
