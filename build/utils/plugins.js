(function() {
  var _, capitano, nplugm, patterns;

  nplugm = require('nplugm');

  _ = require('lodash');

  capitano = require('capitano');

  patterns = require('./patterns');

  exports.register = function(regex) {
    return nplugm.list(regex).map(function(plugin) {
      var command;
      command = require(plugin);
      command.plugin = true;
      if (!_.isArray(command)) {
        return capitano.command(command);
      }
      return _.each(command, capitano.command);
    })["catch"](function(error) {
      return patterns.printErrorMessage(error.message);
    });
  };

}).call(this);
