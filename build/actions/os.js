(function() {
  var _, form, fs, helpers, init, manager, resin, stepHandler, visuals;

  fs = require('fs');

  _ = require('lodash');

  resin = require('resin-sdk');

  manager = require('resin-image-manager');

  visuals = require('resin-cli-visuals');

  form = require('resin-cli-form');

  init = require('resin-device-init');

  helpers = require('../utils/helpers');

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
        output = fs.createWriteStream(options.output);
        return helpers.waitStream(stream.pipe(output))["return"](options.output);
      }).tap(function(output) {
        return console.log("The image was downloaded to " + output);
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

}).call(this);
