(function() {
  var _, async, commandOptions, path, resin, vcs, visuals;

  path = require('path');

  _ = require('lodash-contrib');

  async = require('async');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  commandOptions = require('./command-options');

  vcs = require('resin-vcs');

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
    action: function(params, options, done) {
      return async.waterfall([
        function(callback) {
          if (options.type != null) {
            return callback(null, options.type);
          }
          return resin.models.device.getSupportedDeviceTypes(function(error, deviceTypes) {
            if (error != null) {
              return callback(error);
            }
            return visuals.widgets.select('Select a type', deviceTypes, callback);
          });
        }, function(type, callback) {
          return resin.models.application.create(params.name, type, callback);
        }
      ], done);
    }
  };

  exports.list = {
    signature: 'apps',
    description: 'list all applications',
    help: 'Use this command to list all your applications.\n\nNotice this command only shows the most important bits of information for each app.\nIf you want detailed information, use resin app <id> instead.\n\nExamples:\n\n	$ resin apps',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.application.getAll(function(error, applications) {
        if (error != null) {
          return done(error);
        }
        console.log(visuals.widgets.table.horizontal(applications, ['id', 'app_name', 'device_type', 'online_devices', 'devices_length']));
        return done();
      });
    }
  };

  exports.info = {
    signature: 'app <id>',
    description: 'list a single application',
    help: 'Use this command to show detailed information for a single application.\n\nExamples:\n\n	$ resin app 91',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.application.get(params.id, function(error, application) {
        if (error != null) {
          return done(error);
        }
        console.log(visuals.widgets.table.vertical(application, ['id', 'app_name', 'device_type', 'git_repository', 'commit']));
        return done();
      });
    }
  };

  exports.restart = {
    signature: 'app restart <id>',
    description: 'restart an application',
    help: 'Use this command to restart all devices that belongs to a certain application.\n\nExamples:\n\n	$ resin app restart 91',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.application.restart(params.id, done);
    }
  };

  exports.remove = {
    signature: 'app rm <id>',
    description: 'remove an application',
    help: 'Use this command to remove a resin.io application.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n\n	$ resin app rm 91\n	$ resin app rm 91 --yes',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      return visuals.patterns.remove('application', options.yes, function(callback) {
        return resin.models.application.remove(params.id, callback);
      }, done);
    }
  };

  exports.associate = {
    signature: 'app associate <id>',
    description: 'associate a resin project',
    help: 'Use this command to associate a project directory with a resin application.\n\nThis command adds a \'resin\' git remote to the directory and runs git init if necessary.\n\nExamples:\n\n	$ resin app associate 91\n	$ resin app associate 91 --project my/app/directory',
    permission: 'user',
    action: function(params, options, done) {
      var currentDirectory;
      currentDirectory = process.cwd();
      return async.waterfall([
        function(callback) {
          return vcs.initialize(currentDirectory, callback);
        }, function(callback) {
          return resin.models.application.get(params.id, callback);
        }, function(application, callback) {
          return vcs.addRemote(currentDirectory, application.git_repository, callback);
        }
      ], function(error, remoteUrl) {
        if (error != null) {
          return done(error);
        }
        console.info("git repository added: " + remoteUrl);
        return done(null, remoteUrl);
      });
    }
  };

  exports.init = {
    signature: 'init',
    description: 'init an application',
    help: 'Use this command to initialise a directory as a resin application.\n\nThis command performs the following steps:\n	- Create a resin.io application.\n	- Initialize the current directory as a git repository.\n	- Add the corresponding git remote to the application.\n\nExamples:\n\n	$ resin init\n	$ resin init --project my/app/directory',
    permission: 'user',
    action: function(params, options, done) {
      var currentDirectory;
      currentDirectory = process.cwd();
      return async.waterfall([
        function(callback) {
          var currentDirectoryBasename;
          currentDirectoryBasename = path.basename(currentDirectory);
          return visuals.widgets.ask('What is the name of your application?', currentDirectoryBasename, callback);
        }, function(applicationName, callback) {
          return exports.create.action({
            name: applicationName
          }, options, callback);
        }, function(applicationId, callback) {
          return exports.associate.action({
            id: applicationId
          }, options, callback);
        }
      ], done);
    }
  };

}).call(this);
