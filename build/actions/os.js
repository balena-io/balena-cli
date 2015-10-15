(function() {
  var Promise, _, commandOptions, form, fs, helpers, init, manager, patterns, resin, stepHandler, umount, unzip, visuals;

  fs = require('fs');

  _ = require('lodash');

  Promise = require('bluebird');

  umount = Promise.promisifyAll(require('umount'));

  unzip = require('unzip2');

  resin = require('resin-sdk');

  manager = require('resin-image-manager');

  visuals = require('resin-cli-visuals');

  form = require('resin-cli-form');

  init = require('resin-device-init');

  commandOptions = require('./command-options');

  helpers = require('../utils/helpers');

  patterns = require('../utils/patterns');

  exports.download = {
    signature: 'os download <type>',
    description: 'download an unconfigured os image',
    help: 'Use this command to download an unconfigured os image for a certain device type.\n\nExamples:\n\n	$ resin os download parallella -o ../foo/bar/parallella.img',
    permission: 'user',
    options: [
      {
        signature: 'output',
        description: 'output path',
        parameter: 'output',
        alias: 'o',
        required: 'You have to specify an output location'
      }
    ],
    action: function(params, options, done) {
      console.info("Getting device operating system for " + params.type);
      return manager.get(params.type).then(function(stream) {
        var bar, output, spinner;
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
        if (stream.mime === 'application/zip') {
          output = unzip.Extract({
            path: options.output
          });
        } else {
          output = fs.createWriteStream(options.output);
        }
        return helpers.waitStream(stream.pipe(output))["return"](options.output);
      }).tap(function(output) {
        return console.info("The image was downloaded to " + output);
      }).nodeify(done);
    }
  };

  stepHandler = function(step) {
    var bar;
    step.on('stdout', _.bind(process.stdout.write, process.stdout));
    step.on('stderr', _.bind(process.stderr.write, process.stderr));
    step.on('state', function(state) {
      if (state.operation.command === 'burn') {
        return;
      }
      return console.log(helpers.stateToString(state));
    });
    bar = new visuals.Progress('Writing Device OS');
    step.on('burn', _.bind(bar.update, bar));
    return helpers.waitStream(step);
  };

  exports.configure = {
    signature: 'os configure <image> <uuid>',
    description: 'configure an os image',
    help: 'Use this command to configure a previously download operating system image with a device.\n\nExamples:\n\n	$ resin os configure ../path/rpi.img 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9',
    permission: 'user',
    action: function(params, options, done) {
      console.info('Configuring operating system image');
      return resin.models.device.get(params.uuid).get('device_type').then(resin.models.device.getManifestBySlug).get('options').then(form.run).then(function(answers) {
        return init.configure(params.image, params.uuid, answers).then(stepHandler);
      }).nodeify(done);
    }
  };

  exports.initialize = {
    signature: 'os initialize <image>',
    description: 'initialize an os image',
    help: 'Use this command to initialize a previously configured operating system image.\n\nExamples:\n\n	$ resin os initialize ../path/rpi.img --type \'raspberry-pi\'',
    permission: 'user',
    options: [
      commandOptions.yes, {
        signature: 'type',
        description: 'device type',
        parameter: 'type',
        alias: 't',
        required: 'You have to specify a device type'
      }, {
        signature: 'drive',
        description: 'drive',
        parameter: 'drive',
        alias: 'd'
      }
    ],
    root: true,
    action: function(params, options, done) {
      console.info('Initializing device');
      return resin.models.device.getManifestBySlug(options.type).then(function(manifest) {
        var ref;
        return (ref = manifest.initialization) != null ? ref.options : void 0;
      }).then(function(questions) {
        return form.run(questions, {
          override: {
            drive: options.drive
          }
        });
      }).tap(function(answers) {
        var message;
        if (answers.drive == null) {
          return;
        }
        message = "This will erase " + answers.drive + ". Are you sure?";
        return patterns.confirm(options.yes, message)["return"](answers.drive).then(umount.umountAsync);
      }).tap(function(answers) {
        return init.initialize(params.image, options.type, answers).then(stepHandler);
      }).then(function(answers) {
        if (answers.drive == null) {
          return;
        }
        return umount.umountAsync(answers.drive).tap(function() {
          return console.info("You can safely remove " + answers.drive + " now");
        });
      }).nodeify(done);
    }
  };

}).call(this);
