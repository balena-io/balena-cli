(function() {
  var _, capitano, nplugm;

  nplugm = require('nplugm');

  _ = require('lodash');

  capitano = require('capitano');

  exports.register = function(regex) {
    return nplugm.list(regex).map(function(plugin) {
      var command;
      command = require(plugin);
      if (!_.isArray(command)) {
        return capitano.command(command);
      }
      return _.each(command, capitano.command);
    })["catch"](function(error) {
      return console.error(error.message);
    });
  };

}).call(this);
