(function() {
  var Promise, _, getConfigPartitionInformationByType, imagefs, prettyjson, readConfigJSON, resin, rindle, stringToStream, umount, visuals, writeConfigJSON;

  _ = require('lodash');

  Promise = require('bluebird');

  umount = Promise.promisifyAll(require('umount'));

  stringToStream = require('string-to-stream');

  resin = require('resin-sdk');

  imagefs = require('resin-image-fs');

  visuals = require('resin-cli-visuals');

  prettyjson = require('prettyjson');

  rindle = require('rindle');

  getConfigPartitionInformationByType = function(type) {
    return resin.models.device.getManifestBySlug(type).then(function(manifest) {
      var config, ref;
      config = (ref = manifest.configuration) != null ? ref.config : void 0;
      if (config == null) {
        throw new Error("Unsupported device type: " + type);
      }
      return config;
    });
  };

  readConfigJSON = function(drive, type) {
    return getConfigPartitionInformationByType(type).then(function(configuration) {
      return imagefs.read({
        image: drive,
        partition: configuration.partition,
        path: configuration.path
      });
    }).then(rindle.extract).then(JSON.parse);
  };

  writeConfigJSON = function(drive, type, config) {
    return getConfigPartitionInformationByType(type).then(function(configuration) {
      return imagefs.write({
        image: drive,
        partition: configuration.partition,
        path: configuration.path
      }, stringToStream(config));
    }).then(rindle.wait);
  };

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
        return readConfigJSON(drive, options.type);
      }).tap(function(config) {
        return console.info(prettyjson.render(config));
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
        return readConfigJSON(drive, options.type).then(function(config) {
          console.info("Setting " + params.key + " to " + params.value);
          _.set(config, params.key, params.value);
          return JSON.stringify(config);
        }).tap(function() {
          return umount.umountAsync(drive);
        }).then(function(config) {
          return writeConfigJSON(drive, options.type, config);
        });
      }).tap(function() {
        return console.info('Done');
      }).nodeify(done);
    }
  };

}).call(this);
