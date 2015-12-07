(function() {
  exports.list = {
    signature: 'settings',
    description: 'print current settings',
    help: 'Use this command to display detected settings\n\nExamples:\n\n	$ resin settings',
    action: function(params, options, done) {
      var prettyjson, resin;
      resin = require('resin-sdk');
      prettyjson = require('prettyjson');
      return resin.settings.getAll().then(prettyjson.render).then(console.log).nodeify(done);
    }
  };

}).call(this);
