(function() {
  var _, async, commandOptions, osAction, path, resin, vcs, visuals;

  _ = require('lodash-contrib');

  path = require('path');

  async = require('async');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  vcs = require('resin-vcs');

  commandOptions = require('./command-options');

  osAction = require('./os');

  exports.list = {
    signature: 'devices',
    description: 'list all devices',
    help: 'Use this command to list all devices that belong to a certain application.\n\nExamples:\n\n	$ resin devices --application 91',
    options: [commandOptions.application],
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.device.getAllByApplication(options.application, function(error, devices) {
        if (error != null) {
          return done(error);
        }
        console.log(visuals.widgets.table.horizontal(devices, ['id', 'name', 'device_type', 'is_online', 'application_name', 'status', 'last_seen']));
        return done();
      });
    }
  };

  exports.info = {
    signature: 'device <id>',
    description: 'list a single device',
    help: 'Use this command to show information about a single device.\n\nExamples:\n\n	$ resin device 317',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.device.get(params.id, function(error, device) {
        if (error != null) {
          return done(error);
        }
        console.log(visuals.widgets.table.vertical(device, ['id', 'name', 'device_type', 'is_online', 'ip_address', 'application_name', 'status', 'last_seen', 'uuid', 'commit', 'supervisor_version', 'is_web_accessible', 'note']));
        return done();
      });
    }
  };

  exports.remove = {
    signature: 'device rm <id>',
    description: 'remove a device',
    help: 'Use this command to remove a device from resin.io.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n\n	$ resin device rm 317\n	$ resin device rm 317 --yes',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      return visuals.patterns.remove('device', options.yes, function(callback) {
        return resin.models.device.remove(params.id, callback);
      }, done);
    }
  };

  exports.identify = {
    signature: 'device identify <uuid>',
    description: 'identify a device with a UUID',
    help: 'Use this command to identify a device.\n\nIn the Raspberry Pi, the ACT led is blinked several times.\n\nExamples:\n\n	$ resin device identify 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.device.identify(params.uuid, done);
    }
  };

  exports.rename = {
    signature: 'device rename <id> [name]',
    description: 'rename a resin device',
    help: 'Use this command to rename a device.\n\nIf you omit the name, you\'ll get asked for it interactively.\n\nExamples:\n\n	$ resin device rename 317 MyPi\n	$ resin device rename 317',
    permission: 'user',
    action: function(params, options, done) {
      return async.waterfall([
        function(callback) {
          if (!_.isEmpty(params.name)) {
            return callback(null, params.name);
          }
          return visuals.widgets.ask('How do you want to name this device?', null, callback);
        }, function(name, callback) {
          return resin.models.device.rename(params.id, name, callback);
        }
      ], done);
    }
  };

  exports.supported = {
    signature: 'devices supported',
    description: 'list all supported devices',
    help: 'Use this command to get the list of all supported devices\n\nExamples:\n\n	$ resin devices supported',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.device.getSupportedDeviceTypes(function(error, devices) {
        if (error != null) {
          return done(error);
        }
        _.each(devices, _.unary(console.log));
        return done();
      });
    }
  };

  exports.init = {
    signature: 'device init [device]',
    description: 'initialise a device with resin os',
    help: 'Use this command to download the OS image of a certain application and write it to an SD Card.\n\nNote that this command requires admin privileges.\n\nIf `device` is omitted, you will be prompted to select a device interactively.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nYou can quiet the progress bar by passing the `--quiet` boolean option.\n\nYou may have to unmount the device before attempting this operation.\n\nYou need to configure the network type and other settings:\n\nEthernet:\n  You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".\n\nWifi:\n  You can setup the device OS to use wifi by setting the `--network` option to "wifi".\n  If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.\n\nYou can omit network related options to be asked about them interactively.\n\nExamples:\n\n	$ resin device init --application 91\n	$ resin device init --application 91 --network ethernet\n	$ resin device init /dev/disk2 --application 91 --network wifi --ssid MyNetwork --key secret',
    options: [commandOptions.optionalApplication, commandOptions.network, commandOptions.wifiSsid, commandOptions.wifiKey],
    permission: 'user',
    action: function(params, options, done) {
      params.id = options.application;
      return async.waterfall([
        function(callback) {
          if (options.application != null) {
            return callback(null, options.application);
          }
          return vcs.getApplicationId(process.cwd(), callback);
        }, function(applicationId, callback) {
          params.id = applicationId;
          if (params.device != null) {
            return callback(null, params.device);
          }
          return visuals.patterns.selectDrive(callback);
        }, function(device, callback) {
          params.device = device;
          return visuals.patterns.confirm(options.yes, "This will completely erase " + params.device + ". Are you sure you want to continue?", callback);
        }, function(confirmed, callback) {
          if (!confirmed) {
            return done();
          }
          options.yes = confirmed;
          return osAction.download.action(params, options, callback);
        }, function(outputFile, callback) {
          params.image = outputFile;
          return osAction.install.action(params, options, callback);
        }
      ], done);
    }
  };

}).call(this);
