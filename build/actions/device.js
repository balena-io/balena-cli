(function() {
  var Promise, _, capitano, commandOptions, events, form, patterns, resin, rimraf, tmp, visuals;

  Promise = require('bluebird');

  capitano = Promise.promisifyAll(require('capitano'));

  _ = require('lodash');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  form = require('resin-cli-form');

  events = require('resin-cli-events');

  rimraf = Promise.promisify(require('rimraf'));

  patterns = require('../utils/patterns');

  tmp = Promise.promisifyAll(require('tmp'));

  tmp.setGracefulCleanup();

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
        console.log(visuals.table.vertical(device, ["$" + device.name + "$", 'id', 'device_type', 'is_online', 'ip_address', 'application_name', 'status', 'last_seen', 'uuid', 'commit', 'supervisor_version', 'is_web_accessible', 'note']));
        return events.send('device.open', {
          device: device.uuid
        });
      }).nodeify(done);
    }
  };

  exports.register = {
    signature: 'device register <application>',
    description: 'register a device',
    help: 'Use this command to register a device to an application.\n\nExamples:\n\n	$ resin device register MyApp',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.application.get(params.application).then(function(application) {
        var uuid;
        uuid = resin.models.device.generateUUID();
        console.info("Registering to " + application.app_name + ": " + uuid);
        return resin.models.device.register(application.app_name, uuid);
      }).get('uuid').nodeify(done);
    }
  };

  exports.remove = {
    signature: 'device rm <uuid>',
    description: 'remove a device',
    help: 'Use this command to remove a device from resin.io.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n\n	$ resin device rm 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9\n	$ resin device rm 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 --yes',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      return patterns.confirm(options.yes, 'Are you sure you want to delete the device?').then(function() {
        return resin.models.device.remove(params.uuid);
      }).tap(function() {
        return events.send('device.delete', {
          device: params.uuid
        });
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
      }).then(_.partial(resin.models.device.rename, params.uuid)).tap(function() {
        return events.send('device.rename', {
          device: params.uuid
        });
      }).nodeify(done);
    }
  };

  exports.init = {
    signature: 'device init',
    description: 'initialise a device with resin os',
    help: 'Use this command to download the OS image of a certain application and write it to an SD Card.\n\nNotice this command may ask for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n\n	$ resin device init\n	$ resin device init --application MyApp',
    options: [commandOptions.optionalApplication, commandOptions.yes],
    permission: 'user',
    root: true,
    action: function(params, options, done) {
      return Promise["try"](function() {
        if (options.application != null) {
          return options.application;
        }
        return patterns.selectApplication();
      }).then(resin.models.application.get).then(function(application) {
        var download;
        download = function() {
          return tmp.tmpNameAsync().then(function(temporalPath) {
            return capitano.runAsync("os download " + application.device_type + " --output " + temporalPath);
          }).disposer(_.ary(rimraf, 1));
        };
        return Promise.using(download(), function(temporalPath) {
          return capitano.runAsync("device register " + application.app_name).then(resin.models.device.get).tap(function(device) {
            return capitano.runAsync("os configure " + temporalPath + " " + device.uuid).then(function() {
              return capitano.runAsync("os initialize " + temporalPath + " " + device.uuid);
            });
          });
        }).then(function(device) {
          console.log('Done');
          return device.uuid;
        });
      }).nodeify(done);
    }
  };

}).call(this);
