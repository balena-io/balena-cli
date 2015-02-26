(function() {
  var packageJSON;

  packageJSON = require('../../package.json');

  exports.version = {
    signature: 'version',
    description: 'output the version number',
    action: function() {
      console.log(packageJSON.name + ": " + packageJSON.version);
      return console.log("node: " + process.version);
    }
  };

}).call(this);
