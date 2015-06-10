(function() {
  var packageJSON, settings;

  settings = require('resin-settings-client');

  packageJSON = require('../../package.json');

  exports.version = {
    signature: 'version',
    description: 'output the version number',
    help: 'Display the Resin CLI version.',
    action: function(params, options, done) {
      console.log(packageJSON.version);
      return done();
    }
  };

  exports.config = {
    signature: 'config',
    description: 'see your current configuration',
    help: 'See your current Resin CLI configuration.\n\nConfiguration lives in $HOME/.resin/config.',
    action: function(params, options, done) {
      var key, ref, value;
      ref = settings.get();
      for (key in ref) {
        value = ref[key];
        console.log(key + ": " + value);
      }
      return done();
    }
  };

}).call(this);
