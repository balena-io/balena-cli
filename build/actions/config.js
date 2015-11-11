(function() {
  var Promise, _, config, prettyjson, umount, visuals;

  _ = require('lodash');

  Promise = require('bluebird');

  umount = Promise.promisifyAll(require('umount'));

  visuals = require('resin-cli-visuals');

  config = require('resin-config-json');

  prettyjson = require('prettyjson');

  exports.read = {
    signature: 'config read',
    description: 'read a device configuration',
    help: 'Use this command to read the config.json file from a provisioned device\n\nExamples:\n\n	$ resin config read --type raspberry-pi\n	$ resin config read --type raspberry-pi --drive /dev/disk2',
    options: [
      {
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
    permission: 'user',
    root: true,
    action: function(params, options, done) {
      return Promise["try"](function() {
        return options.drive || visuals.drive('Select the device drive');
      }).tap(umount.umountAsync).then(function(drive) {
        return config.read(drive, options.type);
      }).tap(function(configJSON) {
        return console.info(prettyjson.render(configJSON));
      }).nodeify(done);
    }
  };

  exports.write = {
    signature: 'config write <key> <value>',
    description: 'write a device configuration',
    help: 'Use this command to write the config.json file of a provisioned device\n\nExamples:\n\n	$ resin config write --type raspberry-pi username johndoe\n	$ resin config write --type raspberry-pi --drive /dev/disk2 username johndoe\n	$ resin config write --type raspberry-pi files.network/settings "..."',
    options: [
      {
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
    permission: 'user',
    root: true,
    action: function(params, options, done) {
      return Promise["try"](function() {
        return options.drive || visuals.drive('Select the device drive');
      }).tap(umount.umountAsync).then(function(drive) {
        return config.read(drive, options.type).then(function(configJSON) {
          console.info("Setting " + params.key + " to " + params.value);
          _.set(configJSON, params.key, params.value);
          return configJSON;
        }).tap(function() {
          return umount.umountAsync(drive);
        }).then(function(configJSON) {
          return config.write(drive, options.type, configJSON);
        });
      }).tap(function() {
        return console.info('Done');
      }).nodeify(done);
    }
  };

}).call(this);
