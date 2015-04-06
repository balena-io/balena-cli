(function() {
  var _, async, commandOptions, elevate, mkdirp, npm, os, packageJSON, path, resin, updateActions, visuals;

  _ = require('lodash-contrib');

  os = require('os');

  async = require('async');

  path = require('path');

  mkdirp = require('mkdirp');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  commandOptions = require('./command-options');

  npm = require('../npm');

  packageJSON = require('../../package.json');

  updateActions = require('./update');

  elevate = require('../elevate');

  exports.download = {
    signature: 'os download <id>',
    description: 'download device OS',
    help: 'Use this command to download the device OS configured to a specific network.\n\nEthernet:\n	You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".\n\nWifi:\n	You can setup the device OS to use wifi by setting the `--network` option to "wifi".\n	If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.\n\nAlternatively, you can omit all kind of network configuration options to configure interactively.\n\nYou have to specify an output location with the `--output` option.\n\nExamples:\n\n	$ resin os download 91 --output ~/MyResinOS.zip\n	$ resin os download 91 --network ethernet --output ~/MyResinOS.zip\n	$ resin os download 91 --network wifi --ssid MyNetwork --key secreykey123 --output ~/MyResinOS.zip\n	$ resin os download 91 --network ethernet --output ~/MyResinOS.zip',
    options: [
      commandOptions.network, commandOptions.wifiSsid, commandOptions.wifiKey, {
        signature: 'output',
        parameter: 'output',
        description: 'output file',
        alias: 'o',
        required: 'You need to specify an output file'
      }
    ],
    permission: 'user',
    action: function(params, options, done) {
      var osParams;
      osParams = {
        network: options.network,
        wifiSsid: options.ssid,
        wifiKey: options.key,
        appId: params.id
      };
      return async.waterfall([
        function(callback) {
          if (osParams.network != null) {
            return callback();
          }
          return visuals.patterns.selectNetworkParameters(function(error, parameters) {
            if (error != null) {
              return callback(error);
            }
            _.extend(osParams, parameters);
            return callback();
          });
        }, function(callback) {
          return mkdirp(path.dirname(options.output), _.unary(callback));
        }, function(callback) {
          var bar, spinner;
          console.info("Destination file: " + options.output + "\n");
          bar = new visuals.widgets.Progress('Downloading Device OS');
          spinner = new visuals.widgets.Spinner('Downloading Device OS (size unknown)');
          return resin.models.os.download(osParams, options.output, function(error) {
            spinner.stop();
            if (error != null) {
              return callback(error);
            }
          }, function(state) {
            if (state != null) {
              return bar.update(state);
            } else {
              return spinner.start();
            }
          });
        }
      ], function(error) {
        if (error != null) {
          return done(error);
        }
        console.info("\nFinished downloading " + options.output);
        return done(null, options.output);
      });
    }
  };

  exports.install = {
    signature: 'os install <image> [device]',
    description: 'write an operating system image to a device',
    help: 'Use this command to write an operating system image to a device.\n\nNote that this command requires admin privileges.\n\nIf `device` is omitted, you will be prompted to select a device interactively.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nYou can quiet the progress bar by passing the `--quiet` boolean option.\n\nYou may have to unmount the device before attempting this operation.\n\nSee the `drives` command to get a list of all connected devices to your machine and their respective ids.\n\nIn Mac OS X:\n\n	$ sudo diskutil unmountDisk /dev/xxx\n\nIn GNU/Linux:\n\n	$ sudo umount /dev/xxx\n\nExamples:\n\n	$ resin os install rpi.iso /dev/disk2',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      var bundle;
      bundle = require('../devices/raspberry-pi');
      return async.waterfall([
        function(callback) {
          return npm.isUpdated(packageJSON.name, packageJSON.version, callback);
        }, function(isUpdated, callback) {
          if (isUpdated) {
            return callback();
          }
          console.info('Resin CLI is outdated.\n\nIn order to avoid device compatibility issues, this command\nrequires that you have the Resin CLI updated.\n\nUpdating now...');
          return updateActions.update.action(params, options, _.unary(callback));
        }, function(callback) {
          if (params.device != null) {
            return callback(null, params.device);
          }
          return visuals.patterns.selectDrive(function(error, device) {
            if (error != null) {
              return callback(error);
            }
            if (device == null) {
              return callback(new Error('No removable devices available'));
            }
            return callback(null, device);
          });
        }, function(device, callback) {
          var message;
          params.device = device;
          message = "This will completely erase " + params.device + ". Are you sure you want to continue?";
          return visuals.patterns.confirm(options.yes, message, callback);
        }, function(confirmed, callback) {
          var bar;
          if (!confirmed) {
            return done();
          }
          bar = new visuals.widgets.Progress('Writing Device OS');
          params.progress = bar.update;
          return bundle.write(params, callback);
        }
      ], function(error) {
        var resinWritePath;
        if (error == null) {
          return done();
        }
        if (elevate.shouldElevate(error) && !options.fromScript) {
          resinWritePath = "\"" + (path.join(__dirname, '..', '..', 'bin', 'resin-write')) + "\"";
          return elevate.run("\"" + process.argv[0] + "\" " + resinWritePath + " \"" + params.image + "\" \"" + params.device + "\"");
        } else {
          return done(error);
        }
      });
    }
  };

}).call(this);
