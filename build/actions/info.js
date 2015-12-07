(function() {
  exports.version = {
    signature: 'version',
    description: 'output the version number',
    help: 'Display the Resin CLI version.',
    action: function(params, options, done) {
      var packageJSON;
      packageJSON = require('../../package.json');
      console.log(packageJSON.version);
      return done();
    }
  };

}).call(this);
