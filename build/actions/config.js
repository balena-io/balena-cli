(function() {
  var Promise, imagefs, prettyjson, resin, rindle, umount, visuals;

  Promise = require('bluebird');

  umount = Promise.promisifyAll(require('umount'));

  resin = require('resin-sdk');

  imagefs = require('resin-image-fs');

  visuals = require('resin-cli-visuals');

  prettyjson = require('prettyjson');

  rindle = require('rindle');

  exports.read = {
    signature: 'config read',
    description: 'read a device configuration',
    help: 'Use this command to read the config.json file from a provisioned device\n\nExample:\n\n	$ resin config read --type raspberry-pi\n	$ resin config read --type raspberry-pi --drive /dev/disk2',
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
        return resin.models.device.getManifestBySlug(options.type).then(function(manifest) {
          var config, ref;
          config = (ref = manifest.configuration) != null ? ref.config : void 0;
          if (config == null) {
            throw new Error("Unsupported device type: " + options.type);
          }
          return imagefs.read({
            image: drive,
            partition: config.partition,
            path: config.path
          });
        });
      }).then(rindle.extract).then(JSON.parse).then(function(config) {
        return console.log(prettyjson.render(config));
      }).nodeify(done);
    }
  };

}).call(this);
