(function() {
  var Promise, _, async, capitano, commandOptions, deviceConfig, form, helpers, htmlToText, image, inject, manager, pine, registerDevice, resin, vcs, visuals;

  Promise = require('bluebird');

  capitano = require('capitano');

  _ = require('lodash');

  async = require('async');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  vcs = require('resin-vcs');

  manager = require('resin-image-manager');

  image = require('resin-image');

  inject = require('resin-config-inject');

  registerDevice = require('resin-register-device');

  pine = require('resin-pine');

  deviceConfig = require('resin-device-config');

  form = require('resin-cli-form');

  htmlToText = require('html-to-text');

  helpers = require('../utils/helpers');

  commandOptions = require('./command-options');

  exports.list = {
    signature: 'devices',
    description: 'list all devices',
    help: 'Use this command to list all devices that belong to you.\n\nYou can filter the devices by application by using the `--application` option.\n\nExamples:\n\n	$ resin devices\n	$ resin devices --application MyApp\n	$ resin devices --app MyApp\n	$ resin devices -a MyApp',
    options: [commandOptions.optionalApplication],
    permission: 'user',
    action: function(params, options, done) {
      return Promise["try"](function() {
        if (options.application != null) {
          return resin.models.device.getAllByApplication(options.application);
        }
        return resin.models.device.getAll();
      }).tap(function(devices) {
        return console.log(visuals.table.horizontal(devices, ['id', 'name', 'device_type', 'is_online', 'application_name', 'status', 'last_seen']));
      }).nodeify(done);
    }
  };

  exports.info = {
    signature: 'device <uuid>',
    description: 'list a single device',
    help: 'Use this command to show information about a single device.\n\nExamples:\n\n	$ resin device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.device.get(params.uuid).then(function(device) {
        if (device.last_seen == null) {
          device.last_seen = 'Not seen';
        }
        return console.log(visuals.table.vertical(device, ["$" + device.name + "$", 'id', 'device_type', 'is_online', 'ip_address', 'application_name', 'status', 'last_seen', 'uuid', 'commit', 'supervisor_version', 'is_web_accessible', 'note']));
      }).nodeify(done);
    }
  };

  exports.remove = {
    signature: 'device rm <uuid>',
    description: 'remove a device',
    help: 'Use this command to remove a device from resin.io.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n\n	$ resin device rm 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9\n	$ resin device rm 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 --yes',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      return helpers.confirm(options.yes, 'Are you sure you want to delete the device?').then(function(confirmed) {
        if (!confirmed) {
          return;
        }
        return resin.models.device.remove(params.uuid);
      }).nodeify(done);
    }
  };

  exports.identify = {
    signature: 'device identify <uuid>',
    description: 'identify a device with a UUID',
    help: 'Use this command to identify a device.\n\nIn the Raspberry Pi, the ACT led is blinked several times.\n\nExamples:\n\n	$ resin device identify 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.device.identify(params.uuid).nodeify(done);
    }
  };

  exports.rename = {
    signature: 'device rename <uuid> [newName]',
    description: 'rename a resin device',
    help: 'Use this command to rename a device.\n\nIf you omit the name, you\'ll get asked for it interactively.\n\nExamples:\n\n	$ resin device rename 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 MyPi\n	$ resin device rename 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9',
    permission: 'user',
    action: function(params, options, done) {
      return Promise["try"](function() {
        if (!_.isEmpty(params.newName)) {
          return params.newName;
        }
        return form.ask({
          message: 'How do you want to name this device?',
          type: 'input'
        });
      }).then(_.partial(resin.models.device.rename, params.uuid)).nodeify(done);
    }
  };

  exports.await = {
    signature: 'device await <uuid>',
    description: 'await for a device to become online',
    help: 'Use this command to await for a device to become online.\n\nThe process will exit when the device becomes online.\n\nNotice that there is no time limit for this command, so it might run forever.\n\nYou can configure the poll interval with the --interval option (defaults to 3000ms).\n\nExamples:\n\n	$ resin device await 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9\n	$ resin device await 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 --interval 1000',
    options: [
      {
        signature: 'interval',
        parameter: 'interval',
        description: 'poll interval',
        alias: 'i'
      }
    ],
    permission: 'user',
    action: function(params, options, done) {
      var poll, spinner;
      if (options.interval == null) {
        options.interval = 3000;
      }
      spinner = new visuals.Spinner("Awaiting device: " + params.uuid);
      poll = function() {
        return resin.models.device.isOnline(params.uuid).then(function(isOnline) {
          if (isOnline) {
            spinner.stop();
            console.info("Device became online: " + params.uuid);
          } else {
            spinner.start();
            return Promise.delay(options.interval).then(poll);
          }
        });
      };
      return poll().nodeify(done);
    }
  };

  exports.init = {
    signature: 'device init [device]',
    description: 'initialise a device with resin os',
    help: 'Use this command to download the OS image of a certain application and write it to an SD Card.\n\nNote that this command requires admin privileges.\n\nIf `device` is omitted, you will be prompted to select a device interactively.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nYou can quiet the progress bar and other logging information by passing the `--quiet` boolean option.\n\nYou need to configure the network type and other settings:\n\nEthernet:\n  You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".\n\nWifi:\n  You can setup the device OS to use wifi by setting the `--network` option to "wifi".\n  If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.\n\nYou can omit network related options to be asked about them interactively.\n\nExamples:\n\n	$ resin device init\n	$ resin device init --application MyApp\n	$ resin device init --application MyApp --network ethernet\n	$ resin device init /dev/disk2 --application MyApp --network wifi --ssid MyNetwork --key secret',
    options: [commandOptions.optionalApplication, commandOptions.network, commandOptions.wifiSsid, commandOptions.wifiKey],
    permission: 'user',
    root: true,
    action: function(params, options, done) {
      var networkOptions;
      networkOptions = {
        network: options.network,
        wifiSsid: options.ssid,
        wifiKey: options.key
      };
      return async.waterfall([
        function(callback) {
          if (options.application != null) {
            return callback(null, options.application);
          }
          return vcs.getApplicationName(process.cwd()).nodeify(callback);
        }, function(applicationName, callback) {
          options.application = applicationName;
          return resin.models.application.has(options.application).nodeify(callback);
        }, function(hasApplication, callback) {
          if (!hasApplication) {
            return callback(new Error("Invalid application: " + options.application));
          }
          if (params.device != null) {
            return callback(null, params.device);
          }
          return visuals.drive().nodeify(callback);
        }, function(device, callback) {
          var message;
          params.device = device;
          message = "This will completely erase " + params.device + ". Are you sure you want to continue?";
          if (options.yes) {
            return callback(null, true);
          } else {
            return form.ask({
              message: message,
              type: 'confirm',
              "default": false
            }).nodeify(callback);
          }
        }, function(confirmed, callback) {
          if (!confirmed) {
            return done();
          }
          if (networkOptions.network != null) {
            return callback();
          }
          return form.run([
            {
              message: 'Network Type',
              name: 'network',
              type: 'list',
              choices: ['ethernet', 'wifi']
            }, {
              message: 'Wifi Ssid',
              name: 'wifiSsid',
              type: 'input',
              when: {
                network: 'wifi'
              }
            }, {
              message: 'Wifi Key',
              name: 'wifiKey',
              type: 'input',
              when: {
                network: 'wifi'
              }
            }
          ]).then(function(parameters) {
            return _.extend(networkOptions, parameters);
          }).nodeify(callback);
        }, function(callback) {
          console.info("Checking application: " + options.application);
          return resin.models.application.get(options.application).nodeify(callback);
        }, function(application, callback) {
          return async.parallel({
            manifest: function(callback) {
              console.info('Getting device manifest for the application');
              return resin.models.device.getManifestBySlug(application.device_type).nodeify(callback);
            },
            config: function(callback) {
              console.info('Fetching application configuration');
              return deviceConfig.get(options.application, networkOptions).nodeify(callback);
            }
          }, callback);
        }, function(results, callback) {
          params.manifest = results.manifest;
          console.info('Associating the device');
          return registerDevice.register(pine, results.config, function(error, device) {
            if (error != null) {
              return callback(error);
            }
            results.config.deviceId = device.id;
            results.config.uuid = device.uuid;
            results.config.registered_at = Math.floor(Date.now() / 1000);
            params.uuid = results.config.uuid;
            return callback(null, results);
          });
        }, function(results, callback) {
          var bar, spinner;
          console.info('Initializing device operating system image');
          if (process.env.DEBUG) {
            console.log(results.config);
          }
          bar = new visuals.Progress('Downloading Device OS');
          spinner = new visuals.Spinner('Downloading Device OS (size unknown)');
          return manager.configure(params.manifest, results.config, function(error, imagePath, removeCallback) {
            spinner.stop();
            return callback(error, imagePath, removeCallback);
          }, function(state) {
            if (state != null) {
              return bar.update(state);
            } else {
              return spinner.start();
            }
          });
        }, function(configuredImagePath, removeCallback, callback) {
          var bar;
          console.info('The base image was cached to improve initialization time of similar devices');
          console.info('Attempting to write operating system image to drive');
          bar = new visuals.Progress('Writing Device OS');
          return image.write({
            device: params.device,
            image: configuredImagePath,
            progress: _.bind(bar.update, bar)
          }, function(error) {
            if (error != null) {
              return callback(error);
            }
            return callback(null, configuredImagePath, removeCallback);
          });
        }, function(temporalImagePath, removeCallback, callback) {
          console.info('Image written successfully');
          return removeCallback(callback);
        }, function(callback) {
          return resin.models.device.get(params.uuid).nodeify(callback);
        }, function(device, callback) {
          console.info("Device created: " + device.name);
          return callback(null, params.uuid);
        }
      ], done);
    }
  };

}).call(this);
