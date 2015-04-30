(function() {
  var packageJSON;

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

}).call(this);
