(function() {
  var packageJSON;

  packageJSON = require('../../package.json');

  exports.version = {
    signature: 'version',
    description: 'output the version number',
    help: 'Display the Resin CLI version.',
    action: function() {
      return console.log(packageJSON.version);
    }
  };

}).call(this);
