(function() {
  var _, async, commandOptions, diskio, fs, mkdirp, os, path, progressStream, resin, visuals;

  _ = require('lodash-contrib');

  fs = require('fs');

  os = require('os');

  async = require('async');

  path = require('path');

  mkdirp = require('mkdirp');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  progressStream = require('progress-stream');

  diskio = require('diskio');

  commandOptions = require('./command-options');

  exports.download = {
    signature: 'os download <id>',
    description: 'download device OS',
    help: 'Use this command to download the device OS configured to a specific network.\n\nEthernet:\n	You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".\n\nWifi:\n	You can setup the device OS to use wifi by setting the `--network` option to "wifi".\n	If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.\n\nBy default, this command saved the downloaded image into a resin specific directory.\nYou can save it to a custom location by specifying the `--output` option.\n\nExamples:\n\n	$ resin os download 91 --network ethernet\n	$ resin os download 91 --network wifi --ssid MyNetwork --key secreykey123\n	$ resin os download 91 --network ethernet --output ~/MyResinOS.zip',
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
          var bar;
          console.info("Destination file: " + options.output + "\n");
          bar = new visuals.widgets.Progress('Downloading Device OS');
          return resin.models.os.download(osParams, options.output, callback, function(state) {
            return bar.update(state);
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
      return async.waterfall([
        function(callback) {
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
          var bar, error, imageFileSize, imageFileStream, progress;
          if (!confirmed) {
            return done();
          }
          imageFileSize = fs.statSync(params.image).size;
          if (imageFileSize === 0) {
            error = new Error("Invalid OS image: " + params.image + ". The image is 0 bytes.");
            return callback(error);
          }
          progress = progressStream({
            length: imageFileSize,
            time: 500
          });
          if (!options.quiet) {
            bar = new visuals.widgets.Progress('Writing Device OS');
            progress.on('progress', function(status) {
              return bar.update(status);
            });
          }
          imageFileStream = fs.createReadStream(params.image).pipe(progress);
          return diskio.writeStream(params.device, imageFileStream, callback);
        }
      ], function(error) {
        var resinWritePath, windosu;
        if (error == null) {
          return done();
        }
        if (_.all([os.platform() === 'win32', error.code === 'EPERM' || error.code === 'EACCES', !options.fromScript])) {
          windosu = require('windosu');
          resinWritePath = "\"" + (path.join(__dirname, '..', '..', 'bin', 'resin-write')) + "\"";
          return windosu.exec("\"" + process.argv[0] + "\" " + resinWritePath + " \"" + params.image + "\" \"" + params.device + "\"");
        } else {
          return done(error);
        }
      });
    }
  };

}).call(this);
